import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ExamStatus, UserRole } from '@prisma/client';
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
    exam: { findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      exam: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
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
        where: { id: 'exam-1' },
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
});
