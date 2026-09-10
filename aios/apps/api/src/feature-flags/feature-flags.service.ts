import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';

// 09-CACHING-STRATEGY.md §1.3 pattern, mirrored from InstitutesService/
// FounderService's institute-profile cache — short TTL since a flag flip via
// PATCH /founder/feature-flags must take effect promptly, not just on
// institute-profile cache invalidation (which this key intentionally does
// not share, so a flag check never depends on the profile cache's lifecycle).
const FLAG_CACHE_TTL_SECONDS = 30;
const flagCacheKey = (instituteId: string, flag: string) => `feature-flag:${instituteId}:${flag}`;

/**
 * Single real read-path for "is this feature on for this institute" — every
 * module gating a feature (capture-providers, ai-evaluation, documents) goes
 * through here instead of reading Institute.featureFlags directly, so there
 * is exactly one place that resolves precedence (explicit per-institute flag
 * → the plan's default flags → off) and exactly one cache-invalidation
 * contract to reason about.
 */
@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async isEnabled(instituteId: string, flag: string): Promise<boolean> {
    const cacheKey = flagCacheKey(instituteId, flag);
    const cached = await this.cache.get<boolean>(cacheKey);
    if (cached !== undefined) return cached;

    const resolved = await this.resolve(instituteId, flag);
    await this.cache.set(cacheKey, resolved, FLAG_CACHE_TTL_SECONDS);
    return resolved;
  }

  /** Invalidated by FounderService.updateFeatureFlag on every write. */
  async invalidate(instituteId: string, flag: string): Promise<void> {
    await this.cache.del(flagCacheKey(instituteId, flag));
  }

  private async resolve(instituteId: string, flag: string): Promise<boolean> {
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      select: { plan: true, featureFlags: true },
    });
    if (!institute) return false;

    const explicit = (institute.featureFlags as Record<string, boolean> | null)?.[flag];
    if (typeof explicit === 'boolean') return explicit;

    try {
      const planDef = await this.prisma.planDefinition.findUnique({ where: { plan: institute.plan } });
      const planDefault = (planDef?.defaultFeatureFlags as Record<string, boolean> | null)?.[flag];
      return typeof planDefault === 'boolean' ? planDefault : false;
    } catch (err) {
      this.logger.warn(`Failed to resolve plan default for flag "${flag}" — defaulting to disabled`, err as Error);
      return false;
    }
  }
}
