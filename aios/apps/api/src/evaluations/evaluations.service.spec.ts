import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, QuestionType, EvaluationSource, EvaluationStatus, RubricScoringMode } from '@prisma/client';
import { EvaluationsService } from './evaluations.service';
import { EvaluationDecision } from './dto/evaluation.dto';
import { SCORE_AGGREGATION_QUEUE } from './score-aggregation.constants';
import { PrismaService } from '../prisma/prisma.service';
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

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };
  const otherTeacher: AuthenticatedUser = { ...teacher, id: 'teacher-2', instituteId: 'inst-2' };

  beforeEach(async () => {
    prisma = {
      response: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      evaluation: { create: jest.fn(), update: jest.fn().mockResolvedValue({}), findUnique: jest.fn() },
      evaluationVersion: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    queue = { add: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(SCORE_AGGREGATION_QUEUE), useValue: queue },
      ],
    }).compile();
    service = module.get(EvaluationsService);
  });

  const baseResponse = {
    id: 'resp-1',
    attemptId: 'att-1',
    marksAvailable: 5,
    attempt: { assessmentDelivery: { assessment: { instituteId: 'inst-1' } } },
    question: { type: QuestionType.SHORT_ANSWER, rubric: null },
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
    it('returns empty immediately when aiFlag is set — no AI data exists until Phase 13', async () => {
      const result = await service.getWorkItems('inst-1', { aiFlag: 'low_confidence' }, teacher);
      expect(result).toEqual({ data: [], meta: { total: 0, page: 1, pageSize: 20, totalPages: 0 } });
      expect(prisma.response.findMany).not.toHaveBeenCalled();
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
  });
});
