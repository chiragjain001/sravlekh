import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScoreAggregationService } from './score-aggregation.service';
import { SCORE_AGGREGATION_QUEUE, ScoreAggregationJobData } from './score-aggregation.constants';

/**
 * Consumes score-aggregation jobs enqueued on every EvaluationVersion write
 * (25-EVALUATION-ENGINE.md §5). Same structure as MasteryRecalcProcessor.
 */
@Processor(SCORE_AGGREGATION_QUEUE)
export class ScoreAggregationProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoreAggregationProcessor.name);

  constructor(private readonly scoreAggregationService: ScoreAggregationService) {
    super();
  }

  async process(job: Job<ScoreAggregationJobData>): Promise<void> {
    await this.scoreAggregationService.recalculate(job.data.attemptId);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<ScoreAggregationJobData> | undefined, err: Error) {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      this.logger.error(
        `score-aggregation job ${job.id} exhausted all retries for attempt ${job.data.attemptId} — dead-lettered`,
        err.stack,
      );
    } else {
      this.logger.warn(`score-aggregation job ${job.id} failed (attempt ${job.attemptsMade}), will retry: ${err.message}`);
    }
  }
}
