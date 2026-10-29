import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';
import { teacherBatchCacheKey } from './cache-keys';

/**
 * Batch-level read scoping for the TEACHER role. Most list endpoints
 * (batches/exams/students) were institute-wide for any TEACHER — never
 * filtered to the teacher's own `batchTeacher` assignments, unlike
 * notices/reports which already do this via `assertTeacherOwnsBatch`.
 * Returns null for non-TEACHER actors (no filter — ADMIN/FOUNDER/STUDENT
 * paths are unaffected), otherwise the batch IDs to restrict a `where`
 * clause to (possibly empty, for a teacher assigned to no batch yet).
 *
 * Caching (P1.2): every TEACHER list endpoint (exams, students, batches)
 * called this with two sequential DB queries on every request. A 60-second
 * Redis TTL eliminates those queries for the common case without staling the
 * scoping window beyond the next assignment change (which already invalidates
 * the cache via delTeacherBatchCache). Non-TEACHER callers return immediately
 * with null, so the cache key is never written or read for them.
 */
const TEACHER_BATCH_CACHE_TTL_SECONDS = 60;

export async function getTeacherBatchIds(
  prisma: PrismaService,
  actor: AuthenticatedUser,
  cache?: CacheService,
): Promise<string[] | null> {
  if (actor.role !== UserRole.TEACHER) return null;

  // Attempt cache read first (fail-open: a cache miss falls through to DB)
  if (cache) {
    const cached = await cache.get<string[]>(teacherBatchCacheKey(actor.id));
    if (cached !== undefined) return cached;
  }

  const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
  if (!teacherProfile) {
    if (cache) await cache.set(teacherBatchCacheKey(actor.id), [], TEACHER_BATCH_CACHE_TTL_SECONDS);
    return [];
  }

  const assignments = await prisma.batchTeacher.findMany({
    where: { teacherProfileId: teacherProfile.id, removedAt: null },
    select: { batchId: true },
  });

  const batchIds = (assignments ?? []).map((a) => a.batchId);

  if (cache) {
    await cache.set(teacherBatchCacheKey(actor.id), batchIds, TEACHER_BATCH_CACHE_TTL_SECONDS);
  }

  return batchIds;
}

/**
 * Invalidate the teacher-batch cache for a specific teacher.
 * Must be called whenever a BatchTeacher assignment is created or removed, so
 * the next request re-fetches from the DB rather than serving a stale scope.
 */
export async function invalidateTeacherBatchCache(userId: string, cache: CacheService): Promise<void> {
  await cache.del(teacherBatchCacheKey(userId));
}
