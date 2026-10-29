import io
import numpy as np
from PIL import Image

from src.ocr.region_box import analyze_region_content


def create_test_page_image(draw_fn=None, width=800, height=1000, bg_color=245) -> bytes:
    """Creates a synthetic grayscale page image (as bytes)."""
    img = Image.new("L", (width, height), color=bg_color)
    if draw_fn:
        draw_fn(img)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_truly_blank_page_classified_as_blank():
    raw = create_test_page_image(bg_color=248)
    box = {"x": 0.1, "y": 0.1, "width": 0.8, "height": 0.3}
    analysis = analyze_region_content(raw, box)

    assert analysis["is_blank"] is True
    assert analysis["ink_detected"] is False


def test_faint_pencil_writing_is_not_classified_as_blank():
    def draw_faint_pencil(img):
        # Draw a faint mathematical expression "x = 4" with stroke color 215 (against bg 245)
        arr = np.array(img)
        # 40 faint pixels simulating faint handwriting
        arr[200:205, 200:240] = 210
        return Image.fromarray(arr)

    # Directly create image with faint strokes
    img = Image.new("L", (800, 1000), color=245)
    arr = np.array(img)
    arr[200:204, 200:230] = 210  # 120 faint pixels
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=90)

    box = {"x": 0.2, "y": 0.18, "width": 0.3, "height": 0.1}
    analysis = analyze_region_content(buf.getvalue(), box)

    # Faint strokes MUST NOT be classified as blank (Phase 2 Requirement 6.2)
    assert analysis["is_blank"] is False
    assert analysis["ink_detected"] is True


def test_small_math_symbol_is_not_classified_as_blank():
    img = Image.new("L", (800, 1000), color=245)
    arr = np.array(img)
    # Small "+" sign in dark ink
    arr[200:215, 207:209] = 30
    arr[206:208, 200:215] = 30
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format="JPEG", quality=90)

    box = {"x": 0.2, "y": 0.18, "width": 0.2, "height": 0.1}
    analysis = analyze_region_content(buf.getvalue(), box)

    assert analysis["is_blank"] is False
    assert analysis["ink_detected"] is True

