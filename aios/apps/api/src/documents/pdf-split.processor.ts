import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { DocumentsService } from './documents.service';
import { PDF_SPLIT_QUEUE, PdfSplitJobData } from './documents.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';

/**
 * Renders an uploaded PDF booklet into page images (DocumentsService.splitPdfDocument).
 * Same structure as OcrProcessor. A PDF the renderer rejects is not retried —
 * the service marks the document FAILED with the reason, because re-rendering
 * the same unreadable file cannot succeed.
 */
@Processor(PDF_SPLIT_QUEUE, workerOptions(QUEUE_POLICY.pdfSplit))
export class PdfSplitProcessor extends WorkerHost {
  private readonly logger = new Logger(PdfSplitProcessor.name);

  constructor(private readonly documentsService: DocumentsService) {
    super();
  }

  async process(job: Job<PdfSplitJobData>): Promise<void> {
    await this.documentsService.splitPdfDocument(job.data);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<PdfSplitJobData> | undefined, err: Error) {
    reportDeadLetter('pdf-split', job, err, this.logger, { documentId: job?.data.documentId });
  }
}
