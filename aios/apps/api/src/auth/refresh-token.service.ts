import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Refresh-token sessions: issue, rotate, revoke.
 *
 * THE PROBLEM THIS SOLVES. The only session credential used to be a 7-day access
 * JWT in localStorage. A token stolen via XSS stayed valid for up to a week, and
 * the only revocation mechanism was `User.tokenVersion`, which invalidates every
 * session on every device at once. That is far too blunt to use on one
 * suspicious session, which in practice means it never gets used.
 *
 * THE SHAPE OF THE FIX:
 *   - the access token becomes short-lived (minutes), so a stolen one expires
 *     quickly on its own;
 *   - a long-lived refresh token lives in an httpOnly cookie, where page
 *     JavaScript — and therefore XSS — cannot read it at all;
 *   - every refresh ROTATES that token, so a stolen one stops working the moment
 *     the real user's client next refreshes;
 *   - presenting an already-rotated token is treated as evidence of theft and
 *     revokes the whole session family.
 *
 * Nothing here weakens `tokenVersion`. It still force-invalidates every access
 * token, and `revokeAllForUser` now revokes the matching refresh sessions too —
 * previously a force-logout left no refresh state to clean up because none
 * existed.
 */

/** 32 bytes of CSPRNG output. Guessing is not a threat model at this size. */
const TOKEN_BYTES = 32;

/**
 * How long a refresh token is valid. This is now the real session length — the
 * old 7-day figure was the ACCESS token's lifetime, which is a different and much
 * more dangerous thing to make long.
 */
export const REFRESH_TOKEN_TTL_DAYS = 30;

/**
 * Grace window for concurrent refreshes.
 *
 * THIS IS THE SUBTLE PART. Two browser tabs whose access tokens expire together
 * will both refresh with the same cookie. One wins the rotation; the other
 * arrives with a token that is already marked rotated — which is exactly what a
 * stolen token looks like. Revoking the family there would log real users out
 * for having two tabs open.
 *
 * So a token rotated within this window is treated as a benign race: the request
 * is rejected (401) but NOTHING is revoked, and the client retries. By then the
 * winner's Set-Cookie has replaced the cookie, so the retry carries the new
 * token and succeeds. Outside the window, a rotated token has no innocent
 * explanation — the legitimate client would have moved on long ago — and the
 * family is revoked.
 *
 * 30s is deliberately generous relative to the milliseconds a real race takes;
 * the cost of being wrong in this direction is one extra round trip, and in the
 * other direction it is logging out an honest user.
 */
export const CONCURRENT_REFRESH_GRACE_MS = 30_000;

/**
 * Prisma error codes meaning "the transaction did not happen; try again".
 *
 *   P2028 — could not start a transaction in time (pool exhausted under a burst)
 *   P2034 — write conflict or deadlock; the transaction was rolled back
 *
 * Neither indicates anything about the validity of the presented token, so both
 * must map to a retry rather than to a lost session.
 */
const TRANSIENT_TRANSACTION_CODES = new Set(['P2028', 'P2034']);

function errorCodeOf(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

function isTransientTransactionError(err: unknown): boolean {
  const code = errorCodeOf(err);
  return code !== undefined && TRANSIENT_TRANSACTION_CODES.has(code);
}

export type RefreshTokenMetadata = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

export type IssuedRefreshToken = {
  /** The plaintext token. Returned exactly once — only its hash is persisted. */
  token: string;
  expiresAt: Date;
  familyId: string;
};

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * SHA-256, not bcrypt/argon2.
   *
   * Password hashing is deliberately slow to survive an offline attack on a
   * LOW-ENTROPY secret that humans chose. This token is 256 bits of CSPRNG
   * output: there is no dictionary to run and no guessing attack to slow down.
   * A fast hash is the right tool, and it matters here because this runs on
   * every token lookup — a deliberately slow hash would make the refresh
   * endpoint a self-inflicted DoS amplifier.
   */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Issues a NEW session (a new rotation family). Called on login, never on
   * refresh — refresh continues an existing family via {@link rotate}.
   */
  async issue(userId: string, meta: RefreshTokenMetadata = {}): Promise<IssuedRefreshToken> {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const familyId = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        tokenHash: this.hash(token),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500) ?? null,
        ipAddress: meta.ipAddress ?? null,
      },
    });

    return { token, expiresAt, familyId };
  }

  /**
   * Exchanges a refresh token for a successor, atomically.
   *
   * Returns the userId the session belongs to plus the new token. Throws
   * UnauthorizedException for every failure mode — an unknown token, an expired
   * one, a revoked one, and a reused one all look identical from outside, so the
   * response cannot be used to probe which tokens exist.
   */
  async rotate(
    presentedToken: string,
    meta: RefreshTokenMetadata = {},
  ): Promise<{ userId: string; refresh: IssuedRefreshToken }> {
    const tokenHash = this.hash(presentedToken);

    const existing = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!existing) throw new UnauthorizedException('Session expired. Please sign in again.');

    // ── Reuse detection ────────────────────────────────────────────────────
    if (existing.rotatedAt) {
      const sinceRotation = Date.now() - existing.rotatedAt.getTime();

      if (sinceRotation <= CONCURRENT_REFRESH_GRACE_MS) {
        // Benign race — see CONCURRENT_REFRESH_GRACE_MS. Revoke nothing; the
        // client retries with the cookie the winning request already set.
        this.logger.debug(
          `Concurrent refresh for user ${existing.userId} (${sinceRotation}ms after rotation) — asking the client to retry.`,
        );
        throw new UnauthorizedException('Please retry.');
      }

      // A token rotated long ago has just been presented. Two copies exist and
      // there is no way to tell which one this is, so the whole session dies.
      await this.revokeFamily(existing.familyId, 'reuse_detected');
      this.logger.warn(
        `Refresh token reuse detected for user ${existing.userId} (family ${existing.familyId}, ` +
          `rotated ${Math.round(sinceRotation / 1000)}s ago). Entire session family revoked.`,
      );
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (existing.revokedAt) throw new UnauthorizedException('Session expired. Please sign in again.');
    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Both writes in one transaction, and the rotation is a CONDITIONAL update
    // (`rotatedAt: null`) rather than a plain one. Two simultaneous requests both
    // read the row as un-rotated a moment ago; the condition means the database,
    // not the application, decides which of them actually rotates it. Without
    // that, both would "succeed" and mint two live successors from one token —
    // silently forking the session, which is the very thing reuse detection
    // exists to catch.
    let claimed: boolean;
    try {
      claimed = await this.prisma.$transaction(async (tx) => {
        const result = await tx.refreshToken.updateMany({
          where: { id: existing.id, rotatedAt: null, revokedAt: null },
          data: { rotatedAt: new Date(), revokedReason: 'rotated' },
        });
        if (result.count === 0) return false;

        await tx.refreshToken.create({
          data: {
            userId: existing.userId,
            familyId: existing.familyId, // same family: this is the same session continuing
            tokenHash: this.hash(token),
            expiresAt,
            userAgent: meta.userAgent?.slice(0, 500) ?? existing.userAgent,
            ipAddress: meta.ipAddress ?? existing.ipAddress,
          },
        });
        return true;
      });
    } catch (err) {
      // CONTENTION IS NOT A SESSION FAILURE.
      //
      // Found by running this against a real database rather than a mocked one:
      // ten simultaneous rotations of the same token produced ONE winner, one
      // clean loser, and EIGHT `P2028 — Unable to start a transaction in the
      // given time`. Interactive transactions each hold a pooled connection
      // across several round trips, so a burst exhausts the pool and most
      // requests fail before they even begin.
      //
      // That burst is not hypothetical: it is what a user with several tabs
      // sees when their access token expires, and what every active user sees at
      // once after an API restart. Left unhandled these surfaced as 500s, which
      // the client treats as "session over" — logging people out because the
      // server was briefly busy.
      //
      // P2028 (could not start) and P2034 (write conflict / deadlock) both mean
      // "nothing was committed, try again". Nothing has been rotated, so the
      // presented token is still valid and a retry is safe and correct.
      if (isTransientTransactionError(err)) {
        this.logger.debug(`Refresh contended for user ${existing.userId} (${errorCodeOf(err)}) — asking the client to retry.`);
        throw new UnauthorizedException('Please retry.');
      }
      throw err;
    }

    if (!claimed) {
      // Lost the race between the read above and the conditional update. Same
      // benign situation as the grace-window branch, reached a different way.
      throw new UnauthorizedException('Please retry.');
    }

    return {
      userId: existing.userId,
      refresh: { token, expiresAt, familyId: existing.familyId },
    };
  }

  /** Ends one session (logout). Unknown tokens are ignored — logout is idempotent. */
  async revoke(presentedToken: string, reason = 'logout'): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hash(presentedToken), revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Revokes an entire rotation chain — used by reuse detection. */
  async revokeFamily(familyId: string, reason: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /**
   * Revokes every session for a user, on every device.
   *
   * Called alongside the existing `tokenVersion` bump on force-logout and
   * logout-all-devices. Bumping tokenVersion alone kills access tokens but would
   * leave refresh tokens live, and the next refresh would mint a fresh access
   * token carrying the NEW tokenVersion — quietly undoing the force-logout.
   */
  async revokeAllForUser(userId: string, reason = 'force_logout'): Promise<number> {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
    return result.count;
  }

  /** Lists a user's live sessions, newest first. Never exposes token hashes. */
  async listActiveSessions(userId: string) {
    return this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, rotatedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, familyId: true, createdAt: true, expiresAt: true, userAgent: true, ipAddress: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Deletes rows that can no longer authenticate anything.
   *
   * This table gains a row on every refresh, forever. At a 15-minute access-token
   * lifetime that is ~96 rows per user per day — unbounded growth that would
   * eventually dominate the database. Rotated and revoked rows are kept for a
   * grace period rather than deleted immediately, because deleting a rotated row
   * would DISABLE REUSE DETECTION for it: a stolen token whose row had been
   * cleaned up would read as "unknown token" instead of "reused token", and the
   * family would never be revoked.
   */
  async cleanupExpired(retainRotatedForDays = 7): Promise<number> {
    const cutoff = new Date(Date.now() - retainRotatedForDays * 24 * 60 * 60 * 1000);
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { rotatedAt: { lt: cutoff } },
          { revokedAt: { lt: cutoff } },
        ],
      },
    });
    if (result.count > 0) this.logger.log(`Cleaned up ${result.count} expired refresh tokens.`);
    return result.count;
  }

  /**
   * Constant-time comparison helper, exported for callers that need to compare a
   * token to a known value. Not used by the lookup path above — that finds rows
   * by hash through a unique index, so no comparison of secrets happens in
   * application code at all.
   */
  static safeEquals(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }
}
