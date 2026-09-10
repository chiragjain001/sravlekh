import { CacheService } from '../cache/cache.service';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * The behaviour that matters: the configured limit must be the limit regardless
 * of how many API instances are running. With the previous in-memory storage it
 * multiplied by instance count — including on the login endpoint, which
 * 07-SECURITY-SPECIFICATION.md §7 pins explicitly.
 */
describe('RedisThrottlerStorage', () => {
  function workingRedis() {
    const counters = new Map<string, number>();
    const blocks = new Set<string>();
    return {
      counters,
      blocks,
      get: jest.fn(async (k: string) => (blocks.has(k) ? Date.now() : undefined)),
      set: jest.fn(async (k: string) => { blocks.add(k); }),
      incrWithTtl: jest.fn(async (k: string, ttl: number) => {
        const next = (counters.get(k) ?? 0) + 1;
        counters.set(k, next);
        return { count: next, ttlMs: ttl * 1000 };
      }),
    } as unknown as CacheService & { counters: Map<string, number>; blocks: Set<string> };
  }

  it('counts through Redis, so two instances share one budget', async () => {
    const redis = workingRedis();
    const instanceA = new RedisThrottlerStorage(redis);
    const instanceB = new RedisThrottlerStorage(redis);

    await instanceA.increment('1.2.3.4', 1000, 10, 0, 'short');
    await instanceB.increment('1.2.3.4', 1000, 10, 0, 'short');
    const third = await instanceA.increment('1.2.3.4', 1000, 10, 0, 'short');

    // 3 across two instances, not 2-and-1 counted separately.
    expect(third.totalHits).toBe(3);
  });

  it('blocks once the limit is exceeded', async () => {
    const redis = workingRedis();
    const storage = new RedisThrottlerStorage(redis);

    let record = await storage.increment('ip', 1000, 2, 5000, 'short');
    record = await storage.increment('ip', 1000, 2, 5000, 'short');
    expect(record.isBlocked).toBe(false);

    record = await storage.increment('ip', 1000, 2, 5000, 'short');
    expect(record.isBlocked).toBe(true);
  });

  it('namespaces by throttler, so the 1s and 1m windows do not share a counter', async () => {
    const redis = workingRedis();
    const storage = new RedisThrottlerStorage(redis);

    await storage.increment('ip', 1000, 10, 0, 'short');
    const medium = await storage.increment('ip', 60_000, 100, 0, 'medium');

    expect(medium.totalHits).toBe(1);
  });

  it('falls back to per-instance counting when Redis is unreachable', async () => {
    // Weaker than distributed, but the alternatives are no limiting at all or
    // rejecting every request during a Redis blip.
    const down = {
      get: jest.fn(async () => undefined),
      set: jest.fn(async () => {}),
      incrWithTtl: jest.fn(async () => undefined),
    } as unknown as CacheService;
    const storage = new RedisThrottlerStorage(down);

    const first = await storage.increment('ip', 1000, 2, 0, 'short');
    const second = await storage.increment('ip', 1000, 2, 0, 'short');
    const third = await storage.increment('ip', 1000, 2, 0, 'short');

    expect(first.totalHits).toBe(1);
    expect(second.totalHits).toBe(2);
    expect(third.isBlocked).toBe(true); // still limiting, just not across instances
  });
});
