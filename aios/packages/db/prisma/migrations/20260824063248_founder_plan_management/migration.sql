-- AlterTable
ALTER TABLE "institutes" ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plan_definitions" (
    "plan" "InstitutePlan" NOT NULL,
    "maxUsers" INTEGER,
    "maxStudents" INTEGER,
    "maxTeachers" INTEGER,
    "maxStorageGb" INTEGER,
    "maxAssessmentsPerMonth" INTEGER,
    "trialDurationDays" INTEGER,
    "defaultFeatureFlags" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_definitions_pkey" PRIMARY KEY ("plan")
);

-- CreateTable
CREATE TABLE "institute_plan_history" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "fromPlan" "InstitutePlan",
    "toPlan" "InstitutePlan" NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institute_plan_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "institute_plan_history_instituteId_createdAt_idx" ON "institute_plan_history"("instituteId", "createdAt");

-- AddForeignKey
ALTER TABLE "institute_plan_history" ADD CONSTRAINT "institute_plan_history_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
