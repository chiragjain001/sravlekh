"""The answer region an OCR reading belongs to.

An OCR transcript is only evidence for the box it was read from. OCRBlock.boundingBox
therefore records the PAGE-normalised box (0-1, same frame as PageRegion.boundingBox)
that was actually cropped and read. When a teacher later moves or resizes the region,
the stored box no longer matches and every consumer (the AI evaluator here, OcrService
and CheckedCopyService in NestJS) treats that transcript as stale: the answer needs
OCR again rather than being graded on text from somewhere else on the page.

Before this, OCR was sent the WHOLE page image for every region, so on a page with
two answers each answer's "transcript" contained both.
"""

import base64
import io

from PIL import Image

BOX_TOLERANCE = 1e-4
CROP_PADDING = 0.01  # a little context around the box: handwriting often overshoots it
MAX_CROP_SIDE = 2400  # vision models downscale anyway; keeps the request small


def as_box(value) -> dict | None:
    """A {x, y, width, height} dict of floats, or None if `value` is not one."""
    if not isinstance(value, dict):
        return None
    try:
        return {k: float(value[k]) for k in ("x", "y", "width", "height")}
    except (KeyError, TypeError, ValueError):
        return None


def same_box(a, b) -> bool:
    a, b = as_box(a), as_box(b)
    if a is None or b is None:
        return False
    return all(abs(a[k] - b[k]) <= BOX_TOLERANCE for k in a)


def crop_to_data_url(raw: bytes, box: dict) -> str:
    """Crops a page image to `box` (page-normalised, padded slightly) and returns a JPEG data: URL."""
    with Image.open(io.BytesIO(raw)) as page:
        page = page.convert("RGB")
        w, h = page.size
        x0 = max(0.0, box["x"] - CROP_PADDING) * w
        y0 = max(0.0, box["y"] - CROP_PADDING) * h
        x1 = min(1.0, box["x"] + box["width"] + CROP_PADDING) * w
        y1 = min(1.0, box["y"] + box["height"] + CROP_PADDING) * h
        if x1 - x0 < 2 or y1 - y0 < 2:
            raise ValueError("Answer region is too small to read.")
        crop = page.crop((round(x0), round(y0), round(x1), round(y1)))
        crop.thumbnail((MAX_CROP_SIDE, MAX_CROP_SIDE))
        buf = io.BytesIO()
        crop.save(buf, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
