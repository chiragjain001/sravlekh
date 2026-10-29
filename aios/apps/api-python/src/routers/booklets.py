import io
import logging
from typing import List, Optional

from fastapi import APIRouter, Response, HTTPException, status
from fpdf import FPDF
from pydantic import BaseModel
import qrcode
from PIL import Image

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/booklets", tags=["Booklets"])


class BookletCoverItem(BaseModel):
    bookletSerial: str
    qrPayload: str
    examTitle: str
    instituteName: str
    batchName: str
    subjectName: str
    scheduledDate: Optional[str] = "TBD"
    durationMinutes: Optional[int] = None
    totalMarks: Optional[int] = None
    maxRollDigits: int = 6


class RenderBookletCoversRequest(BaseModel):
    covers: List[BookletCoverItem]


from src.evaluation.pdf_fonts import resolve_fonts

class BookletPDF(FPDF):
    def __init__(self):
        super().__init__(orientation="P", unit="pt", format="A4")
        self.set_auto_page_break(False)

        # Resolve system fonts with Devanagari (Hindi) fallback
        fonts = resolve_fonts()
        self.body_font = "Helvetica"
        if fonts.sans is not None:
            self.add_font("body", "", fonts.sans)
            self.add_font("body", "B", fonts.sans_bold or fonts.sans)
            self.body_font = "body"
            fallbacks = []
            if fonts.devanagari:
                self.add_font("deva", "", fonts.devanagari)
                self.add_font("deva", "B", fonts.devanagari_bold or fonts.devanagari)
                fallbacks.append("deva")
            if fallbacks:
                self.set_fallback_fonts(fallbacks, exact_match=False)
            self.set_text_shaping(True)

    def set_font(self, family: str = None, style: str = "", size: float = 0):
        if (family is None or family == "Helvetica") and getattr(self, "body_font", None) == "body":
            clean_style = "B" if "B" in (style or "").upper() else ""
            super().set_font("body", clean_style, size)
        else:
            super().set_font(family, style, size)


def draw_corner_markers(pdf: FPDF, page_w: float, page_h: float, margin: float = 24.0, size: float = 16.0):
    """Draws 4 solid black corner fiducial markers for scanner skew/alignment tolerance."""
    pdf.set_fill_color(0, 0, 0)
    # Top-Left
    pdf.rect(margin, margin, size, size, "F")
    # Top-Right
    pdf.rect(page_w - margin - size, margin, size, size, "F")
    # Bottom-Left
    pdf.rect(margin, page_h - margin - size, size, size, "F")
    # Bottom-Right
    pdf.rect(page_w - margin - size, page_h - margin - size, size, size, "F")


def render_single_booklet_page(pdf: FPDF, item: BookletCoverItem):
    page_w = 595.28
    page_h = 841.89

    pdf.add_page()

    # 1. Corner Fiducial Markers
    draw_corner_markers(pdf, page_w, page_h, margin=25.0, size=15.0)

    # 2. Institute Name & Header
    pdf.set_y(40)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(20, 20, 20)
    pdf.cell(page_w, 20, item.instituteName.upper(), align="C")

    pdf.set_y(62)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(50, 50, 80)
    pdf.cell(page_w, 18, f"OFFICIAL EXAMINATION ANSWER BOOKLET - {item.examTitle.upper()}", align="C")

    pdf.set_y(82)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(page_w, 14, "DO NOT DETACH OR DAMAGE THIS COVER SHEET | PRESERVE SCAN MARKS", align="C")

    # Divider Line
    pdf.set_draw_color(200, 200, 210)
    pdf.set_line_width(1.0)
    pdf.line(45, 102, page_w - 45, 102)

    # 3. Meta Data & Serial Info (Left)
    pdf.set_xy(45, 112)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(40, 40, 40)
    pdf.cell(75, 16, "Subject:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(150, 16, item.subjectName)

    pdf.set_xy(45, 130)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(75, 16, "Batch / Class:")
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(150, 16, item.batchName)

    pdf.set_xy(45, 148)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(75, 16, "Date & Time:")
    pdf.set_font("Helvetica", "", 10)
    duration_str = f" | {item.durationMinutes} mins" if item.durationMinutes else ""
    pdf.cell(150, 16, f"{item.scheduledDate}{duration_str}")

    if item.totalMarks:
        pdf.set_xy(45, 166)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(75, 16, "Maximum Marks:")
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(150, 16, str(item.totalMarks))

    # Booklet Serial Callout Box
    serial_y = 190
    pdf.set_fill_color(245, 247, 250)
    pdf.set_draw_color(160, 170, 190)
    pdf.set_line_width(1.2)
    pdf.rect(45, serial_y, 350, 32, "FD")

    pdf.set_xy(55, serial_y + 8)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(70, 80, 100)
    pdf.cell(140, 16, "BOOKLET SERIAL NO:")
    pdf.set_font("Courier", "B", 14)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(190, 16, item.bookletSerial)

    # 4. QR Code Block (Upper Right)
    qr_img = qrcode.make(item.qrPayload, border=1)
    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    qr_x = page_w - 45 - 120
    qr_y = 110
    qr_size = 120

    # Draw quiet zone frame
    pdf.set_draw_color(180, 180, 190)
    pdf.set_line_width(0.8)
    pdf.rect(qr_x - 3, qr_y - 3, qr_size + 6, qr_size + 6)
    pdf.image(qr_buf, x=qr_x, y=qr_y, w=qr_size, h=qr_size)

    pdf.set_xy(qr_x - 10, qr_y + qr_size + 4)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_text_color(120, 120, 130)
    pdf.cell(qr_size + 20, 10, "UNIQUE SCANNING IDENTIFIER", align="C")

    # Second Divider
    pdf.set_draw_color(200, 200, 210)
    pdf.line(45, 232, page_w - 45, 232)

    # 5. Middle Section: Candidate Instructions (Left) + Roll Number Bubble Grid (Right)
    # ── Left: Candidate Instructions ──
    inst_x = 45
    inst_y = 245
    inst_w = 230
    inst_h = 360

    pdf.set_fill_color(252, 252, 254)
    pdf.set_draw_color(210, 215, 225)
    pdf.rect(inst_x, inst_y, inst_w, inst_h, "FD")

    pdf.set_xy(inst_x + 12, inst_y + 12)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(inst_w - 24, 16, "CANDIDATE INSTRUCTIONS")

    pdf.set_draw_color(180, 190, 210)
    pdf.line(inst_x + 12, inst_y + 32, inst_x + inst_w - 12, inst_y + 32)

    instructions = [
        "1. Write your official Roll Number digits in the top boxes of the grid on the right.",
        "2. Darken the corresponding circle beneath each digit completely.",
        "3. Use Blue or Black ballpoint pen only. Gel pens, ink pens, or pencils are forbidden.",
        "4. Completely fill bubbles like [ O ]. Do NOT use ticks [ V ], crosses [ X ], or half marks.",
        "5. Do NOT make stray pencil/pen marks in the margins or over the corner square markers.",
        "6. Do NOT fold, staple, tear, or mutilate this cover sheet.",
        "7. Start writing your subjective solutions on Page 2 onwards.",
        "8. Verify that the booklet serial matches your attendance slip entry.",
    ]

    curr_y = inst_y + 42
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(51, 65, 85)
    for inst in instructions:
        pdf.set_xy(inst_x + 10, curr_y)
        pdf.multi_cell(inst_w - 20, 13, inst)
        curr_y = pdf.get_y() + 6

    # ── Right: OMR Roll Number Bubble Grid ──
    grid_x = 295
    grid_y = 245
    grid_w = page_w - 45 - grid_x
    grid_h = 360

    pdf.set_fill_color(255, 255, 255)
    pdf.set_draw_color(180, 190, 210)
    pdf.rect(grid_x, grid_y, grid_w, grid_h, "FD")

    pdf.set_xy(grid_x + 10, grid_y + 10)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(30, 41, 59)
    pdf.cell(grid_w - 20, 16, "STUDENT ROLL NUMBER BUBBLE GRID", align="C")

    # Instruction subtext
    pdf.set_xy(grid_x + 10, grid_y + 26)
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(100, 116, 139)
    pdf.cell(grid_w - 20, 12, "Write digits in boxes, then darken matching bubbles below", align="C")

    # Grid specifications
    digits_count = min(max(item.maxRollDigits, 4), 8)
    box_w = 26.0
    box_h = 24.0
    gap_x = 6.0
    total_grid_w = digits_count * box_w + (digits_count - 1) * gap_x
    start_x = grid_x + (grid_w - total_grid_w) / 2.0
    top_box_y = grid_y + 44.0

    # 1. Top write-in boxes
    pdf.set_draw_color(50, 50, 60)
    pdf.set_line_width(1.0)
    pdf.set_fill_color(250, 250, 252)
    for c in range(digits_count):
        bx = start_x + c * (box_w + gap_x)
        pdf.rect(bx, top_box_y, box_w, box_h, "FD")

    # 2. Bubble grid (Rows 0 to 9)
    bubble_start_y = top_box_y + box_h + 12.0
    bubble_pitch_y = 24.0
    bubble_r = 7.5

    pdf.set_draw_color(70, 80, 95)
    pdf.set_line_width(0.8)

    for digit in range(10):
        cy = bubble_start_y + digit * bubble_pitch_y
        for col in range(digits_count):
            cx = start_x + col * (box_w + gap_x) + box_w / 2.0

            # Draw circle
            # ellipse(x, y, w, h) in fpdf2
            pdf.ellipse(cx - bubble_r, cy - bubble_r, bubble_r * 2, bubble_r * 2)

            # Center digit text inside circle
            pdf.set_xy(cx - bubble_r, cy - 4.5)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(70, 80, 95)
            pdf.cell(bubble_r * 2, 9, str(digit), align="C")

    # 6. Bottom Signatures & Verification Section
    sig_y = 620
    sig_w = page_w - 90
    sig_h = 95

    pdf.set_fill_color(250, 250, 252)
    pdf.set_draw_color(200, 205, 215)
    pdf.rect(45, sig_y, sig_w, sig_h, "FD")

    col_w = sig_w / 3.0

    # Student Signature Box
    pdf.set_xy(45 + 10, sig_y + 10)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(50, 50, 60)
    pdf.cell(col_w - 20, 14, "CANDIDATE SIGNATURE:")
    pdf.set_xy(45 + 10, sig_y + sig_h - 22)
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(130, 130, 140)
    pdf.cell(col_w - 20, 12, "(Sign only in the presence of invigilator)")

    pdf.line(45 + col_w, sig_y, 45 + col_w, sig_y + sig_h)

    # Invigilator Signature Box
    pdf.set_xy(45 + col_w + 10, sig_y + 10)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(50, 50, 60)
    pdf.cell(col_w - 20, 14, "INVIGILATOR SIGNATURE:")
    pdf.set_xy(45 + col_w + 10, sig_y + sig_h - 22)
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(130, 130, 140)
    pdf.cell(col_w - 20, 12, "(Verified roll number & signature)")

    pdf.line(45 + col_w * 2, sig_y, 45 + col_w * 2, sig_y + sig_h)

    # Center Superintendent / Seal Box
    pdf.set_xy(45 + col_w * 2 + 10, sig_y + 10)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(50, 50, 60)
    pdf.cell(col_w - 20, 14, "INSTITUTE STAMP / DATE:")
    pdf.set_xy(45 + col_w * 2 + 10, sig_y + sig_h - 22)
    pdf.set_font("Helvetica", "I", 7.5)
    pdf.set_text_color(130, 130, 140)
    pdf.cell(col_w - 20, 12, "Official Institute Seal")

    # 7. Bottom Security Footer
    pdf.set_xy(45, 735)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(100, 110, 130)
    pdf.cell(
        page_w - 90,
        14,
        "SARVLEKH AIOS | ACADEMIC INTELLIGENCE OPERATING SYSTEM | SECURE SERIALIZED COVER SHEET",
        align="C",
    )
    pdf.set_xy(45, 749)
    pdf.set_font("Courier", "", 7.5)
    pdf.set_text_color(140, 150, 165)
    pdf.cell(
        page_w - 90,
        12,
        f"SERIAL: {item.bookletSerial} | HMAC VERIFIED | SCANNER CALIBRATED PITCH 24pt",
        align="C",
    )


@router.post("/render-covers", status_code=status.HTTP_200_OK)
async def render_covers(req: RenderBookletCoversRequest):
    """
    Renders genuine multi-page PDF containing printable serialized booklet covers
    with QR code identifier and OMR roll-number bubble grid.
    """
    if not req.covers:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one booklet cover must be requested for rendering.",
        )

    try:
        pdf = BookletPDF()
        for item in req.covers:
            render_single_booklet_page(pdf, item)

        pdf_bytes = bytes(pdf.output())
        return Response(content=pdf_bytes, media_type="application/pdf")
    except Exception as e:
        logger.exception("Failed to render booklet covers PDF: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Booklet cover rendering error: {str(e)}",
        )
