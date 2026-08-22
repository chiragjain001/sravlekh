import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, QuestionType, RubricScoringMode, ExamStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateRubricDto, UpdateRubricDto, RubricCriterionDto } from './dto/rubric.dto';

/**
 * 26-RUBRIC-EVALUATION-SPECIFICATION.md. Rubrics attach to a subjective
 * Question and are versioned (RubricVersion, immutable once created) — every
 * EvaluationVersion (Phase 12+) will reference the exact rubricVersionId it
 * was scored against.
 */
const RUBRIC_ELIGIBLE_TYPES: QuestionType[] = [QuestionType.SHORT_ANSWER, QuestionType.LONG_ANSWER, QuestionType.PASSAGE_BASED];

@Injectable()
export class RubricsService {
  private readonly logger = new Logger(RubricsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createForQuestion(instituteId: string, questionId: string, dto: CreateRubricDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const question = await this.prisma.question.findUnique({ where: { id: questionId } });
    if (!question || question.instituteId !== instituteId || question.deletedAt) {
      throw new NotFoundException('Question not found.');
    }
    if (!RUBRIC_ELIGIBLE_TYPES.includes(question.type)) {
      throw new BadRequestException(
        `Rubrics only apply to SHORT_ANSWER/LONG_ANSWER/PASSAGE_BASED questions (26-RUBRIC-EVALUATION-SPECIFICATION.md §2) — this question is ${question.type}.`,
      );
    }

    const existing = await this.prisma.rubric.findUnique({ where: { questionId } });
    if (existing) {
      throw new ConflictException('This question already has a rubric — use PATCH /rubrics/:id to add a new version.');
    }

    this.assertReconciliation(dto.scoringMode, dto.criteria, question.marks);
    this.assertDependenciesValid(dto.criteria);

    const rubric = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rubric.create({
        data: {
          instituteId,
          questionId,
          name: dto.name,
          maxMarks: question.marks,
          scoringMode: dto.scoringMode,
          createdByUserId: actor.id,
        },
      });

      const version = await this.createVersion(tx, created.id, 1, dto.criteria, actor.id);

      await tx.question.update({ where: { id: questionId }, data: { rubricId: created.id } });

      return { ...created, currentVersion: version };
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, rubric.id, null, { questionId, scoringMode: dto.scoringMode });

    return rubric;
  }

  async findByQuestion(instituteId: string, questionId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const rubric = await this.prisma.rubric.findUnique({
      where: { questionId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1, include: { criteria: { orderBy: { order: 'asc' } } } } },
    });
    if (!rubric || rubric.instituteId !== instituteId) throw new NotFoundException('This question has no rubric.');
    return rubric;
  }

  async findById(instituteId: string, rubricId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const rubric = await this.getRubricWithTenantCheck(instituteId, rubricId);
    const versions = await this.prisma.rubricVersion.findMany({
      where: { rubricId },
      orderBy: { versionNumber: 'desc' },
      include: { criteria: { orderBy: { order: 'asc' } } },
    });
    return { ...rubric, versions };
  }

  async update(instituteId: string, rubricId: string, dto: UpdateRubricDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const rubric = await this.getRubricWithTenantCheck(instituteId, rubricId);

    // 26 §5 / 05-API-SPECIFICATION.md (V2 section) §7: blocked while any
    // delivery is mid-evaluation for this question, so already-in-progress
    // evaluations are never scored against a moving target.
    const blockingDelivery = await this.prisma.assessmentDelivery.findFirst({
      where: {
        status: ExamStatus.EVALUATING,
        attempts: { some: { responses: { some: { questionId: rubric.questionId } } } },
      },
      select: { id: true },
    });
    if (blockingDelivery) {
      throw new ConflictException({
        code: 'RUBRIC_LOCKED_FOR_EVALUATION',
        message: 'This rubric cannot be edited while a delivery using its question is currently EVALUATING.',
      });
    }

    const scoringMode = dto.scoringMode ?? rubric.scoringMode;
    this.assertReconciliation(scoringMode, dto.criteria, rubric.maxMarks);
    this.assertDependenciesValid(dto.criteria);

    const latest = await this.prisma.rubricVersion.findFirst({ where: { rubricId }, orderBy: { versionNumber: 'desc' } });
    const nextVersionNumber = (latest?.versionNumber ?? 0) + 1;

    const version = await this.prisma.$transaction(async (tx) => {
      if (dto.scoringMode && dto.scoringMode !== rubric.scoringMode) {
        await tx.rubric.update({ where: { id: rubricId }, data: { scoringMode: dto.scoringMode } });
      }
      return this.createVersion(tx, rubricId, nextVersionNumber, dto.criteria, actor.id);
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, rubricId, { versionNumber: latest?.versionNumber }, { versionNumber: nextVersionNumber });

    return version;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async createVersion(
    tx: Prisma.TransactionClient,
    rubricId: string,
    versionNumber: number,
    criteria: RubricCriterionDto[],
    editedByUserId: string,
  ) {
    const version = await tx.rubricVersion.create({
      data: {
        rubricId,
        versionNumber,
        criteriaSnapshot: criteria as any,
        editedByUserId,
      },
    });

    const created = await Promise.all(
      criteria.map((c, order) =>
        tx.rubricCriterion.create({
          data: {
            rubricVersionId: version.id,
            order,
            description: c.description,
            maxMarks: c.maxMarks,
            keywordHints: c.keywordHints ?? [],
          },
        }),
      ),
    );

    // Second pass: resolve dependsOnCriterionIndex (array position) to the
    // real RubricCriterion.id created above — those IDs don't exist until
    // after the first pass persists them.
    for (let i = 0; i < criteria.length; i++) {
      const dependsOnCriterionIndex = criteria[i]?.dependsOnCriterionIndex;
      if (dependsOnCriterionIndex !== undefined) {
        await tx.rubricCriterion.update({
          where: { id: created[i]!.id },
          data: { dependsOnCriterionId: created[dependsOnCriterionIndex]!.id },
        });
      }
    }

    return { ...version, criteria: created };
  }

  private assertReconciliation(scoringMode: RubricScoringMode, criteria: RubricCriterionDto[], maxMarks: number) {
    // 26-RUBRIC-EVALUATION-SPECIFICATION.md §4.3: HOLISTIC_WITH_GUIDANCE bands
    // are descriptive guidance, not additive scores — they never reconcile to
    // Question.marks by summing.
    if (scoringMode === RubricScoringMode.HOLISTIC_WITH_GUIDANCE) return;

    if (criteria.length === 0) {
      throw new BadRequestException('At least one criterion is required for CRITERION_ADDITIVE/STEP_WISE rubrics.');
    }

    const sum = criteria.reduce((total, c) => total + c.maxMarks, 0);
    if (Math.abs(sum - maxMarks) > 1e-6) {
      throw new UnprocessableEntityException({
        code: 'RUBRIC_MARKS_MISMATCH',
        message: `Criteria sum to ${sum} marks but the question is worth ${maxMarks}.`,
      });
    }
  }

  private assertDependenciesValid(criteria: RubricCriterionDto[]) {
    criteria.forEach((c, index) => {
      if (c.dependsOnCriterionIndex === undefined) return;
      if (c.dependsOnCriterionIndex === index) {
        throw new BadRequestException(`Criterion ${index} cannot depend on itself.`);
      }
      if (c.dependsOnCriterionIndex < 0 || c.dependsOnCriterionIndex >= criteria.length) {
        throw new BadRequestException(`Criterion ${index}'s dependsOnCriterionIndex is out of range.`);
      }
    });
  }

  private async getRubricWithTenantCheck(instituteId: string, rubricId: string) {
    const rubric = await this.prisma.rubric.findUnique({ where: { id: rubricId } });
    if (!rubric || rubric.instituteId !== instituteId) throw new NotFoundException('Rubric not found.');
    return rubric;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity: 'rubrics', entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for rubrics:${entityId}`, err as Error);
    }
  }
}
