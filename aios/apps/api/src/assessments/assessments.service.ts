import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, ExamStatus, EvaluationPolicyMode, StakesLevel, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { AiEvaluationService } from '../ai-evaluation/ai-evaluation.service';
import { EXAM_STATUS_TRANSITIONS as NEXT_STATUS } from '../shared/exam-status-transitions';
import { withVersionGuard } from '../shared/version-guard';
import { assertNoUnevaluatedSubjectiveResponses } from '../shared/evaluation-lock-gate';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EntitlementResource } from '../entitlements/plan-definitions';
import {
  CreateAssessmentDto,
  CreateAssessmentDeliveryDto,
  UpdateAssessmentDeliveryStatusDto,
  UnlockAssessmentDeliveryDto,
} from './dto/assessment.dto';

/**
 * 05-API-SPECIFICATION.md (V2 section) §2/§4, 22-ASSESSMENT-ENGINE.md. Native
 * v2 endpoints for Assessment/AssessmentDelivery — additive alongside the
 * unchanged v1 /exams path (04-DATABASE-SCHEMA.md V2 §3.3's compatibility-view
 * question is a separate, deferred concern — see
 * packages/db/manual-sql/exam_compatibility_view_design.md — this service does
 * not depend on it).
 */
@Injectable()
export class AssessmentsService {
  private readonly logger = new Logger(AssessmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiEvaluationService: AiEvaluationService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ── Assessments ───────────────────────────────────────────────────────────

  async createAssessment(instituteId: string, dto: CreateAssessmentDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    // maxAssessmentsPerMonth is a rate limit, not a total — see
    // EntitlementsService.countAssessmentsThisMonth. Not wrapped in a
    // transaction here because this create is a single statement with no
    // multi-write invariant to protect; the worst case is a monthly counter
    // overshooting by one under exact-boundary concurrency, which is not worth
    // a transaction the rest of this method doesn't need.
    await this.entitlements.assertCanCreate(instituteId, EntitlementResource.ASSESSMENT);

    if (dto.paperId) {
      const paper = await this.prisma.paper.findUnique({ where: { id: dto.paperId } });
      if (!paper || paper.instituteId !== instituteId) throw new NotFoundException('Paper not found');
    }

    const assessment = await this.prisma.assessment.create({
      data: {
        instituteId,
        title: dto.title,
        assessmentKind: dto.assessmentKind,
        stakesLevel: dto.stakesLevel,
        subjectIds: dto.subjectIds,
        paperId: dto.paperId,
        totalMarks: dto.totalMarks,
        gradeLevel: dto.gradeLevel,
        createdByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'assessments', assessment.id, null, { title: assessment.title });

    return assessment;
  }

  async findAllAssessments(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    return this.prisma.assessment.findMany({
      where: { instituteId },
      include: { paper: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAssessmentById(instituteId: string, assessmentId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        paper: { select: { id: true, title: true } },
        deliveries: { select: { id: true, status: true, batchId: true, scheduledStart: true } },
      },
    });
    if (!assessment || assessment.instituteId !== instituteId) throw new NotFoundException('Assessment not found');
    return assessment;
  }

  // ── Assessment Deliveries ────────────────────────────────────────────────

  async createDelivery(instituteId: string, assessmentId: string, dto: CreateAssessmentDeliveryDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const assessment = await this.prisma.assessment.findUnique({ where: { id: assessmentId } });
    if (!assessment || assessment.instituteId !== instituteId) throw new NotFoundException('Assessment not found');

    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });
    if (!batch || batch.instituteId !== instituteId) throw new NotFoundException('Batch not found');

    const captureProvider = await this.prisma.captureProvider.findUnique({ where: { id: dto.captureProviderId } });
    if (!captureProvider || captureProvider.instituteId !== instituteId) throw new NotFoundException('Capture provider not found');

    const evaluationPolicy = await this.prisma.evaluationPolicy.findUnique({ where: { id: dto.evaluationPolicyId } });
    if (!evaluationPolicy || evaluationPolicy.instituteId !== instituteId) throw new NotFoundException('Evaluation policy not found');

    // 04-DATABASE-SCHEMA.md (V2 section) §1.2a / 05 (V2 section) §2 fix #3:
    // an AI-final low-stakes policy can never be paired with a GRADED assessment.
    if (evaluationPolicy.mode === EvaluationPolicyMode.AI_FINAL_LOW_STAKES && assessment.stakesLevel === StakesLevel.GRADED) {
      throw new UnprocessableEntityException({
        code: 'EVALUATION_POLICY_STAKES_MISMATCH',
        message: 'An AI_FINAL_LOW_STAKES evaluation policy cannot be paired with a GRADED assessment.',
      });
    }

    const delivery = await this.prisma.assessmentDelivery.create({
      data: {
        assessmentId,
        batchId: dto.batchId,
        captureProviderId: dto.captureProviderId,
        evaluationPolicyId: dto.evaluationPolicyId,
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : null,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
        createdByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'assessment_deliveries', delivery.id, null, { assessmentId, batchId: dto.batchId });

    return delivery;
  }

  async findDeliveryById(instituteId: string, deliveryId: string, actor: AuthenticatedUser) {
    const delivery = await this.getDeliveryWithTenantCheck(instituteId, deliveryId, actor);
    return delivery;
  }

  async updateDeliveryStatus(instituteId: string, deliveryId: string, dto: UpdateAssessmentDeliveryStatusDto, actor: AuthenticatedUser) {
    const delivery = await this.getDeliveryWithTenantCheck(instituteId, deliveryId, actor);

    if (delivery.version !== dto.version) {
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: 'This delivery was changed by someone else — refresh and try again.',
      });
    }

    const expectedNext = NEXT_STATUS[delivery.status];
    if (!expectedNext || dto.status !== expectedNext) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: expectedNext
          ? `Deliveries move one stage at a time — from ${delivery.status}, the next stage is ${expectedNext}.`
          : `A ${delivery.status} delivery cannot move forward — use unlock to reopen it for evaluation.`,
      });
    }

    if (dto.status === ExamStatus.APPROVED && actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can approve a delivery.');
    }

    if (dto.status === ExamStatus.LOCKED && delivery.assessment.stakesLevel === StakesLevel.GRADED) {
      await assertNoUnevaluatedSubjectiveResponses(this.prisma, { attempt: { assessmentDeliveryId: deliveryId } });
    }

    const data: Record<string, unknown> = { status: dto.status, version: { increment: 1 } };

    const auditAction: AuditAction =
      dto.status === ExamStatus.APPROVED ? AuditAction.APPROVE
      : dto.status === ExamStatus.PUBLISHED ? AuditAction.PUBLISH
      : dto.status === ExamStatus.LOCKED ? AuditAction.LOCK
      : AuditAction.UPDATE;

    // Same discipline as ExamsService.updateStatus: LOCK is atomic with its
    // audit entry (08-ERROR-HANDLING.md), every other transition is fire-and-forget.
    if (auditAction === AuditAction.LOCK) {
      const [updated] = await withVersionGuard(
        this.prisma.$transaction([
          this.prisma.assessmentDelivery.update({ where: { id: deliveryId, version: delivery.version }, data }),
          this.prisma.auditLog.create({
            data: {
              instituteId, actorId: actor.id, action: auditAction, entity: 'assessment_deliveries', entityId: deliveryId,
              oldValue: { status: delivery.status } as Prisma.InputJsonValue, newValue: { status: dto.status } as Prisma.InputJsonValue,
            },
          }),
        ]),
        'assessment delivery',
      );
      return updated;
    }

    const updated = await withVersionGuard(
      this.prisma.assessmentDelivery.update({ where: { id: deliveryId, version: delivery.version }, data }),
      'assessment delivery',
    );
    await this.writeAudit(instituteId, actor.id, auditAction, 'assessment_deliveries', deliveryId, { status: delivery.status }, { status: dto.status });

    // 25-EVALUATION-ENGINE.md §4.1: AI first-pass is triggered when a
    // delivery enters EVALUATING, mirroring v1's timing — system-triggered,
    // async, never blocking this status-transition response.
    if (dto.status === ExamStatus.EVALUATING) {
      await this.aiEvaluationService.enqueueBatch(instituteId, deliveryId, actor.id);
    }

    return updated;
  }

  async unlockDelivery(instituteId: string, deliveryId: string, dto: UnlockAssessmentDeliveryDto, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can unlock a locked delivery.');
    }

    const delivery = await this.getDeliveryWithTenantCheck(instituteId, deliveryId, actor);

    if (delivery.version !== dto.version) {
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: 'This delivery was changed by someone else — refresh and try again.',
      });
    }
    if (delivery.status !== ExamStatus.LOCKED) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: 'Only a locked delivery can be unlocked.',
      });
    }

    const [updated] = await withVersionGuard(
      this.prisma.$transaction([
        this.prisma.assessmentDelivery.update({
          where: { id: deliveryId, version: delivery.version },
          data: { status: ExamStatus.EVALUATING, unlockReason: dto.reason, version: { increment: 1 } },
        }),
        this.prisma.auditLog.create({
          data: {
            instituteId, actorId: actor.id, action: AuditAction.UNLOCK, entity: 'assessment_deliveries', entityId: deliveryId,
            oldValue: { status: ExamStatus.LOCKED } as Prisma.InputJsonValue,
            newValue: { status: ExamStatus.EVALUATING, reason: dto.reason } as Prisma.InputJsonValue,
          },
        }),
      ]),
      'assessment delivery',
    );

    return updated;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async getDeliveryWithTenantCheck(instituteId: string, deliveryId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        assessment: { select: { instituteId: true, stakesLevel: true } },
        captureProvider: { select: { id: true, type: true } },
      },
    });
    if (!delivery || delivery.assessment.instituteId !== instituteId) throw new NotFoundException('Assessment delivery not found');
    return delivery;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as Prisma.InputJsonValue, newValue: newValue as Prisma.InputJsonValue },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
