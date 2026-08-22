import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * 07-SECURITY-SPECIFICATION.md §7: authenticated routes are throttled per user,
 * not per IP (an institute's staff/students behind one shared NAT shouldn't
 * share a single limit). Falls back to IP for unauthenticated routes (e.g.
 * @Public() /auth/google, where doc 07 explicitly wants per-IP limiting and
 * there is no req.user yet). Relies on running after JwtAuthGuard in the
 * global guard chain (see AuthModule) so req.user is already populated.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user?.id ?? req.ip;
  }
}
