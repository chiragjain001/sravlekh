import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
  Optional,
} from '@nestjs/common';
import { CacheService } from '../infrastructure/cache/cache.service';
import { attendancePolicyKey, instituteTimezoneKey } from '../shared/cache-keys';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import {
  AuditAction,
  AttendanceStatus,
  TimetableExceptionType,
  UserRole,
  Prisma,
  type AttendanceSession,
  type AttendanceRecord,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { getTeacherBatchIds } from '../shared/teacher-scope';
import {
  SaveAttendanceDraftDto,
  FinalizeAttendanceDto,
  CorrectAttendanceRecordDto,
  CreateTimetableExceptionDto,
  AdminOverrideSessionDto,
  QueryTodaySessionsDto,
  QueryStudentAttendanceDto,
  MarkAttendanceDto,
  CorrectAttendanceDto,
  QueryAttendanceDto,
  QueryAttendanceSummaryDto,
  UpdateAttendancePolicyDto,
} from './dto/attendance.dto';
import { calculateAttendanceMetrics } from './attendance-calculator';

export type DerivedSessionState =
  | 'SCHEDULED'
  | 'OPEN'
  | 'GRACE_PERIOD'
  | 'AWAITING_FINALIZATION'
  | 'MISSED'
  | 'FINALIZED'
  | 'CANCELLED'
  | 'EXAM_OVERRIDE';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  // ── 1. Query Today's Sessions (Timetable-Derived, Snapshot-Backed) ─────────

  async getTodaySessions(
    instituteId: string,
    actor: AuthenticatedUser,
    query: QueryTodaySessionsDto,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { featureFlags: true },
    });
    const flags = (institute?.featureFlags as Record<string, any>) || {};
    const attendanceFlags = flags.attendance || {};
    const timezone = await this.getInstituteTimezone(instituteId);
    const openBeforeMinutes = attendanceFlags.openBeforeMinutes ?? 15;
    const gracePeriodMinutes = attendanceFlags.gracePeriodMinutes ?? 30;
    const cutoffHour = attendanceFlags.cutoffHour ?? 18;

    const targetDate = query.date || this.formatDateInTimezone(new Date(), timezone);
    const now = new Date();

    // 1. Fetch matching TimetableSlots for target date or recurring
    const targetDayOfWeek = this.getDayOfWeek(targetDate, timezone);

    const slots = await this.prisma.timetableSlot.findMany({
      where: {
        instituteId,
        ...(query.batchId ? { batchId: query.batchId } : {}),
      },
      include: {
        batch: { select: { id: true, name: true, classYear: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    // Filter slots matching today's calendar date OR recurring day
    const matchingSlots = slots.filter((slot) => {
      if (slot.isRecurring) {
        const slotDay = this.getDayOfWeek(this.formatDateInTimezone(slot.startTime, timezone), timezone);
        return slotDay === targetDayOfWeek;
      }
      const slotDateStr = this.formatDateInTimezone(slot.startTime, timezone);
      return slotDateStr === targetDate;
    });

    // 2. Fetch existing TimetableExceptions for targetDate
    const exceptions = await this.prisma.timetableException.findMany({
      where: { instituteId, date: targetDate },
    });
    const exceptionMap = new Map(exceptions.map((e) => [e.timetableSlotId, e]));

    // 3. Fetch scheduled Exams for batches on targetDate to detect exam overrides
    const dayStart = new Date(`${targetDate}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDate}T23:59:59.999Z`);
    const exams = await this.prisma.exam.findMany({
      where: {
        instituteId,
        scheduledDate: { gte: dayStart, lte: dayEnd },
      },
      select: { id: true, title: true, batchId: true, scheduledDate: true, durationMinutes: true },
    });
    const examsByBatch = new Map<string, typeof exams>();
    for (const exam of exams) {
      const list = examsByBatch.get(exam.batchId) || [];
      list.push(exam);
      examsByBatch.set(exam.batchId, list);
    }

    // 4. Upsert/Find AttendanceSessions for all matching slots
    const sessions: any[] = [];

    for (const slot of matchingSlots) {
      if (!slot.batchId) continue;

      const exception = exceptionMap.get(slot.id);

      // Calculate slot start and end times mapped to targetDate
      const { slotStart, slotEnd } = this.projectTimesToDate(slot.startTime, slot.endTime, targetDate, timezone);

      // Check overlapping official exams
      let examOverrideId: string | null = null;
      let examTitle: string | null = null;
      const batchExams = examsByBatch.get(slot.batchId) || [];
      for (const exam of batchExams) {
        if (exam.scheduledDate) {
          const examStart = exam.scheduledDate;
          const examEnd = new Date(examStart.getTime() + (exam.durationMinutes || 60) * 60 * 1000);
          if (examStart < slotEnd && examEnd > slotStart) {
            examOverrideId = exam.id;
            examTitle = exam.title;
            break;
          }
        }
      }

      // Teacher info snapshot resolution
      let teacherName = 'Unassigned';
      if (slot.teacherUserId) {
        const teacherUser = await this.prisma.user.findUnique({
          where: { id: slot.teacherUserId },
          select: { name: true },
        });
        if (teacherUser) teacherName = teacherUser.name;
      }

      // Subject info snapshot resolution
      let subjectName = slot.title;
      if (slot.subjectId) {
        const subject = await this.prisma.subject.findUnique({
          where: { id: slot.subjectId },
          select: { name: true },
        });
        if (subject) subjectName = subject.name;
      }

      // Check exception details
      const isCancelled = exception?.type === TimetableExceptionType.CANCELLED;
      const substituteUserId = exception?.type === TimetableExceptionType.SUBSTITUTE ? exception.substituteUserId : null;

      let subTeacherName: string | null = null;
      if (substituteUserId) {
        const subUser = await this.prisma.user.findUnique({
          where: { id: substituteUserId },
          select: { name: true },
        });
        if (subUser) subTeacherName = subUser.name;
      }

      // Find or create AttendanceSession
      let session = await this.prisma.attendanceSession.findUnique({
        where: {
          timetableSlotId_date: {
            timetableSlotId: slot.id,
            date: targetDate,
          },
        },
        include: {
          roster: { select: { id: true, studentProfileId: true } },
          records: { select: { id: true, status: true, studentProfileId: true } },
        },
      });

      if (!session) {
        session = await this.prisma.attendanceSession.create({
          data: {
            instituteId,
            timetableSlotId: slot.id,
            date: targetDate,
            batchId: slot.batchId,
            subjectId: slot.subjectId,
            snapshotTeacherUserId: slot.teacherUserId || 'UNASSIGNED',
            snapshotTeacherName: teacherName,
            snapshotSubjectName: subjectName,
            snapshotBatchName: slot.batch?.name || 'Class',
            snapshotStartTime: slotStart,
            snapshotEndTime: slotEnd,
            snapshotRoom: slot.roomRef,
            substituteUserId: substituteUserId ?? undefined,
            examOverrideId: examOverrideId ?? undefined,
            cancelledAt: isCancelled ? exception?.createdAt : undefined,
            cancelledReason: isCancelled ? exception?.reason : undefined,
          },
          include: {
            roster: { select: { id: true, studentProfileId: true } },
            records: { select: { id: true, status: true, studentProfileId: true } },
          },
        });
      } else {
        const needsUpdate =
          (isCancelled && !session.cancelledAt) ||
          (!isCancelled && session.cancelledAt && exception?.type !== TimetableExceptionType.CANCELLED) ||
          (substituteUserId && session.substituteUserId !== substituteUserId) ||
          (examOverrideId && session.examOverrideId !== examOverrideId);

        if (needsUpdate) {
          session = await this.prisma.attendanceSession.update({
            where: { id: session.id },
            data: {
              cancelledAt: isCancelled ? (session.cancelledAt || new Date()) : undefined,
              cancelledReason: isCancelled ? exception?.reason : undefined,
              substituteUserId: substituteUserId ?? session.substituteUserId,
              examOverrideId: examOverrideId ?? session.examOverrideId,
            },
            include: {
              roster: { select: { id: true, studentProfileId: true } },
              records: { select: { id: true, status: true, studentProfileId: true } },
            },
          });
        }
      }

      const rosterCount = session.roster.length;
      const recordsCount = session.records.length;

      const derivedState = this.computeDerivedState(
        {
          finalizedAt: session.finalizedAt,
          cancelledAt: session.cancelledAt,
          examOverrideId: session.examOverrideId,
          snapshotStartTime: session.snapshotStartTime,
          snapshotEndTime: session.snapshotEndTime,
          rosterCount,
          recordsCount,
        },
        now,
        openBeforeMinutes,
        gracePeriodMinutes,
        cutoffHour,
      );

      const authority = await this.evaluateSessionAuthority(session, actor);

      sessions.push({
        ...session,
        derivedState,
        examTitle,
        substituteTeacherName: subTeacherName,
        rosterCount,
        recordsCount,
        ...authority,
      });
    }

    // Standalone sessions created for targetDate
    const standaloneSessions = await this.prisma.attendanceSession.findMany({
      where: {
        instituteId,
        date: targetDate,
        timetableSlotId: null,
        ...(query.batchId ? { batchId: query.batchId } : {}),
      },
      include: {
        roster: { select: { id: true, studentProfileId: true } },
        records: { select: { id: true, status: true, studentProfileId: true } },
      },
    });

    for (const session of standaloneSessions) {
      const rosterCount = session.roster.length;
      const recordsCount = session.records.length;
      const derivedState = this.computeDerivedState(
        {
          finalizedAt: session.finalizedAt,
          cancelledAt: session.cancelledAt,
          examOverrideId: session.examOverrideId,
          snapshotStartTime: session.snapshotStartTime,
          snapshotEndTime: session.snapshotEndTime,
          rosterCount,
          recordsCount,
        },
        now,
        openBeforeMinutes,
        gracePeriodMinutes,
        cutoffHour,
      );
      const authority = await this.evaluateSessionAuthority(session, actor);
      sessions.push({
        ...session,
        derivedState,
        examTitle: null,
        substituteTeacherName: null,
        rosterCount,
        recordsCount,
        ...authority,
      });
    }

    // Role-specific filtering
    let visibleSessions = sessions;
    if (actor.role === UserRole.TEACHER && !query.teacherUserId) {
      visibleSessions = sessions.filter(
        (s) =>
          s.snapshotTeacherUserId === actor.id ||
          s.substituteUserId === actor.id ||
          s.canOperate,
      );
    } else if (query.teacherUserId) {
      visibleSessions = sessions.filter(
        (s) => s.snapshotTeacherUserId === query.teacherUserId || s.substituteUserId === query.teacherUserId,
      );
    }

    visibleSessions.sort((a, b) => new Date(a.snapshotStartTime).getTime() - new Date(b.snapshotStartTime).getTime());

    return {
      date: targetDate,
      timezone,
      sessions: visibleSessions,
      meta: {
        total: visibleSessions.length,
        openCount: visibleSessions.filter((s) => s.derivedState === 'OPEN' || s.derivedState === 'GRACE_PERIOD').length,
        finalizedCount: visibleSessions.filter((s) => s.derivedState === 'FINALIZED').length,
        awaitingCount: visibleSessions.filter((s) => s.derivedState === 'AWAITING_FINALIZATION').length,
        missedCount: visibleSessions.filter((s) => s.derivedState === 'MISSED').length,
        cancelledCount: visibleSessions.filter((s) => s.derivedState === 'CANCELLED').length,
      },
    };
  }

  // ── 2. Get Session Details & Auto-Initialize Roster ─────────────────────────

  async getSessionDetails(instituteId: string, sessionId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        batch: { select: { id: true, name: true, classYear: true } },
        roster: {
          include: {
            studentProfile: {
              select: {
                id: true,
                rollNumber: true,
                user: { select: { name: true, email: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { snapshotRollNo: 'asc' },
        },
        records: true,
      },
    });

    if (!session || session.instituteId !== instituteId) {
      throw new NotFoundException('Attendance session not found.');
    }

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { featureFlags: true },
    });
    const flags = (institute?.featureFlags as Record<string, any>) || {};
    const attendanceFlags = flags.attendance || {};
    const openBeforeMinutes = attendanceFlags.openBeforeMinutes ?? 15;
    const gracePeriodMinutes = attendanceFlags.gracePeriodMinutes ?? 30;
    const cutoffHour = attendanceFlags.cutoffHour ?? 18;

    let currentRoster = session.roster;
    if (session.rosterSnapshotAt === null) {
      currentRoster = await this.getOrInitializeSessionRoster(session.id, actor);
    }

    const authority = await this.evaluateSessionAuthority(session, actor);

    const derivedState = this.computeDerivedState(
      {
        finalizedAt: session.finalizedAt,
        cancelledAt: session.cancelledAt,
        examOverrideId: session.examOverrideId,
        snapshotStartTime: session.snapshotStartTime,
        snapshotEndTime: session.snapshotEndTime,
        rosterCount: currentRoster.length,
        recordsCount: session.records.length,
      },
      new Date(),
      openBeforeMinutes,
      gracePeriodMinutes,
      cutoffHour,
    );

    const recordMap = new Map(session.records.map((r) => [r.studentProfileId, r]));
    const students = currentRoster.map((r) => {
      const record = recordMap.get(r.studentProfileId);
      return {
        rosterId: r.id,
        studentProfileId: r.studentProfileId,
        rollNumber: r.snapshotRollNo ?? r.studentProfile.rollNumber,
        name: r.snapshotName ?? r.studentProfile.user.name,
        avatarUrl: r.studentProfile.user.avatarUrl,
        status: record ? record.status : null,
        recordId: record ? record.id : null,
        recordVersion: record ? record.version : 1,
        correctedAt: record ? record.correctedAt : null,
        correctionReason: record ? record.correctionReason : null,
      };
    });

    const markedStudents = students.filter((s) => s.status !== null);
    const summary = {
      total: students.length,
      marked: markedStudents.length,
      present: students.filter((s) => s.status === AttendanceStatus.PRESENT).length,
      absent: students.filter((s) => s.status === AttendanceStatus.ABSENT).length,
      late: students.filter((s) => s.status === AttendanceStatus.LATE).length,
      excused: students.filter((s) => s.status === AttendanceStatus.EXCUSED).length,
      unmarked: students.filter((s) => s.status === null).length,
    };

    return {
      session: {
        id: session.id,
        date: session.date,
        batchId: session.batchId,
        batchName: session.snapshotBatchName,
        subjectId: session.subjectId,
        subjectName: session.snapshotSubjectName,
        teacherUserId: session.snapshotTeacherUserId,
        teacherName: session.snapshotTeacherName,
        substituteUserId: session.substituteUserId,
        periodNumber: session.snapshotPeriodNumber,
        startTime: session.snapshotStartTime,
        endTime: session.snapshotEndTime,
        room: session.snapshotRoom,
        finalizedAt: session.finalizedAt,
        finalizedByUserId: session.finalizedByUserId,
        cancelledAt: session.cancelledAt,
        cancelledReason: session.cancelledReason,
        version: session.version,
        rosterSnapshotAt: session.rosterSnapshotAt,
        derivedState,
      },
      summary,
      students,
      authority,
    };
  }

  // ── 3. Roster Freeze (Atomic, Idempotent, Concurrency-Safe) ─────────────────

  async getOrInitializeSessionRoster(sessionId: string, actor: AuthenticatedUser) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        roster: {
          include: {
            studentProfile: {
              select: {
                id: true,
                rollNumber: true,
                user: { select: { name: true, email: true, avatarUrl: true } },
              },
            },
          },
          orderBy: { snapshotRollNo: 'asc' },
        },
      },
    });

    if (!session) throw new NotFoundException('Session not found.');

    if (session.rosterSnapshotAt !== null && session.roster.length > 0) {
      return session.roster;
    }

    // Freeze active students in batch
    const activeStudents = await this.prisma.studentProfile.findMany({
      where: {
        batchId: session.batchId,
        user: { status: 'ACTIVE' },
      },
      include: { user: { select: { name: true } } },
      orderBy: { rollNumber: 'asc' },
    });

    if (activeStudents.length === 0) {
      await this.prisma.attendanceSession.update({
        where: { id: sessionId },
        data: { rosterSnapshotAt: new Date() },
      });
      return [];
    }

    const createdRoster = await this.prisma.$transaction(async (tx) => {
      await Promise.all(
        activeStudents.map((student) =>
          tx.attendanceSessionRoster.upsert({
            where: {
              sessionId_studentProfileId: {
                sessionId: session.id,
                studentProfileId: student.id,
              },
            },
            create: {
              sessionId: session.id,
              studentProfileId: student.id,
              snapshotRollNo: student.rollNumber,
              snapshotName: student.user.name,
            },
            update: {},
          }),
        ),
      );

      await tx.attendanceSession.update({
        where: { id: session.id },
        data: { rosterSnapshotAt: new Date() },
      });

      return tx.attendanceSessionRoster.findMany({
        where: { sessionId: session.id },
        include: {
          studentProfile: {
            select: {
              id: true,
              rollNumber: true,
              user: { select: { name: true, email: true, avatarUrl: true } },
            },
          },
        },
        orderBy: { snapshotRollNo: 'asc' },
      });
    });

    await this.writeAudit(
      session.instituteId,
      actor.id,
      AuditAction.CREATE,
      'attendance_sessions',
      session.id,
      null,
      { action: 'ROSTER_FREEZE', count: createdRoster.length },
    );

    return createdRoster;
  }

  // ── 4. Save Attendance Draft (OCC, Batched, Autosave-Resilient) ────────────

  async saveDraft(
    instituteId: string,
    sessionId: string,
    dto: SaveAttendanceDraftDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: { roster: true },
    });

    if (!session || session.instituteId !== instituteId) {
      throw new NotFoundException('Attendance session not found.');
    }

    if (session.cancelledAt) {
      throw new ForbiddenException('Cannot mark attendance for a cancelled session.');
    }

    if (session.finalizedAt) {
      throw new ForbiddenException('Attendance has already been finalized. Use the correction workflow.');
    }

    const auth = await this.evaluateSessionAuthority(session, actor);
    if (!auth.canOperate) {
      throw new ForbiddenException(auth.rejectionReason || 'You are not authorized to mark this session.');
    }

    if (session.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: 'ATTENDANCE_OCC_CONFLICT',
        currentVersion: session.version,
        message: 'This attendance session was modified by another user or session. Please refresh and review before saving.',
      });
    }

    if (session.rosterSnapshotAt === null) {
      await this.getOrInitializeSessionRoster(session.id, actor);
    }

    const sessionDate = new Date(`${session.date}T00:00:00.000Z`);
    const updatedVersion = session.version + 1;

    await this.prisma.$transaction(async (tx) => {
      for (const entry of dto.entries) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentProfileId: {
              sessionId: session.id,
              studentProfileId: entry.studentProfileId,
            },
          },
          create: {
            sessionId: session.id,
            studentProfileId: entry.studentProfileId,
            batchId: session.batchId,
            subjectId: session.subjectId,
            date: sessionDate,
            status: entry.status,
            markedByUserId: actor.id,
            version: 1,
          },
          update: {
            sessionId: session.id,
            status: entry.status,
            markedByUserId: actor.id,
            version: { increment: 1 },
          },
        });
      }

      await tx.attendanceSession.update({
        where: { id: session.id },
        data: { version: updatedVersion },
      });
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'attendance_sessions',
      session.id,
      { version: session.version },
      { action: 'SAVE_DRAFT', entriesCount: dto.entries.length, version: updatedVersion },
    );

    return {
      message: `Saved draft for ${dto.entries.length} student(s).`,
      version: updatedVersion,
    };
  }

  // ── 5. Finalize Session (100% Evaluation, Lock & Publish) ──────────────────

  async finalizeSession(
    instituteId: string,
    sessionId: string,
    dto: FinalizeAttendanceDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
      include: {
        roster: true,
        records: true,
      },
    });

    if (!session || session.instituteId !== instituteId) {
      throw new NotFoundException('Attendance session not found.');
    }

    if (session.cancelledAt) {
      throw new ForbiddenException('Cannot finalize a cancelled session.');
    }

    if (session.finalizedAt) {
      throw new ConflictException('This session is already finalized.');
    }

    const auth = await this.evaluateSessionAuthority(session, actor);
    if (!auth.canOperate) {
      throw new ForbiddenException(auth.rejectionReason || 'You are not authorized to finalize this session.');
    }

    if (session.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: 'ATTENDANCE_OCC_CONFLICT',
        currentVersion: session.version,
        message: 'This session was modified. Please reload before finalizing.',
      });
    }

    let roster = session.roster;
    if (session.rosterSnapshotAt === null || roster.length === 0) {
      roster = await this.getOrInitializeSessionRoster(session.id, actor);
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where: { sessionId: session.id },
    });
    const markedIds = new Set(records.map((r) => r.studentProfileId));
    const missingStudents = roster.filter((r) => !markedIds.has(r.studentProfileId));

    if (missingStudents.length > 0) {
      const institute = await this.prisma.institute.findUnique({
        where: { id: instituteId },
        select: { featureFlags: true },
      });
      const flags = (institute?.featureFlags as Record<string, any>) || {};
      const autoAbsent = flags.attendance?.autoAbsentUnmarkedOnFinalize ?? false;

      if (!autoAbsent) {
        throw new BadRequestException({
          code: 'ATTENDANCE_INCOMPLETE_ROSTER',
          message: `Cannot finalize: ${missingStudents.length} student(s) remain unmarked. Every student must be explicitly evaluated.`,
          unmarkedCount: missingStudents.length,
        });
      }

      const sessionDate = new Date(`${session.date}T00:00:00.000Z`);
      await this.prisma.$transaction(
        missingStudents.map((s) =>
          this.prisma.attendanceRecord.create({
            data: {
              sessionId: session.id,
              studentProfileId: s.studentProfileId,
              batchId: session.batchId,
              subjectId: session.subjectId,
              date: sessionDate,
              status: AttendanceStatus.ABSENT,
              markedByUserId: actor.id,
              version: 1,
            },
          }),
        ),
      );
    }

    const updatedVersion = session.version + 1;
    const finalized = await this.prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        finalizedAt: new Date(),
        finalizedByUserId: actor.id,
        version: updatedVersion,
      },
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'attendance_sessions',
      session.id,
      { finalizedAt: null },
      { action: 'FINALIZE', finalizedByUserId: actor.id, version: updatedVersion },
    );

    return {
      message: 'Attendance finalized and published successfully.',
      session: finalized,
    };
  }

  // ── 6. Correct Attendance Record (Post-Finalization, Audited) ─────────────

  async correctAttendanceRecord(
    instituteId: string,
    sessionId: string,
    recordId: string,
    dto: CorrectAttendanceRecordDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.instituteId !== instituteId) {
      throw new NotFoundException('Session not found.');
    }

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
    });
    if (!record || record.sessionId !== sessionId) {
      throw new NotFoundException('Attendance record not found in this session.');
    }

    const timezone = await this.getInstituteTimezone(session.instituteId);
    const isHistorical = session.date !== this.formatDateInTimezone(new Date(), timezone);

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { featureFlags: true },
    });
    const flags = (institute?.featureFlags as Record<string, any>) || {};
    const attendanceFlags = flags.attendance || {};

    if (attendanceFlags.allowFinalizedCorrection === false && actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Institute policy prohibits correcting finalized attendance records.');
    }

    const requiredCapability = isHistorical ? 'ATTENDANCE_CORRECT_HISTORICAL' : 'ATTENDANCE_CORRECT';

    let hasCap = await this.hasAttendanceCapability(actor, requiredCapability, {
      batchId: session.batchId,
      subjectId: session.subjectId ?? undefined,
    });

    if (!hasCap && isHistorical && attendanceFlags.allowTeacherHistoricalEdit === true) {
      hasCap = await this.hasAttendanceCapability(actor, 'ATTENDANCE_CORRECT', {
        batchId: session.batchId,
        subjectId: session.subjectId ?? undefined,
      });
    }

    if (!hasCap) {
      throw new ForbiddenException(`You do not have capability [${requiredCapability}] to correct this record.`);
    }

    if (record.version !== dto.expectedVersion) {
      throw new ConflictException({
        code: 'ATTENDANCE_RECORD_OCC_CONFLICT',
        currentVersion: record.version,
        message: 'This record was modified by another user. Please reload before saving.',
      });
    }

    const oldStatus = record.status;
    const newStatus = dto.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const correctionLog = await tx.attendanceCorrectionLog.create({
        data: {
          instituteId,
          sessionId: session.id,
          recordId: record.id,
          studentProfileId: record.studentProfileId,
          previousStatus: oldStatus,
          newStatus,
          reason: dto.reason,
          correctedByUserId: actor.id,
        },
      });

      const updatedRecord = await tx.attendanceRecord.update({
        where: { id: record.id },
        data: {
          status: newStatus,
          correctedAt: new Date(),
          correctionReason: dto.reason,
          correctedByUserId: actor.id,
          version: { increment: 1 },
        },
      });

      await tx.attendanceSession.update({
        where: { id: session.id },
        data: { version: { increment: 1 } },
      });

      return { updatedRecord, correctionLog };
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'attendance_records',
      record.id,
      { status: oldStatus },
      { status: newStatus, reason: dto.reason, correctionLogId: result.correctionLog.id },
    );

    return result.updatedRecord;
  }

  // ── 7. Timetable Exceptions & Substitutions ────────────────────────────────

  async createTimetableException(
    instituteId: string,
    dto: CreateTimetableExceptionDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const hasCap = await this.hasAttendanceCapability(actor, 'ATTENDANCE_ADMIN');
    if (!hasCap) {
      throw new ForbiddenException('Only users with ATTENDANCE_ADMIN capability can create timetable exceptions.');
    }

    const slot = await this.prisma.timetableSlot.findUnique({
      where: { id: dto.timetableSlotId },
    });
    if (!slot || slot.instituteId !== instituteId) {
      throw new NotFoundException('Timetable slot not found.');
    }

    const exception = await this.prisma.timetableException.upsert({
      where: {
        timetableSlotId_date: {
          timetableSlotId: dto.timetableSlotId,
          date: dto.date,
        },
      },
      create: {
        instituteId,
        timetableSlotId: dto.timetableSlotId,
        date: dto.date,
        type: dto.type,
        substituteUserId: dto.substituteUserId,
        targetDate: dto.targetDate,
        overrideStart: dto.overrideStart ? new Date(dto.overrideStart) : null,
        overrideEnd: dto.overrideEnd ? new Date(dto.overrideEnd) : null,
        reason: dto.reason,
        createdByUserId: actor.id,
      },
      update: {
        type: dto.type,
        substituteUserId: dto.substituteUserId,
        targetDate: dto.targetDate,
        overrideStart: dto.overrideStart ? new Date(dto.overrideStart) : null,
        overrideEnd: dto.overrideEnd ? new Date(dto.overrideEnd) : null,
        reason: dto.reason,
      },
    });

    const existingSession = await this.prisma.attendanceSession.findUnique({
      where: {
        timetableSlotId_date: {
          timetableSlotId: dto.timetableSlotId,
          date: dto.date,
        },
      },
    });

    if (existingSession) {
      if (dto.type === TimetableExceptionType.CANCELLED) {
        await this.prisma.attendanceSession.update({
          where: { id: existingSession.id },
          data: {
            cancelledAt: new Date(),
            cancelledReason: dto.reason,
            cancelledByUserId: actor.id,
            version: { increment: 1 },
          },
        });
      } else if (dto.type === TimetableExceptionType.SUBSTITUTE) {
        await this.prisma.attendanceSession.update({
          where: { id: existingSession.id },
          data: {
            substituteUserId: dto.substituteUserId,
            version: { increment: 1 },
          },
        });
      } else if (dto.type === TimetableExceptionType.RESCHEDULED && dto.targetDate) {
        await this.prisma.attendanceSession.update({
          where: { id: existingSession.id },
          data: {
            cancelledAt: new Date(),
            cancelledReason: `Rescheduled to ${dto.targetDate}: ${dto.reason}`,
            cancelledByUserId: actor.id,
            version: { increment: 1 },
          },
        });
      }
    }

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.CREATE,
      'timetable_exceptions',
      exception.id,
      null,
      dto,
    );

    return exception;
  }

  // ── 8. Admin Session Override (Cancel, Uncancel, Force-Unlock) ─────────────

  async adminOverrideSession(
    instituteId: string,
    sessionId: string,
    dto: AdminOverrideSessionDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const hasCap = await this.hasAttendanceCapability(actor, 'ATTENDANCE_OVERRIDE');
    if (!hasCap) {
      throw new ForbiddenException('ATTENDANCE_OVERRIDE capability required.');
    }

    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.instituteId !== instituteId) {
      throw new NotFoundException('Attendance session not found.');
    }

    let updateData: Prisma.AttendanceSessionUpdateInput = {};

    if (dto.action === 'CANCEL') {
      updateData = {
        cancelledAt: new Date(),
        cancelledReason: dto.reason,
        cancelledByUserId: actor.id,
        version: { increment: 1 },
      };
    } else if (dto.action === 'UNCANCEL') {
      updateData = {
        cancelledAt: null,
        cancelledReason: null,
        cancelledByUserId: null,
        version: { increment: 1 },
      };
    } else if (dto.action === 'FORCE_UNLOCK') {
      updateData = {
        finalizedAt: null,
        finalizedByUserId: null,
        version: { increment: 1 },
      };
    }

    const updated = await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'attendance_sessions',
      sessionId,
      { action: dto.action, previousVersion: session.version },
      { action: dto.action, reason: dto.reason, version: updated.version },
    );

    return updated;
  }

  // ── 9. Student Attendance (Finalized Records Only, Server-Filtered) ────────

  async getStudentAttendance(
    instituteId: string,
    actor: AuthenticatedUser,
    query: QueryStudentAttendanceDto,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    let targetStudentProfileId: string;

    if (actor.role === UserRole.STUDENT) {
      const studentProfile = await this.prisma.studentProfile.findUnique({
        where: { userId: actor.id },
      });
      if (!studentProfile || studentProfile.instituteId !== instituteId) {
        throw new NotFoundException('Student profile not found.');
      }
      targetStudentProfileId = studentProfile.id;
    } else {
      const studentId = (query as any).studentProfileId;
      if (!studentId) {
        throw new BadRequestException('studentProfileId required for non-student actor.');
      }
      targetStudentProfileId = studentId;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const skip = (page - 1) * limit;

    const where: Prisma.AttendanceRecordWhereInput = {
      studentProfileId: targetStudentProfileId,
      batch: { instituteId },
      session: { finalizedAt: { not: null } },
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            date: {
              ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
              ...(query.dateTo && { lte: new Date(query.dateTo) }),
            },
          }
        : {}),
    };

    const [allRecords, paginatedRecords, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        select: {
          id: true,
          status: true,
          subjectId: true,
          date: true,
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          session: {
            select: {
              snapshotSubjectName: true,
              snapshotPeriodNumber: true,
              snapshotStartTime: true,
              snapshotEndTime: true,
            },
          },
          batch: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    const overallMetrics = calculateAttendanceMetrics(allRecords);

    const subjectMap = new Map<string, { subjectId: string; records: typeof allRecords }>();
    for (const r of allRecords) {
      const key = r.subjectId || 'GENERAL';
      const existing = subjectMap.get(key) || { subjectId: key, records: [] };
      existing.records.push(r);
      subjectMap.set(key, existing);
    }

    const subjectIds = Array.from(subjectMap.keys()).filter((id) => id !== 'GENERAL');
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, name: true, code: true },
    });
    const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

    const subjectMetrics = Array.from(subjectMap.entries()).map(([subId, entry]) => {
      const metrics = calculateAttendanceMetrics(entry.records);
      return {
        subjectId: subId === 'GENERAL' ? null : subId,
        subjectName: subId === 'GENERAL' ? 'General' : subjectNameMap.get(subId) || 'Subject',
        percentage: metrics.overallAttendancePct,
        attended: metrics.attendedCount,
        total: metrics.totalEvaluated,
        breakdown: metrics.statusBreakdown,
      };
    });

    const history = paginatedRecords.map((r) => ({
      recordId: r.id,
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      subjectName: r.session?.snapshotSubjectName || 'Class',
      periodNumber: r.session?.snapshotPeriodNumber || null,
      startTime: r.session?.snapshotStartTime || null,
      endTime: r.session?.snapshotEndTime || null,
      batchName: r.batch.name,
    }));

    return {
      overall: {
        percentage: overallMetrics.overallAttendancePct,
        attended: overallMetrics.attendedCount,
        total: overallMetrics.totalEvaluated,
        breakdown: overallMetrics.statusBreakdown,
      },
      subjects: subjectMetrics,
      history,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ── 10. Missing Attendance & Awaiting Finalization Detection ───────────────

  async getMissingSessions(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const timezone = await this.getInstituteTimezone(instituteId);
    const today = this.formatDateInTimezone(new Date(), timezone);
    const res = await this.getTodaySessions(instituteId, actor, { date: today });
    return res.sessions.filter((s: any) => s.derivedState === 'MISSED');
  }

  async getAwaitingFinalizationSessions(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const timezone = await this.getInstituteTimezone(instituteId);
    const today = this.formatDateInTimezone(new Date(), timezone);
    const res = await this.getTodaySessions(instituteId, actor, { date: today });
    return res.sessions.filter((s: any) => s.derivedState === 'AWAITING_FINALIZATION');
  }

  async detectAndAlertMissingSessions(instituteId: string) {
    const timezone = await this.getInstituteTimezone(instituteId);
    const today = this.formatDateInTimezone(new Date(), timezone);
    const actor: AuthenticatedUser = {
      id: 'system',
      role: UserRole.ADMIN,
      instituteId,
      email: 'system@aios.internal',
      name: 'AIOS System Monitor',
    };

    const res = await this.getTodaySessions(instituteId, actor, { date: today });
    const missing = res.sessions.filter((s: any) => s.derivedState === 'MISSED');

    const notified: string[] = [];

    // Find institute admins to notify as administrative recipients
    const adminUsers = await this.prisma.user.findMany({
      where: {
        instituteId,
        role: { in: [UserRole.ADMIN, UserRole.FOUNDER] },
      },
      select: { id: true },
      take: 5,
    });
    const adminUserIds = adminUsers.map((u: any) => u.id);

    for (const session of missing) {
      if (session.missingAlertSentAt) continue;

      const responsibleTeacherId = session.substituteUserId || session.snapshotTeacherUserId;
      const targetUserIds = new Set<string>();

      if (responsibleTeacherId && responsibleTeacherId !== 'UNASSIGNED') {
        targetUserIds.add(responsibleTeacherId);
      }
      adminUserIds.forEach((id: string) => targetUserIds.add(id));

      await this.prisma.attendanceSession.update({
        where: { id: session.id },
        data: {
          missingAlertSentAt: new Date(),
          missingAlertJobId: `missing-${session.id}-${Date.now()}`,
        },
      });

      const recipientIds = Array.from(targetUserIds);
      if (recipientIds.length > 0) {
        try {
          const creatorId = responsibleTeacherId && responsibleTeacherId !== 'UNASSIGNED'
            ? responsibleTeacherId
            : (adminUserIds[0] || 'system');

          const notice = await this.prisma.notice.create({
            data: {
              instituteId,
              createdByUserId: creatorId,
              title: 'Missing Attendance Alert',
              body: `Attendance for ${session.snapshotBatchName} · ${session.snapshotSubjectName || 'Class'} was not submitted. Please submit immediately.`,
              channels: ['IN_APP'],
              targetAudience: { userIds: recipientIds },
            },
          });

          for (const uid of recipientIds) {
            await this.prisma.noticeDelivery.create({
              data: {
                noticeId: notice.id,
                userId: uid,
                channel: 'IN_APP',
                status: 'SENT',
                sentAt: new Date(),
              },
            });
          }
          notified.push(session.id);
        } catch (err) {
          this.logger.error(`Failed to send missing alert notice for session ${session.id}`, err);
        }
      }
    }

    return { detectedCount: missing.length, newlyNotifiedCount: notified.length };
  }

  // ── 10B. Admin Attendance Policy Configuration ────────────────────────────

  async getAttendancePolicy(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const key = attendancePolicyKey(instituteId);
    if (this.cache) {
      const cached = await this.cache.get<any>(key);
      if (cached) return cached;
    }
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { featureFlags: true },
    });
    const flags = (institute?.featureFlags as Record<string, any>) || {};
    const attendance = flags.attendance || {};

    const policy = {
      cutoffHour: typeof attendance.cutoffHour === 'number' ? attendance.cutoffHour : 18,
      openBeforeMinutes: typeof attendance.openBeforeMinutes === 'number' ? attendance.openBeforeMinutes : 15,
      gracePeriodMinutes: typeof attendance.gracePeriodMinutes === 'number' ? attendance.gracePeriodMinutes : 30,
      timezone: typeof attendance.timezone === 'string' ? attendance.timezone : 'Asia/Kolkata',
      allowTeacherHistoricalEdit: typeof attendance.allowTeacherHistoricalEdit === 'boolean' ? attendance.allowTeacherHistoricalEdit : false,
      allowFinalizedCorrection: typeof attendance.allowFinalizedCorrection === 'boolean' ? attendance.allowFinalizedCorrection : true,
    };
    if (this.cache) {
      await this.cache.set(key, policy, 600);
    }
    return policy;
  }

  async updateAttendancePolicy(
    instituteId: string,
    dto: UpdateAttendancePolicyDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only administrators can modify attendance policy.');
    }

    if (dto.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: dto.timezone });
      } catch {
        throw new BadRequestException(`Invalid IANA timezone: ${dto.timezone}`);
      }
    }

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { featureFlags: true },
    });
    if (!institute) {
      throw new NotFoundException('Institute not found.');
    }

    const currentFlags = (institute.featureFlags as Record<string, any>) || {};
    const currentAttendance = currentFlags.attendance || {};

    const updatedAttendance = {
      ...currentAttendance,
      ...(dto.cutoffHour !== undefined ? { cutoffHour: dto.cutoffHour } : {}),
      ...(dto.openBeforeMinutes !== undefined ? { openBeforeMinutes: dto.openBeforeMinutes } : {}),
      ...(dto.gracePeriodMinutes !== undefined ? { gracePeriodMinutes: dto.gracePeriodMinutes } : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
      ...(dto.allowTeacherHistoricalEdit !== undefined ? { allowTeacherHistoricalEdit: dto.allowTeacherHistoricalEdit } : {}),
      ...(dto.allowFinalizedCorrection !== undefined ? { allowFinalizedCorrection: dto.allowFinalizedCorrection } : {}),
    };

    const newFlags = {
      ...currentFlags,
      attendance: updatedAttendance,
    };

    await this.prisma.institute.update({
      where: { id: instituteId },
      data: { featureFlags: newFlags },
    });

    if (this.cache) {
      await this.cache.del(attendancePolicyKey(instituteId));
      await this.cache.del(instituteTimezoneKey(instituteId));
    }

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'AttendancePolicy',
      instituteId,
      currentAttendance,
      updatedAttendance,
    );

    return {
      success: true,
      policy: updatedAttendance,
    };
  }

  // ── 11. Legacy Backward Compatibility Endpoints ────────────────────────────

  async markAttendance(instituteId: string, dto: MarkAttendanceDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.assertTeacherOwnsBatchIfTeacher(actor, dto.batchId);

    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found in this institute.');
    }

    if (dto.entries.length === 0) {
      throw new BadRequestException('At least one attendance entry is required.');
    }

    const date = new Date(dto.date);
    const dateStr = dto.date.split('T')[0] ?? dto.date;

    let session = await this.prisma.attendanceSession.findFirst({
      where: {
        instituteId,
        batchId: dto.batchId,
        date: dateStr,
      },
    });

    if (!session) {
      session = await this.prisma.attendanceSession.create({
        data: {
          instituteId,
          batchId: dto.batchId,
          date: dateStr,
          snapshotTeacherUserId: actor.id,
          snapshotTeacherName: actor.name || actor.role,
          snapshotBatchName: batch.name,
          snapshotStartTime: date,
          snapshotEndTime: new Date(date.getTime() + 60 * 60 * 1000),
          rosterSnapshotAt: new Date(),
        },
      });
    }

    const results = await this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            sessionId_studentProfileId: {
              sessionId: session!.id,
              studentProfileId: entry.studentProfileId,
            },
          },
          create: {
            sessionId: session?.id,
            studentProfileId: entry.studentProfileId,
            batchId: dto.batchId,
            date,
            status: entry.status,
            markedByUserId: actor.id,
          },
          update: {
            sessionId: session?.id,
            status: entry.status,
            markedByUserId: actor.id,
          },
        }),
      ),
    );

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'attendance_records', dto.batchId, null, {
      batchId: dto.batchId,
      date: dto.date,
      count: results.length,
    });

    return { message: `Marked attendance for ${results.length} student(s).`, records: results };
  }

  async correctAttendance(
    instituteId: string,
    recordId: string,
    dto: CorrectAttendanceDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { batch: { select: { id: true, instituteId: true } } },
    });
    if (!record || record.batch.instituteId !== instituteId) {
      throw new NotFoundException('Attendance record not found.');
    }

    const oldStatus = record.status;
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status: dto.status,
        correctedAt: new Date(),
        correctionReason: dto.reason,
        correctedByUserId: actor.id,
      },
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'attendance_records',
      recordId,
      { status: oldStatus },
      { status: dto.status, reason: dto.reason },
    );

    return updated;
  }

  async findAll(instituteId: string, query: QueryAttendanceDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 30;
    const skip = (page - 1) * limit;

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    const where: Record<string, unknown> = { batch: { instituteId } };

    if (teacherBatchIds !== null) {
      where['batchId'] = query.batchId
        ? { in: teacherBatchIds.includes(query.batchId) ? [query.batchId] : [] }
        : { in: teacherBatchIds };
    } else if (query.batchId) {
      where['batchId'] = query.batchId;
    }

    if (query.studentProfileId) where['studentProfileId'] = query.studentProfileId;

    if (query.dateFrom || query.dateTo) {
      where['date'] = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      };
    }

    const [records, total] = await Promise.all([
      this.prisma.attendanceRecord.findMany({
        where,
        include: {
          studentProfile: { select: { id: true, rollNumber: true, user: { select: { name: true } } } },
          batch: { select: { id: true, name: true } },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.attendanceRecord.count({ where }),
    ]);

    return { data: records, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getSummary(instituteId: string, query: QueryAttendanceSummaryDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    const where: Record<string, unknown> = { batch: { instituteId } };

    if (teacherBatchIds !== null) {
      where['batchId'] = query.batchId
        ? { in: teacherBatchIds.includes(query.batchId) ? [query.batchId] : [] }
        : { in: teacherBatchIds };
    } else if (query.batchId) {
      where['batchId'] = query.batchId;
    }

    if (query.dateFrom || query.dateTo) {
      where['date'] = {
        ...(query.dateFrom && { gte: new Date(query.dateFrom) }),
        ...(query.dateTo && { lte: new Date(query.dateTo) }),
      };
    }

    const records = await this.prisma.attendanceRecord.findMany({
      where,
      select: {
        status: true,
        batchId: true,
        studentProfileId: true,
        batch: { select: { name: true } },
        studentProfile: { select: { rollNumber: true, user: { select: { name: true } } } },
      },
    });

    const overallMetrics = calculateAttendanceMetrics(records);

    const byBatchMap = new Map<string, { batchName: string; records: typeof records }>();
    for (const r of records) {
      const b = byBatchMap.get(r.batchId) || { batchName: r.batch.name, records: [] };
      b.records.push(r);
      byBatchMap.set(r.batchId, b);
    }

    const byBatch = Array.from(byBatchMap.entries()).map(([batchId, v]) => {
      const metrics = calculateAttendanceMetrics(v.records);
      return {
        batchId,
        batchName: v.batchName,
        totalMarked: metrics.totalEvaluated,
        attendancePct: metrics.overallAttendancePct ?? 0,
      };
    });

    const byStudentMap = new Map<string, { name: string; rollNumber: string | null; records: typeof records }>();
    if (query.batchId) {
      for (const r of records) {
        const s = byStudentMap.get(r.studentProfileId) || {
          name: r.studentProfile.user.name,
          rollNumber: r.studentProfile.rollNumber,
          records: [],
        };
        s.records.push(r);
        byStudentMap.set(r.studentProfileId, s);
      }
    }

    const byStudent = Array.from(byStudentMap.entries()).map(([studentProfileId, v]) => {
      const metrics = calculateAttendanceMetrics(v.records);
      return {
        studentProfileId,
        name: v.name,
        rollNumber: v.rollNumber,
        totalMarked: metrics.totalEvaluated,
        attendancePct: metrics.overallAttendancePct ?? 0,
      };
    }).sort((a, b) => a.attendancePct - b.attendancePct);

    return {
      overallAttendancePct: overallMetrics.overallAttendancePct ?? 0,
      statusBreakdown: overallMetrics.statusBreakdown,
      byBatch,
      byStudent,
    };
  }

  // ── Helper Domain Methods ──────────────────────────────────────────────────

  private computeDerivedState(
    session: {
      finalizedAt: Date | null;
      cancelledAt: Date | null;
      examOverrideId: string | null;
      snapshotStartTime: Date;
      snapshotEndTime: Date;
      rosterCount: number;
      recordsCount: number;
    },
    now = new Date(),
    openBeforeMinutes = 15,
    gracePeriodMinutes = 30,
    cutoffHour = 18,
  ): DerivedSessionState {
    if (session.cancelledAt) return 'CANCELLED';
    if (session.examOverrideId) return 'EXAM_OVERRIDE';
    if (session.finalizedAt) return 'FINALIZED';

    const openAt = new Date(session.snapshotStartTime.getTime() - openBeforeMinutes * 60 * 1000);
    const closeAt = session.snapshotEndTime;

    // Daily cutoff limit: allow teachers to mark until cutoffHour (e.g. 18:00) on the session date
    const sessionDateCutoff = new Date(session.snapshotEndTime);
    sessionDateCutoff.setHours(cutoffHour, 0, 0, 0);

    const normalGraceEnd = new Date(session.snapshotEndTime.getTime() + gracePeriodMinutes * 60 * 1000);
    const graceEnd = sessionDateCutoff > normalGraceEnd ? sessionDateCutoff : normalGraceEnd;

    if (now < openAt) return 'SCHEDULED';
    if (now >= openAt && now <= closeAt) return 'OPEN';
    if (now > closeAt && now <= graceEnd) return 'GRACE_PERIOD';

    if (session.rosterCount > 0 && session.recordsCount >= session.rosterCount) {
      return 'AWAITING_FINALIZATION';
    }

    return 'MISSED';
  }

  private async evaluateSessionAuthority(
    session: AttendanceSession,
    actor: AuthenticatedUser,
  ): Promise<{
    canOperate: boolean;
    canCorrect: boolean;
    isSubstitute: boolean;
    isBlockedBySubstitute: boolean;
    rejectionReason?: string;
  }> {
    if (actor.role === UserRole.FOUNDER || actor.role === UserRole.ADMIN) {
      return {
        canOperate: true,
        canCorrect: true,
        isSubstitute: false,
        isBlockedBySubstitute: false,
      };
    }

    if (session.substituteUserId) {
      if (actor.id === session.substituteUserId) {
        return {
          canOperate: true,
          canCorrect: false,
          isSubstitute: true,
          isBlockedBySubstitute: false,
        };
      }
      if (actor.id === session.snapshotTeacherUserId) {
        return {
          canOperate: false,
          canCorrect: false,
          isSubstitute: false,
          isBlockedBySubstitute: true,
          rejectionReason: 'Attendance handled by assigned substitute.',
        };
      }
      return {
        canOperate: false,
        canCorrect: false,
        isSubstitute: false,
        isBlockedBySubstitute: false,
        rejectionReason: 'Not authorized for this session.',
      };
    }

    if (actor.id === session.snapshotTeacherUserId) {
      return {
        canOperate: true,
        canCorrect: false,
        isSubstitute: false,
        isBlockedBySubstitute: false,
      };
    }

    const hasOverride = await this.permissionsService.hasPermission(actor.id, 'ATTENDANCE_OVERRIDE', {
      batchId: session.batchId,
      subjectId: session.subjectId ?? undefined,
    });
    const hasAdmin = await this.permissionsService.hasPermission(actor.id, 'ATTENDANCE_ADMIN', {
      batchId: session.batchId,
      subjectId: session.subjectId ?? undefined,
    });
    const hasTake = await this.permissionsService.hasPermission(actor.id, 'ATTENDANCE_TAKE', {
      batchId: session.batchId,
      subjectId: session.subjectId ?? undefined,
    });

    if (hasOverride || hasAdmin) {
      return {
        canOperate: true,
        canCorrect: true,
        isSubstitute: false,
        isBlockedBySubstitute: false,
      };
    }

    if (hasTake) {
      return {
        canOperate: true,
        canCorrect: false,
        isSubstitute: false,
        isBlockedBySubstitute: false,
      };
    }

    return {
      canOperate: false,
      canCorrect: false,
      isSubstitute: false,
      isBlockedBySubstitute: false,
      rejectionReason: 'No attendance authority for this timetable slot.',
    };
  }

  async hasAttendanceCapability(
    actor: AuthenticatedUser,
    capability: 'ATTENDANCE_TAKE' | 'ATTENDANCE_CORRECT' | 'ATTENDANCE_CORRECT_HISTORICAL' | 'ATTENDANCE_OVERRIDE' | 'ATTENDANCE_ADMIN',
    scope: { batchId?: string; subjectId?: string } = {},
  ): Promise<boolean> {
    if (actor.role === UserRole.FOUNDER || actor.role === UserRole.ADMIN) return true;
    const hasDirect = await this.permissionsService.hasPermission(actor.id, capability, scope);
    if (hasDirect) return true;
    return this.permissionsService.hasPermission(actor.id, 'ATTENDANCE_ADMIN', scope);
  }

  async getInstituteTimezone(instituteId: string): Promise<string> {
    const key = instituteTimezoneKey(instituteId);
    if (this.cache) {
      const cached = await this.cache.get<string>(key);
      if (cached) return cached;
    }
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { featureFlags: true },
    });
    const flags = (institute?.featureFlags as Record<string, any>) || {};
    const attendanceFlags = flags.attendance || {};
    const tz = attendanceFlags.timezone;
    if (tz && typeof tz === 'string') {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        if (this.cache) await this.cache.set(key, tz, 3600);
        return tz;
      } catch {
        // Fallback
      }
    }
    if (this.cache) await this.cache.set(key, 'Asia/Kolkata', 3600);
    return 'Asia/Kolkata';
  }

  private formatDateInTimezone(date: Date, timezone: string): string {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
      return parts;
    } catch {
      return date.toISOString().split('T')[0] ?? '';
    }
  }

  private getDayOfWeek(dateStr: string, timezone: string): number {
    const d = new Date(`${dateStr}T12:00:00.000Z`);
    return d.getUTCDay();
  }

  private projectTimesToDate(
    slotStart: Date,
    slotEnd: Date,
    targetDate: string,
    timezone: string,
  ): { slotStart: Date; slotEnd: Date } {
    const startHour = slotStart.getUTCHours();
    const startMin = slotStart.getUTCMinutes();
    const endHour = slotEnd.getUTCHours();
    const endMin = slotEnd.getUTCMinutes();

    const projectedStart = new Date(`${targetDate}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00.000Z`);
    const projectedEnd = new Date(`${targetDate}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00.000Z`);

    return { slotStart: projectedStart, slotEnd: projectedEnd };
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this institute.");
    }
  }

  private async assertTeacherOwnsBatchIfTeacher(actor: AuthenticatedUser, batchId: string) {
    if (actor.role !== UserRole.TEACHER) return;
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    if (!teacherBatchIds?.includes(batchId)) {
      throw new ForbiddenException('You can only mark attendance for batches you are assigned to.');
    }
  }

  private async writeAudit(
    instituteId: string,
    actorId: string,
    action: AuditAction,
    entity: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId,
          action,
          entity,
          entityId,
          oldValue: oldValue ? (oldValue as Prisma.InputJsonValue) : Prisma.DbNull,
          newValue: newValue ? (newValue as Prisma.InputJsonValue) : Prisma.DbNull,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log for attendance', err);
    }
  }
}
