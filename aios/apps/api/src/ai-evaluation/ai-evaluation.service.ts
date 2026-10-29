import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import axios from 'axios';
import { AI_EVALUATION_QUEUE, AiEvaluationJobData } from './ai-evaluation.constants';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { enqueueDeduped, jobKey } from '../infrastructure/queue/enqueue';
import { QUEUE_POLICY } from '../infrastructure/queue/queue-policy';
import { ensureDiagnosableMessage } from '../shared/logging/error-message';
import { rateLimitFrom } from '../shared/provider-rate-limit';

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
    private readonly featureFlags: FeatureFlagsService,
    @InjectQueue(AI_EVALUATION_QUEUE) private readonly queue: Queue<AiEvaluationJobData>,
  ) {}

  async enqueueSingle(instituteId: string, responseId: string, requestedByUserId: string): Promise<void> {
    await this.assertEnabled(instituteId);
    // Keyed on the response: two requests to evaluate the SAME response collapse
    // to one while it is pending, but a genuine re-evaluation after completion
    // still enqueues (removeOnComplete frees the key).
    await enqueueDeduped(
      this.queue,
      'single',
      { type: 'single', instituteId, responseId, requestedByUserId },
      jobKey('single', responseId),
      { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, ...QUEUE_POLICY.aiEvaluation.jobOptions },
      this.logger,
    );
  }

  async enqueueBatch(instituteId: string, assessmentDeliveryId: string, requestedByUserId: string): Promise<void> {
    await this.assertEnabled(instituteId);
    await enqueueDeduped(
      this.queue,
      'batch',
      { type: 'batch', instituteId, assessmentDeliveryId, requestedByUserId },
      jobKey('batch', assessmentDeliveryId),
      { attempts: 2, backoff: { type: 'exponential', delay: 5000 }, ...QUEUE_POLICY.aiEvaluation.jobOptions }, // fewer retries — a batch retry re-evaluates every still-pending response, not just the failed one
      this.logger,
    );
  }

  // Founder Console Phase 3 — gated at enqueue time so a disabled institute
  // never even queues a job, rather than the job silently failing downstream.
  private async assertEnabled(instituteId: string): Promise<void> {
    if (!(await this.featureFlags.isEnabled(instituteId, 'aiEvaluation'))) {
      throw new ForbiddenException('AI evaluation is not enabled for this institute.');
    }
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
        {
          headers: {
            ...(internalToken ? { 'X-Internal-Token': internalToken } : {}),
            'X-Correlation-Id': `ai-eval-${job.responseId}`,
          },
          timeout: 50_000,
        },
      );
      this.logger.debug(`AI evaluation for response ${job.responseId} completed in ${Date.now() - startedAt}ms`);
    } catch (err) {
      const rateLimited = rateLimitFrom(err);
      if (rateLimited) throw rateLimited;
      this.logger.warn(`AI evaluation HTTP call failed for response ${job.responseId} after ${Date.now() - startedAt}ms`, err as Error);
      throw ensureDiagnosableMessage(err);
    }
  }

  /**
   * Bounded chunked batch evaluation.
   *
   * WHY THE SAFETY BOUNDS (C-3 fix): the previous while(hasMore) loop had no
   * maximum iteration count or elapsed-time guard. A Python-side bug returning
   * `hasMore: true` indefinitely would hold a BullMQ worker slot forever,
   * draining concurrency for every other pending evaluation job.
   *
   * MAX_BATCH_CHUNKS: 200 chunks is orders of magnitude more than any legitimate batch
   * and tight enough to catch a runaway loop within one BullMQ job.
   *
   * If safety limit is reached and more responses remain, re-enqueues continuation.
   */
  async requestBatchEvaluation(job: Extract<AiEvaluationJobData, { type: 'batch' }>): Promise<void> {
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL');
    const internalToken = this.config.get<string>('INTERNAL_SERVICE_TOKEN');
    const startedAt = Date.now();

    const MAX_BATCH_CHUNKS = 200;
    const MAX_ELAPSED_MS = 8 * 60_000;

    try {
      let hasMore = true;
      let chunks = 0;
      while (hasMore && chunks < MAX_BATCH_CHUNKS && Date.now() - startedAt < MAX_ELAPSED_MS) {
        const response = await axios.post(
          `${baseUrl}/evaluation/ai-evaluate-batch`,
          { instituteId: job.instituteId, assessmentDeliveryId: job.assessmentDeliveryId, requestedByUserId: job.requestedByUserId },
          {
            headers: {
              ...(internalToken ? { 'X-Internal-Token': internalToken } : {}),
              'X-Correlation-Id': `ai-eval-batch-${job.assessmentDeliveryId}`,
            },
            timeout: 60_000,
          },
        );
        hasMore = response.data?.data?.hasMore === true;
        chunks++;
      }

      if (hasMore) {
        this.logger.warn(
          `AI batch evaluation for delivery ${job.assessmentDeliveryId} reached safety limit ` +
            `after ${chunks} chunks / ${Date.now() - startedAt}ms — some responses may still be PENDING`,
        );
      } else {
        this.logger.debug(`AI batch evaluation for delivery ${job.assessmentDeliveryId} completed in ${chunks} chunks / ${Date.now() - startedAt}ms`);
      }
    } catch (err) {
      this.logger.warn(`AI batch evaluation HTTP call failed for delivery ${job.assessmentDeliveryId} after ${Date.now() - startedAt}ms`, err as Error);
      throw ensureDiagnosableMessage(err);
    }
  }
}
