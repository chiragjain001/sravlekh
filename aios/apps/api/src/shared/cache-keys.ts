import { createHash } from 'crypto';

/**
 * 09-CACHING-STRATEGY.md §1.5. Doc's key format is `allowlist-check:{instituteId}:
 * {emailHash}`, but at login time the institute isn't known yet — that's exactly
 * what this lookup determines — so the key is scoped by email only. Hashed (not
 * the raw email) so Redis key names/logs don't carry PII. Shared between
 * AuthService (reads/populates it) and InstitutesService (invalidates it on
 * allow-list changes).
 */
export function allowlistCheckKey(email: string): string {
  return `allowlist-check:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

/**
 * Login-failure counter and lockout keys.
 *
 * Email is hashed for the same reason as above — these keys sit in Redis and in
 * any key-space dump, and a raw email there is PII.
 *
 * Two keys rather than one: the counter expires on a rolling window, while the
 * lock is a fixed penalty applied from the moment the threshold is crossed. One
 * TTL cannot express both, and collapsing them would make the lockout expire
 * early — at the end of the counting window rather than the penalty.
 */
export function loginFailureCountKey(email: string): string {
  return `login-fail:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}

export function loginLockoutKey(email: string): string {
  return `login-lock:${createHash('sha256').update(email.toLowerCase()).digest('hex')}`;
}
