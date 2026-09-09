import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
// Import PrismaClient from the generated client in node_modules
// (not from @prisma/client which is a package wrapper — that would cause circular issues at runtime)
import { PrismaClient } from '@prisma/client';

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
    super();

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
