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
import { allowlistCheckKey, loginFailureCountKey, loginLockoutKey } from '../shared/cache-keys';
import { AuditAction, UserStatus, UserRole, InstituteStatus, type AllowListEntry, type Institute } from '@prisma/client';
import { JwtPayload, AuthenticatedUser } from './auth.types';

const ALLOWLIST_CHECK_TTL_SECONDS = 60; // 09-CACHING-STRATEGY.md §1.5

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleClient: OAuth2Client;

  // 07-SECURITY-SPECIFICATION.md §7: "repeated 403s -> temporary lockout."
  //
  // Now Redis-backed so the control holds across instances. It was a per-process
  // Map, which meant N instances granted an attacker N x 5 attempts and every
  // deploy silently reset every lockout — a security control that quietly
  // weakened exactly as the system scaled.
  //
  // The Map survives as a per-instance FALLBACK for when Redis is unreachable.
  // Degrading to single-instance counting is weaker than distributed counting
  // but far stronger than no lockout at all, and it keeps sign-in working during
  // a Redis blip rather than failing every login closed.
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

    await this.assertNotLockedOut(email);

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
      await this.recordFailedLogin(email);
      throw new ForbiddenException(
        "This email isn't linked to an institute yet — contact your admin.",
      );
    }

    const { institute, role } = allowEntry;

    // Step 3 — Upsert the User record.
    //
    // `status` is deliberately NOT written here. It used to be forced to ACTIVE
    // on every login, which silently un-archived any removed user the moment
    // they signed in again: archive sets INACTIVE, this reset it to ACTIVE, and
    // the status guard below (which runs after) then saw a healthy account. The
    // archive was undone before anything could check it.
    //
    // Reactivation is an administrative act, not a side effect of signing in.
    // A new user still starts ACTIVE via the schema default on the create branch.
    const user = await this.prisma.user.upsert({
      where: { googleSub },
      update: {
        name,
        avatarUrl,
        lastLoginAt: new Date(),
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

    // Guard: a suspended/archived institute blocks login for every non-Founder
    // user immediately — a Founder suspend/archive action must take effect at
    // the login boundary, not just for already-issued sessions (see
    // validateJwtPayload for the mid-session equivalent).
    if (institute.status === InstituteStatus.SUSPENDED || institute.status === InstituteStatus.ARCHIVED) {
      await this.prisma.auditLog.create({
        data: {
          instituteId: institute.id,
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          entity: 'users',
          entityId: user.id,
          newValue: { reason: `institute_${institute.status.toLowerCase()}` },
          ipAddress,
        },
      });
      await this.recordFailedLogin(email);
      throw new ForbiddenException(
        institute.status === InstituteStatus.SUSPENDED
          ? 'Your institute has been suspended. Contact the platform administrator.'
          : 'Your institute is no longer active on this platform.',
      );
    }

    // Guard: only ACTIVE accounts may sign in — unlike the unrecognized-email
    // case above, this has a real institute and user to scope the audit entry to.
    // Allow-listed for the same reason as validateJwtPayload: INACTIVE (archived)
    // is not SUSPENDED, so a block-list let removed users back in.
    if (user.status !== UserStatus.ACTIVE) {
      await this.prisma.auditLog.create({
        data: {
          instituteId: institute.id,
          actorId: user.id,
          action: AuditAction.LOGIN_FAILED,
          entity: 'users',
          entityId: user.id,
          newValue: { reason: `account_${user.status.toLowerCase()}` },
          ipAddress,
        },
      });
      await this.recordFailedLogin(email);
      throw new ForbiddenException(
        user.status === UserStatus.SUSPENDED
          ? 'Your account has been suspended. Contact your institute admin.'
          : 'Your account is no longer active at this institute. Contact your institute admin.',
      );
    }

    await this.clearLoginFailures(email);

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
      tokenVersion: user.tokenVersion,
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

  /**
   * 06-AUTH-AUTHORIZATION.md §1: "A mock role token login path exists only in
   * non-production environments". Signs a real JWT for a fixed, seeded dev user
   * per role (packages/db/src/seed.ts) — it never creates or mutates a user, so
   * it can't be used to fabricate access to data that doesn't already exist, and
   * there's nothing for it to do once a role's seed user is missing except tell
   * the caller to run the seed.
   *
   * SECURITY — fails CLOSED. The gate is an explicit `ENABLE_DEV_LOGIN=true`
   * opt-in, not `NODE_ENV !== 'production'`. The NODE_ENV form fails OPEN: an
   * unset or misspelled NODE_ENV (a routine container/PaaS misconfiguration) is
   * !== 'production', which left this credential-less, role-selectable token
   * mint publicly reachable. Now any misconfiguration disables it instead.
   * env.schema.ts additionally refuses to boot if the flag is on in production.
   */
  async loginAsMockRole(role: UserRole): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    // Default-deny: `get` returning undefined (flag absent from the validated
    // config for any reason) must mean disabled, never enabled.
    const devLoginEnabled = this.config.get<boolean>('ENABLE_DEV_LOGIN') === true;
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    if (!devLoginEnabled || isProduction) {
      throw new ForbiddenException('Mock login is disabled.');
    }

    const email = `mock-${role.toLowerCase()}@aios.dev`;
    const user = await this.prisma.user.findFirst({ where: { email }, include: { institute: { select: { status: true } } } });
    if (!user) {
      throw new UnauthorizedException(
        `No seeded ${role} user found (${email}). Run "pnpm --filter @aios/db seed" first.`,
      );
    }

    // Same institute-suspension boundary as loginWithGoogle — otherwise a
    // Founder suspending an institute would look effective in the demo/mock
    // login path only until validateJwtPayload's mid-session check kicked in
    // on the next request, surfacing as a confusing generic "session expired"
    // instead of a clear reason at the login attempt itself.
    if (
      role !== UserRole.FOUNDER &&
      (user.institute.status === InstituteStatus.SUSPENDED || user.institute.status === InstituteStatus.ARCHIVED)
    ) {
      throw new ForbiddenException(
        user.institute.status === InstituteStatus.SUSPENDED
          ? 'Your institute has been suspended. Contact the platform administrator.'
          : 'Your institute is no longer active on this platform.',
      );
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      instituteId: user.instituteId,
      tokenVersion: user.tokenVersion,
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        instituteId: user.instituteId,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Login lockout (07-SECURITY-SPECIFICATION.md §7)
  // ──────────────────────────────────────────────────────────────────────────

  private async assertNotLockedOut(email: string): Promise<void> {
    const locked = await this.cache.get<number>(loginLockoutKey(email));
    if (locked !== undefined) {
      throw new ForbiddenException(
        'Too many failed sign-in attempts. Try again in a few minutes.',
      );
    }

    // Fallback path — only meaningful when Redis was unreachable while the
    // failures were being recorded.
    const entry = this.failedLoginAttempts.get(email.toLowerCase());
    if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
      throw new ForbiddenException(
        'Too many failed sign-in attempts. Try again in a few minutes.',
      );
    }
  }

  private async recordFailedLogin(email: string): Promise<void> {
    const windowSeconds = Math.floor(AuthService.LOCKOUT_WINDOW_MS / 1000);
    const counted = await this.cache.incrWithTtl(loginFailureCountKey(email), windowSeconds);

    if (counted === undefined) {
      // Redis unavailable — degrade to per-instance counting rather than losing
      // the control entirely.
      const key = email.toLowerCase();
      const entry = this.failedLoginAttempts.get(key) ?? { count: 0 };
      entry.count += 1;
      if (entry.count >= AuthService.LOCKOUT_THRESHOLD) {
        entry.lockedUntil = Date.now() + AuthService.LOCKOUT_WINDOW_MS;
        this.logger.warn(`Login lockout (per-instance fallback) for ${key} after ${entry.count} attempts`);
      }
      this.failedLoginAttempts.set(key, entry);
      return;
    }

    if (counted.count >= AuthService.LOCKOUT_THRESHOLD) {
      // A distinct key so the penalty runs its full length from the crossing
      // point, instead of expiring when the counting window happens to end.
      await this.cache.set(loginLockoutKey(email), Date.now(), windowSeconds);
      this.logger.warn(`Login lockout triggered after ${counted.count} failed attempts`);
    }
  }

  /** Clears both the distributed and fallback counters after a successful login. */
  private async clearLoginFailures(email: string): Promise<void> {
    await this.cache.resetCounter(loginFailureCountKey(email));
    await this.cache.resetCounter(loginLockoutKey(email));
    this.failedLoginAttempts.delete(email.toLowerCase());
  }

  /** Validate a JWT payload — called by JwtStrategy on every protected request. */
  async validateJwtPayload(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, email: true, name: true, role: true, instituteId: true, status: true, avatarUrl: true, tokenVersion: true,
        institute: { select: { status: true } },
      },
    });

    // Allow-list ACTIVE rather than block-list SUSPENDED. This previously read
    // `status === SUSPENDED`, which let an ARCHIVED user keep working: archiving
    // a student (students.service.ts) or teacher (teachers.service.ts) sets
    // status INACTIVE, and INACTIVE is not SUSPENDED — so every JWT already
    // issued to a removed user stayed valid until it expired. A block-list has
    // to predict every non-permitted state; an allow-list only has to name the
    // one permitted state, so a status added later fails closed.
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Session invalid. Please sign in again.');
    }

    // Founder Console Phase 4 — a Founder force-logout bumps User.tokenVersion;
    // every JWT issued before that bump carries the old value and is rejected
    // here on its very next use, without needing a server-side token blocklist.
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Session invalid. Please sign in again.');
    }

    // Founder is platform-wide and never tenant-blocked by its own "home"
    // institute's status; every other role is cut off the moment their
    // institute is suspended or archived, mid-session included.
    if (
      user.role !== UserRole.FOUNDER &&
      (user.institute.status === InstituteStatus.SUSPENDED || user.institute.status === InstituteStatus.ARCHIVED)
    ) {
      throw new UnauthorizedException('Your institute is no longer active. Contact the platform administrator.');
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
