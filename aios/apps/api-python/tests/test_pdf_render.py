import base64
import io

import pytest
from fpdf import FPDF
from PIL import Image

from src.documents.pdf_render import PdfRenderError, PdfRenderRequest, render_pdf, render_pdf_bytes


def sample_pdf(pages=2, text="Q1) Answer") -> bytes:
    pdf = FPDF(unit="pt", format="A4")
    pdf.add_font("body", "", r"C:\Windows\Fonts\arial.ttf") if False else None
    pdf.set_font("helvetica", size=24)
    for i in range(pages):
        pdf.add_page()
        pdf.cell(200, 40, f"{text} page {i + 1}")
    return bytes(pdf.output())


def data_url(raw: bytes) -> str:
    return "data:application/pdf;base64," + base64.b64encode(raw).decode()


def test_every_page_becomes_an_image():
    result = render_pdf_bytes(sample_pdf(pages=3))
    assert result.pageCount == 3
    assert [p.pageNumber for p in result.pages] == [1, 2, 3]
    for page in result.pages:
        image = Image.open(io.BytesIO(base64.b64decode(page.imageBase64)))
        assert image.format == "JPEG"
        assert (image.width, image.height) == (page.width, page.height)
        assert image.height > image.width  # A4 portrait survives the render


def test_a_file_that_is_not_a_pdf_is_refused_with_a_message_not_a_crash():
    with pytest.raises(PdfRenderError, match="not a PDF"):
        render_pdf_bytes(b"\x89PNG\r\n\x1a\n not a pdf at all")


def test_a_corrupt_pdf_is_refused():
    with pytest.raises(PdfRenderError):
        render_pdf_bytes(b"%PDF-1.7\nthis is truncated garbage")


def test_a_pdf_with_more_pages_than_allowed_is_refused_with_the_limit():
    with pytest.raises(PdfRenderError, match="the limit is 2"):
        render_pdf_bytes(sample_pdf(pages=3), max_pages=2)


def test_render_scale_follows_dpi():
    small = render_pdf_bytes(sample_pdf(pages=1), dpi=72).pages[0]
    large = render_pdf_bytes(sample_pdf(pages=1), dpi=150).pages[0]
    assert large.width > small.width


@pytest.mark.asyncio
async def test_renders_from_a_url():
    result = await render_pdf(PdfRenderRequest(pdfUrl=data_url(sample_pdf(pages=1))))
    assert result.pageCount == 1


@pytest.mark.asyncio
async def test_an_unfetchable_url_is_a_render_error_without_leaking_the_url():
    with pytest.raises(PdfRenderError) as exc:
        await render_pdf(PdfRenderRequest(pdfUrl="https://bucket.test/b.pdf?X-Amz-Signature=SECRET"))
    assert "SECRET" not in str(exc.value)
