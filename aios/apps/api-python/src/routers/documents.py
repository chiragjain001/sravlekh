import anyio
from fastapi import APIRouter, Depends, HTTPException
from src.auth import verify_internal_token
from src.documents.pdf_render import PdfRenderError, PdfRenderRequest, render_pdf
from src.documents.region_detect import RegionDetectRequest, detect_regions
from src.documents.segment_and_omr import BulkSegmentRequest, segment_pdf_pages, MAX_PDF_BYTES, PDF_MAGIC
from src.image_fetch import fetch_bytes, ImageFetchError
import pypdfium2 as pdfium
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


@router.post("/segment-bulk-booklets", dependencies=[Depends(verify_internal_token)])
async def segment_bulk_booklets_route(request: BulkSegmentRequest):
    """Internal-only. Segments a bulk multi-booklet PDF scan by detecting cover QR codes
    and reads the roll-number bubble grids on each detected cover.
    """
    try:
        raw = await fetch_bytes(request.pdfUrl, max_bytes=MAX_PDF_BYTES)
    except ImageFetchError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None

    if not raw.startswith(PDF_MAGIC):
        raise HTTPException(status_code=422, detail="That file is not a valid PDF.")

    try:
        doc = pdfium.PdfDocument(raw, autoclose=False)
    except pdfium.PdfiumError as e:
        raise HTTPException(status_code=422, detail=f"PDF could not be opened: {str(e)}") from None

    try:
        result = await anyio.to_thread.run_sync(segment_pdf_pages, doc, request.dpi, request.maxPages)
        return {"success": True, "data": result.model_dump()}
    finally:
        doc.close()


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
