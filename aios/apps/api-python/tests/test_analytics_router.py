from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.routers.analytics import get_batch_heatmap

# P1 D1's whole point: "struggling" here and "weak topic" in intervention_engine.py
# must read from the SAME threshold, not independently-set literals that can drift.
# get_mastery_threshold() defaults to 0.50 (config.py) — unpatched tests below rely
# on that default, matching the pre-D1 hardcoded `< 50` exactly (no behavior change
# at the shipped default). Boundary tests patch it explicitly to prove the binding
# is live, not decorative.


def make_student(student_id, name, topic_id, topic_name, mastery_value, trend=0.0):
    return SimpleNamespace(
        id=student_id,
        user=SimpleNamespace(name=name),
        masteryScores=[
            SimpleNamespace(
                topicId=topic_id,
                topic=SimpleNamespace(name=topic_name),
                masteryValue=mastery_value,
                trend=trend,
            )
        ],
    )


@pytest.mark.asyncio
async def test_rejects_a_student_caller():
    with pytest.raises(HTTPException) as exc_info:
        await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="STUDENT"))
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_empty_batch_returns_empty_data_not_an_error():
    fake_db = SimpleNamespace(studentprofile=SimpleNamespace(find_many=AsyncMock(return_value=[])))
    with patch("src.routers.analytics.db", fake_db):
        result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert result == {"success": True, "data": []}


@pytest.mark.asyncio
async def test_aggregates_mastery_by_topic_without_crashing_on_the_trend_field():
    # Regression test: the handler used to read score.trendDirection, a field
    # that doesn't exist on MasteryScore (the real column is `trend`) — this
    # raised AttributeError on every real request that reached this line.
    students = [
        make_student("s1", "Aarav", "t1", "Kinematics", 0.30),  # masteryValue is 0.0-1.0 (see schema)
        make_student("s2", "Diya", "t1", "Kinematics", 0.80),
    ]
    fake_db = SimpleNamespace(studentprofile=SimpleNamespace(find_many=AsyncMock(return_value=students)))
    with patch("src.routers.analytics.db", fake_db):
        result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))

    assert result["success"] is True
    row = result["data"][0]
    assert row["topicId"] == "t1"
    assert row["averageMastery"] == 55.0
    assert row["studentsStruggling"] == 1  # only the 30.0 student is below 50
    assert row["totalStudents"] == 2


@pytest.mark.asyncio
async def test_struggling_count_moves_with_a_retuned_mastery_threshold():
    """P1 D1: proves the binding to get_mastery_threshold() is live, not decorative.
    At the shipped default (0.50) student s2 (0.60 -> 60%) is NOT struggling; raise
    the threshold to 0.65 and the same student becomes struggling with no other
    change — the count can only move if it's actually reading the config each call."""
    students = [
        make_student("s1", "Aarav", "t1", "Kinematics", 0.30),
        make_student("s2", "Diya", "t1", "Kinematics", 0.60),
    ]
    fake_db = SimpleNamespace(studentprofile=SimpleNamespace(find_many=AsyncMock(return_value=students)))

    with patch("src.routers.analytics.db", fake_db):
        default_result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert default_result["data"][0]["studentsStruggling"] == 1

    with patch("src.routers.analytics.db", fake_db), \
         patch("src.routers.analytics.get_mastery_threshold", return_value=0.65):
        retuned_result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert retuned_result["data"][0]["studentsStruggling"] == 2


@pytest.mark.asyncio
async def test_struggling_threshold_boundary_is_strictly_less_than():
    # Exactly at the threshold (0.50 -> 50.0) must NOT count as struggling —
    # `<`, not `<=`, matching the pre-D1 hardcoded comparison exactly.
    students = [make_student("s1", "Aarav", "t1", "Kinematics", 0.50)]
    fake_db = SimpleNamespace(studentprofile=SimpleNamespace(find_many=AsyncMock(return_value=students)))
    with patch("src.routers.analytics.db", fake_db):
        result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert result["data"][0]["studentsStruggling"] == 0


@pytest.mark.asyncio
async def test_heatmap_status_bands_are_config_driven_not_derived_from_intervention_threshold():
    """P1 D1: CRITICAL/WARNING/HEALTHY are a genuinely different, unspecified
    3-tier display classification — deliberately NOT derived from
    get_mastery_threshold(). Retuning the intervention threshold must not move
    these bands; retuning the heatmap-specific config must."""
    students = [make_student("s1", "Aarav", "t1", "Kinematics", 0.45)]  # 45%
    fake_db = SimpleNamespace(studentprofile=SimpleNamespace(find_many=AsyncMock(return_value=students)))

    with patch("src.routers.analytics.db", fake_db), \
         patch("src.routers.analytics.get_mastery_threshold", return_value=0.90):
        result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert result["data"][0]["status"] == "WARNING"  # unmoved: 40 <= 45 < 70 by default

    with patch("src.routers.analytics.db", fake_db), \
         patch("src.routers.analytics.get_heatmap_critical_threshold_pct", return_value=50.0):
        result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert result["data"][0]["status"] == "CRITICAL"  # now moved: 45 < 50


@pytest.mark.parametrize(
    "average_mastery,expected_status",
    [
        (39.9, "CRITICAL"),
        (40.0, "WARNING"),   # exactly at CRITICAL's boundary -> not CRITICAL
        (69.9, "WARNING"),
        (70.0, "HEALTHY"),   # exactly at WARNING's boundary -> not WARNING
        (0.0, "CRITICAL"),
        (100.0, "HEALTHY"),
    ],
)
@pytest.mark.asyncio
async def test_heatmap_status_band_boundaries(average_mastery, expected_status):
    students = [make_student("s1", "Aarav", "t1", "Kinematics", average_mastery / 100)]
    fake_db = SimpleNamespace(studentprofile=SimpleNamespace(find_many=AsyncMock(return_value=students)))
    with patch("src.routers.analytics.db", fake_db):
        result = await get_batch_heatmap("batch-1", current_user=SimpleNamespace(role="TEACHER"))
    assert result["data"][0]["status"] == expected_status


def test_heatmap_and_intervention_engine_share_the_exact_same_threshold_source():
    """P1 D1's actual regression guard: both modules must resolve the mastery
    threshold from the identical function, not their own independent copy — the
    literal condition that made 40/70/50 able to silently drift from
    intervention_engine.py's cutoff in the first place. Import identity, not just
    equal values, so a future accidental re-declaration (the exact P0/OPT-1
    mistake, made three times over before consolidation) fails this test."""
    from src.analytics.intervention_config import get_mastery_threshold as canonical
    from src.analytics.intervention_engine import get_mastery_threshold as engine_import
    from src.routers.analytics import get_mastery_threshold as router_import

    assert engine_import is canonical
    assert router_import is canonical
