from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.auth import verify_internal_token
from src.database import db
from src.ocr.ai_model_registry import resolve_ocr_model_version_id
from src.ocr.handwriting_ocr import NoExtractionResult, OCRExtractionResult, extract_text

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
    region = await db.pageregion.find_unique(where={"id": request.questionRegionId})
    if region is None:
        raise HTTPException(status_code=404, detail="Question region not found")

    block = await db.ocrblock.find_first(
        where={"questionRegionId": request.questionRegionId, "blockType": request.blockType}
    )
    if block is None:
        block = await db.ocrblock.create(
            data={
                "questionRegionId": request.questionRegionId,
                "blockType": request.blockType,
                "boundingBox": FULL_REGION_BOUNDING_BOX,
            }
        )

    ai_model_version_id = await resolve_ocr_model_version_id()

    try:
        extraction = await extract_text(request.imageUrl, request.blockType)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR extraction failed: {e}")

    if isinstance(extraction, NoExtractionResult):
        ocr_result = await db.ocrresult.create(
            data={
                "ocrBlockId": block.id,
                "extractedText": None,
                "confidence": 0.0,
                "requiresVisualEvaluation": True,
                "aiModelVersionId": ai_model_version_id,
            }
        )
    else:
        assert isinstance(extraction, OCRExtractionResult)
        ocr_result = await db.ocrresult.create(
            data={
                "ocrBlockId": block.id,
                "extractedText": extraction.extractedText,
                "confidence": extraction.confidence,
                "alternativeReadings": extraction.alternativeReadings,
                "aiModelVersionId": ai_model_version_id,
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
