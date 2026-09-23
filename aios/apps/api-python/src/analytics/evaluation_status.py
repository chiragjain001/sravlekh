"""Canonical definition of "this mark is authoritative" for the analytics domain.

32-AI-GOVERNANCE-POLICY.md §3: the Mastery/Diagnostic Engine must never consume
AI-suggested (not-yet-human-reviewed) marks. ai_evaluator.py points
Evaluation.currentEvaluationVersionId at its own AI-sourced version the moment it
writes a suggestion, so "is there a current version" is NOT the same question as
"has a human approved this" — only EvaluationVersion.source answers that.

Mirrored in TypeScript at apps/api/src/evaluations/evaluation-status.util.ts for
the ScoreRecord aggregator, which enforces the identical rule on the Node side.
Change one, change the other.
"""

HUMAN_SOURCES = frozenset({"TEACHER", "REVIEWER"})

# Question types that are subjective wherever they are answered.
SUBJECTIVE_QUESTION_TYPES = frozenset({"SHORT_ANSWER", "LONG_ANSWER", "PASSAGE_BASED"})

# Handwriting on a scanned page. Nothing scores it automatically, whatever the
# question type: a NUMERICAL worked out in a booklet is a page of working a
# human has to mark, and treating it as "objective, scored at capture" made a
# real 4-mark answer contribute 0 and never reach the evaluation queue.
PAGE_REGION_EVIDENCE = "PAGE_REGION"


def is_human_approved(version) -> bool:
    """True when an EvaluationVersion was authored by a human (teacher or reviewer).

    An ACCEPT_AI decision counts: it creates its own TEACHER-sourced version, which
    is a real human endorsement of the AI's numbers, not a passthrough of them.
    """
    return version is not None and version.source in HUMAN_SOURCES


def is_authoritative_response(response) -> bool:
    """True when a response's marks may be treated as an approved score.

    Three cases, in order:

    1. An Evaluation row exists (v2 grading) — authoritative only if its current
       version is human-authored.
    2. No Evaluation row, and this is a v1 answer-sheet response (attemptId is
       None) — ExamsService.gradeAnswerSheet writes Response.marksAwarded straight
       from the teacher's input, so the mark is already human-authored.
    3. No Evaluation row on a v2 response — authoritative only if nothing about it
       needs a human (see needs_human_evaluation): it was scored at capture. A
       missing Evaluation row is NOT by itself evidence of that: an answer nobody
       has graded yet also has none, and counting it would score an ungraded
       answer as a real zero.

    Mirrored in TypeScript at evaluations/evaluation-status.util.isAuthoritativeResponse.
    """
    evaluation = getattr(response, "evaluation", None)
    if evaluation is not None:
        return is_human_approved(evaluation.currentVersion)
    if getattr(response, "attemptId", None) is None:
        return True
    return not needs_human_evaluation(response)


def needs_human_evaluation(response) -> bool:
    """True when this response has to be graded by a human (with or without AI help).

    Mirrored in TypeScript at evaluation-status.util.needsHumanEvaluation.
    """
    if getattr(response, "evidenceType", None) == PAGE_REGION_EVIDENCE:
        return True
    return response.question.type in SUBJECTIVE_QUESTION_TYPES
