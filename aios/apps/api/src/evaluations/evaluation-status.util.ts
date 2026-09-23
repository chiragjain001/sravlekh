import { EvaluationSource, EvidenceType, QuestionType } from '@prisma/client';

/**
 * Canonical definition of "this mark is authoritative" for the scoring domain.
 *
 * 32-AI-GOVERNANCE-POLICY.md §2: no AI-sourced EvaluationVersion may contribute to
 * an official result without a human superseding it. ai_evaluator.py points
 * Evaluation.currentEvaluationVersionId at its own AI-sourced version the moment it
 * writes a suggestion, so "is there a current version" is NOT the same question as
 * "has a human approved this" — only EvaluationVersion.source answers that.
 *
 * Mirrored in Python at apps/api-python/src/analytics/evaluation_status.py for the
 * mastery engine, which enforces the identical rule. Change one, change the other.
 */
export const HUMAN_SOURCES: readonly EvaluationSource[] = [
  EvaluationSource.TEACHER,
  EvaluationSource.REVIEWER,
];

/**
 * An ACCEPT_AI decision counts: it creates its own TEACHER-sourced version, which is
 * a real human endorsement of the AI's numbers, not a passthrough of them.
 */
export function isHumanApproved(
  version: { source: EvaluationSource } | null | undefined,
): boolean {
  return !!version && HUMAN_SOURCES.includes(version.source);
}

/**
 * Question types that are subjective wherever they are answered.
 * Objective types answered digitally (an MCQ tapped in an app, an OMR bubble)
 * are scored at capture and never get an Evaluation row.
 */
export const SUBJECTIVE_QUESTION_TYPES: readonly QuestionType[] = [
  QuestionType.SHORT_ANSWER,
  QuestionType.LONG_ANSWER,
  QuestionType.PASSAGE_BASED,
];

/**
 * Whether this response has to be graded by a human (with or without AI help).
 *
 * Two ways to qualify:
 *   * the question type is subjective, however it was answered; or
 *   * the answer is HANDWRITING on a scanned page (evidenceType=PAGE_REGION).
 *
 * The second case is why this exists. A NUMERICAL answered in a booklet is a
 * page of working that nothing scores automatically — no capture step ever
 * produced a mark for it — yet it used to count as "objective, scored at
 * capture" purely because of its question type. That meant a real 4-mark
 * numerical silently contributed 0 to the student's total, never appeared in
 * the evaluation queue, and could not be graded at all. Digital objective
 * answers are unaffected: their evidence is DIGITAL_VALUE or OMR_MARK.
 *
 * Mirrored in Python at analytics/evaluation_status.needs_human_evaluation.
 */
export function needsHumanEvaluation(response: {
  question: { type: QuestionType };
  evidenceType?: EvidenceType | null;
}): boolean {
  if (response.evidenceType === EvidenceType.PAGE_REGION) return true;
  return SUBJECTIVE_QUESTION_TYPES.includes(response.question.type);
}

/** The Prisma filter matching needsHumanEvaluation(), for queries. */
export const NEEDS_HUMAN_EVALUATION_FILTER = {
  OR: [{ question: { is: { type: { in: [...SUBJECTIVE_QUESTION_TYPES] } } } }, { evidenceType: EvidenceType.PAGE_REGION }],
};

/**
 * True when a response's marks may be treated as an approved score.
 *
 * Three cases, in order:
 *
 * 1. An Evaluation row exists (v2 grading) — authoritative only if its current
 *    version is human-authored.
 * 2. No Evaluation row, and this is a v1 answer-sheet response (attemptId null) —
 *    ExamsService.gradeAnswerSheet writes Response.marksAwarded straight from the
 *    teacher's input, so the mark is already human-authored.
 * 3. No Evaluation row on a v2 response — authoritative only if nothing about it
 *    needs a human (see needsHumanEvaluation): it was scored at capture. A
 *    missing Evaluation row is NOT by itself evidence of that — an answer nobody
 *    has graded yet also has none, and counting it would both score an ungraded
 *    answer as a real zero and leave ScoreRecord.isFinalized incorrectly true.
 *
 * Mirrored in Python at analytics/evaluation_status.is_authoritative_response.
 */
export function isAuthoritativeResponse(response: {
  attemptId?: string | null;
  question: { type: QuestionType };
  evidenceType?: EvidenceType | null;
  evaluation?: { currentVersion: { source: EvaluationSource } | null } | null;
}): boolean {
  if (response.evaluation) return isHumanApproved(response.evaluation.currentVersion);
  if (response.attemptId === null || response.attemptId === undefined) return true;
  return !needsHumanEvaluation(response);
}
