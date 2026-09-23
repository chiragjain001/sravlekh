from fastapi import APIRouter, Depends, HTTPException

from src.auth import verify_internal_token
from src.documents.pdf_render import PdfRenderError, PdfRenderRequest, render_pdf
from src.documents.region_detect import RegionDetectRequest, detect_regions
from src.providers.errors import AdapterRateLimitError
from src.routers.http_errors import rate_limited

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/render-pdf", dependencies=[Depends(verify_internal_token)])
async def render_pdf_route(request: PdfRenderRequest):
    """Internal-only. Renders an uploaded PDF booklet into page images; NestJS
    (DocumentsService.splitPdfDocument) stores them as this document's pages.

    A rejected PDF is a 422 the teacher can act on ("password-protected",
    "too many pages"), never a 500 the queue would retry pointlessly.
    """
    try:
        result = await render_pdf(request)
    except PdfRenderError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None
    return {"success": True, "data": result.model_dump()}


@router.post("/detect-regions", dependencies=[Depends(verify_internal_token)])
async def detect_regions_route(request: RegionDetectRequest):
    """Internal-only. Suggests answer regions for one page image. Suggestions,
    not decisions: the teacher confirms, corrects or deletes every box, and a
    low-confidence box comes back unmapped."""
    try:
        suggestions = await detect_regions(request)
    except AdapterRateLimitError as e:
        # Caller waits and retries this page rather than losing its suggestions.
        raise rate_limited(e) from None
    return {"success": True, "data": [s.model_dump() for s in suggestions]}
