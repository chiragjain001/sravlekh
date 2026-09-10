import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  RefreshTokenService,
  REFRESH_TOKEN_TTL_DAYS,
  CONCURRENT_REFRESH_GRACE_MS,
} from './refresh-token.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The refresh-token lifecycle: normal refresh, rotation, expiry, revocation,
 * replay, and concurrent refresh.
 *
 * The property under test throughout is that a stolen refresh token cannot be
 * used indefinitely, and that trying to use one ends the session rather than
 * silently forking it.
 */
describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      // Runs the callback against the same mock, as an interactive transaction would.
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RefreshTokenService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RefreshTokenService);
  });

  /** A live, un-rotated, un-revoked token row. */
  function liveToken(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rt-1',
      userId: 'user-1',
      familyId: 'fam-1',
      tokenHash: 'irrelevant — lookup is mocked',
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      rotatedAt: null,
      revokedAt: null,
      revokedReason: null,
      userAgent: null,
      ipAddress: null,
      ...overrides,
    };
  }

  describe('issue', () => {
    it('returns a token but persists only its SHA-256 hash', async () => {
      // The central storage property: a read of this table — a leaked backup, an
      // injection, an over-broad support query — must not yield usable credentials.
      const result = await service.issue('user-1');

      const persisted = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(persisted.tokenHash).toBe(sha256(result.token));
      expect(persisted.tokenHash).not.toBe(result.token);
      expect(JSON.stringify(persisted)).not.toContain(result.token);
    });

    it('issues high-entropy tokens that never repeat', async () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 50; i++) tokens.add((await service.issue('user-1')).token);

      expect(tokens.size).toBe(50);
      // 32 bytes base64url — comfortably beyond guessing.
      for (const t of tokens) expect(t.length).toBeGreaterThanOrEqual(40);
    });

    it('starts a NEW family per login, so devices are independently revocable', async () => {
      const a = await service.issue('user-1');
      const b = await service.issue('user-1');
      expect(a.familyId).not.toBe(b.familyId);
    });

    it('sets the expiry from REFRESH_TOKEN_TTL_DAYS', async () => {
      const { expiresAt } = await service.issue('user-1');
      const expectedMs = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime() - Date.now()).toBeGreaterThan(expectedMs - 5_000);
      expect(expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(expectedMs);
    });
  });

  describe('rotate — the normal path', () => {
    it('exchanges a live token for a new one in the SAME family', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken());

      const { userId, refresh } = await service.rotate('presented-token');

      expect(userId).toBe('user-1');
      expect(refresh.familyId).toBe('fam-1'); // same session continuing
      expect(refresh.token).toBeTruthy();
    });

    it('marks the presented token rotated and creates its successor in ONE transaction', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken());

      await service.rotate('presented-token');

      // Both writes must be atomic: a crash between them would either burn the
      // old token with no successor (logging the user out) or mint a successor
      // while the old one stays live (two usable tokens).
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'rt-1', rotatedAt: null, revokedAt: null }),
          data: expect.objectContaining({ revokedReason: 'rotated' }),
        }),
      );
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('the successor is a different token from the one presented', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken());
      const { refresh } = await service.rotate('presented-token');
      expect(refresh.token).not.toBe('presented-token');
    });
  });

  describe('rotate — rejections', () => {
    it('rejects an unknown token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
      await expect(service.rotate('never-issued')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        liveToken({ expiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.rotate('stale')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejects a revoked token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        liveToken({ revokedAt: new Date(), revokedReason: 'logout' }),
      );
      await expect(service.rotate('revoked')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('gives every rejection the same message, so it cannot be used to probe tokens', async () => {
      const messages: string[] = [];

      const messageFrom = async (token: string): Promise<string> => {
        try {
          await service.rotate(token);
          return 'no error thrown';
        } catch (err) {
          return (err as Error).message;
        }
      };

      prisma.refreshToken.findUnique.mockResolvedValueOnce(null);
      messages.push(await messageFrom('a'));

      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken({ expiresAt: new Date(0) }));
      messages.push(await messageFrom('b'));

      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken({ revokedAt: new Date() }));
      messages.push(await messageFrom('c'));

      expect(new Set(messages).size).toBe(1);
    });
  });

  describe('rotate — replay / reuse detection', () => {
    it('revokes the ENTIRE family when a long-rotated token is replayed', async () => {
      // The theft case. A token rotated well in the past has just been presented,
      // so two copies exist and there is no way to tell which one this is. The
      // safe move is to end the session, forcing a fresh login.
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        liveToken({ rotatedAt: new Date(Date.now() - CONCURRENT_REFRESH_GRACE_MS - 60_000) }),
      );

      await expect(service.rotate('stolen-and-replayed')).rejects.toThrow(UnauthorizedException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { familyId: 'fam-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'reuse_detected' }),
      });
      // Crucially, no successor is minted for the replayer.
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('revokes only the affected family, never the user’s other sessions', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        liveToken({ familyId: 'fam-compromised', rotatedAt: new Date(Date.now() - 600_000) }),
      );

      await service.rotate('stolen').catch(() => undefined);

      const revocation = prisma.refreshToken.updateMany.mock.calls[0][0];
      expect(revocation.where).toEqual({ familyId: 'fam-compromised', revokedAt: null });
      // Scoped by family, not by userId — a phone and a laptop are different
      // families, and one being stolen must not log the other out.
      expect(revocation.where).not.toHaveProperty('userId');
    });
  });

  describe('rotate — concurrent refresh', () => {
    it('treats a refresh moments after rotation as a benign race and revokes NOTHING', async () => {
      // Two tabs whose access tokens expire together both refresh with the same
      // cookie. That is indistinguishable from replay, so without this window the
      // security mechanism would log real users out for having two tabs open.
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        liveToken({ rotatedAt: new Date(Date.now() - 100) }),
      );

      await expect(service.rotate('same-token-second-tab')).rejects.toThrow('Please retry.');

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('the grace window is bounded — just outside it is treated as reuse', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(
        liveToken({ rotatedAt: new Date(Date.now() - CONCURRENT_REFRESH_GRACE_MS - 1_000) }),
      );

      await expect(service.rotate('replayed')).rejects.toThrow('Session expired. Please sign in again.');
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ revokedReason: 'reuse_detected' }) }),
      );
    });

    it.each([
      ['P2028', 'Unable to start a transaction in the given time.'],
      ['P2034', 'Transaction failed due to a write conflict or a deadlock.'],
    ])('treats a %s transaction failure as retryable, not as a dead session', async (code, message) => {
      // Found by running the integration spec against a real database: ten
      // simultaneous rotations produced one winner, one clean loser, and EIGHT
      // P2028s. Interactive transactions hold a pooled connection across several
      // round trips, so a burst exhausts the pool and most requests fail before
      // they begin — which is exactly what a user with several tabs open, or every
      // active user after an API restart, generates.
      //
      // Unhandled, these surfaced as 500s and the client read them as "session
      // over", logging people out because the server was briefly busy. Nothing was
      // committed, so the presented token is still valid and a retry is correct.
      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken());
      prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error(message), { code }));

      await expect(service.rotate('contended')).rejects.toThrow('Please retry.');
      // Critically NOT a family revocation: contention is not evidence of theft.
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('still surfaces a genuine database error rather than hiding it as a retry', async () => {
      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken());
      prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('column does not exist'), { code: 'P2022' }));

      await expect(service.rotate('broken')).rejects.toThrow('column does not exist');
    });

    it('only one of two simultaneous rotations wins; the loser mints nothing', async () => {
      // Both requests read the row as un-rotated, so application-level checks
      // cannot separate them. The conditional updateMany makes the DATABASE pick a
      // winner: the loser matches 0 rows and must not create a second successor,
      // which would silently fork the session into two live tokens.
      prisma.refreshToken.findUnique.mockResolvedValueOnce(liveToken());
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 }); // lost the race

      await expect(service.rotate('contended')).rejects.toThrow('Please retry.');
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('revocation', () => {
    it('logout revokes only the presented token', async () => {
      await service.revoke('this-session');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('this-session'), revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'logout' }),
      });
    });

    it('revokeAllForUser ends every session on every device', async () => {
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 3 });

      const count = await service.revokeAllForUser('user-1');

      expect(count).toBe(3);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: expect.objectContaining({ revokedReason: 'force_logout' }),
      });
    });

    it('revoking is idempotent — already-revoked rows are excluded', async () => {
      await service.revoke('token');
      const where = prisma.refreshToken.updateMany.mock.calls[0][0].where;
      // Without `revokedAt: null` a second call would overwrite the original
      // revocation reason and timestamp, losing why the session actually ended.
      expect(where.revokedAt).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('deletes expired rows but RETAINS recently-rotated ones', async () => {
      await service.cleanupExpired(7);

      const where = prisma.refreshToken.deleteMany.mock.calls[0][0].where;
      const rotatedClause = where.OR.find((c: Record<string, unknown>) => 'rotatedAt' in c);

      // Deleting a rotated row immediately would DISABLE reuse detection for it:
      // a replayed stolen token would read as "unknown token" rather than
      // "reused token", and the family would never be revoked.
      expect(rotatedClause.rotatedAt.lt.getTime()).toBeLessThan(Date.now() - 6 * 24 * 60 * 60 * 1000);
      expect(where.OR.some((c: Record<string, unknown>) => 'expiresAt' in c)).toBe(true);
    });
  });

  describe('listActiveSessions', () => {
    it('never returns token hashes', async () => {
      await service.listActiveSessions('user-1');

      const select = prisma.refreshToken.findMany.mock.calls[0][0].select;
      expect(select).not.toHaveProperty('tokenHash');
      expect(select.id).toBe(true);
    });

    it('excludes rotated, revoked and expired sessions', async () => {
      await service.listActiveSessions('user-1');

      const where = prisma.refreshToken.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ userId: 'user-1', revokedAt: null, rotatedAt: null });
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
    });
  });
});
