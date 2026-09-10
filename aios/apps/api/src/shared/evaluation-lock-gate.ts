import { ConflictException } from '@nestjs/common';
import { EvaluationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SUBJECTIVE_QUESTION_TYPES } from '../evaluations/evaluation-status.util';

/**
 * 32-AI-GOVERNANCE-POLICY.md §2 / 27-AI-EVALUATION-ARCHITECTURE.md §7, fix #3:
 * no subjective Response may lack a TEACHER+ EvaluationVersion at the moment its
 * v2 AssessmentDelivery locks — a hard state-machine gate, not a policy document
 * alone. Unchanged from AssessmentsService's original private implementation
 * (P1 A4 extracted it verbatim so it stays testably identical, not to alter it).
 *
 * v2-only. A v1 Exam's Responses never carry an Evaluation row at all — see
 * assertAllAnswerSheetsVerified below for why "no Evaluation row" cannot be
 * reused to mean "ungraded" across both schema generations, and a real-database
 * probe run while building this confirmed it: reusing this function's OR clause
 * for v1 permanently blocked LOCK on every v1 exam, graded or not, because
 * `evaluation: null` is the *permanent* state for every v1 Response.
 */
export async function assertNoUnevaluatedSubjectiveResponses(
  prisma: PrismaService,
  responseScope: Prisma.ResponseWhereInput,
): Promise<void> {
  const unevaluatedCount = await prisma.response.count({
    where: {
      ...responseScope,
      question: { type: { in: [...SUBJECTIVE_QUESTION_TYPES] } },
      OR: [
        { evaluation: null },
        { evaluation: { status: { in: [EvaluationStatus.PENDING, EvaluationStatus.AI_SUGGESTED] } } },
      ],
    },
  });
  if (unevaluatedCount > 0) {
    throw new ConflictException({
      code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED',
      message: `${unevaluatedCount} subjective response(s) still need a human evaluation decision before this can be locked.`,
    });
  }
}

/**
 * v1 equivalent of the same governance invariant, expressed against v1's actual
 * grading model rather than v2's. v1 has no Evaluation/EvaluationVersion concept
 * at all: ExamsService.gradeAnswerSheet grades an entire AnswerSheet atomically —
 * it upserts every Response in one transaction and unconditionally sets
 * AnswerSheet.isVerified = true in that same transaction. There is no v1 notion
 * of "this one response is still pending" the way v2 has per-response evaluation
 * state; the smallest unit of "graded" in v1 is the whole answer sheet.
 *
 * So the correct v1 signal is AnswerSheet.isVerified, not anything derived from
 * Response/Evaluation — those tables are simply not how v1 records a grading
 * decision. This deliberately does not filter by subjective vs. objective
 * question type either: v1 grades a sheet as one unit, with no per-question
 * auto-score/human-score split the way v2's evidence types create.
 */
export async function assertAllAnswerSheetsVerified(prisma: PrismaService, examId: string): Promise<void> {
  const unverifiedCount = await prisma.answerSheet.count({
    where: { examId, isVerified: false },
  });
  if (unverifiedCount > 0) {
    throw new ConflictException({
      code: 'SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED',
      message: `${unverifiedCount} answer sheet(s) still need grading before this exam can be locked.`,
    });
  }
}
