import asyncio
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from src.providers import rate_limit
from src.providers.errors import AdapterRateLimitError
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.retry_after import DEFAULT_RETRY_AFTER_SECONDS, retry_after_seconds
from src.providers.types import GenerateRequest, TextPart

GEMINI_429 = (
    "429 RESOURCE_EXHAUSTED. {'error': {'code': 429, 'message': 'You exceeded your current quota', "
    "'details': [{'@type': 'type.googleapis.com/google.rpc.QuotaFailure', 'violations': "
    "[{'quotaId': 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier'}]}, "
    "{'@type': 'type.googleapis.com/google.rpc.RetryInfo', 'retryDelay': '37s'}]}}"
)


def test_a_providers_own_retry_delay_is_used():
    assert retry_after_seconds(GEMINI_429) == 37


def test_a_message_without_a_delay_falls_back_to_a_sane_wait():
    assert retry_after_seconds("429 too many requests") == DEFAULT_RETRY_AFTER_SECONDS


def test_an_absurd_delay_is_capped():
    assert retry_after_seconds("retryDelay': '99999s'") == 300


@pytest.mark.asyncio
async def test_calls_are_paced_to_the_configured_rate():
    """A booklet fans out into dozens of calls at once; without pacing the free
    tier answers 429 for most of them."""
    rate_limit.reset()
    started = time.monotonic()
    await asyncio.gather(*(rate_limit.pace("model-x", max_rpm=600) for _ in range(4)))  # 0.1s apart
    elapsed = time.monotonic() - started
    assert elapsed >= 0.25, elapsed  # three waits of 0.1s at least


@pytest.mark.asyncio
async def test_pacing_is_per_model_and_disabled_when_unset():
    rate_limit.reset()
    started = time.monotonic()
    await asyncio.gather(rate_limit.pace("a", 600), rate_limit.pace("b", 600), rate_limit.pace("c", 0))
    assert time.monotonic() - started < 0.1


@pytest.mark.asyncio
async def test_the_gemini_adapter_paces_before_calling_the_provider():
    calls = []

    async def fake_generate(**kwargs):
        calls.append(time.monotonic())
        return SimpleNamespace(text="ok")

    client = MagicMock(return_value=SimpleNamespace(aio=SimpleNamespace(models=SimpleNamespace(generate_content=AsyncMock(side_effect=fake_generate)))))
    rate_limit.reset()
    with patch("src.providers.gemini_adapter.Client", client):
        adapter = GeminiAdapter(api_key="k", max_rpm=600)
        request = GenerateRequest(content=[TextPart("x")], model="gemini-3.6-flash", temperature=0.0)
        await asyncio.gather(adapter.generate(request), adapter.generate(request))

    assert len(calls) == 2
    assert calls[1] - calls[0] >= 0.09


@pytest.mark.asyncio
async def test_ocr_route_answers_429_with_retry_after_instead_of_a_500():
    """A rate limit is "come back shortly", not a failure — a 500 made the queue
    burn its retries in seconds and dead-letter work that would have succeeded."""
    from src.routers.ocr import OCRExtractRequest, extract

    region = SimpleNamespace(
        id="region-1",
        boundingBox={"x": 0.1, "y": 0.1, "width": 0.5, "height": 0.2},
        pageImage=SimpleNamespace(page=SimpleNamespace(document=SimpleNamespace(
            documentBundle=SimpleNamespace(assessmentDelivery=SimpleNamespace(assessment=SimpleNamespace(instituteId="inst-1")))))),
    )
    fake_db = SimpleNamespace(
        pageregion=SimpleNamespace(find_unique=AsyncMock(return_value=region)),
        ocrblock=SimpleNamespace(find_many=AsyncMock(return_value=[]), create=AsyncMock(return_value=SimpleNamespace(id="block-1"))),
        ocrresult=SimpleNamespace(create=AsyncMock()),
    )
    with patch("src.routers.ocr.db", fake_db), \
         patch("src.routers.ocr.resolve_ocr_ai_model_id", AsyncMock(return_value="model-1")), \
         patch("src.routers.ocr.resolve_active_ocr_model_version", AsyncMock(return_value=SimpleNamespace(id="mv-1", versionLabel="gemini-3.6-flash"))), \
         patch("src.routers.ocr.extract_text", AsyncMock(side_effect=AdapterRateLimitError(GEMINI_429))):
        with pytest.raises(HTTPException) as exc:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/p.png", blockType="HANDWRITTEN_TEXT"))

    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "37"
    fake_db.ocrresult.create.assert_not_awaited()  # nothing recorded for a call that never ran


@pytest.mark.asyncio
async def test_evaluation_route_answers_429_with_retry_after():
    from src.routers.evaluation import AIEvaluateRequest, ai_evaluate

    with patch("src.routers.evaluation.evaluate_response", AsyncMock(side_effect=AdapterRateLimitError(GEMINI_429))):
        with pytest.raises(HTTPException) as exc:
            await ai_evaluate(AIEvaluateRequest(instituteId="inst-1", responseId="resp-1", requestedByUserId="user-1"))

    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "37"
