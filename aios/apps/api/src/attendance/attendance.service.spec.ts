import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { AttendanceStatus, TimetableExceptionType, UserRole, AuditAction } from '@prisma/client';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { PermissionsService } from '../permissions/permissions.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AttendanceService — V4 Production Architecture & Invariants', () => {
  let service: AttendanceService;
  let prisma: any;
  let permissionsService: { hasPermission: jest.Mock };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@aios.test',
    name: 'Admin User',
    role: UserRole.ADMIN,
    instituteId: 'inst-1',
  };

  const teacher1: AuthenticatedUser = {
    id: 'teacher-1',
    email: 't1@aios.test',
    name: 'Teacher One',
    role: UserRole.TEACHER,
    instituteId: 'inst-1',
  };

  const substituteTeacher: AuthenticatedUser = {
    id: 'teacher-sub',
    email: 'sub@aios.test',
    name: 'Substitute Teacher',
    role: UserRole.TEACHER,
    instituteId: 'inst-1',
  };

  const studentUser: AuthenticatedUser = {
    id: 'student-user-1',
    email: 's1@aios.test',
    name: 'Student One',
    role: UserRole.STUDENT,
    instituteId: 'inst-1',
  };

  beforeEach(async () => {
    prisma = {
      institute: {
        findUnique: jest.fn().mockResolvedValue({ id: 'inst-1', featureFlags: {} }),
        update: jest.fn().mockResolvedValue({ id: 'inst-1' }),
      },
      batch: { findUnique: jest.fn() },
      subject: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      user: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      studentProfile: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn().mockResolvedValue([]) },
      timetableSlot: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      timetableException: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn() },
      exam: { findMany: jest.fn().mockResolvedValue([]) },
      attendanceSession: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceSessionRoster: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
      },
      attendanceRecord: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      attendanceCorrectionLog: {
        create: jest.fn(),
      },
      notice: { create: jest.fn().mockResolvedValue({ id: 'notice-1' }) },
      noticeDelivery: { create: jest.fn().mockResolvedValue({ id: 'nd-1' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
      $transaction: jest.fn(async (cb: any) => {
        if (typeof cb === 'function') {
          return cb(prisma);
        }
        return Array.isArray(cb) ? Promise.all(cb) : cb;
      }),
    };

    permissionsService = {
      hasPermission: jest.fn().mockResolvedValue(false),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionsService, useValue: permissionsService },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  describe('1. Timetable Authority & Substitute Rules', () => {
    const mockSession: any = {
      id: 'session-1',
      instituteId: 'inst-1',
      batchId: 'batch-1',
      subjectId: 'sub-1',
      snapshotTeacherUserId: 'teacher-1',
      snapshotTeacherName: 'Teacher One',
      snapshotBatchName: 'Class 10-A',
      snapshotSubjectName: 'Physics',
      snapshotPeriodNumber: 1,
      snapshotStartTime: new Date('2026-10-09T09:00:00Z'),
      snapshotEndTime: new Date('2026-10-09T10:00:00Z'),
      substituteUserId: null,
      examOverrideId: null,
      finalizedAt: null,
      cancelledAt: null,
      version: 1,
      rosterSnapshotAt: new Date(),
      roster: [{ id: 'r-1', studentProfileId: 's-1' }],
      records: [],
    };

    it('allows scheduled teacher to save attendance draft', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);
      prisma.attendanceSession.update.mockResolvedValueOnce({ ...mockSession, version: 2 });

      const res = await service.saveDraft('inst-1', 'session-1', {
        expectedVersion: 1,
        entries: [{ studentProfileId: 's-1', status: AttendanceStatus.PRESENT }],
      }, teacher1);

      expect(res.version).toBe(2);
      expect(prisma.attendanceRecord.upsert).toHaveBeenCalled();
    });

    it('blocks an unassigned teacher who is not the scheduled teacher', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);

      const unassignedTeacher: AuthenticatedUser = {
        ...teacher1,
        id: 'teacher-unassigned',
      };

      await expect(
        service.saveDraft('inst-1', 'session-1', {
          expectedVersion: 1,
          entries: [{ studentProfileId: 's-1', status: AttendanceStatus.PRESENT }],
        }, unassignedTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks the scheduled teacher when a substitute is assigned (substitute exclusivity)', async () => {
      const sessionWithSub = {
        ...mockSession,
        substituteUserId: 'teacher-sub',
      };
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(sessionWithSub);

      await expect(
        service.saveDraft('inst-1', 'session-1', {
          expectedVersion: 1,
          entries: [{ studentProfileId: 's-1', status: AttendanceStatus.PRESENT }],
        }, teacher1),
      ).rejects.toThrow('Attendance handled by assigned substitute.');
    });

    it('allows the assigned substitute teacher to operate the session', async () => {
      const sessionWithSub = {
        ...mockSession,
        substituteUserId: 'teacher-sub',
      };
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(sessionWithSub);
      prisma.attendanceSession.update.mockResolvedValueOnce({ ...sessionWithSub, version: 2 });

      const res = await service.saveDraft('inst-1', 'session-1', {
        expectedVersion: 1,
        entries: [{ studentProfileId: 's-1', status: AttendanceStatus.PRESENT }],
      }, substituteTeacher);

      expect(res.version).toBe(2);
    });
  });

  describe('2. Optimistic Concurrency Control (OCC)', () => {
    const mockSession: any = {
      id: 'session-1',
      instituteId: 'inst-1',
      batchId: 'batch-1',
      snapshotTeacherUserId: 'teacher-1',
      version: 5,
      finalizedAt: null,
      cancelledAt: null,
      rosterSnapshotAt: new Date(),
      roster: [{ id: 'r-1', studentProfileId: 's-1' }],
    };

    it('returns 409 Conflict when expectedVersion does not match session version', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);

      await expect(
        service.saveDraft('inst-1', 'session-1', {
          expectedVersion: 4, // Stale version!
          entries: [{ studentProfileId: 's-1', status: AttendanceStatus.PRESENT }],
        }, teacher1),
      ).rejects.toThrow(ConflictException);
    });

    it('returns 409 Conflict when finalizing with stale version', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);

      await expect(
        service.finalizeSession('inst-1', 'session-1', {
          expectedVersion: 3,
        }, teacher1),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('3. Finalization Roster Completeness', () => {
    const mockSession: any = {
      id: 'session-1',
      instituteId: 'inst-1',
      batchId: 'batch-1',
      snapshotTeacherUserId: 'teacher-1',
      version: 1,
      finalizedAt: null,
      cancelledAt: null,
      rosterSnapshotAt: new Date(),
      roster: [
        { id: 'r-1', studentProfileId: 's-1' },
        { id: 'r-2', studentProfileId: 's-2' },
      ],
    };

    it('blocks finalization when some students in roster are unmarked', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { studentProfileId: 's-1', status: AttendanceStatus.PRESENT },
      ]); // s-2 is missing!

      await expect(
        service.finalizeSession('inst-1', 'session-1', { expectedVersion: 1 }, teacher1),
      ).rejects.toThrow(BadRequestException);
    });

    it('finalizes successfully when 100% of students are marked', async () => {
      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);
      prisma.attendanceRecord.findMany.mockResolvedValueOnce([
        { studentProfileId: 's-1', status: AttendanceStatus.PRESENT },
        { studentProfileId: 's-2', status: AttendanceStatus.ABSENT },
      ]);
      prisma.attendanceSession.update.mockResolvedValueOnce({
        ...mockSession,
        finalizedAt: new Date(),
        version: 2,
      });

      const res = await service.finalizeSession('inst-1', 'session-1', { expectedVersion: 1 }, teacher1);
      expect(res.session.finalizedAt).toBeDefined();
    });
  });

  describe('4. Post-Finalization Audited Corrections', () => {
    it('requires capability and creates insert-only correction log', async () => {
      const mockSession = {
        id: 'session-1',
        instituteId: 'inst-1',
        date: '2026-10-09',
        version: 2,
      };
      const mockRecord = {
        id: 'rec-1',
        sessionId: 'session-1',
        studentProfileId: 's-1',
        status: AttendanceStatus.ABSENT,
        version: 1,
      };

      prisma.attendanceSession.findUnique.mockResolvedValueOnce(mockSession);
      prisma.attendanceRecord.findUnique.mockResolvedValueOnce(mockRecord);
      prisma.attendanceCorrectionLog.create.mockResolvedValueOnce({ id: 'log-1' });
      prisma.attendanceRecord.update.mockResolvedValueOnce({
        ...mockRecord,
        status: AttendanceStatus.PRESENT,
        version: 2,
      });

      const updated = await service.correctAttendanceRecord(
        'inst-1',
        'session-1',
        'rec-1',
        {
          expectedVersion: 1,
          status: AttendanceStatus.PRESENT,
          reason: 'Student arrived right after roll call with medical note',
        },
        admin,
      );

      expect(prisma.attendanceCorrectionLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousStatus: AttendanceStatus.ABSENT,
            newStatus: AttendanceStatus.PRESENT,
            reason: 'Student arrived right after roll call with medical note',
          }),
        }),
      );
      expect(updated.status).toBe(AttendanceStatus.PRESENT);
    });
  });

  describe('5. Student Visibility Isolation', () => {
    it('only returns finalized attendance records for authenticated student', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: 'sp-1',
        userId: 'student-user-1',
        instituteId: 'inst-1',
      });

      prisma.attendanceRecord.findMany
        .mockResolvedValueOnce([
          { id: 'rec-1', status: AttendanceStatus.PRESENT, subjectId: 'sub-1', date: new Date('2026-10-09') },
        ])
        .mockResolvedValueOnce([
          {
            id: 'rec-1',
            status: AttendanceStatus.PRESENT,
            date: new Date('2026-10-09'),
            session: { snapshotSubjectName: 'Physics' },
            batch: { id: 'batch-1', name: 'Class 10-A' },
          },
        ]);
      prisma.attendanceRecord.count.mockResolvedValueOnce(1);

      const res = await service.getStudentAttendance('inst-1', studentUser, {});

      expect(res.overall.percentage).toBe(100);
      expect(res.history).toHaveLength(1);
    });
  });

  describe('6. Admin Attendance Policy Settings', () => {
    it('returns default attendance policy when none is configured', async () => {
      const policy = await service.getAttendancePolicy('inst-1', admin);
      expect(policy.cutoffHour).toBe(18);
      expect(policy.openBeforeMinutes).toBe(15);
      expect(policy.gracePeriodMinutes).toBe(30);
      expect(policy.timezone).toBe('Asia/Kolkata');
      expect(policy.allowTeacherHistoricalEdit).toBe(false);
      expect(policy.allowFinalizedCorrection).toBe(true);
    });

    it('updates attendance policy and writes audit log when admin submits', async () => {
      const res = await service.updateAttendancePolicy(
        'inst-1',
        {
          cutoffHour: 19,
          openBeforeMinutes: 20,
          gracePeriodMinutes: 45,
          timezone: 'Asia/Dubai',
          allowTeacherHistoricalEdit: true,
          allowFinalizedCorrection: true,
        },
        admin,
      );

      expect(res.success).toBe(true);
      expect(res.policy.cutoffHour).toBe(19);
      expect(res.policy.timezone).toBe('Asia/Dubai');
      expect(prisma.institute.update).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: AuditAction.UPDATE,
            entity: 'AttendancePolicy',
          }),
        }),
      );
    });

    it('blocks teacher from updating attendance policy', async () => {
      await expect(
        service.updateAttendancePolicy('inst-1', { cutoffHour: 20 }, teacher1),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invalid IANA timezone', async () => {
      await expect(
        service.updateAttendancePolicy('inst-1', { timezone: 'Invalid/City_Name' }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('7. Dynamic Institute Timezone Handling', () => {
    it('resolves timezone configured on institute and falls back gracefully', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1',
        featureFlags: { attendance: { timezone: 'Asia/Dubai' } },
      });
      const tz = await service.getInstituteTimezone('inst-1');
      expect(tz).toBe('Asia/Dubai');

      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1',
        featureFlags: { attendance: { timezone: 'Gibberish_Not_Real' } },
      });
      const fallbackTz = await service.getInstituteTimezone('inst-1');
      expect(fallbackTz).toBe('Asia/Kolkata');
    });
  });

  describe('8. Automated Missing Attendance Detection & Deduplication', () => {
    it('deduplicates alerts and dispatches notices to both teacher and admin', async () => {
      prisma.user.findMany.mockResolvedValueOnce([
        { id: 'admin-1', role: UserRole.ADMIN },
      ]);

      const mockSession = {
        id: 'sess-missed-1',
        instituteId: 'inst-1',
        snapshotTeacherUserId: 'teacher-1',
        substituteUserId: null,
        snapshotBatchName: 'Class 10-A',
        snapshotSubjectName: 'Chemistry',
        derivedState: 'MISSED',
        missingAlertSentAt: null,
      };

      jest.spyOn(service, 'getTodaySessions').mockResolvedValueOnce({
        date: '2026-10-09',
        timezone: 'Asia/Kolkata',
        sessions: [mockSession as any],
        meta: { total: 1, openCount: 0, finalizedCount: 0, awaitingCount: 0, missedCount: 1, cancelledCount: 0 },
      });

      const res = await service.detectAndAlertMissingSessions('inst-1');
      expect(res.detectedCount).toBe(1);
      expect(res.newlyNotifiedCount).toBe(1);
      expect(prisma.attendanceSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-missed-1' },
          data: expect.objectContaining({
            missingAlertSentAt: expect.any(Date),
          }),
        }),
      );
      expect(prisma.notice.create).toHaveBeenCalled();
      expect(prisma.noticeDelivery.create).toHaveBeenCalled();
    });

    it('skips sessions that have already received a missing alert (deduplication)', async () => {
      const mockSession = {
        id: 'sess-already-alerted',
        instituteId: 'inst-1',
        snapshotTeacherUserId: 'teacher-1',
        derivedState: 'MISSED',
        missingAlertSentAt: new Date(),
      };

      jest.spyOn(service, 'getTodaySessions').mockResolvedValueOnce({
        date: '2026-10-09',
        timezone: 'Asia/Kolkata',
        sessions: [mockSession as any],
        meta: { total: 1, openCount: 0, finalizedCount: 0, awaitingCount: 0, missedCount: 1, cancelledCount: 0 },
      });

      const res = await service.detectAndAlertMissingSessions('inst-1');
      expect(res.detectedCount).toBe(1);
      expect(res.newlyNotifiedCount).toBe(0);
      expect(prisma.attendanceSession.update).not.toHaveBeenCalled();
    });
  });
});

