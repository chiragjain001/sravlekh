import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { PermissionsService } from '../permissions/permissions.service';
import { ReportsService } from '../reports/reports.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { AuditAction, UserRole, EvaluationSource, EvaluationStatus, RubricScoringMode, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { DecideEvaluationDto, EvaluationDecision, OverrideEvaluationDto, QueryEvaluationWorkItemsDto } from './dto/evaluation.dto';
import { SCORE_AGGREGATION_QUEUE, ScoreAggregationJobData } from './score-aggregation.constants';
import { NEEDS_HUMAN_EVALUATION_FILTER, needsHumanEvaluation, SUBJECTIVE_QUESTION_TYPES } from './evaluation-status.util';
import { enqueueDeduped, jobKey } from '../infrastructure/queue/enqueue';
import { QUEUE_POLICY } from '../infrastructure/queue/queue-policy';

const REPROCESS_IDEMPOTENCY_TTL_SECONDS = 60 * 60;

/**
 * 25-EVALUATION-ENGINE.md. A Response is never graded in place — every
 * scoring action creates a new, chained EvaluationVersion. Scoped to v2-
 * native Responses only (attemptId set) — v1's exam-grading path
 * (ExamsService.gradeAnswerSheet) is untouched, per this session's standing
 * rule against modifying already-working v1 code. Objective evidence types
 * (DIGITAL_VALUE/OMR_MARK) never enter this pipeline either — those are
 * scored directly at capture time (Phase 8), unchanged from v1's philosophy
 * (25 §4.1's acceptance criteria).
 *
 * SUBJECTIVE_QUESTION_TYPES itself now lives in evaluation-status.util.ts
 * (P1 OPT-1) — it used to be declared separately here and in
 * assessments.service.ts/shared/evaluation-lock-gate.ts; all three now import
 * the one list, since it decides both what the governance gate examines and
 * what the score aggregator trusts.
 */
export const RUBRIC_ADDITIVE_MODES: RubricScoringMode[] = [RubricScoringMode.CRITERION_ADDITIVE, RubricScoringMode.STEP_WISE];

/** A question's rubric with only its current (highest) version loaded, as getEvaluableResponse includes it. */
export type RubricWithCurrentVersion = Prisma.RubricGetPayload<{
  include: { versions: { include: { criteria: true } } };
}>;

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly aiEvaluationService: AiEvaluationService,
    private readonly permissionsService: PermissionsService,
    private readonly reportsService: ReportsService,
    private readonly analyticsService: AnalyticsService,
    @InjectQueue(SCORE_AGGREGATION_QUEUE) private readonly scoreAggregationQueue: Queue<ScoreAggregationJobData>,
  ) {}

  /**
   * 05-API-SPECIFICATION.md (V2 section) §8: "triggers a fresh AIRecommendation
   * ... creates a new chained EvaluationVersion(source=AI) without discarding
   * prior versions." Idempotency-Key required, same CacheService-backed
   * check-and-cache-result pattern as Phase 10's document upload.
   */
  async reprocess(instituteId: string, responseId: string, idempotencyKey: string | undefined, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required for reprocess.');
    }
    const cacheKey = `idempotency:reprocess:${instituteId}:${idempotencyKey}`;
    const cached = await this.cache.get<{ status: string; responseId: string }>(cacheKey);
    if (cached) return cached;

    await this.getEvaluableResponse(instituteId, responseId);
    await this.aiEvaluationService.enqueueSingle(instituteId, responseId, actor.id);
    await this.writeAudit(instituteId, actor.id, responseId, { action: 'reprocess' });

    const result = { status: 'queued', responseId };
    await this.cache.set(cacheKey, result, REPROCESS_IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  async decide(instituteId: string, responseId: string, dto: DecideEvaluationDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const response = await this.getEvaluableResponse(instituteId, responseId);
    const previousVersion = response.evaluation?.currentVersion ?? null;
    const evaluation = response.evaluation ?? (await this.prisma.evaluation.create({ data: { responseId } }));

    let marksAwarded: number;
    let criterionScoresData: Prisma.EvaluationCriterionScoreCreateWithoutEvaluationVersionInput[];

    if (dto.decision === EvaluationDecision.ACCEPT_AI) {
      if (!previousVersion || previousVersion.source !== EvaluationSource.AI) {
        throw new ConflictException('There is no AI suggestion to accept for this response.');
      }
      marksAwarded = previousVersion.marksAwarded;
      criterionScoresData = previousVersion.criterionScores.map((c) => ({
        rubricCriterion: { connect: { id: c.rubricCriterionId } },
        marksAwarded: c.marksAwarded,
        note: c.note,
      }));
    } else {
      ({ marksAwarded, criterionScoresData } = this.resolveMarksAndCriteria(response, dto));
    }

    const newVersion = await this.prisma.evaluationVersion.create({
      data: {
        evaluationId: evaluation.id,
        previousVersionId: previousVersion?.id,
        source: EvaluationSource.TEACHER,
        authorUserId: actor.id,
        marksAwarded,
        mistakeTagType: dto.mistakeTagType,
        teacherComment: dto.teacherComment,
        criterionScores: criterionScoresData.length ? { create: criterionScoresData } : undefined,
      },
      include: { criterionScores: true },
    });

    await this.prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { currentEvaluationVersionId: newVersion.id, status: EvaluationStatus.TEACHER_REVIEWED },
    });

    await this.writeAudit(instituteId, actor.id, responseId, { decision: dto.decision, marksAwarded });
    await enqueueDeduped(this.scoreAggregationQueue, 'recalculate', { attemptId: response.attemptId! }, jobKey('agg', response.attemptId!), { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.scoreAggregation.jobOptions }, this.logger);
    // V2 Analytics/Mastery Integration phase: a TEACHER-sourced EvaluationVersion
    // (every decide() outcome, including ACCEPT_AI — 25 §4.2's "accept as-is is
    // still a real, human-authored version") is exactly the "finalized" point
    // 21-DOMAIN-MODEL-V2.md §4.8 requires mastery to read from. AI-only versions
    // (AiEvaluationService, untouched by this phase) never reach this line.
    await this.analyticsService.enqueueMasteryRecalc(response.attempt!.studentProfileId, [response.question.topicId]);

    return newVersion;
  }

  /**
   * 05-API-SPECIFICATION.md (V2 section) §8 / 25 §4.3 / 31 §4: a second-pass,
   * higher-authority correction. Requires the REVIEW_EVALUATION permission
   * (never implied by ADMIN alone — 21 §4.10), a mandatory disputeReason, and
   * — if the delivery is LOCKED — an unlock must already have happened
   * (mirrors v1's exam-unlock discipline). Triggers the same score-
   * aggregation as decide(), plus a Report reissue for the affected student.
   */
  async override(instituteId: string, responseId: string, dto: OverrideEvaluationDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const response = await this.getEvaluableResponse(instituteId, responseId);

    if (actor.role !== UserRole.FOUNDER) {
      const hasPermission = await this.permissionsService.hasPermission(actor.id, 'REVIEW_EVALUATION', {
        batchId: response.attempt!.assessmentDelivery.batchId,
        subjectId: response.question.subjectId,
      });
      if (!hasPermission) {
        throw new ForbiddenException('Overriding an evaluation requires the REVIEW_EVALUATION permission.');
      }
    }

    if (response.attempt!.assessmentDelivery.status === 'LOCKED') {
      throw new ConflictException({
        code: 'EVALUATION_LOCKED',
        message: 'This delivery is locked — unlock it first before overriding an evaluation.',
      });
    }

    const previousVersion = response.evaluation?.currentVersion ?? null;
    const evaluation = response.evaluation ?? (await this.prisma.evaluation.create({ data: { responseId } }));
    const { marksAwarded, criterionScoresData } = this.resolveMarksAndCriteria(response, dto);

    const newVersion = await this.prisma.evaluationVersion.create({
      data: {
        evaluationId: evaluation.id,
        previousVersionId: previousVersion?.id,
        source: EvaluationSource.REVIEWER,
        authorUserId: actor.id,
        marksAwarded,
        mistakeTagType: dto.mistakeTagType,
        teacherComment: dto.teacherComment,
        disputeReason: dto.disputeReason,
        criterionScores: criterionScoresData.length ? { create: criterionScoresData } : undefined,
      },
      include: { criterionScores: true },
    });

    await this.prisma.evaluation.update({
      where: { id: evaluation.id },
      data: { currentEvaluationVersionId: newVersion.id, status: EvaluationStatus.REVIEWER_FINALIZED },
    });

    await this.writeAudit(instituteId, actor.id, responseId, { action: 'override', marksAwarded, disputeReason: dto.disputeReason });
    await enqueueDeduped(this.scoreAggregationQueue, 'recalculate', { attemptId: response.attemptId! }, jobKey('agg', response.attemptId!), { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.scoreAggregation.jobOptions }, this.logger);
    await this.reportsService.reissueForStudent(instituteId, response.attempt!.studentProfileId, actor.id);
    // Same mastery-recalc trigger as decide() — a REVIEWER-sourced version is
    // equally "finalized" (25 §4.3).
    await this.analyticsService.enqueueMasteryRecalc(response.attempt!.studentProfileId, [response.question.topicId]);

    return newVersion;
  }

  /**
   * Shared by decide() (ADJUST/REJECT_RESCORE), override() and CheckedCopyService.submit()
   * — the criteria-required-vs-holistic branching and validation is identical for all three.
   * Typed structurally (not as getEvaluableResponse's return) so a caller with its own
   * include shape can use it; it reads only these fields.
   */
  resolveMarksAndCriteria(
    response: { marksAvailable: number; question: { rubric: RubricWithCurrentVersion | null } },
    dto: { marksAwarded?: number; criterionScores?: { rubricCriterionId: string; marksAwarded: number; note?: string }[]; teacherComment?: string },
  ): { marksAwarded: number; criterionScoresData: Prisma.EvaluationCriterionScoreCreateWithoutEvaluationVersionInput[] } {
    const rubric = response.question.rubric;
    const currentRubricVersion = rubric?.versions[0];
    const usesCriteria = !!currentRubricVersion && RUBRIC_ADDITIVE_MODES.includes(rubric!.scoringMode);

    if (usesCriteria) {
      if (!dto.criterionScores || dto.criterionScores.length === 0) {
        throw new BadRequestException('criterionScores is required for a rubric-scored (CRITERION_ADDITIVE/STEP_WISE) response.');
      }
      const criteriaById = new Map(currentRubricVersion!.criteria.map((c) => [c.id, c]));
      let sum = 0;
      for (const cs of dto.criterionScores) {
        const criterion = criteriaById.get(cs.rubricCriterionId);
        if (!criterion) throw new BadRequestException(`Criterion ${cs.rubricCriterionId} does not belong to this question's current rubric version.`);
        if (cs.marksAwarded < 0 || cs.marksAwarded > criterion.maxMarks) {
          throw new BadRequestException(`Criterion "${criterion.description}" allows 0–${criterion.maxMarks} marks; got ${cs.marksAwarded}.`);
        }
        // 26 §4.2: STEP_WISE — a criterion can't be awarded marks if its
        // dependency scored zero, unless the override is explicitly documented.
        if (rubric!.scoringMode === RubricScoringMode.STEP_WISE && criterion.dependsOnCriterionId && cs.marksAwarded > 0) {
          const dependencyScore = dto.criterionScores.find((d) => d.rubricCriterionId === criterion.dependsOnCriterionId);
          if ((dependencyScore?.marksAwarded ?? 0) === 0 && !dto.teacherComment) {
            throw new BadRequestException(
              `Criterion "${criterion.description}" depends on a criterion that scored 0 — award marks here only with a documented override (teacherComment).`,
            );
          }
        }
        sum += cs.marksAwarded;
      }
      // Capped at the response's own marksAvailable, not rubric.maxMarks — a rubric
      // reused across questions (or a question edited after its rubric was authored)
      // can legitimately carry a higher maxMarks than this response actually offers.
      const marksAwarded = Math.min(sum, response.marksAvailable);
      const criterionScoresData = dto.criterionScores.map((cs) => ({
        rubricCriterion: { connect: { id: cs.rubricCriterionId } },
        marksAwarded: cs.marksAwarded,
        note: cs.note,
      }));
      return { marksAwarded, criterionScoresData };
    }

    if (dto.criterionScores?.length) {
      throw new BadRequestException('This response has no additive rubric — criterionScores is not applicable; provide marksAwarded directly.');
    }
    if (dto.marksAwarded === undefined) {
      throw new BadRequestException('marksAwarded is required.');
    }
    if (dto.marksAwarded > response.marksAvailable) {
      throw new BadRequestException(`marksAwarded (${dto.marksAwarded}) exceeds this response's available marks (${response.marksAvailable}).`);
    }
    return { marksAwarded: dto.marksAwarded, criterionScoresData: [] };
  }

  async getHistory(instituteId: string, responseId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.getEvaluableResponse(instituteId, responseId);

    const evaluation = await this.prisma.evaluation.findUnique({ where: { responseId } });
    if (!evaluation) return { data: [] };

    const versions = await this.prisma.evaluationVersion.findMany({
      where: { evaluationId: evaluation.id },
      orderBy: { createdAt: 'asc' },
      include: { criterionScores: true },
    });

    return { data: versions };
  }

  async getWorkItems(instituteId: string, query: QueryEvaluationWorkItemsDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // 25 §7: prioritizes AI-flagged-low-confidence first. A response can only
    // carry an AI flag once it has an AI-suggested evaluation, so an aiFlag
    // filter narrows eligibility to AI_SUGGESTED + a matching flag, rather
    // than OR-ing with the null/PENDING branches (Phase 12 left this filter
    // honestly empty since no AIRecommendation existed yet — Phase 13 makes
    // it real).
    const eligibility: Prisma.ResponseWhereInput[] = query.includeDecided
      ? [{ evaluation: { status: { in: [EvaluationStatus.TEACHER_REVIEWED, EvaluationStatus.REVIEWER_FINALIZED] } } }]
      : query.aiFlag
      ? [{ evaluation: { status: EvaluationStatus.AI_SUGGESTED, currentVersion: { aiRecommendation: { flags: { has: query.aiFlag } } } } }]
      : [{ evaluation: null }, { evaluation: { status: { in: [EvaluationStatus.PENDING, EvaluationStatus.AI_SUGGESTED] } } }];

    const where: Prisma.ResponseWhereInput = {
      attemptId: { not: null },
      // Subjective questions anywhere, plus anything handwritten on a page —
      // a numerical worked out in a booklet needs a human too.
      AND: [NEEDS_HUMAN_EVALUATION_FILTER, { OR: eligibility }],
      ...(query.subjectId && { question: { is: { subjectId: query.subjectId } } }),
      attempt: {
        assessmentDelivery: {
          assessment: { instituteId },
          ...(query.batchId && { batchId: query.batchId }),
        },
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.response.findMany({
        where,
        include: {
          question: { select: { id: true, content: true, marks: true, subjectId: true } },
          evaluation: { include: { currentVersion: { include: { aiRecommendation: true } } } },
          attempt: {
            select: {
              studentProfile: { select: { rollNumber: true, user: { select: { name: true } } } },
              assessmentDelivery: { select: { batchId: true, assessment: { select: { title: true } } } },
            },
          },
          // Doc 28 §2: "source image always co-presented, never transcript-
          // only" — the frontend needs a documentId/pageId to fetch the signed
          // image URL (GET .../documents/:id/pages/:id/image) and the latest
          // OCR transcript+confidence, for evidenceType=PAGE_REGION responses.
          // Purely additive read data — no new write path, no duplicated logic.
          questionRegion: {
            select: {
              id: true,
              boundingBox: true,
              pageImage: {
                select: {
                  id: true,
                  page: { select: { id: true, documentId: true, pageNumber: true } },
                },
              },
              ocrBlocks: {
                select: {
                  results: { orderBy: { processedAt: 'desc' }, take: 1 },
                },
              },
            },
          },
        },
        // 25 §7's full priority ordering (AI-flagged-low-confidence first) isn't
        // implemented — oldest-submitted-first only. A real, bounded future
        // refinement, not attempted here to avoid a complex computed sort.
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.response.count({ where }),
    ]);

    return { data: items, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getEvaluableResponse(instituteId: string, responseId: string) {
    const response = await this.prisma.response.findUnique({
      where: { id: responseId },
      include: {
        attempt: { include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } } },
        question: {
          include: {
            rubric: { include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { criteria: true } } } },
          },
        },
        evaluation: { include: { currentVersion: { include: { criterionScores: true } } } },
      },
    });

    if (!response || !response.attemptId || response.attempt?.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Response not found');
    }
    if (!needsHumanEvaluation(response)) {
      throw new BadRequestException(
        'Only subjective answers, or answers handwritten on a scanned page, go through evaluation — objective responses captured digitally are scored at capture.',
      );
    }

    return response;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, responseId: string, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action: AuditAction.UPDATE, entity: 'evaluations', entityId: responseId, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for evaluations:${responseId}`, err as Error);
    }
  }
}
