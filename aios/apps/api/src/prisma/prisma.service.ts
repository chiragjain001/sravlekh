import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Import PrismaClient from the generated client in node_modules
// (not from @prisma/client which is a package wrapper — that would cause circular issues at runtime)
import { PrismaClient } from '@prisma/client';


/**
 * Appends `connection_limit` to the datasource URL when DATABASE_POOL_LIMIT is set.
 *
 * WHY THIS EXISTS. Prisma's default pool is `num_cpus * 2 + 1`, derived from the
 * CPU count of whatever container it lands in — a number nobody has reasoned
 * about, and one that changes when the instance size does. Load testing made the
 * arithmetic concrete (load-tests/RESULTS-2026-09-11.md §5): on an 8-CPU host
 * that is 17 connections per process, so five API replicas request 85 against
 * Postgres's default `max_connections=100`, and the sixth replica cannot
 * connect. Harmless at one process; an outage the day someone scales out.
 *
 * OPT-IN. With the variable unset this returns undefined and Prisma behaves
 * exactly as before, because the correct value depends on replica count and the
 * database's own max_connections — it cannot be guessed from inside the process.
 * An explicit `connection_limit` already present in the URL always wins.
 */
export function poolLimitOptions(
  url: string | undefined,
  limit: string | undefined,
): { datasources: { db: { url: string } } } | undefined {
  if (!url || !limit) return undefined;

  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      // A malformed URL is env-validation's problem, not this helper's. Returning
      // undefined leaves Prisma to surface its own, clearer error.
      return undefined;
    }
  })();
  if (!parsed) return undefined;

  // Never override an explicit setting: someone who wrote it in the URL meant it.
  if (parsed.searchParams.has('connection_limit')) return undefined;

  parsed.searchParams.set('connection_limit', limit);
  return { datasources: { db: { url: parsed.toString() } } };
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  /**
   * Prisma error codes that mean "the connection was not usable", as opposed to
   * "your query was wrong": P1001 unreachable, P1002 timeout, P1017 server
   * closed the connection. A pooled/serverless Postgres (Supabase's pgbouncer,
   * Neon, RDS Proxy) drops idle connections routinely, which surfaced here as
   * random 500s on perfectly valid reads.
   */
  private static readonly TRANSIENT_CODES = new Set(['P1001', 'P1002', 'P1017']);

  /** Read operations are side-effect free, so retrying one is always safe. */
  private static readonly RETRYABLE_OPS = new Set([
    'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow',
    'findMany', 'count', 'aggregate', 'groupBy',
  ]);

  constructor() {
    // undefined when DATABASE_POOL_LIMIT is unset, which is the same call Prisma
    // received before this existed.
    super(poolLimitOptions(process.env['DATABASE_URL'], process.env['DATABASE_POOL_LIMIT']));

    // Retry only reads, and only on connection-level failures. Writes are
    // deliberately excluded: a create that failed *after* reaching the database
    // would be duplicated by a blind retry.
    this.$use(async (params, next) => {
      if (!PrismaService.RETRYABLE_OPS.has(params.action)) return next(params);

      for (let attempt = 1; ; attempt++) {
        try {
          return await next(params);
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (!code || !PrismaService.TRANSIENT_CODES.has(code) || attempt > 2) throw err;

          this.logger.warn(
            `Transient DB error ${code} on ${params.model}.${params.action} — retry ${attempt}/2`,
          );
          await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
        }
      }
    });
  }

  async onModuleInit() {
    // Same graceful-degradation philosophy QueueModule already applies to Redis
    // (09-CACHING-STRATEGY.md): a DB that's unreachable at boot shouldn't crash
    // the whole process with an unhandled rejection — every actual query already
    // has its own error handling (AllExceptionsFilter, HealthController's
    // per-request checkDb()), which is the real safety net. This only covers
    // the one-time initial connect; it doesn't change how query failures behave.
    try {
      await this.$connect();
    } catch (err) {
      this.logger.error(
        'Could not connect to the database at startup — the API will still start, but every ' +
          'DB-backed request will fail until this is resolved.',
        err as Error,
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
