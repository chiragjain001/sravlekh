import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from src.auth import get_current_user
from src.database import db

router = APIRouter(prefix="/analytics", tags=["Analytics & Insights"])

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
