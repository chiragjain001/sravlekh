from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from src.ocr.handwriting_ocr import NoExtractionResult, OCRExtractionResult
from src.routers.ocr import OCRExtractRequest, extract

# P1 B1 Stage 3: the router now resolves the ACTIVE AIModelVersion row (not just
# an id for persistence) and passes its .versionLabel down as the model actually
# used, while stamping .id onto OCRResult — one resolution, used for both.
ACTIVE_VERSION = SimpleNamespace(id="mv-1", versionLabel="gpt-4o-registry-selected")


def make_region(institute_id="inst-1", has_bundle=True):
    """C3: the real query includes the document->bundle->delivery->assessment
    chain used to verify the region's institute. has_bundle=False models a
    Document not yet linked to a DocumentBundle (Document.documentBundleId is
    nullable in the schema)."""
    bundle = None
    if has_bundle:
        bundle = SimpleNamespace(
            assessmentDelivery=SimpleNamespace(assessment=SimpleNamespace(instituteId=institute_id))
        )
    return SimpleNamespace(
        id="region-1",
        pageImage=SimpleNamespace(page=SimpleNamespace(document=SimpleNamespace(documentBundle=bundle))),
    )


def make_db(existing_block=None, region=None):
    def create_ocr_result(data):
        # Mirrors real Prisma behavior: an unset nullable field (alternativeReadings
        # is omitted from the create() payload on the NoExtractionResult path) still
        # comes back as None on the returned row, not a missing attribute.
        return SimpleNamespace(id="result-1", **{"alternativeReadings": None, **data})

    return SimpleNamespace(
        pageregion=SimpleNamespace(find_unique=AsyncMock(return_value=region if region is not None else make_region())),
        ocrblock=SimpleNamespace(
            find_first=AsyncMock(return_value=existing_block),
            create=AsyncMock(return_value=SimpleNamespace(id="block-new")),
        ),
        ocrresult=SimpleNamespace(create=AsyncMock(side_effect=create_ocr_result)),
    )


def patch_registry(version=ACTIVE_VERSION):
    """Both halves of the registry resolution, as the router now calls them."""
    return (
        patch("src.routers.ocr.resolve_ocr_ai_model_id", AsyncMock(return_value="model-1")),
        patch("src.routers.ocr.resolve_active_ocr_model_version", AsyncMock(return_value=version)),
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
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hello", confidence=0.9))):
        result = await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    fake_db.ocrblock.create.assert_awaited_once()
    assert result["data"]["extractedText"] == "hello"
    assert result["data"]["confidence"] == 0.9


@pytest.mark.asyncio
async def test_reuses_an_existing_ocr_block_for_the_same_region_and_type():
    fake_db = make_db(existing_block=SimpleNamespace(id="block-existing"))
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hi", confidence=0.7))):
        await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    fake_db.ocrblock.create.assert_not_awaited()
    fake_db.ocrresult.create.assert_awaited_once()
    assert fake_db.ocrresult.create.await_args.kwargs["data"]["ocrBlockId"] == "block-existing"


@pytest.mark.asyncio
async def test_diagram_block_stores_requires_visual_evaluation_with_no_text():
    fake_db = make_db(existing_block=None)
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=NoExtractionResult())):
        await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="DIAGRAM_SKETCH"))

    created_data = fake_db.ocrresult.create.await_args.kwargs["data"]
    assert created_data["extractedText"] is None
    assert created_data["requiresVisualEvaluation"] is True


@pytest.mark.asyncio
async def test_same_tenant_request_succeeds():  # C3 regression: matching instituteId is unaffected
    fake_db = make_db(existing_block=None, region=make_region(institute_id="inst-1"))
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hello", confidence=0.9))):
        result = await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    assert result["data"]["extractedText"] == "hello"


@pytest.mark.asyncio
async def test_c3_rejects_a_region_belonging_to_a_different_institute():
    fake_db = make_db(existing_block=None, region=make_region(institute_id="inst-OTHER"))
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hello", confidence=0.9))) as extract_mock:
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    assert exc_info.value.status_code == 404
    fake_db.ocrblock.find_first.assert_not_called()
    fake_db.ocrresult.create.assert_not_called()
    extract_mock.assert_not_called()


@pytest.mark.asyncio
async def test_c3_rejects_a_region_whose_document_has_no_bundle_yet():
    # documentBundleId is nullable — must fail closed (404), not crash on None.
    fake_db = make_db(existing_block=None, region=make_region(has_bundle=False))
    with patch("src.routers.ocr.db", fake_db):
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_extraction_failure_surfaces_as_a_500_not_an_unhandled_exception():
    fake_db = make_db(existing_block=None)
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(side_effect=RuntimeError("vision API down"))):
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))
    assert exc_info.value.status_code == 500


@pytest.mark.asyncio
async def test_extraction_failure_does_not_echo_the_provider_message_to_the_caller():
    """Regression: the detail used to be f"OCR extraction failed: {e}". A vendor
    auth error's message carries the org id, a request id and a redacted key; a
    provider error on a signed S3 URL can echo the URL with its signature. This
    route is internal-only, but NestJS forwards job failures into dead-letter
    reports and Sentry — a far wider audience than the secret store."""
    fake_db = make_db(existing_block=None)
    reg_model, reg_version = patch_registry()
    leaky = RuntimeError(
        "Incorrect API key provided: sk-proj-AbC1********xyz, org: org-aios-prod-9931, "
        "request_id: req_7f3a1 while fetching "
        "https://bucket.s3.amazonaws.com/inst-1/page.png?X-Amz-Signature=deadbeefcafe"
    )
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version,          patch("src.routers.ocr.extract_text", AsyncMock(side_effect=leaky)):
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    detail = str(exc_info.value.detail)
    for secret in ("sk-proj", "org-aios-prod-9931", "req_7f3a1", "X-Amz-Signature"):
        assert secret not in detail, f"leaked {secret!r}: {detail!r}"


# ---- P1 B1 Stage 3: registry wiring ----------------------------------------
# The defect being closed: resolve_ocr_model_version_id() previously returned an
# id used ONLY to stamp OCRResult.aiModelVersionId, while handwriting_ocr.py
# separately hardcoded model="gpt-4o" — so deactivating a version changed
# nothing about which model actually ran.


@pytest.mark.asyncio
async def test_registry_selected_model_is_the_one_passed_to_extraction():
    fake_db = make_db(existing_block=None)
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hi", confidence=0.9))) as extract_mock:
        await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    # Third positional arg is the model — the registry's versionLabel, never a literal.
    assert extract_mock.await_args.args[2] == "gpt-4o-registry-selected"


@pytest.mark.asyncio
async def test_persisted_model_version_id_is_the_same_row_that_was_used_for_extraction():
    """One resolution, used for both execution and audit — they cannot describe
    different rows."""
    fake_db = make_db(existing_block=None)
    reg_model, reg_version = patch_registry()
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock(return_value=OCRExtractionResult(extractedText="hi", confidence=0.9))) as extract_mock:
        await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    persisted = fake_db.ocrresult.create.await_args.kwargs["data"]
    assert persisted["aiModelVersionId"] == ACTIVE_VERSION.id
    assert extract_mock.await_args.args[2] == ACTIVE_VERSION.versionLabel


@pytest.mark.asyncio
async def test_no_active_ocr_model_fails_explicitly_without_calling_the_provider():
    """Required invariant: no active version -> explicit safe failure, no
    hardcoded fallback, and no extraction attempt at all."""
    fake_db = make_db(existing_block=None)
    reg_model, reg_version = patch_registry(version=None)
    with patch("src.routers.ocr.db", fake_db), reg_model, reg_version, \
         patch("src.routers.ocr.extract_text", AsyncMock()) as extract_mock:
        with pytest.raises(HTTPException) as exc_info:
            await extract(OCRExtractRequest(instituteId="inst-1", questionRegionId="region-1", imageUrl="https://x/img.png", blockType="HANDWRITTEN_TEXT"))

    assert exc_info.value.status_code == 503
    assert "No active OCR AI model is configured" in exc_info.value.detail
    extract_mock.assert_not_called()
    # No orphan OCRBlock left behind by a deconfigured registry.
    fake_db.ocrblock.create.assert_not_awaited()
    fake_db.ocrresult.create.assert_not_called()
