import { Test, TestingModule } from '@nestjs/testing';
import { ScoreAggregationService } from './score-aggregation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScoreAggregationService', () => {
  let service: ScoreAggregationService;
  let prisma: {
    response: { findMany: jest.Mock };
    attempt: { findUnique: jest.Mock };
    scoreRecord: { upsert: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      response: { findMany: jest.fn() },
      attempt: { findUnique: jest.fn() },
      scoreRecord: { upsert: jest.fn().mockResolvedValue({}) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoreAggregationService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ScoreAggregationService);
  });

  it('does nothing when the attempt no longer exists', async () => {
    prisma.response.findMany.mockResolvedValueOnce([]);
    prisma.attempt.findUnique.mockResolvedValueOnce(null);
    await service.recalculate('att-gone');
    expect(prisma.scoreRecord.upsert).not.toHaveBeenCalled();
  });

  it('uses the current EvaluationVersion mark when one exists, falling back to Response.marksAwarded for objective evidence', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { question: { marks: 5 }, evaluation: { currentVersion: { marksAwarded: 3 } }, marksAwarded: 0 }, // subjective, evaluated -> use 3
      { question: { marks: 2 }, evaluation: null, marksAwarded: 2 }, // objective, scored at capture -> use 2
      { question: { marks: 5 }, evaluation: { currentVersion: null }, marksAwarded: 0 }, // subjective, not yet evaluated -> 0
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith({
      where: { attemptId: 'att-1' },
      create: { attemptId: 'att-1', studentProfileId: 'sp-1', totalMarks: 12, obtainedMarks: 5, percentage: (5 / 12) * 100 },
      update: { totalMarks: 12, obtainedMarks: 5, percentage: (5 / 12) * 100 },
    });
  });

  it('handles a zero-marks attempt without dividing by zero', async () => {
    prisma.response.findMany.mockResolvedValueOnce([]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ percentage: 0 }) }),
    );
  });
});
