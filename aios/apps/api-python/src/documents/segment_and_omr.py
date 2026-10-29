import io
import logging
import base64
from typing import List, Optional, Tuple, Dict, Any

import cv2
import numpy as np
import pypdfium2 as pdfium
from pydantic import BaseModel, Field

from src.image_fetch import fetch_bytes, ImageFetchError

logger = logging.getLogger(__name__)

PDF_MAGIC = b"%PDF-"
MAX_PDF_BYTES = 50 * 1024 * 1024  # 50 MB for multi-booklet bulk PDF scans
DEFAULT_DPI = 150
JPEG_QUALITY = 82
MAX_PAGE_SIDE = 2400


class PageDiagnostic(BaseModel):
    pageNumber: int
    isCover: bool = False
    rotationDegrees: int = 0
    isBlank: bool = False
    isBlurry: bool = False
    bookletSerial: Optional[str] = None
    isQuarantined: bool = False
    quarantineReason: Optional[str] = None


class SegmentedBooklet(BaseModel):
    bookletSerial: Optional[str] = None
    numericSerial: Optional[int] = None
    qrPayload: Optional[str] = None
    detectedRollNumber: Optional[str] = None
    confidence: float = 0.0
    isQuarantined: bool = False
    quarantineReason: Optional[str] = None
    pageIndices: List[int] = Field(default_factory=list)
    deliveryId: Optional[str] = None
    instituteId: Optional[str] = None


class BulkSegmentRequest(BaseModel):
    pdfUrl: str
    dpi: int = Field(default=DEFAULT_DPI, ge=72, le=300)
    maxPages: int = Field(default=200, ge=1, le=500)


class BulkSegmentResponse(BaseModel):
    totalPdfPages: int
    booklets: List[SegmentedBooklet]
    segments: List[SegmentedBooklet] = Field(default_factory=list)
    quarantinedPages: List[int] = Field(default_factory=list)
    quarantined_pages: List[int] = Field(default_factory=list)
    pageDiagnostics: List[PageDiagnostic] = Field(default_factory=list)


def is_blank_page(cv_image: np.ndarray) -> bool:
    """Detects whether a scanned page is blank or has negligible markings (<0.5% dark pixels)."""
    gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY) if len(cv_image.shape) == 3 else cv_image
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    dark_ratio = float(np.sum(thresh == 255)) / float(thresh.size)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return dark_ratio < 0.005 and laplacian_var < 50.0


def check_image_blur(cv_image: np.ndarray) -> Tuple[bool, float]:
    """Returns (is_blurry, variance). Variance < 45 on non-blank page indicates unreadable blur."""
    gray = cv2.cvtColor(cv_image, cv2.COLOR_BGR2GRAY) if len(cv_image.shape) == 3 else cv_image
    var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    return (var < 45.0, round(var, 2))


def detect_qr_code(cv_image: np.ndarray) -> Tuple[Optional[str], Optional[dict]]:
    """Backward-compatible QR detector; delegates to detect_qr_code_with_orientation."""
    qr_data, meta, _, _ = detect_qr_code_with_orientation(cv_image)
    return qr_data, meta


def detect_qr_code_with_orientation(cv_image: np.ndarray) -> Tuple[Optional[str], Optional[dict], int, np.ndarray]:
    """
    Detects and decodes QR code in image across 0, 90, 180, and 270 degree rotations.
    Identifies the canonical upright orientation where the cover QR code sits in the upper-right quadrant.
    Returns (qr_payload, parsed_meta, rotation_degrees, oriented_image).
    """
    detector = cv2.QRCodeDetector()

    rotations = [
        (0, None),
        (180, cv2.ROTATE_180),
        (90, cv2.ROTATE_90_CLOCKWISE),
        (270, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]

    best_match = None

    for angle, rot_code in rotations:
        candidate_img = cv2.rotate(cv_image, rot_code) if rot_code is not None else cv_image
        h, w = candidate_img.shape[:2]

        # Prioritize upper-right quadrant where cover QR is designed to sit
        crop_ur = candidate_img[0:int(h * 0.45), int(w * 0.45):w]
        data, points_ur, _ = detector.detectAndDecode(crop_ur)

        if data and data.startswith("AIOS:V1:"):
            # QR found right inside upper-right quadrant -> definitely upright!
            parts = data.strip().split(":")
            parsed = None
            if len(parts) == 8:
                parsed = {
                    "version": parts[1],
                    "keyId": parts[2],
                    "instituteId": parts[3],
                    "deliveryId": parts[4],
                    "numericSerial": int(parts[5]) if parts[5].isdigit() else None,
                    "bookletSerial": parts[6],
                    "signature": parts[7],
                }
            return data, parsed, angle, candidate_img

        # Full-frame scan fallback
        data, points, _ = detector.detectAndDecode(candidate_img)

        if data and data.startswith("AIOS:V1:"):
            parts = data.strip().split(":")
            parsed = None
            if len(parts) == 8:
                parsed = {
                    "version": parts[1],
                    "keyId": parts[2],
                    "instituteId": parts[3],
                    "deliveryId": parts[4],
                    "numericSerial": int(parts[5]) if parts[5].isdigit() else None,
                    "bookletSerial": parts[6],
                    "signature": parts[7],
                }

            if points is not None and len(points) > 0:
                pts = points.reshape(-1, 2)
                cy = float(np.mean(pts[:, 1]))
                cx = float(np.mean(pts[:, 0]))
                if cy < h * 0.48 and cx > w * 0.40:
                    return data, parsed, angle, candidate_img

            if best_match is None:
                best_match = (data, parsed, angle, candidate_img)

    if best_match is not None:
        return best_match

    return None, None, 0, cv_image


def read_omr_roll_grid(cv_image: np.ndarray, num_digits: int = 6) -> Tuple[Optional[str], float]:
    """
    Locates and reads the roll number bubble grid on a cover page.
    The bubble grid is in the right-middle section of the cover sheet (x: 48%..96%, y: 28%..74%).
    Returns (detected_roll_number, confidence_score between 0.0 and 1.0).
    """
    h, w = cv_image.shape[:2]
    crop_y1, crop_y2 = int(h * 0.28), int(h * 0.74)
    crop_x1, crop_x2 = int(w * 0.48), int(w * 0.96)
    grid_crop = cv_image[crop_y1:crop_y2, crop_x1:crop_x2]

    if grid_crop.size == 0:
        return None, 0.0

    gray = cv2.cvtColor(grid_crop, cv2.COLOR_BGR2GRAY) if len(grid_crop.shape) == 3 else grid_crop
    gh, gw = gray.shape

    # Apply Otsu's binary thresholding (dark pen markings become 255)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    box_header_ratio = 0.16
    bubble_area_y1 = int(gh * box_header_ratio)
    bubble_area_y2 = int(gh * 0.96)
    bubble_h = (bubble_area_y2 - bubble_area_y1) / 10.0

    col_w = gw / float(num_digits)
    detected_digits = []
    confidences = []

    for c in range(num_digits):
        cx = int((c + 0.5) * col_w)
        radius_x = int(col_w * 0.22)
        radius_y = int(bubble_h * 0.32)

        row_densities = []
        for digit in range(10):
            cy = int(bubble_area_y1 + (digit + 0.5) * bubble_h)

            y1 = max(0, cy - radius_y)
            y2 = min(gh, cy + radius_y)
            x1 = max(0, cx - radius_x)
            x2 = min(gw, cx + radius_x)

            mask_roi = thresh[y1:y2, x1:x2]
            if mask_roi.size > 0:
                fill_density = float(np.sum(mask_roi == 255)) / float(mask_roi.size)
            else:
                fill_density = 0.0

            row_densities.append(fill_density)

        best_digit = int(np.argmax(row_densities))
        max_density = row_densities[best_digit]
        sorted_densities = sorted(row_densities, reverse=True)
        second_highest = sorted_densities[1] if len(sorted_densities) > 1 else 0.0

        # Contrast & fill check:
        # 1. Blank column: highest density < 0.35 (empty circle outlines are ~0.20-0.28)
        # 2. Multi-bubble filled: second highest density >= 0.35 (student darkened multiple bubbles)
        # 3. Confident single bubble: max_density >= 0.35, second_highest < 0.35, contrast margin > 0.12
        # 4. Ambiguous / faint mark / smudge: otherwise -> '?'
        if max_density < 0.35:
            detected_digits.append("_")
            confidences.append(0.95)
        elif second_highest >= 0.35:
            detected_digits.append("?")
            confidences.append(0.30)
        elif (max_density - second_highest) > 0.12:
            detected_digits.append(str(best_digit))
            conf = min(0.99, 0.70 + (max_density - second_highest))
            confidences.append(conf)
        else:
            detected_digits.append("?")
            confidences.append(0.30)

    # If every column is blank, student didn't fill roll number
    if all(d == "_" for d in detected_digits):
        return None, 0.30

    # If any column is ambiguous (smudge, double-fill, faint), reject to manual review
    if "?" in detected_digits:
        avg_conf = float(np.mean(confidences)) if confidences else 0.0
        return None, round(avg_conf, 2)

    # Strip leading blank columns
    first_digit_idx = next((i for i, d in enumerate(detected_digits) if d != "_"), None)
    if first_digit_idx is None:
        return None, 0.30

    active_digits = detected_digits[first_digit_idx:]
    if "_" in active_digits:
        return None, 0.35

    roll_number = "".join(active_digits)
    active_confidences = confidences[first_digit_idx:]
    avg_conf = float(np.mean(active_confidences)) if active_confidences else 0.0
    return roll_number, round(avg_conf, 2)


def segment_pdf_pages(document: pdfium.PdfDocument, dpi: int = DEFAULT_DPI, max_pages: int = 200) -> BulkSegmentResponse:
    """
    Renders PDF pages and segments them into individual booklets using cover QR codes as boundaries.
    Handles rotated pages, deskew, blank pages, and duplicate cover scans.
    """
    page_count = len(document)
    if page_count == 0:
        return BulkSegmentResponse(totalPdfPages=0, booklets=[], segments=[], quarantinedPages=[], quarantined_pages=[], pageDiagnostics=[])

    effective_pages = min(page_count, max_pages)
    booklets: List[SegmentedBooklet] = []
    quarantined: List[int] = []
    diagnostics: List[PageDiagnostic] = []
    seen_serials = set()

    current_booklet: Optional[SegmentedBooklet] = None

    for page_idx in range(effective_pages):
        page_num = page_idx + 1
        page = document[page_idx]
        pil_img = page.render(scale=dpi / 72).to_pil().convert("RGB")
        cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

        # Check if page is blank or blurry
        is_blank = is_blank_page(cv_img)
        is_blurry, blur_var = check_image_blur(cv_img)

        # Attempt QR detection with multi-angle rotation support
        qr_str, qr_meta, rot_deg, oriented_img = detect_qr_code_with_orientation(cv_img)

        if qr_str and qr_meta:
            serial = qr_meta.get("bookletSerial")
            # If a duplicate cover page is detected within the same scan batch
            if serial and serial in seen_serials:
                diag = PageDiagnostic(
                    pageNumber=page_num,
                    isCover=True,
                    rotationDegrees=rot_deg,
                    isBlank=False,
                    isBlurry=is_blurry,
                    bookletSerial=serial,
                    isQuarantined=True,
                    quarantineReason=f"Duplicate cover scan for booklet {serial}",
                )
                diagnostics.append(diag)
                quarantined.append(page_num)
                continue

            if serial:
                seen_serials.add(serial)

            # Finalize previous booklet if any
            if current_booklet:
                booklets.append(current_booklet)

            roll_num, roll_conf = read_omr_roll_grid(oriented_img, num_digits=6)

            current_booklet = SegmentedBooklet(
                bookletSerial=serial,
                numericSerial=qr_meta.get("numericSerial"),
                qrPayload=qr_str,
                detectedRollNumber=roll_num,
                confidence=roll_conf if roll_num else 0.40,
                deliveryId=qr_meta.get("deliveryId"),
                instituteId=qr_meta.get("instituteId"),
                pageIndices=[page_num],
            )

            diag = PageDiagnostic(
                pageNumber=page_num,
                isCover=True,
                rotationDegrees=rot_deg,
                isBlank=False,
                isBlurry=is_blurry,
                bookletSerial=serial,
                isQuarantined=False,
            )
            diagnostics.append(diag)
        else:
            # Not a cover page
            if current_booklet is not None:
                current_booklet.pageIndices.append(page_num)
                diag = PageDiagnostic(
                    pageNumber=page_num,
                    isCover=False,
                    rotationDegrees=0,
                    isBlank=is_blank,
                    isBlurry=is_blurry,
                    bookletSerial=current_booklet.bookletSerial,
                    isQuarantined=False,
                )
                diagnostics.append(diag)
            else:
                # Coverless page before first detected cover -> Quarantine
                quarantined.append(page_num)
                diag = PageDiagnostic(
                    pageNumber=page_num,
                    isCover=False,
                    rotationDegrees=0,
                    isBlank=is_blank,
                    isBlurry=is_blurry,
                    isQuarantined=True,
                    quarantineReason="Coverless page appearing before any valid booklet cover",
                )
                diagnostics.append(diag)

    if current_booklet:
        booklets.append(current_booklet)

    return BulkSegmentResponse(
        totalPdfPages=effective_pages,
        booklets=booklets,
        segments=booklets,
        quarantinedPages=quarantined,
        quarantined_pages=quarantined,
        pageDiagnostics=diagnostics,
    )
