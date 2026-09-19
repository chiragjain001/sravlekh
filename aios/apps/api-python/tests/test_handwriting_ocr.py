import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from src.config import Settings
from src.ocr.handwriting_ocr import (
    OCR_TEMPERATURE,
    NoExtractionResult,
    OCRExtractionResult,
    extract_text,
)
from src.providers.types import ImagePart, TextPart

SETTINGS_WITH_KEY = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="sk-test")

# P1 B1 Stage 3: `model` is now a required parameter — supplied by the router
# from the OCR registry, replacing the hardcoded "gpt-4o" literal.
REGISTRY_MODEL = "gpt-4o-registry-selected"


def mock_adapter(result_dict):
    """Fakes the ADAPTER, not ChatOpenAI — handwriting_ocr no longer constructs
    a vendor client, so the seam is OpenAIAdapter(...).generate(GenerateRequest)."""
    instance = SimpleNamespace(
        generate=AsyncMock(return_value=SimpleNamespace(text=json.dumps(result_dict)))
    )
    return MagicMock(return_value=instance)


@pytest.mark.asyncio
async def test_diagram_sketch_never_calls_the_llm():
    # No OPENAI_API_KEY patched in, no adapter mocked — if this reached the
    # provider call it would raise, proving the short-circuit actually short-circuits.
    result = await extract_text("https://example.com/img.png", "DIAGRAM_SKETCH", REGISTRY_MODEL)
    assert isinstance(result, NoExtractionResult)
    assert result.requires_visual_evaluation is True


@pytest.mark.asyncio
async def test_table_never_calls_the_llm():
    result = await extract_text("https://example.com/img.png", "TABLE", REGISTRY_MODEL)
    assert isinstance(result, NoExtractionResult)


@pytest.mark.asyncio
async def test_unknown_block_type_raises():
    with pytest.raises(ValueError, match="Unknown OCR block type"):
        await extract_text("https://example.com/img.png", "NOT_A_REAL_TYPE", REGISTRY_MODEL)


@pytest.mark.asyncio
async def test_missing_api_key_raises_for_a_real_block_type():
    settings = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="", GEMINI_API_KEY="")
    with patch("src.ocr.handwriting_ocr.get_settings", return_value=settings):
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            await extract_text("https://example.com/img.png", "HANDWRITTEN_TEXT", REGISTRY_MODEL)


# ---- P1 B1 Stage 3: multimodal request shape at the adapter boundary --------


@pytest.mark.asyncio
async def test_multimodal_request_shape_exactly_one_text_part_then_one_image_part():
    adapter_class = mock_adapter({"extractedText": "hello", "confidence": 0.9})
    with patch("src.ocr.handwriting_ocr.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.providers.factory.OpenAIAdapter", adapter_class):
        await extract_text("https://example.com/page.png", "HANDWRITTEN_TEXT", REGISTRY_MODEL)

    request = adapter_class.return_value.generate.await_args.args[0]

    assert len(request.content) == 2
    # Ordering matters: instruction text first, then the image.
    assert isinstance(request.content[0], TextPart)
    assert isinstance(request.content[1], ImagePart)
    assert sum(isinstance(p, TextPart) for p in request.content) == 1
    assert sum(isinstance(p, ImagePart) for p in request.content) == 1
    assert request.content[1].image_url == "https://example.com/page.png"


@pytest.mark.asyncio
async def test_request_carries_the_registry_model_correct_temperature_and_no_max_tokens():
    adapter_class = mock_adapter({"extractedText": "hello", "confidence": 0.9})
    with patch("src.ocr.handwriting_ocr.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.providers.factory.OpenAIAdapter", adapter_class):
        await extract_text("https://example.com/page.png", "HANDWRITTEN_TEXT", REGISTRY_MODEL)

    request = adapter_class.return_value.generate.await_args.args[0]

    assert request.model == REGISTRY_MODEL       # registry-selected, not hardcoded
    assert request.model != "gpt-4o"             # the old literal specifically
    assert request.temperature == OCR_TEMPERATURE == 0.0
    # OCR never set max_tokens before the migration and must not start now —
    # None means "omit entirely" at the adapter, verified in test_openai_adapter.
    assert request.max_tokens is None


@pytest.mark.asyncio
async def test_prompt_text_still_combines_the_block_type_instruction_and_format_instructions():
    """OCR prompt behavior preserved: the text part is the same
    "<block prompt>\\n\\n<format instructions>" string as before the migration."""
    adapter_class = mock_adapter({"extractedText": "x", "confidence": 0.9})
    with patch("src.ocr.handwriting_ocr.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.providers.factory.OpenAIAdapter", adapter_class):
        await extract_text("https://example.com/page.png", "HANDWRITTEN_TEXT", REGISTRY_MODEL)

    text = adapter_class.return_value.generate.await_args.args[0].content[0].text
    assert "handwritten answer region" in text          # the HANDWRITTEN_TEXT prompt
    assert "[illegible]" in text                        # its distinctive instruction
    assert "json" in text.lower()                       # parser format instructions appended


@pytest.mark.asyncio
async def test_each_block_type_sends_its_own_instruction_text():
    for block_type, marker in [
        ("PRINTED_TEXT", "printed/typed text region"),
        ("HANDWRITTEN_TEXT", "handwritten answer region"),
        ("MATHEMATICAL_EXPRESSION", "LaTeX notation"),
    ]:
        adapter_class = mock_adapter({"extractedText": "x", "confidence": 0.9})
        with patch("src.ocr.handwriting_ocr.get_settings", return_value=SETTINGS_WITH_KEY), \
             patch("src.providers.factory.OpenAIAdapter", adapter_class):
            await extract_text("https://example.com/page.png", block_type, REGISTRY_MODEL)

        text = adapter_class.return_value.generate.await_args.args[0].content[0].text
        assert marker in text, f"{block_type} did not send its own instruction"


@pytest.mark.asyncio
async def test_adapter_response_is_parsed_into_an_ocr_extraction_result():
    """Parsing stays above the adapter — the adapter returns raw text."""
    adapter_class = mock_adapter({"extractedText": "transcribed", "confidence": 0.42})
    with patch("src.ocr.handwriting_ocr.get_settings", return_value=SETTINGS_WITH_KEY), \
         patch("src.providers.factory.OpenAIAdapter", adapter_class):
        result = await extract_text("https://example.com/page.png", "HANDWRITTEN_TEXT", REGISTRY_MODEL)

    assert isinstance(result, OCRExtractionResult)
    assert result.extractedText == "transcribed"
    # Confidence passes through untouched — D2's <0.5 routing is applied
    # downstream in ai_evaluator, not here.
    assert result.confidence == 0.42
