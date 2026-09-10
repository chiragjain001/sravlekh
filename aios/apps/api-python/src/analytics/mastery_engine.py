"""Topic Mastery Engine (D-02).

Ported from apps/api/src/analytics/analytics.service.ts, where this calculation
previously lived — 02-SYSTEM-ARCHITECTURE.md assigns "mastery calc, trend/diagnostic
computation" to apps/api-python; NestJS should only own transactional writes, not
analytics math. See docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md for why this moved.

NestJS still owns the durable, retryable trigger (a BullMQ job enqueued on grading
commit) — this module is only the calculation + write, called over the internal
HTTP contract (POST /analytics/recalculate-mastery).

V2 Analytics/Mastery Integration phase: a Response now belongs to either a v1
AnswerSheet or a v2 Attempt (21-DOMAIN-MODEL-V2.md §4.4/§4.7) — this module
previously only queried the AnswerSheet path, so every v2-evaluated response
(AI/Teacher/Reviewer, via EvaluationsService) was invisible to mastery. Fixed
by querying Response directly across both ownership paths, and by reading
marks from Evaluation.currentEvaluationVersion when present (21 §4.8's
required read-path change), falling back to Response.marksAwarded for
objective/v1 evidence — the exact same fallback score-aggregation.service.ts
already uses on the NestJS side, not a new convention.

32-AI-GOVERNANCE-POLICY.md §3: a subjective response only feeds the EMA once a
HUMAN has approved its current version. Recalculation is triggered per-response
during review, and this query spans every historical response for the topic — so
without that filter, reviewing one response would pull its not-yet-reviewed
AI-suggested siblings into mastery, and from there into interventions and every
teacher-facing insight downstream. See evaluation_status.is_human_approved.
"""

import logging

from src.analytics.evaluation_status import is_authoritative_response
from src.analytics.intervention_config import get_mastery_threshold
from src.analytics.intervention_engine import evaluate_interventions
from src.database import db

logger = logging.getLogger(__name__)

ALPHA = 0.3  # EMA smoothing factor: 2 / (N + 1), fixed for a fast-adapting system.
BASELINE_MASTERY = 0.5


async def recalculate_mastery(student_profile_id: str, topic_ids: list[str]) -> None:
    """Recalculates MasteryScore for a student across the given topics using an
    Exponential Moving Average, weighted by question difficulty. Mirrors the
    original TypeScript implementation's formula exactly.

    After all topics are recalculated, evaluates whether any of them warrant
    an auto-generated intervention (§ intervention_engine.py) — done once,
    across the full set of topics touched by this call, so severity ranking
    ("the most severe weak topic") is judged across what actually just
    changed, not one topic at a time.
    """
    unique_topic_ids = list(dict.fromkeys(topic_ids))
    results: list[tuple[str, str, float]] = []  # (topic_id, subject_id, mastery_value)

    for topic_id in unique_topic_ids:
        try:
            outcome = await _recalculate_one_topic(student_profile_id, topic_id)
            if outcome is not None:
                results.append((topic_id, *outcome))
        except Exception:
            # Per-topic isolation matches the original: one topic's failure
            # must not abort the others.
            logger.exception(
                "Failed to recalculate mastery for student %s, topic %s",
                student_profile_id,
                topic_id,
            )

    if results:
        await evaluate_interventions(student_profile_id, results)


async def _recalculate_one_topic(student_profile_id: str, topic_id: str) -> tuple[str, float] | None:
    """Returns (subject_id, masteryValue) on success, None if there was no
    evidence for this topic to compute against (not itself a failure)."""
    responses = await db.response.find_many(
        where={
            "question": {"is": {"topicId": topic_id}},
            "OR": [
                {"answerSheet": {"is": {"studentProfileId": student_profile_id}}},
                {"attempt": {"is": {"studentProfileId": student_profile_id}}},
            ],
        },
        include={
            "question": True,
            "evaluation": {"include": {"currentVersion": True}},
        },
        order={"createdAt": "asc"},
    )
    if not responses:
        return None

    # A subjective response counts only once a human has approved its current
    # version (32 §3). Excluded from the sequence rather than scored 0: "nobody has
    # graded this yet" is not the same data point as "the student scored zero," and
    # a phantom 0 would crash the student's mastery for an ungraded answer.
    # Objective/v1 evidence is scored at capture and is unaffected.
    counted = [response for response in responses if is_authoritative_response(response)]
    if not counted:
        return None

    subject_id = counted[0].question.subjectId

    current_mastery = BASELINE_MASTERY
    previous_mastery = BASELINE_MASTERY

    for index, response in enumerate(counted):
        current_version = response.evaluation.currentVersion if response.evaluation else None
        marks_awarded = current_version.marksAwarded if current_version is not None else response.marksAwarded

        score = (
            marks_awarded / response.marksAvailable
            if response.marksAvailable > 0
            else 0
        )

        difficulty_weight = 1.0
        if response.question.difficulty == "HARD":
            difficulty_weight = 1.2
        elif response.question.difficulty == "EASY":
            difficulty_weight = 0.8

        adjusted_score = min(1.0, score * difficulty_weight)

        if index == 0:
            current_mastery = adjusted_score
        else:
            previous_mastery = current_mastery
            current_mastery = (adjusted_score * ALPHA) + (current_mastery * (1 - ALPHA))

    trend = current_mastery - previous_mastery

    # Recovery above threshold clears any in-flight intervention claim for
    # this topic (intervention_engine.py's atomic claim, set when it fires)
    # so a later genuine re-drop is treated as a fresh episode, not
    # permanently suppressed. Only clear — never set — from this path; the
    # claim itself is only ever set by evaluate_interventions's own atomic
    # update_many, never here.
    threshold = get_mastery_threshold()
    update_data: dict[str, object] = {
        "masteryValue": current_mastery,
        "trend": trend,
        "sampleCount": len(counted),
    }
    if current_mastery >= threshold:
        update_data["interventionTriggeredAt"] = None

    await db.masteryscore.upsert(
        where={
            "studentProfileId_topicId": {
                "studentProfileId": student_profile_id,
                "topicId": topic_id,
            }
        },
        data={
            "create": {
                "studentProfileId": student_profile_id,
                "subjectId": subject_id,
                "topicId": topic_id,
                "masteryValue": current_mastery,
                "trend": trend,
                "sampleCount": len(counted),
            },
            "update": update_data,
        },
    )

    return subject_id, current_mastery
