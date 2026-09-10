import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ScoreAggregationService } from './score-aggregation.service';
import { SCORE_AGGREGATION_QUEUE, ScoreAggregationJobData } from './score-aggregation.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';

/**
 * Consumes score-aggregation jobs enqueued on every EvaluationVersion write
 * (25-EVALUATION-ENGINE.md §5). Same structure as MasteryRecalcProcessor.
 */
@Processor(SCORE_AGGREGATION_QUEUE, workerOptions(QUEUE_POLICY.scoreAggregation))
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
    reportDeadLetter('score-aggregation', job, err, this.logger, { attemptId: job?.data.attemptId });
  }
}
