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
        const connection = new Redis(url ?? 'redis://localhost:6379', {
          maxRetriesPerRequest: null,
          lazyConnect: false,
        });
        connection.on('error', (err) => logger.warn(`Redis connection error: ${err.message}`));
        return { connection };
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
