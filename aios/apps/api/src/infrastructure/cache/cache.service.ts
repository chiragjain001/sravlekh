import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/**
 * 09-CACHING-STRATEGY.md: a thin Redis wrapper, deliberately separate from
 * QueueModule's connection (that one is BullMQ-managed and configured for job
 * semantics, not general key-value caching). Every method fails open to the
 * caller — a cache miss/error looks identical to a cold cache, never a thrown
 * error, so Redis unavailability degrades to direct-DB reads (§5) rather than
 * breaking requests.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL is not configured — defaulting to redis://localhost:6379 for the cache client.');
    }
    this.client = new Redis(url ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 1,
      lazyConnect: false,
      retryStrategy: () => null, // don't hammer a genuinely-down Redis with reconnect storms
      // Critical for the fail-open guarantee below: ioredis's default (true)
      // queues commands issued while disconnected instead of rejecting them,
      // so a get()/set() call would hang forever waiting on a connection that
      // never completes — the try/catch in every method below would never
      // fire, and a request would block indefinitely instead of falling
      // through to the DB. false makes a command issued while disconnected
      // reject immediately, which the try/catch does correctly handle.
      enableOfflineQueue: false,
    });
    this.client.on('error', (err) => this.logger.warn(`Cache Redis connection error: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch (err) {
      this.logger.warn(`Cache read failed for key "${key}" — falling through to DB`, err as Error);
      return undefined;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache write failed for key "${key}"`, err as Error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Cache delete failed for key "${key}"`, err as Error);
    }
  }

  /** Prefix-scan delete, per doc 09 §3's key-format convention (e.g. a full-tenant flush on institute archival). */
  async delByPrefix(prefix: string): Promise<void> {
    try {
      const stream = this.client.scanStream({ match: `${prefix}*`, count: 100 });
      const keys: string[] = [];
      for await (const batch of stream) {
        keys.push(...(batch as string[]));
      }
      if (keys.length > 0) await this.client.del(...keys);
    } catch (err) {
      this.logger.warn(`Cache prefix-delete failed for "${prefix}*"`, err as Error);
    }
  }
}
