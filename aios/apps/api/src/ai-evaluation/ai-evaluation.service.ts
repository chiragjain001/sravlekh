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
        // Above api-python's AI_CALL_HARD_TIMEOUT_SECONDS (40s) so Python times out and
        // routes to the human queue first, instead of this side abandoning a live call.
        { headers: internalToken ? { 'X-Internal-Token': internalToken } : undefined, timeout: 50_000 },
      );
      this.logger.debug(`AI evaluation for response ${job.responseId} completed in ${Date.now() - startedAt}ms`);
    } catch (err) {
      const rateLimited = rateLimitFrom(err);
      if (rateLimited) throw rateLimited;
      this.logger.warn(`AI evaluation HTTP call failed for response ${job.responseId} after ${Date.now() - startedAt}ms`, err as Error);
      throw ensureDiagnosableMessage(err);
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
      throw ensureDiagnosableMessage(err);
    }
  }
}
