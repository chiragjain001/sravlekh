"""V2 Analytics/Mastery Integration phase — intervention generation.

Never built before this phase (verified: no diagnostic_engine.py, no
Intervention-writing code anywhere in this codebase, v1 or v2 — the
Intervention/Assignment models existed in the schema but nothing ever
created a row). Scope is deliberately narrow, matching the explicit product
decision behind this phase:
  - mastery below threshold -> one targeted Assignment, from EXISTING
    question-bank content (never new AI-generated question content).
  - only the single most severe weak topic by default (configurable count),
    not a notification per weak topic.
  - a Notice to the relevant teacher with an actionable CTA — never an
    automatically scheduled/assigned extra class. The teacher decides that.

Idempotency is a DB-level atomic claim on MasteryScore.interventionTriggeredAt
(see packages/db/prisma/schema.prisma's comment on that column) — not a
plain "does an Intervention already exist" check-then-create, which would
have a real TOCTOU race under concurrent recalculation.
"""

import logging
from datetime import UTC, datetime, timedelta

from src.analytics.intervention_config import get_mastery_threshold, get_max_weak_topics
from src.database import db

logger = logging.getLogger(__name__)

ASSIGNMENT_DUE_IN_DAYS = 7
MAX_QUESTIONS_PER_ASSIGNMENT = 5


async def evaluate_interventions(
    student_profile_id: str,
    results: list[tuple[str, str, float]],  # (topic_id, subject_id, mastery_value)
) -> None:
    """Called once per recalculate_mastery() invocation, across every topic
    it just recalculated — so "most severe" is judged across what actually
    changed, not one topic considered in isolation."""
    threshold = get_mastery_threshold()
    max_weak_topics = get_max_weak_topics()

    weak = [r for r in results if r[2] < threshold]
    if not weak:
        return

    # Most severe first (lowest mastery), capped at the configured count —
    # never one intervention per weak topic.
    weak.sort(key=lambda r: r[2])
    selected = weak[:max_weak_topics]

    student = await db.studentprofile.find_unique(
        where={"id": student_profile_id},
        include={"user": True},
    )
    if student is None or student.batchId is None:
        logger.warning(
            "Cannot generate intervention for student %s — no batch assigned, "
            "so no way to resolve a responsible teacher.",
            student_profile_id,
        )
        return
    institute_id = student.user.instituteId

    for topic_id, subject_id, mastery_value in selected:
        try:
            await _generate_one_intervention(
                institute_id=institute_id,
                student_profile_id=student_profile_id,
                batch_id=student.batchId,
                topic_id=topic_id,
                subject_id=subject_id,
                mastery_value=mastery_value,
            )
        except Exception:
            # Same per-item isolation discipline as recalculate_mastery's own
            # per-topic loop — one intervention failing must not affect others.
            logger.exception(
                "Failed to generate intervention for student %s, topic %s",
                student_profile_id,
                topic_id,
            )


async def _generate_one_intervention(
    *,
    institute_id: str,
    student_profile_id: str,
    batch_id: str,
    topic_id: str,
    subject_id: str,
    mastery_value: float,
) -> None:
    batch_teacher = await db.batchteacher.find_first(
        where={"batchId": batch_id, "subjectId": subject_id, "removedAt": None},
        include={"teacherProfile": {"include": {"user": True}}},
    )
    if batch_teacher is None:
        # No teacher assigned to this batch+subject to notify or attribute
        # the assignment to — nothing to do. Deliberately does not fall back
        # to an ADMIN or a fabricated "system" user (07-SECURITY-SPECIFICATION.md
        # audit-attribution discipline: never attribute an action to an actor
        # who didn't take it).
        logger.warning(
            "No teacher assigned for batch %s / subject %s — skipping intervention for student %s, topic %s.",
            batch_id, subject_id, student_profile_id, topic_id,
        )
        return
    teacher_user_id = batch_teacher.teacherProfile.user.id

    # Atomic claim — the DB-level idempotency guarantee (see schema comment).
    # Only claimed AFTER confirming a teacher exists, so a topic with no
    # assignable teacher never burns its claim slot on a no-op.
    claimed = await db.masteryscore.update_many(
        where={
            "studentProfileId": student_profile_id,
            "topicId": topic_id,
            "interventionTriggeredAt": None,
        },
        data={"interventionTriggeredAt": datetime.now(UTC)},
    )
    if claimed == 0:
        # Another call already has an open intervention in flight for this
        # exact student+topic — duplicate evaluation events must not create
        # duplicate assignments/interventions/notifications.
        return

    topic = await db.topic.find_unique(where={"id": topic_id})
    topic_name = topic.name if topic else topic_id

    # Reuse the existing question bank — never generate new question content.
    questions = await db.question.find_many(
        where={"topicId": topic_id, "isApproved": True, "deletedAt": None},
        take=MAX_QUESTIONS_PER_ASSIGNMENT,
        order={"createdAt": "asc"},
    )

    due_date = datetime.now(UTC) + timedelta(days=ASSIGNMENT_DUE_IN_DAYS)
    mastery_pct = round(mastery_value * 100)

    if questions:
        question_lines = "\n".join(f"- {q.content[:120]}" for q in questions)
        description = (
            f"Auto-generated: mastery in this topic dropped to {mastery_pct}%. "
            f"Suggested practice from the existing question bank:\n{question_lines}"
        )
    else:
        description = (
            f"Auto-generated: mastery in this topic dropped to {mastery_pct}%. "
            "No approved question-bank questions are available for this topic yet."
        )

    assignment = await db.assignment.create(
        data={
            "studentProfileId": student_profile_id,
            "topicId": topic_id,
            "title": f"Practice: {topic_name}",
            "description": description,
            "dueDate": due_date,
            "isAutoGenerated": True,
            "createdByUserId": teacher_user_id,
        }
    )

    await db.intervention.create(
        data={
            "instituteId": institute_id,
            "studentProfileId": student_profile_id,
            "topicId": topic_id,
            "type": "ASSIGNMENT",
            "description": f"Auto-generated assignment ({assignment.id}) after mastery dropped to {mastery_pct}%.",
            "beforeMastery": mastery_value,
            "createdByUserId": teacher_user_id,
        }
    )

    # Teacher notification — reuses Notice/NoticeDelivery (the only real
    # notification mechanism in this codebase), never a second system.
    # IN_APP is delivered synchronously (no external provider needed, per
    # NoticesService's own precedent). targetAudience carries a distinct
    # 'type' marker (Notice has no dedicated type column) so these can be
    # identified/queried later without confusing them with broadcast notices.
    notice = await db.notice.create(
        data={
            "instituteId": institute_id,
            "createdByUserId": teacher_user_id,
            "title": f"Weak topic alert: {topic_name}",
            "body": (
                f"A student's mastery in \"{topic_name}\" dropped to {mastery_pct}%. "
                f"A practice assignment has been auto-created — review it and decide "
                f"whether an extra class or other follow-up is needed."
            ),
            "targetAudience": {
                "type": "MASTERY_INTERVENTION",
                "userIds": [teacher_user_id],
                "studentProfileId": student_profile_id,
                "topicId": topic_id,
                "assignmentId": assignment.id,
            },
            "channels": ["IN_APP"],
            "sentAt": datetime.now(UTC),
        }
    )

    await db.noticedelivery.create(
        data={
            "noticeId": notice.id,
            "userId": teacher_user_id,
            "channel": "IN_APP",
            "status": "SENT",
            "sentAt": datetime.now(UTC),
        }
    )
