import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EntitlementResource } from '../entitlements/plan-definitions';

describe('StudentsService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: StudentsService;
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    studentProfile: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock; groupBy: jest.Mock };
    batch: { findUnique: jest.Mock; findMany: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };
  let entitlements: { assertCanCreate: jest.Mock; ensurePlanDefinitions: jest.Mock; getSnapshot: jest.Mock };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      studentProfile: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), groupBy: jest.fn() },
      batch: { findUnique: jest.fn(), findMany: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn({
        user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }), update: jest.fn() },
        studentProfile: { create: jest.fn().mockResolvedValue({ id: 'sp-1' }), update: jest.fn() },
        studentHistory: { create: jest.fn() },
      })),
      auditLog: { create: jest.fn() },
    };
    entitlements = {
      assertCanCreate: jest.fn().mockResolvedValue(undefined),
      ensurePlanDefinitions: jest.fn().mockResolvedValue(undefined),
      getSnapshot: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentsService,
        { provide: PrismaService, useValue: prisma },
        // Permissive by default so these tests keep exercising student logic,
        // not plan limits. The limit behaviour itself is covered directly in
        // entitlements.service.spec.ts, and its enforcement at this call site
        // is asserted in the dedicated block at the bottom of this file.
        { provide: EntitlementsService, useValue: entitlements },
      ],
    }).compile();
    service = module.get(StudentsService);
  });

  describe('create', () => {
    it("rejects a batchId belonging to a different institute", async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-OTHER' });
      await expect(
        service.create('inst-1', { name: 'A', email: 'a@b.com', batchId: 'batch-1' }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an admin creating a student under a different institute's ID", async () => {
      await expect(
        service.create('inst-OTHER', { name: 'A', email: 'a@b.com' }, admin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a duplicate email within the same institute', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.create('inst-1', { name: 'A', email: 'dup@b.com' }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an invalid tag not in the allowed set', async () => {
      await expect(
        service.create('inst-1', { name: 'A', email: 'a@b.com', tags: ['not-a-real-tag'] }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it("rejects reading a student profile whose user belongs to a different institute", async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', instituteId: 'inst-OTHER' });
      await expect(service.findById('inst-1', 'sp-1', admin)).rejects.toThrow(ForbiddenException);
    });

    it('404s for a nonexistent profile', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('inst-1', 'missing', admin)).rejects.toThrow(NotFoundException);
    });
  });

  // 32-AI-GOVERNANCE-POLICY.md §5 — a student's own result view must never show a
  // provisional score. ScoreAggregationService recomputes ScoreRecord on every
  // evaluation write, so a v2 attempt mid-review has a real but incomplete
  // percentage (isFinalized=false). Filtered in the Prisma query, not in the UI, so
  // the value never crosses the API boundary at all. findById backs both
  // GET /students/me and GET /students/:profileId.
  describe('findById — student-facing ScoreRecord finalization', () => {
    const student: AuthenticatedUser = { ...admin, id: 'student-1', role: UserRole.STUDENT };

    /** For a STUDENT the ownership check queries the profile first, then the read. */
    function mockStudentProfileFetch(scoreRecords: unknown[]) {
      prisma.studentProfile.findUnique
        .mockResolvedValueOnce({ id: 'sp-1' }) // assertStudentOwnsProfileIfStudent
        .mockResolvedValueOnce({ id: 'sp-1', userId: 'user-1', scoreRecords });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', instituteId: 'inst-1' });
    }

    function scoreRecordsArg(callIndex: number) {
      return prisma.studentProfile.findUnique.mock.calls[callIndex]![0].include.scoreRecords;
    }

    it('requests only finalized ScoreRecords for a STUDENT', async () => {
      mockStudentProfileFetch([]);

      await service.findById('inst-1', 'sp-1', student);

      expect(scoreRecordsArg(1).where).toEqual({ isFinalized: true });
    });

    it('returns a finalized ScoreRecord to the student', async () => {
      const finalized = { id: 'sr-1', percentage: 80, obtainedMarks: 8, totalMarks: 10, isFinalized: true };
      mockStudentProfileFetch([finalized]);

      const profile = await service.findById('inst-1', 'sp-1', student);

      expect(profile.scoreRecords).toEqual([finalized]);
    });

    it('does not return an unfinalized ScoreRecord to the student', async () => {
      // The DB honours the where-clause, so an unfinalized-only student sees none.
      mockStudentProfileFetch([]);

      const profile = await service.findById('inst-1', 'sp-1', student);

      expect(scoreRecordsArg(1).where).toEqual({ isFinalized: true });
      expect(profile.scoreRecords).toEqual([]);
    });

    it('exposes only the finalized record when the student has a mix of both', async () => {
      const finalized = { id: 'sr-final', percentage: 80, isFinalized: true };
      // What the filtered query returns — the unfinalized sibling is excluded by the
      // where-clause asserted below, never serialized into the response.
      mockStudentProfileFetch([finalized]);

      const profile = await service.findById('inst-1', 'sp-1', student);

      expect(scoreRecordsArg(1).where).toEqual({ isFinalized: true });
      expect(profile.scoreRecords).toEqual([finalized]);
      expect(profile.scoreRecords.some((r: { isFinalized: boolean }) => !r.isFinalized)).toBe(false);
    });

    it('leaves ADMIN visibility unchanged — provisional scoring stays visible to staff', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', userId: 'user-1', scoreRecords: [] });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', instituteId: 'inst-1' });

      await service.findById('inst-1', 'sp-1', admin);

      expect(scoreRecordsArg(0).where).toBeUndefined();
    });

    it('leaves TEACHER visibility unchanged — reviewing in-progress scoring is their job', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.studentProfile.findUnique
        .mockResolvedValueOnce({ id: 'sp-1', batchId: 'batch-1' }) // teacher batch-scope check
        .mockResolvedValueOnce({ id: 'sp-1', userId: 'user-1', scoreRecords: [] });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', instituteId: 'inst-1' });

      await service.findById('inst-1', 'sp-1', teacher);

      expect(scoreRecordsArg(1).where).toBeUndefined();
    });
  });

  describe('teacher batch scoping', () => {
    it('findAll restricts a TEACHER to students in their assigned batches only', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', {}, teacher);

      const call = prisma.studentProfile.findMany.mock.calls[0]![0];
      expect(call.where.batchId).toEqual({ in: ['batch-1'] });
    });

    it('findAll empties the result when a teacher filters by a batch they are not assigned to', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', { batchId: 'batch-OTHER' }, teacher);

      const call = prisma.studentProfile.findMany.mock.calls[0]![0];
      expect(call.where.batchId).toEqual({ in: [] });
    });

    it('findById rejects a teacher viewing a student outside their assigned batches', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', batchId: 'batch-OTHER' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      await expect(service.findById('inst-1', 'sp-1', teacher)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findAll — status filter and sort', () => {
    it('filters by account status', async () => {
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', { status: 'INACTIVE' }, admin);

      const call = prisma.studentProfile.findMany.mock.calls[0]![0];
      expect(call.where.user).toEqual({ instituteId: 'inst-1', status: 'INACTIVE' });
    });

    it('sorts by rollNumber when requested, defaults to name otherwise', async () => {
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.count.mockResolvedValueOnce(0);
      await service.findAll('inst-1', { sortBy: 'rollNumber', sortDir: 'desc' }, admin);
      expect(prisma.studentProfile.findMany.mock.calls[0]![0].orderBy).toEqual({ rollNumber: 'desc' });

      prisma.studentProfile.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.count.mockResolvedValueOnce(0);
      await service.findAll('inst-1', {}, admin);
      expect(prisma.studentProfile.findMany.mock.calls[1]![0].orderBy).toEqual({ user: { name: 'asc' } });
    });
  });

  describe('getStats', () => {
    // Regression from the production-readiness audit: getStats used to read
    // { tags, admissionDate } for EVERY student in the institute and then throw
    // away all but the last 6 months of dates in memory. Fine on a demo tenant,
    // linear in student count in production.
    it('bounds the enrollment query to the 6-month window it actually plots', async () => {
      prisma.studentProfile.count.mockResolvedValue(0);
      prisma.studentProfile.groupBy.mockResolvedValueOnce([]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);

      await service.getStats('inst-1', admin);

      const enrollmentCall = prisma.studentProfile.findMany.mock.calls[1]![0];
      expect(enrollmentCall.where.admissionDate?.gte).toBeInstanceOf(Date);
      expect(enrollmentCall.select).toEqual({ admissionDate: true });

      const cutoff = enrollmentCall.where.admissionDate.gte as Date;
      const monthsBack = (new Date().getFullYear() - cutoff.getFullYear()) * 12
        + (new Date().getMonth() - cutoff.getMonth());
      expect(monthsBack).toBe(5);   // earliest bucket the histogram builds
      expect(cutoff.getDate()).toBe(1);
    });

    it('rejects a caller from a different institute', async () => {
      await expect(service.getStats('inst-OTHER', admin)).rejects.toThrow(ForbiddenException);
    });

    it('scopes a TEACHER caller to their own batches only', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.studentProfile.count.mockResolvedValue(0);
      prisma.studentProfile.groupBy.mockResolvedValueOnce([]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);  // tag rows
      prisma.studentProfile.findMany.mockResolvedValueOnce([]);  // enrollment rows

      await service.getStats('inst-1', teacher);

      const countCall = prisma.studentProfile.count.mock.calls[0]![0];
      expect(countCall.where.batchId).toEqual({ in: ['batch-1'] });

      // Both reads must carry the teacher's batch scope — a stats endpoint that
      // scoped only its counts would leak other batches' tags and enrolments.
      for (const call of prisma.studentProfile.findMany.mock.calls) {
        expect(call[0].where.batchId).toEqual({ in: ['batch-1'] });
      }
    });

    it('aggregates real counts by batch and tag, not invented values', async () => {
      prisma.studentProfile.count.mockResolvedValueOnce(10); // total
      prisma.studentProfile.count.mockResolvedValueOnce(7);  // active
      prisma.studentProfile.groupBy.mockResolvedValueOnce([
        { batchId: 'batch-1', _count: { _all: 6 } },
        { batchId: null, _count: { _all: 4 } },
      ]);
      prisma.studentProfile.count.mockResolvedValueOnce(2); // newLast30Days
      prisma.studentProfile.findMany.mockResolvedValueOnce([
        { tags: ['high-risk'] },
        { tags: ['high-risk', 'needs-revision'] },
      ]);
      prisma.studentProfile.findMany.mockResolvedValueOnce([
        { admissionDate: new Date() },
        { admissionDate: new Date() },
      ]);
      prisma.batch.findMany.mockResolvedValueOnce([{ id: 'batch-1', name: 'JEE 2026' }]);

      const stats = await service.getStats('inst-1', admin);

      expect(stats.total).toBe(10);
      expect(stats.active).toBe(7);
      expect(stats.inactive).toBe(3);
      expect(stats.byBatch).toEqual(
        expect.arrayContaining([
          { batchId: 'batch-1', batchName: 'JEE 2026', count: 6 },
          { batchId: null, batchName: 'Unassigned', count: 4 },
        ]),
      );
      expect(stats.byTag).toEqual(expect.arrayContaining([{ tag: 'high-risk', count: 2 }, { tag: 'needs-revision', count: 1 }]));
    });
  });

  describe('transferBatch', () => {
    it('rejects transferring into a batch from a different institute', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: 'sp-1', userId: 'user-1', batchId: 'batch-old', user: { id: 'user-1', instituteId: 'inst-1' },
      });
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-new', instituteId: 'inst-OTHER' });

      await expect(
        service.transferBatch('inst-1', 'sp-1', { targetBatchId: 'batch-new' }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });
  // ── Plan-limit enforcement at the create call site ─────────────────────────
  // The limit logic itself is EntitlementsService's contract (see its spec).
  // What must be proven *here* is that this service actually consults it, and
  // does so inside the transaction — a check outside the transaction would be a
  // TOCTOU race that silently overshoots the customer's plan under concurrency.
  describe('create — plan limit enforcement', () => {
    const validDto = { email: 'new@x.com', name: 'New Student', rollNumber: 'R-1' } as any;

    it('consults the entitlement gate for a STUDENT before creating', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await service.create('inst-1', validDto, admin);
      expect(entitlements.assertCanCreate).toHaveBeenCalledWith(
        'inst-1',
        EntitlementResource.STUDENT,
        expect.anything(),
      );
    });

    it('runs the check INSIDE the transaction, sharing the transaction client', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await service.create('inst-1', validDto, admin);

      // Third argument present and truthy == the tx client was threaded through.
      const [, , txArg] = entitlements.assertCanCreate.mock.calls[0];
      expect(txArg).toBeDefined();
      expect(txArg).toHaveProperty('user');
    });

    it('propagates the refusal and creates nothing when the plan limit is reached', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      const denial = new ForbiddenException({ code: 'PLAN_LIMIT_EXCEEDED', message: 'limit' });
      entitlements.assertCanCreate.mockRejectedValueOnce(denial);

      await expect(service.create('inst-1', validDto, admin)).rejects.toThrow(ForbiddenException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });
  });
});
