import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, IdentityStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { syncPageRegionResponses } from '../shared/sync-page-region-responses';
import { ConfirmIdentityDto, QueryIdentityResolutionsDto } from './dto/identity-resolution.dto';

/**
 * 30-IDENTITY-PAGE-MAPPING.md — "the highest-correctness-risk stage in the
 * entire v2 pipeline." Every resolution here is MANUAL_ADMIN_MATCH (see
 * DocumentsService's module comment — no BARCODE/QR_CODE/ROLL_NUMBER_OCR
 * auto-detection is wired), which is the doc's own conservative default
 * behavior below the 0.95 auto-accept threshold, not a shortcut around it.
 */
@Injectable()
export class IdentityResolutionService {
  private readonly logger = new Logger(IdentityResolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(instituteId: string, query: QueryIdentityResolutionsDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    return this.prisma.identityResolution.findMany({
      where: {
        status: query.status ?? IdentityStatus.PENDING,
        document: { documentBundle: { assessmentDelivery: { assessment: { instituteId } } } },
      },
      include: {
        document: {
          include: {
            documentBundle: { include: { assessmentDelivery: { select: { id: true, batchId: true } } } },
            pages: { orderBy: { pageNumber: 'asc' }, take: 1, include: { images: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async confirm(instituteId: string, resolutionId: string, dto: ConfirmIdentityDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const resolution = await this.prisma.identityResolution.findUnique({
      where: { id: resolutionId },
      include: {
        document: { include: { documentBundle: { include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } } } } },
      },
    });
    if (!resolution || resolution.document.documentBundle?.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Identity resolution not found');
    }
    if (resolution.status === IdentityStatus.MANUALLY_CONFIRMED || resolution.status === IdentityStatus.AUTO_RESOLVED) {
      throw new ConflictException('This document\'s identity has already been resolved.');
    }

    const delivery = resolution.document.documentBundle!.assessmentDelivery;
    const student = await this.prisma.studentProfile.findUnique({ where: { id: dto.studentProfileId } });
    if (!student || student.batchId !== delivery.batchId) {
      throw new BadRequestException('Student does not belong to the delivery batch');
    }

    // 30 §5: two Documents resolving to the same student+delivery — the
    // second is flagged CONFLICT, never auto-linked.
    const existingActiveAttempt = await this.prisma.attempt.findFirst({
      where: { assessmentDeliveryId: delivery.id, studentProfileId: dto.studentProfileId, isActiveAttempt: true },
    });
    if (existingActiveAttempt) {
      const alreadyLinkedDocument = await this.prisma.document.findFirst({
        where: { attemptId: existingActiveAttempt.id, id: { not: resolution.documentId } },
      });
      if (alreadyLinkedDocument) {
        await this.prisma.identityResolution.update({ where: { id: resolutionId }, data: { status: IdentityStatus.CONFLICT } });
        await this.writeAudit(instituteId, actor.id, resolutionId, { status: 'CONFLICT', candidateStudentProfileId: dto.studentProfileId });
        throw new ConflictException({
          code: 'IDENTITY_RESOLUTION_CONFLICT',
          message: 'Another document has already been linked to this student for this delivery.',
        });
      }
    }

    const [updatedResolution] = await this.prisma.$transaction(async (tx) => {
      const attempt = existingActiveAttempt
        ?? (await tx.attempt.create({
          data: { assessmentDeliveryId: delivery.id, studentProfileId: dto.studentProfileId, status: 'SUBMITTED', isActiveAttempt: true },
        }));

      await tx.document.update({ where: { id: resolution.documentId }, data: { attemptId: attempt.id } });

      const updated = await tx.identityResolution.update({
        where: { id: resolutionId },
        data: {
          status: IdentityStatus.MANUALLY_CONFIRMED,
          resolvedStudentProfileId: dto.studentProfileId,
          resolvedByUserId: actor.id,
          resolvedAt: new Date(),
        },
      });

      return [updated, attempt] as const;
    });

    // 30 §7: every resolution, auto or manual, is audit-logged with method/confidence/actor.
    await this.writeAudit(instituteId, actor.id, resolutionId, {
      method: resolution.method,
      confidence: resolution.confidence,
      resolvedStudentProfileId: dto.studentProfileId,
      resolvedByUserId: actor.id,
    });

    // A document's regions may already have been manually mapped before
    // identity was confirmed — backfill any Response rows now that Document.attemptId is set.
    await syncPageRegionResponses(this.prisma, resolution.documentId);

    return updatedResolution;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, entityId: string, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action: AuditAction.UPDATE, entity: 'identity_resolutions', entityId, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for identity_resolutions:${entityId}`, err as Error);
    }
  }
}
