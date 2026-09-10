import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { CacheService } from '../cache/cache.service';

/**
 * Redis-backed rate-limit storage.
 *
 * WHY: ThrottlerModule was using its default in-memory storage, so the effective
 * limit multiplied by instance count — three API instances meant three times the
 * configured requests per second, per client. That applies to the login endpoint
 * too, which 07-SECURITY-SPECIFICATION.md §7 pins explicitly at 10/s + 100/min
 * precisely because it is the abuse target. A rate limit that silently relaxes
 * as you scale is the opposite of what a rate limit is for.
 *
 * Written against the existing CacheService rather than pulling in a third-party
 * storage package: it already owns a Redis client, so this adds no dependency
 * and no third connection.
 *
 * DEGRADATION: if Redis is unreachable the counter falls back to a per-instance
 * Map. That is weaker than distributed counting, but the alternative is either
 * no limiting at all or rejecting every request during a Redis blip. The
 * fallback is announced once per outage rather than per request.
 */
@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly local = new Map<string, { count: number; expiresAt: number; blockedUntil: number }>();
  private degradedSince = 0;

  constructor(private readonly cache: CacheService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    // ttl and blockDuration arrive in milliseconds; Redis expiry is in seconds.
    const ttlSeconds = Math.max(1, Math.ceil(ttl / 1000));
    const namespaced = `throttle:${throttlerName}:${key}`;

    const blocked = await this.cache.get<number>(`${namespaced}:blocked`);
    if (blocked !== undefined) {
      return { totalHits: limit + 1, timeToExpire: ttlSeconds, isBlocked: true, timeToBlockExpire: Math.ceil(blockDuration / 1000) };
    }

    const counted = await this.cache.incrWithTtl(namespaced, ttlSeconds);
    if (counted === undefined) {
      return this.incrementLocally(namespaced, ttl, limit, blockDuration);
    }

    if (this.degradedSince !== 0) {
      this.logger.log('Distributed rate limiting restored.');
      this.degradedSince = 0;
      this.local.clear();
    }

    const isBlocked = counted.count > limit;
    if (isBlocked && blockDuration > 0) {
      await this.cache.set(`${namespaced}:blocked`, Date.now(), Math.max(1, Math.ceil(blockDuration / 1000)));
    }

    return {
      totalHits: counted.count,
      timeToExpire: Math.ceil(counted.ttlMs / 1000),
      isBlocked,
      timeToBlockExpire: Math.ceil(blockDuration / 1000),
    };
  }

  /** Per-instance counting, used only while Redis is unreachable. */
  private incrementLocally(key: string, ttl: number, limit: number, blockDuration: number): ThrottlerStorageRecord {
    if (this.degradedSince === 0) {
      this.degradedSince = Date.now();
      this.logger.warn(
        'Redis unavailable — rate limiting has degraded to per-instance counting. ' +
          'Effective limits are multiplied by the number of running instances until Redis returns.',
      );
    }

    const now = Date.now();
    const entry = this.local.get(key);
    if (!entry || entry.expiresAt <= now) {
      this.local.set(key, { count: 1, expiresAt: now + ttl, blockedUntil: 0 });
      return { totalHits: 1, timeToExpire: Math.ceil(ttl / 1000), isBlocked: false, timeToBlockExpire: 0 };
    }

    if (entry.blockedUntil > now) {
      return {
        totalHits: entry.count,
        timeToExpire: Math.ceil((entry.expiresAt - now) / 1000),
        isBlocked: true,
        timeToBlockExpire: Math.ceil((entry.blockedUntil - now) / 1000),
      };
    }

    entry.count += 1;
    const isBlocked = entry.count > limit;
    if (isBlocked && blockDuration > 0) entry.blockedUntil = now + blockDuration;

    return {
      totalHits: entry.count,
      timeToExpire: Math.ceil((entry.expiresAt - now) / 1000),
      isBlocked,
      timeToBlockExpire: isBlocked ? Math.ceil(blockDuration / 1000) : 0,
    };
  }
}
