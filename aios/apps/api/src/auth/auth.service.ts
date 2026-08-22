import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { allowlistCheckKey } from '../shared/cache-keys';
import { AuditAction, UserStatus, UserRole, type AllowListEntry, type Institute } from '@prisma/client';
import { JwtPayload, AuthenticatedUser } from './auth.types';

const ALLOWLIST_CHECK_TTL_SECONDS = 60; // 09-CACHING-STRATEGY.md §1.5

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  // 07-SECURITY-SPECIFICATION.md §7: "repeated 403s -> temporary lockout." In-memory,
  // keyed by email — correct for a single instance; a horizontally-scaled deployment
  // needs this moved to Redis (same caveat as ThrottlerModule's default storage).
  private readonly failedLoginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
  private static readonly LOCKOUT_THRESHOLD = 5;
  private static readonly LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * A-01: Google login flow
   * 1. Verify the Google ID token server-side (signature, audience, issuer, expiry).
   * 2. Check the verified email against every institute's allow-list.
   * 3. If found: upsert the User record and return a signed JWT.
   * 4. If not found: log the failed attempt and throw 403.
   */
  async loginWithGoogle(
    idToken: string,
    ipAddress?: string,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    // Step 1 — Verify token with Google
    const googlePayload = await this.verifyGoogleToken(idToken);
    const email = googlePayload.email!;
    const googleSub = googlePayload.sub!;
    const name = googlePayload.name ?? email;
    const avatarUrl = googlePayload.picture ?? undefined;

    this.assertNotLockedOut(email);

    // Step 2 — Check institute allow-list
    const allowlistCacheKey = allowlistCheckKey(email);
    let allowEntry = await this.cache.get<(AllowListEntry & { institute: Institute }) | null>(allowlistCacheKey);
    if (allowEntry === undefined) {
      allowEntry = await this.prisma.allowListEntry.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { institute: true },
      });
      await this.cache.set(allowlistCacheKey, allowEntry, ALLOWLIST_CHECK_TTL_SECONDS);
    }

    if (!allowEntry) {
      // No real institute or user exists for this email, so there's nothing to
      // correctly scope an AuditLog row to — a prior version of this code
      // attached these to an arbitrary institute's audit trail, which misled
      // that institute's admin into seeing failed logins that had nothing to
      // do with them. The warn log is the correct, honestly-scoped record.
      this.logger.warn(`Login rejected — email not in any allow-list: ${email}`);
      this.recordFailedLogin(email);
      throw new ForbiddenException(
        "This email isn't linked to an institute yet — contact your admin.",
      );
    }

    const { institute, role } = allowEntry;

    // Step 3 — Upsert the User record
    const user = await this.prisma.user.upsert({
      where: { googleSub },
      update: {
        name,
        avatarUrl,
        lastLoginAt: new Date(),
        status: UserStatus.ACTIVE,
      },
      create: {
        googleSub,
        email,
        name,
        avatarUrl,
        role,
        instituteId: institute.id,
        lastLoginAt: new Date(),
      },
    });

    // Guard: if the user's role has changed in the allow-list, update it
    if (user.role !== role) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role },
      });
    }

    // Guard: suspended users cannot log in — unlike the unrecognized-email case
    // above, this has a real institute and user to scope the audit entry to.
    if (user.status === UserStatus.SUSPENDED) {
      await this.prisma.auditLog.create({
        data: {
          instituteId: institute.id,
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          entity: 'users',
          entityId: user.id,
          newValue: { reason: 'account_suspended' },
          ipAddress,
        },
      });
      this.recordFailedLogin(email);
      throw new ForbiddenException(
        'Your account has been suspended. Contact your institute admin.',
      );
    }

    this.failedLoginAttempts.delete(email.toLowerCase());

    // Step 4 — Audit log the successful login
    await this.prisma.auditLog.create({
      data: {
        instituteId: institute.id,
        actorId: user.id,
        action: AuditAction.LOGIN,
        entity: 'users',
        entityId: user.id,
        ipAddress,
      },
    });

    // Step 5 — Sign JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      instituteId: user.instituteId,
    };

    const accessToken = this.jwt.sign(payload);

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      instituteId: user.instituteId,
      avatarUrl: user.avatarUrl,
    };

    return { accessToken, user: authenticatedUser };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Login lockout (07-SECURITY-SPECIFICATION.md §7)
  // ──────────────────────────────────────────────────────────────────────────

  private assertNotLockedOut(email: string): void {
    const entry = this.failedLoginAttempts.get(email.toLowerCase());
    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      throw new ForbiddenException(
        'Too many failed sign-in attempts. Try again in a few minutes.',
      );
    }
  }

  private recordFailedLogin(email: string): void {
    const key = email.toLowerCase();
    const entry = this.failedLoginAttempts.get(key) ?? { count: 0 };
    entry.count += 1;
    if (entry.count >= AuthService.LOCKOUT_THRESHOLD) {
      entry.lockedUntil = Date.now() + AuthService.LOCKOUT_WINDOW_MS;
      this.logger.warn(`Login lockout triggered for ${key} after ${entry.count} failed attempts`);
    }
    this.failedLoginAttempts.set(key, entry);
  }

  /** Validate a JWT payload — called by JwtStrategy on every protected request. */
  async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, instituteId: true, status: true, avatarUrl: true },
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Session invalid. Please sign in again.');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as UserRole,
      instituteId: user.instituteId,
      avatarUrl: user.avatarUrl,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async verifyGoogleToken(idToken: string): Promise<TokenPayload> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new UnauthorizedException('Invalid Google token payload.');
      }

      return payload;
    } catch (err) {
      this.logger.error('Google token verification failed', err);
      throw new UnauthorizedException(
        'Google sign-in failed. Please try again.',
      );
    }
  }
}
