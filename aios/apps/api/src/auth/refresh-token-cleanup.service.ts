import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';

/**
 * Runs RefreshTokenService.cleanupExpired() on a timer.
 *
 * The refresh_tokens table gains a row on every refresh — roughly one per active
 * user per access-token lifetime (15 min), so ~96 per user per day, forever.
 * cleanupExpired() existed and was tested, but nothing called it, which
 * docs/38-SESSION-AND-REFRESH-TOKENS.md §7 recorded as a known gap.
 *
 * Same shape as QueueMonitorService, for the same reasons: a plain interval
 * rather than a new scheduling dependency, `unref()` so it never delays a
 * graceful shutdown, and a callback that never throws, because an unhandled
 * rejection inside setInterval takes the process down.
 *
 * Only provided where RUN_WORKERS is true (see AuthModule). The delete is
 * idempotent, so running it on every API replica would be harmless but pointless
 * — N identical deletes racing each other every hour.
 */
@Injectable()
export class RefreshTokenCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);
  private timer: NodeJS.Timeout | undefined;

  /**
   * Hourly. Rows only become deletable 7 days after rotation or at expiry, so
   * running more often buys nothing, and less often only lets the table grow a
   * little further between passes.
   */
  private readonly intervalMs = Number(process.env['REFRESH_TOKEN_CLEANUP_INTERVAL_MS'] ?? 60 * 60 * 1000);

  constructor(private readonly refreshTokens: RefreshTokenService) {}

  onModuleInit(): void {
    if (this.intervalMs <= 0) {
      this.logger.log('Refresh-token cleanup disabled (REFRESH_TOKEN_CLEANUP_INTERVAL_MS <= 0).');
      return;
    }
    this.timer = setInterval(() => void this.runOnce(), this.intervalMs);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass. Public so tests and one-off diagnostics can call it directly. */
  async runOnce(): Promise<number> {
    try {
      return await this.refreshTokens.cleanupExpired();
    } catch (err) {
      // A failed cleanup costs nothing but table growth until the next pass.
      // Logged, never rethrown — see the class comment.
      this.logger.warn(`Refresh-token cleanup failed: ${(err as Error).message}`);
      return 0;
    }
  }
}
