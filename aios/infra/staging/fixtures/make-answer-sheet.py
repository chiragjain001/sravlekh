"""Builds a synthetic student answer booklet for staging verification.

  python infra/staging/fixtures/make-answer-sheet.py <out-dir>

Writes answer-sheet.pdf (3 pages) and page-1..3.jpg — the same booklet in both
upload shapes, so the PDF path and the image path can be exercised with
identical content.

Deliberately covers the cases that broke things before: a numerical answered
with the right method but a wrong final value, an incomplete theory answer, an
off-topic answer, a Hindi answer and one with mathematical notation. Synthetic
handwriting, never a real student's work — real answer sheets are personal data
and must not be pushed through a staging provider key.
"""

import sys
from pathlib import Path

from fpdf import FPDF
from PIL import Image

PAGE_W, PAGE_H = 595.28, 841.89  # A4 points
HANDWRITING_CANDIDATES = [r"C:\Windows\Fonts\segoepr.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
DEVANAGARI_CANDIDATES = [r"C:\Windows\Fonts\Nirmala.ttc", "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"]

# (question number, marks, the student's written answer)
ANSWERS = [
    (1, [
        "Q1)  u = 0,  v = 20 m/s,  t = 5 s",
        "a = (v - u)/t = 20/5 = 4 m/s2",
        "s = ut + 1/2 a t^2",
        "   = 0 + 1/2 x 4 x 25 = 100 m",          # correct method, wrong arithmetic (should be 50 m)
    ]),
    (2, [
        "Q2)  Plants prepare their food using sunlight.",
        "Chlorophyll in the leaves absorbs light energy.",
        "Carbon dioxide and water are used and oxygen",
        "is released.",                              # no balanced equation, no glucose: partial
    ]),
    (3, [
        "Q3)  न्यूटन का पहला नियम - कोई वस्तु अपनी अवस्था",
        "में तब तक रहती है जब तक उस पर बाहरी बल न लगे।",
        "उदाहरण: बस के अचानक रुकने पर यात्री आगे झुक जाता है।",
    ]),
    (4, [
        "Q4)  KE = 1/2 m v^2",
        "   = 1/2 x 2 x (3)^2 = 9 J",              # correct
    ]),
    (5, [
        "Q5)  Newton's first law states that a body at rest",
        "stays at rest unless a force acts on it.",   # off-topic: the question asked about states of matter
    ]),
]

PAGE_BREAKS = {1: [1, 2], 2: [3, 4], 3: [5]}  # page number -> question numbers on it


def _font(pdf: FPDF, candidates, name: str) -> bool:
    for path in candidates:
        if Path(path).exists():
            pdf.add_font(name, "", path)
            return True
    return False


def build_pdf(out: Path) -> Path:
    pdf = FPDF(unit="pt", format="A4")
    has_hand = _font(pdf, HANDWRITING_CANDIDATES, "hand")
    has_deva = _font(pdf, DEVANAGARI_CANDIDATES, "deva")
    if has_deva:
        pdf.set_fallback_fonts(["deva"], exact_match=False)
    pdf.set_text_shaping(True)
    body = "hand" if has_hand else "helvetica"

    answers = {number: lines for number, lines in ANSWERS}
    for page_number in sorted(PAGE_BREAKS):
        pdf.add_page()
        # Ruled paper, so the render looks like a scanned booklet page.
        pdf.set_draw_color(205, 220, 240)
        pdf.set_line_width(0.6)
        y = 90.0
        while y < PAGE_H - 50:
            pdf.line(40, y, PAGE_W - 40, y)
            y += 26
        pdf.set_text_color(20, 30, 90)
        pdf.set_font(body, "", 15)
        pdf.set_xy(40, 50)
        pdf.cell(0, 20, f"Roll No. 12        Page {page_number}")

        y = 110.0
        for number in PAGE_BREAKS[page_number]:
            for line in answers[number]:
                pdf.set_xy(55, y)
                pdf.cell(PAGE_W - 95, 22, line)
                y += 26
            y += 30

    target = out / "answer-sheet.pdf"
    pdf.output(str(target))
    return target


def build_images(pdf_path: Path, out: Path) -> list[Path]:
    import pypdfium2 as pdfium

    document = pdfium.PdfDocument(pdf_path)
    written = []
    for index in range(len(document)):
        image: Image.Image = document[index].render(scale=150 / 72).to_pil().convert("RGB")
        target = out / f"page-{index + 1}.jpg"
        image.save(target, "JPEG", quality=88)
        written.append(target)
    document.close()
    return written


def main() -> None:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    out.mkdir(parents=True, exist_ok=True)
    pdf_path = build_pdf(out)
    images = build_images(pdf_path, out)
    print(pdf_path)
    for image in images:
        print(image)


if __name__ == "__main__":
    main()
