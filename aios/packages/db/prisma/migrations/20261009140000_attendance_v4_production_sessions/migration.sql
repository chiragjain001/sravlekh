-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TimetableExceptionType" AS ENUM ('CANCELLED', 'SUBSTITUTE', 'RESCHEDULED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable attendance_sessions
CREATE TABLE IF NOT EXISTS "attendance_sessions" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "timetableSlotId" TEXT,
    "date" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "subjectId" TEXT,
    "snapshotTeacherUserId" TEXT NOT NULL,
    "snapshotTeacherName" TEXT NOT NULL,
    "snapshotSubjectName" TEXT,
    "snapshotBatchName" TEXT NOT NULL,
    "snapshotPeriodNumber" INTEGER,
    "snapshotStartTime" TIMESTAMP(3) NOT NULL,
    "snapshotEndTime" TIMESTAMP(3) NOT NULL,
    "snapshotRoom" TEXT,
    "rosterSnapshotAt" TIMESTAMP(3),
    "substituteUserId" TEXT,
    "examOverrideId" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledReason" TEXT,
    "cancelledByUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "missingAlertSentAt" TIMESTAMP(3),
    "missingAlertJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable attendance_session_rosters
CREATE TABLE IF NOT EXISTS "attendance_session_rosters" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "snapshotRollNo" TEXT,
    "snapshotName" TEXT NOT NULL,
    "enrolledAtTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_session_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable attendance_correction_logs
CREATE TABLE IF NOT EXISTS "attendance_correction_logs" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "previousStatus" "AttendanceStatus" NOT NULL,
    "newStatus" "AttendanceStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "correctedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_correction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable timetable_exceptions
CREATE TABLE IF NOT EXISTS "timetable_exceptions" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "timetableSlotId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" "TimetableExceptionType" NOT NULL,
    "substituteUserId" TEXT,
    "targetDate" TEXT,
    "overrideStart" TIMESTAMP(3),
    "overrideEnd" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_exceptions_pkey" PRIMARY KEY ("id")
);

-- AlterTable attendance_records: add columns if not exists
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "sessionId" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "subjectId" TEXT;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "attendance_records" ADD COLUMN IF NOT EXISTS "correctedByUserId" TEXT;

-- Drop legacy unique constraint and index if exists
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_studentProfileId_batchId_date_key";
DROP INDEX IF EXISTS "attendance_records_studentProfileId_batchId_date_key";

-- Create indexes on attendance_records
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_records_sessionId_studentProfileId_key" ON "attendance_records"("sessionId", "studentProfileId");
CREATE INDEX IF NOT EXISTS "attendance_records_sessionId_idx" ON "attendance_records"("sessionId");
CREATE INDEX IF NOT EXISTS "attendance_records_batchId_date_idx" ON "attendance_records"("batchId", "date");
CREATE INDEX IF NOT EXISTS "attendance_records_studentProfileId_subjectId_idx" ON "attendance_records"("studentProfileId", "subjectId");

-- Create indexes on attendance_sessions
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_sessions_timetableSlotId_date_key" ON "attendance_sessions"("timetableSlotId", "date");
CREATE INDEX IF NOT EXISTS "attendance_sessions_instituteId_date_idx" ON "attendance_sessions"("instituteId", "date");
CREATE INDEX IF NOT EXISTS "attendance_sessions_batchId_date_idx" ON "attendance_sessions"("batchId", "date");
CREATE INDEX IF NOT EXISTS "attendance_sessions_snapshotTeacherUserId_date_idx" ON "attendance_sessions"("snapshotTeacherUserId", "date");
CREATE INDEX IF NOT EXISTS "attendance_sessions_substituteUserId_date_idx" ON "attendance_sessions"("substituteUserId", "date");
CREATE INDEX IF NOT EXISTS "attendance_sessions_instituteId_finalizedAt_cancelledAt_idx" ON "attendance_sessions"("instituteId", "finalizedAt", "cancelledAt");

-- Create indexes on attendance_session_rosters
CREATE UNIQUE INDEX IF NOT EXISTS "attendance_session_rosters_sessionId_studentProfileId_key" ON "attendance_session_rosters"("sessionId", "studentProfileId");
CREATE INDEX IF NOT EXISTS "attendance_session_rosters_sessionId_idx" ON "attendance_session_rosters"("sessionId");

-- Create indexes on attendance_correction_logs
CREATE INDEX IF NOT EXISTS "attendance_correction_logs_sessionId_idx" ON "attendance_correction_logs"("sessionId");
CREATE INDEX IF NOT EXISTS "attendance_correction_logs_recordId_idx" ON "attendance_correction_logs"("recordId");
CREATE INDEX IF NOT EXISTS "attendance_correction_logs_instituteId_createdAt_idx" ON "attendance_correction_logs"("instituteId", "createdAt");

-- Create indexes on timetable_exceptions
CREATE UNIQUE INDEX IF NOT EXISTS "timetable_exceptions_timetableSlotId_date_key" ON "timetable_exceptions"("timetableSlotId", "date");
CREATE INDEX IF NOT EXISTS "timetable_exceptions_instituteId_date_idx" ON "timetable_exceptions"("instituteId", "date");

-- Add foreign key constraints safely
DO $$ BEGIN
    ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "timetable_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_sessions" ADD CONSTRAINT "attendance_sessions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_session_rosters" ADD CONSTRAINT "attendance_session_rosters_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_session_rosters" ADD CONSTRAINT "attendance_session_rosters_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_correction_logs" ADD CONSTRAINT "attendance_correction_logs_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "attendance_correction_logs" ADD CONSTRAINT "attendance_correction_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "attendance_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "timetable_exceptions" ADD CONSTRAINT "timetable_exceptions_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    ALTER TABLE "timetable_exceptions" ADD CONSTRAINT "timetable_exceptions_timetableSlotId_fkey" FOREIGN KEY ("timetableSlotId") REFERENCES "timetable_slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
