import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AiEvaluationService } from './ai-evaluation.service';
import { AI_EVALUATION_QUEUE, AiEvaluationJobData } from './ai-evaluation.constants';

@Processor(AI_EVALUATION_QUEUE)
export class AiEvaluationProcessor extends WorkerHost {
  private readonly logger = new Logger(AiEvaluationProcessor.name);

  constructor(private readonly aiEvaluationService: AiEvaluationService) {
    super();
  }

  async process(job: Job<AiEvaluationJobData>): Promise<void> {
    if (job.data.type === 'single') {
      await this.aiEvaluationService.requestSingleEvaluation(job.data);
    } else {
      await this.aiEvaluationService.requestBatchEvaluation(job.data);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<AiEvaluationJobData> | undefined, err: Error) {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const target = job.data.type === 'single' ? `response ${job.data.responseId}` : `delivery ${job.data.assessmentDeliveryId}`;
    if (exhausted) {
      this.logger.error(`ai-evaluation job ${job.id} exhausted all retries for ${target} — dead-lettered`, err.stack);
    } else {
      this.logger.warn(`ai-evaluation job ${job.id} failed (attempt ${job.attemptsMade}) for ${target}, will retry: ${err.message}`);
    }
  }
}
