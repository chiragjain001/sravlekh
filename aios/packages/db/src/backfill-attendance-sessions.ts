/**
 * AIOS Attendance V4 — Safe, Idempotent Legacy Backfill Procedure
 *
 * PURPOSE:
 * Links legacy AttendanceRecord rows (created prior to V4 AttendanceSession engine)
 * to authoritative AttendanceSession rows so they appear seamlessly in Student,
 * Teacher, and Admin views without data loss or constraint conflicts.
 *
 * SAFETY INVARIANTS:
 * 1. Read-only by default (runs in dry-run mode unless --execute is specified).
 * 2. Idempotent: Can be run multiple times safely; only touches records where sessionId IS NULL.
 * 3. Non-destructive: Never deletes or modifies studentProfileId, batchId, date, or status.
 * 4. Preserves historical timestamps: Sets finalizedAt to match the legacy update timestamp.
 *
 * USAGE:
 *   Dry-run (report only):
 *     pnpm --filter @aios/db exec tsx src/backfill-attendance-sessions.ts
 *
 *   Execute:
 *     pnpm --filter @aios/db exec tsx src/backfill-attendance-sessions.ts --execute
 */

import { PrismaClient, AttendanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function runBackfill() {
  const isDryRun = !process.argv.includes('--execute');

  console.log('========================================================');
  console.log(`AIOS Attendance V4 Backfill Engine [${isDryRun ? 'DRY-RUN MODE' : 'EXECUTE MODE'}]`);
  console.log('========================================================');

  // 1. Identify unlinked records
  const unlinkedCount = await prisma.attendanceRecord.count({
    where: { sessionId: null },
  });

  console.log(`Found ${unlinkedCount} attendance records with sessionId = NULL.`);

  if (unlinkedCount === 0) {
    console.log('✅ All attendance records already possess valid session links.');
    console.log('Zero backfill operations required.');
    return;
  }

  // 2. Fetch all unlinked records with their batch info
  const unlinkedRecords = await prisma.attendanceRecord.findMany({
    where: { sessionId: null },
    include: {
      batch: { select: { id: true, name: true, instituteId: true } },
      studentProfile: { select: { id: true, rollNumber: true, user: { select: { name: true } } } },
    },
    orderBy: { date: 'asc' },
  });

  // Group by instituteId, batchId, and local calendar date (YYYY-MM-DD)
  const groupMap = new Map<string, typeof unlinkedRecords>();

  for (const record of unlinkedRecords) {
    const calendarDate = record.date.toISOString().split('T')[0];
    const groupKey = `${record.batch.instituteId}::${record.batchId}::${calendarDate}`;
    const list = groupMap.get(groupKey) || [];
    list.push(record);
    groupMap.set(groupKey, list);
  }

  console.log(`Identified ${groupMap.size} distinct (Batch, Date) session groups to backfill.\n`);

  let createdSessions = 0;
  let linkedRecords = 0;
  let createdRosterEntries = 0;

  for (const [key, records] of Array.from(groupMap.entries())) {
    const parts = key.split('::');
    const instituteId = parts[0]!;
    const batchId = parts[1]!;
    const calendarDate = parts[2]!;
    const firstRecord = records[0];
    if (!firstRecord) continue;
    const batchName = firstRecord.batch.name;
    const markedBy = firstRecord.markedByUserId || 'system-legacy';

    // Latest update timestamp for finalizedAt
    const maxUpdatedAt = records.reduce(
      (max, r) => (r.updatedAt > max ? r.updatedAt : max),
      firstRecord.updatedAt,
    );

    const slotStart = new Date(`${calendarDate}T09:00:00.000Z`);
    const slotEnd = new Date(`${calendarDate}T10:00:00.000Z`);

    if (isDryRun) {
      console.log(`[DRY-RUN] Would create session for Batch "${batchName}" on ${calendarDate} (${records.length} records)`);
      createdSessions++;
      linkedRecords += records.length;
      createdRosterEntries += records.length;
    } else {
      // Find existing synthetic session or create a new one
      let session = await prisma.attendanceSession.findFirst({
        where: {
          instituteId,
          batchId,
          date: calendarDate,
          timetableSlotId: null,
        },
      });

      if (!session) {
        session = await prisma.attendanceSession.create({
          data: {
            instituteId,
            timetableSlotId: null,
            date: calendarDate,
            batchId,
            subjectId: firstRecord.subjectId ?? null,
            snapshotTeacherUserId: markedBy,
            snapshotTeacherName: 'Historical Teacher',
            snapshotSubjectName: 'General Class',
            snapshotBatchName: batchName,
            snapshotPeriodNumber: 1,
            snapshotStartTime: slotStart,
            snapshotEndTime: slotEnd,
            rosterSnapshotAt: maxUpdatedAt,
            finalizedAt: maxUpdatedAt,
            finalizedByUserId: markedBy,
            version: 1,
          },
        });
        createdSessions++;
      }

      // Link records to this session
      for (const rec of records) {
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { sessionId: session.id },
        });
        linkedRecords++;

        // Add to session roster if not already present
        const existingRoster = await prisma.attendanceSessionRoster.findUnique({
          where: {
            sessionId_studentProfileId: {
              sessionId: session.id,
              studentProfileId: rec.studentProfileId,
            },
          },
        });

        if (!existingRoster) {
          await prisma.attendanceSessionRoster.create({
            data: {
              sessionId: session.id,
              studentProfileId: rec.studentProfileId,
              snapshotRollNo: rec.studentProfile.rollNumber,
              snapshotName: rec.studentProfile.user.name,
              enrolledAtTime: rec.createdAt,
            },
          });
          createdRosterEntries++;
        }
      }
    }
  }

  console.log('\n========================================================');
  console.log(`Backfill Summary (${isDryRun ? 'DRY-RUN' : 'COMPLETED'}):`);
  console.log(`  - Sessions ${isDryRun ? 'to create' : 'created'}: ${createdSessions}`);
  console.log(`  - Records ${isDryRun ? 'to link' : 'linked'}: ${linkedRecords}`);
  console.log(`  - Roster entries ${isDryRun ? 'to create' : 'created'}: ${createdRosterEntries}`);
  console.log('========================================================');

  if (!isDryRun) {
    const remainingUnlinked = await prisma.attendanceRecord.count({
      where: { sessionId: null },
    });
    console.log(`Verification: Remaining records with sessionId = NULL: ${remainingUnlinked}`);
    if (remainingUnlinked === 0) {
      console.log('✅ Database is now 100% Attendance V4 compliant.');
    } else {
      console.error(`⚠️ Warning: ${remainingUnlinked} records still have sessionId = NULL.`);
    }
  }
}

runBackfill()
  .catch((err) => {
    console.error('Backfill error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
