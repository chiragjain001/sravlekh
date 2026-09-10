import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Job } from 'bullmq';
import { describeError } from './error-message';

/**
 * 12-LOGGING-MONITORING.md §7 / v2 addendum: "Async job dead-letter rate > 0"
 * pages on-call — for v2, extended to every new queue and "any stage" of the
 * document pipeline. Before Phase 15, every processor's `@OnWorkerEvent('failed')`
 * handler only called `logger.error()`/`logger.warn()` — that never reaches
 * Sentry, because BullMQ's WorkerHost failure path never passes through
 * `AllExceptionsFilter` (that filter is HTTP-request-cycle only, per
 * `main.ts`). A dead-lettered background job was therefore invisible to the
 * exact alerting pipeline this doc row exists to trigger. This closes that
 * gap for all six queues in one place rather than duplicating the Sentry call
 * six times (and risking the next new queue forgetting it).
 */
export function reportDeadLetter(
  queue: string,
  job: Job | undefined,
  err: Error,
  logger: Logger,
  context: Record<string, unknown> = {},
): void {
  if (!job) return;
  const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
  const label = `${queue} job ${job.id}`;

  // describeError, not err.message: an AggregateError (every dual-stack
  // connection refusal) has an empty message, which made this line read
  // "will retry: " with nothing after it — see error-message.ts. The throw
  // sites already repair the message before BullMQ stores it, so this is
  // belt-and-braces for any error that reaches here from another path.
  const reason = describeError(err);

  if (!exhausted) {
    logger.warn(`${label} failed (attempt ${job.attemptsMade}), will retry: ${reason}`);
    return;
  }

  logger.error(`${label} exhausted all retries — dead-lettered: ${reason} ${JSON.stringify(context)}`, err.stack);
  Sentry.captureException(err, {
    tags: { queue, jobId: String(job.id), deadLettered: 'true' },
    extra: context,
  });
}
