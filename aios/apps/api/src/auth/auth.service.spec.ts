import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuditAction, UserRole, UserStatus, InstituteStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';

/**
 * A working in-memory stand-in for the Redis-backed CacheService.
 *
 * Deliberately stateful rather than a bag of jest.fn()s: login lockout now counts
 * through cache.incrWithTtl, so a double returning undefined would push every
 * lockout test down the per-instance FALLBACK path and leave the distributed
 * path — the one that actually runs in production — untested.
 */
function createCacheDouble() {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn(async (k: string) => store.get(k)),
    set: jest.fn(async (k: string, v: unknown) => { store.set(k, v); }),
    del: jest.fn(async (k: string) => { store.delete(k); }),
    resetCounter: jest.fn(async (k: string) => { store.delete(k); }),
    delByPrefix: jest.fn(async () => {}),
    incrWithTtl: jest.fn(async (k: string, ttlSeconds: number) => {
      const next = ((store.get(k) as number | undefined) ?? 0) + 1;
      store.set(k, next);
      return { count: next, ttlMs: ttlSeconds * 1000 };
    }),
  };
}


const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe('AuthService.loginWithGoogle (06-AUTH-AUTHORIZATION.md / 13-TESTING-STRATEGY.md §7)', () => {
  let service: AuthService;
  let cache: ReturnType<typeof createCacheDouble>;
  let prisma: {
    allowListEntry: { findFirst: jest.Mock };
    user: { upsert: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let jwt: { sign: jest.Mock };

  const googlePayload = { email: 'teacher@school.com', sub: 'google-sub-1', name: 'Teacher', picture: undefined };

  beforeEach(async () => {
    cache = createCacheDouble();
    prisma = {
      allowListEntry: { findFirst: jest.fn() },
      user: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(AuthService);

    mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload });
  });

  it('rejects an email not on any allow-list, without writing a misattributed audit entry', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce(null);

    await expect(service.loginWithGoogle('id-token')).rejects.toThrow(ForbiddenException);

    // 07-SECURITY-SPECIFICATION.md: an event with no real institute/actor context
    // must not be attached to an arbitrary institute's audit trail.
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  // Regression, found by end-to-end audit: archiving a student/teacher sets
  // User.status = INACTIVE, but login only blocked SUSPENDED — so a removed user
  // could sign straight back in.
  it('rejects an ARCHIVED (INACTIVE) user at login', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce({
      role: UserRole.TEACHER,
      institute: { id: 'inst-1' },
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
      instituteId: 'inst-1', status: UserStatus.INACTIVE, avatarUrl: null,
    });

    await expect(service.loginWithGoogle('id-token', '1.2.3.4')).rejects.toThrow(ForbiddenException);
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  // The other half of the same defect, and the one that made the status guard
  // above useless on its own: the upsert forced status back to ACTIVE on every
  // login, so an archived user was un-archived BEFORE any guard could see them.
  // Reactivation is an administrative act, never a side effect of signing in.
  it('does not resurrect an archived account by writing status on login', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce({
      role: UserRole.TEACHER,
      institute: { id: 'inst-1' },
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
      instituteId: 'inst-1', status: UserStatus.ACTIVE, avatarUrl: null, tokenVersion: 0,
      institute: { status: InstituteStatus.ACTIVE },
    });

    await service.loginWithGoogle('id-token', '1.2.3.4').catch(() => undefined);

    const upsertArg = prisma.user.upsert.mock.calls[0][0];
    expect(upsertArg.update).not.toHaveProperty('status');
  });

  it('rejects a suspended user and writes a properly-scoped LOGIN_FAILED audit entry', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce({
      role: UserRole.TEACHER,
      institute: { id: 'inst-1' },
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
      instituteId: 'inst-1', status: UserStatus.SUSPENDED, avatarUrl: null,
    });

    await expect(service.loginWithGoogle('id-token', '1.2.3.4')).rejects.toThrow(ForbiddenException);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instituteId: 'inst-1',
        actorId: 'user-1',
        action: AuditAction.LOGIN_FAILED,
        ipAddress: '1.2.3.4',
      }),
    });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('rejects login for a user whose institute has been suspended by a Founder', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce({
      role: UserRole.TEACHER,
      institute: { id: 'inst-1', status: InstituteStatus.SUSPENDED },
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
      instituteId: 'inst-1', status: UserStatus.ACTIVE, avatarUrl: null,
    });

    await expect(service.loginWithGoogle('id-token', '1.2.3.4')).rejects.toThrow(ForbiddenException);

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        instituteId: 'inst-1',
        actorId: 'user-1',
        action: AuditAction.LOGIN_FAILED,
        newValue: { reason: 'institute_suspended' },
      }),
    });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it('issues a JWT and audits a successful login for an active allow-listed user', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce({
      role: UserRole.TEACHER,
      institute: { id: 'inst-1' },
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
      instituteId: 'inst-1', status: UserStatus.ACTIVE, avatarUrl: null,
    });

    const result = await service.loginWithGoogle('id-token');

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ instituteId: 'inst-1', actorId: 'user-1', action: AuditAction.LOGIN }),
    });
  });

  describe('login lockout (07-SECURITY-SPECIFICATION.md §7: "repeated 403s -> temporary lockout")', () => {
    it('locks out further attempts for the same email after enough consecutive failures', async () => {
      prisma.allowListEntry.findFirst.mockResolvedValue(null); // every attempt fails the same way

      for (let i = 0; i < 5; i++) {
        await expect(service.loginWithGoogle('id-token')).rejects.toThrow(ForbiddenException);
      }

      // The 6th attempt should be rejected by the lockout itself, before even
      // touching the allow-list lookup again.
      prisma.allowListEntry.findFirst.mockClear();
      await expect(service.loginWithGoogle('id-token')).rejects.toThrow('Too many failed sign-in attempts');
      expect(prisma.allowListEntry.findFirst).not.toHaveBeenCalled();
    });

    it('counts failures through the SHARED store, not a per-process map', async () => {
      // The whole point of moving this to Redis: with the previous in-memory Map,
      // N instances gave an attacker N x 5 attempts and every deploy reset every
      // lockout. Asserting on the distributed counter proves the control is the
      // one that actually runs, not the fallback.
      prisma.allowListEntry.findFirst.mockResolvedValue(null);

      for (let i = 0; i < 5; i++) {
        await service.loginWithGoogle('id-token').catch(() => undefined);
      }

      expect(cache.incrWithTtl).toHaveBeenCalledTimes(5);
      // The lock is written under its own key so the penalty runs its full
      // length rather than expiring when the counting window happens to end.
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringContaining('login-lock:'),
        expect.any(Number),
        15 * 60,
      );
    });

    it('clears both counters after a successful sign-in', async () => {
      prisma.allowListEntry.findFirst.mockResolvedValueOnce({ role: UserRole.TEACHER, institute: { id: 'inst-1' } });
      prisma.user.upsert.mockResolvedValueOnce({
        id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
        instituteId: 'inst-1', status: UserStatus.ACTIVE, avatarUrl: null,
      });

      await service.loginWithGoogle('id-token');

      expect(cache.resetCounter).toHaveBeenCalledWith(expect.stringContaining('login-fail:'));
      expect(cache.resetCounter).toHaveBeenCalledWith(expect.stringContaining('login-lock:'));
    });

    it('does not lock out a different email after another email fails repeatedly', async () => {
      mockVerifyIdToken.mockResolvedValue({ getPayload: () => ({ ...googlePayload, email: 'attacker@x.com' }) });
      prisma.allowListEntry.findFirst.mockResolvedValue(null);
      for (let i = 0; i < 6; i++) {
        await service.loginWithGoogle('id-token').catch(() => undefined);
      }

      mockVerifyIdToken.mockResolvedValue({ getPayload: () => googlePayload }); // back to the real teacher email
      prisma.allowListEntry.findFirst.mockResolvedValueOnce({ role: UserRole.TEACHER, institute: { id: 'inst-1' } });
      prisma.user.upsert.mockResolvedValueOnce({
        id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
        instituteId: 'inst-1', status: UserStatus.ACTIVE, avatarUrl: null,
      });

      await expect(service.loginWithGoogle('id-token')).resolves.toBeDefined();
    });
  });

  it('promotes/demotes the user role in-place when the allow-list role differs from the stored one', async () => {
    prisma.allowListEntry.findFirst.mockResolvedValueOnce({
      role: UserRole.ADMIN,
      institute: { id: 'inst-1' },
    });
    prisma.user.upsert.mockResolvedValueOnce({
      id: 'user-1', email: googlePayload.email, name: 'Teacher', role: UserRole.TEACHER,
      instituteId: 'inst-1', status: UserStatus.ACTIVE, avatarUrl: null,
    });

    await service.loginWithGoogle('id-token');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { role: UserRole.ADMIN } });
  });
});

describe('AuthService.loginAsMockRole (dev-only mock login, 06-AUTH-AUTHORIZATION.md §1)', () => {
  let service: AuthService;
  let cache: ReturnType<typeof createCacheDouble>;
  let prisma: { user: { findFirst: jest.Mock; update: jest.Mock } };
  let jwt: { sign: jest.Mock };
  let configValues: Record<string, string | boolean | undefined>;

  beforeEach(async () => {
    cache = createCacheDouble();
    prisma = { user: { findFirst: jest.fn(), update: jest.fn() } };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    // Both are now required for the happy path: dev login is opt-in, not
    // merely "not production" — see loginAsMockRole's security note.
    configValues = { NODE_ENV: 'development', ENABLE_DEV_LOGIN: true };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  it('is hard-disabled when NODE_ENV=production, without even querying for a seeded user', async () => {
    configValues['NODE_ENV'] = 'production';
    await expect(service.loginAsMockRole(UserRole.TEACHER)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  // ── Fail-closed regression suite ────────────────────────────────────────
  // These exist because the previous gate (`NODE_ENV !== 'production'`) failed
  // OPEN: any environment that wasn't literally the string 'production' — unset,
  // misspelled, or a container default — left this credential-less, role-choosing
  // token mint publicly reachable. Each case below is a real misconfiguration
  // shape that must now result in "disabled", never "anyone can be FOUNDER".

  it('is disabled when ENABLE_DEV_LOGIN is unset, even in development', async () => {
    delete configValues['ENABLE_DEV_LOGIN'];
    await expect(service.loginAsMockRole(UserRole.FOUNDER)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('is disabled when NODE_ENV is entirely unset (the fail-open case that motivated this gate)', async () => {
    delete configValues['NODE_ENV'];
    delete configValues['ENABLE_DEV_LOGIN'];
    await expect(service.loginAsMockRole(UserRole.FOUNDER)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('is disabled when NODE_ENV is misspelled (e.g. "Production") and the flag is absent', async () => {
    configValues['NODE_ENV'] = 'Production';
    delete configValues['ENABLE_DEV_LOGIN'];
    await expect(service.loginAsMockRole(UserRole.FOUNDER)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('stays disabled in production even if ENABLE_DEV_LOGIN is somehow true (belt and braces)', async () => {
    configValues['NODE_ENV'] = 'production';
    configValues['ENABLE_DEV_LOGIN'] = true;
    await expect(service.loginAsMockRole(UserRole.FOUNDER)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('does not accept a truthy non-boolean flag value (only a real boolean true enables it)', async () => {
    // Guards against a config path that hands through the raw string 'false',
    // which is truthy in JS and would otherwise re-open the endpoint.
    configValues['ENABLE_DEV_LOGIN'] = 'false';
    await expect(service.loginAsMockRole(UserRole.FOUNDER)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('tells the caller to run the seed when no user exists for that role', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    await expect(service.loginAsMockRole(UserRole.TEACHER)).rejects.toThrow(UnauthorizedException);
  });

  it('signs a real JWT for the seeded user and touches lastLoginAt', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'seed-teacher-1', email: 'mock-teacher@aios.dev', name: 'Rahul Verma',
      role: UserRole.TEACHER, instituteId: 'inst-1', avatarUrl: null,
      institute: { status: InstituteStatus.ACTIVE },
    });

    const result = await service.loginAsMockRole(UserRole.TEACHER);

    expect(result.accessToken).toBe('signed.jwt.token');
    expect(result.user).toEqual(expect.objectContaining({ id: 'seed-teacher-1', role: UserRole.TEACHER, instituteId: 'inst-1' }));
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ sub: 'seed-teacher-1', role: UserRole.TEACHER }));
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'seed-teacher-1' }, data: { lastLoginAt: expect.any(Date) } });
  });

  it('rejects mock login when the seeded user\'s institute has been suspended (Founder Console Phase 1)', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'seed-admin-1', email: 'mock-admin@aios.dev', name: 'Admin',
      role: UserRole.ADMIN, instituteId: 'inst-1', avatarUrl: null,
      institute: { status: InstituteStatus.SUSPENDED },
    });

    await expect(service.loginAsMockRole(UserRole.ADMIN)).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('never blocks the mock Founder login regardless of their home institute status', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({
      id: 'seed-founder-1', email: 'mock-founder@aios.dev', name: 'Founder',
      role: UserRole.FOUNDER, instituteId: 'inst-1', avatarUrl: null,
      institute: { status: InstituteStatus.SUSPENDED },
    });

    await expect(service.loginAsMockRole(UserRole.FOUNDER)).resolves.toEqual(
      expect.objectContaining({ accessToken: 'signed.jwt.token' }),
    );
  });
});

describe('AuthService.validateJwtPayload', () => {
  let service: AuthService;
  let cache: ReturnType<typeof createCacheDouble>;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    cache = createCacheDouble();
    prisma = { user: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  const payload = { sub: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1', tokenVersion: 0 };

  it('rejects a session for a user that no longer exists (e.g. deleted since token issue)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a session for a user suspended after the token was issued', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', status: UserStatus.SUSPENDED });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  // Regression, found by end-to-end audit against the live API: archiving a
  // student or teacher sets User.status = INACTIVE, but this check read
  // `status === SUSPENDED`, so every JWT already issued to a removed user kept
  // working until it expired. Verified live before the fix: an archived
  // student's token still returned 200 from /auth/me and /students/me.
  it('rejects a session for a user ARCHIVED (INACTIVE) after the token was issued', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', status: UserStatus.INACTIVE });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a session for any non-ACTIVE status, including ones added later', async () => {
    // The guard allow-lists ACTIVE rather than block-listing known-bad states,
    // so a status introduced in future fails closed instead of silently passing.
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', status: UserStatus.PENDING });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid, active session', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1',
      status: UserStatus.ACTIVE, avatarUrl: null, tokenVersion: 0, institute: { status: InstituteStatus.ACTIVE },
    });
    await expect(service.validateJwtPayload(payload)).resolves.toEqual(
      expect.objectContaining({ id: 'user-1', role: UserRole.TEACHER, instituteId: 'inst-1' }),
    );
  });

  it('rejects a mid-session request when the institute has since been suspended', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1',
      status: UserStatus.ACTIVE, avatarUrl: null, tokenVersion: 0, institute: { status: InstituteStatus.SUSPENDED },
    });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a mid-session request when the institute has since been archived', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1',
      status: UserStatus.ACTIVE, avatarUrl: null, tokenVersion: 0, institute: { status: InstituteStatus.ARCHIVED },
    });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('never blocks a Founder for their own home institute status', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'founder-1', email: 'f@b.com', name: 'F', role: UserRole.FOUNDER, instituteId: 'inst-1',
      status: UserStatus.ACTIVE, avatarUrl: null, tokenVersion: 0, institute: { status: InstituteStatus.SUSPENDED },
    });
    await expect(
      service.validateJwtPayload({ ...payload, sub: 'founder-1', role: UserRole.FOUNDER }),
    ).resolves.toEqual(expect.objectContaining({ id: 'founder-1', role: UserRole.FOUNDER }));
  });

  it('rejects a session whose tokenVersion no longer matches — the Founder force-logout path (Phase 4)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1',
      status: UserStatus.ACTIVE, avatarUrl: null, tokenVersion: 1, institute: { status: InstituteStatus.ACTIVE },
    });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });
});
