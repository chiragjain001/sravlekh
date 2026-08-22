import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, CaptureProviderType, EvidenceType, AuditAction } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateAttemptDto } from './dto/attempt.dto';

/**
 * 29-CAPTURE-PROVIDER-ARCHITECTURE.md §3 describes OMR/CSV_IMPORT as "wraps
 * the existing v1 engine unchanged." Investigated during Phase 8
 * (docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md): v1 has no such differentiated
 * per-mode engine — captureMode on v1 Exam/AnswerSheet is stored metadata
 * only; every mode is graded through the exact same manual structured-entry
 * path (ExamsService.gradeAnswerSheet). There is nothing type-specific to
 * "wrap" beyond that one path, so this service honestly reflects that: all
 * four Phase-8 provider types (OMR, MANUAL_GRID, CSV_IMPORT,
 * PHOTO_CAPTURE_OBJECTIVE) share one ingest implementation, differentiated
 * only by the evidenceType tag stamped onto the Response rows it creates.
 * PHOTO_CAPTURE_SUBJECTIVE is out of scope here — it requires the Document
 * Processing Pipeline (Phase 10), not yet built.
 */
const OMR_EVIDENCE_TYPES: CaptureProviderType[] = [CaptureProviderType.OMR, CaptureProviderType.PHOTO_CAPTURE_OBJECTIVE];

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(instituteId: string, dto: CreateAttemptDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: dto.assessmentDeliveryId },
      include: { assessment: { select: { instituteId: true } } },
    });
    if (!delivery || delivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Assessment delivery not found');
    }

    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentProfileId } });
    if (!student || student.batchId !== delivery.batchId) {
      throw new BadRequestException('Student does not belong to the delivery batch');
    }

    const captureProvider = await this.prisma.captureProvider.findUnique({ where: { id: dto.captureProviderId } });
    if (!captureProvider || captureProvider.instituteId !== instituteId) {
      throw new NotFoundException('Capture provider not found');
    }

    if (captureProvider.type === CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE) {
      throw new BadRequestException(
        'PHOTO_CAPTURE_SUBJECTIVE ingestion requires the Document Processing Pipeline (Phase 10), not yet built. Use a Phase-8-supported provider type.',
      );
    }

    // 04-DATABASE-SCHEMA.md (V2 section) fix #2: new duplicates are inserted
    // directly with isActiveAttempt=false rather than toggling the existing
    // row — satisfiable by construction, no transactional toggle-then-insert race.
    const existingActive = await this.prisma.attempt.findFirst({
      where: { assessmentDeliveryId: dto.assessmentDeliveryId, studentProfileId: dto.studentProfileId, isActiveAttempt: true },
    });

    const evidenceType: EvidenceType = OMR_EVIDENCE_TYPES.includes(captureProvider.type)
      ? EvidenceType.OMR_MARK
      : EvidenceType.DIGITAL_VALUE;

    const questionIds = (dto.responses ?? []).map((r) => r.questionId);
    const questions = questionIds.length
      ? await this.prisma.question.findMany({ where: { id: { in: questionIds }, instituteId } })
      : [];
    const questionById = new Map(questions.map((q) => [q.id, q]));

    for (const r of dto.responses ?? []) {
      if (!questionById.has(r.questionId)) {
        throw new NotFoundException(`Question ${r.questionId} not found in this institute`);
      }
    }

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attempt.create({
        data: {
          assessmentDeliveryId: dto.assessmentDeliveryId,
          studentProfileId: dto.studentProfileId,
          isActiveAttempt: !existingActive,
          status: dto.responses?.length ? 'SUBMITTED' : 'IN_PROGRESS',
          submittedAt: dto.responses?.length ? new Date() : null,
        },
      });

      for (const r of dto.responses ?? []) {
        const question = questionById.get(r.questionId)!;
        await tx.response.create({
          data: {
            attemptId: created.id,
            questionId: r.questionId,
            marksAwarded: r.marksAwarded,
            marksAvailable: question.marks,
            isCorrect: r.isCorrect,
            studentAnswer: r.studentAnswer,
            mistakeTags: r.mistakeTags ?? [],
            evidenceType,
          },
        });
      }

      return created;
    });

    await this.writeAudit(instituteId, actor.id, attempt.id, {
      assessmentDeliveryId: dto.assessmentDeliveryId,
      studentProfileId: dto.studentProfileId,
      isActiveAttempt: attempt.isActiveAttempt,
    });

    return attempt;
  }

  async findResponses(instituteId: string, attemptId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } },
    });
    if (!attempt || attempt.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Attempt not found');
    }

    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id } });
      if (!student || student.id !== attempt.studentProfileId) {
        throw new ForbiddenException("You don't have access to this.");
      }
    }

    return this.prisma.response.findMany({
      where: { attemptId },
      include: { question: { select: { id: true, content: true, marks: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, entityId: string, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action: AuditAction.CREATE, entity: 'attempts', entityId, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for attempts:${entityId}`, err as Error);
    }
  }
}
