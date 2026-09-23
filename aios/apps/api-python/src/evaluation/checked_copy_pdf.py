"""Renders a student's checked answer sheet as a PDF: a summary page (per-question
marks, verdict, tag-wise split, remarks, total) followed by every scanned page with
each answer region boxed and its marks written beside it — the digital
equivalent of a copy marked in red ink.

Pure rendering. The caller (NestJS CheckedCopyService) decides what the marks
are and whether the copy is a DRAFT (AI suggestions not yet reviewed) or FINAL
(submitted by a teacher); nothing here reads or writes the database.

Built on fpdf2 rather than drawing text into images:
  * text is real PDF text with embedded, subset fonts (selectable, searchable,
    crisp at any zoom), shaped by HarfBuzz so Devanagari matras and conjuncts
    are placed correctly — Pillow without libraqm cannot do that;
  * fonts come from pdf_fonts.resolve_fonts(), with Devanagari and math fonts
    as glyph-by-glyph fallbacks behind the Latin body font;
  * scanned pages are embedded as-is (a JPEG scan is passed through without
    re-encoding), and the red marks are drawn as a vector layer on top, so the
    student's original page is never altered.

LaTeX-ish content (question text, remarks) goes through math_text first.
"""

import io
import logging
from datetime import datetime

from fpdf import FPDF, FontFace
from fpdf.enums import XPos, YPos
from PIL import Image
from pydantic import BaseModel, Field

from src.evaluation.math_text import to_display_text
from src.evaluation.pdf_fonts import resolve_fonts
from src.image_fetch import ImageFetchError, fetch_image_bytes

logger = logging.getLogger(__name__)

A4_W, A4_H = 595.28, 841.89  # points
MARGIN = 40
TOTAL_TOLERANCE = 0.001

RED = (200, 30, 30)
GREEN = (20, 130, 60)
AMBER = (180, 110, 0)
GREY = (100, 100, 100)
INK = (25, 25, 25)
RULE = (220, 220, 220)

VERDICT_LABEL = {
    "CORRECT": "Correct",
    "PARTIALLY_CORRECT": "Partly correct",
    "INCORRECT": "Incorrect",
    "NOT_ATTEMPTED": "Not attempted",
}
VERDICT_COLOR = {"CORRECT": GREEN, "PARTIALLY_CORRECT": AMBER, "INCORRECT": RED, "NOT_ATTEMPTED": GREY}


class BoundingBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class TagMark(BaseModel):
    tag: str
    maxMarks: float = Field(ge=0)
    marksAwarded: float = Field(ge=0)


class QuestionMark(BaseModel):
    questionNumber: int
    questionText: str = ""
    maxMarks: float = Field(ge=0)
    marksAwarded: float | None = Field(default=None, ge=0)  # None = not graded yet
    verdict: str | None = None
    tags: list[TagMark] = Field(default_factory=list)
    mistakeTag: str | None = None
    comment: str | None = None


class RegionMark(BaseModel):
    questionNumber: int
    boundingBox: BoundingBox


class PageIn(BaseModel):
    pageNumber: int
    imageUrl: str
    regions: list[RegionMark] = Field(default_factory=list)


class CheckedCopyRequest(BaseModel):
    title: str
    studentName: str
    rollNumber: str | None = None
    status: str  # "DRAFT" | "FINAL"
    reviewedBy: str | None = None
    reviewedAt: str | None = None
    obtainedMarks: float
    totalMarks: float
    questions: list[QuestionMark]
    pages: list[PageIn]


class InconsistentTotalsError(ValueError):
    """The totals printed on a checked copy must add up. Refuse rather than print a wrong total."""


def _fmt(n: float | None) -> str:
    if n is None:
        return "–"
    return str(int(n)) if float(n).is_integer() else f"{n:.2f}".rstrip("0").rstrip(".")


def _tag_label(tag: str) -> str:
    return tag.replace("_", " ").title()


def check_totals(req: CheckedCopyRequest) -> None:
    graded = sum(q.marksAwarded or 0 for q in req.questions)
    available = sum(q.maxMarks for q in req.questions)
    if abs(graded - req.obtainedMarks) > TOTAL_TOLERANCE:
        raise InconsistentTotalsError(f"obtainedMarks {req.obtainedMarks} does not equal the sum of question marks {graded}.")
    if abs(available - req.totalMarks) > TOTAL_TOLERANCE:
        raise InconsistentTotalsError(f"totalMarks {req.totalMarks} does not equal the sum of question maximums {available}.")
    for q in req.questions:
        if q.marksAwarded is not None and q.marksAwarded > q.maxMarks + TOTAL_TOLERANCE:
            raise InconsistentTotalsError(f"Q{q.questionNumber}: {q.marksAwarded} exceeds its maximum {q.maxMarks}.")
        # A FINAL copy's tags were submitted by the teacher and the server derived
        # the total from them, so they must agree. A DRAFT can legitimately carry
        # an AI split that doesn't add up (flagged breakdown_mismatch for review).
        if req.status == "FINAL" and q.tags and q.marksAwarded is not None:
            tag_sum = sum(t.marksAwarded for t in q.tags)
            if abs(tag_sum - q.marksAwarded) > TOTAL_TOLERANCE:
                raise InconsistentTotalsError(f"Q{q.questionNumber}: tag marks add up to {tag_sum}, not {q.marksAwarded}.")


class _CheckedCopyPdf(FPDF):
    def __init__(self, footer_text: str):
        super().__init__(unit="pt", format="A4")
        self.footer_text = footer_text
        self.set_auto_page_break(auto=True, margin=MARGIN + 10)
        self.set_margins(MARGIN, MARGIN, MARGIN)
        fonts = resolve_fonts()
        if fonts.missing:
            logger.warning("Checked copy PDF: no font found for %s — that script will not render. Install fonts-noto-core.", ", ".join(fonts.missing))
        if fonts.sans is None:
            raise RuntimeError("No usable font for the checked-copy PDF (install fonts-noto-core or fonts-dejavu-core).")
        self.add_font("body", "", fonts.sans)
        self.add_font("body", "B", fonts.sans_bold or fonts.sans)
        fallbacks = []
        if fonts.devanagari:
            self.add_font("deva", "", fonts.devanagari)
            self.add_font("deva", "B", fonts.devanagari_bold or fonts.devanagari)
            fallbacks.append("deva")
        if fonts.math and fonts.math != fonts.sans:
            self.add_font("math", "", fonts.math)
            fallbacks.append("math")
        self.set_fallback_fonts(fallbacks, exact_match=False)
        self.set_text_shaping(True)

    def footer(self):
        self.set_y(-MARGIN + 8)
        self.set_font("body", "", 8)
        self.set_text_color(*GREY)
        self.cell(0, 10, f"{self.footer_text}  ·  Page {self.page_no()}/{{nb}}", align="C")


def _summary(pdf: _CheckedCopyPdf, req: CheckedCopyRequest) -> None:
    pdf.add_page()
    pdf.set_text_color(*INK)
    pdf.set_font("body", "B", 20)
    pdf.cell(0, 26, "Checked Answer Sheet", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("body", "B", 13)
    pdf.multi_cell(0, 17, to_display_text(req.title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("body", "", 11)
    student = req.studentName + (f"   ·   Roll no. {req.rollNumber}" if req.rollNumber else "")
    pdf.cell(0, 16, student, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(6)

    if req.status == "FINAL":
        banner = "FINAL — marks confirmed by " + (req.reviewedBy or "the teacher") + (f" on {req.reviewedAt}" if req.reviewedAt else "")
        color = GREEN
    else:
        banner = "DRAFT — AI-suggested marks, not yet confirmed by a teacher. Not an official result."
        color = AMBER
    # Box drawn separately: fpdf2's multi_cell(padding=…) corrupts glyph runs when
    # text shaping is on (seen as garbled banner text in render tests).
    pdf.set_draw_color(*color)
    pdf.set_text_color(*color)
    pdf.set_line_width(1.2)
    pdf.set_font("body", "B", 10.5)
    top = pdf.get_y()
    pdf.set_x(MARGIN + 8)
    pdf.multi_cell(pdf.epw - 16, 15, banner, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    bottom = pdf.get_y()
    pdf.rect(MARGIN, top - 5, pdf.epw, bottom - top + 10)
    pdf.set_y(bottom + 12)

    pdf.set_text_color(*RED)
    pdf.set_font("body", "B", 22)
    pct = f"  ({req.obtainedMarks / req.totalMarks * 100:.1f}%)" if req.totalMarks else ""
    pdf.cell(0, 28, f"Total: {_fmt(req.obtainedMarks)} / {_fmt(req.totalMarks)}{pct}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.ln(6)

    pdf.set_line_width(0.5)
    pdf.set_draw_color(*RULE)
    pdf.set_text_color(*INK)
    pdf.set_font("body", "", 9.5)
    with pdf.table(
        col_widths=(7, 43, 12, 16, 42),
        line_height=13,
        text_align=("LEFT", "LEFT", "CENTER", "LEFT", "LEFT"),
        headings_style=FontFace(emphasis="BOLD", color=GREY),
        first_row_as_headings=True,
        borders_layout="HORIZONTAL_LINES",
        padding=3,
    ) as table:
        head = table.row()
        for h in ("Q", "Question", "Marks", "Result", "Tag-wise marks · remarks"):
            head.cell(h)
        for q in req.questions:
            row = table.row()
            row.cell(f"Q{q.questionNumber}")
            text = to_display_text(q.questionText)
            row.cell(text if len(text) <= 180 else text[:177] + "…")
            row.cell(f"{_fmt(q.marksAwarded)}/{_fmt(q.maxMarks)}")
            row.cell(VERDICT_LABEL.get(q.verdict or "", "–"))
            details = [", ".join(f"{_tag_label(t.tag)} {_fmt(t.marksAwarded)}/{_fmt(t.maxMarks)}" for t in q.tags)] if q.tags else []
            if q.mistakeTag:
                details.append(f"Mistake: {_tag_label(q.mistakeTag)}")
            if q.comment:
                details.append(f"Remark: {to_display_text(q.comment)}")
            row.cell("\n".join(details) or "–")

    pdf.ln(10)
    pdf.set_font("body", "", 8.5)
    pdf.set_text_color(*GREY)
    pdf.multi_cell(
        0, 11,
        "AI-assisted evaluation with teacher verification. Marks on a FINAL copy were reviewed and confirmed by the teacher; "
        "AI suggestions alone never count towards a result.",
        new_x=XPos.LMARGIN, new_y=YPos.NEXT,
    )


def _placeholder_page(pdf: _CheckedCopyPdf, page_number: int) -> None:
    pdf.add_page()
    pdf.set_font("body", "B", 14)
    pdf.set_text_color(*RED)
    pdf.multi_cell(0, 20, f"Scanned page {page_number} could not be loaded. The marks above are unaffected; open the booklet in AIOS to view it.")


def _scan_page(pdf: _CheckedCopyPdf, raw: bytes, page: PageIn, questions: dict[int, QuestionMark]) -> None:
    with Image.open(io.BytesIO(raw)) as probe:
        width_px, height_px = probe.size
    page_h = A4_W * height_px / width_px
    pdf.add_page(format=(A4_W, page_h))
    pdf.set_auto_page_break(False)
    # The original scan, embedded unchanged, filling the page edge to edge.
    pdf.image(io.BytesIO(raw), x=0, y=0, w=A4_W, h=page_h)

    for region in page.regions:
        q = questions.get(region.questionNumber)
        bb = region.boundingBox
        x0, y0 = bb.x * A4_W, bb.y * page_h
        w, h = bb.width * A4_W, bb.height * page_h
        pdf.set_draw_color(*RED)
        pdf.set_line_width(1.6)
        pdf.rect(x0, y0, w, h)

        heading = f"Q{region.questionNumber}: {_fmt(q.marksAwarded)}/{_fmt(q.maxMarks)}" if q else f"Q{region.questionNumber}"
        if q and q.verdict:
            heading += f"  {VERDICT_LABEL.get(q.verdict, '')}"
        lines = [(heading, 11, "B")] + ([(f"{_tag_label(t.tag)} {_fmt(t.marksAwarded)}/{_fmt(t.maxMarks)}", 8.5, "") for t in q.tags] if q else [])

        widths = []
        for text, size, style in lines:
            pdf.set_font("body", style, size)
            widths.append(pdf.get_string_width(text))
        card_w = min(max(widths) + 12, A4_W - 4)
        card_h = sum(size + 3 for _, size, _ in lines) + 8

        # Marks go BESIDE the answer, the way a teacher writes in the margin —
        # never on top of the student's writing. Right margin first, then the
        # left one, then just above the box; only a box that fills the page
        # width and touches the top falls back to overlaying its top-right
        # corner, where there is nowhere else to put it.
        if x0 + w + card_w + 6 <= A4_W:
            cx, cy = x0 + w + 4, y0
        elif x0 - card_w - 6 >= 0:
            cx, cy = x0 - card_w - 4, y0
        elif y0 - card_h - 4 >= 0:
            cx, cy = min(x0, A4_W - card_w - 2), y0 - card_h - 4
        else:
            cx, cy = max(2, x0 + w - card_w - 4), y0 + 4
        cx = max(2, min(cx, A4_W - card_w - 2))
        cy = max(2, min(cy, page_h - card_h - 2))
        pdf.set_fill_color(255, 255, 255)
        pdf.set_line_width(0.8)
        pdf.rect(cx, cy, card_w, card_h, style="DF")
        ty = cy + 4
        pdf.set_text_color(*RED)
        for text, size, style in lines:
            pdf.set_font("body", style, size)
            pdf.set_xy(cx + 6, ty)
            pdf.cell(card_w - 12, size + 2, text)
            ty += size + 3
    pdf.set_auto_page_break(True, margin=MARGIN + 10)


async def render_checked_copy(req: CheckedCopyRequest) -> bytes:
    check_totals(req)
    generated = datetime.now().strftime("%d %b %Y %H:%M")
    pdf = _CheckedCopyPdf(footer_text=f"{req.studentName} · {'FINAL' if req.status == 'FINAL' else 'DRAFT'} · generated {generated}")
    pdf.set_title(f"Checked copy — {req.studentName} — {req.title}")
    pdf.set_author("AIOS")
    pdf.set_creator("AIOS checked copy")
    _summary(pdf, req)

    questions = {q.questionNumber: q for q in req.questions}
    for page in sorted(req.pages, key=lambda p: p.pageNumber):
        try:
            raw, _mime = await fetch_image_bytes(page.imageUrl)
            _scan_page(pdf, raw, page, questions)
        except (ImageFetchError, OSError, ValueError) as e:
            # One unreadable scan must not cost the teacher the whole copy.
            logger.warning("Checked copy: page %s could not be rendered (%s)", page.pageNumber, type(e).__name__)
            _placeholder_page(pdf, page.pageNumber)

    return bytes(pdf.output())
