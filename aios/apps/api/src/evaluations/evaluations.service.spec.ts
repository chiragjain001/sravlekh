import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, QuestionType, EvaluationSource, EvaluationStatus, RubricScoringMode } from '@prisma/client';
import { EvaluationsService } from './evaluations.service';
import { EvaluationDecision } from './dto/evaluation.dto';
import { SCORE_AGGREGATION_QUEUE } from './score-aggregation.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('EvaluationsService', () => {
  let service: EvaluationsService;
  let prisma: {
    response: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock };
    evaluation: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    evaluationVersion: { create: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let queue: { add: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };
  let aiEvaluationService: { enqueueSingle: jest.Mock };
  let permissionsService: { hasPermission: jest.Mock };
  let reportsService: { reissueForStudent: jest.Mock };
  let analyticsService: { enqueueMasteryRecalc: jest.Mock };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };
  const otherTeacher: AuthenticatedUser = { ...teacher, id: 'teacher-2', instituteId: 'inst-2' };
  const founder: AuthenticatedUser = { ...teacher, id: 'founder-1', role: UserRole.FOUNDER };
  const admin: AuthenticatedUser = { ...teacher, id: 'admin-1', role: UserRole.ADMIN };

  beforeEach(async () => {
    prisma = {
      response: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      evaluation: { create: jest.fn(), update: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
      evaluationVersion: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    queue = { add: jest.fn().mockResolvedValue({}) };
    cache = { get: jest.fn().mockResolvedValue(undefined), set: jest.fn().mockResolvedValue(undefined) };
    aiEvaluationService = { enqueueSingle: jest.fn().mockResolvedValue(undefined) };
    permissionsService = { hasPermission: jest.fn().mockResolvedValue(false) };
    reportsService = { reissueForStudent: jest.fn().mockResolvedValue(undefined) };
    analyticsService = { enqueueMasteryRecalc: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
        { provide: AiEvaluationService, useValue: aiEvaluationService },
        { provide: PermissionsService, useValue: permissionsService },
        { provide: ReportsService, useValue: reportsService },
        { provide: AnalyticsService, useValue: analyticsService },
        { provide: getQueueToken(SCORE_AGGREGATION_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(EvaluationsService);
  });

  const baseResponse = {
    id: 'resp-1',
    attemptId: 'att-1',
    marksAvailable: 5,
    attempt: { studentProfileId: 'sp-1', assessmentDelivery: { batchId: 'batch-1', status: 'EVALUATING', assessment: { instituteId: 'inst-1' } } },
    question: { type: QuestionType.SHORT_ANSWER, rubric: null, subjectId: 'sub-1', topicId: 'topic-1' },
    evaluation: null,
  };

  describe('decide — access & eligibility', () => {
    it('rejects a cross-tenant actor', async () => {
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, otherTeacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('404s when the response does not exist', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, teacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('404s on a legacy v1 (non-attempt) Response', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({ ...baseResponse, attemptId: null, attempt: null });
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, teacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an objective question type', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({ ...baseResponse, question: { type: QuestionType.MCQ, rubric: null } });
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, teacher),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('decide — holistic (no rubric)', () => {
    it('requires marksAwarded', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects marksAwarded exceeding marksAvailable', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 10 }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects criterionScores on a response with no additive rubric', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 1 }] }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a new EvaluationVersion and enqueues score aggregation', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-1', marksAwarded: 3 });

      const result = await service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, teacher);

      expect(prisma.evaluationVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ source: EvaluationSource.TEACHER, marksAwarded: 3, previousVersionId: undefined }) }),
      );
      expect(prisma.evaluation.update).toHaveBeenCalledWith({
        where: { id: 'eval-1' },
        data: { currentEvaluationVersionId: 'ev-1', status: EvaluationStatus.TEACHER_REVIEWED },
      });
      expect(queue.add).toHaveBeenCalledWith('recalculate', { attemptId: 'att-1' }, expect.any(Object));
      expect(result).toEqual({ id: 'ev-1', marksAwarded: 3 });
    });

    // V2 Analytics/Mastery Integration phase.
    it('triggers a mastery recalc for the response student+topic', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-1', marksAwarded: 3 });

      await service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, teacher);

      expect(analyticsService.enqueueMasteryRecalc).toHaveBeenCalledWith('sp-1', ['topic-1']);
    });
  });

  describe('decide — ACCEPT_AI', () => {
    it('rejects when there is no prior AI version', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ACCEPT_AI }, teacher),
      ).rejects.toThrow(ConflictException);
    });

    it('copies marks and criterion scores from the prior AI version', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({
        ...baseResponse,
        evaluation: {
          id: 'eval-1',
          currentVersion: { id: 'ev-ai', source: EvaluationSource.AI, marksAwarded: 4, criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 4, note: null }] },
        },
      });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-2', marksAwarded: 4 });

      await service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ACCEPT_AI }, teacher);

      expect(prisma.evaluationVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            marksAwarded: 4,
            previousVersionId: 'ev-ai',
            criterionScores: { create: [{ rubricCriterion: { connect: { id: 'c1' } }, marksAwarded: 4, note: null }] },
          }),
        }),
      );
    });

    // V2 Analytics/Mastery Integration phase: ACCEPT_AI still creates a real
    // TEACHER-sourced version (25 §4.2) — mastery must treat it as finalized
    // exactly like any other decide() outcome, not skip it as "just AI".
    it('still triggers a mastery recalc — accepting AI is a real human-authored finalization', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({
        ...baseResponse,
        evaluation: {
          id: 'eval-1',
          currentVersion: { id: 'ev-ai', source: EvaluationSource.AI, marksAwarded: 4, criterionScores: [] },
        },
      });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-2', marksAwarded: 4 });

      await service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ACCEPT_AI }, teacher);

      expect(analyticsService.enqueueMasteryRecalc).toHaveBeenCalledWith('sp-1', ['topic-1']);
    });
  });

  describe('decide — CRITERION_ADDITIVE rubric', () => {
    const rubricResponse = {
      ...baseResponse,
      question: {
        type: QuestionType.SHORT_ANSWER,
        rubric: {
          scoringMode: RubricScoringMode.CRITERION_ADDITIVE,
          maxMarks: 5,
          versions: [{ criteria: [
            { id: 'c1', maxMarks: 3, description: 'method', dependsOnCriterionId: null },
            { id: 'c2', maxMarks: 2, description: 'answer', dependsOnCriterionId: null },
          ] }],
        },
      },
    };

    it('requires criterionScores', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(rubricResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, marksAwarded: 3 }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a criterion not on the current rubric version', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(rubricResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, criterionScores: [{ rubricCriterionId: 'c-unknown', marksAwarded: 1 }] }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a criterion score above its own maxMarks', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(rubricResponse);
      await expect(
        service.decide('inst-1', 'resp-1', { decision: EvaluationDecision.ADJUST, criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 99 }] }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('derives the total as the sum of criterion scores, ignoring any independently-set total', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(rubricResponse);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-1', marksAwarded: 5 });

      await service.decide(
        'inst-1', 'resp-1',
        { decision: EvaluationDecision.ADJUST, criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 3 }, { rubricCriterionId: 'c2', marksAwarded: 2 }] },
        teacher,
      );

      expect(prisma.evaluationVersion.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ marksAwarded: 5 }) }));
    });

    // 26 §4.1: the ceiling is the response's own marksAvailable, not the rubric's
    // maxMarks. A rubric reused across questions (or a question edited after its
    // rubric was authored) can carry a higher maxMarks than this response offers —
    // capping on the rubric would silently over-award on an official evaluation.
    it('caps the total at response.marksAvailable, not rubric.maxMarks, when the two diverge', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({ ...rubricResponse, marksAvailable: 4 });
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-1', marksAwarded: 4 });

      await service.decide(
        'inst-1', 'resp-1',
        { decision: EvaluationDecision.ADJUST, criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 3 }, { rubricCriterionId: 'c2', marksAwarded: 2 }] },
        teacher,
      );

      expect(prisma.evaluationVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ marksAwarded: 4 }) }),
      );
    });
  });

  describe('decide — STEP_WISE dependency rule (26 §4.2)', () => {
    const stepWiseResponse = {
      ...baseResponse,
      question: {
        type: QuestionType.SHORT_ANSWER,
        rubric: {
          scoringMode: RubricScoringMode.STEP_WISE,
          maxMarks: 5,
          versions: [{ criteria: [
            { id: 'c1', maxMarks: 3, description: 'method', dependsOnCriterionId: null },
            { id: 'c2', maxMarks: 2, description: 'final answer', dependsOnCriterionId: 'c1' },
          ] }],
        },
      },
    };

    it('rejects awarding a dependent criterion when its dependency scored 0, with no override comment', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(stepWiseResponse);
      await expect(
        service.decide(
          'inst-1', 'resp-1',
          { decision: EvaluationDecision.ADJUST, criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 0 }, { rubricCriterionId: 'c2', marksAwarded: 2 }] },
          teacher,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows it with a documented override (teacherComment)', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(stepWiseResponse);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-1', marksAwarded: 2 });

      await expect(
        service.decide(
          'inst-1', 'resp-1',
          {
            decision: EvaluationDecision.ADJUST,
            criterionScores: [{ rubricCriterionId: 'c1', marksAwarded: 0 }, { rubricCriterionId: 'c2', marksAwarded: 2 }],
            teacherComment: 'Reached correct answer via a valid alternate method',
          },
          teacher,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('reprocess', () => {
    it('rejects a missing Idempotency-Key', async () => {
      await expect(service.reprocess('inst-1', 'resp-1', undefined, teacher)).rejects.toThrow(BadRequestException);
    });

    it('returns the cached ack on a repeated Idempotency-Key without re-enqueueing', async () => {
      cache.get.mockResolvedValueOnce({ status: 'queued', responseId: 'resp-1' });
      const result = await service.reprocess('inst-1', 'resp-1', 'key-1', teacher);
      expect(result).toEqual({ status: 'queued', responseId: 'resp-1' });
      expect(aiEvaluationService.enqueueSingle).not.toHaveBeenCalled();
    });

    it('validates eligibility, enqueues a single AI evaluation, and caches the ack', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);

      const result = await service.reprocess('inst-1', 'resp-1', 'key-1', teacher);

      expect(aiEvaluationService.enqueueSingle).toHaveBeenCalledWith('inst-1', 'resp-1', 'teacher-1');
      expect(cache.set).toHaveBeenCalledWith('idempotency:reprocess:inst-1:key-1', { status: 'queued', responseId: 'resp-1' }, expect.any(Number));
      expect(result).toEqual({ status: 'queued', responseId: 'resp-1' });
    });

    it('rejects reprocessing an ineligible (objective) response without enqueueing', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({ ...baseResponse, question: { type: 'MCQ', rubric: null } });
      await expect(service.reprocess('inst-1', 'resp-1', 'key-1', teacher)).rejects.toThrow(BadRequestException);
      expect(aiEvaluationService.enqueueSingle).not.toHaveBeenCalled();
    });
  });

  describe('override — REVIEW_EVALUATION permission gate (25 §4.3 / 21 §4.10)', () => {
    it('rejects a TEACHER without the REVIEW_EVALUATION grant', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      permissionsService.hasPermission.mockResolvedValueOnce(false);

      await expect(
        service.override('inst-1', 'resp-1', { marksAwarded: 3, disputeReason: 'Student appealed the mark' }, teacher),
      ).rejects.toThrow(ForbiddenException);
      expect(permissionsService.hasPermission).toHaveBeenCalledWith('teacher-1', 'REVIEW_EVALUATION', { batchId: 'batch-1', subjectId: 'sub-1' });
    });

    it('allows a TEACHER holding the REVIEW_EVALUATION grant', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      permissionsService.hasPermission.mockResolvedValueOnce(true);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-reviewer-1', marksAwarded: 3 });

      await expect(
        service.override('inst-1', 'resp-1', { marksAwarded: 3, disputeReason: 'Student appealed the mark' }, teacher),
      ).resolves.toBeDefined();
    });

    // 13-TESTING-STRATEGY.md v2 addendum, verbatim: "an ADMIN without explicit
    // grant must never succeed at POST /evaluations/:id/override" — ADMIN is
    // route-level allowed (@Roles) but must not get an implicit service-level
    // bypass the way FOUNDER does.
    it('rejects an ADMIN without the REVIEW_EVALUATION grant', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      permissionsService.hasPermission.mockResolvedValueOnce(false);

      await expect(
        service.override('inst-1', 'resp-1', { marksAwarded: 3, disputeReason: 'Student appealed the mark' }, admin),
      ).rejects.toThrow(ForbiddenException);
      expect(permissionsService.hasPermission).toHaveBeenCalledWith('admin-1', 'REVIEW_EVALUATION', { batchId: 'batch-1', subjectId: 'sub-1' });
    });

    it('never checks the grant for a FOUNDER — always allowed', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-reviewer-1', marksAwarded: 3 });

      await service.override('inst-1', 'resp-1', { marksAwarded: 3, disputeReason: 'Student appealed the mark' }, founder);

      expect(permissionsService.hasPermission).not.toHaveBeenCalled();
    });

    it('rejects overriding a LOCKED delivery (must unlock first)', async () => {
      prisma.response.findUnique.mockResolvedValueOnce({
        ...baseResponse,
        attempt: { ...baseResponse.attempt, assessmentDelivery: { ...baseResponse.attempt.assessmentDelivery, status: 'LOCKED' } },
      });
      permissionsService.hasPermission.mockResolvedValueOnce(true);

      await expect(
        service.override('inst-1', 'resp-1', { marksAwarded: 3, disputeReason: 'Student appealed the mark' }, teacher),
      ).rejects.toThrow(ConflictException);
    });

    it('creates a REVIEWER_FINALIZED EvaluationVersion with the dispute reason, and triggers report reissue', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      permissionsService.hasPermission.mockResolvedValueOnce(true);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-reviewer-1', marksAwarded: 4 });

      await service.override('inst-1', 'resp-1', { marksAwarded: 4, disputeReason: 'Re-graded per moderation policy' }, teacher);

      expect(prisma.evaluationVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ source: EvaluationSource.REVIEWER, disputeReason: 'Re-graded per moderation policy' }) }),
      );
      expect(prisma.evaluation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: EvaluationStatus.REVIEWER_FINALIZED }) }),
      );
      expect(reportsService.reissueForStudent).toHaveBeenCalledWith('inst-1', 'sp-1', 'teacher-1');
    });

    // V2 Analytics/Mastery Integration phase.
    it('triggers a mastery recalc for the response student+topic', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      permissionsService.hasPermission.mockResolvedValueOnce(true);
      prisma.evaluation.create.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.create.mockResolvedValueOnce({ id: 'ev-reviewer-1', marksAwarded: 4 });

      await service.override('inst-1', 'resp-1', { marksAwarded: 4, disputeReason: 'Re-graded per moderation policy' }, teacher);

      expect(analyticsService.enqueueMasteryRecalc).toHaveBeenCalledWith('sp-1', ['topic-1']);
    });
  });

  describe('getHistory', () => {
    it('returns an empty chain when no evaluation exists yet', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      prisma.evaluation.findUnique.mockResolvedValueOnce(null);
      await expect(service.getHistory('inst-1', 'resp-1', teacher)).resolves.toEqual({ data: [] });
    });

    it('returns the full chain oldest-to-newest', async () => {
      prisma.response.findUnique.mockResolvedValueOnce(baseResponse);
      prisma.evaluation.findUnique.mockResolvedValueOnce({ id: 'eval-1' });
      prisma.evaluationVersion.findMany.mockResolvedValueOnce([{ id: 'v1' }, { id: 'v2' }]);

      const result = await service.getHistory('inst-1', 'resp-1', teacher);

      expect(prisma.evaluationVersion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { evaluationId: 'eval-1' }, orderBy: { createdAt: 'asc' } }),
      );
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getWorkItems', () => {
    it('narrows eligibility to AI_SUGGESTED + a matching flag when aiFlag is set (Phase 13 — real, not the Phase 12 always-empty stub)', async () => {
      prisma.response.findMany.mockResolvedValueOnce([]);
      prisma.response.count.mockResolvedValueOnce(0);

      await service.getWorkItems('inst-1', { aiFlag: 'low_confidence' }, teacher);

      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ evaluation: { status: EvaluationStatus.AI_SUGGESTED, currentVersion: { aiRecommendation: { flags: { has: 'low_confidence' } } } } }],
          }),
        }),
      );
    });

    it('scopes by instituteId and applies batchId/subjectId filters', async () => {
      prisma.response.findMany.mockResolvedValueOnce([]);
      prisma.response.count.mockResolvedValueOnce(0);

      await service.getWorkItems('inst-1', { batchId: 'batch-1', subjectId: 'sub-1' }, teacher);

      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            attempt: { assessmentDelivery: { assessment: { instituteId: 'inst-1' }, batchId: 'batch-1' } },
            question: expect.objectContaining({ subjectId: 'sub-1' }),
          }),
        }),
      );
    });

    it('includes questionRegion -> pageImage -> page (documentId) and the latest OCR result, so the frontend can render the source image + transcript (doc 28 §2)', async () => {
      prisma.response.findMany.mockResolvedValueOnce([]);
      prisma.response.count.mockResolvedValueOnce(0);

      await service.getWorkItems('inst-1', {}, teacher);

      expect(prisma.response.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            questionRegion: {
              select: {
                id: true,
                boundingBox: true,
                pageImage: { select: { id: true, page: { select: { id: true, documentId: true, pageNumber: true } } } },
                ocrBlocks: { select: { results: { orderBy: { processedAt: 'desc' }, take: 1 } } },
              },
            },
          }),
        }),
      );
    });
  });
});
