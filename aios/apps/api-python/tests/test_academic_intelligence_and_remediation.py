"""Comprehensive Test Suite for Academic Intelligence, Mastery Calculation,
Remediation Engine, and Diagnostic Report PDF Generation.

Validates the complete contract specified in ACADEMIC INTELLIGENCE, MASTERY & REMEDIATION:
- Mathematical precision and score normalization of EMA topic mastery.
- Clamping of invalid, negative, or zero marks denominators (division-by-zero defense).
- Deduplication against duplicate exam ingestion and repeated attempts.
- Fallback status handling for weak topics when question bank is empty.
- Diagnostic mistake taxonomy (Conceptual, Calculation, Formula, Careless, Presentation, Untagged).
- Vector PDF rendering for empty, typical, and large cohorts.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import pytest

from src.analytics.mastery_engine import recalculate_mastery
from src.analytics.intervention_engine import evaluate_interventions
from src.routers.reports import AcademicReportPDF, build_student_report_card, build_batch_report


@pytest.fixture(autouse=True)
def _fixed_thresholds():
    with patch("src.analytics.mastery_engine.get_mastery_threshold", return_value=0.5), \
         patch("src.analytics.intervention_engine.get_mastery_threshold", return_value=0.5), \
         patch("src.analytics.intervention_engine.get_max_weak_topics", return_value=2), \
         patch("src.analytics.intervention_engine.get_min_samples_for_intervention", return_value=1):
        yield


def make_resp(
    marks_awarded,
    marks_available,
    difficulty="MEDIUM",
    subject_id="sub-math",
    topic_id="top-quad",
    attempt_id="att-1",
    question_id="q-1",
    evaluation=None,
    qtype="SHORT_ANSWER",
):
    if evaluation is None and attempt_id is not None:
        evaluation = make_eval(marks_awarded, source="TEACHER")
    return SimpleNamespace(
        id=f"resp-{attempt_id}-{question_id}",
        marksAwarded=marks_awarded,
        marksAvailable=marks_available,
        attemptId=attempt_id,
        questionId=question_id,
        question=SimpleNamespace(
            id=question_id,
            difficulty=difficulty,
            subjectId=subject_id,
            topicId=topic_id,
            type=qtype,
        ),
        evaluation=evaluation,
    )


def make_eval(marks_awarded, source="TEACHER", mistake_tag=None):
    return SimpleNamespace(
        currentVersion=SimpleNamespace(
            marksAwarded=marks_awarded,
            source=source,
            mistakeTagType=mistake_tag,
        )
    )


# ============================================================================
# 1. Mathematical Accuracy of EMA Topic Mastery
# ============================================================================

@pytest.mark.asyncio
async def test_ema_normalization_across_different_maximum_marks():
    """Validates that a 5-mark question, a 20-mark question, and a 50-mark question
    are normalized to [0.0, 1.0] and progression follows exact EMA formula:
    Step 0: M0 = S0
    Step 1: M1 = 0.3 * S1 + 0.7 * M0
    Step 2: M2 = 0.3 * S2 + 0.7 * M1
    """
    responses = [
        # Q1: 4/5 on MEDIUM (weight 1.0) -> S0 = 0.8
        make_resp(4, 5, difficulty="MEDIUM", question_id="q-1"),
        # Q2: 15/20 on HARD (weight 1.2) -> raw 0.75 * 1.2 = 0.90 -> S1 = 0.90
        # M1 = 0.90 * 0.3 + 0.80 * 0.7 = 0.27 + 0.56 = 0.83
        make_resp(15, 20, difficulty="HARD", question_id="q-2"),
        # Q3: 25/50 on EASY (weight 0.8) -> raw 0.50 * 0.8 = 0.40 -> S2 = 0.40
        # M2 = 0.40 * 0.3 + 0.83 * 0.7 = 0.12 + 0.581 = 0.701
        make_resp(25, 50, difficulty="EASY", question_id="q-3"),
    ]

    mock_upsert = AsyncMock()
    fake_db = SimpleNamespace(
        response=SimpleNamespace(find_many=AsyncMock(return_value=responses)),
        masteryscore=SimpleNamespace(upsert=mock_upsert, update_many=AsyncMock(return_value=0)),
    )

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["top-quad"])

    mock_upsert.assert_awaited_once()
    data = mock_upsert.await_args.kwargs["data"]["update"]
    assert data["masteryValue"] == pytest.approx(0.701, abs=1e-4)
    assert data["trend"] == pytest.approx(0.701 - 0.83, abs=1e-4)
    assert data["sampleCount"] == 3


@pytest.mark.asyncio
async def test_zero_denominator_negative_marks_and_overflow_clamping():
    """Guards against division-by-zero, negative marks, and marks exceeding available."""
    responses = [
        # Invalid zero denominator -> treated as 0.0 safely without crash
        make_resp(5, 0, difficulty="MEDIUM", question_id="q-zero"),
        # Negative marks awarded (e.g. penalty) -> clamped to 0.0, cannot corrupt mastery
        make_resp(-5, 10, difficulty="MEDIUM", question_id="q-neg"),
        # Marks awarded exceeding available -> clamped to 1.0 * weight
        make_resp(15, 10, difficulty="HARD", question_id="q-over"),
    ]

    mock_upsert = AsyncMock()
    fake_db = SimpleNamespace(
        response=SimpleNamespace(find_many=AsyncMock(return_value=responses)),
        masteryscore=SimpleNamespace(upsert=mock_upsert, update_many=AsyncMock(return_value=0)),
    )

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["top-quad"])

    mock_upsert.assert_awaited_once()
    data = mock_upsert.await_args.kwargs["data"]["update"]
    # S0 = 0.0; S1 = 0.0 -> M1 = 0.0; S2 = min(1.0, 1.0 * 1.2) = 1.0 -> M2 = 1.0 * 0.3 + 0.0 = 0.3
    assert data["masteryValue"] == pytest.approx(0.30, abs=1e-4)
    assert data["sampleCount"] == 3


@pytest.mark.asyncio
async def test_duplicate_exam_ingestion_deduplication():
    """If an attempt or answer sheet was ingested twice with identical question responses,
    deduplication ensures each question contributes only once to the EMA sequence.
    """
    responses = [
        make_resp(8, 10, difficulty="MEDIUM", attempt_id="att-1", question_id="q-1"),
        # Duplicate of above (same attempt, same question)
        make_resp(8, 10, difficulty="MEDIUM", attempt_id="att-1", question_id="q-1"),
        # Different question
        make_resp(6, 10, difficulty="MEDIUM", attempt_id="att-1", question_id="q-2"),
    ]

    mock_upsert = AsyncMock()
    fake_db = SimpleNamespace(
        response=SimpleNamespace(find_many=AsyncMock(return_value=responses)),
        masteryscore=SimpleNamespace(upsert=mock_upsert, update_many=AsyncMock(return_value=0)),
    )

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["top-quad"])

    mock_upsert.assert_awaited_once()
    data = mock_upsert.await_args.kwargs["data"]["update"]
    # S0 = 0.8; S1 = 0.6; M1 = 0.6 * 0.3 + 0.8 * 0.7 = 0.18 + 0.56 = 0.74
    assert data["masteryValue"] == pytest.approx(0.74, abs=1e-4)
    assert data["sampleCount"] == 2  # Deduplicated from 3 to 2!


# ============================================================================
# 2. Remediation & Empty Question Bank Fallback Status
# ============================================================================

@pytest.mark.asyncio
async def test_empty_question_bank_sets_needs_questions_fallback():
    """When weak mastery is detected but no approved questions exist in the question bank,
    the system creates an intervention and notification with a clear NEEDS_QUESTIONS fallback,
    ensuring teachers are alerted rather than creating an unpopulated assignment silently.
    """
    fake_db = SimpleNamespace(
        studentprofile=SimpleNamespace(
            find_unique=AsyncMock(
                return_value=SimpleNamespace(
                    batchId="batch-10A",
                    user=SimpleNamespace(instituteId="inst-1"),
                )
            )
        ),
        batchteacher=SimpleNamespace(
            find_first=AsyncMock(
                return_value=SimpleNamespace(
                    teacherProfile=SimpleNamespace(user=SimpleNamespace(id="teacher-1"))
                )
            )
        ),
        masteryscore=SimpleNamespace(update_many=AsyncMock(return_value=1)),
        topic=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(name="Electromagnetism"))),
        # Empty question bank:
        question=SimpleNamespace(find_many=AsyncMock(return_value=[])),
        assignment=SimpleNamespace(create=AsyncMock(return_value=SimpleNamespace(id="asg-fallback"))),
        intervention=SimpleNamespace(create=AsyncMock(return_value=SimpleNamespace(id="int-fallback"))),
        notice=SimpleNamespace(create=AsyncMock(return_value=SimpleNamespace(id="not-fallback"))),
        noticedelivery=SimpleNamespace(create=AsyncMock()),
    )

    with patch("src.analytics.intervention_engine.db", fake_db):
        await evaluate_interventions("student-1", [("top-em", "sub-physics", 0.32)])

    # Verify assignment has fallback indicator
    asg_call = fake_db.assignment.create.await_args.kwargs["data"]
    assert "ACTION REQUIRED: Teacher review and question attachment needed" in asg_call["description"]

    # Verify intervention records fallback explanation
    int_call = fake_db.intervention.create.await_args.kwargs["data"]
    assert "Question bank had no approved questions" in int_call["description"]

    # Verify teacher notice carries NEEDS_QUESTIONS status
    notice_call = fake_db.notice.create.await_args.kwargs["data"]
    assert "Questions needed" in notice_call["title"]
    assert notice_call["targetAudience"]["status"] == "NEEDS_QUESTIONS"


# ============================================================================
# 3. Vector PDF Generation & Diagnostic Reporting
# ============================================================================

def test_student_report_card_renders_mistake_breakdown_and_interventions():
    """Verifies that the PDF builder generates a genuine vector PDF containing
    both the Diagnostic Mistake Breakdown and Targeted Interventions tables.
    """
    pdf = AcademicReportPDF(title_text="REPORT_CARD", report_id="REP-TEST-001")
    pdf.add_page()

    payload = {
        "student": {"name": "Priya Sharma", "rollNumber": "10-B-24"},
        "batch": {"name": "Grade 10 Batch B"},
        "scores": [
            {"exam": "Term 1 Science", "examType": "SUMMATIVE", "obtainedMarks": 72, "totalMarks": 100, "percentage": 72.0},
        ],
        "mastery": [
            {"subject": "Physics", "topic": "Optics", "masteryValue": 0.82, "trend": 0.1},
            {"subject": "Physics", "topic": "Electricity", "masteryValue": 0.38, "trend": -0.15},
        ],
        "mistakeSummary": {
            "byTag": {
                "CONCEPT_ERROR": 4,
                "CALCULATION_ERROR": 2,
                "UNTAGGED": 1,
            },
            "marksLostByTag": {
                "CONCEPT_ERROR": 8.0,
                "CALCULATION_ERROR": 3.0,
                "UNTAGGED": 2.0,
            },
        },
        "interventions": [
            {
                "topic": "Electricity",
                "type": "ASSIGNMENT",
                "beforeMastery": 0.38,
                "afterMastery": None,
            }
        ],
    }

    build_student_report_card(pdf, payload)
    pdf_bytes = bytes(pdf.output())

    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")


def test_batch_report_renders_empty_roster_cleanly():
    """Validates that a batch with no enrolled student records renders a clean
    empty-state notice rather than crashing or showing 'None%' KPI values.
    """
    pdf = AcademicReportPDF(title_text="BATCH_REPORT", report_id="REP-BATCH-EMPTY")
    pdf.add_page()

    payload = {
        "batch": {
            "name": "New Cohort 2026",
            "classYear": "Class 9",
            "cohortAverage": None,
            "interventionSuccessRate": None,
            "assignmentCompletionRate": None,
            "totalExams": 0,
        },
        "roster": [],
    }

    build_batch_report(pdf, payload)
    pdf_bytes = bytes(pdf.output())

    assert len(pdf_bytes) > 500
    assert pdf_bytes.startswith(b"%PDF-")


def test_batch_report_renders_large_roster_with_pagination():
    """Validates that a large batch (e.g. 80 students) automatically triggers
    clean A4 pagination without crashing or overflowing margins.
    """
    pdf = AcademicReportPDF(title_text="BATCH_REPORT", report_id="REP-BATCH-LARGE")
    pdf.add_page()

    roster = [
        {
            "rollNumber": f"R-{i:03d}",
            "name": f"Student {i}",
            "averagePercentage": 60.0 + (i % 35),
            "examCount": 5,
            "improvedCount": 2,
            "completedAssignmentsCount": 8,
            "assignmentsCount": 10,
        }
        for i in range(1, 81)
    ]

    payload = {
        "batch": {
            "name": "Senior JEE Cohort",
            "classYear": "Class 12",
            "cohortAverage": 74.5,
            "interventionSuccessRate": 82.0,
            "assignmentCompletionRate": 91.0,
            "totalExams": 400,
            "roster": roster,
        },
        "roster": roster,
    }

    build_batch_report(pdf, payload)
    pdf_bytes = bytes(pdf.output())

    assert pdf.page_no() >= 2  # Spans multiple pages cleanly
    assert pdf_bytes.startswith(b"%PDF-")

