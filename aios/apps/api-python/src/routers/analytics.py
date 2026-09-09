import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.analytics.evaluation_quality import compute_evaluation_quality
from src.analytics.intervention_config import (
    get_heatmap_critical_threshold_pct,
    get_heatmap_warning_threshold_pct,
    get_mastery_threshold,
)
from src.analytics.mastery_engine import recalculate_mastery
from src.auth import get_current_user, verify_internal_token
from src.database import db

router = APIRouter(prefix="/analytics", tags=["Analytics & Insights"])


class RecalculateMasteryRequest(BaseModel):
    studentProfileId: str
    topicIds: list[str]


@router.post("/recalculate-mastery", dependencies=[Depends(verify_internal_token)])
async def recalculate_mastery_endpoint(request: RecalculateMasteryRequest):
    """Internal-only (D-02): called by apps/api's mastery-recalc BullMQ processor
    after a grading commit. Durability/retry lives in that queue, not here — this
    endpoint just does the calculation and returns once it's done."""
    await recalculate_mastery(request.studentProfileId, request.topicIds)
    return {"success": True}

@router.get("/batches/heatmap")
async def get_batches_heatmap(
    batchIds: str,
    current_user = Depends(get_current_user),
):
    """
    Heatmaps for several batches at once, keyed by batch id.

    A dashboard showing one card per class used to call /batch/{id}/heatmap
    once per batch — nine round trips and nine mastery queries for a
    nine-section school. This loads every batch's mastery scores in one query
    and buckets them in memory.
    """
    if current_user.role not in ["TEACHER", "ADMIN", "FOUNDER"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    ids = [b for b in (batchIds or "").split(",") if b]
    if not ids:
        return {"success": True, "data": {}}
    if len(ids) > 50:
        raise HTTPException(status_code=400, detail="At most 50 batches per request.")

    students = await db.studentprofile.find_many(
        where={"batchId": {"in": ids}},
        include={"masteryScores": {"include": {"topic": True}}, "user": True},
    )

    by_batch: dict[str, list] = {b: [] for b in ids}
    for student in students:
        for score in student.masteryScores:
            by_batch.setdefault(student.batchId, []).append({
                "student_id": student.id,
                "student_name": student.user.name if student.user else "Unknown",
                "topic_id": score.topicId,
                "topic_name": score.topic.name,
                "mastery_value": score.masteryValue * 100,
                "trend": score.trend,
            })

    return {
        "success": True,
        "data": {batch_id: _summarise_heatmap(records) for batch_id, records in by_batch.items()},
    }


@router.get("/batch/{batch_id}/heatmap")
async def get_batch_heatmap(batch_id: str, current_user = Depends(get_current_user)):
    """
    Analyzes all mastery scores for a specific batch and identifies topics
    where the batch is struggling as a whole.
    """
    # Verify access
    if current_user.role not in ["TEACHER", "ADMIN", "FOUNDER"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    # Fetch all mastery scores for students in this batch
    students = await db.studentprofile.find_many(
        where={"batchId": batch_id},
        include={"masteryScores": {"include": {"topic": True}}, "user": True}
    )

    if not students:
        return {"success": True, "data": []}

    # Flatten data for Pandas
    records = []
    for student in students:
        for score in student.masteryScores:
            records.append({
                "student_id": student.id,
                "student_name": student.user.name if student.user else "Unknown",
                "topic_id": score.topicId,
                "topic_name": score.topic.name,
                "mastery_value": score.masteryValue * 100, # Convert to percentage
                "trend": score.trend
            })

    return {"success": True, "data": _summarise_heatmap(records)}


def _summarise_heatmap(records: list[dict]) -> list[dict]:
    """Topic-level struggle summary for one batch's flattened mastery records.

    Shared by the single-batch and multi-batch endpoints so the two can never
    disagree about what "struggling" means.
    """
    if not records:
        return []

    # Load into Pandas DataFrame for efficient aggregation
    df = pd.DataFrame(records)

    # P1 D1: "struggling" here and "weak topic" in intervention_engine.py are the same
    # predicate (both ask "is this below the platform's configured mastery threshold")
    # — bound to the one canonical source rather than an independent literal, so tuning
    # the intervention threshold can no longer leave this dashboard silently disagreeing
    # with what actually triggered a remedial assignment. get_mastery_threshold() is
    # 0-1 scale; mastery_value in `records` is already *100 (line ~54 above), hence the
    # conversion here rather than storing the threshold pre-converted.
    struggling_threshold_pct = get_mastery_threshold() * 100

    # Group by Topic to find class averages
    topic_summary = df.groupby(['topic_id', 'topic_name']).agg(
        average_mastery=('mastery_value', 'mean'),
        students_struggling=('mastery_value', lambda x: (x < struggling_threshold_pct).sum()),
        total_students=('student_id', 'count')
    ).reset_index()

    # Calculate percentage of class struggling
    topic_summary['struggle_percentage'] = (topic_summary['students_struggling'] / topic_summary['total_students']) * 100

    # Sort by lowest average mastery (most struggled topics first)
    topic_summary = topic_summary.sort_values(by='average_mastery', ascending=True)

    # P1 D1: named config instead of literals that used to live inline in this loop —
    # see config.py's MASTERY_HEATMAP_CRITICAL_PCT comment for why these are their own
    # setting, not derived from struggling_threshold_pct above.
    critical_pct = get_heatmap_critical_threshold_pct()
    warning_pct = get_heatmap_warning_threshold_pct()

    # Convert back to dict for JSON response
    # We round floats for cleaner UI
    heatmap_data = []
    for _, row in topic_summary.iterrows():
        status = "CRITICAL" if row['average_mastery'] < critical_pct else "WARNING" if row['average_mastery'] < warning_pct else "HEALTHY"

        heatmap_data.append({
            "topicId": row['topic_id'],
            "topicName": row['topic_name'],
            "averageMastery": round(row['average_mastery'], 1),
            "studentsStruggling": int(row['students_struggling']),
            "totalStudents": int(row['total_students']),
            "strugglePercentage": round(row['struggle_percentage'], 1),
            "status": status
        })

    return heatmap_data


@router.get("/evaluation-quality")
async def get_evaluation_quality(
    instituteId: str | None = None,
    modelVersion: str | None = None,
    dateFrom: str | None = None,
    dateTo: str | None = None,
    segmentBy: str | None = None,
    current_user=Depends(get_current_user),
):
    """05-API-SPECIFICATION.md (V2 section) §9 / 31 §3, backing
    AdminEvaluationQualityDashboard. instituteId is only honored for FOUNDER
    (cross-tenant) — an ADMIN always sees their own institute regardless of
    what they pass. segmentBy (32-AI-GOVERNANCE-POLICY.md §4's opt-in,
    privacy-sensitive per-subgroup breakdown) is accepted but not implemented
    — real consent-gating infrastructure per institute would be needed first,
    flagged rather than faked with an unguarded breakdown."""
    if current_user.role not in ["ADMIN", "FOUNDER"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    institute_id = instituteId if (current_user.role == "FOUNDER" and instituteId) else current_user.instituteId

    data = await compute_evaluation_quality(institute_id, modelVersion, dateFrom, dateTo)
    if segmentBy:
        data["segmentation"] = {"requested": segmentBy, "note": "not yet implemented — requires per-institute opt-in consent infrastructure (32 §4)"}

    return {"success": True, "data": data}
