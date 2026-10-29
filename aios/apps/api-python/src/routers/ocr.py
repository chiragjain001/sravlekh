import logging

from fastapi import APIRouter, Depends, HTTPException
from prisma import Json
from pydantic import BaseModel

from src.auth import verify_internal_token
from src.config import get_settings
from src.database import db
from src.ocr.ai_model_registry import resolve_active_ocr_model_version, resolve_ocr_ai_model_id
from src.ocr.handwriting_ocr import NoExtractionResult, OCRExtractionResult, extract_text
from src.ocr.region_box import as_box, same_box
from src.providers.errors import AdapterRateLimitError
from src.providers.factory import active_provider
from src.routers.http_errors import rate_limited

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR / Handwriting"])


class OCRExtractRequest(BaseModel):
    instituteId: str
    questionRegionId: str
    imageUrl: str
    blockType: str


@router.post("/extract", dependencies=[Depends(verify_internal_token)])
async def extract(request: OCRExtractRequest):
    """Internal-only (05-API-SPECIFICATION.md V2 section §10): called by
    apps/api's ocr-queue processor after a region is confirmed mapped to a
    question. 24-OCR-HANDWRITING-ARCHITECTURE.md §6: OCRResult is always a
    new insert, never an overwrite — re-extraction/correction stays
    auditable against the original machine reading."""
    region = await db.pageregion.find_unique(
        where={"id": request.questionRegionId},
        include={
            "pageImage": {
                "include": {
                    "page": {
                        "include": {
                            "document": {"include": {"documentBundle": {"include": {"assessmentDelivery": {"include": {"assessment": True}}}}}}
                        }
                    }
                }
            }
        },
    )
    if region is None:
        raise HTTPException(status_code=404, detail="Question region not found")

    # C3: instituteId is accepted from the (internal-only) caller and, until now,
    # never checked. The NestJS caller (ocr.service.ts's enqueueForDocument)
    # already validates this exact same document->bundle->delivery->assessment
    # chain before enqueueing — this is defense-in-depth against a future/buggy
    # caller, not a fix for an active leak. Cross-tenant is indistinguishable from
    # missing, matching the Node-side convention.
    bundle = region.pageImage.page.document.documentBundle
    if bundle is None or bundle.assessmentDelivery.assessment.instituteId != request.instituteId:
        raise HTTPException(status_code=404, detail="Question region not found")

    # P1 B1 Stage 3: resolved ONCE, here, and used for both the actual provider
    # call (.versionLabel) and the persisted audit FK (.id) — so the model that
    # ran and the model that was recorded are the same row by construction.
    provider = active_provider(get_settings(), purpose="ocr")
    ai_model_id = await resolve_ocr_ai_model_id(provider.provider_name, provider.model_name)
    ai_model_version = await resolve_active_ocr_model_version(ai_model_id, provider.model_name)
    if ai_model_version is None:
        raise HTTPException(
            status_code=503,
            detail="No active OCR AI model is configured. Ask an administrator to activate one.",
        )

    # The box this reading belongs to. A region the teacher has since moved or
    # resized gets its OWN block, so an old transcript can never be presented as
    # evidence for a box it was not read from (see ocr/region_box.py).
    region_box = as_box(region.boundingBox)
    if region_box is None:
        raise HTTPException(status_code=422, detail="This region has no usable bounding box.")

    blocks = await db.ocrblock.find_many(
        where={"questionRegionId": request.questionRegionId, "blockType": request.blockType}
    )
    block = next((b for b in blocks if same_box(b.boundingBox, region_box)), None)
    if block is None:
        block = await db.ocrblock.create(
            data={
                "questionRegionId": request.questionRegionId,
                "blockType": request.blockType,
                "boundingBox": Json(region_box),
            }
        )
    else:
        # Phase 2 Requirement 6.1: Reuse successful OCR results on retries rather
        # than re-extracting with another billable LLM vision call
        find_first_ocr = getattr(db.ocrresult, "find_first", None)
        if find_first_ocr is not None:
            existing_result = await find_first_ocr(
                where={"ocrBlockId": block.id, "aiModelVersionId": ai_model_version.id},
                order={"createdAt": "desc"},
            )
            if existing_result is not None:
                logger.info("Reusing existing OCRResult %s for block %s", existing_result.id, block.id)
                return {
                    "success": True,
                    "data": {
                        "ocrResultId": existing_result.id,
                        "extractedText": existing_result.extractedText,
                        "confidence": existing_result.confidence,
                        "alternativeReadings": existing_result.alternativeReadings,
                        "reused": True,
                    },
                }

    try:
        extraction = await extract_text(request.imageUrl, request.blockType, ai_model_version.versionLabel, crop=region_box)
    except AdapterRateLimitError as e:
        logger.warning("OCR rate-limited by the provider for region %s", request.questionRegionId)
        raise rate_limited(e) from None
    except Exception:
        logger.exception(
            "OCR extraction failed for region %s (model %s)",
            request.questionRegionId,
            ai_model_version.versionLabel,
        )
        raise HTTPException(status_code=500, detail="OCR extraction failed.")

    if isinstance(extraction, NoExtractionResult):
        ocr_result = await db.ocrresult.create(
            data={
                "ocrBlockId": block.id,
                "extractedText": None,
                "confidence": 0.0,
                "requiresVisualEvaluation": True,
                "aiModelVersionId": ai_model_version.id,
            }
        )
    else:
        assert isinstance(extraction, OCRExtractionResult)
        ocr_result = await db.ocrresult.create(
            data={
                "ocrBlockId": block.id,
                "extractedText": extraction.extractedText,
                "confidence": extraction.confidence,
                "aiModelVersionId": ai_model_version.id,
                **({"alternativeReadings": Json(extraction.alternativeReadings)} if extraction.alternativeReadings is not None else {}),
            }
        )

    return {
        "success": True,
        "data": {
            "ocrResultId": ocr_result.id,
            "extractedText": ocr_result.extractedText,
            "confidence": ocr_result.confidence,
            "alternativeReadings": ocr_result.alternativeReadings,
        },
    }
