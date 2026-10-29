import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, IdentityStatus, IdentityMethod, BookletStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { syncPageRegionResponses } from '../shared/sync-page-region-responses';
import { ConfirmIdentityDto, QueryIdentityResolutionsDto } from './dto/identity-resolution.dto';
import { BookletSecurityService } from '../booklets/booklet-security.service';

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly bookletSecurity?: BookletSecurityService,
  ) {}

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

  /**
   * Resolves document identity from QR decode and OMR bubble detection.
   * Matches against delivery batch enrollment, enforces booklet integrity,
   * detects duplicate attempts (flagging CONFLICT), and auto-resolves if confidence >= 0.95.
   */
  async resolveFromQrAndOmr(params: {
    instituteId: string;
    documentId: string;
    assessmentDeliveryId: string;
    bookletSerial?: string | null;
    detectedRollNumber?: string | null;
    confidence: number;
    actorId?: string;
    qrPayload?: string | null;
  }) {
    const doc = await this.prisma.document.findUnique({
      where: { id: params.documentId },
      include: {
        documentBundle: {
          include: {
            assessmentDelivery: {
              include: { assessment: { select: { instituteId: true } } },
            },
          },
        },
      },
    });
    if (!doc) throw new NotFoundException(`Document ${params.documentId} not found`);

    const delivery = doc.documentBundle?.assessmentDelivery;
    const deliveryId = params.assessmentDeliveryId || delivery?.id;
    if (!deliveryId || !delivery) {
      throw new BadRequestException('No assessment delivery found for document');
    }

    // Step 0: Cryptographically verify QR payload HMAC signature if provided
    if (params.qrPayload && this.bookletSecurity) {
      try {
        const verified = this.bookletSecurity.verifyBookletQr(params.qrPayload);
        if (verified.payload.inst !== params.instituteId) {
          await this.prisma.identityResolution.upsert({
            where: { documentId: params.documentId },
            create: {
              documentId: params.documentId,
              method: IdentityMethod.QR_CODE,
              confidence: 0,
              status: IdentityStatus.CONFLICT,
            },
            update: { status: IdentityStatus.CONFLICT, confidence: 0 },
          });
          return { status: IdentityStatus.CONFLICT, reason: 'Booklet QR belongs to another institute tenant' };
        }
        if (deliveryId && verified.payload.del !== deliveryId) {
          await this.prisma.identityResolution.upsert({
            where: { documentId: params.documentId },
            create: {
              documentId: params.documentId,
              method: IdentityMethod.QR_CODE,
              confidence: 0,
              status: IdentityStatus.CONFLICT,
            },
            update: { status: IdentityStatus.CONFLICT, confidence: 0 },
          });
          return { status: IdentityStatus.CONFLICT, reason: `Booklet QR belongs to delivery ${verified.payload.del}, not current delivery ${deliveryId}` };
        }
      } catch (qrErr) {
        await this.prisma.identityResolution.upsert({
          where: { documentId: params.documentId },
          create: {
            documentId: params.documentId,
            method: IdentityMethod.QR_CODE,
            confidence: 0,
            status: IdentityStatus.CONFLICT,
          },
          update: { status: IdentityStatus.CONFLICT, confidence: 0 },
        });
        return { status: IdentityStatus.CONFLICT, reason: 'Cryptographic signature verification failed for booklet QR code' };
      }
    }

    // Step 1: Validate physical booklet serial if present
    if (params.bookletSerial) {
      const booklet = await this.prisma.booklet.findFirst({
        where: { assessmentDeliveryId: deliveryId, bookletSerial: params.bookletSerial },
      });
      if (!booklet) {
        // Cross-delivery check: does this booklet exist in another delivery of this institute?
        const foreignBooklet = await this.prisma.booklet.findFirst({
          where: { instituteId: params.instituteId, bookletSerial: params.bookletSerial },
          select: { assessmentDeliveryId: true },
        });
        if (foreignBooklet) {
          await this.prisma.identityResolution.upsert({
            where: { documentId: params.documentId },
            create: {
              documentId: params.documentId,
              method: IdentityMethod.QR_CODE,
              confidence: 0,
              status: IdentityStatus.CONFLICT,
            },
            update: { status: IdentityStatus.CONFLICT, confidence: 0 },
          });
          return {
            status: IdentityStatus.CONFLICT,
            reason: `Booklet ${params.bookletSerial} belongs to another assessment delivery (${foreignBooklet.assessmentDeliveryId})`,
          };
        }
      } else {
        if (booklet.status === BookletStatus.VOIDED) {
          await this.prisma.identityResolution.upsert({
            where: { documentId: params.documentId },
            create: {
              documentId: params.documentId,
              method: IdentityMethod.QR_CODE,
              confidence: 0,
              status: IdentityStatus.CONFLICT,
            },
            update: {
              status: IdentityStatus.CONFLICT,
              confidence: 0,
            },
          });
          return { status: IdentityStatus.CONFLICT, reason: `Booklet ${params.bookletSerial} is voided` };
        } else if (booklet.status === BookletStatus.SCANNED) {
          const alreadyLinkedDoc = await this.prisma.document.findFirst({
            where: {
              bookletSerial: params.bookletSerial,
              id: { not: params.documentId },
              documentBundle: { assessmentDeliveryId: deliveryId },
            },
          });
          if (alreadyLinkedDoc) {
            await this.prisma.identityResolution.upsert({
              where: { documentId: params.documentId },
              create: {
                documentId: params.documentId,
                method: IdentityMethod.QR_CODE,
                confidence: 0,
                status: IdentityStatus.CONFLICT,
              },
              update: {
                status: IdentityStatus.CONFLICT,
                confidence: 0,
              },
            });
            return { status: IdentityStatus.CONFLICT, reason: `Booklet ${params.bookletSerial} already scanned in document ${alreadyLinkedDoc.id}` };
          }
        }

        await this.prisma.booklet.update({
          where: { id: booklet.id },
          data: { status: BookletStatus.SCANNED },
        });
      }

      await this.prisma.document.update({
        where: { id: params.documentId },
        data: { bookletSerial: params.bookletSerial },
      });
    }

    // Step 2: Match student candidate from detected roll number
    let matchedStudentProfileId: string | null = null;
    let studentRollNumber: string | null = null;

    if (params.detectedRollNumber) {
      const rawRoll = params.detectedRollNumber.trim();
      const strippedRoll = rawRoll.replace(/^0+/, '') || '0';
      const candidateRolls = Array.from(new Set([rawRoll, strippedRoll]));

      const matchingEnrollments = await this.prisma.batchEnrollment.findMany({
        where: {
          batchId: delivery.batchId,
          rollNumber: { in: candidateRolls },
          status: 'ACTIVE',
        },
        select: { studentProfileId: true, rollNumber: true },
      });

      if (matchingEnrollments.length > 1) {
        // Normalization collision: e.g. '42' and '042' both exist in the batch
        await this.prisma.identityResolution.upsert({
          where: { documentId: params.documentId },
          create: {
            documentId: params.documentId,
            method: params.bookletSerial ? IdentityMethod.QR_CODE : IdentityMethod.ROLL_NUMBER_OCR,
            confidence: 0.30,
            status: IdentityStatus.CONFLICT,
          },
          update: {
            status: IdentityStatus.CONFLICT,
            confidence: 0.30,
          },
        });
        return {
          status: IdentityStatus.CONFLICT,
          reason: `Ambiguous match: multiple students match roll candidates [${candidateRolls.join(', ')}] in batch`,
        };
      }

      if (matchingEnrollments.length === 1 && matchingEnrollments[0]) {
        matchedStudentProfileId = matchingEnrollments[0].studentProfileId;
        studentRollNumber = matchingEnrollments[0].rollNumber;
      } else {
        const matchingProfiles = await this.prisma.studentProfile.findMany({
          where: {
            batchId: delivery.batchId,
            OR: [
              { rollNumber: { in: candidateRolls } },
              { studentCode: rawRoll },
            ],
          },
          select: { id: true, rollNumber: true },
        });

        if (matchingProfiles.length > 1) {
          await this.prisma.identityResolution.upsert({
            where: { documentId: params.documentId },
            create: {
              documentId: params.documentId,
              method: params.bookletSerial ? IdentityMethod.QR_CODE : IdentityMethod.ROLL_NUMBER_OCR,
              confidence: 0.30,
              status: IdentityStatus.CONFLICT,
            },
            update: {
              status: IdentityStatus.CONFLICT,
              confidence: 0.30,
            },
          });
          return {
            status: IdentityStatus.CONFLICT,
            reason: `Ambiguous match: multiple student profiles match roll candidates [${candidateRolls.join(', ')}]`,
          };
        }

        if (matchingProfiles.length === 1 && matchingProfiles[0]) {
          matchedStudentProfileId = matchingProfiles[0].id;
          studentRollNumber = matchingProfiles[0].rollNumber;
        }
      }
    }

    // If no candidate enrolled in delivery batch matches
    if (!matchedStudentProfileId) {
      const unres = await this.prisma.identityResolution.upsert({
        where: { documentId: params.documentId },
        create: {
          documentId: params.documentId,
          method: IdentityMethod.ROLL_NUMBER_OCR,
          confidence: params.confidence,
          status: IdentityStatus.UNRESOLVED,
        },
        update: {
          status: IdentityStatus.UNRESOLVED,
          confidence: params.confidence,
        },
      });
      return {
        status: IdentityStatus.UNRESOLVED,
        resolutionId: unres.id,
        reason: `Roll number ${params.detectedRollNumber || 'empty'} not enrolled in delivery batch`,
      };
    }

    // Step 3: Check for duplicate active attempt in this delivery
    const existingActiveAttempt = await this.prisma.attempt.findFirst({
      where: {
        assessmentDeliveryId: deliveryId,
        studentProfileId: matchedStudentProfileId,
        isActiveAttempt: true,
      },
    });

    if (existingActiveAttempt) {
      const alreadyLinkedDoc = await this.prisma.document.findFirst({
        where: { attemptId: existingActiveAttempt.id, id: { not: params.documentId } },
      });
      if (alreadyLinkedDoc) {
        const conflictRes = await this.prisma.identityResolution.upsert({
          where: { documentId: params.documentId },
          create: {
            documentId: params.documentId,
            method: IdentityMethod.ROLL_NUMBER_OCR,
            candidateStudentProfileId: matchedStudentProfileId,
            confidence: params.confidence,
            status: IdentityStatus.CONFLICT,
          },
          update: {
            candidateStudentProfileId: matchedStudentProfileId,
            confidence: params.confidence,
            status: IdentityStatus.CONFLICT,
          },
        });
        return {
          status: IdentityStatus.CONFLICT,
          resolutionId: conflictRes.id,
          candidateStudentProfileId: matchedStudentProfileId,
          reason: 'Another document is already linked to this student for this delivery',
        };
      }
    }

    // Step 4: Auto-resolve if confidence >= 0.95
    if (params.confidence >= 0.95) {
      const [updatedResolution, attempt] = await this.prisma.$transaction(async (tx) => {
        const att = existingActiveAttempt ?? (await tx.attempt.create({
          data: {
            assessmentDeliveryId: deliveryId,
            studentProfileId: matchedStudentProfileId!,
            rollNumberSnapshot: studentRollNumber ?? params.detectedRollNumber,
            status: 'SUBMITTED',
            isActiveAttempt: true,
          },
        }));

        await tx.document.update({
          where: { id: params.documentId },
          data: { attemptId: att.id, bookletSerial: params.bookletSerial },
        });

        const res = await tx.identityResolution.upsert({
          where: { documentId: params.documentId },
          create: {
            documentId: params.documentId,
            method: IdentityMethod.ROLL_NUMBER_OCR,
            confidence: params.confidence,
            candidateStudentProfileId: matchedStudentProfileId,
            resolvedStudentProfileId: matchedStudentProfileId,
            status: IdentityStatus.AUTO_RESOLVED,
            resolvedAt: new Date(),
          },
          update: {
            method: IdentityMethod.ROLL_NUMBER_OCR,
            confidence: params.confidence,
            candidateStudentProfileId: matchedStudentProfileId,
            resolvedStudentProfileId: matchedStudentProfileId,
            status: IdentityStatus.AUTO_RESOLVED,
            resolvedAt: new Date(),
          },
        });

        return [res, att] as const;
      });

      await this.writeAudit(params.instituteId, params.actorId || 'system:omr', updatedResolution.id, {
        method: IdentityMethod.ROLL_NUMBER_OCR,
        confidence: params.confidence,
        resolvedStudentProfileId: matchedStudentProfileId,
        status: IdentityStatus.AUTO_RESOLVED,
      });

      await syncPageRegionResponses(this.prisma, params.documentId);

      return {
        status: IdentityStatus.AUTO_RESOLVED,
        resolutionId: updatedResolution.id,
        studentId: matchedStudentProfileId,
        attemptId: attempt.id,
      };
    }

    // Step 5: Below threshold (confidence < 0.95) — route to manual confirmation
    const pendingRes = await this.prisma.identityResolution.upsert({
      where: { documentId: params.documentId },
      create: {
        documentId: params.documentId,
        method: IdentityMethod.ROLL_NUMBER_OCR,
        confidence: params.confidence,
        candidateStudentProfileId: matchedStudentProfileId,
        status: IdentityStatus.PENDING,
      },
      update: {
        method: IdentityMethod.ROLL_NUMBER_OCR,
        confidence: params.confidence,
        candidateStudentProfileId: matchedStudentProfileId,
        status: IdentityStatus.PENDING,
      },
    });

    return {
      status: IdentityStatus.PENDING,
      resolutionId: pendingRes.id,
      candidateStudentProfileId: matchedStudentProfileId,
      confidence: params.confidence,
    };
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

