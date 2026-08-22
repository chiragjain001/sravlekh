"""31-EVALUATION-AUDIT-VERSIONING.md §3: AI-accuracy analytics computed
entirely from structured EvaluationVersion data — never by scanning
AuditLog's generic diff blobs (§6's acceptance criterion). Backs
GET /analytics/evaluation-quality (05-API-SPECIFICATION.md V2 section §9),
feeding AdminEvaluationQualityDashboard.
"""

import statistics
from datetime import UTC, datetime

from src.database import db

MARKS_TOLERANCE = 0.01


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed


async def compute_evaluation_quality(
    institute_id: str,
    model_version: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    date_from_dt = _parse_date(date_from)
    date_to_dt = _parse_date(date_to)

    responses = await db.response.find_many(
        where={"attempt": {"is": {"assessmentDelivery": {"is": {"assessment": {"is": {"instituteId": institute_id}}}}}}},
        include={
            "evaluation": {
                "include": {
                    "versions": {
                        "order_by": {"createdAt": "asc"},
                        "include": {"aiRecommendation": {"include": {"aiModelVersion": True}}},
                    }
                }
            }
        },
    )

    agreement_matches = 0
    agreement_total = 0
    override_diffs = 0
    override_total = 0
    time_to_finalize_seconds: list[float] = []

    for response in responses:
        evaluation = response.evaluation
        if not evaluation or not evaluation.versions:
            continue

        versions = evaluation.versions
        if date_from_dt or date_to_dt:
            versions = [
                v for v in versions
                if (date_from_dt is None or v.createdAt >= date_from_dt)
                and (date_to_dt is None or v.createdAt <= date_to_dt)
            ]
        if not versions:
            continue

        for i, version in enumerate(versions):
            previous = versions[i - 1] if i > 0 else None

            if version.source == "TEACHER" and previous is not None and previous.source == "AI":
                if model_version and (
                    previous.aiRecommendation is None
                    or previous.aiRecommendation.aiModelVersion.versionLabel != model_version
                ):
                    continue
                agreement_total += 1
                if abs(version.marksAwarded - previous.marksAwarded) < MARKS_TOLERANCE:
                    agreement_matches += 1

            if version.source == "REVIEWER" and previous is not None and previous.source == "TEACHER":
                override_total += 1
                if abs(version.marksAwarded - previous.marksAwarded) >= MARKS_TOLERANCE:
                    override_diffs += 1

        finalize_version = next((v for v in versions if v.source in ("TEACHER", "REVIEWER")), None)
        if finalize_version is not None:
            delta = (finalize_version.createdAt - response.createdAt).total_seconds()
            if delta >= 0:
                time_to_finalize_seconds.append(delta)

    return {
        "aiTeacherAgreementRate": (agreement_matches / agreement_total) if agreement_total else None,
        "reviewerOverrideRate": (override_diffs / override_total) if override_total else None,
        "timeToFinalize": {
            "meanSeconds": statistics.mean(time_to_finalize_seconds) if time_to_finalize_seconds else None,
            "medianSeconds": statistics.median(time_to_finalize_seconds) if time_to_finalize_seconds else None,
            "sampleCount": len(time_to_finalize_seconds),
        },
        "sampleCounts": {"aiTeacherPairs": agreement_total, "teacherReviewerPairs": override_total},
    }
