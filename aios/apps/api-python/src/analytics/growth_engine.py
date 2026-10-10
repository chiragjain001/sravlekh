"""Growth & Momentum Analytics Engine (AIOS Differentiation).

Calculates mathematically sound, apples-to-apples student growth metrics:
1. Cohort Z-Score Normalization (eliminates exam difficulty skew)
2. Exam Type Bucketing (SPOT, PERIODIC, MAJOR family separation)
3. IRT Exam Difficulty Calibration (rewards high performance on difficult items)
4. Dynamic Academic ELO Rating (tracks cross-exam ability & momentum)
5. Mastery Trend Integration (long-term topic velocity from MasteryScore)
6. Guardrails preventing invalid cross-family or cross-subject comparisons.
"""

import math
import logging
from typing import Any, Dict, List, Optional
import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)

# Exam Family Mapping
EXAM_FAMILIES = {
    # SPOT tests: single chapter, quick assessment, lower stakes
    "UNIT_TEST": "SPOT",
    "CHAPTER_TEST": "SPOT",
    "WEEKLY_TEST": "SPOT",
    # PERIODIC tests: multi-chapter, mid-cycle evaluations
    "MONTHLY_TEST": "PERIODIC",
    "REVISION_TEST": "PERIODIC",
    "SUBJECT_TEST": "PERIODIC",
    "PRACTICE_TEST": "PERIODIC",
    # MAJOR exams: comprehensive, high stakes, full syllabus
    "PRE_BOARD": "MAJOR",
    "MOCK_TEST": "MAJOR",
    "SEMESTER_EXAM": "MAJOR",
    "ANNUAL_EXAM": "MAJOR",
}


def get_exam_family(exam_type: Optional[str]) -> str:
    if not exam_type:
        return "PERIODIC"
    return EXAM_FAMILIES.get(str(exam_type).upper(), "PERIODIC")


def calculate_cohort_growth(
    students: List[Dict[str, Any]],
    filter_subject_id: Optional[str] = None,
    filter_exam_family: Optional[str] = None,
    filter_period_weeks: Optional[int] = None,
    target_student_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Computes production-level Growth & Momentum metrics for a cohort of students.

    students format:
    [
      {
        "id": "student-1",
        "name": "Arjun Sharma",
        "rollNumber": "11A-04",
        "batchId": "batch-1",
        "batchName": "Class 11 - Alpha",
        "scores": [
          {
            "examId": "exam-1",
            "examTitle": "Unit Test 1 - Physics",
            "examType": "UNIT_TEST",
            "examDate": "2026-08-15T09:00:00Z",
            "subjectId": "sub-phy",
            "subjectName": "Physics",
            "obtainedMarks": 24,
            "totalMarks": 30,
            "percentage": 80.0,
            "paperDifficulty": 0.55
          }, ...
        ],
        "masteryScores": [
          {
            "subjectId": "sub-phy",
            "topicId": "top-1",
            "masteryValue": 0.72,
            "trend": 0.15
          }, ...
        ]
      }
    ]
    """
    warnings: List[str] = []

    # 1. Collect all exam scores across students to compute Cohort Stats per exam
    exam_cohort_scores: Dict[str, List[float]] = {}
    exam_metadata: Dict[str, Dict[str, Any]] = {}

    total_exams_in_pool = set()

    for st in students:
        for sc in st.get("scores", []):
            exam_id = sc.get("examId")
            if not exam_id:
                continue
            pct = float(sc.get("percentage", 0.0))
            if exam_id not in exam_cohort_scores:
                exam_cohort_scores[exam_id] = []
                exam_metadata[exam_id] = {
                    "examId": exam_id,
                    "title": sc.get("examTitle", "Exam"),
                    "type": sc.get("examType", "UNIT_TEST"),
                    "family": get_exam_family(sc.get("examType")),
                    "subjectId": sc.get("subjectId"),
                    "subjectName": sc.get("subjectName", "General"),
                    "date": sc.get("examDate", ""),
                    "difficulty": float(sc.get("paperDifficulty", 0.5)),
                }
            exam_cohort_scores[exam_id].append(pct)
            total_exams_in_pool.add(exam_id)

    # Compute mean and standard deviation per exam
    exam_stats: Dict[str, Dict[str, float]] = {}
    for exam_id, pcts in exam_cohort_scores.items():
        arr = np.array(pcts, dtype=float)
        mean_val = float(np.mean(arr)) if len(arr) > 0 else 50.0
        std_val = float(np.std(arr)) if len(arr) > 1 else 10.0
        if std_val < 1.0:
            std_val = 1.0  # Avoid zero division
        exam_stats[exam_id] = {
            "mean": mean_val,
            "std": std_val,
            "count": len(arr),
        }

    total_conducted_exams = max(len(total_exams_in_pool), 1)

    # 2. Process each student
    student_results = []

    for st in students:
        student_id = st.get("id")
        raw_scores = st.get("scores", [])

        # Filter student's scores based on user parameters
        valid_scores = []
        for sc in raw_scores:
            exam_id = sc.get("examId")
            if not exam_id or exam_id not in exam_metadata:
                continue
            meta = exam_metadata[exam_id]

            # Subject filter
            if filter_subject_id and filter_subject_id != "all":
                if meta["subjectId"] != filter_subject_id:
                    continue

            # Family filter
            if filter_exam_family and filter_exam_family != "ALL":
                if meta["family"] != filter_exam_family:
                    continue

            valid_scores.append({
                **sc,
                "family": meta["family"],
                "subjectId": meta["subjectId"],
                "subjectName": meta["subjectName"],
                "difficulty": meta["difficulty"],
                "examDate": meta["date"],
            })

        # Sort chronologically
        valid_scores.sort(key=lambda x: str(x.get("examDate", "")))

        # Check if student participated in any test
        exams_attended = len(valid_scores)

        if exams_attended == 0:
            # Student has NOT appeared in any test in this filter window
            # Do NOT assign fake 40.0 score or false attendance
            why_text = f"{st.get('name', 'Student').split()[0]} has not taken any evaluated exams yet."
            student_results.append({
                "studentProfileId": student_id,
                "name": st.get("name", "Student"),
                "rollNumber": st.get("rollNumber"),
                "batchId": st.get("batchId"),
                "batchName": st.get("batchName"),
                "momentumScore": None,
                "zScoreDelta": None,
                "rawScoreDelta": None,
                "eloRating": None,
                "peakEloRating": None,
                "eloDelta": None,
                "masteryTrend": None,
                "consistency": 0.0,
                "examsAttended": 0,
                "confidence": "NONE",
                "badges": [],
                "whyText": why_text,
                "eloHistory": [],
                "breakdown": None,
                "rank": None,
            })
            continue

        # Compute Z-Scores and ELO for the student's history
        z_scores = []
        elo_history = []
        current_elo = 1200.0
        peak_elo = 1200.0

        for idx, sc in enumerate(valid_scores):
            exam_id = sc["examId"]
            pct = float(sc.get("percentage", 0.0))
            st_info = exam_stats.get(exam_id, {"mean": 50.0, "std": 10.0})
            z = (pct - st_info["mean"]) / st_info["std"]
            z = max(-3.0, min(3.0, z))  # Clip extreme outliers
            z_scores.append(z)

            # ELO calculation
            actual_perf = float(stats.norm.cdf(z))  # 0.0 to 1.0
            expected_perf = 1.0 / (1.0 + math.pow(10, (1200.0 - current_elo) / 400.0))
            k_factor = 32.0 / math.sqrt(max(idx + 1, 1))
            elo_delta = k_factor * (actual_perf - expected_perf) * 2.5
            current_elo = max(600.0, min(2400.0, current_elo + elo_delta))
            if current_elo > peak_elo:
                peak_elo = current_elo

            elo_history.append({
                "examId": exam_id,
                "examTitle": sc.get("examTitle"),
                "date": sc.get("examDate"),
                "score": pct,
                "zScore": round(z, 2),
                "elo": round(current_elo, 1),
                "eloDelta": round(elo_delta, 1),
            })

        # Delta metrics (Compare latest with previous in same family/subject)
        z_delta = 0.0
        raw_score_delta = 0.0
        latest_elo_delta = 0.0
        difficulty_weight = 1.0

        if exams_attended >= 2:
            latest = valid_scores[-1]
            prev = valid_scores[-2]
            # Verify apples-to-apples: same family and same subject
            if latest["family"] == prev["family"] and (
                latest["subjectId"] == prev["subjectId"] or not filter_subject_id or filter_subject_id == "all"
            ):
                z_delta = z_scores[-1] - z_scores[-2]
                raw_score_delta = float(latest.get("percentage", 0)) - float(prev.get("percentage", 0))
                latest_elo_delta = elo_history[-1]["eloDelta"]
                paper_diff = float(latest.get("difficulty", 0.5))
                difficulty_weight = 1.0 + (0.35 * paper_diff)
            else:
                found_prev = False
                for candidate in reversed(valid_scores[:-1]):
                    if candidate["family"] == latest["family"] and candidate["subjectId"] == latest["subjectId"]:
                        idx_cand = valid_scores.index(candidate)
                        z_delta = z_scores[-1] - z_scores[idx_cand]
                        raw_score_delta = float(latest.get("percentage", 0)) - float(candidate.get("percentage", 0))
                        latest_elo_delta = elo_history[-1]["eloDelta"]
                        paper_diff = float(latest.get("difficulty", 0.5))
                        difficulty_weight = 1.0 + (0.35 * paper_diff)
                        found_prev = True
                        break
                if not found_prev:
                    latest_elo_delta = elo_history[-1]["eloDelta"]
        else:
            # Exactly 1 exam: baseline established, no prior exam for delta
            z_delta = 0.0
            raw_score_delta = 0.0
            latest_elo_delta = elo_history[-1]["eloDelta"]

        # Mastery Trend Signal
        raw_mastery = st.get("masteryScores", [])
        relevant_trends = []
        for ms in raw_mastery:
            if filter_subject_id and filter_subject_id != "all":
                if ms.get("subjectId") == filter_subject_id:
                    relevant_trends.append(float(ms.get("trend", 0.0)))
            else:
                relevant_trends.append(float(ms.get("trend", 0.0)))

        avg_mastery_trend = float(np.mean(relevant_trends)) if len(relevant_trends) > 0 else 0.0

        # Normalized Components [-1.0, 1.0]
        c_z = max(-1.0, min(1.0, z_delta / 2.0))
        c_z_irt = max(-1.0, min(1.0, (z_delta * difficulty_weight) / 2.0))
        c_elo = max(-1.0, min(1.0, latest_elo_delta / 40.0))
        c_mastery = max(-1.0, min(1.0, avg_mastery_trend * 2.0))

        if exams_attended >= 2:
            raw_growth_signal = (
                (0.30 * c_z) +
                (0.25 * c_z_irt) +
                (0.30 * c_elo) +
                (0.15 * c_mastery)
            )
            base_momentum = 50.0 + (50.0 * raw_growth_signal)
            consistency = float(exams_attended) / float(total_conducted_exams)
            consistency = min(1.0, max(0.1, consistency))
            momentum_score = base_momentum * (0.80 + (0.20 * consistency))
            momentum_score = round(max(0.0, min(100.0, momentum_score)), 1)
        else:
            # Baseline from single exam: centered at 50, modified by Z-score
            consistency = float(exams_attended) / float(total_conducted_exams)
            momentum_score = round(max(10.0, min(90.0, 50.0 + (z_scores[0] * 10.0))), 1)

        # Confidence level
        if exams_attended >= 4:
            confidence = "HIGH"
        elif exams_attended >= 2:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"

        # Badge assignment (only for active participants)
        badges = []
        if momentum_score >= 70.0 and confidence in ("HIGH", "MEDIUM"):
            badges.append({
                "id": "rising_star",
                "label": "Rising Star",
                "icon": "Rocket",
                "color": "indigo",
                "description": "Demonstrates rapid positive growth acceleration.",
            })

        if z_delta >= 0.7 or raw_score_delta >= 10.0:
            badges.append({
                "id": "on_the_up",
                "label": "On the Up",
                "icon": "TrendingUp",
                "color": "emerald",
                "description": "Substantial score climb compared to previous comparable test.",
            })

        if consistency >= 0.85 and momentum_score >= 52.0 and exams_attended >= 2:
            badges.append({
                "id": "consistent_grinder",
                "label": "Consistent Grinder",
                "icon": "Flame",
                "color": "amber",
                "description": "Consistent attendance with uninterrupted positive momentum.",
            })

        if len(z_scores) >= 2 and z_scores[-2] < -0.3 and z_scores[-1] > 0.4:
            badges.append({
                "id": "comeback_kid",
                "label": "Comeback Kid",
                "icon": "ShieldCheck",
                "color": "cyan",
                "description": "Turned around a lower score into an above-average performance.",
            })

        if difficulty_weight > 1.15 and z_delta > 0.3:
            badges.append({
                "id": "hard_hitter",
                "label": "Tough Exam Ace",
                "icon": "Zap",
                "color": "purple",
                "description": "Excelled in a high-difficulty exam with advanced concepts.",
            })

        why_text = _generate_explanation(
            name=st.get("name", "Student"),
            z_delta=z_delta,
            elo_delta=latest_elo_delta,
            raw_delta=raw_score_delta,
            exams_count=exams_attended,
            consistency=consistency,
        )

        student_results.append({
            "studentProfileId": student_id,
            "name": st.get("name", "Student"),
            "rollNumber": st.get("rollNumber"),
            "batchId": st.get("batchId"),
            "batchName": st.get("batchName"),
            "momentumScore": momentum_score,
            "zScoreDelta": round(z_delta, 2) if exams_attended >= 2 else 0.0,
            "rawScoreDelta": round(raw_score_delta, 1) if exams_attended >= 2 else 0.0,
            "eloRating": round(current_elo, 1),
            "peakEloRating": round(peak_elo, 1),
            "eloDelta": round(latest_elo_delta, 1),
            "masteryTrend": round(avg_mastery_trend, 2),
            "consistency": round(consistency * 100, 1),
            "examsAttended": exams_attended,
            "confidence": confidence,
            "badges": badges,
            "whyText": why_text,
            "eloHistory": elo_history[-8:],
            "breakdown": {
                "zScoreComponent": round(c_z * 100, 1),
                "irtDifficultyComponent": round(c_z_irt * 100, 1),
                "eloComponent": round(c_elo * 100, 1),
                "masteryVelocityComponent": round(c_mastery * 100, 1),
                "consistencyMultiplier": round(consistency, 2),
            },
            "rank": None,
        })

    # Separate active participants from students awaiting their first exam
    participating = [s for s in student_results if s["examsAttended"] > 0]
    unranked = [s for s in student_results if s["examsAttended"] == 0]

    # Sort participating students by momentumScore DESC, then rawScoreDelta DESC
    participating.sort(key=lambda x: (x["momentumScore"] or 0.0, x["rawScoreDelta"] or 0.0), reverse=True)

    # Assign ranks with competition tie-handling
    for idx, item in enumerate(participating):
        if idx > 0 and item["momentumScore"] == participating[idx - 1]["momentumScore"]:
            item["rank"] = participating[idx - 1]["rank"]
        else:
            item["rank"] = idx + 1

        if item["rank"] == 1 and item["confidence"] in ("HIGH", "MEDIUM"):
            item["badges"].insert(0, {
                "id": "momentum_king",
                "label": "Momentum King",
                "icon": "Crown",
                "color": "amber",
                "description": "#1 Rank on the Growth Board across the cohort.",
            })

    for item in unranked:
        item["rank"] = None

    all_rankings = participating + unranked

    # Extract target student's standing
    my_standing = None
    if target_student_id:
        for item in all_rankings:
            if item["studentProfileId"] == target_student_id:
                my_standing = item
                break

    # Podiums (Top 3 movers among active participants)
    podium = participating[:3]

    # Guardrail warnings if user tried conflicting filters
    if filter_exam_family == "ALL" and filter_subject_id and filter_subject_id != "all":
        warnings.append(
            "Comparing different test families (e.g. Unit Tests vs Pre-Boards) is normalized strictly by cohort Z-scores to preserve statistical fairness."
        )

    return {
        "success": True,
        "scope": "class",
        "filterSubjectId": filter_subject_id or "all",
        "filterExamFamily": filter_exam_family or "ALL",
        "totalStudents": len(participating),
        "totalCohortSize": len(all_rankings),
        "totalConductedExams": total_conducted_exams,
        "myStanding": my_standing,
        "podium": podium,
        "rankings": all_rankings,
        "warnings": warnings,
    }


def _generate_explanation(
    name: str,
    z_delta: float,
    elo_delta: float,
    raw_delta: float,
    exams_count: int,
    consistency: float,
) -> str:
    first_name = name.split()[0] if name else "Student"
    if exams_count == 0:
        return f"{first_name} has not appeared in any evaluated exams yet."
    if exams_count == 1:
        return f"{first_name} established initial baseline score. Progress will track growth starting from subsequent tests."

    parts = []
    if z_delta > 0.8:
        parts.append(f"{first_name} gained significantly relative to classmates (+{z_delta:.1f}σ).")
    elif z_delta > 0.2:
        parts.append(f"{first_name} showed positive improvement across peer rankings.")
    elif z_delta < -0.4:
        parts.append(f"{first_name}'s peer-relative performance has room for steady recovery.")
    else:
        parts.append(f"{first_name} maintained steady consistency with class average.")

    if elo_delta > 15.0:
        parts.append(f"Academic rating climbed by +{elo_delta:.0f} pts.")
    elif elo_delta < -10.0:
        parts.append("Working to consolidate rating baseline.")

    if consistency >= 0.8:
        parts.append(f"Consistent exam attendance ({int(consistency * 100)}%).")

    return " ".join(parts)
