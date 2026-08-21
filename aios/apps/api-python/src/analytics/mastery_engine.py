"""Topic Mastery Engine (D-02).

Ported from apps/api/src/analytics/analytics.service.ts, where this calculation
previously lived — 02-SYSTEM-ARCHITECTURE.md assigns "mastery calc, trend/diagnostic
computation" to apps/api-python; NestJS should only own transactional writes, not
analytics math. See docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md for why this moved.

NestJS still owns the durable, retryable trigger (a BullMQ job enqueued on grading
commit) — this module is only the calculation + write, called over the internal
HTTP contract (POST /analytics/recalculate-mastery).
"""

import logging

from src.database import db

logger = logging.getLogger(__name__)

ALPHA = 0.3  # EMA smoothing factor: 2 / (N + 1), fixed for a fast-adapting system.
BASELINE_MASTERY = 0.5


async def recalculate_mastery(student_profile_id: str, topic_ids: list[str]) -> None:
    """Recalculates MasteryScore for a student across the given topics using an
    Exponential Moving Average, weighted by question difficulty. Mirrors the
    original TypeScript implementation's formula exactly."""

    unique_topic_ids = list(dict.fromkeys(topic_ids))

    for topic_id in unique_topic_ids:
        try:
            await _recalculate_one_topic(student_profile_id, topic_id)
        except Exception:
            # Per-topic isolation matches the original: one topic's failure
            # must not abort the others.
            logger.exception(
                "Failed to recalculate mastery for student %s, topic %s",
                student_profile_id,
                topic_id,
            )


async def _recalculate_one_topic(student_profile_id: str, topic_id: str) -> None:
    answer_sheets = await db.answersheet.find_many(
        where={"studentProfileId": student_profile_id}
    )
    if not answer_sheets:
        return
    answer_sheet_ids = [sheet.id for sheet in answer_sheets]

    responses = await db.response.find_many(
        where={
            "answerSheetId": {"in": answer_sheet_ids},
            "question": {"is": {"topicId": topic_id}},
        },
        include={"question": True},
        order={"createdAt": "asc"},
    )
    if not responses:
        return

    subject_id = responses[0].question.subjectId

    current_mastery = BASELINE_MASTERY
    previous_mastery = BASELINE_MASTERY

    for index, response in enumerate(responses):
        score = (
            response.marksAwarded / response.marksAvailable
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
                "sampleCount": len(responses),
            },
            "update": {
                "masteryValue": current_mastery,
                "trend": trend,
                "sampleCount": len(responses),
            },
        },
    )
