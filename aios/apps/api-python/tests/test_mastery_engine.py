from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.mastery_engine import recalculate_mastery


@pytest.fixture(autouse=True)
def _fixed_mastery_threshold():
    """get_mastery_threshold() resolves through pydantic Settings, which
    requires real env vars (DATABASE_URL/JWT_SECRET) this unit-test run has
    no reason to provide — patched at its point of use instead, hermetic and
    independent of ambient environment, same as every other external
    dependency in this test file."""
    with patch("src.analytics.mastery_engine.get_mastery_threshold", return_value=0.5):
        yield


def make_response(
    marks_awarded, marks_available, difficulty, subject_id="sub-1",
    evaluation=None, qtype="SHORT_ANSWER", attempt_id=None,
):
    """Defaults to a v1 answer-sheet response (attempt_id=None), where the
    teacher graded marksAwarded in place and no Evaluation row exists. Pass
    attempt_id to build a v2 response, where a subjective question requires a
    human-approved EvaluationVersion before its marks count."""
    return SimpleNamespace(
        marksAwarded=marks_awarded,
        marksAvailable=marks_available,
        attemptId=attempt_id,
        question=SimpleNamespace(difficulty=difficulty, subjectId=subject_id, type=qtype),
        evaluation=evaluation,
    )


def make_evaluation(marks_awarded, source="TEACHER"):
    """A v2 Evaluation whose currentVersion carries the authoritative marks —
    21-DOMAIN-MODEL-V2.md §4.8's required read-path change. Defaults to a
    human-authored (TEACHER) version, since only those feed mastery (32 §3);
    pass source="AI" to build an unreviewed suggestion."""
    return SimpleNamespace(
        currentVersion=SimpleNamespace(marksAwarded=marks_awarded, source=source)
    )


def make_fake_db(responses, upsert=None, update_many_result=0):
    return SimpleNamespace(
        response=SimpleNamespace(find_many=AsyncMock(return_value=responses)),
        masteryscore=SimpleNamespace(
            upsert=upsert or AsyncMock(),
            update_many=AsyncMock(return_value=update_many_result),
        ),
    )


@pytest.mark.asyncio
async def test_ema_matches_the_original_typescript_formula():
    """Ported from AnalyticsService.recalculateMastery — same two-response case,
    same expected result, so a future refactor of either side can be checked
    against the other. Pure v1 path: no evaluation on either response."""
    responses = [
        make_response(marks_awarded=5, marks_available=10, difficulty="EASY"),  # score .5 * .8 = .4
        make_response(marks_awarded=8, marks_available=10, difficulty="HARD"),  # score .8 * 1.2 -> capped 1.0? no: .96
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    fake_db.masteryscore.upsert.assert_awaited_once()
    call = fake_db.masteryscore.upsert.await_args
    assert call.kwargs["where"] == {
        "studentProfileId_topicId": {"studentProfileId": "student-1", "topicId": "topic-1"}
    }
    data = call.kwargs["data"]["update"]
    # index0: current = 0.4; index1: adjusted = min(1, 0.8*1.2) = 0.96,
    # current = 0.96*0.3 + 0.4*0.7 = 0.568; trend = 0.568 - 0.4 = 0.168
    assert data["masteryValue"] == pytest.approx(0.568)
    assert data["trend"] == pytest.approx(0.168)
    assert data["sampleCount"] == 2


@pytest.mark.asyncio
async def test_v2_evaluated_response_uses_current_evaluation_version_marks_not_response_marksawarded():
    """The exact regression this phase fixes: a v2-native response whose
    Response.marksAwarded is stale/unset (EvaluationsService never writes it —
    25-EVALUATION-ENGINE.md §2, "never graded in place") must still be read
    correctly, via Evaluation.currentVersion.marksAwarded."""
    response = make_response(
        marks_awarded=0,  # what a naive read would (wrongly) see
        marks_available=10,
        difficulty="EASY",
        evaluation=make_evaluation(marks_awarded=9),  # the real, human-finalized score
    )
    fake_db = make_fake_db([response])

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    # score = 9/10 * 0.8 (EASY) = 0.72, first response so current_mastery = 0.72 directly
    assert data["masteryValue"] == pytest.approx(0.72)


@pytest.mark.asyncio
async def test_unreviewed_ai_only_response_is_excluded_from_the_ema_not_zeroed():
    """32-AI-GOVERNANCE-POLICY.md §3: an AI_SUGGESTED response nobody has reviewed
    must not feed mastery. Excluded from the sequence — NOT scored 0, which would
    crash the student's mastery for an answer that simply hasn't been graded yet."""
    responses = [
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY",
            evaluation=make_evaluation(marks_awarded=9, source="TEACHER"),
        ),
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY",
            evaluation=make_evaluation(marks_awarded=2, source="AI"),  # unreviewed
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    # Only the TEACHER response counts: 9/10 * 0.8 = 0.72, and as the first COUNTED
    # response it sets mastery directly. A zeroed AI response would have dragged
    # this to 0.504; excluding it entirely leaves 0.72.
    assert data["masteryValue"] == pytest.approx(0.72)
    assert data["sampleCount"] == 1


@pytest.mark.asyncio
async def test_reviewer_sourced_version_counts_like_a_teacher_one():
    """REVIEWER is the other human source (25 §4.3's override path) — it is
    authoritative exactly like TEACHER, per evaluation_status.HUMAN_SOURCES."""
    responses = [
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY",
            evaluation=make_evaluation(marks_awarded=9, source="REVIEWER"),
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    assert data["masteryValue"] == pytest.approx(0.72)


@pytest.mark.asyncio
async def test_topic_with_only_ai_suggested_responses_is_skipped_entirely():
    """No human-approved evidence yet => the topic's MasteryScore is left untouched,
    rather than being written from unreviewed AI marks. Same no-op path as a topic
    with no responses at all."""
    responses = [
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY",
            evaluation=make_evaluation(marks_awarded=2, source="AI"),
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    fake_db.masteryscore.upsert.assert_not_awaited()


@pytest.mark.asyncio
async def test_v2_subjective_response_with_no_evaluation_row_is_excluded_not_scored_zero():
    """Caught by the real-database E2E pass, missed by the mocked suite. A v2
    subjective response nobody has evaluated has no Evaluation row at all — the
    same shape as objective evidence. Treating "no Evaluation row" as "objective"
    scored an ungraded answer as a real 0 and dragged mastery down."""
    responses = [
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY", attempt_id="att-1",
            evaluation=make_evaluation(marks_awarded=9, source="TEACHER"),
        ),
        # Never evaluated: no Evaluation row, marksAwarded still at its 0 default.
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY", attempt_id="att-1",
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db),          patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    # Only the graded response counts: 9/10 * 0.8 = 0.72. Counting the ungraded one
    # as a real zero would have pulled this down to 0.504.
    assert data["masteryValue"] == pytest.approx(0.72)
    assert data["sampleCount"] == 1


@pytest.mark.asyncio
async def test_v2_objective_response_with_no_evaluation_row_still_counts():
    """The other half of the same rule: an objective response legitimately has no
    Evaluation row, and its capture-time mark must still feed mastery."""
    responses = [
        make_response(
            marks_awarded=8, marks_available=10, difficulty="EASY",
            attempt_id="att-1", qtype="MCQ",
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db),          patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    assert data["masteryValue"] == pytest.approx(0.64)  # 0.8 * 0.8 (EASY)


@pytest.mark.asyncio
async def test_pending_evaluation_with_no_current_version_is_excluded():
    """A subjective response whose Evaluation exists but has no currentVersion is
    ungraded — excluded, not read through to the stale Response.marksAwarded."""
    responses = [
        make_response(
            marks_awarded=7, marks_available=10, difficulty="EASY",
            evaluation=SimpleNamespace(currentVersion=None),
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    fake_db.masteryscore.upsert.assert_not_awaited()


@pytest.mark.asyncio
async def test_mixed_v1_and_v2_responses_both_contribute_to_the_same_ema_sequence():
    """A student can have both v1 (AnswerSheet) and v2 (Attempt) responses for
    the same topic — both must feed the same mastery calculation, in
    submission order, per 21-DOMAIN-MODEL-V2.md §4.8 (a read-path change,
    not a formula change)."""
    responses = [
        make_response(marks_awarded=6, marks_available=10, difficulty="EASY"),  # v1: score .6*.8=.48
        make_response(
            marks_awarded=0, marks_available=10, difficulty="EASY",
            evaluation=make_evaluation(marks_awarded=10),  # v2: score 10/10*.8=.8
        ),
    ]
    fake_db = make_fake_db(responses)

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    # index0: current = 0.48; index1: adjusted = 0.8, current = 0.8*0.3 + 0.48*0.7 = 0.576
    assert data["masteryValue"] == pytest.approx(0.576)
    assert data["sampleCount"] == 2


@pytest.mark.asyncio
async def test_response_query_spans_both_answersheet_and_attempt_ownership():
    """Confirms the fix at the query level, not just the marks-read level —
    the previous query only ever considered AnswerSheet-owned responses."""
    fake_db = make_fake_db([make_response(5, 10, "EASY")])

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    where = fake_db.response.find_many.await_args.kwargs["where"]
    assert where["OR"] == [
        {"answerSheet": {"is": {"studentProfileId": "student-1"}}},
        {"attempt": {"is": {"studentProfileId": "student-1"}}},
    ]


@pytest.mark.asyncio
async def test_mastery_recovering_above_threshold_clears_the_intervention_claim():
    """masteryValue >= threshold must clear MasteryScore.interventionTriggeredAt
    so a later genuine re-drop is treated as a fresh episode."""
    response = make_response(marks_awarded=10, marks_available=10, difficulty="EASY")  # score 1.0*0.8=0.8, well above default 0.5
    fake_db = make_fake_db([response])

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    assert data["interventionTriggeredAt"] is None


@pytest.mark.asyncio
async def test_still_weak_does_not_touch_the_intervention_claim_field():
    """Staying below threshold must not reset an in-flight claim — that would
    let a duplicate intervention slip through on the next recalculation."""
    response = make_response(marks_awarded=1, marks_available=10, difficulty="EASY")  # score .1*.8=.08, below 0.5
    fake_db = make_fake_db([response])

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-1"])

    data = fake_db.masteryscore.upsert.await_args.kwargs["data"]["update"]
    assert "interventionTriggeredAt" not in data


@pytest.mark.asyncio
async def test_a_failing_topic_does_not_block_the_others():
    """Mirrors the original's per-topic try/catch: one topic erroring must not
    prevent mastery from being recalculated for the rest."""
    good_responses = [make_response(marks_awarded=10, marks_available=10, difficulty="EASY")]

    find_many_calls = {"count": 0}

    async def response_find_many(**kwargs):
        find_many_calls["count"] += 1
        if find_many_calls["count"] == 1:
            raise RuntimeError("simulated DB error for topic-broken")
        return good_responses

    fake_db = SimpleNamespace(
        response=SimpleNamespace(find_many=response_find_many),
        masteryscore=SimpleNamespace(upsert=AsyncMock(), update_many=AsyncMock(return_value=0)),
    )

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()):
        await recalculate_mastery("student-1", ["topic-broken", "topic-ok"])

    # Only the second (successful) topic reaches the upsert.
    fake_db.masteryscore.upsert.assert_awaited_once()


@pytest.mark.asyncio
async def test_no_responses_skips_without_error():
    fake_db = make_fake_db([])

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()) as mock_eval:
        await recalculate_mastery("student-1", ["topic-1"])

    fake_db.masteryscore.upsert.assert_not_awaited()
    mock_eval.assert_not_awaited()


@pytest.mark.asyncio
async def test_evaluate_interventions_is_called_with_every_recalculated_topics_result():
    """recalculate_mastery must hand every successfully-recalculated topic's
    (topic_id, subject_id, mastery_value) to the intervention evaluator in one
    call, so severity ranking happens across the full set, not per topic."""
    fake_db = SimpleNamespace(
        response=SimpleNamespace(
            find_many=AsyncMock(
                side_effect=[
                    [make_response(1, 10, "EASY", subject_id="sub-1")],  # weak
                    [make_response(9, 10, "EASY", subject_id="sub-2")],  # strong
                ]
            )
        ),
        masteryscore=SimpleNamespace(upsert=AsyncMock(), update_many=AsyncMock(return_value=0)),
    )

    with patch("src.analytics.mastery_engine.db", fake_db), \
         patch("src.analytics.mastery_engine.evaluate_interventions", AsyncMock()) as mock_eval:
        await recalculate_mastery("student-1", ["topic-weak", "topic-strong"])

    mock_eval.assert_awaited_once()
    student_arg, results_arg = mock_eval.await_args.args
    assert student_arg == "student-1"
    by_topic = {topic_id: (subject_id, mastery) for topic_id, subject_id, mastery in results_arg}
    assert by_topic["topic-weak"][0] == "sub-1"
    assert by_topic["topic-weak"][1] == pytest.approx(0.08)
    assert by_topic["topic-strong"][0] == "sub-2"
    assert by_topic["topic-strong"][1] == pytest.approx(0.72)
