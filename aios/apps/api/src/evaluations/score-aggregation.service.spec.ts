import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationSource } from '@prisma/client';
import { ScoreAggregationService } from './score-aggregation.service';
import { isHumanApproved } from './evaluation-status.util';
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
      { attemptId: 'att-1', question: { marks: 5, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 3, source: 'TEACHER' } }, marksAwarded: 0 }, // subjective, human-evaluated -> use 3
      { attemptId: 'att-1', question: { marks: 2, type: 'MCQ' }, evaluation: null, marksAwarded: 2 }, // objective, scored at capture -> use 2
      { attemptId: 'att-1', question: { marks: 5, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: null }, marksAwarded: 0 }, // subjective, not yet evaluated -> 0
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith({
      where: { attemptId: 'att-1' },
      create: { attemptId: 'att-1', studentProfileId: 'sp-1', totalMarks: 12, obtainedMarks: 5, percentage: (5 / 12) * 100, isFinalized: false },
      update: { totalMarks: 12, obtainedMarks: 5, percentage: (5 / 12) * 100, isFinalized: false },
    });
  });

  // 32-AI-GOVERNANCE-POLICY.md §2 — aggregation runs on every evaluation write, not
  // just at LOCK, so it is its own governance boundary, not one the LOCK gate covers.
  it('excludes an AI-suggested-only response from obtainedMarks, contributing 0 rather than the unreviewed mark', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { attemptId: 'att-1', question: { marks: 10, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 8, source: 'AI' } }, marksAwarded: 0 },
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalMarks: 10, obtainedMarks: 0, percentage: 0, isFinalized: false },
      }),
    );
  });

  it('counts a REVIEWER-sourced version as authoritative, same as TEACHER', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { attemptId: 'att-1', question: { marks: 10, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 7, source: 'REVIEWER' } }, marksAwarded: 0 },
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalMarks: 10, obtainedMarks: 7, percentage: 70, isFinalized: true },
      }),
    );
  });

  it('sets isFinalized true only when every subjective response is human-approved', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { attemptId: 'att-1', question: { marks: 5, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 4, source: 'TEACHER' } }, marksAwarded: 0 },
      { attemptId: 'att-1', question: { marks: 5, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 5, source: 'TEACHER' } }, marksAwarded: 0 },
      { attemptId: 'att-1', question: { marks: 2, type: 'MCQ' }, evaluation: null, marksAwarded: 2 },
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalMarks: 12, obtainedMarks: 11, percentage: (11 / 12) * 100, isFinalized: true },
      }),
    );
  });

  it('sets isFinalized false while any subjective response remains AI-suggested', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { attemptId: 'att-1', question: { marks: 5, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 4, source: 'TEACHER' } }, marksAwarded: 0 },
      { attemptId: 'att-1', question: { marks: 5, type: 'SHORT_ANSWER' }, evaluation: { currentVersion: { marksAwarded: 5, source: 'AI' } }, marksAwarded: 0 },
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalMarks: 10, obtainedMarks: 4, percentage: 40, isFinalized: false },
      }),
    );
  });

  // Caught by the real-database E2E pass, missed by the mocked suite: a missing
  // Evaluation row is not proof a response is objective — an ungraded subjective
  // answer has none either. Keying off `!response.evaluation` counted it as a real
  // zero AND left isFinalized true, marking an attempt final with ungraded answers.
  it('treats a subjective response with no Evaluation row as unapproved, not as objective evidence', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { attemptId: 'att-1', question: { marks: 10, type: 'SHORT_ANSWER' }, evaluation: null, marksAwarded: 0 },
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalMarks: 10, obtainedMarks: 0, percentage: 0, isFinalized: false },
      }),
    );
  });

  it('still finalizes an attempt made entirely of objective responses', async () => {
    prisma.response.findMany.mockResolvedValueOnce([
      { attemptId: 'att-1', question: { marks: 4, type: 'MCQ' }, evaluation: null, marksAwarded: 4 },
      { attemptId: 'att-1', question: { marks: 6, type: 'NUMERICAL' }, evaluation: null, marksAwarded: 3 },
    ]);
    prisma.attempt.findUnique.mockResolvedValueOnce({ id: 'att-1', studentProfileId: 'sp-1' });

    await service.recalculate('att-1');

    expect(prisma.scoreRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalMarks: 10, obtainedMarks: 7, percentage: 70, isFinalized: true },
      }),
    );
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

describe('isHumanApproved', () => {
  it('accepts TEACHER and REVIEWER, rejects AI and absent versions', () => {
    expect(isHumanApproved({ source: EvaluationSource.TEACHER })).toBe(true);
    expect(isHumanApproved({ source: EvaluationSource.REVIEWER })).toBe(true);
    expect(isHumanApproved({ source: EvaluationSource.AI })).toBe(false);
    expect(isHumanApproved(null)).toBe(false);
    expect(isHumanApproved(undefined)).toBe(false);
  });
});
