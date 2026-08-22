import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe('AuthService.loginWithGoogle (06-AUTH-AUTHORIZATION.md / 13-TESTING-STRATEGY.md §7)', () => {
  let service: AuthService;
  let prisma: {
    allowListEntry: { findFirst: jest.Mock };
    user: { upsert: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let jwt: { sign: jest.Mock };

  const googlePayload = { email: 'teacher@school.com', sub: 'google-sub-1', name: 'Teacher', picture: undefined };

  beforeEach(async () => {
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
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
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

describe('AuthService.validateJwtPayload', () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  const payload = { sub: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1' };

  it('rejects a session for a user that no longer exists (e.g. deleted since token issue)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a session for a user suspended after the token was issued', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', status: UserStatus.SUSPENDED });
    await expect(service.validateJwtPayload(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid, active session', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'a@b.com', name: 'A', role: UserRole.TEACHER, instituteId: 'inst-1',
      status: UserStatus.ACTIVE, avatarUrl: null,
    });
    await expect(service.validateJwtPayload(payload)).resolves.toEqual(
      expect.objectContaining({ id: 'user-1', role: UserRole.TEACHER, instituteId: 'inst-1' }),
    );
  });
});
