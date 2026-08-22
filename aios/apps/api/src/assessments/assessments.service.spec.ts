import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UserRole, ExamStatus, EvaluationPolicyMode, StakesLevel, AssessmentKind } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AssessmentsService', () => {
  let service: AssessmentsService;
  let prisma: {
    assessment: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock };
    paper: { findUnique: jest.Mock };
    batch: { findUnique: jest.Mock };
    captureProvider: { findUnique: jest.Mock };
    evaluationPolicy: { findUnique: jest.Mock };
    assessmentDelivery: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      assessment: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn() },
      paper: { findUnique: jest.fn() },
      batch: { findUnique: jest.fn() },
      captureProvider: { findUnique: jest.fn() },
      evaluationPolicy: { findUnique: jest.fn() },
      assessmentDelivery: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AssessmentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssessmentsService);
  });

  const baseAssessmentDto = {
    title: 'Unit Test 1',
    assessmentKind: AssessmentKind.COACHING_TEST,
    stakesLevel: StakesLevel.GRADED,
    subjectIds: ['sub-1'],
    totalMarks: 100,
  };

  describe('createAssessment', () => {
    it('creates without a paper', async () => {
      prisma.assessment.create.mockResolvedValueOnce({ id: 'a1' });
      await expect(service.createAssessment('inst-1', baseAssessmentDto, admin)).resolves.toBeDefined();
      expect(prisma.paper.findUnique).not.toHaveBeenCalled();
    });

    it('404s on a cross-tenant paperId', async () => {
      prisma.paper.findUnique.mockResolvedValueOnce({ id: 'p1', instituteId: 'inst-OTHER' });
      await expect(
        service.createAssessment('inst-1', { ...baseAssessmentDto, paperId: 'p1' }, admin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDelivery', () => {
    const deliveryDto = { batchId: 'b1', captureProviderId: 'cp1', evaluationPolicyId: 'ep1' };

    function mockHappyPath(overrides: { assessment?: any; evaluationPolicy?: any } = {}) {
      prisma.assessment.findUnique.mockResolvedValueOnce(
        overrides.assessment ?? { id: 'a1', instituteId: 'inst-1', stakesLevel: StakesLevel.PRACTICE },
      );
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'b1', instituteId: 'inst-1' });
      prisma.captureProvider.findUnique.mockResolvedValueOnce({ id: 'cp1', instituteId: 'inst-1' });
      prisma.evaluationPolicy.findUnique.mockResolvedValueOnce(
        overrides.evaluationPolicy ?? { id: 'ep1', instituteId: 'inst-1', mode: EvaluationPolicyMode.MANUAL_ONLY },
      );
    }

    it('404s when the assessment does not exist', async () => {
      prisma.assessment.findUnique.mockResolvedValueOnce(null);
      await expect(service.createDelivery('inst-1', 'a1', deliveryDto, admin)).rejects.toThrow(NotFoundException);
    });

    it('404s on a cross-tenant batch', async () => {
      prisma.assessment.findUnique.mockResolvedValueOnce({ id: 'a1', instituteId: 'inst-1' });
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'b1', instituteId: 'inst-OTHER' });
      await expect(service.createDelivery('inst-1', 'a1', deliveryDto, admin)).rejects.toThrow(NotFoundException);
    });

    it('rejects EvaluationPolicy.mode=AI_FINAL_LOW_STAKES paired with Assessment.stakesLevel=GRADED', async () => {
      mockHappyPath({
        assessment: { id: 'a1', instituteId: 'inst-1', stakesLevel: StakesLevel.GRADED },
        evaluationPolicy: { id: 'ep1', instituteId: 'inst-1', mode: EvaluationPolicyMode.AI_FINAL_LOW_STAKES },
      });
      await expect(service.createDelivery('inst-1', 'a1', deliveryDto, admin)).rejects.toThrow(UnprocessableEntityException);
      expect(prisma.assessmentDelivery.create).not.toHaveBeenCalled();
    });

    it('allows AI_FINAL_LOW_STAKES paired with a PRACTICE assessment', async () => {
      mockHappyPath({
        assessment: { id: 'a1', instituteId: 'inst-1', stakesLevel: StakesLevel.PRACTICE },
        evaluationPolicy: { id: 'ep1', instituteId: 'inst-1', mode: EvaluationPolicyMode.AI_FINAL_LOW_STAKES },
      });
      prisma.assessmentDelivery.create.mockResolvedValueOnce({ id: 'd1' });
      await expect(service.createDelivery('inst-1', 'a1', deliveryDto, admin)).resolves.toBeDefined();
    });
  });

  describe('updateDeliveryStatus (shares EXAM_STATUS_TRANSITIONS with ExamsService)', () => {
    function mockDelivery(status: ExamStatus, version = 0) {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'd1', status, version, assessment: { instituteId: 'inst-1' },
      });
    }

    it('rejects a stale version', async () => {
      mockDelivery(ExamStatus.DRAFT, 5);
      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.REVIEW, version: 0 }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects skipping a stage', async () => {
      mockDelivery(ExamStatus.DRAFT, 0);
      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.PUBLISHED, version: 0 }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects a teacher approving a delivery', async () => {
      mockDelivery(ExamStatus.REVIEW, 0);
      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.APPROVED, version: 0 }, teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows the valid next transition and writes an audit entry', async () => {
      mockDelivery(ExamStatus.DRAFT, 0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.REVIEW });
      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.REVIEW, version: 0 }, teacher),
      ).resolves.toBeDefined();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('writes LOCK atomically via $transaction', async () => {
      mockDelivery(ExamStatus.EVALUATING, 0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.LOCKED });
      await service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin);
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('unlockDelivery', () => {
    it('rejects a non-admin', async () => {
      await expect(
        service.unlockDelivery('inst-1', 'd1', { reason: 'reason enough', version: 0 }, teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unlocking a non-LOCKED delivery', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'd1', status: ExamStatus.DRAFT, version: 0, assessment: { instituteId: 'inst-1' },
      });
      await expect(
        service.unlockDelivery('inst-1', 'd1', { reason: 'reason enough', version: 0 }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('unlocks a LOCKED delivery to EVALUATING atomically', async () => {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'd1', status: ExamStatus.LOCKED, version: 0, assessment: { instituteId: 'inst-1' },
      });
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.EVALUATING });
      await expect(
        service.unlockDelivery('inst-1', 'd1', { reason: 'reason enough', version: 0 }, admin),
      ).resolves.toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });
});
