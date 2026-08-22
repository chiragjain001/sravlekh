import { ExamStatus } from '@prisma/client';

/**
 * 01-PRODUCT-REQUIREMENTS.md / 03-FEATURE-SPECIFICATIONS.md: strict forward-only
 * state machine, one stage at a time, no skipping. The only backward transition is
 * a separate unlock() (LOCKED -> EVALUATING, admin-only, reason required).
 *
 * Shared between ExamsService (v1 Exam) and AssessmentsService (v2
 * AssessmentDelivery) — both use ExamStatus as their status column type, per
 * 05-API-SPECIFICATION.md (V2 section) §2: "PATCH /assessment-deliveries/:id/status
 * — Identical contract to v1 PATCH /exams/:id/status — same state machine, same
 * error codes." One source of truth instead of two copies of the same rule.
 */
export const EXAM_STATUS_TRANSITIONS: Record<ExamStatus, ExamStatus | null> = {
  [ExamStatus.DRAFT]: ExamStatus.REVIEW,
  [ExamStatus.REVIEW]: ExamStatus.APPROVED,
  [ExamStatus.APPROVED]: ExamStatus.PUBLISHED,
  [ExamStatus.PUBLISHED]: ExamStatus.ONGOING,
  [ExamStatus.ONGOING]: ExamStatus.EVALUATING,
  [ExamStatus.EVALUATING]: ExamStatus.LOCKED,
  [ExamStatus.LOCKED]: null,
};
