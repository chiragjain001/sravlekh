-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'WITHDRAWN', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AssignmentScope" AS ENUM ('BATCH', 'STUDENT_LIST', 'QUESTION_WISE');

-- CreateEnum
CREATE TYPE "PrintRunStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'PRINTED', 'FAILED');

-- CreateEnum
CREATE TYPE "BookletStatus" AS ENUM ('GENERATED', 'PRINTED', 'SCANNED', 'VOIDED', 'REPLACED');

-- DropIndex
DROP INDEX "users_googleSub_key";

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "rollNumberSnapshot" TEXT;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "bookletSerial" TEXT;

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "assessmentDeliveryId" TEXT;

-- AlterTable
ALTER TABLE "institutes" ADD COLUMN     "shortCode" TEXT;

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "externalIds" JSONB,
ADD COLUMN     "studentCode" TEXT;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "teacherCode" TEXT;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "googleSub" DROP NOT NULL;

-- CreateTable
CREATE TABLE "batch_enrollments" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "rollNumber" TEXT,
    "academicYear" TEXT,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batch_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_checker_assignments" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "scope" "AssignmentScope" NOT NULL DEFAULT 'BATCH',
    "isLeadEvaluator" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copy_checker_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_checker_student_allocations" (
    "id" TEXT NOT NULL,
    "copyCheckerAssignmentId" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_checker_student_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copy_checker_question_allocations" (
    "id" TEXT NOT NULL,
    "copyCheckerAssignmentId" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copy_checker_question_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booklet_print_runs" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "startSerial" INTEGER NOT NULL,
    "endSerial" INTEGER NOT NULL,
    "status" "PrintRunStatus" NOT NULL DEFAULT 'PENDING',
    "pdfStorageKey" TEXT,
    "signingKeyId" TEXT NOT NULL,
    "generatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booklet_print_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booklets" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "printRunId" TEXT NOT NULL,
    "bookletSerial" TEXT NOT NULL,
    "numericSerial" INTEGER NOT NULL,
    "status" "BookletStatus" NOT NULL DEFAULT 'GENERATED',
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "booklets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_enrollments_instituteId_status_idx" ON "batch_enrollments"("instituteId", "status");

-- CreateIndex
CREATE INDEX "batch_enrollments_studentProfileId_idx" ON "batch_enrollments"("studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_enrollments_batchId_studentProfileId_key" ON "batch_enrollments"("batchId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_enrollments_batchId_rollNumber_key" ON "batch_enrollments"("batchId", "rollNumber");

-- CreateIndex
CREATE INDEX "copy_checker_assignments_instituteId_idx" ON "copy_checker_assignments"("instituteId");

-- CreateIndex
CREATE INDEX "copy_checker_assignments_teacherProfileId_idx" ON "copy_checker_assignments"("teacherProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "copy_checker_assignments_assessmentDeliveryId_teacherProfil_key" ON "copy_checker_assignments"("assessmentDeliveryId", "teacherProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "copy_checker_assignments_id_assessmentDeliveryId_key" ON "copy_checker_assignments"("id", "assessmentDeliveryId");

-- CreateIndex
CREATE INDEX "copy_checker_student_allocations_assessmentDeliveryId_stude_idx" ON "copy_checker_student_allocations"("assessmentDeliveryId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "copy_checker_student_allocations_copyCheckerAssignmentId_st_key" ON "copy_checker_student_allocations"("copyCheckerAssignmentId", "studentProfileId");

-- CreateIndex
CREATE INDEX "copy_checker_question_allocations_assessmentDeliveryId_ques_idx" ON "copy_checker_question_allocations"("assessmentDeliveryId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "copy_checker_question_allocations_copyCheckerAssignmentId_q_key" ON "copy_checker_question_allocations"("copyCheckerAssignmentId", "questionId");

-- CreateIndex
CREATE INDEX "booklet_print_runs_instituteId_assessmentDeliveryId_idx" ON "booklet_print_runs"("instituteId", "assessmentDeliveryId");

-- CreateIndex
CREATE INDEX "booklets_instituteId_assessmentDeliveryId_idx" ON "booklets"("instituteId", "assessmentDeliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "booklets_assessmentDeliveryId_bookletSerial_key" ON "booklets"("assessmentDeliveryId", "bookletSerial");

-- CreateIndex
CREATE UNIQUE INDEX "booklets_assessmentDeliveryId_numericSerial_key" ON "booklets"("assessmentDeliveryId", "numericSerial");

-- CreateIndex
CREATE UNIQUE INDEX "exams_assessmentDeliveryId_key" ON "exams"("assessmentDeliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "institutes_shortCode_key" ON "institutes"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_instituteId_studentCode_key" ON "student_profiles"("instituteId", "studentCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_instituteId_googleSub_key" ON "users"("instituteId", "googleSub");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_assessmentDeliveryId_fkey" FOREIGN KEY ("assessmentDeliveryId") REFERENCES "assessment_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollments" ADD CONSTRAINT "batch_enrollments_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollments" ADD CONSTRAINT "batch_enrollments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_enrollments" ADD CONSTRAINT "batch_enrollments_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_assignments" ADD CONSTRAINT "copy_checker_assignments_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_assignments" ADD CONSTRAINT "copy_checker_assignments_assessmentDeliveryId_fkey" FOREIGN KEY ("assessmentDeliveryId") REFERENCES "assessment_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_assignments" ADD CONSTRAINT "copy_checker_assignments_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_student_allocations" ADD CONSTRAINT "copy_checker_student_allocations_copyCheckerAssignmentId_a_fkey" FOREIGN KEY ("copyCheckerAssignmentId", "assessmentDeliveryId") REFERENCES "copy_checker_assignments"("id", "assessmentDeliveryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_student_allocations" ADD CONSTRAINT "copy_checker_student_allocations_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_question_allocations" ADD CONSTRAINT "copy_checker_question_allocations_copyCheckerAssignmentId__fkey" FOREIGN KEY ("copyCheckerAssignmentId", "assessmentDeliveryId") REFERENCES "copy_checker_assignments"("id", "assessmentDeliveryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copy_checker_question_allocations" ADD CONSTRAINT "copy_checker_question_allocations_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booklet_print_runs" ADD CONSTRAINT "booklet_print_runs_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booklet_print_runs" ADD CONSTRAINT "booklet_print_runs_assessmentDeliveryId_fkey" FOREIGN KEY ("assessmentDeliveryId") REFERENCES "assessment_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booklets" ADD CONSTRAINT "booklets_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booklets" ADD CONSTRAINT "booklets_printRunId_fkey" FOREIGN KEY ("printRunId") REFERENCES "booklet_print_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booklets" ADD CONSTRAINT "booklets_assessmentDeliveryId_fkey" FOREIGN KEY ("assessmentDeliveryId") REFERENCES "assessment_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

