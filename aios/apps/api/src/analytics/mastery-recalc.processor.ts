import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AnalyticsService } from './analytics.service';
import { MASTERY_RECALC_QUEUE, MasteryRecalcJobData } from './mastery-recalc.constants';

/**
 * Consumes mastery-recalc jobs enqueued on marks-capture commit (11-PERFORMANCE-
 * REQUIREMENTS.md: grading write stays <300ms, recalc happens async within ~10s).
 * Retries per 08-ERROR-HANDLING.md's async job failure policy; a job that exhausts
 * its attempts is logged at error severity (BullMQ's "failed" set is this queue's
 * dead-letter — see FounderHealth/AdminAuditLogs surfacing per 12-LOGGING-MONITORING.md).
 */
@Processor(MASTERY_RECALC_QUEUE, {
  // 08-ERROR-HANDLING.md: 3 attempts, exponential backoff (~1s/5s/25s intent — approximated
  // here with BullMQ's built-in exponential strategy; exact intervals can be tuned via a
  // custom backoff strategy later if the precise curve matters).
})
export class MasteryRecalcProcessor extends WorkerHost {
  private readonly logger = new Logger(MasteryRecalcProcessor.name);

  constructor(private readonly analyticsService: AnalyticsService) {
    super();
  }

  async process(job: Job<MasteryRecalcJobData>): Promise<void> {
    await this.analyticsService.requestMasteryRecalc(job.data.studentProfileId, job.data.topicIds);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<MasteryRecalcJobData> | undefined, err: Error) {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      this.logger.error(
        `mastery-recalc job ${job.id} exhausted all retries for student ${job.data.studentProfileId} — dead-lettered`,
        err.stack,
      );
    } else {
      this.logger.warn(`mastery-recalc job ${job.id} failed (attempt ${job.attemptsMade}), will retry: ${err.message}`);
    }
  }
}
