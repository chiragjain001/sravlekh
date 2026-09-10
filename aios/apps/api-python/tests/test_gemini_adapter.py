from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from google.genai.errors import ClientError, ServerError

from src.providers.errors import (
    AdapterAuthError,
    AdapterInvalidRequestError,
    AdapterProviderError,
    AdapterRateLimitError,
)
from src.providers.gemini_adapter import GeminiAdapter
from src.providers.types import GenerateRequest, ImagePart, TextPart


def fake_client(response_text: str = "ok", captured_calls: list | None = None):
    async def _generate_content(**kwargs):
        if captured_calls is not None:
            captured_calls.append(kwargs)
        return SimpleNamespace(text=response_text)

    models = SimpleNamespace(generate_content=AsyncMock(side_effect=_generate_content))
    return MagicMock(return_value=SimpleNamespace(aio=SimpleNamespace(models=models)))


@pytest.mark.asyncio
async def test_a_single_text_part_is_sent_as_a_plain_string():
    """Mirrors OpenAIAdapter's equivalent test — blueprint_agent.py's one
    TextPart becomes a bare string `contents`, not a Part/list wrapper."""
    captured = []
    with patch("src.providers.gemini_adapter.Client", fake_client("ok", captured)):
        adapter = GeminiAdapter(api_key="test-key")
        result = await adapter.generate(GenerateRequest(content=[TextPart("hello")], model="gemini-3.6-flash", temperature=0.2))

    assert result.text == "ok"
    assert captured[0]["contents"] == "hello"


@pytest.mark.asyncio
async def test_image_content_is_rejected_rather_than_silently_dropped():
    """No arbitrary-URL image support yet (see the adapter's module docstring)
    — must fail loudly, not send text-only and pretend the image was seen."""
    with patch("src.providers.gemini_adapter.Client", fake_client()):
        adapter = GeminiAdapter(api_key="test-key")
        with pytest.raises(AdapterInvalidRequestError):
            await adapter.generate(
                GenerateRequest(
                    content=[TextPart("Transcribe this."), ImagePart("https://example.test/page.png")],
                    model="gemini-3.6-flash",
                    temperature=0.0,
                )
            )


@pytest.mark.asyncio
async def test_model_and_temperature_are_forwarded_from_the_request_not_hardcoded():
    captured = []
    with patch("src.providers.gemini_adapter.Client", fake_client("ok", captured)):
        adapter = GeminiAdapter(api_key="test-key")
        await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gemini-registry-selected", temperature=0.37))

    assert captured[0]["model"] == "gemini-registry-selected"
    assert captured[0]["config"].temperature == 0.37


@pytest.mark.asyncio
async def test_max_tokens_is_forwarded_when_set():
    captured = []
    with patch("src.providers.gemini_adapter.Client", fake_client("ok", captured)):
        adapter = GeminiAdapter(api_key="test-key")
        await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gemini-3.6-flash", temperature=0.2, max_tokens=800))

    assert captured[0]["config"].max_output_tokens == 800


@pytest.mark.asyncio
async def test_max_tokens_is_omitted_entirely_when_not_set():
    captured = []
    with patch("src.providers.gemini_adapter.Client", fake_client("ok", captured)):
        adapter = GeminiAdapter(api_key="test-key")
        await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gemini-3.6-flash", temperature=0.0))

    assert captured[0]["config"].max_output_tokens is None


@pytest.mark.asyncio
async def test_empty_response_text_is_a_provider_error_not_a_silent_empty_string():
    with patch("src.providers.gemini_adapter.Client", fake_client(response_text=None)):
        adapter = GeminiAdapter(api_key="test-key")
        with pytest.raises(AdapterProviderError):
            await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gemini-3.6-flash", temperature=0.2))


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "vendor_exception,expected_adapter_error",
    [
        (lambda: ClientError(401, {"error": {"message": "bad key"}}), AdapterAuthError),
        (lambda: ClientError(403, {"error": {"message": "forbidden"}}), AdapterAuthError),
        (lambda: ClientError(429, {"error": {"message": "slow down"}}), AdapterRateLimitError),
        (lambda: ClientError(400, {"error": {"message": "malformed"}}), AdapterInvalidRequestError),
        (lambda: ClientError(404, {"error": {"message": "model retired"}}), AdapterInvalidRequestError),
        (lambda: ServerError(500, {"error": {"message": "provider down"}}), AdapterProviderError),
    ],
)
async def test_vendor_exceptions_are_normalized_with_the_original_preserved_as_cause(vendor_exception, expected_adapter_error):
    original = vendor_exception()
    models = SimpleNamespace(generate_content=AsyncMock(side_effect=original))
    client = MagicMock(return_value=SimpleNamespace(aio=SimpleNamespace(models=models)))

    with patch("src.providers.gemini_adapter.Client", client):
        adapter = GeminiAdapter(api_key="test-key")
        with pytest.raises(expected_adapter_error) as exc_info:
            await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gemini-3.6-flash", temperature=0.2))

    # Categorized, never swallowed: the real provider error is still reachable.
    assert exc_info.value.__cause__ is original
