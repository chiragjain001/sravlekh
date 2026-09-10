// Real ExamStatus has 7 stages (DRAFT..LOCKED); several teacher screens group
// them into the same 3-bucket display the UI was originally designed around.
export function toDisplayExamStatus(status: string): 'completed' | 'grading' | 'scheduled' {
  if (status === 'LOCKED') return 'completed';
  if (status === 'EVALUATING') return 'grading';
  return 'scheduled';
}

// Mirrors apps/api/src/shared/exam-status-transitions.ts — shared by v1 Exam
// and v2 AssessmentDelivery (both use the ExamStatus column/state machine).
export const EXAM_STATUS_SEQUENCE = ['DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ONGOING', 'EVALUATING', 'LOCKED'] as const;

export function nextExamStatus(status: string): string | null {
  const idx = EXAM_STATUS_SEQUENCE.indexOf(status as (typeof EXAM_STATUS_SEQUENCE)[number]);
  if (idx === -1 || idx === EXAM_STATUS_SEQUENCE.length - 1) return null;
  return EXAM_STATUS_SEQUENCE[idx + 1]!;
}
