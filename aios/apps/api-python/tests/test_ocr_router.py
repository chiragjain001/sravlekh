from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.ocr.handwriting_ocr import NoExtractionResult, OCRExtractionResult
from src.routers.ocr import OCRExtractRequest, extract


def make_db(existing_block=None):
    def create_ocr_result(data):
        # Mirrors real Prisma behavior: an unset nullable field (alternativeReadings
        # is omitted from the create() payload on the NoExtractionResult path) still
        # comes back as None on the returned row, not a missing attribute.
        return SimpleNamespace(id="result-1", **{"alternativeReadings": None, **data})

    return SimpleNamespace(
        pageregion=SimpleNamespace(find_unique=AsyncMock(return_value=SimpleNamespace(id="region-1"))),
        ocrblock=SimpleNamespace(
            find_first=AsyncMock(return_value=existing_block),
            create=AsyncMock(return_value=SimpleNamespace(id="block-new")),
        ),
        ocrresult=SimpleNamespace(create=AsyncMock(side_effect=create_ocr_result)),
    )


@pytest.mark.asyncio
async def test_404s_when_the_region_does_not_exist():
    fake_db = SimpleNamespace(pageregion=SimpleNamespace(find_unique=AsyncMock(return_value=None)))
    with patch("src.routers.ocr.db", fake_db):
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_creates_a_new_ocr_block_when_none_exists_for_this_block_type():
    fake_db = make_db(existing_block=None)
    with patch("src.routers.ocr.db", fake_db), \
         patch("src.routers.ocr.resolve_ocr_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hello", confidence=0.9))):
        result = await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    fake_db.ocrblock.create.assert_awaited_once()
    assert result["data"]["extractedText"] == "hello"
    assert result["data"]["confidence"] == 0.9


@pytest.mark.asyncio
async def test_reuses_an_existing_ocr_block_for_the_same_region_and_type():
    fake_db = make_db(existing_block=SimpleNamespace(id="block-existing"))
    with patch("src.routers.ocr.db", fake_db), \
         patch("src.routers.ocr.resolve_ocr_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hi", confidence=0.7))):
        await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    fake_db.ocrblock.create.assert_not_awaited()
    fake_db.ocrresult.create.assert_awaited_once()
    assert fake_db.ocrresult.create.await_args.kwargs["data"]["ocrBlockId"] == "block-existing"


@pytest.mark.asyncio
async def test_diagram_block_stores_requires_visual_evaluation_with_no_text():
    fake_db = make_db(existing_block=None)
    with patch("src.routers.ocr.db", fake_db), \
         patch("src.routers.ocr.resolve_ocr_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=NoExtractionResult())):
        await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="DIAGRAM_SKETCH"))

    created_data = fake_db.ocrresult.create.await_args.kwargs["data"]
    assert created_data["extractedText"] is None
    assert created_data["requiresVisualEvaluation"] is True


@pytest.mark.asyncio
async def test_extraction_failure_surfaces_as_a_500_not_an_unhandled_exception():
    fake_db = make_db(existing_block=None)
    with patch("src.routers.ocr.db", fake_db), \
         patch("src.routers.ocr.resolve_ocr_model_version_id", AsyncMock(return_value="mv-1")), \
         patch("src.routers.ocr.extract_text", AsyncMock(side_effect=RuntimeError("vision API down"))):
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))
    assert exc_info.value.status_code == 500
