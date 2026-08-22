import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * 07-SECURITY-SPECIFICATION.md §7: "Bulk endpoints (CSV import, blueprint
 * generation): separately capped per institute per hour." Doc 07 doesn't name
 * an exact figure — 50/hour is a reasonable placeholder pending a real
 * product decision on throughput needs, not a load-tested number.
 *
 * Deliberately standalone rather than another named ThrottlerModule profile:
 * this needs to key by instituteId (a route param), not by user or IP, which
 * is simpler to get right as its own small counter than to fit into the
 * shared multi-named-throttler config. Same single-instance caveat as
 * UserThrottlerGuard — a horizontally-scaled deployment needs this moved to
 * Redis.
 */
@Injectable()
export class InstituteBulkThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();
  private static readonly LIMIT = 50;
  private static readonly WINDOW_MS = 60 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const instituteId = req.params?.instituteId;
    if (!instituteId) return true;

    const now = Date.now();
    const entry = this.hits.get(instituteId);

    if (!entry || now - entry.windowStart > InstituteBulkThrottleGuard.WINDOW_MS) {
      this.hits.set(instituteId, { count: 1, windowStart: now });
      return true;
    }

    if (entry.count >= InstituteBulkThrottleGuard.LIMIT) {
      throw new HttpException(
        {
          code: 'BULK_RATE_LIMIT_EXCEEDED',
          message: 'This institute has exceeded the hourly limit for this operation. Try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    entry.count += 1;
    return true;
  }
}
