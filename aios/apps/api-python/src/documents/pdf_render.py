"""Turns an uploaded PDF booklet into page images.

A scanned answer booklet usually arrives as one PDF, not as loose photographs.
Everything downstream (region marking, OCR crops, the checked copy) works on
page images, so the PDF is rendered once, here, and the rest of the pipeline is
untouched.

Rendered with pdfium (pypdfium2) — the same engine Chrome uses. Deliberately
strict about its input: a PDF is an untrusted file from a teacher's device.
"""

import base64
import io
import logging

import pypdfium2 as pdfium
from pydantic import BaseModel, Field

from src.image_fetch import ImageFetchError, fetch_bytes

logger = logging.getLogger(__name__)

PDF_MAGIC = b"%PDF-"
MAX_PDF_BYTES = 25 * 1024 * 1024
MAX_PAGES = 60
DEFAULT_DPI = 150
JPEG_QUALITY = 82
MAX_PAGE_SIDE = 2400


class PdfRenderRequest(BaseModel):
    pdfUrl: str
    dpi: int = Field(default=DEFAULT_DPI, ge=72, le=300)
    maxPages: int = Field(default=MAX_PAGES, ge=1, le=MAX_PAGES)


class RenderedPage(BaseModel):
    pageNumber: int
    width: int
    height: int
    imageBase64: str
    contentType: str = "image/jpeg"


class PdfRenderResult(BaseModel):
    pageCount: int
    pages: list[RenderedPage]


class PdfRenderError(Exception):
    """The file is not a PDF this service can render — a 422 for the caller, never a 500."""


def render_pdf_bytes(raw: bytes, dpi: int = DEFAULT_DPI, max_pages: int = MAX_PAGES) -> PdfRenderResult:
    if not raw.startswith(PDF_MAGIC):
        raise PdfRenderError("That file is not a PDF.")
    try:
        document = pdfium.PdfDocument(raw, autoclose=False)
    except pdfium.PdfiumError as e:
        # Password-protected and corrupt files both land here.
        raise PdfRenderError(f"This PDF could not be opened ({type(e).__name__}). If it is password-protected, remove the password and upload again.") from None

    try:
        page_count = len(document)
        if page_count == 0:
            raise PdfRenderError("This PDF has no pages.")
        if page_count > max_pages:
            raise PdfRenderError(f"This PDF has {page_count} pages; the limit is {max_pages}. Split it and upload the parts.")

        pages: list[RenderedPage] = []
        for index in range(page_count):
            page = document[index]
            try:
                image = page.render(scale=dpi / 72).to_pil().convert("RGB")
            except pdfium.PdfiumError as e:
                raise PdfRenderError(f"Page {index + 1} of this PDF could not be rendered ({type(e).__name__}).") from None
            image.thumbnail((MAX_PAGE_SIDE, MAX_PAGE_SIDE))
            buf = io.BytesIO()
            image.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
            pages.append(
                RenderedPage(
                    pageNumber=index + 1,
                    width=image.width,
                    height=image.height,
                    imageBase64=base64.b64encode(buf.getvalue()).decode(),
                )
            )
        return PdfRenderResult(pageCount=page_count, pages=pages)
    finally:
        document.close()


async def render_pdf(request: PdfRenderRequest) -> PdfRenderResult:
    try:
        raw = await fetch_bytes(request.pdfUrl, max_bytes=MAX_PDF_BYTES)
    except ImageFetchError as e:
        # Never echo the URL: it is a pre-signed storage URL.
        raise PdfRenderError(str(e)) from None
    return render_pdf_bytes(raw, dpi=request.dpi, max_pages=request.maxPages)
