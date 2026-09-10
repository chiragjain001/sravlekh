import logging

from fastapi import APIRouter, Depends, HTTPException
from prisma import Json
from pydantic import BaseModel

from src.auth import verify_internal_token
from src.database import db
from src.ocr.ai_model_registry import resolve_active_ocr_model_version, resolve_ocr_ai_model_id
from src.ocr.handwriting_ocr import NoExtractionResult, OCRExtractionResult, extract_text

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR / Handwriting"])


class OCRExtractRequest(BaseModel):
    instituteId: str
    questionRegionId: str
    imageUrl: str
    blockType: str


FULL_REGION_BOUNDING_BOX = {"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}


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
    # Previously this resolved only an id for persistence while handwriting_ocr.py
    # separately hardcoded "gpt-4o", which is what made the registry decorative.
    #
    # Resolved BEFORE the OCRBlock write (it used to come after) so a deconfigured
    # registry fails without leaving an orphan block behind. Success-path ordering
    # of the writes themselves is unchanged.
    ai_model_id = await resolve_ocr_ai_model_id()
    ai_model_version = await resolve_active_ocr_model_version(ai_model_id)
    if ai_model_version is None:
        # Explicit, safe failure — never a hardcoded fallback model. An admin
        # deactivating every OCR version is an instruction to stop, and 503 says
        # "correctly configured request, service not currently able to serve it",
        # distinct from the 404s above and the 500 for a genuine extraction fault.
        raise HTTPException(
            status_code=503,
            detail="No active OCR AI model is configured. Ask an administrator to activate one.",
        )

    block = await db.ocrblock.find_first(
        where={"questionRegionId": request.questionRegionId, "blockType": request.blockType}
    )
    if block is None:
        block = await db.ocrblock.create(
            data={
                "questionRegionId": request.questionRegionId,
                "blockType": request.blockType,
                # Pre-existing bug, found and fixed while verifying C3 against a real
                # database: a bare dict is rejected by prisma-client-py for a Json
                # column ("should be of any of the following types: Json") — the same
                # class of defect P0 found and fixed in ai_evaluator.py. Never caught
                # here because no test in this file exercises a real query engine;
                # this is the "creates a new OCRBlock" path, hit on every region's
                # first extraction.
                "boundingBox": Json(FULL_REGION_BOUNDING_BOX),
            }
        )

    try:
        extraction = await extract_text(request.imageUrl, request.blockType, ai_model_version.versionLabel)
    except Exception:
        # The exception text used to be interpolated straight into the response
        # body. `e` here is typically a normalized AdapterError wrapping a vendor
        # SDK exception whose message carries the model name, organisation id,
        # request id and a partially-redacted API key — and for an S3-signed
        # imageUrl, provider errors can echo the URL itself, signature included.
        # This route is internal-only, so it was a caller-to-caller disclosure
        # rather than a public one, but the NestJS side propagates job errors into
        # dead-letter reports and Sentry, which is a much wider audience than the
        # secret store those values came from. Logged here, with the traceback, so
        # nothing is lost.
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
                # Pre-existing bug, found and fixed while verifying C3 against a real
                # database: alternativeReadings is a nullable Json column, and
                # prisma-client-py rejects an explicit None for one — the key must be
                # omitted entirely, same rule (and same fix shape) as
                # ai_evaluator.py's suggestedCriterionScores from P0. Never caught
                # here because no test in this file exercises a real query engine.
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
