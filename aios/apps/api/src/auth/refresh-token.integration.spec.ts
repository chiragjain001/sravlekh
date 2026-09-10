import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RefreshTokenService, CONCURRENT_REFRESH_GRACE_MS } from './refresh-token.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The refresh lifecycle against a REAL PostgreSQL database.
 *
 * The unit spec mocks Prisma, which proves the logic but cannot prove the two
 * things that actually decide whether rotation is safe under load:
 *
 *   1. that the `tokenHash` UNIQUE index and the conditional `updateMany` really
 *      serialise two simultaneous rotations, rather than the application merely
 *      believing they do;
 *   2. that reuse detection fires against rows the database wrote, not rows a
 *      mock handed back.
 *
 * Concurrency bugs are exactly the class of bug a mocked transaction cannot
 * find — `$transaction` in the unit spec just calls the callback.
 *
 * SKIPPED unless TEST_DATABASE_URL is set, so `pnpm test` stays hermetic and CI
 * without a database is unaffected. Run it with:
 *
 *   docker compose -f infra/staging/docker-compose.yml up -d staging-db
 *   TEST_DATABASE_URL="postgresql://aios_staging:staging_local_only@localhost:5433/aios_staging" \
 *     npx jest src/auth/refresh-token.integration
 */
const DATABASE_URL = process.env['TEST_DATABASE_URL'];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb('RefreshTokenService (real database)', () => {
  let service: RefreshTokenService;
  let prisma: PrismaClient;
  let userId: string;
  let instituteId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });
    await prisma.$connect();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RefreshTokenService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(RefreshTokenService);

    // A dedicated institute + user, so this never collides with seed data and
    // can be cleaned up wholesale.
    const institute = await prisma.institute.create({
      data: { name: `refresh-int-test-${Date.now()}`, domainAllowlist: [] },
    });
    instituteId = institute.id;
    const user = await prisma.user.create({
      data: {
        instituteId,
        googleSub: `refresh-int-${Date.now()}`,
        email: `refresh-int-${Date.now()}@test.local`,
        name: 'Refresh Integration',
        role: 'STUDENT',
      },
    });
    userId = user.id;
  }, 60_000);

  afterAll(async () => {
    if (!prisma) return;
    // RefreshToken cascades from User, which cascades from Institute.
    await prisma.institute.delete({ where: { id: instituteId } }).catch(() => undefined);
    await prisma.$disconnect();
  }, 60_000);

  it('persists only the hash — the token itself is nowhere in the row', async () => {
    const { token } = await service.issue(userId);

    const rows = await prisma.refreshToken.findMany({ where: { userId } });
    const serialised = JSON.stringify(rows);

    expect(serialised).not.toContain(token);
    expect(rows.some((r) => r.tokenHash.length === 64)).toBe(true); // hex sha256
  });

  it('rotates: the old token stops working and the new one works', async () => {
    const { token: first } = await service.issue(userId);

    const { refresh } = await service.rotate(first);

    // The successor works.
    await expect(service.rotate(refresh.token)).resolves.toBeDefined();

    // The original is now twice-rotated and long enough ago to be reuse.
    await prisma.refreshToken.updateMany({
      where: { tokenHash: { not: '' }, userId, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - CONCURRENT_REFRESH_GRACE_MS - 60_000) },
    });
    await expect(service.rotate(first)).rejects.toThrow(UnauthorizedException);
  });

  /**
   * THE TEST THAT NEEDS A REAL DATABASE.
   *
   * Ten simultaneous rotations of the same token. Exactly one must succeed. If
   * the conditional update were not doing its job, several would "succeed" and
   * mint several live successors from one token — silently forking the session,
   * which is the precise outcome reuse detection exists to prevent and which a
   * mocked transaction cannot detect.
   */
  it('serialises concurrent rotations — exactly one winner, one successor row', async () => {
    const { token } = await service.issue(userId);
    const before = await prisma.refreshToken.count({ where: { userId } });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => service.rotate(token)),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    // Losers must be the retryable race, never a family revocation — otherwise a
    // user with several tabs open would be logged out for it.
    for (const r of results.filter((x) => x.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(UnauthorizedException);
      expect(((r as PromiseRejectedResult).reason as Error).message).toBe('Please retry.');
    }

    // Exactly one new row: one successor, not ten.
    const after = await prisma.refreshToken.count({ where: { userId } });
    expect(after).toBe(before + 1);
  }, 30_000);

  it('reuse detection revokes the whole family, in the database', async () => {
    const { token: original, familyId } = await service.issue(userId);
    const { refresh: successor } = await service.rotate(original);

    // Age the rotation past the grace window so this reads as replay, not a race.
    await prisma.refreshToken.updateMany({
      where: { familyId, rotatedAt: { not: null } },
      data: { rotatedAt: new Date(Date.now() - CONCURRENT_REFRESH_GRACE_MS - 60_000) },
    });

    await expect(service.rotate(original)).rejects.toThrow(UnauthorizedException);

    const family = await prisma.refreshToken.findMany({ where: { familyId } });
    expect(family.every((t) => t.revokedAt !== null)).toBe(true);
    expect(family.some((t) => t.revokedReason === 'reuse_detected')).toBe(true);

    // The successor the thief did not have is dead too — that is the point.
    await expect(service.rotate(successor.token)).rejects.toThrow(UnauthorizedException);
  });

  it('revoking one session leaves the user’s other sessions alive', async () => {
    const phone = await service.issue(userId);
    const laptop = await service.issue(userId);

    await service.revoke(phone.token, 'logout');

    await expect(service.rotate(phone.token)).rejects.toThrow(UnauthorizedException);
    await expect(service.rotate(laptop.token)).resolves.toBeDefined();
  });

  it('revokeAllForUser ends every live session at once', async () => {
    const a = await service.issue(userId);
    const b = await service.issue(userId);

    const count = await service.revokeAllForUser(userId, 'force_logout');
    expect(count).toBeGreaterThanOrEqual(2);

    await expect(service.rotate(a.token)).rejects.toThrow(UnauthorizedException);
    await expect(service.rotate(b.token)).rejects.toThrow(UnauthorizedException);
  });

  it('an expired token is refused even though the row still exists', async () => {
    const { token } = await service.issue(userId);
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null, rotatedAt: null },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(service.rotate(token)).rejects.toThrow(UnauthorizedException);
  });
});
