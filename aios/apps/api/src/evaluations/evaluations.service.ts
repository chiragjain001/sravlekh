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
import { AuditAction, UserRole, QuestionType, EvaluationSource, EvaluationStatus, RubricScoringMode, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { DecideEvaluationDto, EvaluationDecision, QueryEvaluationWorkItemsDto } from './dto/evaluation.dto';
import { SCORE_AGGREGATION_QUEUE, ScoreAggregationJobData } from './score-aggregation.constants';

/**
 * 25-EVALUATION-ENGINE.md. A Response is never graded in place — every
 * scoring action creates a new, chained EvaluationVersion. Scoped to v2-
 * native Responses only (attemptId set) — v1's exam-grading path
 * (ExamsService.gradeAnswerSheet) is untouched, per this session's standing
 * rule against modifying already-working v1 code. Objective evidence types
 * (DIGITAL_VALUE/OMR_MARK) never enter this pipeline either — those are
 * scored directly at capture time (Phase 8), unchanged from v1's philosophy
 * (25 §4.1's acceptance criteria).
 */
const SUBJECTIVE_QUESTION_TYPES: QuestionType[] = [QuestionType.SHORT_ANSWER, QuestionType.LONG_ANSWER, QuestionType.PASSAGE_BASED];
const RUBRIC_ADDITIVE_MODES: RubricScoringMode[] = [RubricScoringMode.CRITERION_ADDITIVE, RubricScoringMode.STEP_WISE];

@Injectable()
export class EvaluationsService {
  private readonly logger = new Logger(EvaluationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCORE_AGGREGATION_QUEUE) private readonly scoreAggregationQueue: Queue<ScoreAggregationJobData>,
  ) {}

  async decide(instituteId: string, responseId: string, dto: DecideEvaluationDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const response = await this.getEvaluableResponse(instituteId, responseId);
    const previousVersion = response.evaluation?.currentVersion ?? null;
    const evaluation = response.evaluation ?? (await this.prisma.evaluation.create({ data: { responseId } }));

    const rubric = response.question.rubric;
    const currentRubricVersion = rubric?.versions[0];
    const usesCriteria = !!currentRubricVersion && RUBRIC_ADDITIVE_MODES.includes(rubric!.scoringMode);

    let marksAwarded: number;
    let criterionScoresData: Prisma.EvaluationCriterionScoreCreateWithoutEvaluationVersionInput[] = [];

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
    } else if (usesCriteria) {
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
      marksAwarded = Math.min(sum, rubric!.maxMarks);
      criterionScoresData = dto.criterionScores.map((cs) => ({
        rubricCriterion: { connect: { id: cs.rubricCriterionId } },
        marksAwarded: cs.marksAwarded,
        note: cs.note,
      }));
    } else {
      if (dto.criterionScores?.length) {
        throw new BadRequestException('This response has no additive rubric — criterionScores is not applicable; provide marksAwarded directly.');
      }
      if (dto.marksAwarded === undefined) {
        throw new BadRequestException('marksAwarded is required.');
      }
      if (dto.marksAwarded > response.marksAvailable) {
        throw new BadRequestException(`marksAwarded (${dto.marksAwarded}) exceeds this response's available marks (${response.marksAvailable}).`);
      }
      marksAwarded = dto.marksAwarded;
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
    await this.scoreAggregationQueue.add('recalculate', { attemptId: response.attemptId! }, { attempts: 3, backoff: { type: 'exponential', delay: 1000 } });

    return newVersion;
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

    // 25 §7 prioritizes AI-flagged-low-confidence first — no such data exists
    // until Phase 13 (AI Evaluation), so an aiFlag filter is honestly empty
    // today rather than silently ignored.
    if (query.aiFlag) {
      return { data: [], meta: { total: 0, page, pageSize, totalPages: 0 } };
    }

    const where: Prisma.ResponseWhereInput = {
      attemptId: { not: null },
      question: { type: { in: SUBJECTIVE_QUESTION_TYPES }, ...(query.subjectId && { subjectId: query.subjectId }) },
      OR: [{ evaluation: null }, { evaluation: { status: { in: [EvaluationStatus.PENDING, EvaluationStatus.AI_SUGGESTED] } } }],
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
          evaluation: true,
          attempt: {
            select: {
              studentProfile: { select: { rollNumber: true, user: { select: { name: true } } } },
              assessmentDelivery: { select: { assessment: { select: { title: true } } } },
            },
          },
        },
        orderBy: { createdAt: 'asc' }, // oldest-submitted-first (25 §7's fallback ordering — no AI flags to prioritize on yet)
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
    if (!SUBJECTIVE_QUESTION_TYPES.includes(response.question.type)) {
      throw new BadRequestException('Only subjective (SHORT_ANSWER/LONG_ANSWER/PASSAGE_BASED) responses go through evaluation — objective responses are scored directly at capture.');
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
