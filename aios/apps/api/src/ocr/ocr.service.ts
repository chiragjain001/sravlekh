import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { OCR_QUEUE, OcrJobData } from './ocr.constants';

/**
 * 24-OCR-HANDWRITING-ARCHITECTURE.md. Only ever enqueues blockType=
 * HANDWRITTEN_TEXT — doc §4.2 calls this "the primary, highest-value... path"
 * for exam answers, and there is deliberately no way yet for a teacher to
 * mark a region as a diagram/table/math-expression before extraction (that
 * would mean extending Phase 10's PageRegion authoring DTOs, scoped out here
 * to avoid touching already-tested Phase 10 code — see docs/33 Phase 11
 * write-up). PRINTED_TEXT/MATHEMATICAL_EXPRESSION/DIAGRAM_SKETCH/TABLE are
 * all real, tested extraction paths in apps/api-python; only the auto-trigger
 * here is narrowed.
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue(OCR_QUEUE) private readonly ocrQueue: Queue<OcrJobData>,
  ) {}

  /** Enqueues extraction for every confirmed QuestionRegion on this document that doesn't already have an OCRResult. */
  async enqueueForDocument(instituteId: string, documentId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { documentBundle: { include: { assessmentDelivery: { include: { assessment: { select: { instituteId: true } } } } } } },
    });
    if (!document || document.documentBundle?.assessmentDelivery.assessment.instituteId !== instituteId) {
      throw new NotFoundException('Document not found');
    }

    const regions = await this.prisma.pageRegion.findMany({
      where: { questionId: { not: null }, regionType: 'QUESTION_ANSWER', pageImage: { page: { documentId } } },
      include: { pageImage: true, ocrBlocks: { include: { results: true } } },
    });

    let enqueuedCount = 0;
    for (const region of regions) {
      const alreadyExtracted = region.ocrBlocks.some((block) => block.results.length > 0);
      if (alreadyExtracted) continue;

      const imageKey = region.pageImage.processedImageUrl ?? region.pageImage.rawImageUrl;
      await this.ocrQueue.add(
        'extract',
        { instituteId, questionRegionId: region.id, imageKey, blockType: 'HANDWRITTEN_TEXT' },
        { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
      );
      enqueuedCount++;
    }

    return { enqueuedCount, totalRegions: regions.length };
  }

  /** Called by OcrProcessor — the queue's retry/backoff wraps this call. Signs the image URL fresh here, not at enqueue time. */
  async requestOcrExtraction(job: OcrJobData): Promise<void> {
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const startedAt = Date.now();

    const imageUrl = await this.storage.getSignedDownloadUrl(job.imageKey, 600);

    try {
      await axios.post(
        `${baseUrl}/ocr/extract`,
        { instituteId: job.instituteId, questionRegionId: job.questionRegionId, imageUrl, blockType: job.blockType },
        {
          headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined,
          timeout: 20_000, // 24 §8: single-block extraction target < 4s p95; generous margin for a cold vision-model call
        },
      );
      this.logger.debug(`OCR extraction for region ${job.questionRegionId} completed in ${Date.now() - startedAt}ms`);
    } catch (err) {
      this.logger.warn(`OCR extraction HTTP call failed for region ${job.questionRegionId} after ${Date.now() - startedAt}ms`, err as Error);
      throw err;
    }
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }
}
