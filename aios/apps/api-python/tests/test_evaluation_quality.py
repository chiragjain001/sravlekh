from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from src.analytics.evaluation_quality import compute_evaluation_quality

T0 = datetime(2026, 1, 1, tzinfo=UTC)


def make_version(source, marks, created_at, ai_model_version_label=None):
    ai_rec = None
    if ai_model_version_label is not None:
        ai_rec = SimpleNamespace(aiModelVersion=SimpleNamespace(versionLabel=ai_model_version_label))
    return SimpleNamespace(source=source, marksAwarded=marks, createdAt=created_at, aiRecommendation=ai_rec)


def make_response(created_at, versions):
    evaluation = SimpleNamespace(versions=versions) if versions is not None else None
    return SimpleNamespace(createdAt=created_at, evaluation=evaluation)


@pytest.mark.asyncio
async def test_no_data_returns_none_rates_not_zero():
    fake_db = SimpleNamespace(response=SimpleNamespace(find_many=AsyncMock(return_value=[])))
    with patch("src.analytics.evaluation_quality.db", fake_db):
        result = await compute_evaluation_quality("inst-1")

    assert result["aiTeacherAgreementRate"] is None
    assert result["reviewerOverrideRate"] is None
    assert result["timeToFinalize"]["sampleCount"] == 0


@pytest.mark.asyncio
async def test_ai_teacher_agreement_counts_matching_and_differing_pairs():
    responses = [
        make_response(T0, [make_version("AI", 4, T0 + timedelta(minutes=1)), make_version("TEACHER", 4, T0 + timedelta(minutes=5))]),  # agrees
        make_response(T0, [make_version("AI", 3, T0 + timedelta(minutes=1)), make_version("TEACHER", 5, T0 + timedelta(minutes=5))]),  # disagrees
    ]
    fake_db = SimpleNamespace(response=SimpleNamespace(find_many=AsyncMock(return_value=responses)))
    with patch("src.analytics.evaluation_quality.db", fake_db):
        result = await compute_evaluation_quality("inst-1")

    assert result["sampleCounts"]["aiTeacherPairs"] == 2
    assert result["aiTeacherAgreementRate"] == 0.5


@pytest.mark.asyncio
async def test_reviewer_override_rate_counts_teacher_to_reviewer_changes():
    responses = [
        make_response(T0, [make_version("TEACHER", 4, T0 + timedelta(minutes=1)), make_version("REVIEWER", 4, T0 + timedelta(minutes=10))]),  # unchanged
        make_response(T0, [make_version("TEACHER", 4, T0 + timedelta(minutes=1)), make_version("REVIEWER", 6, T0 + timedelta(minutes=10))]),  # overridden
    ]
    fake_db = SimpleNamespace(response=SimpleNamespace(find_many=AsyncMock(return_value=responses)))
    with patch("src.analytics.evaluation_quality.db", fake_db):
        result = await compute_evaluation_quality("inst-1")

    assert result["sampleCounts"]["teacherReviewerPairs"] == 2
    assert result["reviewerOverrideRate"] == 0.5


@pytest.mark.asyncio
async def test_time_to_finalize_measured_from_response_creation_to_first_human_version():
    responses = [
        make_response(T0, [make_version("AI", 4, T0 + timedelta(minutes=1)), make_version("TEACHER", 4, T0 + timedelta(minutes=6))]),
    ]
    fake_db = SimpleNamespace(response=SimpleNamespace(find_many=AsyncMock(return_value=responses)))
    with patch("src.analytics.evaluation_quality.db", fake_db):
        result = await compute_evaluation_quality("inst-1")

    assert result["timeToFinalize"]["sampleCount"] == 1
    assert result["timeToFinalize"]["meanSeconds"] == 360.0


@pytest.mark.asyncio
async def test_responses_with_no_evaluation_or_no_versions_are_skipped():
    responses = [make_response(T0, None), make_response(T0, [])]
    fake_db = SimpleNamespace(response=SimpleNamespace(find_many=AsyncMock(return_value=responses)))
    with patch("src.analytics.evaluation_quality.db", fake_db):
        result = await compute_evaluation_quality("inst-1")

    assert result["sampleCounts"] == {"aiTeacherPairs": 0, "teacherReviewerPairs": 0}


@pytest.mark.asyncio
async def test_model_version_filter_excludes_non_matching_ai_pairs():
    responses = [
        make_response(T0, [make_version("AI", 4, T0 + timedelta(minutes=1), ai_model_version_label="gpt-4o"), make_version("TEACHER", 4, T0 + timedelta(minutes=5))]),
        make_response(T0, [make_version("AI", 4, T0 + timedelta(minutes=1), ai_model_version_label="gpt-4o-mini"), make_version("TEACHER", 4, T0 + timedelta(minutes=5))]),
    ]
    fake_db = SimpleNamespace(response=SimpleNamespace(find_many=AsyncMock(return_value=responses)))
    with patch("src.analytics.evaluation_quality.db", fake_db):
        result = await compute_evaluation_quality("inst-1", model_version="gpt-4o")

    assert result["sampleCounts"]["aiTeacherPairs"] == 1
