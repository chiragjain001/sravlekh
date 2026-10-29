import io
import hmac
import hashlib
import numpy as np
import cv2
import pypdfium2 as pdfium
import pytest

from src.routers.booklets import BookletPDF, BookletCoverItem, render_single_booklet_page
from src.documents.segment_and_omr import detect_qr_code, read_omr_roll_grid, segment_pdf_pages
from src.routers.reports import AcademicReportPDF, build_student_report_card

def sign_payload(signing_key: bytes, kid: str, institute_id: str, delivery_id: str, numeric_serial: int, booklet_serial: str) -> str:
    canonical = f"AIOS:V1:{kid}:{institute_id}:{delivery_id}:{numeric_serial}:{booklet_serial}"
    sig = hmac.new(signing_key, canonical.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
    return f"{canonical}:{sig}"

def test_booklet_cover_generation_and_qr_decoding():
    signing_key = b"test-secret-key"
    payload = sign_payload(signing_key, "k1", "inst-1", "del-1", 101, "BKL-101")
    pdf = BookletPDF()
    item = BookletCoverItem(
        bookletSerial="BKL-101",
        qrPayload=payload,
        examTitle="Final Exam",
        instituteName="Test Academy",
        batchName="Grade 10",
        subjectName="Science",
        scheduledDate="2026-10-15",
        durationMinutes=120,
        totalMarks=100,
        maxRollDigits=6
    )
    render_single_booklet_page(pdf, item)
    pdf_bytes = bytes(pdf.output())
    assert pdf_bytes.startswith(b"%PDF-")

    # Render with pdfium and decode QR with OpenCV
    doc = pdfium.PdfDocument(pdf_bytes)
    page = doc[0]
    pil_img = page.render(scale=2.0).to_pil()
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    detected_qr, parsed = detect_qr_code(cv_img)
    assert detected_qr == payload
    assert parsed is not None
    assert parsed["bookletSerial"] == "BKL-101"
    assert parsed["numericSerial"] == 101

def test_multi_booklet_segmentation_with_answer_pages():
    signing_key = b"test-secret-key"
    p1 = sign_payload(signing_key, "k1", "inst-1", "del-1", 1, "BKL-001")
    p2 = sign_payload(signing_key, "k1", "inst-1", "del-1", 2, "BKL-002")

    pdf1 = BookletPDF()
    render_single_booklet_page(pdf1, BookletCoverItem(
        bookletSerial="BKL-001", qrPayload=p1, examTitle="Math", instituteName="Inst",
        batchName="Batch A", subjectName="Math"
    ))
    doc1 = pdfium.PdfDocument(bytes(pdf1.output()))

    pdf2 = BookletPDF()
    render_single_booklet_page(pdf2, BookletCoverItem(
        bookletSerial="BKL-002", qrPayload=p2, examTitle="Math", instituteName="Inst",
        batchName="Batch A", subjectName="Math"
    ))
    doc2 = pdfium.PdfDocument(bytes(pdf2.output()))

    combined = pdfium.PdfDocument.new()
    # Booklet 1: Cover + blank answer page
    combined.import_pages(doc1, [0])
    combined.new_page(width=595, height=842)
    # Booklet 2: Cover + blank answer page
    combined.import_pages(doc2, [0])
    combined.new_page(width=595, height=842)

    res = segment_pdf_pages(combined, dpi=150)
    assert res.totalPdfPages == 4
    assert len(res.booklets) == 2
    assert res.booklets[0].bookletSerial == "BKL-001"
    assert res.booklets[0].pageIndices == [1, 2]
    assert res.booklets[1].bookletSerial == "BKL-002"
    assert res.booklets[1].pageIndices == [3, 4]
    assert len(res.quarantinedPages) == 0

def test_coverless_pages_quarantine():
    blank_doc = pdfium.PdfDocument.new()
    blank_doc.new_page(width=595, height=842)
    blank_doc.new_page(width=595, height=842)

    res = segment_pdf_pages(blank_doc, dpi=150)
    assert res.totalPdfPages == 2
    assert len(res.booklets) == 0
    assert res.quarantinedPages == [1, 2]

def test_omr_roll_grid_synthetic():
    page_h, page_w = 1200, 850
    cover_page = np.ones((page_h, page_w, 3), dtype=np.uint8) * 255
    crop_y1, crop_y2 = int(page_h * 0.28), int(page_h * 0.74)
    crop_x1, crop_x2 = int(page_w * 0.48), int(page_w * 0.96)
    gh = crop_y2 - crop_y1
    gw = crop_x2 - crop_x1

    target_digits = [9, 8, 7, 6, 5, 4]
    num_digits = 6
    bubble_area_y1 = int(gh * 0.16)
    bubble_area_y2 = int(gh * 0.96)
    bubble_h = (bubble_area_y2 - bubble_area_y1) / 10.0
    col_w = gw / float(num_digits)

    for c in range(num_digits):
        cx = crop_x1 + int((c + 0.5) * col_w)
        for r in range(10):
            cy = crop_y1 + int(bubble_area_y1 + (r + 0.5) * bubble_h)
            radius = int(bubble_h * 0.28)
            if r == target_digits[c]:
                cv2.circle(cover_page, (cx, cy), radius, (20, 20, 20), -1)
            else:
                cv2.circle(cover_page, (cx, cy), radius, (160, 160, 160), 2)

    roll_num, conf = read_omr_roll_grid(cover_page, num_digits=6)
    assert roll_num == "987654"
    assert conf > 0.85

def test_academic_report_generation():
    pdf = AcademicReportPDF(title_text="REPORT_CARD", report_id="REP-TEST-1")
    pdf.add_page()
    sample_payload = {
        "student": {"name": "Alice Smith", "rollNumber": "987654"},
        "batch": {"name": "Grade 10-B"},
        "scores": [
            {"exam": "Midterm", "examType": "TERM", "obtainedMarks": 88, "totalMarks": 100, "percentage": 88.0}
        ],
        "mastery": [
            {"subject": "Math", "topic": "Calculus", "masteryValue": 0.90}
        ],
        "interventions": []
    }
    build_student_report_card(pdf, sample_payload)
    out_bytes = bytes(pdf.output())
    assert out_bytes.startswith(b"%PDF-")
    assert len(out_bytes) > 1000

def test_omr_roll_grid_edge_cases():
    # 1. Test 2-digit roll number "42" in 6-column grid with leading empty columns
    page_h, page_w = 1200, 850
    cover_page = np.ones((page_h, page_w, 3), dtype=np.uint8) * 255
    crop_y1, crop_y2 = int(page_h * 0.28), int(page_h * 0.74)
    crop_x1, crop_x2 = int(page_w * 0.48), int(page_w * 0.96)
    gh, gw = crop_y2 - crop_y1, crop_x2 - crop_x1

    num_digits = 6
    bubble_area_y1 = int(gh * 0.16)
    bubble_area_y2 = int(gh * 0.96)
    bubble_h = (bubble_area_y2 - bubble_area_y1) / 10.0
    col_w = gw / float(num_digits)

    # Columns 0..3: blank. Column 4: 4. Column 5: 2.
    target_digits = {4: 4, 5: 2}
    for c in range(num_digits):
        cx = crop_x1 + int((c + 0.5) * col_w)
        for r in range(10):
            cy = crop_y1 + int(bubble_area_y1 + (r + 0.5) * bubble_h)
            radius = int(bubble_h * 0.28)
            if c in target_digits and r == target_digits[c]:
                cv2.circle(cover_page, (cx, cy), radius, (20, 20, 20), -1)
            else:
                cv2.circle(cover_page, (cx, cy), radius, (160, 160, 160), 2)

    roll_num, conf = read_omr_roll_grid(cover_page, num_digits=6)
    assert roll_num == "42", f"Expected '42' from leading blanks, got {roll_num}"
    assert conf > 0.85

    # 2. Test ambiguous double-fill in column 4 (both '4' and '8' darkened) -> should reject to None
    ambiguous_page = cover_page.copy()
    cy_extra = crop_y1 + int(bubble_area_y1 + (8 + 0.5) * bubble_h)
    cx_col4 = crop_x1 + int((4 + 0.5) * col_w)
    cv2.circle(ambiguous_page, (cx_col4, cy_extra), int(bubble_h * 0.28), (20, 20, 20), -1)
    roll_ambig, conf_ambig = read_omr_roll_grid(ambiguous_page, num_digits=6)
    assert roll_ambig is None, "Double-fill in column must return None to trigger manual review"

    # 3. Test completely blank sheet -> should return None
    blank_page = np.ones((page_h, page_w, 3), dtype=np.uint8) * 255
    roll_blank, conf_blank = read_omr_roll_grid(blank_page, num_digits=6)
    assert roll_blank is None, "Blank sheet must return None"
    assert conf_blank <= 0.35

def test_hindi_devanagari_academic_report_and_booklet():
    # Verify that Indian-language names & subjects render properly into vector PDF
    pdf = AcademicReportPDF(title_text="REPORT_CARD", report_id="REP-HINDI-01")
    pdf.add_page()
    sample_payload = {
        "student": {"name": "राहुल शर्मा (Rahul Sharma)", "rollNumber": "42"},
        "batch": {"name": "कक्षा 10-अ (Class 10-A)"},
        "scores": [
            {"exam": "गणित आवधिक परीक्षा", "examType": "TERM", "obtainedMarks": 78, "totalMarks": 80, "percentage": 97.5}
        ],
        "mastery": [
            {"subject": "गणित", "topic": "द्विघात समीकरण", "masteryValue": 0.95}
        ],
        "interventions": []
    }
    build_student_report_card(pdf, sample_payload)
    out_bytes = bytes(pdf.output())
    assert out_bytes.startswith(b"%PDF-")
    assert len(out_bytes) > 2000

    # Also test Booklet cover with Hindi institute/subject
    bkl_pdf = BookletPDF()
    item = BookletCoverItem(
        bookletSerial="BKL-HN-001",
        qrPayload="AIOS:V1:k1:inst-1:del-1:1:BKL-HN-001:sig123",
        examTitle="वार्षिक परीक्षा (Annual Exam)",
        instituteName="केंद्रीय विद्यालय (Kendriya Vidyalaya)",
        batchName="कक्षा 10",
        subjectName="हिंदी साहित्य (Hindi Literature)",
        scheduledDate="2026-10-15",
        durationMinutes=180,
        totalMarks=100,
        maxRollDigits=6
    )
    render_single_booklet_page(bkl_pdf, item)
    bkl_bytes = bytes(bkl_pdf.output())
    assert bkl_bytes.startswith(b"%PDF-")
    assert len(bkl_bytes) > 2000


def test_rotated_qr_cover_detection():
    from src.documents.segment_and_omr import detect_qr_code_with_orientation
    signing_key = b"test-secret-key"
    payload = sign_payload(signing_key, "k1", "inst-1", "del-1", 102, "BKL-ROT-102")
    pdf = BookletPDF()
    item = BookletCoverItem(
        bookletSerial="BKL-ROT-102",
        qrPayload=payload,
        examTitle="Rotated Test",
        instituteName="Rotation Academy",
        batchName="Grade 11",
        subjectName="Physics",
    )
    render_single_booklet_page(pdf, item)
    pdf_bytes = bytes(pdf.output())
    doc = pdfium.PdfDocument(pdf_bytes)
    page = doc[0]
    pil_img = page.render(scale=2.0).to_pil()
    cv_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)

    # Rotate 180 degrees (upside down)
    upside_down_img = cv2.rotate(cv_img, cv2.ROTATE_180)
    data, meta, rot_deg, oriented = detect_qr_code_with_orientation(upside_down_img)
    assert data == payload
    assert meta is not None
    assert meta["bookletSerial"] == "BKL-ROT-102"
    assert rot_deg == 180

    # Rotate 90 degrees clockwise
    rot_90_img = cv2.rotate(cv_img, cv2.ROTATE_90_CLOCKWISE)
    data_90, meta_90, rot_deg_90, _ = detect_qr_code_with_orientation(rot_90_img)
    assert data_90 == payload
    assert meta_90 is not None
    assert rot_deg_90 in (90, 270)


def test_blank_and_blurry_page_diagnostics():
    from src.documents.segment_and_omr import is_blank_page, check_image_blur

    # 1. Blank page
    blank = np.ones((800, 600, 3), dtype=np.uint8) * 255
    assert is_blank_page(blank) is True

    # 2. Page with content
    content_page = np.ones((800, 600, 3), dtype=np.uint8) * 255
    cv2.putText(content_page, "Student handwritten solution paragraph", (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
    cv2.rectangle(content_page, (50, 150), (450, 350), (0, 0, 0), 2)
    assert is_blank_page(content_page) is False

    # 3. Heavy blur
    blurred = cv2.GaussianBlur(content_page, (51, 51), 0)
    is_blurry, var = check_image_blur(blurred)
    assert is_blurry is True
    assert var < 45.0


def test_duplicate_cover_quarantine():
    signing_key = b"test-secret-key"
    payload = sign_payload(signing_key, "k1", "inst-1", "del-1", 1, "BKL-DUP-01")

    pdf = BookletPDF()
    render_single_booklet_page(pdf, BookletCoverItem(
        bookletSerial="BKL-DUP-01", qrPayload=payload, examTitle="Exam", instituteName="Inst",
        batchName="Batch", subjectName="Physics"
    ))
    doc = pdfium.PdfDocument(bytes(pdf.output()))

    # Build PDF with duplicate cover: Cover 1 + Answer page + Duplicate Cover 1
    combined = pdfium.PdfDocument.new()
    combined.import_pages(doc, [0]) # Page 1: Cover
    combined.new_page(width=595, height=842) # Page 2: Answer
    combined.import_pages(doc, [0]) # Page 3: Duplicate Cover

    res = segment_pdf_pages(combined, dpi=150)
    assert res.totalPdfPages == 3
    assert len(res.booklets) == 1
    assert res.booklets[0].bookletSerial == "BKL-DUP-01"
    assert res.booklets[0].pageIndices == [1, 2]
    # Page 3 must be quarantined as duplicate cover
    assert 3 in res.quarantinedPages
    assert len(res.segments) == len(res.booklets)
    assert res.quarantined_pages == res.quarantinedPages
