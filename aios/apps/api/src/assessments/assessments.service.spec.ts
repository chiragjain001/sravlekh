import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UserRole, ExamStatus, EvaluationPolicyMode, StakesLevel, AssessmentKind, Prisma } from '@prisma/client';
import { AssessmentsService } from './assessments.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EntitlementResource } from '../entitlements/plan-definitions';
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
    response: { count: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let aiEvaluationService: { enqueueBatch: jest.Mock };
  let entitlements: { assertCanCreate: jest.Mock; ensurePlanDefinitions: jest.Mock; getSnapshot: jest.Mock };

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
      response: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    aiEvaluationService = { enqueueBatch: jest.fn().mockResolvedValue(undefined) };
    entitlements = {
      assertCanCreate: jest.fn().mockResolvedValue(undefined),
      ensurePlanDefinitions: jest.fn().mockResolvedValue(undefined),
      getSnapshot: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssessmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiEvaluationService, useValue: aiEvaluationService },
        // Permissive — the monthly assessment-rate limit itself is covered in
        // entitlements.service.spec.ts; enforcement at this call site is
        // asserted in the dedicated block at the bottom of this file.
        { provide: EntitlementsService, useValue: entitlements },
      ],
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

    function mockHappyPath(overrides: { assessment?: Record<string, unknown>; evaluationPolicy?: Record<string, unknown> } = {}) {
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

    it('enqueues the AI evaluation batch job when a delivery enters EVALUATING (25 §4.1)', async () => {
      mockDelivery(ExamStatus.ONGOING, 0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.EVALUATING });

      await service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.EVALUATING, version: 0 }, teacher);

      expect(aiEvaluationService.enqueueBatch).toHaveBeenCalledWith('inst-1', 'd1', 'teacher-1');
    });

    it('does not enqueue AI evaluation for any other transition', async () => {
      mockDelivery(ExamStatus.DRAFT, 0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.REVIEW });

      await service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.REVIEW, version: 0 }, teacher);

      expect(aiEvaluationService.enqueueBatch).not.toHaveBeenCalled();
    });

    it('writes LOCK atomically via $transaction', async () => {
      mockDelivery(ExamStatus.EVALUATING, 0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.LOCKED });
      await service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin);
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    // Phase 15 hardening (20 §Phase-15's "race conditions (concurrent lock
    // attempts)" audit): the read-check above only proves this one call's
    // write is version-gated. A concurrent second write that already moved
    // the version must fail atomically at the write itself (Prisma P2025),
    // not silently succeed — see shared/version-guard.ts.
    it('turns a concurrent-write conflict (Prisma P2025) into STALE_VERSION, not a raw 500', async () => {
      mockDelivery(ExamStatus.DRAFT, 0);
      prisma.assessmentDelivery.update.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('No record found for update.', { code: 'P2025', clientVersion: '5.17.0' }),
      );
      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.REVIEW, version: 0 }, teacher),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'STALE_VERSION' }) });
    });
  });

  describe('LOCK governance gate — 32-AI-GOVERNANCE-POLICY.md §2 / 27 §7 (adversarial, unbypassable-by-construction)', () => {
    function mockGradedDelivery(status: ExamStatus, stakesLevel: StakesLevel) {
      prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
        id: 'd1', status, version: 0, assessment: { instituteId: 'inst-1', stakesLevel },
      });
    }

    it('blocks LOCK on a GRADED assessment with unevaluated subjective responses (409 SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED)', async () => {
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      prisma.response.count.mockResolvedValueOnce(3);

      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
      ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED' }) });
      expect(prisma.assessmentDelivery.update).not.toHaveBeenCalled();
    });

    it('allows LOCK on a GRADED assessment once every subjective response has a human evaluation', async () => {
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      prisma.response.count.mockResolvedValueOnce(0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.LOCKED });

      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
      ).resolves.toBeDefined();
    });

    it('does not gate LOCK at all for a non-GRADED assessment, even with unevaluated responses present', async () => {
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.PRACTICE);
      prisma.response.count.mockResolvedValueOnce(5); // would block if this delivery were GRADED
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.LOCKED });

      await expect(
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
      ).resolves.toBeDefined();
      expect(prisma.response.count).not.toHaveBeenCalled();
    });

    it('blocks a GRADED delivery identically regardless of assessmentKind — the gate reads only stakesLevel (fix #3, adversarial per 32 §9)', async () => {
      const ALL_ASSESSMENT_KINDS = ['COACHING_TEST', 'SCHOOL_THEORY_EXAM', 'PRACTICE_TEST', 'DIAGNOSTIC', 'HOMEWORK_GRADED'];
      for (const kind of ALL_ASSESSMENT_KINDS) {
        prisma.assessmentDelivery.findUnique.mockResolvedValueOnce({
          id: 'd1', status: ExamStatus.EVALUATING, version: 0,
          assessment: { instituteId: 'inst-1', stakesLevel: StakesLevel.GRADED, assessmentKind: kind },
        });
        prisma.response.count.mockResolvedValueOnce(1);

        await expect(
          service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
          // eslint-disable-next-line no-loop-func
        ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED' }) });
      }
      expect(prisma.assessmentDelivery.update).not.toHaveBeenCalled();
    });

    it("only counts answers a human must mark — subjective question types, plus anything handwritten on a page", async () => {
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      prisma.response.count.mockResolvedValueOnce(0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.LOCKED });

      await service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin);

      const where = prisma.response.count.mock.calls[0][0].where;
      // Both clauses must survive: they are two separate ORs, so they live
      // under AND rather than overwriting each other.
      expect(where.AND).toEqual([
        {
          OR: [
            { question: { is: { type: { in: ['SHORT_ANSWER', 'LONG_ANSWER', 'PASSAGE_BASED'] } } } },
            { evidenceType: 'PAGE_REGION' },
          ],
        },
        { OR: [{ evaluation: null }, { evaluation: { status: { in: ['PENDING', 'AI_SUGGESTED'] } } }] },
      ]);
    });

    // Phase 15 compliance audit (20 §Phase-15 / 13-TESTING-STRATEGY.md v2
    // addendum's "governance-gate bypass attempts, concurrent lock + evaluation-
    // decide race") — the gate must hold even when two LOCK attempts race each
    // other, and it must never trust a cached/stale unevaluated-count: each
    // call re-reads fresh.
    it('never lets two concurrent LOCK attempts both slip past the gate on a delivery with an unevaluated response', async () => {
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      prisma.response.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);

      const [first, second] = await Promise.allSettled([
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
      ]);

      for (const outcome of [first, second]) {
        expect(outcome.status).toBe('rejected');
        expect((outcome as PromiseRejectedResult).reason).toMatchObject({
          response: expect.objectContaining({ code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED' }),
        });
      }
      expect(prisma.assessmentDelivery.update).not.toHaveBeenCalled();
    });

    it("re-checks the unevaluated count fresh per call — a concurrent LOCK racing a decide() that just cleared the last response is correctly allowed through, never blocked by the other call's stale read", async () => {
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      mockGradedDelivery(ExamStatus.EVALUATING, StakesLevel.GRADED);
      // First LOCK attempt's count-check runs before decide() commits (1 left);
      // the second's runs after (0 left) — each call sees its own true state.
      prisma.response.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
      prisma.assessmentDelivery.update.mockResolvedValueOnce({ id: 'd1', status: ExamStatus.LOCKED });

      const [first, second] = await Promise.allSettled([
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
        service.updateDeliveryStatus('inst-1', 'd1', { status: ExamStatus.LOCKED, version: 0 }, admin),
      ]);

      expect(first.status).toBe('rejected');
      expect((first as PromiseRejectedResult).reason).toMatchObject({
        response: expect.objectContaining({ code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED' }),
      });
      expect(second.status).toBe('fulfilled');
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
  // ── Plan-limit enforcement (monthly assessment rate) ───────────────────────
  describe('createAssessment — plan limit enforcement', () => {
    it('consults the entitlement gate for the monthly assessment allowance', async () => {
      prisma.assessment.create.mockResolvedValueOnce({ id: 'asmt-1', title: 'Unit Test 1' });
      await service.createAssessment('inst-1', baseAssessmentDto as any, admin);
      expect(entitlements.assertCanCreate).toHaveBeenCalledWith('inst-1', EntitlementResource.ASSESSMENT);
    });

    it('creates nothing once the monthly allowance is exhausted', async () => {
      entitlements.assertCanCreate.mockRejectedValueOnce(
        new ForbiddenException({ code: 'PLAN_LIMIT_EXCEEDED', message: 'limit' }),
      );
      await expect(
        service.createAssessment('inst-1', baseAssessmentDto as any, admin),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.assessment.create).not.toHaveBeenCalled();
    });
  });
});
