/**
 * AIOS Identity & Unique Code Backfill Procedure
 *
 * PURPOSE:
 * 1. Generates unique institute `shortCode` for all institutes lacking one.
 * 2. Cleanses placeholder `googleSub` dummy strings (`local_...`) to NULL,
 *    enabling unlinked accounts to link smoothly upon their first real Google OAuth login.
 * 3. Allocates deterministic institute-scoped `studentCode` and `teacherCode`.
 * 4. Idempotently provisions `BatchEnrollment` records for existing student profiles.
 *
 * SAFETY INVARIANTS:
 * - Dry-run by default; supply `--execute` to write changes.
 * - Non-destructive: Never overwrites existing non-null codes or deletes student records.
 * - Idempotent: Subsequent executions make zero modifications.
 *
 * USAGE:
 *   Dry-run (report only):
 *     pnpm --filter @aios/db exec tsx src/backfill-unique-codes.ts
 *
 *   Execute:
 *     pnpm --filter @aios/db exec tsx src/backfill-unique-codes.ts --execute
 */

import { PrismaClient, EnrollmentStatus } from '@prisma/client';

const prisma = new PrismaClient();

function generateShortCode(name: string, existingCodes: Set<string>): string {
  // Extract alphanumeric words only
  const cleanName = name.replace(/[^A-Za-z0-9\s]/g, ' ');
  const words = cleanName.trim().toUpperCase().split(/\s+/).filter(Boolean);
  let base = '';
  if (words.length >= 2) {
    base = words.map((w) => w[0]).join('').slice(0, 4);
  } else if (words.length === 1 && words[0]) {
    base = words[0].slice(0, 4);
  }
  if (base.length < 3) {
    base = (base + 'INST').slice(0, 4);
  }

  let candidate = base;
  let counter = 1;
  while (existingCodes.has(candidate)) {
    candidate = `${base.slice(0, 3)}${counter}`;
    counter++;
  }
  existingCodes.add(candidate);
  return candidate;
}

async function runBackfill() {
  const isDryRun = !process.argv.includes('--execute');

  console.log('========================================================');
  console.log(`AIOS Unique Codes & Enrollment Backfill [${isDryRun ? 'DRY-RUN' : 'EXECUTE'}]`);
  console.log('========================================================\n');

  // 1. Backfill Institute shortCodes
  const allInstitutes = await prisma.institute.findMany({
    select: { id: true, name: true, shortCode: true },
    orderBy: { createdAt: 'asc' },
  });

  const existingShortCodes = new Set<string>(
    allInstitutes.map((i) => i.shortCode).filter((c): c is string => Boolean(c)),
  );

  let institutesUpdated = 0;
  for (const inst of allInstitutes) {
    if (!inst.shortCode) {
      const newCode = generateShortCode(inst.name, existingShortCodes);
      console.log(`[Institute] ${inst.name} (${inst.id}) -> shortCode: ${newCode}`);
      if (!isDryRun) {
        await prisma.institute.update({
          where: { id: inst.id },
          data: { shortCode: newCode },
        });
      }
      institutesUpdated++;
    }
  }
  console.log(`Institute shortCode updates: ${institutesUpdated} ${isDryRun ? '(dry-run)' : '(committed)'}\n`);

  // 2. Clear placeholder googleSub values on User
  const placeholderUsers = await prisma.user.findMany({
    where: {
      googleSub: {
        startsWith: 'local_',
      },
    },
    select: { id: true, email: true, googleSub: true },
  });

  console.log(`Found ${placeholderUsers.length} users with placeholder local_ googleSub values.`);
  if (!isDryRun && placeholderUsers.length > 0) {
    const updatedUsers = await prisma.user.updateMany({
      where: {
        googleSub: {
          startsWith: 'local_',
        },
      },
      data: {
        googleSub: null,
      },
    });
    console.log(`Cleared ${updatedUsers.count} placeholder googleSub values to NULL.`);
  }

  // Reload institute map with updated shortCodes
  const updatedInstitutes = await prisma.institute.findMany({
    select: { id: true, shortCode: true },
  });
  const instCodeMap = new Map<string, string>();
  for (const inst of updatedInstitutes) {
    if (inst.shortCode) instCodeMap.set(inst.id, inst.shortCode);
  }

  // 3. Backfill Teacher teacherCodes
  const teachers = await prisma.teacherProfile.findMany({
    where: { teacherCode: null },
    include: { user: { select: { instituteId: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${teachers.length} teacher profiles without teacherCode.`);
  const teacherCountsByInst = new Map<string, number>();

  let teachersUpdated = 0;
  for (const teacher of teachers) {
    const instId = teacher.user.instituteId;
    const instPrefix = instCodeMap.get(instId) || 'INST';
    const seq = (teacherCountsByInst.get(instId) || 0) + 1;
    teacherCountsByInst.set(instId, seq);

    const teacherCode = `${instPrefix}-TCH-${String(seq).padStart(3, '0')}`;
    if (!isDryRun) {
      await prisma.teacherProfile.update({
        where: { id: teacher.id },
        data: { teacherCode },
      });
    }
    teachersUpdated++;
  }
  console.log(`Teacher teacherCode updates: ${teachersUpdated} ${isDryRun ? '(dry-run)' : '(committed)'}\n`);

  // 4. Backfill Student studentCodes
  const students = await prisma.studentProfile.findMany({
    where: { studentCode: null },
    select: { id: true, instituteId: true, admissionDate: true, batchId: true, rollNumber: true },
    orderBy: { admissionDate: 'asc' },
  });

  console.log(`Found ${students.length} student profiles without studentCode.`);
  const studentCountsByInst = new Map<string, number>();

  let studentsUpdated = 0;
  for (const student of students) {
    const instId = student.instituteId;
    const instPrefix = instCodeMap.get(instId) || 'INST';
    const year = student.admissionDate ? new Date(student.admissionDate).getFullYear() : 2026;
    const key = `${instId}_${year}`;
    const seq = (studentCountsByInst.get(key) || 0) + 1;
    studentCountsByInst.set(key, seq);

    const studentCode = `${instPrefix}-${year}-${String(seq).padStart(4, '0')}`;
    if (!isDryRun) {
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: { studentCode },
      });
    }
    studentsUpdated++;
  }
  console.log(`Student studentCode updates: ${studentsUpdated} ${isDryRun ? '(dry-run)' : '(committed)'}\n`);

  // 5. Backfill BatchEnrollments with Auditable Conflict Protection
  const enrolledStudents = await prisma.studentProfile.findMany({
    where: {
      batchId: { not: null },
    },
    select: {
      id: true,
      instituteId: true,
      studentCode: true,
      batchId: true,
      rollNumber: true,
      externalIds: true,
      batch: { select: { academicYear: true } },
    },
    orderBy: { admissionDate: 'asc' },
  });

  console.log(`Found ${enrolledStudents.length} students currently assigned to a batch.`);
  
  // Track existing assigned roll numbers per batch to detect duplicates deterministically
  const existingEnrollments = await prisma.batchEnrollment.findMany({
    select: { batchId: true, rollNumber: true, studentProfileId: true },
  });
  const takenRollsByBatch = new Map<string, Set<string>>();
  for (const e of existingEnrollments) {
    if (e.rollNumber) {
      if (!takenRollsByBatch.has(e.batchId)) takenRollsByBatch.set(e.batchId, new Set());
      takenRollsByBatch.get(e.batchId)!.add(e.rollNumber.trim());
    }
  }

  let enrollmentsCreated = 0;
  const reconciliationConflicts: Array<{
    studentProfileId: string;
    studentCode: string | null;
    batchId: string;
    conflictingRollNumber: string;
    detectedAt: string;
    action: string;
  }> = [];

  for (const s of enrolledStudents) {
    if (!s.batchId) continue;

    const existing = await prisma.batchEnrollment.findUnique({
      where: {
        batchId_studentProfileId: {
          batchId: s.batchId,
          studentProfileId: s.id,
        },
      },
    });

    if (!existing) {
      const rawRoll = s.rollNumber ? s.rollNumber.trim() : null;
      let rollToAssign: string | null = null;

      if (rawRoll) {
        const takenInBatch = takenRollsByBatch.get(s.batchId);
        if (takenInBatch && takenInBatch.has(rawRoll)) {
          // DUPLICATE DETECTED: DO NOT silently discard or drop!
          // Preserve in StudentProfile.externalIds and append to StudentHistory audit log.
          reconciliationConflicts.push({
            studentProfileId: s.id,
            studentCode: s.studentCode || null,
            batchId: s.batchId,
            conflictingRollNumber: rawRoll,
            detectedAt: new Date().toISOString(),
            action: 'PRESERVED_IN_PROFILE_EXTERNAL_IDS_AND_STUDENT_HISTORY',
          });

          console.warn(`[CONFLICT] Batch ${s.batchId}: Student ${s.id} rollNumber '${rawRoll}' duplicates existing enrollment. Preserving conflicting value safely.`);

          if (!isDryRun) {
            const currentExt = (s.externalIds as Record<string, any>) || {};
            await prisma.studentProfile.update({
              where: { id: s.id },
              data: {
                externalIds: {
                  ...currentExt,
                  legacyDuplicateRollNumber: rawRoll,
                  rollConflictBatchId: s.batchId,
                  rollConflictPreservedAt: new Date().toISOString(),
                },
              },
            });

            await prisma.studentHistory.create({
              data: {
                studentProfileId: s.id,
                eventType: 'ROLL_NUMBER_CONFLICT',
                description: `Duplicate roll number '${rawRoll}' detected during canonical backfill in batch ${s.batchId}. Value preserved in externalIds for reconciliation.`,
                oldValue: rawRoll,
                newValue: null,
              },
            });
          }
          rollToAssign = null; // Stored as null in enrollment to avoid unique violation, but preserved in profile & history
        } else {
          if (!takenRollsByBatch.has(s.batchId)) takenRollsByBatch.set(s.batchId, new Set());
          takenRollsByBatch.get(s.batchId)!.add(rawRoll);
          rollToAssign = rawRoll;
        }
      }

      if (!isDryRun) {
        await prisma.batchEnrollment.create({
          data: {
            instituteId: s.instituteId,
            batchId: s.batchId,
            studentProfileId: s.id,
            rollNumber: rollToAssign,
            academicYear: s.batch?.academicYear || '2025-2026',
            status: EnrollmentStatus.ACTIVE,
          },
        });
      }
      enrollmentsCreated++;
    }
  }

  console.log(`BatchEnrollments created: ${enrollmentsCreated} ${isDryRun ? '(dry-run)' : '(committed)'}`);
  if (reconciliationConflicts.length > 0) {
    console.log(`\n[AUDIT] ${reconciliationConflicts.length} roll-number conflicts safely preserved for administrative review:`);
    console.table(reconciliationConflicts);
  }
  console.log('\n========================================================');
  console.log('Backfill process complete!');
  console.log('========================================================');
}

runBackfill()
  .catch((err) => {
    console.error('Fatal backfill error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
