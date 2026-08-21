from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.mastery_engine import recalculate_mastery


def make_response(marks_awarded, marks_available, difficulty, subject_id="sub-1"):
    return SimpleNamespace(
        marksAwarded=marks_awarded,
        marksAvailable=marks_available,
        question=SimpleNamespace(difficulty=difficulty, subjectId=subject_id),
    )


@pytest.mark.asyncio
async def test_ema_matches_the_original_typescript_formula():
    """Ported from AnalyticsService.recalculateMastery — same two-response case,
    same expected result, so a future refactor of either side can be checked
    against the other."""
    responses = [
        make_response(marks_awarded=5, marks_available=10, difficulty="EASY"),  # score .5 * .8 = .4
        make_response(marks_awarded=8, marks_available=10, difficulty="HARD"),  # score .8 * 1.2 -> capped 1.0? no: .96
    ]

    fake_db = SimpleNamespace(
        answersheet=SimpleNamespace(find_many=AsyncMock(return_value=[SimpleNamespace(id="as-1")])),
        response=SimpleNamespace(find_many=AsyncMock(return_value=responses)),
        masteryscore=SimpleNamespace(upsert=AsyncMock()),
    )

    with patch("src.analytics.mastery_engine.db", fake_db):
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
        answersheet=SimpleNamespace(find_many=AsyncMock(return_value=[SimpleNamespace(id="as-1")])),
        response=SimpleNamespace(find_many=response_find_many),
        masteryscore=SimpleNamespace(upsert=AsyncMock()),
    )

    with patch("src.analytics.mastery_engine.db", fake_db):
        await recalculate_mastery("student-1", ["topic-broken", "topic-ok"])

    # Only the second (successful) topic reaches the upsert.
    fake_db.masteryscore.upsert.assert_awaited_once()


@pytest.mark.asyncio
async def test_no_answer_sheets_skips_without_error():
    fake_db = SimpleNamespace(
        answersheet=SimpleNamespace(find_many=AsyncMock(return_value=[])),
        response=SimpleNamespace(find_many=AsyncMock()),
        masteryscore=SimpleNamespace(upsert=AsyncMock()),
    )

    with patch("src.analytics.mastery_engine.db", fake_db):
        await recalculate_mastery("student-1", ["topic-1"])

    fake_db.response.find_many.assert_not_awaited()
    fake_db.masteryscore.upsert.assert_not_awaited()
