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
