import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { UserRole, QuestionType, RubricScoringMode, ExamStatus } from '@prisma/client';
import { RubricsService } from './rubrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('RubricsService', () => {
  let service: RubricsService;
  let txCriterionCreate: jest.Mock;
  let txCriterionUpdate: jest.Mock;
  let txRubricCreate: jest.Mock;
  let txRubricUpdate: jest.Mock;
  let txRubricVersionCreate: jest.Mock;
  let txQuestionUpdate: jest.Mock;
  let prisma: {
    question: { findUnique: jest.Mock; update: jest.Mock };
    rubric: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    rubricVersion: { findFirst: jest.Mock; findMany: jest.Mock; create: jest.Mock };
    assessmentDelivery: { findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'T', role: UserRole.TEACHER, instituteId: 'inst-1' };

  beforeEach(async () => {
    let criterionCounter = 0;
    txCriterionCreate = jest.fn((args: any) => Promise.resolve({ id: `crit-${criterionCounter++}`, ...args.data }));
    txCriterionUpdate = jest.fn().mockResolvedValue({});
    txRubricCreate = jest.fn((args: any) => Promise.resolve({ id: 'rubric-1', ...args.data }));
    txRubricUpdate = jest.fn().mockResolvedValue({});
    txRubricVersionCreate = jest.fn((args: any) => Promise.resolve({ id: 'rv-1', ...args.data }));
    txQuestionUpdate = jest.fn().mockResolvedValue({});

    prisma = {
      question: { findUnique: jest.fn(), update: jest.fn() },
      rubric: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      rubricVersion: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
      assessmentDelivery: { findFirst: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (fn: any) => fn({
        rubric: { create: txRubricCreate, update: txRubricUpdate },
        rubricVersion: { create: txRubricVersionCreate },
        rubricCriterion: { create: txCriterionCreate, update: txCriterionUpdate },
        question: { update: txQuestionUpdate },
      })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [RubricsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RubricsService);
  });

  const subjectiveQuestion = { id: 'q1', instituteId: 'inst-1', type: QuestionType.SHORT_ANSWER, marks: 5, deletedAt: null };

  describe('createForQuestion', () => {
    it('404s when the question does not exist', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createForQuestion('inst-1', 'q1', { name: 'x', scoringMode: RubricScoringMode.CRITERION_ADDITIVE, criteria: [] }, teacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an objective question type (MCQ)', async () => {
      prisma.question.findUnique.mockResolvedValueOnce({ ...subjectiveQuestion, type: QuestionType.MCQ });
      await expect(
        service.createForQuestion('inst-1', 'q1', { name: 'x', scoringMode: RubricScoringMode.CRITERION_ADDITIVE, criteria: [{ description: 'a', maxMarks: 5 }] }, teacher),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a duplicate rubric for the same question', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(subjectiveQuestion);
      prisma.rubric.findUnique.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.createForQuestion('inst-1', 'q1', { name: 'x', scoringMode: RubricScoringMode.CRITERION_ADDITIVE, criteria: [{ description: 'a', maxMarks: 5 }] }, teacher),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects criteria that do not sum to Question.marks (RUBRIC_MARKS_MISMATCH)', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(subjectiveQuestion);
      prisma.rubric.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createForQuestion(
          'inst-1', 'q1',
          { name: 'x', scoringMode: RubricScoringMode.CRITERION_ADDITIVE, criteria: [{ description: 'a', maxMarks: 3 }] },
          teacher,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('allows HOLISTIC_WITH_GUIDANCE bands that do not sum to Question.marks', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(subjectiveQuestion);
      prisma.rubric.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createForQuestion(
          'inst-1', 'q1',
          { name: 'x', scoringMode: RubricScoringMode.HOLISTIC_WITH_GUIDANCE, criteria: [{ description: '4-5: comprehensive', maxMarks: 5 }, { description: '0-3: partial', maxMarks: 3 }] },
          teacher,
        ),
      ).resolves.toBeDefined();
    });

    it('rejects a criterion depending on itself', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(subjectiveQuestion);
      prisma.rubric.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.createForQuestion(
          'inst-1', 'q1',
          { name: 'x', scoringMode: RubricScoringMode.STEP_WISE, criteria: [{ description: 'a', maxMarks: 5, dependsOnCriterionIndex: 0 }] },
          teacher,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves dependsOnCriterionIndex to the real created criterion id', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(subjectiveQuestion);
      prisma.rubric.findUnique.mockResolvedValueOnce(null);

      await service.createForQuestion(
        'inst-1', 'q1',
        {
          name: 'x', scoringMode: RubricScoringMode.STEP_WISE,
          criteria: [
            { description: 'method', maxMarks: 3 },
            { description: 'final answer', maxMarks: 2, dependsOnCriterionIndex: 0 },
          ],
        },
        teacher,
      );

      expect(txCriterionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'crit-1' }, data: { dependsOnCriterionId: 'crit-0' } }),
      );
    });

    it('sets Question.rubricId on success', async () => {
      prisma.question.findUnique.mockResolvedValueOnce(subjectiveQuestion);
      prisma.rubric.findUnique.mockResolvedValueOnce(null);
      await service.createForQuestion(
        'inst-1', 'q1',
        { name: 'x', scoringMode: RubricScoringMode.CRITERION_ADDITIVE, criteria: [{ description: 'a', maxMarks: 5 }] },
        teacher,
      );
      expect(txQuestionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'q1' }, data: { rubricId: 'rubric-1' } }),
      );
    });
  });

  describe('findByQuestion', () => {
    it('404s when the question has no rubric', async () => {
      prisma.rubric.findUnique.mockResolvedValueOnce(null);
      await expect(service.findByQuestion('inst-1', 'q1', teacher)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const rubric = { id: 'rubric-1', instituteId: 'inst-1', questionId: 'q1', maxMarks: 5, scoringMode: RubricScoringMode.CRITERION_ADDITIVE };

    it('404s when the rubric does not exist', async () => {
      prisma.rubric.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.update('inst-1', 'rubric-1', { criteria: [{ description: 'a', maxMarks: 5 }] }, teacher),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects editing while a delivery on this question is EVALUATING (RUBRIC_LOCKED_FOR_EVALUATION)', async () => {
      prisma.rubric.findUnique.mockResolvedValueOnce(rubric);
      prisma.assessmentDelivery.findFirst.mockResolvedValueOnce({ id: 'delivery-1' });
      await expect(
        service.update('inst-1', 'rubric-1', { criteria: [{ description: 'a', maxMarks: 5 }] }, teacher),
      ).rejects.toThrow(ConflictException);
      expect(prisma.assessmentDelivery.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: ExamStatus.EVALUATING }) }),
      );
    });

    it('creates a new version incrementing versionNumber when no delivery is EVALUATING', async () => {
      prisma.rubric.findUnique.mockResolvedValueOnce(rubric);
      prisma.assessmentDelivery.findFirst.mockResolvedValueOnce(null);
      prisma.rubricVersion.findFirst.mockResolvedValueOnce({ id: 'rv-old', versionNumber: 2 });

      await service.update('inst-1', 'rubric-1', { criteria: [{ description: 'a', maxMarks: 5 }] }, teacher);

      expect(txRubricVersionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ versionNumber: 3 }) }),
      );
    });

    it('rejects a criteria set that no longer reconciles to the fixed Rubric.maxMarks', async () => {
      prisma.rubric.findUnique.mockResolvedValueOnce(rubric);
      prisma.assessmentDelivery.findFirst.mockResolvedValueOnce(null);
      await expect(
        service.update('inst-1', 'rubric-1', { criteria: [{ description: 'a', maxMarks: 2 }] }, teacher),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });
});
