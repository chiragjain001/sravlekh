import {
  Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException, ConflictException, BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuditAction, EvaluationSource, EvaluationStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { EvaluationsService, RUBRIC_ADDITIVE_MODES } from './evaluations.service';
import { ScoreAggregationService } from './score-aggregation.service';
import { needsHumanEvaluation, isHumanApproved } from './evaluation-status.util';
import { CheckedCopyItemDto, SubmitCheckedCopyDto, Verdict } from './dto/checked-copy.dto';
import { ensureDiagnosableMessage } from '../shared/logging/error-message';
import { sameBox } from '../shared/region-box';

/**
 * Mirrors api-python's OCR_ILLEGIBLE_CONFIDENCE_THRESHOLD (ai_evaluator.py): below it
 * the AI refuses to grade, so the sheet shows the answer as "mark it yourself" rather
 * than offering an AI check that would only skip. Change one, change the other.
 */
const OCR_ILLEGIBLE_CONFIDENCE = 0.5;
const MARKS_EPSILON = 0.001;
const SIGNED_URL_TTL_SECONDS = 600;
const PDF_RENDER_TIMEOUT_MS = 120_000;

/** Raised inside the submit transaction when a pointer moved under it; see writeVersions(). */
class StaleSheetError extends Error {}

/** Where a subjective answer is in the check pipeline, for the review screen. */
export type AnswerState = 'NEEDS_OCR' | 'ILLEGIBLE' | 'READY_FOR_AI' | 'AI_SUGGESTED' | 'REVIEWED';

export interface TagMark { tag: string; maxMarks: number; marksAwarded: number; note?: string | null }

/** Shape of EvaluationVersion/AIRecommendation.gradingBreakdown (written by api-python and by submit()). */
export interface GradingBreakdown {
  verdict?: Verdict | null;
  mistakeTag?: string | null;
  tags?: TagMark[];
  note?: string | null;
  modelSolution?: string | null;
  referenceUsed?: boolean;
}

type LoadedAttempt = NonNullable<Awaited<ReturnType<CheckedCopyService['loadAttempt']>>>;
type LoadedResponse = LoadedAttempt['responses'][number];

/**
 * One student's answer sheet as a single reviewable unit — the "checked copy".
 *
 * The per-response evaluation engine (EvaluationsService) is unchanged underneath:
 * AI suggestions are still AI-sourced EvaluationVersions that count for nothing
 * (32-AI-GOVERNANCE-POLICY.md §2), and submit() approves the whole sheet by writing
 * one TEACHER-sourced version per answer, exactly what decide() would write one at a
 * time. What this adds is the sheet-level view, the all-or-nothing submit, and the
 * annotated PDF.
 */
@Injectable()
export class CheckedCopyService {
  private readonly logger = new Logger(CheckedCopyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly aiEvaluationService: AiEvaluationService,
    private readonly analyticsService: AnalyticsService,
    private readonly evaluationsService: EvaluationsService,
    private readonly scoreAggregation: ScoreAggregationService,
  ) {}

  // ── Read ────────────────────────────────────────────────────────────────

  async get(instituteId: string, attemptId: string, actor: AuthenticatedUser) {
    const attempt = await this.getAttemptForInstitute(instituteId, attemptId, actor);
    return this.buildView(attempt);
  }

  // ── AI check ────────────────────────────────────────────────────────────

  /** Queues an AI check for every answer that is ready for one. Answers already suggested or reviewed are left alone. */
  async runAiCheck(instituteId: string, attemptId: string, actor: AuthenticatedUser) {
    const attempt = await this.getAttemptForInstitute(instituteId, attemptId, actor);
    this.assertNotLocked(attempt);

    const ready = attempt.responses.filter((r) => this.isSubjective(r) && this.stateOf(r) === 'READY_FOR_AI');
    for (const r of ready) {
      await this.aiEvaluationService.enqueueSingle(instituteId, r.id, actor.id);
    }
    const subjective = attempt.responses.filter((r) => this.isSubjective(r));
    return {
      enqueuedCount: ready.length,
      needsOcrCount: subjective.filter((r) => this.stateOf(r) === 'NEEDS_OCR').length,
      illegibleCount: subjective.filter((r) => this.stateOf(r) === 'ILLEGIBLE').length,
    };
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  async submit(instituteId: string, attemptId: string, dto: SubmitCheckedCopyDto, actor: AuthenticatedUser) {
    const attempt = await this.getAttemptForInstitute(instituteId, attemptId, actor);
    this.assertNotLocked(attempt);

    const subjective = attempt.responses.filter((r) => this.isSubjective(r));
    if (subjective.length === 0) {
      throw new BadRequestException('This answer sheet has no subjective answers to check.');
    }
    const itemsById = new Map(dto.items.map((i) => [i.responseId, i]));
    if (itemsById.size !== dto.items.length) {
      throw new BadRequestException('Each answer can appear only once in a submission.');
    }
    const byId = new Map(subjective.map((r) => [r.id, r]));
    const unknown = dto.items.filter((i) => !byId.has(i.responseId));
    if (unknown.length) {
      throw new BadRequestException(`${unknown.length} submitted answer(s) do not belong to this sheet.`);
    }
    const missing = subjective.filter((r) => !itemsById.has(r.id));
    if (missing.length) {
      throw new BadRequestException(`${missing.length} answer(s) on this sheet have no marks yet — mark every answer before submitting.`);
    }

    // Validate and resolve everything before writing anything.
    const planned = subjective.map((response) => {
      const item = itemsById.get(response.id)!;
      const resolved = this.resolveItem(response, item);
      const current = response.evaluation?.currentVersion ?? null;
      const unchanged = !!current && isHumanApproved(current) && this.sameAsVersion(current, resolved);
      const acceptsAi = !!current && current.source === EvaluationSource.AI && this.sameAsVersion(current, resolved);
      return { response, resolved, unchanged, acceptsAi };
    });
    const toWrite = planned.filter((p) => !p.unchanged);

    // All or nothing: a half-submitted sheet would leave the student's total
    // counting some answers and silently not others.
    try {
      await this.prisma.$transaction(async (tx) => this.writeVersions(tx, toWrite, actor));
    } catch (err) {
      const raced = err instanceof StaleSheetError
        || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002');
      if (raced) {
        throw new ConflictException({
          code: 'CHECKED_COPY_CHANGED',
          message: 'An AI check finished on this sheet while you were reviewing it. Reload the sheet and submit again — nothing was saved.',
        });
      }
      throw err;
    }

    await this.writeAudit(instituteId, actor.id, attemptId, planned.map((p) => ({
      responseId: p.response.id,
      decision: p.unchanged ? 'UNCHANGED' : p.acceptsAi ? 'ACCEPT_AI' : 'ADJUST',
      marksAwarded: p.resolved.marksAwarded,
    })));

    // Synchronous, not queued: the teacher just pressed Submit and should see the
    // student's total move now. Same computation the queued job runs.
    await this.scoreAggregation.recalculate(attemptId);
    const topicIds = [...new Set(toWrite.map((p) => p.response.question.topicId))];
    await this.analyticsService.enqueueMasteryRecalc(attempt.studentProfileId, topicIds);

    const scoreRecord = await this.prisma.scoreRecord.findUnique({ where: { attemptId } });

    let pdfUrl: string | null = null;
    try {
      pdfUrl = (await this.renderAndStorePdf(instituteId, attemptId)).url;
    } catch (err) {
      // The marks are saved; a PDF failure (Python service down, a scan missing)
      // must not make the teacher think the submit failed. They can re-download.
      this.logger.warn(`Checked-copy PDF failed after submit for attempt ${attemptId}`, err as Error);
    }

    return {
      updatedCount: toWrite.length,
      unchangedCount: planned.length - toWrite.length,
      scoreRecord,
      pdfUrl,
    };
  }

  /**
   * Compare-and-swap on each Evaluation's current-version pointer, the same guard
   * ai_evaluator.py uses: if an AI check committed after this sheet was loaded, the
   * teacher approved marks they never saw, and chaining off the stale pointer would
   * fork the version history. Throwing rolls the whole sheet back.
   */
  private async writeVersions(
    tx: Prisma.TransactionClient,
    toWrite: { response: LoadedResponse; resolved: ReturnType<CheckedCopyService['resolveItem']> }[],
    actor: AuthenticatedUser,
  ) {
    for (const { response, resolved } of toWrite) {
      const expectedCurrentId = response.evaluation?.currentEvaluationVersionId ?? null;
      const evaluation = response.evaluation ?? (await tx.evaluation.create({ data: { responseId: response.id } }));
      const version = await tx.evaluationVersion.create({
        data: {
          evaluationId: evaluation.id,
          previousVersionId: expectedCurrentId,
          source: EvaluationSource.TEACHER,
          authorUserId: actor.id,
          marksAwarded: resolved.marksAwarded,
          mistakeTagType: resolved.mistakeTagType,
          teacherComment: resolved.teacherComment,
          gradingBreakdown: resolved.breakdown as unknown as Prisma.InputJsonValue,
          criterionScores: resolved.criterionScoresData.length ? { create: resolved.criterionScoresData } : undefined,
        },
      });
      const claimed = await tx.evaluation.updateMany({
        where: { id: evaluation.id, currentEvaluationVersionId: expectedCurrentId },
        data: { currentEvaluationVersionId: version.id, status: EvaluationStatus.TEACHER_REVIEWED },
      });
      if (claimed.count !== 1) throw new StaleSheetError();
    }
  }

  // ── PDF ─────────────────────────────────────────────────────────────────

  async getPdf(instituteId: string, attemptId: string, actor: AuthenticatedUser) {
    await this.getAttemptForInstitute(instituteId, attemptId, actor);
    return this.renderAndStorePdf(instituteId, attemptId);
  }

  private async renderAndStorePdf(instituteId: string, attemptId: string): Promise<{ url: string; status: 'DRAFT' | 'FINAL' }> {
    const attempt = await this.loadAttempt(attemptId);
    if (!attempt) throw new NotFoundException('Answer sheet not found');
    const view = await this.buildView(attempt);

    const pages = [];
    for (const document of attempt.documents) {
      for (const page of document.pages) {
        const image = page.images[0];
        if (!image) continue;
        const regions = view.questions
          .filter((q) => q.region?.pageImageId === image.id)
          .map((q) => ({ questionNumber: q.number, boundingBox: q.region!.boundingBox }));
        pages.push({
          pageNumber: page.pageNumber,
          imageUrl: await this.storage.getSignedDownloadUrl(image.processedImageUrl ?? image.rawImageUrl, SIGNED_URL_TTL_SECONDS),
          regions,
        });
      }
    }

    const payload = {
      title: view.assessment.title,
      studentName: view.student.name,
      rollNumber: view.student.rollNumber,
      status: view.status,
      reviewedBy: view.reviewedBy?.name ?? null,
      reviewedAt: view.reviewedBy?.at ? new Date(view.reviewedBy.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
      obtainedMarks: view.totals.obtained,
      totalMarks: view.totals.total,
      questions: view.questions.map((q) => ({
        questionNumber: q.number,
        questionText: q.content.slice(0, 200),
        maxMarks: q.marksAvailable,
        marksAwarded: q.current?.marksAwarded ?? null,
        verdict: q.current?.breakdown?.verdict ?? null,
        tags: (q.current?.breakdown?.tags ?? []).map((t) => ({ tag: t.tag, maxMarks: t.maxMarks, marksAwarded: t.marksAwarded })),
        mistakeTag: q.current?.mistakeTagType ?? null,
        comment: q.current?.teacherComment ?? null,
      })),
      pages: pages.sort((a, b) => a.pageNumber - b.pageNumber),
    };

    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    let pdf: Buffer;
    try {
      const res = await axios.post(`${baseUrl}/evaluation/checked-copy-pdf`, payload, {
        headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined,
        responseType: 'arraybuffer',
        timeout: PDF_RENDER_TIMEOUT_MS,
      });
      pdf = Buffer.from(res.data);
    } catch (err) {
      this.logger.warn(`Checked-copy PDF render failed for attempt ${attemptId}`, ensureDiagnosableMessage(err));
      throw new BadGatewayException('Could not generate the checked copy PDF right now. The marks are unaffected — try again shortly.');
    }

    // One stored copy per state: the draft is overwritten on every download, the
    // final copy on every (re-)submit — so storage always holds the latest of each.
    const key = this.storage.buildKey(instituteId, 'checked-copies', attemptId, `${view.status.toLowerCase()}.pdf`);
    await this.storage.upload(key, pdf, 'application/pdf');
    return { url: await this.storage.getSignedDownloadUrl(key, SIGNED_URL_TTL_SECONDS), status: view.status };
  }

  // ── View assembly ───────────────────────────────────────────────────────

  private async buildView(attempt: LoadedAttempt) {
    const order = new Map((attempt.assessmentDelivery.assessment.paper?.items ?? []).map((i) => [i.questionId, i.order]));
    // Paper order when the assessment has a paper; otherwise page, then top-to-bottom.
    const sorted = [...attempt.responses].sort((a, b) => {
      const oa = order.get(a.questionId);
      const ob = order.get(b.questionId);
      if (oa !== undefined && ob !== undefined) return oa - ob;
      if (oa !== undefined) return -1;
      if (ob !== undefined) return 1;
      const pa = a.questionRegion?.pageImage.page.pageNumber ?? Number.MAX_SAFE_INTEGER;
      const pb = b.questionRegion?.pageImage.page.pageNumber ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      return (this.box(a)?.y ?? 0) - (this.box(b)?.y ?? 0);
    });

    const questions = sorted.map((r, index) => {
      const subjective = this.isSubjective(r);
      const current = r.evaluation?.currentVersion ?? null;
      const ai = r.aiRecommendations[0] ?? null;
      const ocr = this.latestOcr(r);
      const rubricVersion = r.question.rubric?.versions[0];
      const usesCriteria = !!rubricVersion && RUBRIC_ADDITIVE_MODES.includes(r.question.rubric!.scoringMode);
      return {
        responseId: r.id,
        questionId: r.questionId,
        number: index + 1,
        content: r.question.content,
        type: r.question.type,
        marksAvailable: r.marksAvailable,
        subjective,
        state: subjective ? this.stateOf(r) : null,
        studentAnswer: ocr?.extractedText ?? r.studentAnswer ?? null,
        ocrConfidence: ocr?.confidence ?? null,
        region: r.questionRegion
          ? {
              documentId: r.questionRegion.pageImage.page.documentId,
              pageId: r.questionRegion.pageImage.page.id,
              pageNumber: r.questionRegion.pageImage.page.pageNumber,
              pageImageId: r.questionRegion.pageImage.id,
              boundingBox: this.box(r)!,
            }
          : null,
        rubricCriteria: usesCriteria ? rubricVersion!.criteria.map((c) => ({ id: c.id, description: c.description, maxMarks: c.maxMarks })) : null,
        current: current
          ? {
              source: current.source,
              marksAwarded: current.marksAwarded,
              mistakeTagType: current.mistakeTagType,
              teacherComment: current.teacherComment,
              breakdown: (current.gradingBreakdown as GradingBreakdown | null) ?? (ai && current.aiRecommendationId === ai.id ? (ai.gradingBreakdown as GradingBreakdown | null) : null),
              criterionScores: current.criterionScores.map((c) => ({ rubricCriterionId: c.rubricCriterionId, marksAwarded: c.marksAwarded, note: c.note })),
            }
          : subjective
            ? null
            // Objective answers are scored at capture and never get an Evaluation.
            : { source: null, marksAwarded: r.marksAwarded, mistakeTagType: null, teacherComment: null, breakdown: null, criterionScores: [] },
        ai: ai
          ? {
              suggestedMarks: ai.suggestedMarks,
              confidence: ai.confidence,
              flags: ai.flags,
              breakdown: ai.gradingBreakdown as GradingBreakdown | null,
            }
          : null,
      };
    });

    const subjective = questions.filter((q) => q.subjective);
    const finalized = subjective.length > 0 && subjective.every((q) => q.state === 'REVIEWED');

    // The most recent human version on the sheet names the reviewer.
    let reviewedBy: { name: string; at: Date } | null = null;
    if (finalized) {
      const latest = attempt.responses
        .map((r) => r.evaluation?.currentVersion)
        .filter((v): v is NonNullable<typeof v> => !!v && isHumanApproved(v))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      if (latest?.authorUserId) {
        const author = await this.prisma.user.findUnique({ where: { id: latest.authorUserId }, select: { name: true } });
        reviewedBy = { name: author?.name ?? 'Teacher', at: latest.createdAt };
      }
    }

    return {
      attemptId: attempt.id,
      status: (finalized ? 'FINAL' : 'DRAFT') as 'DRAFT' | 'FINAL',
      reviewedBy,
      assessment: { title: attempt.assessmentDelivery.assessment.title },
      delivery: { id: attempt.assessmentDelivery.id, status: attempt.assessmentDelivery.status },
      student: {
        id: attempt.studentProfile.id,
        name: attempt.studentProfile.user.name,
        rollNumber: attempt.studentProfile.rollNumber,
      },
      totals: {
        // What the sheet currently shows (AI suggestions included) — not the
        // official score; that is scoreRecord, which counts approved marks only.
        obtained: questions.reduce((sum, q) => sum + (q.current?.marksAwarded ?? 0), 0),
        total: questions.reduce((sum, q) => sum + q.marksAvailable, 0),
      },
      counts: {
        subjective: subjective.length,
        reviewed: subjective.filter((q) => q.state === 'REVIEWED').length,
        aiSuggested: subjective.filter((q) => q.state === 'AI_SUGGESTED').length,
        readyForAi: subjective.filter((q) => q.state === 'READY_FOR_AI').length,
        needsOcr: subjective.filter((q) => q.state === 'NEEDS_OCR').length,
        illegible: subjective.filter((q) => q.state === 'ILLEGIBLE').length,
      },
      scoreRecord: attempt.scoreRecord
        ? {
            obtainedMarks: attempt.scoreRecord.obtainedMarks,
            totalMarks: attempt.scoreRecord.totalMarks,
            percentage: attempt.scoreRecord.percentage,
            isFinalized: attempt.scoreRecord.isFinalized,
          }
        : null,
      questions,
    };
  }

  // ── Submission item resolution ──────────────────────────────────────────

  private resolveItem(response: LoadedResponse, item: CheckedCopyItemDto) {
    const rubric = response.question.rubric;
    const usesCriteria = !!rubric?.versions[0] && RUBRIC_ADDITIVE_MODES.includes(rubric.scoringMode);
    const label = `Q (${response.question.content.slice(0, 40)}…)`;

    let tags: TagMark[] = [];
    let dtoForMarks: { marksAwarded?: number; criterionScores?: CheckedCopyItemDto['criterionScores']; teacherComment?: string } = item;
    if (!usesCriteria && item.tags?.length) {
      for (const t of item.tags) {
        if (t.marksAwarded > t.maxMarks + MARKS_EPSILON) {
          throw new BadRequestException(`${label}: "${t.tag}" allows 0–${t.maxMarks} marks; got ${t.marksAwarded}.`);
        }
      }
      tags = item.tags.map((t) => ({ tag: t.tag.trim().toUpperCase().replace(/\s+/g, '_'), maxMarks: t.maxMarks, marksAwarded: t.marksAwarded, note: t.note ?? null }));
      const sum = tags.reduce((s, t) => s + t.marksAwarded, 0);
      if (item.marksAwarded !== undefined && Math.abs(item.marksAwarded - sum) > MARKS_EPSILON) {
        throw new BadRequestException(`${label}: marksAwarded (${item.marksAwarded}) does not match the tag-wise total (${sum}).`);
      }
      dtoForMarks = { ...item, marksAwarded: sum, criterionScores: undefined };
    }

    let resolved: ReturnType<EvaluationsService['resolveMarksAndCriteria']>;
    try {
      resolved = this.evaluationsService.resolveMarksAndCriteria(response, dtoForMarks);
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw new BadRequestException(`${label}: ${(err.getResponse() as { message?: string }).message ?? err.message}`);
      }
      throw err;
    }

    const aiBreakdown = (response.aiRecommendations[0]?.gradingBreakdown as GradingBreakdown | null) ?? null;
    const breakdown: GradingBreakdown = {
      verdict: item.verdict ?? this.deriveVerdict(resolved.marksAwarded, response.marksAvailable, aiBreakdown?.verdict),
      mistakeTag: item.mistakeTagType ?? null,
      tags,
      note: item.teacherComment ?? null,
      // Kept so the final copy still shows what the AI's own solution was.
      modelSolution: aiBreakdown?.modelSolution ?? null,
      referenceUsed: aiBreakdown?.referenceUsed,
    };

    return {
      marksAwarded: resolved.marksAwarded,
      criterionScoresData: resolved.criterionScoresData,
      mistakeTagType: item.mistakeTagType ?? null,
      teacherComment: item.teacherComment?.trim() || null,
      breakdown,
      tags,
      criterionScores: item.criterionScores ?? [],
    };
  }

  private deriveVerdict(marks: number, max: number, aiVerdict?: Verdict | null): Verdict {
    if (marks >= max - MARKS_EPSILON) return 'CORRECT';
    if (marks <= MARKS_EPSILON) return aiVerdict === 'NOT_ATTEMPTED' ? 'NOT_ATTEMPTED' : 'INCORRECT';
    return 'PARTIALLY_CORRECT';
  }

  /** Whether writing `resolved` would record nothing new over `version`. */
  private sameAsVersion(
    version: NonNullable<NonNullable<LoadedResponse['evaluation']>['currentVersion']>,
    resolved: ReturnType<CheckedCopyService['resolveItem']>,
  ): boolean {
    if (Math.abs(version.marksAwarded - resolved.marksAwarded) > MARKS_EPSILON) return false;
    if ((version.mistakeTagType ?? null) !== resolved.mistakeTagType) return false;
    if ((version.teacherComment ?? null) !== resolved.teacherComment) return false;
    const before = ((version.gradingBreakdown as GradingBreakdown | null)?.tags ?? []).map((t) => `${t.tag}:${t.marksAwarded}/${t.maxMarks}`);
    const after = resolved.tags.map((t) => `${t.tag}:${t.marksAwarded}/${t.maxMarks}`);
    // An AI version keeps its tags on the AIRecommendation too; either copy is fine to compare against.
    if (before.length && before.join('|') !== after.join('|')) return false;
    const critBefore = version.criterionScores.map((c) => `${c.rubricCriterionId}:${c.marksAwarded}`).sort().join('|');
    const critAfter = resolved.criterionScores.map((c) => `${c.rubricCriterionId}:${c.marksAwarded}`).sort().join('|');
    return critBefore === critAfter;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /** Needs a teacher's mark: a subjective question, or anything handwritten on a page. */
  private isSubjective(r: LoadedResponse): boolean {
    return needsHumanEvaluation(r);
  }

  /**
   * The latest reading of the region AS IT IS NOW. Blocks recorded against a
   * different box were read before the teacher moved or resized the region, so
   * their text belongs to another part of the page (see shared/region-box.ts).
   */
  private latestOcr(r: LoadedResponse) {
    const region = r.questionRegion;
    if (!region) return null;
    return (
      region.ocrBlocks
        .filter((b) => sameBox(b.boundingBox, region.boundingBox))
        .flatMap((b) => b.results)
        .sort((a, b) => b.processedAt.getTime() - a.processedAt.getTime())[0] ?? null
    );
  }

  private box(r: LoadedResponse): { x: number; y: number; width: number; height: number } | null {
    return (r.questionRegion?.boundingBox as { x: number; y: number; width: number; height: number } | undefined) ?? null;
  }

  private stateOf(r: LoadedResponse): AnswerState {
    const current = r.evaluation?.currentVersion;
    if (current && isHumanApproved(current)) return 'REVIEWED';
    if (current?.source === EvaluationSource.AI) return 'AI_SUGGESTED';
    if (r.evidenceType === 'PAGE_REGION') {
      const ocr = this.latestOcr(r);
      if (!ocr) return 'NEEDS_OCR';
      if (ocr.requiresVisualEvaluation || !ocr.extractedText || ocr.confidence < OCR_ILLEGIBLE_CONFIDENCE) return 'ILLEGIBLE';
    }
    return 'READY_FOR_AI';
  }

  private assertNotLocked(attempt: LoadedAttempt) {
    if (attempt.assessmentDelivery.status === 'LOCKED') {
      throw new ConflictException({
        code: 'EVALUATION_LOCKED',
        message: 'This assessment is locked — an admin must unlock it before marks can change.',
      });
    }
  }

  private async getAttemptForInstitute(instituteId: string, attemptId: string, actor: AuthenticatedUser): Promise<LoadedAttempt> {
    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
    const attempt = await this.loadAttempt(attemptId);
    if (!attempt || attempt.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Answer sheet not found');
    }
    return attempt;
  }

  private loadAttempt(attemptId: string) {
    return this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        studentProfile: { select: { id: true, rollNumber: true, user: { select: { name: true } } } },
        scoreRecord: true,
        assessmentDelivery: {
          include: {
            assessment: {
              select: { instituteId: true, title: true, paper: { select: { items: { select: { questionId: true, order: true } } } } },
            },
          },
        },
        documents: {
          include: { pages: { orderBy: { pageNumber: 'asc' }, include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } } } },
        },
        responses: {
          include: {
            question: {
              select: {
                id: true, content: true, type: true, marks: true, topicId: true,
                rubric: { include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { criteria: true } } } },
              },
            },
            evaluation: { include: { currentVersion: { include: { criterionScores: true } } } },
            aiRecommendations: { orderBy: { createdAt: 'desc' }, take: 1 },
            questionRegion: {
              select: {
                id: true,
                boundingBox: true,
                pageImage: { select: { id: true, page: { select: { id: true, documentId: true, pageNumber: true } } } },
                ocrBlocks: { select: { boundingBox: true, results: { orderBy: { processedAt: 'desc' }, take: 1 } } },
              },
            },
          },
        },
      },
    });
  }

  private async writeAudit(instituteId: string, actorId: string, attemptId: string, decisions: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId, actorId, action: AuditAction.UPDATE, entity: 'attempts', entityId: attemptId,
          newValue: { action: 'checked_copy_submitted', decisions } as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for attempts:${attemptId}`, err as Error);
    }
  }
}
