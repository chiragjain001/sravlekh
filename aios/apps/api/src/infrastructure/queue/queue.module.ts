import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import Redis from 'ioredis';

const logger = new Logger('QueueModule');

/**
 * Global BullMQ connection, shared by every queue registered elsewhere via
 * BullModule.registerQueue(). See 09-CACHING-STRATEGY.md / 10-SCALABILITY-STRATEGY.md —
 * Redis backs both caching and the async job queues (mastery-recalc today; document-
 * processing/ocr/ai-evaluation/evaluation-aggregation in v2).
 *
 * REDIS_URL is optional in env.schema.ts (matching 09's "Redis unavailable degrades
 * gracefully" philosophy for caching); for queues specifically, an unreachable Redis
 * means queued jobs simply won't process until it's back — ioredis retries the
 * connection in the background rather than crashing the app on boot.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        if (!url) {
          logger.warn(
            'REDIS_URL is not configured — defaulting to redis://localhost:6379. ' +
              'Async job queues (mastery recalc, etc.) will not process without a reachable Redis.',
          );
        }
        // BullMQ requires maxRetriesPerRequest: null on the connection it manages —
        // it handles its own retry/backoff at the job level (see docs/08-ERROR-HANDLING.md).
        //
        // retryStrategy: exponential backoff capped at 30 s so a missing local Redis
        // doesn't flood the log with a warning every 2 s.  The connection keeps
        // retrying in the background — the app does not crash (graceful degradation).
        const connection = new Redis(url ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
          lazyConnect: false,
          retryStrategy: (attempt) => Math.min(100 * Math.pow(2, attempt), 30_000),
        });

        // Throttle the error log: emit once immediately, then at most once per 30 s.
        let lastLoggedAt = 0;
        connection.on('error', (err: Error) => {
          const now = Date.now();
          if (now - lastLoggedAt >= 30_000) {
            lastLoggedAt = now;
            const reason = err.message || 'ECONNREFUSED (Redis not reachable)';
            logger.warn(
              `Redis unavailable — queued jobs will not process until Redis is running. ` +
                `Reason: ${reason}. Retrying with exponential back-off (max 30 s interval).`,
            );
          }
        });

        return {
          connection,
          // Retention. Without this every completed and failed job was kept in
          // Redis forever: memory grew without bound and the failure mode was an
          // OOM weeks after launch, when the queue silently stops accepting work.
          //
          // removeOnComplete: true rather than a count/age window, because job
          // ids are used as dedupe keys (see enqueueDeduped) and BullMQ refuses
          // an `add` whose jobId still exists in ANY state. Retaining completed
          // jobs would therefore block legitimate re-processing — re-running an
          // evaluation, re-extracting a corrected OCR region — which matters more
          // than a "completed" count that logs already record.
          //
          // Failures ARE retained, bounded, so the founder queue-metrics view and
          // manual inspection still work. enqueueDeduped clears a superseded
          // failed job by id, so retention never blocks a retry either.
          // Diagnosis itself does not depend on this: reportDeadLetter already
          // writes the error, stack, payload context and a Sentry event.
          // SAFETY NET ONLY. Every producer sets its queue's own policy from
          // QUEUE_POLICY (queue-policy.ts), sized per queue by volume, cost per
          // job and what a lost job costs a real person. This default exists so
          // that a queue added later without a policy still cannot retain jobs
          // forever — it is the floor, not the intended configuration.
          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: { count: 200, age: 7 * 24 * 60 * 60 },
          },
        };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
