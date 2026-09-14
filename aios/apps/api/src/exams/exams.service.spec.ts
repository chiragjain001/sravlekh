import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ExamStatus, UserRole, Prisma } from '@prisma/client';
import { ExamsService } from './exams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthenticatedUser } from '../auth/auth.types';

const ALL_STATUSES = Object.values(ExamStatus);
const VALID_FORWARD: Record<ExamStatus, ExamStatus | null> = {
  DRAFT: ExamStatus.REVIEW,
  REVIEW: ExamStatus.APPROVED,
  APPROVED: ExamStatus.PUBLISHED,
  PUBLISHED: ExamStatus.ONGOING,
  ONGOING: ExamStatus.EVALUATING,
  EVALUATING: ExamStatus.LOCKED,
  LOCKED: null,
};

describe('ExamsService — state machine', () => {
  let service: ExamsService;
  let prisma: {
    exam: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; delete: jest.Mock; create: jest.Mock };
    teacherProfile: { findUnique: jest.Mock };
    batchTeacher: { findMany: jest.Mock };
    scoreRecord: { findMany: jest.Mock };
    answerSheet: { findMany: jest.Mock; count: jest.Mock };
    auditLog: { create: jest.Mock };
    paper: { updateMany: jest.Mock };
    blueprint: { findUnique: jest.Mock };
    batch: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      exam: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), delete: jest.fn(), create: jest.fn() },
      teacherProfile: { findUnique: jest.fn() },
      batchTeacher: { findMany: jest.fn() },
      scoreRecord: { findMany: jest.fn() },
      // P1 A4: the LOCKED transition now runs assertAllAnswerSheetsVerified.
      // count defaults to 0 (nothing unverified) so every pre-existing test in
      // this file — which predates the gate and asserts pure state-machine
      // behavior — keeps passing unchanged; the gate's own behavior is covered
      // separately below, in 'governance gate (P1 A4)'.
      answerSheet: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn() },
      paper: { updateMany: jest.fn() },
      blueprint: { findUnique: jest.fn() },
      batch: { findUnique: jest.fn() },
      // LOCK/UNLOCK go through prisma.$transaction([...]) so the audit entry is
      // atomic with the mutation — mirror Prisma's array-form behavior in the mock.
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnalyticsService, useValue: {} },
      ],
    }).compile();
    service = module.get(ExamsService);
  });

  function mockExam(status: ExamStatus, version = 0) {
    prisma.exam.findUnique.mockResolvedValueOnce({
      id: 'exam-1', instituteId: 'inst-1', status, version,
    });
  }

  describe('all 7x7 transition pairs (03-FEATURE-SPECIFICATIONS.md / 18-EDGE-CASES.md)', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const isValid = VALID_FORWARD[from] === to;

        it(`${from} -> ${to} is ${isValid ? 'ALLOWED' : 'REJECTED'}`, async () => {
          mockExam(from, 0);
          prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: to });

          // APPROVED requires admin — use admin throughout this matrix so the
          // 7x7 grid tests pure state-transition legality, not role gating
          // (role gating is covered separately below).
          const promise = service.updateStatus('inst-1', 'exam-1', { status: to, version: 0 }, admin);

          if (isValid) {
            await expect(promise).resolves.toBeDefined();
          } else {
            await expect(promise).rejects.toThrow(ConflictException);
          }
        });
      }
    }
  });

  describe('role gating', () => {
    it('rejects a teacher approving an exam (REVIEW -> APPROVED)', async () => {
      mockExam(ExamStatus.REVIEW, 0);
      await expect(
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.APPROVED, version: 0 }, teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to approve an exam', async () => {
      mockExam(ExamStatus.REVIEW, 0);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.APPROVED });
      await expect(
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.APPROVED, version: 0 }, admin),
      ).resolves.toBeDefined();
    });

    it('allows a teacher to move a non-approval transition (DRAFT -> REVIEW)', async () => {
      mockExam(ExamStatus.DRAFT, 0);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.REVIEW });
      await expect(
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.REVIEW, version: 0 }, teacher),
      ).resolves.toBeDefined();
    });
  });

  describe('optimistic locking', () => {
    it('rejects a stale version with 409, not a silent overwrite', async () => {
      mockExam(ExamStatus.DRAFT, 5);
      await expect(
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.REVIEW, version: 2 }, admin),
      ).rejects.toThrow(ConflictException);
      expect(prisma.exam.update).not.toHaveBeenCalled();
    });

    it('increments version on every successful transition', async () => {
      mockExam(ExamStatus.DRAFT, 3);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.REVIEW, version: 4 });

      await service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.REVIEW, version: 3 }, admin);

      expect(prisma.exam.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: { increment: 1 } }) }),
      );
    });

    // Phase 15 hardening (20 §Phase-15's "race conditions (concurrent lock
    // attempts)" audit): the read-check-then-write pattern above only proves
    // *this* call's write is version-gated. These prove two concurrent calls
    // starting from the identical version can't both silently succeed — the
    // write itself is the compare-and-swap, not just the earlier read-check.
    it('turns a concurrent-write conflict (Prisma P2025) into STALE_VERSION, not a raw 500', async () => {
      mockExam(ExamStatus.LOCKED, 7);
      // Simulates a second concurrent unlock() having already won the CAS —
      // this caller's update() finds no row matching { id, version: 7 } left.
      prisma.exam.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('No record found for update.', { code: 'P2025', clientVersion: '5.17.0' }),
      );

      await expect(
        service.unlock('inst-1', 'exam-1', { reason: 'Score dispute raised by parent', version: 7 }, admin),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'STALE_VERSION' }) });
    });

    it('never lets two concurrent LOCK attempts both succeed from the same version', async () => {
      mockExam(ExamStatus.EVALUATING, 3);
      mockExam(ExamStatus.EVALUATING, 3);
      prisma.exam.update
        .mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.LOCKED, version: 4 })
        .mockRejectedValueOnce(
          new Prisma.PrismaClientKnownRequestError('No record found for update.', { code: 'P2025', clientVersion: '5.17.0' }),
        );

      const [first, second] = await Promise.allSettled([
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.LOCKED, version: 3 }, admin),
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.LOCKED, version: 3 }, admin),
      ]);

      const outcomes = [first, second];
      expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
      const rejected = outcomes.find((o) => o.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ response: { code: 'STALE_VERSION' } });
    });
  });

  // P1 A4: v2's AssessmentsService has always gated LOCKED on unevaluated
  // subjective responses; v1 never gated LOCKED on grading state at all.
  //
  // v1 has no Evaluation/EvaluationVersion model involvement — gradeAnswerSheet
  // grades a whole AnswerSheet atomically and unconditionally sets isVerified.
  // A real-database probe run while building this confirmed reusing v2's
  // Response/Evaluation-based check here was wrong: `evaluation: null` is the
  // *permanent* state of every v1 Response, graded or not, so that check would
  // have blocked LOCK on every v1 exam forever. AnswerSheet.isVerified is the
  // real v1 signal — see shared/evaluation-lock-gate.ts.
  describe('governance gate (P1 A4)', () => {
    it('blocks LOCK when an answer sheet under this exam is still unverified', async () => {
      mockExam(ExamStatus.EVALUATING, 3);
      prisma.answerSheet.count.mockResolvedValueOnce(1);

      await expect(
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.LOCKED, version: 3 }, admin),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED' }) });
      expect(prisma.exam.update).not.toHaveBeenCalled();
    });

    it('scopes the count to this exam and to unverified sheets only', async () => {
      mockExam(ExamStatus.EVALUATING, 3);
      prisma.answerSheet.count.mockResolvedValueOnce(0);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.LOCKED, version: 4 });

      await service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.LOCKED, version: 3 }, admin);

      expect(prisma.answerSheet.count).toHaveBeenCalledWith({ where: { examId: 'exam-1', isVerified: false } });
    });

    it('allows LOCK once every answer sheet has been graded and verified', async () => {
      mockExam(ExamStatus.EVALUATING, 3);
      prisma.answerSheet.count.mockResolvedValueOnce(0);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.LOCKED, version: 4 });

      await expect(
        service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.LOCKED, version: 3 }, admin),
      ).resolves.toBeDefined();
    });

    it('does not gate any other transition — only LOCKED runs the count', async () => {
      mockExam(ExamStatus.DRAFT, 0);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.REVIEW });

      await service.updateStatus('inst-1', 'exam-1', { status: ExamStatus.REVIEW, version: 0 }, admin);

      expect(prisma.answerSheet.count).not.toHaveBeenCalled();
    });
  });

  describe('unlock (the one backward transition)', () => {
    it('rejects a non-admin outright', async () => {
      await expect(
        service.unlock('inst-1', 'exam-1', { reason: 'Score dispute raised by parent', version: 0 }, teacher),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.exam.findUnique).not.toHaveBeenCalled();
    });

    it('rejects unlocking an exam that is not LOCKED', async () => {
      mockExam(ExamStatus.EVALUATING, 0);
      await expect(
        service.unlock('inst-1', 'exam-1', { reason: 'Score dispute raised by parent', version: 0 }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('moves LOCKED -> EVALUATING, records the reason, and audits it', async () => {
      mockExam(ExamStatus.LOCKED, 7);
      prisma.exam.update.mockResolvedValueOnce({ id: 'exam-1', status: ExamStatus.EVALUATING });

      await service.unlock('inst-1', 'exam-1', { reason: 'Score dispute raised by parent', version: 7 }, admin);

      expect(prisma.exam.update).toHaveBeenCalledWith({
        where: { id: 'exam-1', version: 7 },
        data: { status: ExamStatus.EVALUATING, unlockReason: 'Score dispute raised by parent', version: { increment: 1 } },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('rejects a stale version', async () => {
      mockExam(ExamStatus.LOCKED, 7);
      await expect(
        service.unlock('inst-1', 'exam-1', { reason: 'Score dispute raised by parent', version: 3 }, admin),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('teacher batch scoping', () => {
    it('findAll restricts a TEACHER to exams for their assigned batches only', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);
      prisma.exam.findMany.mockResolvedValueOnce([]);

      await service.findAll('inst-1', teacher);

      expect(prisma.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { instituteId: 'inst-1', batchId: { in: ['batch-1'] } } }),
      );
    });

    it('findAll keeps institute-wide visibility for ADMIN', async () => {
      prisma.exam.findMany.mockResolvedValueOnce([]);
      await service.findAll('inst-1', admin);
      const call = prisma.exam.findMany.mock.calls[0]![0];
      expect(call.where).toEqual({ instituteId: 'inst-1' });
    });

    it('findById rejects a teacher fetching an exam outside their assigned batches', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce({ id: 'exam-1', instituteId: 'inst-1', batchId: 'batch-OTHER' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      await expect(service.findById('inst-1', 'exam-1', teacher)).rejects.toThrow(ForbiddenException);
    });

    it('findById allows a teacher fetching an exam for their own batch', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce({ id: 'exam-1', instituteId: 'inst-1', batchId: 'batch-1' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      await expect(service.findById('inst-1', 'exam-1', teacher)).resolves.toBeDefined();
    });
  });

  describe('getResults', () => {
    it('rejects a teacher outside the exam batch', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce({ id: 'exam-1', instituteId: 'inst-1', batchId: 'batch-OTHER' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1' });
      prisma.batchTeacher.findMany.mockResolvedValueOnce([{ batchId: 'batch-1' }]);

      await expect(service.getResults('inst-1', 'exam-1', teacher)).rejects.toThrow(ForbiddenException);
    });

    it('aggregates per-student scores and per-question correctness rates', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce({ id: 'exam-1', instituteId: 'inst-1', batchId: 'batch-1' });
      prisma.scoreRecord.findMany.mockResolvedValueOnce([
        { studentProfileId: 's1', obtainedMarks: 8, totalMarks: 10, percentage: 80, isFinalized: true, studentProfile: { user: { name: 'Aarav' } } },
        { studentProfileId: 's2', obtainedMarks: 4, totalMarks: 10, percentage: 40, isFinalized: true, studentProfile: { user: { name: 'Diya' } } },
      ]);
      prisma.answerSheet.findMany.mockResolvedValueOnce([
        {
          responses: [
            { questionId: 'q1', isCorrect: true, question: { id: 'q1', difficulty: 'EASY', content: 'Q1', topic: { name: 'Kinematics' } } },
            { questionId: 'q1', isCorrect: false, question: { id: 'q1', difficulty: 'EASY', content: 'Q1', topic: { name: 'Kinematics' } } },
          ],
        },
      ]);

      const result = await service.getResults('inst-1', 'exam-1', admin);

      expect(result.summary).toEqual({ participated: 1, graded: 2, avgScore: 60, topScore: 80 });
      expect(result.students).toHaveLength(2);
      expect(result.questionAnalysis).toEqual([
        expect.objectContaining({ questionId: 'q1', topic: 'Kinematics', correct: 1, total: 2, correctPct: 50 }),
      ]);
    });
  });

  describe('gradeAnswerSheet — immutability once LOCKED', () => {
    it('rejects grading a LOCKED exam (04-DATABASE-SCHEMA.md: Response is immutable once LOCKED)', async () => {
      const prismaWithAnswerSheet = {
        ...prisma,
        answerSheet: {
          findUnique: jest.fn().mockResolvedValueOnce({
            id: 'as-1',
            examId: 'exam-1',
            studentProfileId: 'student-1',
            exam: { instituteId: 'inst-1', status: ExamStatus.LOCKED },
          }),
        },
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ExamsService,
          { provide: PrismaService, useValue: prismaWithAnswerSheet },
          { provide: AnalyticsService, useValue: {} },
        ],
      }).compile();
      const lockedService = module.get(ExamsService);

      await expect(
        lockedService.gradeAnswerSheet('inst-1', 'as-1', { responses: [] }, admin),
      ).rejects.toThrow(ConflictException);
    });
  });
  describe('deleteExam — only before the batch has been told it is happening', () => {
    const draft = { id: 'e-1', instituteId: 'inst-1', title: 'Weekly', status: ExamStatus.DRAFT };

    it('deletes a DRAFT exam and detaches its papers rather than destroying them', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce(draft);
      prisma.answerSheet.count.mockResolvedValueOnce(0);

      await expect(service.deleteExam('inst-1', 'e-1', admin)).resolves.toEqual({ success: true });
      expect(prisma.paper.updateMany).toHaveBeenCalledWith({ where: { examId: 'e-1' }, data: { examId: null } });
      expect(prisma.exam.delete).toHaveBeenCalledWith({ where: { id: 'e-1' } });
    });

    it('refuses once the exam is PUBLISHED', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce({ ...draft, status: ExamStatus.PUBLISHED });
      await expect(service.deleteExam('inst-1', 'e-1', admin)).rejects.toThrow(BadRequestException);
      expect(prisma.exam.delete).not.toHaveBeenCalled();
    });

    it('refuses when answer sheets already exist', async () => {
      prisma.exam.findUnique.mockResolvedValueOnce(draft);
      prisma.answerSheet.count.mockResolvedValueOnce(3);
      await expect(service.deleteExam('inst-1', 'e-1', admin)).rejects.toThrow(BadRequestException);
      expect(prisma.exam.delete).not.toHaveBeenCalled();
    });

    it("404s for another institute's exam", async () => {
      prisma.exam.findUnique.mockResolvedValueOnce({ ...draft, instituteId: 'inst-OTHER' });
      await expect(service.deleteExam('inst-1', 'e-1', admin)).rejects.toThrow(NotFoundException);
    });
  });

  // ── createExam — scheduledDate must be today or later ───────────────────
  //
  // Found by manually testing Paper Builder end to end: the wizard shipped
  // with a stale hardcoded default date (2024-05-28) and nothing on either
  // side rejected it, so a teacher could publish an exam already scheduled in
  // the past without any warning. createExam is the one place scheduledDate
  // is ever written, so the guard lives here.

  describe('createExam — scheduledDate validation', () => {
    const validDto = { title: 'Weekly Test', batchId: 'batch-1', blueprintId: 'bp-1', type: 'WEEKLY_TEST' as any, captureMode: 'MANUAL_GRID' as any };

    beforeEach(() => {
      prisma.blueprint.findUnique.mockResolvedValue({ id: 'bp-1', instituteId: 'inst-1', duration: 60 });
      prisma.batch.findUnique.mockResolvedValue({ id: 'batch-1', instituteId: 'inst-1' });
      prisma.exam.create.mockResolvedValue({ id: 'exam-1', title: 'Weekly Test' });
    });

    it('rejects a date that has already passed', async () => {
      await expect(
        service.createExam('inst-1', { ...validDto, scheduledDate: '2024-05-28T09:00:00.000Z' }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.exam.create).not.toHaveBeenCalled();
    });

    it('accepts today\'s date — "publish immediately" must not be rejected as "in the past"', async () => {
      const todayAtNoon = new Date();
      todayAtNoon.setHours(12, 0, 0, 0);
      await expect(
        service.createExam('inst-1', { ...validDto, scheduledDate: todayAtNoon.toISOString() }, admin),
      ).resolves.toBeDefined();
      expect(prisma.exam.create).toHaveBeenCalled();
    });

    it('accepts a future date', async () => {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      await expect(
        service.createExam('inst-1', { ...validDto, scheduledDate: nextYear.toISOString() }, admin),
      ).resolves.toBeDefined();
    });

    it('is not evaluated at all when no scheduledDate is given — a draft with no date yet stays valid', async () => {
      await expect(service.createExam('inst-1', validDto, admin)).resolves.toBeDefined();
      expect(prisma.exam.create).toHaveBeenCalled();
    });
  });
});
