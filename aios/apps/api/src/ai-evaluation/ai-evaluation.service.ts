import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { AI_EVALUATION_QUEUE, AiEvaluationJobData } from './ai-evaluation.constants';

/**
 * 27-AI-EVALUATION-ARCHITECTURE.md §6: AI evaluation runs as a batched async
 * job, never a synchronous request from the teacher's browser — mirrors
 * AnalyticsService's mastery-recalc queue/HTTP-call structure.
 */
@Injectable()
export class AiEvaluationService {
  private readonly logger = new Logger(AiEvaluationService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectQueue(AI_EVALUATION_QUEUE) private readonly queue: Queue<AiEvaluationJobData>,
  ) {}

  async enqueueSingle(instituteId: string, responseId: string, requestedByUserId: string): Promise<void> {
    await this.queue.add(
      'single',
      { type: 'single', instituteId, responseId, requestedByUserId },
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 } },
    );
  }

  async enqueueBatch(instituteId: string, assessmentDeliveryId: string, requestedByUserId: string): Promise<void> {
    await this.queue.add(
      'batch',
      { type: 'batch', instituteId, assessmentDeliveryId, requestedByUserId },
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 } }, // fewer retries — a batch retry re-evaluates every still-pending response, not just the failed one
    );
  }

  /** Called by AiEvaluationProcessor. 27 §6: 8s soft / 20s hard per response — this is the single-response call. */
  async requestSingleEvaluation(job: Extract<AiEvaluationJobData, { type: 'single' }>): Promise<void> {
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const startedAt = Date.now();

    try {
      await axios.post(
        `${baseUrl}/evaluation/ai-evaluate`,
        { instituteId: job.instituteId, responseId: job.responseId, requestedByUserId: job.requestedByUserId },
        { headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined, timeout: 20_000 },
      );
      this.logger.debug(`AI evaluation for response ${job.responseId} completed in ${Date.now() - startedAt}ms`);
    } catch (err) {
      this.logger.warn(`AI evaluation HTTP call failed for response ${job.responseId} after ${Date.now() - startedAt}ms`, err as Error);
      throw err;
    }
  }

  /** 27 §9: up to ~15 minutes p95 for a 200-response delivery — the HTTP call is held open for the whole batch rather than polled, a known limitation for a future pass at real scale. */
  async requestBatchEvaluation(job: Extract<AiEvaluationJobData, { type: 'batch' }>): Promise<void> {
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const startedAt = Date.now();

    try {
      await axios.post(
        `${baseUrl}/evaluation/ai-evaluate-batch`,
        { instituteId: job.instituteId, assessmentDeliveryId: job.assessmentDeliveryId, requestedByUserId: job.requestedByUserId },
        { headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined, timeout: 20 * 60_000 },
      );
      this.logger.debug(`AI batch evaluation for delivery ${job.assessmentDeliveryId} completed in ${Date.now() - startedAt}ms`);
    } catch (err) {
      this.logger.warn(`AI batch evaluation HTTP call failed for delivery ${job.assessmentDeliveryId} after ${Date.now() - startedAt}ms`, err as Error);
      throw err;
    }
  }
}
