from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import openai
import pytest

from src.providers.errors import (
    AdapterAuthError,
    AdapterInvalidRequestError,
    AdapterProviderError,
    AdapterRateLimitError,
)
from src.providers.openai_adapter import OpenAIAdapter
from src.providers.types import GenerateRequest, ImagePart, TextPart


def fake_chat_openai(content: str, captured_kwargs: list | None = None):
    def _ctor(**kwargs):
        if captured_kwargs is not None:
            captured_kwargs.append(kwargs)
        return SimpleNamespace(ainvoke=AsyncMock(return_value=SimpleNamespace(content=content)))
    return MagicMock(side_effect=_ctor)


@pytest.mark.asyncio
async def test_a_single_text_part_is_sent_as_a_plain_string_not_a_one_item_list():
    """Matches ai_evaluator.py/blueprint_agent.py's current HumanMessage(content=
    prompt_text) shape exactly — a real behavior-preservation requirement for
    Stage 2/4, not a style preference."""
    captured_messages = []

    def capture_ainvoke(messages):
        captured_messages.append(messages)
        return SimpleNamespace(content="ok")

    chat_openai = MagicMock(return_value=SimpleNamespace(ainvoke=AsyncMock(side_effect=capture_ainvoke)))
    with patch("src.providers.openai_adapter.ChatOpenAI", chat_openai):
        adapter = OpenAIAdapter(api_key="sk-test")
        result = await adapter.generate(GenerateRequest(content=[TextPart("hello")], model="gpt-4o", temperature=0.2))

    assert result.text == "ok"
    sent_message = captured_messages[0][0]
    assert sent_message.content == "hello"  # plain string, not [{"type": "text", ...}]


@pytest.mark.asyncio
async def test_text_plus_image_parts_are_sent_as_the_multimodal_list_shape():
    """OCR's real shape: HumanMessage(content=[{"type": "text", ...}, {"type":
    "image_url", ...}])."""
    captured_messages = []

    def capture_ainvoke(messages):
        captured_messages.append(messages)
        return SimpleNamespace(content="transcribed text")

    chat_openai = MagicMock(return_value=SimpleNamespace(ainvoke=AsyncMock(side_effect=capture_ainvoke)))
    with patch("src.providers.openai_adapter.ChatOpenAI", chat_openai):
        adapter = OpenAIAdapter(api_key="sk-test")
        result = await adapter.generate(
            GenerateRequest(
                content=[TextPart("Transcribe this."), ImagePart("https://example.test/page.png")],
                model="gpt-4o",
                temperature=0.0,
            )
        )

    assert result.text == "transcribed text"
    sent_content = captured_messages[0][0].content
    assert sent_content == [
        {"type": "text", "text": "Transcribe this."},
        {"type": "image_url", "image_url": {"url": "https://example.test/page.png"}},
    ]


@pytest.mark.asyncio
async def test_model_and_temperature_are_forwarded_from_the_request_not_hardcoded():
    captured_kwargs = []
    chat_openai = fake_chat_openai("ok", captured_kwargs)
    with patch("src.providers.openai_adapter.ChatOpenAI", chat_openai):
        adapter = OpenAIAdapter(api_key="sk-test")
        await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gpt-4o-registry-selected", temperature=0.37))

    assert captured_kwargs[0]["model"] == "gpt-4o-registry-selected"
    assert captured_kwargs[0]["temperature"] == 0.37
    assert captured_kwargs[0]["api_key"] == "sk-test"


@pytest.mark.asyncio
async def test_max_tokens_is_forwarded_when_set():
    captured_kwargs = []
    chat_openai = fake_chat_openai("ok", captured_kwargs)
    with patch("src.providers.openai_adapter.ChatOpenAI", chat_openai):
        adapter = OpenAIAdapter(api_key="sk-test")
        await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gpt-4o", temperature=0.2, max_tokens=800))

    assert captured_kwargs[0]["max_tokens"] == 800


@pytest.mark.asyncio
async def test_max_tokens_is_omitted_entirely_when_not_set():
    """Matches OCR/Blueprint's current behavior, which never passes max_tokens
    at all — omitted, not passed as None (a real SDK could treat those
    differently)."""
    captured_kwargs = []
    chat_openai = fake_chat_openai("ok", captured_kwargs)
    with patch("src.providers.openai_adapter.ChatOpenAI", chat_openai):
        adapter = OpenAIAdapter(api_key="sk-test")
        await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gpt-4o", temperature=0.0))

    assert "max_tokens" not in captured_kwargs[0]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "vendor_exception,expected_adapter_error",
    [
        (lambda: openai.AuthenticationError("bad key", response=MagicMock(), body=None), AdapterAuthError),
        (lambda: openai.RateLimitError("slow down", response=MagicMock(), body=None), AdapterRateLimitError),
        (lambda: openai.BadRequestError("malformed", response=MagicMock(), body=None), AdapterInvalidRequestError),
        (lambda: openai.InternalServerError("provider down", response=MagicMock(), body=None), AdapterProviderError),
    ],
)
async def test_vendor_exceptions_are_normalized_with_the_original_preserved_as_cause(vendor_exception, expected_adapter_error):
    original = vendor_exception()
    chat_openai = MagicMock(return_value=SimpleNamespace(ainvoke=AsyncMock(side_effect=original)))
    with patch("src.providers.openai_adapter.ChatOpenAI", chat_openai):
        adapter = OpenAIAdapter(api_key="sk-test")
        with pytest.raises(expected_adapter_error) as exc_info:
            await adapter.generate(GenerateRequest(content=[TextPart("x")], model="gpt-4o", temperature=0.2))

    # Categorized, never swallowed: the real provider error is still reachable.
    assert exc_info.value.__cause__ is original
