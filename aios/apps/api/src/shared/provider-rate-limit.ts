import { HttpStatus } from '@nestjs/common';
import { DelayedError, Job } from 'bullmq';
import axios from 'axios';

/**
 * What to do when api-python answers 429: the AI provider is asking for a pause,
 * not failing.
 *
 * Retrying a rate-limited call on the queue's normal 1s/2s/4s backoff burns all
 * three attempts inside ten seconds and dead-letters work that would have
 * succeeded — seen for real on staging, where one booklet's region detection plus
 * OCR burst tripped a per-minute quota and four OCR jobs died. Instead the job
 * goes back on the queue after the delay the provider itself asked for
 * (Retry-After), without consuming an attempt.
 */

const DEFAULT_RETRY_AFTER_SECONDS = 30;
const MAX_RETRY_AFTER_SECONDS = 300;

export class ProviderRateLimitError extends Error {
  constructor(readonly retryAfterMs: number) {
    super(`AI provider rate-limited this request; retry in ${Math.round(retryAfterMs / 1000)}s`);
    this.name = 'ProviderRateLimitError';
  }
}

/** A ProviderRateLimitError when `err` is api-python's 429, otherwise null. */
export function rateLimitFrom(err: unknown): ProviderRateLimitError | null {
  if (!axios.isAxiosError(err) || err.response?.status !== HttpStatus.TOO_MANY_REQUESTS) return null;
  const header = err.response.headers?.['retry-after'];
  const seconds = Number(Array.isArray(header) ? header[0] : header);
  const wait = Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_AFTER_SECONDS;
  return new ProviderRateLimitError(Math.min(wait, MAX_RETRY_AFTER_SECONDS) * 1000);
}

/**
 * Reschedules `job` when `err` is a provider rate limit, and throws BullMQ's
 * DelayedError so the worker releases it instead of completing or failing it.
 * Returns normally when `err` is something else, for the caller to rethrow.
 *
 * `moveToDelayed` with the worker's token is BullMQ's own "not now, later" path:
 * the job leaves the active set, comes back after the delay and keeps its
 * attempts, which is exactly what a 429 needs.
 */
export async function deferIfRateLimited(
  job: Job,
  err: unknown,
  token: string | undefined,
  log: (message: string) => void,
): Promise<void> {
  if (!(err instanceof ProviderRateLimitError) || !token) return;
  log(`provider rate-limited — job ${job.id} will retry in ${Math.round(err.retryAfterMs / 1000)}s`);
  await job.moveToDelayed(Date.now() + err.retryAfterMs, token);
  throw new DelayedError();
}
