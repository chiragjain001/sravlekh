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

# The same set assessments.service.ts's LOCK gate and ai_evaluator's batch query
# use to mean "subjective". Objective responses are scored at capture time and
# never get an Evaluation row at all.
SUBJECTIVE_QUESTION_TYPES = frozenset({"SHORT_ANSWER", "LONG_ANSWER", "PASSAGE_BASED"})


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
    3. No Evaluation row on a v2 response — authoritative only if the question is
       objective (scored at capture). A missing Evaluation row is NOT by itself
       evidence that a response is objective: a subjective answer nobody has graded
       yet also has none, and counting it would score an ungraded answer as a real
       zero.

    Mirrored in TypeScript at evaluations/evaluation-status.util.isAuthoritativeResponse.
    """
    evaluation = getattr(response, "evaluation", None)
    if evaluation is not None:
        return is_human_approved(evaluation.currentVersion)
    if getattr(response, "attemptId", None) is None:
        return True
    return response.question.type not in SUBJECTIVE_QUESTION_TYPES
