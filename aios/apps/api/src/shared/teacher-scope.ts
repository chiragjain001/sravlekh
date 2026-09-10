import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { UserRole } from '@prisma/client';

/**
 * Batch-level read scoping for the TEACHER role. Most list endpoints
 * (batches/exams/students) were institute-wide for any TEACHER — never
 * filtered to the teacher's own `batchTeacher` assignments, unlike
 * notices/reports which already do this via `assertTeacherOwnsBatch`.
 * Returns null for non-TEACHER actors (no filter — ADMIN/FOUNDER/STUDENT
 * paths are unaffected), otherwise the batch IDs to restrict a `where`
 * clause to (possibly empty, for a teacher assigned to no batch yet).
 */
export async function getTeacherBatchIds(
  prisma: PrismaService,
  actor: AuthenticatedUser,
): Promise<string[] | null> {
  if (actor.role !== UserRole.TEACHER) return null;

  const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
  if (!teacherProfile) return [];

  const assignments = await prisma.batchTeacher.findMany({
    where: { teacherProfileId: teacherProfile.id, removedAt: null },
    select: { batchId: true },
  });

  return assignments.map((a) => a.batchId);
}
