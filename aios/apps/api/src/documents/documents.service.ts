import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  ConflictException,
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
  DetectionMethod,
  QuestionType,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { syncPageRegionResponses } from '../shared/sync-page-region-responses';
import { CreateDocumentBundleDto, ReprocessDocumentDto, CreatePageRegionDto, UpdatePageRegionDto } from './dto/document.dto';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { PDF_SPLIT_QUEUE, PdfSplitJobData } from './documents.constants';
import { enqueueDeduped, jobKey } from '../infrastructure/queue/enqueue';
import { QUEUE_POLICY } from '../infrastructure/queue/queue-policy';
import { ensureDiagnosableMessage } from '../shared/logging/error-message';
import {
  MAX_IMAGE_BYTES, MAX_PDF_BYTES, displayName, kindOf, pageObjectName, sniffMimeType,
} from './upload-validation';
import { isHumanApproved } from '../evaluations/evaluation-status.util';
import { rateLimitFrom } from '../shared/provider-rate-limit';

/** One suggested answer region as api-python returns it. */
interface RegionSuggestion {
  questionNumber: number | null;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  mapped: boolean;
}

/** Captured by tapping or bubbling, never read off a handwritten page. */
const AUTO_SCORED_QUESTION_TYPES: QuestionType[] = [QuestionType.MCQ, QuestionType.MULTI_CORRECT];

const REGION_DETECT_TIMEOUT_MS = 90_000;
// The longest a teacher's own request will sit waiting out a provider rate limit.
const REGION_DETECT_MAX_WAIT_MS = 45_000;
const REGION_DETECT_URL_TTL_SECONDS = 600;

/** One rendered page as api-python returns it. */
interface RenderedPage {
  pageNumber: number;
  width: number;
  height: number;
  imageBase64: string;
  contentType: string;
}

const PDF_RENDER_TIMEOUT_MS = 180_000;
const PDF_RENDER_URL_TTL_SECONDS = 900;
// A 60-page render comes back as base64 JPEGs in one response; axios' 10 MB
// default would truncate it into a confusing parse error.
const PDF_RENDER_MAX_RESPONSE_BYTES = 120 * 1024 * 1024;

/**
 * 23-DOCUMENT-PROCESSING-ARCHITECTURE.md §9 upload rules (photo capture row):
 * 10 MB/file for images, jpg/jpeg/png/webp/pdf.
 *
 * A PDF is now a first-class booklet upload: it is stored as-is and rendered
 * into page images by api-python (pypdfium2) through the pdf-split queue, after
 * which it is an ordinary document — same regions, same OCR, same review. It
 * used to be rejected with a 422 because no PDF library was wired.
 *
 * Every file is type-sniffed rather than trusted (upload-validation.ts), and
 * storage keys are generated rather than taken from the client's filename.
 * Malware scanning and EXIF stripping (also required by §9) are still not
 * implemented — no scanning provider is wired (17-THIRD-PARTY-INTEGRATIONS.md),
 * flagged here rather than pretended.
 */
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
    private readonly featureFlags: FeatureFlagsService,
    private readonly config: ConfigService,
    @InjectQueue(PDF_SPLIT_QUEUE) private readonly pdfSplitQueue: Queue<PdfSplitJobData>,
  ) {}

  // ── DocumentBundle ───────────────────────────────────────────────────────

  async createBundle(instituteId: string, dto: CreateDocumentBundleDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    // Founder Console Phase 3 — gated at bundle creation, the single entry
    // point into the whole document-processing pipeline for this institute.
    if (!(await this.featureFlags.isEnabled(instituteId, 'documentProcessing'))) {
      throw new ForbiddenException('Document processing is not enabled for this institute.');
    }

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
      throw new BadRequestException('At least one page image or a PDF booklet is required.');
    }

    // The bytes decide what each file is — a declared Content-Type is whatever
    // the uploading client chose to send.
    const checked = files.map((file) => {
      const name = displayName(file.originalname, 'file');
      const sniffed = sniffMimeType(file.buffer);
      if (!sniffed) {
        throw new UnprocessableEntityException(
          `${name}: unsupported file type — upload page images (jpg/png/webp) or a PDF booklet.`,
        );
      }
      const kind = kindOf(sniffed)!;
      const limit = kind === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) {
        throw new PayloadTooLargeException(`${name} exceeds the ${Math.round(limit / (1024 * 1024))} MB limit for ${kind === 'pdf' ? 'a PDF' : 'an image'}.`);
      }
      return { file, name, mimeType: sniffed, kind };
    });

    const pdfs = checked.filter((f) => f.kind === 'pdf');
    if (pdfs.length > 0) {
      if (checked.length > 1) {
        throw new BadRequestException('Upload a PDF booklet on its own — one PDF is one booklet.');
      }
      return this.uploadPdfDocument(instituteId, bundleId, pdfs[0]!, idempotencyCacheKey, actor);
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

      for (let i = 0; i < checked.length; i++) {
        const { file, mimeType } = checked[i]!;
        const page = await tx.page.create({ data: { documentId: doc.id, pageNumber: i + 1 } });
        // Generated object name — never the client's filename.
        const key = this.storage.buildKey(instituteId, 'documents', doc.id, 'pages', page.id, pageObjectName(i + 1, mimeType));
        await this.storage.upload(key, file.buffer, mimeType);
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

    const result = { documentId: document.id, status: document.status, pageCount: checked.length };
    await this.cache.set(idempotencyCacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  /**
   * A PDF booklet. The original is stored privately and the document goes
   * straight to PAGE_PROCESSING; the pdf-split queue renders its pages through
   * api-python and fills in Page/PageImage rows. Rendering is a queued job, not
   * part of this request: a 40-page scan takes seconds, retries on a transient
   * failure, and the teacher watches the status rather than a spinner.
   */
  private async uploadPdfDocument(
    instituteId: string,
    bundleId: string,
    upload: { file: UploadedFile; name: string; mimeType: string },
    idempotencyCacheKey: string,
    actor: AuthenticatedUser,
  ) {
    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: { documentBundleId: bundleId, layoutType: DocumentLayoutType.FREE_FORM, status: 'PAGE_PROCESSING' },
      });
      const key = this.storage.buildKey(instituteId, 'documents', doc.id, 'source.pdf');
      await this.storage.upload(key, upload.file.buffer, upload.mimeType);
      await tx.document.update({ where: { id: doc.id }, data: { sourceFileKey: key } });

      for (const stage of PATH_B_STAGES) {
        await tx.processingJob.create({ data: { documentId: doc.id, stage, status: ProcessingJobStatus.QUEUED } });
      }
      await tx.identityResolution.create({
        data: { documentId: doc.id, method: 'MANUAL_ADMIN_MATCH', confidence: 0 },
      });
      return doc;
    });

    await this.enqueuePdfSplit(instituteId, document.id);
    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'documents', document.id, null, { documentBundleId: bundleId, source: 'pdf' });

    const result = { documentId: document.id, status: 'PAGE_PROCESSING', pageCount: null };
    await this.cache.set(idempotencyCacheKey, result, IDEMPOTENCY_TTL_SECONDS);
    return result;
  }

  private async enqueuePdfSplit(instituteId: string, documentId: string) {
    await enqueueDeduped(
      this.pdfSplitQueue,
      'split',
      { instituteId, documentId },
      jobKey('pdf-split', documentId),
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 }, ...QUEUE_POLICY.pdfSplit.jobOptions },
      this.logger,
    );
  }

  /**
   * Called by PdfSplitProcessor. Renders the stored PDF into page images and
   * writes them as this document's pages.
   *
   * Idempotent: a retry after a partial failure starts from a clean slate,
   * because pages are only written once every page has rendered, in one
   * transaction. A PDF this service cannot render (password-protected, corrupt,
   * too many pages) fails the document rather than retrying forever — the
   * teacher has to upload a different file, and the reason is on the document.
   */
  async splitPdfDocument(job: PdfSplitJobData): Promise<void> {
    const document = await this.prisma.document.findUnique({ where: { id: job.documentId }, include: { pages: true } });
    if (!document) return;
    if (!document.sourceFileKey) {
      this.logger.warn(`pdf-split: document ${job.documentId} has no source PDF — nothing to render`);
      return;
    }
    if (document.pages.length > 0) return; // already rendered

    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const pdfUrl = await this.storage.getSignedDownloadUrl(document.sourceFileKey, PDF_RENDER_URL_TTL_SECONDS);

    let pages: RenderedPage[];
    try {
      const response = await axios.post<{ data: { pageCount: number; pages: RenderedPage[] } }>(
        `${baseUrl}/documents/render-pdf`,
        { pdfUrl },
        { headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined, timeout: PDF_RENDER_TIMEOUT_MS, maxContentLength: PDF_RENDER_MAX_RESPONSE_BYTES, maxBodyLength: PDF_RENDER_MAX_RESPONSE_BYTES },
      );
      pages = response.data.data.pages;
    } catch (err) {
      const rejected = axios.isAxiosError(err) && err.response?.status === 422;
      const detail = axios.isAxiosError(err) ? (err.response?.data as { detail?: string } | undefined)?.detail : undefined;
      if (rejected) {
        // Not retryable: the file itself is the problem, so record it and stop.
        await this.failDocument(job.documentId, detail ?? 'This PDF could not be read.');
        this.logger.warn(`pdf-split: document ${job.documentId} rejected — ${detail ?? 'unreadable PDF'}`);
        return;
      }
      this.logger.warn(`pdf-split: render call failed for document ${job.documentId}`, ensureDiagnosableMessage(err));
      throw ensureDiagnosableMessage(err);
    }

    if (pages.length === 0) {
      await this.failDocument(job.documentId, 'This PDF has no pages.');
      return;
    }

    const stored: { pageNumber: number; key: string }[] = [];
    for (const page of pages) {
      const key = this.storage.buildKey(job.instituteId, 'documents', job.documentId, 'pages', String(page.pageNumber), pageObjectName(page.pageNumber, page.contentType));
      await this.storage.upload(key, Buffer.from(page.imageBase64, 'base64'), page.contentType);
      stored.push({ pageNumber: page.pageNumber, key });
    }

    await this.prisma.$transaction(async (tx) => {
      const fresh = await tx.document.findUnique({ where: { id: job.documentId }, include: { pages: true } });
      if (!fresh || fresh.pages.length > 0) return; // a concurrent run won
      for (const { pageNumber, key } of stored) {
        const page = await tx.page.create({ data: { documentId: job.documentId, pageNumber } });
        await tx.pageImage.create({ data: { pageId: page.id, rawImageUrl: key } });
      }
      await tx.document.update({
        where: { id: job.documentId },
        data: { status: 'IDENTITY_PENDING', expectedPageCount: stored.length },
      });
      await tx.processingJob.updateMany({
        where: { documentId: job.documentId, stage: { in: [ProcessingStage.VALIDATE, ProcessingStage.PAGE_ORDER] } },
        data: { status: ProcessingJobStatus.SUCCEEDED, completedAt: new Date() },
      });
    });
    this.logger.log(`pdf-split: document ${job.documentId} rendered ${stored.length} page(s)`);
  }

  private async failDocument(documentId: string, reason: string) {
    await this.prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED' } });
    await this.prisma.processingJob.updateMany({
      where: { documentId, stage: ProcessingStage.VALIDATE },
      data: { status: ProcessingJobStatus.FAILED, errorMessage: reason.slice(0, 500), completedAt: new Date() },
    });
  }

  // ── Document reads ───────────────────────────────────────────────────────

  /** Lists Documents (booklets) in a bundle with lightweight status info —
   * the read the Teacher Document Queue UI needs; GET /documents/:id already
   * covers the single-document detail view, this is purely the missing list. */
  async findDocumentsForBundle(instituteId: string, bundleId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const bundle = await this.prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } },
    });
    if (!bundle || bundle.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Document bundle not found');
    }

    return this.prisma.document.findMany({
      where: { documentBundleId: bundleId },
      select: {
        id: true,
        status: true,
        layoutType: true,
        expectedPageCount: true,
        attemptId: true,
        createdAt: true,
        pages: { select: { id: true } },
        identityResolution: { select: { status: true, resolvedStudentProfileId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(instituteId: string, documentId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const document = await this.getDocumentWithTenantCheck(documentId, instituteId);
    return this.prisma.document.findUnique({
      where: { id: document.id },
      include: {
        pages: {
          orderBy: { pageNumber: 'asc' },
          include: {
            images: {
              include: {
                // Phase 11 (docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md): surfaces OCR
                // transcripts alongside each region, per 05-API-SPECIFICATION.md
                // (V2 section) §5 — "GET /documents/:id" region detail.
                regions: { include: { ocrBlocks: { include: { results: { orderBy: { processedAt: 'desc' } } } } } },
              },
            },
          },
        },
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

    // A PDF booklet whose render failed (or never ran) is retried by this same
    // action — otherwise "Retry processing" would reset the stage rows and then
    // wait for a worker that has nothing queued.
    const pageCount = await this.prisma.page.count({ where: { documentId } });
    if (document.sourceFileKey && pageCount === 0) {
      await this.enqueuePdfSplit(instituteId, documentId);
    }

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
      // was evidence for (if any) is no longer valid evidence for that question,
      // and deleting it takes its evaluation history with it. Refuse silently
      // throwing away a mark a teacher confirmed.
      await this.assertRegionMarksMayBeDiscarded(regionId, dto.discardMarks === true);
      await this.prisma.response.deleteMany({ where: { questionRegionId: regionId } });
    }

    // A moved or resized box invalidates the OCR read from the old one: the
    // stored reading stays (it is auditable) but is no longer CURRENT, so
    // OcrService re-queues the region and the evaluator refuses the stale text
    // (shared/region-box.ts). Editing the box is therefore always safe.
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

  /**
   * Asks api-python to suggest answer regions for every page that has none yet.
   *
   * Suggestions, never decisions: a box the model is not confident about is
   * created UNMAPPED (no questionId), so it cannot reach OCR or the AI until a
   * teacher says which question it is. Pages that already have answer regions
   * are left alone — a teacher's work is never overwritten.
   */
  async detectRegions(instituteId: string, documentId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const document = await this.getDocumentWithTenantCheck(documentId, instituteId);

    const pages = await this.prisma.page.findMany({
      where: { documentId },
      orderBy: { pageNumber: 'asc' },
      include: { images: { orderBy: { createdAt: 'desc' }, take: 1, include: { regions: { select: { id: true, regionType: true } } } } },
    });
    if (pages.length === 0) throw new BadRequestException('This booklet has no pages yet.');

    const paperItems = await this.prisma.paperItem.findMany({
      where: { paper: { assessments: { some: { deliveries: { some: { documentBundles: { some: { documents: { some: { id: documentId } } } } } } } } } },
      orderBy: { order: 'asc' },
      include: { question: { select: { id: true, type: true, content: true, marks: true } } },
    });
    // The numbering a student sees on the paper: position, not database id.
    const byNumber = new Map(paperItems.map((item, index) => [index + 1, item]));
    const questionHints = paperItems.map((item, index) => ({
      questionNumber: index + 1,
      text: item.question.content.slice(0, 160),
      marks: item.marks ?? item.question.marks,
    }));

    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');

    let created = 0;
    let unmapped = 0;
    let pagesProcessed = 0;
    let rateLimitedPages = 0;
    for (const page of pages) {
      const image = page.images[0];
      if (!image) continue;
      if (image.regions.some((r) => r.regionType === 'QUESTION_ANSWER')) continue; // teacher (or a previous run) already marked this page

      const imageUrl = await this.storage.getSignedDownloadUrl(image.processedImageUrl ?? image.rawImageUrl, REGION_DETECT_URL_TTL_SECONDS);
      const outcome = await this.suggestRegionsForPage(baseUrl, internalToken, imageUrl, questionHints, page.id);
      if (outcome.rateLimited) rateLimitedPages++;
      if (!outcome.suggestions) continue; // nothing came back for this page
      const suggestions = outcome.suggestions;
      pagesProcessed++;

      for (const suggestion of suggestions) {
        const item = suggestion.questionNumber ? byNumber.get(suggestion.questionNumber) : undefined;
        // Anything written out by hand can be mapped — including a numerical,
        // whose working is graded like any other written answer. Tick-box types
        // are the exception: those are captured, not read off the page.
        const mapped = suggestion.mapped && !!item && !AUTO_SCORED_QUESTION_TYPES.includes(item.question.type);
        await this.prisma.pageRegion.create({
          data: {
            pageImageId: image.id,
            boundingBox: suggestion.boundingBox as unknown as Prisma.InputJsonValue,
            regionType: 'QUESTION_ANSWER',
            questionId: mapped ? item!.question.id : null,
            detectionMethod: DetectionMethod.AUTO_LAYOUT_DETECTION,
            detectionConfidence: suggestion.confidence,
          },
        });
        created++;
        if (!mapped) unmapped++;
      }
    }

    if (created > 0) await syncPageRegionResponses(this.prisma, documentId);
    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'page_regions', documentId, null, { detected: created, unmapped, rateLimitedPages });
    return {
      pagesProcessed,
      created,
      unmapped,
      needsMapping: unmapped > 0,
      // Pages the provider was too busy for. The teacher can run this again in a
      // moment, or mark those pages by hand — either way they are told, rather
      // than being left to wonder why a page has no boxes.
      rateLimitedPages,
      layoutType: document.layoutType,
    };
  }

  /**
   * Suggestions for one page. `suggestions` is null when none were obtained —
   * either the provider is still rate-limiting (`rateLimited`, worth another go
   * in a moment) or the call failed outright.
   *
   * A 429 is waited out once (the provider says for how long) because detection
   * runs in the teacher's own request — spending their click to come back with
   * nothing would be worse than a short pause. Anything else is logged and the
   * page skipped: detection is an accelerator, never a dependency, and marking
   * boxes by hand always works.
   */
  private async suggestRegionsForPage(
    baseUrl: string | undefined,
    internalToken: string | undefined,
    imageUrl: string,
    questions: unknown[],
    pageId: string,
  ): Promise<{ suggestions: RegionSuggestion[] | null; rateLimited: boolean }> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await axios.post<{ data: RegionSuggestion[] }>(
          `${baseUrl}/documents/detect-regions`,
          { imageUrl, questions },
          { headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined, timeout: REGION_DETECT_TIMEOUT_MS },
        );
        return { suggestions: response.data.data ?? [], rateLimited: false };
      } catch (err) {
        const rateLimited = rateLimitFrom(err);
        if (rateLimited && attempt === 0) {
          const waitMs = Math.min(rateLimited.retryAfterMs, REGION_DETECT_MAX_WAIT_MS);
          this.logger.warn(`Region detection rate-limited for page ${pageId} — waiting ${Math.round(waitMs / 1000)}s`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        if (rateLimited) {
          this.logger.warn(`Region detection still rate-limited for page ${pageId} — leaving it for the teacher`);
          return { suggestions: null, rateLimited: true };
        }
        this.logger.warn(`Region detection failed for page ${pageId}`, ensureDiagnosableMessage(err));
        return { suggestions: null, rateLimited: false };
      }
    }
    return { suggestions: null, rateLimited: true };
  }

  /**
   * Removes a region a teacher does not want.
   *
   * If its answer already carries marks a human approved, deleting it would
   * delete those marks with it (Response -> Evaluation cascades), so that is
   * refused unless the teacher explicitly says to discard them.
   */
  async deleteRegion(instituteId: string, regionId: string, discardMarks: boolean, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const region = await this.prisma.pageRegion.findUnique({
      where: { id: regionId },
      include: { pageImage: { include: { page: true } } },
    });
    if (!region) throw new NotFoundException('Page region not found');
    const documentId = region.pageImage.page.documentId;
    await this.getDocumentWithTenantCheck(documentId, instituteId);
    await this.assertRegionMarksMayBeDiscarded(regionId, discardMarks);

    await this.prisma.$transaction(async (tx) => {
      await tx.response.deleteMany({ where: { questionRegionId: regionId } });
      await tx.pageRegion.delete({ where: { id: regionId } });
    });
    await this.writeAudit(instituteId, actor.id, AuditAction.DELETE, 'page_regions', regionId, { questionId: region.questionId }, null);
    return { deleted: true };
  }

  /** Refuses to throw away an approved mark by accident. */
  private async assertRegionMarksMayBeDiscarded(regionId: string, discardMarks: boolean) {
    if (discardMarks) return;
    const responses = await this.prisma.response.findMany({
      where: { questionRegionId: regionId },
      include: { evaluation: { include: { currentVersion: { select: { source: true } } } } },
    });
    const approved = responses.some((r) => isHumanApproved(r.evaluation?.currentVersion));
    if (approved) {
      throw new ConflictException({
        code: 'REGION_HAS_FINAL_MARKS',
        message: 'This answer already has marks a teacher confirmed. Changing the region will discard them — confirm to continue.',
      });
    }
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
