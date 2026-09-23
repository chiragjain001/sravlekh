import axios from 'axios';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { EvaluationSource, EvaluationStatus, QuestionType, UserRole } from '@prisma/client';
import { CheckedCopyService } from './checked-copy.service';
import { EvaluationsService } from './evaluations.service';
import { AuthenticatedUser } from '../auth/auth.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const teacher: AuthenticatedUser = { id: 'teacher-1', email: 't@x.com', name: 'Ms. Rao', role: UserRole.TEACHER, instituteId: 'inst-1' };

function region(pageNumber: number, y: number, ocr?: { extractedText: string | null; confidence: number; requiresVisualEvaluation?: boolean }) {
  return {
    id: `region-${pageNumber}-${y}`,
    boundingBox: { x: 0.1, y, width: 0.8, height: 0.2 },
    pageImage: { id: `img-${pageNumber}`, page: { id: `page-${pageNumber}`, documentId: 'doc-1', pageNumber } },
    // A block carries the box it was read from; only a block matching the
    // region's current box counts as a current reading (shared/region-box.ts).
    ocrBlocks: ocr
      ? [{ boundingBox: { x: 0.1, y, width: 0.8, height: 0.2 }, results: [{ id: 'ocr-1', processedAt: new Date(), requiresVisualEvaluation: false, ...ocr }] }]
      : [],
  };
}

function version(source: EvaluationSource, marksAwarded: number, extra: Record<string, unknown> = {}) {
  return {
    id: `v-${source}-${marksAwarded}`,
    source,
    marksAwarded,
    mistakeTagType: null,
    teacherComment: null,
    gradingBreakdown: null,
    aiRecommendationId: null,
    authorUserId: source === EvaluationSource.AI ? null : 'teacher-1',
    createdAt: new Date('2026-09-20T10:00:00Z'),
    criterionScores: [],
    ...extra,
  };
}

function response(id: string, opts: {
  questionId?: string;
  type?: QuestionType;
  marksAvailable?: number;
  region?: ReturnType<typeof region> | null;
  current?: ReturnType<typeof version> | null;
  ai?: Record<string, unknown> | null;
} = {}) {
  const current = opts.current ?? null;
  return {
    id,
    questionId: opts.questionId ?? `q-${id}`,
    evidenceType: opts.region === null ? 'DIGITAL_VALUE' : 'PAGE_REGION',
    studentAnswer: null,
    marksAwarded: 0,
    marksAvailable: opts.marksAvailable ?? 5,
    question: { id: opts.questionId ?? `q-${id}`, content: `Question ${id}`, type: opts.type ?? QuestionType.SHORT_ANSWER, marks: opts.marksAvailable ?? 5, topicId: `topic-${id}`, rubric: null },
    evaluation: current ? { id: `eval-${id}`, currentEvaluationVersionId: current.id, currentVersion: current } : null,
    aiRecommendations: opts.ai ? [{ id: `rec-${id}`, suggestedMarks: 3, confidence: 0.9, flags: ['none'], ...opts.ai }] : [],
    questionRegion: opts.region === undefined ? region(1, 0.1, { extractedText: 'answer', confidence: 0.9 }) : opts.region,
  };
}

function attempt(responses: ReturnType<typeof response>[], overrides: Record<string, unknown> = {}) {
  return {
    id: 'att-1',
    studentProfileId: 'sp-1',
    studentProfile: { id: 'sp-1', rollNumber: '12', user: { name: 'Asha' } },
    scoreRecord: null,
    assessmentDelivery: { id: 'del-1', status: 'EVALUATING', assessment: { instituteId: 'inst-1', title: 'Unit Test', paper: null } },
    documents: [{ pages: [{ pageNumber: 1, images: [{ id: 'img-1', rawImageUrl: 'raw/1.jpg', processedImageUrl: null }] }] }],
    responses,
    ...overrides,
  };
}

describe('CheckedCopyService', () => {
  let prisma: any;
  let storage: { getSignedDownloadUrl: jest.Mock; upload: jest.Mock; buildKey: jest.Mock };
  let ai: { enqueueSingle: jest.Mock };
  let analytics: { enqueueMasteryRecalc: jest.Mock };
  let scoreAggregation: { recalculate: jest.Mock };
  let service: CheckedCopyService;
  let tx: any;

  const load = (a: ReturnType<typeof attempt>) => prisma.attempt.findUnique.mockResolvedValue(a);

  beforeEach(() => {
    let versionSeq = 0;
    tx = {
      evaluation: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `eval-new-${data.responseId}`, currentEvaluationVersionId: null })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      evaluationVersion: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `v-new-${++versionSeq}`, ...data })) },
    };
    prisma = {
      attempt: { findUnique: jest.fn() },
      scoreRecord: { findUnique: jest.fn().mockResolvedValue({ obtainedMarks: 7, totalMarks: 10, percentage: 70, isFinalized: true }) },
      user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ms. Rao' }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockImplementation((fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    };
    storage = {
      getSignedDownloadUrl: jest.fn().mockImplementation((key: string) => Promise.resolve(`https://signed/${key}`)),
      upload: jest.fn().mockResolvedValue(undefined),
      buildKey: jest.fn().mockImplementation((inst: string, ...parts: string[]) => ['institutes', inst, ...parts].join('/')),
    };
    ai = { enqueueSingle: jest.fn().mockResolvedValue(undefined) };
    analytics = { enqueueMasteryRecalc: jest.fn().mockResolvedValue(undefined) };
    scoreAggregation = { recalculate: jest.fn().mockResolvedValue(undefined) };
    const config = { get: jest.fn().mockImplementation((k: string) => (k === 'PYTHON_SERVICE_URL' ? 'http://py' : undefined)) };
    // resolveMarksAndCriteria is pure — the real implementation, no dependencies needed.
    const evaluations = new EvaluationsService(null as any, null as any, null as any, null as any, null as any, null as any, null as any);
    service = new CheckedCopyService(prisma, storage as any, config as any, ai as any, analytics as any, evaluations, scoreAggregation as any);
    mockedAxios.post.mockReset();
    mockedAxios.post.mockResolvedValue({ data: Buffer.from('%PDF-fake') });
  });

  describe('get', () => {
    it('hides a sheet from another institute as not found', async () => {
      load(attempt([response('r1')], { assessmentDelivery: { id: 'd', status: 'EVALUATING', assessment: { instituteId: 'inst-OTHER', title: 'x', paper: null } } }));
      await expect(service.get('inst-1', 'att-1', teacher)).rejects.toThrow(NotFoundException);
    });

    it('reports where each answer is in the pipeline and numbers questions in paper order', async () => {
      load(attempt(
        [
          response('reviewed', { questionId: 'qA', current: version(EvaluationSource.TEACHER, 4) }),
          response('suggested', { questionId: 'qB', current: version(EvaluationSource.AI, 3) }),
          response('noOcr', { questionId: 'qC', region: region(1, 0.5) }),
          response('illegible', { questionId: 'qD', region: region(2, 0.1, { extractedText: 'xx', confidence: 0.3 }) }),
          response('ready', { questionId: 'qE' }),
          response('mcq', { questionId: 'qF', type: QuestionType.MCQ, region: null }),
        ],
        {
          assessmentDelivery: {
            id: 'd', status: 'EVALUATING',
            assessment: {
              instituteId: 'inst-1', title: 'Unit Test',
              paper: { items: ['qF', 'qE', 'qD', 'qC', 'qB', 'qA'].map((questionId, order) => ({ questionId, order })) },
            },
          },
        },
      ));

      const view = await service.get('inst-1', 'att-1', teacher);

      expect(view.questions.map((q) => [q.number, q.responseId, q.state])).toEqual([
        [1, 'mcq', null],
        [2, 'ready', 'READY_FOR_AI'],
        [3, 'illegible', 'ILLEGIBLE'],
        [4, 'noOcr', 'NEEDS_OCR'],
        [5, 'suggested', 'AI_SUGGESTED'],
        [6, 'reviewed', 'REVIEWED'],
      ]);
      expect(view.status).toBe('DRAFT');
      expect(view.totals).toEqual({ obtained: 7, total: 30 });
    });
  });

  describe('get — stale readings', () => {
    it('shows an answer whose region moved since it was read as "not read yet"', async () => {
      const moved = region(1, 0.1, { extractedText: 'old text', confidence: 0.95 });
      moved.boundingBox = { x: 0.1, y: 0.6, width: 0.8, height: 0.2 }; // resized after the reading
      load(attempt([response('r1', { region: moved })]));

      const view = await service.get('inst-1', 'att-1', teacher);

      expect(view.questions[0]!.state).toBe('NEEDS_OCR');
      expect(view.questions[0]!.studentAnswer).toBeNull();
    });
  });

  describe('runAiCheck', () => {
    it('queues only answers that have been read and not yet checked', async () => {
      load(attempt([
        response('ready'),
        response('noOcr', { region: region(1, 0.5) }),
        response('suggested', { current: version(EvaluationSource.AI, 3) }),
      ]));
      const result = await service.runAiCheck('inst-1', 'att-1', teacher);
      expect(ai.enqueueSingle).toHaveBeenCalledTimes(1);
      expect(ai.enqueueSingle).toHaveBeenCalledWith('inst-1', 'ready', 'teacher-1');
      expect(result).toEqual({ enqueuedCount: 1, needsOcrCount: 1, illegibleCount: 0 });
    });

    it('refuses on a locked assessment', async () => {
      load(attempt([response('ready')], { assessmentDelivery: { id: 'd', status: 'LOCKED', assessment: { instituteId: 'inst-1', title: 'x', paper: null } } }));
      await expect(service.runAiCheck('inst-1', 'att-1', teacher)).rejects.toThrow(ConflictException);
      expect(ai.enqueueSingle).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    const ai3of5 = version(EvaluationSource.AI, 3, {
      mistakeTagType: 'CALCULATION_ERROR',
      gradingBreakdown: { tags: [{ tag: 'FORMULA', maxMarks: 2, marksAwarded: 2 }, { tag: 'CALCULATION', maxMarks: 3, marksAwarded: 1 }] },
    });

    it('refuses a sheet with any answer left out, and writes nothing', async () => {
      load(attempt([response('r1', { current: ai3of5 }), response('r2', { current: version(EvaluationSource.AI, 1) })]));
      await expect(
        service.submit('inst-1', 'att-1', { confirmed: true, items: [{ responseId: 'r1', marksAwarded: 3 }] }, teacher),
      ).rejects.toThrow(/1 answer\(s\) on this sheet have no marks yet/);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('derives the total from the tags and records a TEACHER version carrying them', async () => {
      load(attempt([response('r1', { current: ai3of5, ai: { gradingBreakdown: { modelSolution: 'v = u + at', referenceUsed: false } } })]));

      const result = await service.submit('inst-1', 'att-1', {
        confirmed: true,
        items: [{
          responseId: 'r1',
          tags: [{ tag: 'formula', maxMarks: 2, marksAwarded: 2 }, { tag: 'CALCULATION', maxMarks: 3, marksAwarded: 2 }],
          mistakeTagType: 'CALCULATION_ERROR',
        }],
      }, teacher);

      const written = tx.evaluationVersion.create.mock.calls[0][0].data;
      expect(written.source).toBe(EvaluationSource.TEACHER);
      expect(written.marksAwarded).toBe(4);
      expect(written.previousVersionId).toBe(ai3of5.id);
      expect(written.gradingBreakdown).toMatchObject({
        verdict: 'PARTIALLY_CORRECT',
        tags: [{ tag: 'FORMULA', marksAwarded: 2 }, { tag: 'CALCULATION', marksAwarded: 2 }],
        modelSolution: 'v = u + at',
        referenceUsed: false,
      });
      expect(tx.evaluation.updateMany).toHaveBeenCalledWith({
        where: { id: 'eval-r1', currentEvaluationVersionId: ai3of5.id },
        data: { currentEvaluationVersionId: 'v-new-1', status: EvaluationStatus.TEACHER_REVIEWED },
      });
      expect(scoreAggregation.recalculate).toHaveBeenCalledWith('att-1');
      expect(analytics.enqueueMasteryRecalc).toHaveBeenCalledWith('sp-1', ['topic-r1']);
      expect(result.updatedCount).toBe(1);
      expect(result.scoreRecord).toMatchObject({ obtainedMarks: 7, isFinalized: true });
    });

    it('rejects a tag awarded more than it is worth', async () => {
      load(attempt([response('r1', { current: ai3of5 })]));
      await expect(service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', tags: [{ tag: 'FORMULA', maxMarks: 2, marksAwarded: 3 }] }],
      }, teacher)).rejects.toThrow(BadRequestException);
    });

    it('rejects a total that disagrees with its own tags', async () => {
      load(attempt([response('r1', { current: ai3of5 })]));
      await expect(service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', marksAwarded: 5, tags: [{ tag: 'FORMULA', maxMarks: 2, marksAwarded: 2 }] }],
      }, teacher)).rejects.toThrow(/does not match the tag-wise total/);
    });

    it('rejects marks above what the question is worth', async () => {
      load(attempt([response('r1', { current: ai3of5 })]));
      await expect(service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', marksAwarded: 6 }],
      }, teacher)).rejects.toThrow(/exceeds this response's available marks/);
    });

    it('re-submitting an already approved, unchanged answer writes no new version', async () => {
      const approved = version(EvaluationSource.TEACHER, 4);
      load(attempt([response('r1', { current: approved }), response('r2', { current: ai3of5 })]));
      const result = await service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', marksAwarded: 4 }, { responseId: 'r2', marksAwarded: 3 }],
      }, teacher);
      expect(tx.evaluationVersion.create).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ updatedCount: 1, unchangedCount: 1 });
    });

    it('an AI check committing mid-review rolls the sheet back with a clear conflict', async () => {
      load(attempt([response('r1', { current: ai3of5 })]));
      tx.evaluation.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', marksAwarded: 3 }],
      }, teacher)).rejects.toMatchObject({ response: { code: 'CHECKED_COPY_CHANGED' } });
      expect(scoreAggregation.recalculate).not.toHaveBeenCalled();
    });

    it('a PDF failure after saving does not fail the submit', async () => {
      load(attempt([response('r1', { current: ai3of5 })]));
      mockedAxios.post.mockRejectedValue(new Error('python down'));
      const result = await service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', marksAwarded: 3 }],
      }, teacher);
      expect(result.pdfUrl).toBeNull();
      expect(scoreAggregation.recalculate).toHaveBeenCalled();
    });

    it('refuses on a locked assessment', async () => {
      load(attempt([response('r1', { current: ai3of5 })], { assessmentDelivery: { id: 'd', status: 'LOCKED', assessment: { instituteId: 'inst-1', title: 'x', paper: null } } }));
      await expect(service.submit('inst-1', 'att-1', {
        confirmed: true, items: [{ responseId: 'r1', marksAwarded: 3 }],
      }, teacher)).rejects.toThrow(ConflictException);
    });
  });

  describe('getPdf', () => {
    it('sends every page with its boxed answers and stores a FINAL copy once all answers are reviewed', async () => {
      const reviewed = version(EvaluationSource.TEACHER, 4, {
        gradingBreakdown: { verdict: 'PARTIALLY_CORRECT', tags: [{ tag: 'CONCEPT', maxMarks: 5, marksAwarded: 4 }] },
      });
      load(attempt([response('r1', { current: reviewed, region: { ...region(1, 0.2, { extractedText: 'a', confidence: 0.9 }), pageImage: { id: 'img-1', page: { id: 'page-1', documentId: 'doc-1', pageNumber: 1 } } } })]));

      const result = await service.getPdf('inst-1', 'att-1', teacher);

      const [url, payload] = mockedAxios.post.mock.calls[0] as [string, any];
      expect(url).toBe('http://py/evaluation/checked-copy-pdf');
      expect(payload.status).toBe('FINAL');
      expect(payload.reviewedBy).toBe('Ms. Rao');
      expect(payload.pages).toEqual([
        { pageNumber: 1, imageUrl: 'https://signed/raw/1.jpg', regions: [{ questionNumber: 1, boundingBox: { x: 0.1, y: 0.2, width: 0.8, height: 0.2 } }] },
      ]);
      expect(payload.questions[0]).toMatchObject({ marksAwarded: 4, verdict: 'PARTIALLY_CORRECT', tags: [{ tag: 'CONCEPT', maxMarks: 5, marksAwarded: 4 }] });
      expect(storage.upload).toHaveBeenCalledWith('institutes/inst-1/checked-copies/att-1/final.pdf', expect.any(Buffer), 'application/pdf');
      expect(result).toEqual({ url: 'https://signed/institutes/inst-1/checked-copies/att-1/final.pdf', status: 'FINAL' });
    });
  });
});
