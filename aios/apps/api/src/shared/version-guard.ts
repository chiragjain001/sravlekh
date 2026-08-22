import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Optimistic-concurrency guard for status-transition writes (Phase 15
 * hardening — 20-IMPLEMENTATION-PLAN.md's Phase 15 "race conditions
 * (concurrent lock attempts)" audit). The pre-Phase-15 pattern read
 * `.version`, compared it to the request's version, then wrote
 * unconditionally with `where: { id }` alone — a genuine TOCTOU gap: two
 * concurrent requests starting from the same version both pass the read-check
 * and both write, silently defeating the optimistic lock (a lost update, not
 * a rejected one). The caller now includes `version` in the write's `where`
 * (Prisma 5's extended-whereUnique filtering, GA since 4.5 — no preview flag
 * needed), making the write itself the compare-and-swap; this wraps it so a
 * concurrent winner turns the loser's write into Prisma's P2025 ("record to
 * update not found"), translated into the same STALE_VERSION conflict the
 * read-check throws, instead of a generic 500.
 */
export async function withVersionGuard<T>(op: Promise<T>, entityLabel: string): Promise<T> {
  try {
    return await op;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new ConflictException({
        code: 'STALE_VERSION',
        message: `This ${entityLabel} was changed by someone else — refresh and try again.`,
      });
    }
    throw err;
  }
}
