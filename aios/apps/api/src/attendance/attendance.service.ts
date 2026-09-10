import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AttendanceStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { getTeacherBatchIds } from '../shared/teacher-scope';
import {
  MarkAttendanceDto,
  CorrectAttendanceDto,
  QueryAttendanceDto,
  QueryAttendanceSummaryDto,
} from './dto/attendance.dto';

// Both PRESENT and LATE count as "attended" for percentage purposes; EXCUSED
// absences are removed from both numerator and denominator (they shouldn't
// count against a student's attendance rate); only ABSENT counts against it.
function isAttended(status: AttendanceStatus) {
  return status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE;
}
function countsTowardDenominator(status: AttendanceStatus) {
  return status !== AttendanceStatus.EXCUSED;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Mark (bulk upsert) attendance for a batch+date ─────────────────────────

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

    const studentIds = dto.entries.map((e) => e.studentProfileId);
    const students = await this.prisma.studentProfile.findMany({
      where: { id: { in: studentIds }, batchId: dto.batchId },
      select: { id: true },
    });
    const validIds = new Set(students.map((s) => s.id));
    const invalid = studentIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(`These students are not enrolled in this batch: ${invalid.join(', ')}`);
    }

    const date = new Date(dto.date);

    const results = await this.prisma.$transaction(
      dto.entries.map((entry) =>
        this.prisma.attendanceRecord.upsert({
          where: {
            studentProfileId_batchId_date: {
              studentProfileId: entry.studentProfileId,
              batchId: dto.batchId,
              date,
            },
          },
          create: {
            studentProfileId: entry.studentProfileId,
            batchId: dto.batchId,
            date,
            status: entry.status,
            markedByUserId: actor.id,
          },
          update: {
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

  // ── Correct a single record after the fact — requires a reason ────────────

  async correctAttendance(instituteId: string, recordId: string, dto: CorrectAttendanceDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const record = await this.getRecordWithTenantCheck(recordId, instituteId);
    await this.assertTeacherOwnsBatchIfTeacher(actor, record.batchId);

    const oldStatus = record.status;

    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status: dto.status,
        correctedAt: new Date(),
        correctionReason: dto.reason,
      },
    });

    await this.writeAudit(
      instituteId, actor.id, AuditAction.UPDATE, 'attendance_records', recordId,
      { status: oldStatus }, { status: dto.status, reason: dto.reason },
    );

    return updated;
  }

  // ── List with filters ───────────────────────────────────────────────────

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

  // ── Real per-batch / per-student summary — computed, never invented ───────

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
        status: true, batchId: true, studentProfileId: true,
        batch: { select: { name: true } },
        studentProfile: { select: { rollNumber: true, user: { select: { name: true } } } },
      },
    });

    const byBatchMap = new Map<string, { batchName: string; attended: number; total: number }>();
    const byStudentMap = new Map<string, { name: string; rollNumber: string | null; attended: number; total: number }>();

    for (const r of records) {
      if (!countsTowardDenominator(r.status)) continue;

      const b = byBatchMap.get(r.batchId) ?? { batchName: r.batch.name, attended: 0, total: 0 };
      b.total += 1;
      if (isAttended(r.status)) b.attended += 1;
      byBatchMap.set(r.batchId, b);

      // Per-student breakdown only computed (and returned) when scoped to one batch —
      // avoids an institute-wide per-student aggregate nobody asked for.
      if (query.batchId) {
        const s = byStudentMap.get(r.studentProfileId) ?? {
          name: r.studentProfile.user.name, rollNumber: r.studentProfile.rollNumber, attended: 0, total: 0,
        };
        s.total += 1;
        if (isAttended(r.status)) s.attended += 1;
        byStudentMap.set(r.studentProfileId, s);
      }
    }

    const byBatch = Array.from(byBatchMap.entries()).map(([batchId, v]) => ({
      batchId, batchName: v.batchName, totalMarked: v.total,
      attendancePct: v.total > 0 ? Math.round((v.attended / v.total) * 100) : 0,
    }));

    const bySt = query.batchId
      ? Array.from(byStudentMap.entries()).map(([studentProfileId, v]) => ({
          studentProfileId, name: v.name, rollNumber: v.rollNumber, totalMarked: v.total,
          attendancePct: v.total > 0 ? Math.round((v.attended / v.total) * 100) : 0,
        })).sort((a, b) => a.attendancePct - b.attendancePct)
      : [];

    const overallAttended = Array.from(byBatchMap.values()).reduce((sum, v) => sum + v.attended, 0);
    const overallTotal = Array.from(byBatchMap.values()).reduce((sum, v) => sum + v.total, 0);

    const statusBreakdown = {
      PRESENT: records.filter((r) => r.status === AttendanceStatus.PRESENT).length,
      ABSENT: records.filter((r) => r.status === AttendanceStatus.ABSENT).length,
      LATE: records.filter((r) => r.status === AttendanceStatus.LATE).length,
      EXCUSED: records.filter((r) => r.status === AttendanceStatus.EXCUSED).length,
    };

    return {
      overallAttendancePct: overallTotal > 0 ? Math.round((overallAttended / overallTotal) * 100) : 0,
      statusBreakdown,
      byBatch,
      byStudent: bySt,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private async assertTeacherOwnsBatchIfTeacher(actor: AuthenticatedUser, batchId: string) {
    if (actor.role !== UserRole.TEACHER) return;
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    if (!teacherBatchIds?.includes(batchId)) {
      throw new ForbiddenException('You can only mark attendance for batches you are assigned to.');
    }
  }

  private async getRecordWithTenantCheck(recordId: string, instituteId: string) {
    const record = await this.prisma.attendanceRecord.findUnique({
      where: { id: recordId },
      include: { batch: { select: { id: true, instituteId: true } } },
    });
    if (!record) throw new NotFoundException('Attendance record not found.');
    if (record.batch.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
    return record;
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
          oldValue: oldValue ? (oldValue as object) : undefined,
          newValue: newValue ? (newValue as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}
