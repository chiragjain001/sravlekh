-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TEACHER', 'ADMIN', 'FOUNDER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "InstitutePlan" AS ENUM ('TRIAL', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "InstituteStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ONBOARDING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExamType" AS ENUM ('UNIT_TEST', 'CHAPTER_TEST', 'WEEKLY_TEST', 'MONTHLY_TEST', 'MOCK_TEST', 'REVISION_TEST', 'PRE_BOARD', 'SUBJECT_TEST', 'PRACTICE_TEST');

-- CreateEnum
CREATE TYPE "ExamStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ONGOING', 'EVALUATING', 'LOCKED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'MULTI_CORRECT', 'SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL', 'MATCH_THE_FOLLOWING', 'PASSAGE_BASED');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TimetableSlotType" AS ENUM ('CLASS', 'EXAM', 'REVISION', 'REMEDIAL', 'EXTRA_CLASS', 'BREAK', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "CaptureMode" AS ENUM ('MANUAL_GRID', 'CSV_IMPORT', 'PHOTO_CAPTURE', 'OMR_IMPORT');

-- CreateEnum
CREATE TYPE "MistakeTagType" AS ENUM ('CONCEPT_ERROR', 'FORMULA_ERROR', 'CALCULATION_ERROR', 'CARELESS', 'NOT_ATTEMPTED', 'PRESENTATION_ERROR');

-- CreateEnum
CREATE TYPE "DoubtStatus" AS ENUM ('OPEN', 'ASSIGNED', 'ANSWERED', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'LATE_SUBMITTED', 'GRADED', 'MISSED');

-- CreateEnum
CREATE TYPE "NoticeChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('REPORT_CARD', 'PROGRESS_CARD', 'CLASS_REPORT', 'CHAPTER_REPORT', 'TEACHER_REPORT', 'BATCH_REPORT', 'IMPROVEMENT_SHEET');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'PUBLISH', 'LOCK', 'UNLOCK', 'TRANSFER', 'ROLE_CHANGE', 'LOGIN', 'LOGIN_FAILED');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentKind" AS ENUM ('COACHING_TEST', 'SCHOOL_THEORY_EXAM', 'PRACTICE_TEST', 'DIAGNOSTIC', 'HOMEWORK_GRADED');

-- CreateEnum
CREATE TYPE "StakesLevel" AS ENUM ('GRADED', 'PRACTICE', 'DIAGNOSTIC_ONLY');

-- CreateEnum
CREATE TYPE "EvaluationPolicyMode" AS ENUM ('AUTOMATIC', 'MANUAL_ONLY', 'AI_ASSIST_MANDATORY_REVIEW', 'AI_FINAL_LOW_STAKES');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DIGITAL_VALUE', 'OMR_MARK', 'PAGE_REGION');

-- CreateEnum
CREATE TYPE "CaptureProviderType" AS ENUM ('OMR', 'MANUAL_GRID', 'CSV_IMPORT', 'PHOTO_CAPTURE_OBJECTIVE', 'PHOTO_CAPTURE_SUBJECTIVE');

-- CreateEnum
CREATE TYPE "DocumentBundleStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'PARTIALLY_RESOLVED', 'COMPLETE', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'PAGE_PROCESSING', 'IDENTITY_PENDING', 'REGION_MAPPING', 'READY_FOR_EVALUATION', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentLayoutType" AS ENUM ('TEMPLATE_KNOWN', 'FREE_FORM');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('PENDING', 'PROCESSED', 'FLAGGED');

-- CreateEnum
CREATE TYPE "RegionType" AS ENUM ('QUESTION_ANSWER', 'HEADER', 'MARGIN', 'ROLL_NUMBER_FIELD', 'SIGNATURE', 'UNCLASSIFIED');

-- CreateEnum
CREATE TYPE "DetectionMethod" AS ENUM ('AUTO_LAYOUT_DETECTION', 'MANUAL_TEACHER_MARKUP', 'TEMPLATE_MATCHED');

-- CreateEnum
CREATE TYPE "OCRBlockType" AS ENUM ('PRINTED_TEXT', 'HANDWRITTEN_TEXT', 'MATHEMATICAL_EXPRESSION', 'DIAGRAM_SKETCH', 'TABLE');

-- CreateEnum
CREATE TYPE "ProcessingStage" AS ENUM ('VALIDATE', 'DESKEW', 'PAGE_ORDER', 'IDENTITY_RESOLVE', 'REGION_DETECT', 'LAYOUT_ANALYSIS', 'OCR', 'QUESTION_MAP');

-- CreateEnum
CREATE TYPE "ProcessingJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('CIRCLE', 'TICK', 'CROSS', 'COMMENT');

-- CreateEnum
CREATE TYPE "IdentityMethod" AS ENUM ('BARCODE', 'ROLL_NUMBER_OCR', 'QR_CODE', 'MANUAL_ADMIN_MATCH');

-- CreateEnum
CREATE TYPE "IdentityStatus" AS ENUM ('PENDING', 'AUTO_RESOLVED', 'MANUALLY_CONFIRMED', 'MANUALLY_CORRECTED', 'UNRESOLVED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "RubricScoringMode" AS ENUM ('CRITERION_ADDITIVE', 'STEP_WISE', 'HOLISTIC_WITH_GUIDANCE');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'AI_SUGGESTED', 'TEACHER_REVIEWED', 'REVIEWER_FINALIZED');

-- CreateEnum
CREATE TYPE "EvaluationSource" AS ENUM ('AI', 'TEACHER', 'REVIEWER');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'DUPLICATE', 'UNDER_EVALUATION', 'FINALIZED');

-- CreateEnum
CREATE TYPE "AIModelPurpose" AS ENUM ('EVALUATION', 'OCR', 'HANDWRITING');

-- CreateTable
CREATE TABLE "institutes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domainAllowlist" TEXT[],
    "plan" "InstitutePlan" NOT NULL DEFAULT 'TRIAL',
    "status" "InstituteStatus" NOT NULL DEFAULT 'ONBOARDING',
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allow_list_entries" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "addedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "allow_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "googleSub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "batchId" TEXT,
    "subjectId" TEXT,
    "grantedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rollNumber" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "guardianEmail" TEXT,
    "address" TEXT,
    "photoUrl" TEXT,
    "documents" TEXT[],
    "tags" TEXT[],
    "batchId" TEXT,
    "admissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_history" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByUserId" TEXT,

    CONSTRAINT "student_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qualification" TEXT,
    "subjectIds" TEXT[],
    "availability" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "classYear" TEXT,
    "section" TEXT,
    "academicYear" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batch_teachers" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "teacherProfileId" TEXT NOT NULL,
    "subjectId" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "batch_teachers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subjects" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "difficulty" "DifficultyLevel" NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "options" JSONB,
    "solution" TEXT,
    "sourceRef" TEXT,
    "qualityScore" DOUBLE PRECISION,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "rubricId" TEXT,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "options" JSONB,
    "solution" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blueprints" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "duration" INTEGER NOT NULL,
    "instructions" TEXT,
    "distribution" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "examId" TEXT,
    "title" TEXT NOT NULL,
    "status" "PaperStatus" NOT NULL DEFAULT 'DRAFT',
    "isPersonalized" BOOLEAN NOT NULL DEFAULT false,
    "targetStudentId" TEXT,
    "targetBatchId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_versions" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "setLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paper_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_items" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "paper_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exams" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ExamType" NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "scheduledDate" TIMESTAMP(3),
    "durationMinutes" INTEGER,
    "venue" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "lockedByUserId" TEXT,
    "unlockReason" TEXT,
    "captureMode" "CaptureMode" NOT NULL DEFAULT 'MANUAL_GRID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_sheets" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "captureMode" "CaptureMode" NOT NULL,
    "photoUrl" TEXT,
    "omrFilePath" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "answer_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_records" (
    "id" TEXT NOT NULL,
    "examId" TEXT,
    "studentProfileId" TEXT NOT NULL,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "obtainedMarks" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "rank" INTEGER,
    "evaluatedByUserId" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "isFinalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attemptId" TEXT,

    CONSTRAINT "score_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "answerSheetId" TEXT,
    "questionId" TEXT NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,
    "marksAvailable" DOUBLE PRECISION NOT NULL,
    "isCorrect" BOOLEAN,
    "studentAnswer" TEXT,
    "mistakeTags" "MistakeTagType"[],
    "teacherComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "attemptId" TEXT,
    "evidenceType" "EvidenceType",
    "questionRegionId" TEXT,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_scores" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "masteryValue" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "interventionTriggeredAt" TIMESTAMP(3),

    CONSTRAINT "mastery_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "beforeMastery" DOUBLE PRECISION,
    "afterMastery" DOUBLE PRECISION,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" "TimetableSlotType" NOT NULL,
    "title" TEXT NOT NULL,
    "teacherUserId" TEXT,
    "subjectId" TEXT,
    "roomRef" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurRule" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doubt_tickets" (
    "id" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "urgency" INTEGER NOT NULL DEFAULT 1,
    "status" "DoubtStatus" NOT NULL DEFAULT 'OPEN',
    "content" TEXT NOT NULL,
    "attachmentUrls" TEXT[],
    "assignedTeacherId" TEXT,
    "responseText" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doubt_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "batchId" TEXT,
    "studentProfileId" TEXT,
    "topicId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'PENDING',
    "submissionUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "gradedMarks" DOUBLE PRECISION,
    "gradedByUserId" TEXT,
    "gradedAt" TIMESTAMP(3),
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "targetAudience" JSONB NOT NULL,
    "channels" "NoticeChannel"[],
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_deliveries" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" "NoticeChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "failureReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notice_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "scope" JSONB NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'PDF',
    "status" "ReportStatus" NOT NULL DEFAULT 'QUEUED',
    "fileUrl" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "supersedesReportId" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT,
    "actorId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assessmentKind" "AssessmentKind" NOT NULL,
    "stakesLevel" "StakesLevel" NOT NULL,
    "subjectIds" TEXT[],
    "paperId" TEXT,
    "totalMarks" DOUBLE PRECISION NOT NULL,
    "gradeLevel" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_policies" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "EvaluationPolicyMode" NOT NULL,
    "requiresHumanReview" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_deliveries" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 0,
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "captureProviderId" TEXT NOT NULL,
    "evaluationPolicyId" TEXT NOT NULL,
    "unlockReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessment_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "isActiveAttempt" BOOLEAN NOT NULL DEFAULT true,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_providers" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "type" "CaptureProviderType" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_bundles" (
    "id" TEXT NOT NULL,
    "assessmentDeliveryId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "expectedDocumentCount" INTEGER,
    "status" "DocumentBundleStatus" NOT NULL DEFAULT 'UPLOADING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "documentBundleId" TEXT,
    "attemptId" TEXT,
    "expectedPageCount" INTEGER,
    "layoutType" "DocumentLayoutType" NOT NULL DEFAULT 'TEMPLATE_KNOWN',
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "status" "PageStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_images" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "rawImageUrl" TEXT NOT NULL,
    "processedImageUrl" TEXT,
    "deskewAngle" DOUBLE PRECISION,
    "qualityScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_regions" (
    "id" TEXT NOT NULL,
    "pageImageId" TEXT NOT NULL,
    "boundingBox" JSONB NOT NULL,
    "regionType" "RegionType" NOT NULL,
    "questionId" TEXT,
    "detectionMethod" "DetectionMethod" NOT NULL,
    "detectionConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_blocks" (
    "id" TEXT NOT NULL,
    "questionRegionId" TEXT NOT NULL,
    "blockType" "OCRBlockType" NOT NULL,
    "boundingBox" JSONB NOT NULL,

    CONSTRAINT "ocr_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_results" (
    "id" TEXT NOT NULL,
    "ocrBlockId" TEXT NOT NULL,
    "extractedText" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "alternativeReadings" JSONB,
    "aiModelVersionId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiresVisualEvaluation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_jobs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "stage" "ProcessingStage" NOT NULL,
    "status" "ProcessingJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "processing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_artifacts" (
    "id" TEXT NOT NULL,
    "processingJobId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotations" (
    "id" TEXT NOT NULL,
    "pageImageId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "boundingBox" JSONB,
    "annotationType" "AnnotationType" NOT NULL,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_resolutions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "method" "IdentityMethod" NOT NULL,
    "candidateStudentProfileId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "resolvedStudentProfileId" TEXT,
    "resolvedByUserId" TEXT,
    "status" "IdentityStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "identity_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubrics" (
    "id" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "scoringMode" "RubricScoringMode" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_versions" (
    "id" TEXT NOT NULL,
    "rubricId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "criteriaSnapshot" JSONB NOT NULL,
    "editedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rubric_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" TEXT NOT NULL,
    "rubricVersionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "keywordHints" TEXT[],
    "dependsOnCriterionId" TEXT,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "currentEvaluationVersionId" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_versions" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "previousVersionId" TEXT,
    "source" "EvaluationSource" NOT NULL,
    "authorUserId" TEXT,
    "marksAwarded" DOUBLE PRECISION NOT NULL,
    "mistakeTagType" "MistakeTagType",
    "teacherComment" TEXT,
    "aiRecommendationId" TEXT,
    "disputeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluation_criterion_scores" (
    "id" TEXT NOT NULL,
    "evaluationVersionId" TEXT NOT NULL,
    "rubricCriterionId" TEXT NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,
    "note" TEXT,

    CONSTRAINT "evaluation_criterion_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "rubricVersionId" TEXT,
    "evidenceRef" JSONB NOT NULL,
    "ocrResultId" TEXT,
    "evaluationPolicyId" TEXT NOT NULL,
    "aiModelVersionId" TEXT NOT NULL,
    "promptVersionId" TEXT NOT NULL,
    "modelParameters" JSONB NOT NULL,
    "inputArtifactHash" TEXT NOT NULL,
    "suggestedMarks" DOUBLE PRECISION NOT NULL,
    "suggestedCriterionScores" JSONB,
    "confidence" DOUBLE PRECISION NOT NULL,
    "flags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_models" (
    "id" TEXT NOT NULL,
    "aiProviderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "AIModelPurpose" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_versions" (
    "id" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deprecatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_model_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "aiModelId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "allow_list_entries_instituteId_email_key" ON "allow_list_entries"("instituteId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleSub_key" ON "users"("googleSub");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_instituteId_role_idx" ON "users"("instituteId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "users_instituteId_email_key" ON "users"("instituteId", "email");

-- CreateIndex
CREATE INDEX "user_permission_grants_userId_permission_idx" ON "user_permission_grants"("userId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_grants_userId_permission_batchId_subjectId_key" ON "user_permission_grants"("userId", "permission", "batchId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_userId_key" ON "student_profiles"("userId");

-- CreateIndex
CREATE INDEX "student_profiles_batchId_idx" ON "student_profiles"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_userId_key" ON "teacher_profiles"("userId");

-- CreateIndex
CREATE INDEX "batches_instituteId_idx" ON "batches"("instituteId");

-- CreateIndex
CREATE UNIQUE INDEX "batch_teachers_batchId_teacherProfileId_subjectId_key" ON "batch_teachers"("batchId", "teacherProfileId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "subjects_instituteId_name_key" ON "subjects"("instituteId", "name");

-- CreateIndex
CREATE INDEX "questions_instituteId_subjectId_topicId_difficulty_idx" ON "questions"("instituteId", "subjectId", "topicId", "difficulty");

-- CreateIndex
CREATE INDEX "questions_isApproved_idx" ON "questions"("isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_questionId_versionNo_key" ON "question_versions"("questionId", "versionNo");

-- CreateIndex
CREATE INDEX "papers_instituteId_status_idx" ON "papers"("instituteId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "paper_versions_paperId_versionNo_key" ON "paper_versions"("paperId", "versionNo");

-- CreateIndex
CREATE UNIQUE INDEX "paper_items_paperId_questionId_key" ON "paper_items"("paperId", "questionId");

-- CreateIndex
CREATE INDEX "exams_instituteId_status_idx" ON "exams"("instituteId", "status");

-- CreateIndex
CREATE INDEX "exams_batchId_idx" ON "exams"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "answer_sheets_examId_studentProfileId_key" ON "answer_sheets"("examId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "score_records_attemptId_key" ON "score_records"("attemptId");

-- CreateIndex
CREATE INDEX "score_records_studentProfileId_idx" ON "score_records"("studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "score_records_examId_studentProfileId_key" ON "score_records"("examId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "responses_answerSheetId_questionId_key" ON "responses"("answerSheetId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "responses_attemptId_questionId_key" ON "responses"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "mastery_scores_studentProfileId_subjectId_idx" ON "mastery_scores"("studentProfileId", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "mastery_scores_studentProfileId_topicId_key" ON "mastery_scores"("studentProfileId", "topicId");

-- CreateIndex
CREATE INDEX "timetable_slots_instituteId_startTime_idx" ON "timetable_slots"("instituteId", "startTime");

-- CreateIndex
CREATE INDEX "timetable_slots_batchId_startTime_idx" ON "timetable_slots"("batchId", "startTime");

-- CreateIndex
CREATE INDEX "doubt_tickets_studentProfileId_status_idx" ON "doubt_tickets"("studentProfileId", "status");

-- CreateIndex
CREATE INDEX "assignments_batchId_dueDate_idx" ON "assignments"("batchId", "dueDate");

-- CreateIndex
CREATE INDEX "notice_deliveries_noticeId_status_idx" ON "notice_deliveries"("noticeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reports_supersedesReportId_key" ON "reports"("supersedesReportId");

-- CreateIndex
CREATE INDEX "reports_instituteId_type_idx" ON "reports"("instituteId", "type");

-- CreateIndex
CREATE INDEX "audit_logs_instituteId_createdAt_idx" ON "audit_logs"("instituteId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "assessments_instituteId_idx" ON "assessments"("instituteId");

-- CreateIndex
CREATE INDEX "assessment_deliveries_status_idx" ON "assessment_deliveries"("status");

-- CreateIndex
CREATE INDEX "attempts_assessmentDeliveryId_studentProfileId_idx" ON "attempts"("assessmentDeliveryId", "studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_assessmentDeliveryId_studentProfileId_isActiveAtte_key" ON "attempts"("assessmentDeliveryId", "studentProfileId", "isActiveAttempt");

-- CreateIndex
CREATE INDEX "documents_documentBundleId_status_idx" ON "documents"("documentBundleId", "status");

-- CreateIndex
CREATE INDEX "documents_attemptId_idx" ON "documents"("attemptId");

-- CreateIndex
CREATE UNIQUE INDEX "pages_documentId_pageNumber_key" ON "pages"("documentId", "pageNumber");

-- CreateIndex
CREATE INDEX "processing_jobs_documentId_stage_status_idx" ON "processing_jobs"("documentId", "stage", "status");

-- CreateIndex
CREATE UNIQUE INDEX "identity_resolutions_documentId_key" ON "identity_resolutions"("documentId");

-- CreateIndex
CREATE INDEX "identity_resolutions_status_idx" ON "identity_resolutions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rubrics_questionId_key" ON "rubrics"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_versions_rubricId_versionNumber_key" ON "rubric_versions"("rubricId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_responseId_key" ON "evaluations"("responseId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_currentEvaluationVersionId_key" ON "evaluations"("currentEvaluationVersionId");

-- CreateIndex
CREATE INDEX "evaluation_versions_evaluationId_createdAt_idx" ON "evaluation_versions"("evaluationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_recommendations_responseId_createdAt_idx" ON "ai_recommendations"("responseId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_recommendations_aiModelVersionId_idx" ON "ai_recommendations"("aiModelVersionId");

-- CreateIndex
CREATE INDEX "ai_recommendations_promptVersionId_idx" ON "ai_recommendations"("promptVersionId");

-- CreateIndex
CREATE INDEX "ai_model_versions_aiModelId_isActive_idx" ON "ai_model_versions"("aiModelId", "isActive");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allow_list_entries" ADD CONSTRAINT "allow_list_entries_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_grants" ADD CONSTRAINT "user_permission_grants_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_history" ADD CONSTRAINT "student_history_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_profiles" ADD CONSTRAINT "teacher_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_teachers" ADD CONSTRAINT "batch_teachers_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batch_teachers" ADD CONSTRAINT "batch_teachers_teacherProfileId_fkey" FOREIGN KEY ("teacherProfileId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_versions" ADD CONSTRAINT "paper_versions_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_items" ADD CONSTRAINT "paper_items_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_items" ADD CONSTRAINT "paper_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_sheets" ADD CONSTRAINT "answer_sheets_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_sheets" ADD CONSTRAINT "answer_sheets_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_records" ADD CONSTRAINT "score_records_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_records" ADD CONSTRAINT "score_records_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_records" ADD CONSTRAINT "score_records_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_answerSheetId_fkey" FOREIGN KEY ("answerSheetId") REFERENCES "answer_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_questionRegionId_fkey" FOREIGN KEY ("questionRegionId") REFERENCES "page_regions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_scores" ADD CONSTRAINT "mastery_scores_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_scores" ADD CONSTRAINT "mastery_scores_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mastery_scores" ADD CONSTRAINT "mastery_scores_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_tickets" ADD CONSTRAINT "doubt_tickets_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_tickets" ADD CONSTRAINT "doubt_tickets_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_tickets" ADD CONSTRAINT "doubt_tickets_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doubt_tickets" ADD CONSTRAINT "doubt_tickets_assignedTeacherId_fkey" FOREIGN KEY ("assignedTeacherId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_deliveries" ADD CONSTRAINT "notice_deliveries_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_supersedesReportId_fkey" FOREIGN KEY ("supersedesReportId") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "papers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_policies" ADD CONSTRAINT "evaluation_policies_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_deliveries" ADD CONSTRAINT "assessment_deliveries_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_deliveries" ADD CONSTRAINT "assessment_deliveries_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_deliveries" ADD CONSTRAINT "assessment_deliveries_captureProviderId_fkey" FOREIGN KEY ("captureProviderId") REFERENCES "capture_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_deliveries" ADD CONSTRAINT "assessment_deliveries_evaluationPolicyId_fkey" FOREIGN KEY ("evaluationPolicyId") REFERENCES "evaluation_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assessmentDeliveryId_fkey" FOREIGN KEY ("assessmentDeliveryId") REFERENCES "assessment_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "student_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capture_providers" ADD CONSTRAINT "capture_providers_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_bundles" ADD CONSTRAINT "document_bundles_assessmentDeliveryId_fkey" FOREIGN KEY ("assessmentDeliveryId") REFERENCES "assessment_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_documentBundleId_fkey" FOREIGN KEY ("documentBundleId") REFERENCES "document_bundles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_images" ADD CONSTRAINT "page_images_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_regions" ADD CONSTRAINT "page_regions_pageImageId_fkey" FOREIGN KEY ("pageImageId") REFERENCES "page_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_blocks" ADD CONSTRAINT "ocr_blocks_questionRegionId_fkey" FOREIGN KEY ("questionRegionId") REFERENCES "page_regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_ocrBlockId_fkey" FOREIGN KEY ("ocrBlockId") REFERENCES "ocr_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_aiModelVersionId_fkey" FOREIGN KEY ("aiModelVersionId") REFERENCES "ai_model_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_jobs" ADD CONSTRAINT "processing_jobs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_artifacts" ADD CONSTRAINT "processing_artifacts_processingJobId_fkey" FOREIGN KEY ("processingJobId") REFERENCES "processing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_pageImageId_fkey" FOREIGN KEY ("pageImageId") REFERENCES "page_images"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_resolutions" ADD CONSTRAINT "identity_resolutions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubrics" ADD CONSTRAINT "rubrics_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_versions" ADD CONSTRAINT "rubric_versions_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_rubricVersionId_fkey" FOREIGN KEY ("rubricVersionId") REFERENCES "rubric_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_dependsOnCriterionId_fkey" FOREIGN KEY ("dependsOnCriterionId") REFERENCES "rubric_criteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_currentEvaluationVersionId_fkey" FOREIGN KEY ("currentEvaluationVersionId") REFERENCES "evaluation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "evaluation_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_versions" ADD CONSTRAINT "evaluation_versions_aiRecommendationId_fkey" FOREIGN KEY ("aiRecommendationId") REFERENCES "ai_recommendations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_criterion_scores" ADD CONSTRAINT "evaluation_criterion_scores_evaluationVersionId_fkey" FOREIGN KEY ("evaluationVersionId") REFERENCES "evaluation_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_criterion_scores" ADD CONSTRAINT "evaluation_criterion_scores_rubricCriterionId_fkey" FOREIGN KEY ("rubricCriterionId") REFERENCES "rubric_criteria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_aiModelVersionId_fkey" FOREIGN KEY ("aiModelVersionId") REFERENCES "ai_model_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "prompt_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_aiProviderId_fkey" FOREIGN KEY ("aiProviderId") REFERENCES "ai_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_model_versions" ADD CONSTRAINT "ai_model_versions_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_aiModelId_fkey" FOREIGN KEY ("aiModelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
