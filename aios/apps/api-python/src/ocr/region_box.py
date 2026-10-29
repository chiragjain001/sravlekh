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

import numpy as np
from PIL import Image, ImageEnhance

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


def analyze_region_content(raw: bytes, box: dict) -> dict:
    """Optical analysis of region crop to distinguish:
    - Truly blank / empty answer boxes (near zero ink / low contrast variance)
    - Border cutoffs (ink strokes touching crop boundaries, indicating cropped writing)
    - Optical stroke density
    """
    with Image.open(io.BytesIO(raw)) as page:
        page_gray = page.convert("L")
        w, h = page_gray.size
        x0 = max(0.0, box["x"] - CROP_PADDING) * w
        y0 = max(0.0, box["y"] - CROP_PADDING) * h
        x1 = min(1.0, box["x"] + box["width"] + CROP_PADDING) * w
        y1 = min(1.0, box["y"] + box["height"] + CROP_PADDING) * h
        if x1 - x0 < 2 or y1 - y0 < 2:
            return {"is_blank": True, "dark_pixel_ratio": 0.0, "is_cropped": False, "ink_detected": False}
        crop = page_gray.crop((round(x0), round(y0), round(x1), round(y1)))

        arr = np.array(crop)
        median_bg = float(np.median(arr))
        # Ink threshold: detect marks noticeably darker than median paper background
        # (lowered from 32 to 24 to detect faint pencil writing)
        ink_threshold = max(50.0, median_bg - 24.0)
        ink_mask = arr < ink_threshold
        ink_pixels = int(np.sum(ink_mask))
        total_pixels = arr.size
        dark_pixel_ratio = ink_pixels / max(1, total_pixels)
        std_dev = float(np.std(arr))

        # Blank answer heuristic: strictly require near-zero dark pixels AND low variance AND minimal stroke count.
        # If any meaningful strokes exist (ink_pixels > 15), it is never treated as blank, protecting faint
        # pencil marks and small mathematical notation from false blank classification.
        is_blank = dark_pixel_ratio < 0.0015 and std_dev < 12.0 and ink_pixels <= 15

        # Boundary stroke check: 3-pixel perimeter border and per-edge cutoff
        border_mask = np.zeros_like(ink_mask, dtype=bool)
        border_mask[:3, :] = True
        border_mask[-3:, :] = True
        border_mask[:, :3] = True
        border_mask[:, -3:] = True
        border_ink = int(np.sum(ink_mask & border_mask))
        border_total = int(np.sum(border_mask))
        border_ratio = border_ink / max(1, border_total)

        edge_max_ratio = max(
            float(np.mean(ink_mask[:3, :])),
            float(np.mean(ink_mask[-3:, :])),
            float(np.mean(ink_mask[:, :3])),
            float(np.mean(ink_mask[:, -3:])),
        )
        is_cropped = edge_max_ratio > 0.02 or border_ratio > 0.015

        return {
            "is_blank": is_blank,
            "dark_pixel_ratio": round(dark_pixel_ratio, 5),
            "std_dev": round(std_dev, 2),
            "is_cropped": is_cropped,
            "ink_detected": not is_blank and ink_pixels > 12,
        }


def crop_to_data_url(raw: bytes, box: dict, enhance_contrast: bool = True) -> str:
    """Crops a page image to `box` (page-normalised, padded slightly), enhances
    pencil/ink contrast, and returns a JPEG data: URL."""
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

        if enhance_contrast:
            # Gentle contrast boost to make faint pencil/blue ballpoint pen pop against paper
            enhancer = ImageEnhance.Contrast(crop)
            crop = enhancer.enhance(1.15)

        buf = io.BytesIO()
        crop.save(buf, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
