import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OcrService } from './ocr.service';
import { OCR_QUEUE, OcrJobData } from './ocr.constants';

/**
 * Consumes ocr jobs enqueued once a QuestionRegion is confirmed mapped to a
 * question. Retries per 08-ERROR-HANDLING.md's async job failure policy,
 * mirroring MasteryRecalcProcessor's structure exactly.
 */
@Processor(OCR_QUEUE)
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(private readonly ocrService: OcrService) {
    super();
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    await this.ocrService.requestOcrExtraction(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OcrJobData> | undefined, err: Error) {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      this.logger.error(
        `ocr job ${job.id} exhausted all retries for region ${job.data.questionRegionId} — dead-lettered`,
        err.stack,
      );
    } else {
      this.logger.warn(`ocr job ${job.id} failed (attempt ${job.attemptsMade}), will retry: ${err.message}`);
    }
  }
}
