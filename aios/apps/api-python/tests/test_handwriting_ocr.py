from unittest.mock import patch

import pytest

from src.config import Settings
from src.ocr.handwriting_ocr import NoExtractionResult, extract_text


@pytest.mark.asyncio
async def test_diagram_sketch_never_calls_the_llm():
    # No OPENAI_API_KEY patched in, no ChatOpenAI mocked — if this reached the
    # LLM call it would raise, proving the short-circuit actually short-circuits.
    result = await extract_text("https://example.com/img.png", "DIAGRAM_SKETCH")
    assert isinstance(result, NoExtractionResult)
    assert result.requires_visual_evaluation is True


@pytest.mark.asyncio
async def test_table_never_calls_the_llm():
    result = await extract_text("https://example.com/img.png", "TABLE")
    assert isinstance(result, NoExtractionResult)


@pytest.mark.asyncio
async def test_unknown_block_type_raises():
    with pytest.raises(ValueError, match="Unknown OCR block type"):
        await extract_text("https://example.com/img.png", "NOT_A_REAL_TYPE")


@pytest.mark.asyncio
async def test_missing_api_key_raises_for_a_real_block_type():
    settings = Settings(DATABASE_URL="postgresql://x", JWT_SECRET="x" * 32, OPENAI_API_KEY="")
    with patch("src.ocr.handwriting_ocr.get_settings", return_value=settings):
        with pytest.raises(ValueError, match="OPENAI_API_KEY"):
            await extract_text("https://example.com/img.png", "HANDWRITTEN_TEXT")
