import base64
import io

import pypdfium2 as pdfium
import pytest
from PIL import Image

from src.evaluation.checked_copy_pdf import (
    CheckedCopyRequest,
    InconsistentTotalsError,
    render_checked_copy,
)
from src.evaluation.pdf_fonts import resolve_fonts

requires_devanagari_font = pytest.mark.skipif(
    resolve_fonts().devanagari is None,
    reason="No Devanagari font on this host — CI and the production image install fonts-noto-core",
)


def jpeg_bytes(width=800, height=1100, color=(250, 249, 244)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color).save(buf, "JPEG", quality=90)
    return buf.getvalue()


def data_url(raw: bytes, mime="image/jpeg") -> str:
    return f"data:{mime};base64," + base64.b64encode(raw).decode()


def request(**overrides) -> CheckedCopyRequest:
    data = {
        "title": "Unit Test - Motion",
        "studentName": "Asha",
        "rollNumber": "12",
        "status": "DRAFT",
        "obtainedMarks": 6,
        "totalMarks": 10,
        "questions": [
            {
                "questionNumber": 1,
                "questionText": "State Newton's second law.",
                "maxMarks": 5,
                "marksAwarded": 4,
                "verdict": "PARTIALLY_CORRECT",
                "tags": [{"tag": "CONCEPT", "maxMarks": 3, "marksAwarded": 3}, {"tag": "EXAMPLE", "maxMarks": 2, "marksAwarded": 1}],
                "mistakeTag": "CONCEPT_ERROR",
                "comment": "Example incomplete",
            },
            {"questionNumber": 2, "questionText": "Define inertia.", "maxMarks": 5, "marksAwarded": 2, "verdict": "INCORRECT"},
        ],
        "pages": [
            {
                "pageNumber": 1,
                "imageUrl": data_url(jpeg_bytes()),
                "regions": [
                    {"questionNumber": 1, "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.3}},
                    {"questionNumber": 2, "boundingBox": {"x": 0.1, "y": 0.5, "width": 0.8, "height": 0.3}},
                ],
            }
        ],
    }
    data.update(overrides)
    return CheckedCopyRequest(**data)


def text_of(pdf: bytes) -> list[str]:
    """Extracted text per page. Control characters are dropped: pdfium emits them
    where HarfBuzz reordered a Devanagari matra or reph, an extraction artefact
    (the rendered glyphs are correct, see test_no_glyph_is_missing)."""
    doc = pdfium.PdfDocument(pdf)
    raw = [doc[i].get_textpage().get_text_range() for i in range(len(doc))]
    return ["".join(ch for ch in t if ch in "\n\r" or ord(ch) >= 32) for t in raw]


@pytest.mark.asyncio
async def test_renders_a_summary_page_plus_one_page_per_scan_with_real_text():
    pdf = await render_checked_copy(request())
    pages = text_of(pdf)
    assert len(pages) == 2
    summary = pages[0]
    assert "Checked Answer Sheet" in summary
    assert "Total: 6 / 10" in summary
    assert "Concept 3/3, Example 1/2" in summary
    assert "Remark: Example incomplete" in summary
    assert "DRAFT" in summary and "not yet confirmed" in summary
    assert "Q1: 4/5" in pages[1]  # the red mark on the scan is text, not pixels


@pytest.mark.asyncio
async def test_the_original_scan_is_embedded_byte_for_byte():
    """The student's page must reach the PDF unaltered: the JPEG stream is
    passed through, and the marks are a separate vector layer on top."""
    scan = jpeg_bytes(color=(240, 238, 230))
    pdf = await render_checked_copy(request(pages=[{"pageNumber": 1, "imageUrl": data_url(scan), "regions": []}]))
    assert scan in pdf


@requires_devanagari_font
@pytest.mark.asyncio
async def test_hindi_is_embedded_as_shaped_extractable_text():
    req = request(
        title="इकाई परीक्षा — विज्ञान",
        studentName="आशा वर्मा",
        questions=[
            {"questionNumber": 1, "questionText": "प्रकाश संश्लेषण की प्रक्रिया समझाइए।", "maxMarks": 5, "marksAwarded": 3,
             "verdict": "PARTIALLY_CORRECT", "comment": "संतुलित समीकरण नहीं लिखा"},
            {"questionNumber": 2, "questionText": "Define inertia.", "maxMarks": 5, "marksAwarded": 3},
        ],
    )
    pdf = await render_checked_copy(req)
    summary = text_of(pdf)[0]
    for phrase in ("आशा वर्मा", "प्रकाश संश्लेषण", "प्रक्रिया", "संतुलित समीकरण"):
        assert phrase in summary, phrase
    assert "DRAFT — AI-suggested marks" in summary  # Latin next to Devanagari is not corrupted
    assert b"/FontFile2" in pdf  # fonts are embedded, not referenced


@requires_devanagari_font
@pytest.mark.asyncio
async def test_no_glyph_is_missing_for_hindi_english_and_math(caplog):
    """fpdf2 logs every character no embedded font can draw (it would print as an
    empty box). Mixed Hindi, English and maths must produce none."""
    import logging

    req = request(
        studentName="रोहन कुमार",
        questions=[
            {"questionNumber": 1, "questionText": r"गति का दूसरा नियम: $F = ma$, $\int_0^1 x^2 dx$, √2 ≤ π ≠ ∞, α β Δ θ",
             "maxMarks": 5, "marksAwarded": 5, "verdict": "CORRECT"},
            {"questionNumber": 2, "questionText": "Explain inertia — with an example.", "maxMarks": 5, "marksAwarded": 1},
        ],
    )
    with caplog.at_level(logging.WARNING, logger="fpdf"):
        await render_checked_copy(req)
    missing = [r.getMessage() for r in caplog.records if "missing" in r.getMessage().lower()]
    assert missing == []


@pytest.mark.asyncio
async def test_latex_in_question_text_is_printed_as_readable_math():
    req = request(questions=[
        {"questionNumber": 1, "questionText": r"Find $s$ if $s = ut + \frac{1}{2}at^2$, $u=0$, $a = 4\,m/s^2$", "maxMarks": 5, "marksAwarded": 4},
        {"questionNumber": 2, "questionText": r"Show that \sqrt{2} \leq \pi", "maxMarks": 5, "marksAwarded": 2},
    ])
    summary = text_of(await render_checked_copy(req))[0]
    assert "s = ut + 1/2at²" in summary
    assert "√2 ≤ π" in summary
    assert "\\frac" not in summary


@pytest.mark.asyncio
async def test_marks_are_written_beside_an_answer_not_over_the_student_s_writing():
    """A card drawn inside the box covers the handwriting it is marking."""
    req = request(pages=[{
        "pageNumber": 1,
        "imageUrl": data_url(jpeg_bytes()),
        # A narrow box on the left: there is room in the right margin.
        "regions": [{"questionNumber": 1, "boundingBox": {"x": 0.05, "y": 0.3, "width": 0.4, "height": 0.2}}],
    }])
    pdf = await render_checked_copy(req)

    page = pdfium.PdfDocument(pdf)[1]
    textpage = page.get_textpage()
    width, height = page.get_width(), page.get_height()
    # pdfium measures from the bottom-left; the box is given from the top.
    inside_the_answer = textpage.get_text_bounded(
        left=0.05 * width, bottom=height - 0.5 * height, right=0.45 * width, top=height - 0.3 * height
    ).strip()
    assert inside_the_answer == "", f"marks were written over the answer: {inside_the_answer!r}"
    assert "Q1: 4/5" in textpage.get_text_range()  # they are on the page, just beside it


@pytest.mark.asyncio
async def test_a_total_that_does_not_add_up_is_refused_not_printed():
    with pytest.raises(InconsistentTotalsError):
        await render_checked_copy(request(obtainedMarks=9))


@pytest.mark.asyncio
async def test_a_final_copy_whose_tags_disagree_with_the_marks_is_refused():
    bad = request(status="FINAL", obtainedMarks=7, questions=[
        {"questionNumber": 1, "maxMarks": 5, "marksAwarded": 5, "tags": [{"tag": "CONCEPT", "maxMarks": 5, "marksAwarded": 3}]},
        {"questionNumber": 2, "maxMarks": 5, "marksAwarded": 2},
    ])
    with pytest.raises(InconsistentTotalsError):
        await render_checked_copy(bad)


@pytest.mark.asyncio
async def test_an_unloadable_scan_becomes_a_placeholder_page_instead_of_failing_the_copy():
    req = request(pages=[{"pageNumber": 1, "imageUrl": "file:///nope.png", "regions": []}])
    pages = text_of(await render_checked_copy(req))
    assert len(pages) == 2
    assert "could not be loaded" in pages[1]


@pytest.mark.asyncio
async def test_final_copy_names_the_reviewer_and_a_multi_page_sheet_keeps_page_order():
    req = request(
        status="FINAL", reviewedBy="Ms. Rao", reviewedAt="20 Sep 2026",
        pages=[
            {"pageNumber": 2, "imageUrl": data_url(jpeg_bytes()), "regions": [{"questionNumber": 2, "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.5, "height": 0.2}}]},
            {"pageNumber": 1, "imageUrl": data_url(jpeg_bytes()), "regions": [{"questionNumber": 1, "boundingBox": {"x": 0.1, "y": 0.1, "width": 0.5, "height": 0.2}}]},
        ],
    )
    pages = text_of(await render_checked_copy(req))
    assert "confirmed by Ms. Rao on 20 Sep 2026" in pages[0]
    assert "Q1:" in pages[1] and "Q2:" in pages[2]
