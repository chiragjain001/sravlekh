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
