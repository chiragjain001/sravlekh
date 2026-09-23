import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { deferIfRateLimited } from '../shared/provider-rate-limit';
import { AiEvaluationService } from './ai-evaluation.service';
import { AI_EVALUATION_QUEUE, AiEvaluationJobData } from './ai-evaluation.constants';
import { reportDeadLetter } from '../shared/logging/dead-letter';
import { QUEUE_POLICY, workerOptions } from '../infrastructure/queue/queue-policy';

@Processor(AI_EVALUATION_QUEUE, workerOptions(QUEUE_POLICY.aiEvaluation))
export class AiEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiEvaluationProcessor.name);

  constructor(private readonly aiEvaluationService: AiEvaluationService) {
    super();
  }

  async process(job: Job<AiEvaluationJobData>, token?: string): Promise<void> {
    try {
      if (job.data.type === 'single') {
        await this.aiEvaluationService.requestSingleEvaluation(job.data);
      } else {
        await this.aiEvaluationService.requestBatchEvaluation(job.data);
      }
    } catch (err) {
      // Rate-limited jobs are rescheduled, not retried immediately or failed.
      await deferIfRateLimited(job, err, token, (m) => this.logger.warn(m));
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiEvaluationJobData> | undefined, err: Error) {
    const target = job && (job.data.type === 'single' ? { responseId: job.data.responseId } : { assessmentDeliveryId: job.data.assessmentDeliveryId });
    reportDeadLetter('ai-evaluation', job, err, this.logger, target ?? {});
  }
}
