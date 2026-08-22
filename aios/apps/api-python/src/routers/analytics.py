import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.analytics.evaluation_quality import compute_evaluation_quality
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
                "trend": score.trendDirection
            })

    if not records:
        return {"success": True, "data": []}

    # Load into Pandas DataFrame for efficient aggregation
    df = pd.DataFrame(records)

    # Group by Topic to find class averages
    topic_summary = df.groupby(['topic_id', 'topic_name']).agg(
        average_mastery=('mastery_value', 'mean'),
        students_struggling=('mastery_value', lambda x: (x < 50).sum()), # Count students below 50%
        total_students=('student_id', 'count')
    ).reset_index()

    # Calculate percentage of class struggling
    topic_summary['struggle_percentage'] = (topic_summary['students_struggling'] / topic_summary['total_students']) * 100

    # Sort by lowest average mastery (most struggled topics first)
    topic_summary = topic_summary.sort_values(by='average_mastery', ascending=True)

    # Convert back to dict for JSON response
    # We round floats for cleaner UI
    heatmap_data = []
    for _, row in topic_summary.iterrows():
        status = "CRITICAL" if row['average_mastery'] < 40 else "WARNING" if row['average_mastery'] < 70 else "HEALTHY"
        
        heatmap_data.append({
            "topicId": row['topic_id'],
            "topicName": row['topic_name'],
            "averageMastery": round(row['average_mastery'], 1),
            "studentsStruggling": int(row['students_struggling']),
            "totalStudents": int(row['total_students']),
            "strugglePercentage": round(row['struggle_percentage'], 1),
            "status": status
        })

    return {
        "success": True,
        "data": heatmap_data
    }


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
