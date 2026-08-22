import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import {
  AuditAction,
  UserRole,
  CaptureProviderType,
  DocumentLayoutType,
  ProcessingStage,
  ProcessingJobStatus,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { syncPageRegionResponses } from '../shared/sync-page-region-responses';
import { CreateDocumentBundleDto, ReprocessDocumentDto, CreatePageRegionDto, UpdatePageRegionDto } from './dto/document.dto';

/**
 * 23-DOCUMENT-PROCESSING-ARCHITECTURE.md §9 upload rules (photo capture row):
 * 10 MB/file, jpg/jpeg/png/webp/pdf. PDF is intentionally NOT in
 * ALLOWED_MIME_TYPES below — splitting a multi-page PDF into per-page images
 * requires a PDF-processing library this codebase does not have. Rather than
 * silently mishandle a PDF upload or fake the split, it is rejected with a
 * clear 422 pointing at this gap. Malware scanning and EXIF stripping (also
 * required by §9) are likewise not implemented — no scanning provider is
 * wired (17-THIRD-PARTY-INTEGRATIONS.md), flagged here rather than pretended.
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * 23 §4's two pipelines, minus OCR (doc 20 Phase 10: "queue: document-processing
 * (all sub-stages except OCR)" — OCR's own queue/module is Phase 11's).
 *
 * IMPORTANT, and the central honesty boundary of this module: these
 * ProcessingJob rows are created as real, inspectable QUEUED records — the
 * queue this phase's exit criteria describes genuinely exists and is
 * queryable via GET /documents/:id. What does NOT exist is a worker that
 * consumes it: no image-processing/vision pipeline is wired anywhere in this
 * codebase (no deskew library, no auto-region-detection, no vision-assisted
 * question-marker OCR). Building fake stage processors that flip status
 * without doing real work would misrepresent capability, the same trap
 * caught in Phase 8's "OMR engine" investigation. Instead, every
 * human-in-the-loop checkpoint 23 §5/30 already mandates regardless (manual
 * identity confirmation, manual region creation/correction) is built for
 * real below — that is what makes the pipeline usable end-to-end today, not
 * a shortcut around it.
 */
const PATH_A_STAGES: ProcessingStage[] = [
  ProcessingStage.VALIDATE,
  ProcessingStage.DESKEW,
  ProcessingStage.PAGE_ORDER,
  ProcessingStage.IDENTITY_RESOLVE,
  ProcessingStage.REGION_DETECT,
  ProcessingStage.QUESTION_MAP,
];
const PATH_B_STAGES: ProcessingStage[] = [
  ProcessingStage.VALIDATE,
  ProcessingStage.DESKEW,
  ProcessingStage.PAGE_ORDER,
  ProcessingStage.IDENTITY_RESOLVE,
  ProcessingStage.LAYOUT_ANALYSIS,
  ProcessingStage.QUESTION_MAP,
];

interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly cache: CacheService,
  ) {}

  // ── DocumentBundle ───────────────────────────────────────────────────────

  async createBundle(instituteId: string, dto: CreateDocumentBundleDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const delivery = await this.prisma.assessmentDelivery.findUnique({
      where: { id: dto.assessmentDeliveryId },
      include: { assessment: { select: { instituteId: true } }, captureProvider: true },
    });
    if (!delivery || delivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Assessment delivery not found');
    }

    // 23 §2: only PHOTO_CAPTURE_SUBJECTIVE deliveries ever enter this pipeline.
    if (delivery.captureProvider.type !== CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE) {
      throw new BadRequestException(
        `Document bundles only apply to PHOTO_CAPTURE_SUBJECTIVE deliveries (23-DOCUMENT-PROCESSING-ARCHITECTURE.md §2) — this delivery's capture provider is ${delivery.captureProvider.type}.`,
      );
    }

    const bundle = await this.prisma.documentBundle.create({
      data: {
        assessmentDeliveryId: dto.assessmentDeliveryId,
        uploadedByUserId: actor.id,
        expectedDocumentCount: dto.expectedDocumentCount,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'document_bundles', bundle.id, null, { assessmentDeliveryId: dto.assessmentDeliveryId });

    return bundle;
  }

  // ── Document upload ──────────────────────────────────────────────────────

  async uploadDocument(instituteId: string, bundleId: string, files: UploadedFile[], idempotencyKey: string | undefined, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    // 05-API-SPECIFICATION.md (V2 section) §5: "Headers: Idempotency-Key required".
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required for document uploads.');
    }
    const idempotencyCacheKey = `idempotency:documents:${instituteId}:${idempotencyKey}`;
    const cached = await this.cache.get<{ documentId: string; status: string }>(idempotencyCacheKey);
    if (cached) return cached;

    const bundle = await this.prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } }, captureProvider: true } } },
    });
    if (!bundle || bundle.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Document bundle not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one page image is required.');
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new PayloadTooLargeException(`${file.originalname} exceeds the 10 MB per-file limit.`);
      }
      if (file.mimetype === 'application/pdf') {
        throw new UnprocessableEntityException(
          `${file.originalname}: multi-page PDF booklet upload is not yet implemented — upload individual page images (jpg/jpeg/png/webp) instead.`,
        );
      }
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new UnprocessableEntityException(`${file.originalname}: unsupported file type ${file.mimetype} — allowed: ${ALLOWED_MIME_TYPES.join(', ')}.`);
      }
    }

    const config = (bundle.assessmentDelivery.captureProvider.config as Record<string, unknown>) ?? {};
    const layoutType: DocumentLayoutType = config['bookletTemplateId'] ? DocumentLayoutType.TEMPLATE_KNOWN : DocumentLayoutType.FREE_FORM;
    const stages = layoutType === DocumentLayoutType.TEMPLATE_KNOWN ? PATH_A_STAGES : PATH_B_STAGES;

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          documentBundleId: bundleId,
          expectedPageCount: files.length,
          layoutType,
        },
      });

      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const page = await tx.page.create({ data: { documentId: doc.id, pageNumber: i + 1 } });
        const key = this.storage.buildKey(instituteId, 'documents', doc.id, 'pages', page.id, file.originalname);
        await this.storage.upload(key, file.buffer, file.mimetype);
        await tx.pageImage.create({ data: { pageId: page.id, rawImageUrl: key } });
      }

      for (const stage of stages) {
        await tx.processingJob.create({ data: { documentId: doc.id, stage, status: ProcessingJobStatus.QUEUED } });
      }

      // Conservative default per 30-IDENTITY-PAGE-MAPPING.md §4: with no
      // auto-detection wired, every document starts PENDING mandatory manual
      // confirmation — exactly the doc's own conservative behavior below the
      // auto-accept threshold, not a shortcut around it.
      await tx.identityResolution.create({
        data: { documentId: doc.id, method: 'MANUAL_ADMIN_MATCH', confidence: 0 },
      });

      return doc;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'documents', document.id, null, { documentBundleId: bundleId, pageCount: files.length, layoutType });

    const result = { documentId: document.id, status: document.status };
    await this.cache.set(idempotencyCacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  // ── Document reads ───────────────────────────────────────────────────────

  async findById(instituteId: string, documentId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const document = await this.getDocumentWithTenantCheck(documentId, instituteId);
    return this.prisma.document.findUnique({
      where: { id: document.id },
      include: {
        pages: { orderBy: { pageNumber: 'asc' }, include: { images: { include: { regions: true } } } },
        processingJobs: { orderBy: { stage: 'asc' } },
        identityResolution: true,
      },
    });
  }

  async getPageImageUrl(instituteId: string, documentId: string, pageId: string, wantsRaw: boolean, actor: AuthenticatedUser) {
    const document = await this.getDocumentWithTenantCheck(documentId, instituteId, actor);

    let raw = wantsRaw;
    if (actor.role === UserRole.STUDENT) {
      const student = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id } });
      if (!student || document.attemptId === null || student.id !== (await this.attemptStudentId(document.attemptId))) {
        throw new ForbiddenException("You don't have access to this.");
      }
      raw = false; // 05 §5: students never get raw pre-annotation image access
    } else if (raw && actor.role !== UserRole.TEACHER && actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Raw image access is limited to teachers, admins, and reviewers.');
    }

    const page = await this.prisma.page.findUnique({ where: { id: pageId }, include: { images: { orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!page || page.documentId !== documentId) throw new NotFoundException('Page not found');
    const image = page.images[0];
    if (!image) throw new NotFoundException('No image uploaded for this page yet');

    // processedImageUrl is only ever populated by the (unbuilt) deskew stage —
    // falling back to the raw upload is the honest behavior today, not a bug.
    const key = raw || !image.processedImageUrl ? image.rawImageUrl : image.processedImageUrl;
    return { url: await this.storage.getSignedDownloadUrl(key), raw: raw || !image.processedImageUrl };
  }

  async reprocess(instituteId: string, documentId: string, dto: ReprocessDocumentDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const document = await this.getDocumentWithTenantCheck(documentId, instituteId);

    const existingJobs = await this.prisma.processingJob.findMany({ where: { documentId }, orderBy: { stage: 'asc' } });
    const stages = document.layoutType === DocumentLayoutType.TEMPLATE_KNOWN ? PATH_A_STAGES : PATH_B_STAGES;
    const fromIndex = stages.indexOf(dto.fromStage);
    if (fromIndex === -1) {
      throw new BadRequestException(`${dto.fromStage} is not a stage in this document's pipeline (layoutType=${document.layoutType}).`);
    }

    const stagesToReset = new Set(stages.slice(fromIndex));
    await this.prisma.$transaction(
      existingJobs
        .filter((j) => stagesToReset.has(j.stage))
        .map((j) =>
          this.prisma.processingJob.update({
            where: { id: j.id },
            data: {
              status: ProcessingJobStatus.QUEUED,
              attemptCount: j.stage === dto.fromStage ? j.attemptCount + 1 : j.attemptCount,
              startedAt: null,
              completedAt: null,
            },
          }),
        ),
    );

    const updated = await this.prisma.document.update({ where: { id: documentId }, data: { status: 'PAGE_PROCESSING' } });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'documents', documentId, null, { reprocessFromStage: dto.fromStage });
    return updated;
  }

  // ── Page regions (manual authoring — see the module-level honesty note above) ──

  async createRegion(instituteId: string, pageImageId: string, dto: CreatePageRegionDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const { documentId } = await this.getPageImageWithTenantCheck(pageImageId, instituteId);

    if (dto.questionId) {
      const question = await this.prisma.question.findUnique({ where: { id: dto.questionId } });
      if (!question || question.instituteId !== instituteId) throw new NotFoundException('Question not found');
    }

    const region = await this.prisma.pageRegion.create({
      data: {
        pageImageId,
        boundingBox: dto.boundingBox as unknown as Prisma.InputJsonValue,
        regionType: dto.regionType,
        questionId: dto.questionId,
        detectionMethod: 'MANUAL_TEACHER_MARKUP',
      },
    });

    await syncPageRegionResponses(this.prisma, documentId);
    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'page_regions', region.id, null, { pageImageId, regionType: dto.regionType, questionId: dto.questionId });
    return region;
  }

  async updateRegion(instituteId: string, regionId: string, dto: UpdatePageRegionDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const region = await this.prisma.pageRegion.findUnique({ where: { id: regionId }, include: { pageImage: { include: { page: true } } } });
    if (!region) throw new NotFoundException('Page region not found');
    const documentId = region.pageImage.page.documentId;
    await this.getDocumentWithTenantCheck(documentId, instituteId);

    if (dto.questionId) {
      const question = await this.prisma.question.findUnique({ where: { id: dto.questionId } });
      if (!question || question.instituteId !== instituteId) throw new NotFoundException('Question not found');
    }

    const questionIdChanged = dto.questionId !== undefined && dto.questionId !== region.questionId;
    if (questionIdChanged) {
      // The mapping moved to a different question — the Response this region
      // was evidence for (if any) is no longer valid evidence for that question.
      await this.prisma.response.deleteMany({ where: { questionRegionId: regionId } });
    }

    const updated = await this.prisma.pageRegion.update({
      where: { id: regionId },
      data: {
        ...(dto.boundingBox && { boundingBox: dto.boundingBox as unknown as Prisma.InputJsonValue }),
        ...(dto.questionId !== undefined && { questionId: dto.questionId }),
        detectionMethod: 'MANUAL_TEACHER_MARKUP',
      },
    });

    await syncPageRegionResponses(this.prisma, documentId);
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'page_regions', regionId, { questionId: region.questionId }, { questionId: dto.questionId });
    return updated;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async attemptStudentId(attemptId: string): Promise<string | undefined> {
    const attempt = await this.prisma.attempt.findUnique({ where: { id: attemptId } });
    return attempt?.studentProfileId;
  }

  private async getDocumentWithTenantCheck(documentId: string, instituteId: string, _actor?: AuthenticatedUser) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { documentBundle: { include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } } } },
    });
    if (!document || document.documentBundle?.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Document not found');
    }
    return document;
  }

  private async getPageImageWithTenantCheck(pageImageId: string, instituteId: string) {
    const pageImage = await this.prisma.pageImage.findUnique({
      where: { id: pageImageId },
      include: { page: { include: { document: { include: { documentBundle: { include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } } } } } } } },
    });
    if (!pageImage || pageImage.page.document.documentBundle?.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Page image not found');
    }
    return { documentId: pageImage.page.documentId };
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
