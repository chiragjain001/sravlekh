"""
AIOS Academic Report PDF Renderer.
Generates genuine, high-fidelity vector PDF reports with header branding,
KPI cards, formatted data tables, and pagination.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Response
from fpdf import FPDF
from pydantic import BaseModel

router = APIRouter(prefix="/reports", tags=["reports"])


from src.evaluation.pdf_fonts import resolve_fonts

class RenderReportPDFRequest(BaseModel):
    report_type: str
    payload: Dict[str, Any]
    report_id: str


class AcademicReportPDF(FPDF):
    def __init__(self, title_text: str = "ACADEMIC REPORT", report_id: str = "REP-001"):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.title_text = title_text
        self.report_id = report_id
        self.set_auto_page_break(auto=True, margin=20)
        self.alias_nb_pages()

        # Resolve system fonts with Devanagari (Hindi) and Math fallbacks
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
            if fonts.math and fonts.math != fonts.sans:
                self.add_font("math", "", fonts.math)
                fallbacks.append("math")
            if fallbacks:
                self.set_fallback_fonts(fallbacks, exact_match=False)
            self.set_text_shaping(True)

    def set_font(self, family: str = None, style: str = "", size: float = 0):
        if (family is None or family == "Helvetica") and getattr(self, "body_font", None) == "body":
            clean_style = "B" if "B" in (style or "").upper() else ""
            super().set_font("body", clean_style, size)
        else:
            super().set_font(family, style, size)

    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(79, 70, 229)
        self.cell(100, 6, "AIOS / SARVLEKH", align="L")
        self.set_font("Helvetica", "", 8)
        self.set_text_color(100, 116, 139)
        self.cell(90, 6, f"REPORT REF: {self.report_id}", align="R", new_x="LMARGIN", new_y="NEXT")

        self.set_font("Helvetica", "", 7)
        self.set_text_color(148, 163, 184)
        self.cell(100, 4, "SARVLEKH ACADEMIC INTELLIGENCE PLATFORM", align="L")
        self.cell(90, 4, "AUTHENTICATED RECORD", align="R", new_x="LMARGIN", new_y="NEXT")

        self.set_draw_color(226, 232, 240)
        self.line(10, 22, 200, 22)
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_draw_color(226, 232, 240)
        self.line(10, 282, 200, 282)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(148, 163, 184)
        self.cell(95, 8, "AIOS SaaS Platform | Confidential Academic Document", align="L")
        self.cell(95, 8, f"Page {self.page_no()} of {{nb}}", align="R", new_x="LMARGIN", new_y="NEXT")

    def draw_section_title(self, title: str):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(30, 41, 59)
        self.cell(190, 8, title.upper(), new_x="LMARGIN", new_y="NEXT")
        self.ln(1)


def build_student_report_card(pdf: AcademicReportPDF, payload: Dict[str, Any]):
    student = payload.get("student", {})
    name = student.get("name", "Student")
    roll = student.get("rollNumber", "N/A")
    batch_name = payload.get("batch", {}).get("name", "Standard Batch")

    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(190, 9, "Student Performance Report Card", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(190, 6, f"Student: {name}   |   Roll Number: {roll}   |   Class / Batch: {batch_name}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Summary KPI Cards
    scores = payload.get("scores", [])
    avg_pct = f"{round(sum(s.get('percentage', 0) for s in scores) / len(scores), 1)}%" if scores else "N/A"
    exam_count = str(len(scores))
    interventions = payload.get("interventions", [])
    interventions_count = str(len(interventions))
    mastery = payload.get("mastery", [])
    healthy_mastery = sum(1 for m in mastery if m.get("masteryValue", 0) >= 0.7)
    mastery_summary = f"{healthy_mastery}/{len(mastery)} HEALTHY" if mastery else "STANDARD"

    kpis = [
        ("OVERALL AVERAGE", avg_pct),
        ("ASSESSMENTS", exam_count),
        ("INTERVENTIONS", interventions_count),
        ("MASTERY STATUS", mastery_summary),
    ]

    card_w = 44
    gap = 4
    start_x = 10
    card_y = pdf.get_y() + 2

    for i, (label, val) in enumerate(kpis):
        cx = start_x + i * (card_w + gap)
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(cx, card_y, card_w, 18, "DF")

        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(100, 116, 139)
        pdf.set_xy(cx + 2, card_y + 2)
        pdf.cell(card_w - 4, 4, label, align="C")

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(15, 23, 42)
        pdf.set_xy(cx + 2, card_y + 8)
        pdf.cell(card_w - 4, 7, val, align="C")

    pdf.set_y(card_y + 24)

    # Examination Performance Table
    if scores:
        pdf.draw_section_title("Examination Performance Summary")
        pdf.set_fill_color(79, 70, 229)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(70, 7, "EXAMINATION NAME", 1, align="L", fill=True)
        pdf.cell(30, 7, "TYPE", 1, align="C", fill=True)
        pdf.cell(30, 7, "OBTAINED", 1, align="R", fill=True)
        pdf.cell(30, 7, "TOTAL", 1, align="R", fill=True)
        pdf.cell(30, 7, "PERCENTAGE", 1, align="R", fill=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(15, 23, 42)
        fill = False
        for s in scores:
            pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
            exam_name = str(s.get("exam", s.get("name", "Exam")))[:35]
            exam_type = str(s.get("examType", "TEST"))[:14]
            obtained = str(s.get("obtainedMarks", 0))
            total = str(s.get("totalMarks", 100))
            pct = f"{s.get('percentage', 0)}%"

            pdf.cell(70, 6, exam_name, 1, align="L", fill=True)
            pdf.cell(30, 6, exam_type, 1, align="C", fill=True)
            pdf.cell(30, 6, obtained, 1, align="R", fill=True)
            pdf.cell(30, 6, total, 1, align="R", fill=True)
            pdf.cell(30, 6, pct, 1, align="R", fill=True, new_x="LMARGIN", new_y="NEXT")
            fill = not fill
        pdf.ln(5)

    # Topic Mastery Table
    if mastery:
        pdf.draw_section_title("Topic Mastery Breakdown")
        pdf.set_fill_color(79, 70, 229)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(60, 7, "SUBJECT", 1, align="L", fill=True)
        pdf.cell(70, 7, "TOPIC", 1, align="L", fill=True)
        pdf.cell(30, 7, "MASTERY", 1, align="R", fill=True)
        pdf.cell(30, 7, "STATUS", 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(15, 23, 42)
        fill = False
        for m in mastery:
            pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
            subj = str(m.get("subject", "General"))[:30]
            top = str(m.get("topic", "Topic"))[:35]
            val = float(m.get("masteryValue", 0))
            pct_val = f"{round(val * 100, 1)}%"
            status = "HEALTHY" if val >= 0.7 else ("WATCH" if val >= 0.5 else "CRITICAL")

            pdf.cell(60, 6, subj, 1, align="L", fill=True)
            pdf.cell(70, 6, top, 1, align="L", fill=True)
            pdf.cell(30, 6, pct_val, 1, align="R", fill=True)
            pdf.cell(30, 6, status, 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
            fill = not fill
        pdf.ln(5)

    # Diagnostic Mistake Breakdown Table
    mistake_summary = payload.get("mistakeSummary")
    if mistake_summary:
        pdf.draw_section_title("Diagnostic Mistake Breakdown")
        pdf.set_fill_color(79, 70, 229)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(65, 7, "ERROR CATEGORY", 1, align="L", fill=True)
        pdf.cell(35, 7, "FREQUENCY", 1, align="R", fill=True)
        pdf.cell(45, 7, "MARKS LOST", 1, align="R", fill=True)
        pdf.cell(45, 7, "NATURE", 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(15, 23, 42)
        by_tag = mistake_summary.get("byTag", mistake_summary) if isinstance(mistake_summary, dict) else {}
        marks_lost_by_tag = mistake_summary.get("marksLostByTag", {}) if isinstance(mistake_summary, dict) else {}

        fill = False
        for tag, count in by_tag.items():
            if tag in ("byTag", "marksLostByTag", "byTopic", "totalMistakes"):
                continue
            pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
            clean_tag = str(tag).replace("_", " ")
            lost = marks_lost_by_tag.get(tag, "—")
            lost_str = f"{lost:.1f}" if isinstance(lost, (int, float)) else str(lost)
            nature = (
                "Systematic" if tag in ("CONCEPT_ERROR", "FORMULA_ERROR")
                else ("Execution" if tag in ("CALCULATION_ERROR", "CARELESS")
                else ("Presentation" if tag == "PRESENTATION_ERROR"
                else "Uncertain / Unclassified"))
            )

            pdf.cell(65, 6, clean_tag, 1, align="L", fill=True)
            pdf.cell(35, 6, str(count), 1, align="R", fill=True)
            pdf.cell(45, 6, lost_str, 1, align="R", fill=True)
            pdf.cell(45, 6, nature, 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
            fill = not fill
        pdf.ln(5)

    # Remediation & Interventions Status Table
    if interventions:
        pdf.draw_section_title("Remediation & Targeted Interventions")
        pdf.set_fill_color(79, 70, 229)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(60, 7, "REMEDIAL TOPIC", 1, align="L", fill=True)
        pdf.cell(40, 7, "TYPE", 1, align="C", fill=True)
        pdf.cell(30, 7, "BASELINE", 1, align="R", fill=True)
        pdf.cell(30, 7, "CURRENT", 1, align="R", fill=True)
        pdf.cell(30, 7, "STATUS", 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(15, 23, 42)
        fill = False
        for i in interventions:
            pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
            top = str(i.get("topic", "Topic"))[:30]
            itype = str(i.get("type", "ASSIGNMENT")).replace("_", " ")[:18]
            bm = f"{round(i['beforeMastery'] * 100)}%" if i.get("beforeMastery") is not None else "—"
            am = f"{round(i['afterMastery'] * 100)}%" if i.get("afterMastery") is not None else "In Progress"
            istatus = "RECOVERED" if (i.get("afterMastery") is not None and i.get("beforeMastery") is not None and i["afterMastery"] > i["beforeMastery"]) else ("COMPLETED" if i.get("afterMastery") is not None else "OPEN")

            pdf.cell(60, 6, top, 1, align="L", fill=True)
            pdf.cell(40, 6, itype, 1, align="C", fill=True)
            pdf.cell(30, 6, bm, 1, align="R", fill=True)
            pdf.cell(30, 6, am, 1, align="R", fill=True)
            pdf.cell(30, 6, istatus, 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
            fill = not fill
        pdf.ln(5)


def build_batch_report(pdf: AcademicReportPDF, payload: Dict[str, Any]):
    batch = payload.get("batch", {})
    batch_name = batch.get("name", "Cohort")
    class_year = batch.get("classYear", "Class")

    pdf.set_font("Helvetica", "B", 16)
    pdf.set_text_color(15, 23, 42)
    pdf.cell(190, 9, "Cohort Performance Analysis Report", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(71, 85, 105)
    pdf.cell(190, 6, f"Batch: {batch_name}   |   Academic Level: {class_year}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Summary KPI Cards — robust against None values
    cohort_avg_val = batch.get('cohortAverage')
    cohort_avg = f"{cohort_avg_val}%" if cohort_avg_val is not None else "N/A"
    total_exams = str(batch.get("totalExams", 0))
    int_rate_val = batch.get('interventionSuccessRate')
    intervention_rate = f"{int_rate_val}%" if int_rate_val is not None else "N/A"
    asg_rate_val = batch.get('assignmentCompletionRate')
    assignment_rate = f"{asg_rate_val}%" if asg_rate_val is not None else "N/A"

    kpis = [
        ("COHORT AVERAGE", cohort_avg),
        ("TOTAL ASSESSMENTS", total_exams),
        ("REMEDIATION SUCCESS", intervention_rate),
        ("ASSIGNMENT RATE", assignment_rate),
    ]

    card_w = 44
    gap = 4
    start_x = 10
    card_y = pdf.get_y() + 2

    for i, (label, val) in enumerate(kpis):
        cx = start_x + i * (card_w + gap)
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(cx, card_y, card_w, 18, "DF")

        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(100, 116, 139)
        pdf.set_xy(cx + 2, card_y + 2)
        pdf.cell(card_w - 4, 4, label, align="C")

        pdf.set_font("Helvetica", "B", 12)
        pdf.set_text_color(15, 23, 42)
        pdf.set_xy(cx + 2, card_y + 8)
        pdf.cell(card_w - 4, 7, val, align="C")

    pdf.set_y(card_y + 24)

    # Student Roster Table — resolves either payload.roster or batch.roster
    roster = payload.get("roster") or batch.get("roster", [])
    if roster:
        pdf.draw_section_title("Student Performance Roster")
        pdf.set_fill_color(79, 70, 229)
        pdf.set_text_color(255, 255, 255)
        pdf.set_font("Helvetica", "B", 8)
        pdf.cell(20, 7, "ROLL NO", 1, align="C", fill=True)
        pdf.cell(60, 7, "STUDENT NAME", 1, align="L", fill=True)
        pdf.cell(30, 7, "AVERAGE", 1, align="R", fill=True)
        pdf.cell(25, 7, "EXAMS", 1, align="C", fill=True)
        pdf.cell(25, 7, "IMPROVED", 1, align="C", fill=True)
        pdf.cell(30, 7, "ASSIGNMENTS", 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")

        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(15, 23, 42)
        fill = False
        for s in roster:
            pdf.set_fill_color(248, 250, 252) if fill else pdf.set_fill_color(255, 255, 255)
            roll = str(s.get("rollNumber") or "-")
            name = str(s.get("name", "Student"))[:28]
            avg = f"{round(s['averagePercentage'], 1)}%" if s.get("averagePercentage") is not None else "-"
            exams = str(s.get("examCount", 0))
            improved = str(s.get("improvedCount", 0))
            completed_assignments = f"{s.get('completedAssignmentsCount', 0)}/{s.get('assignmentsCount', 0)}"

            pdf.cell(20, 6, roll, 1, align="C", fill=True)
            pdf.cell(60, 6, name, 1, align="L", fill=True)
            pdf.cell(30, 6, avg, 1, align="R", fill=True)
            pdf.cell(25, 6, exams, 1, align="C", fill=True)
            pdf.cell(25, 6, improved, 1, align="C", fill=True)
            pdf.cell(30, 6, completed_assignments, 1, align="C", fill=True, new_x="LMARGIN", new_y="NEXT")
            fill = not fill
    else:
        pdf.draw_section_title("Student Performance Roster")
        pdf.set_fill_color(248, 250, 252)
        pdf.set_draw_color(226, 232, 240)
        pdf.rect(10, pdf.get_y(), 190, 14, "DF")
        pdf.set_font("Helvetica", "I", 9)
        pdf.set_text_color(100, 116, 139)
        pdf.cell(190, 14, "No student records found in this cohort for the selected period.", align="C", new_x="LMARGIN", new_y="NEXT")


@router.post("/render-pdf")
def render_report_pdf(req: RenderReportPDFRequest):
    """
    Renders an academic report data payload into genuine vector PDF binary bytes.
    """
    try:
        pdf = AcademicReportPDF(title_text=req.report_type, report_id=req.report_id)
        pdf.add_page()

        if req.report_type in ("REPORT_CARD", "PROGRESS_CARD", "IMPROVEMENT_SHEET"):
            build_student_report_card(pdf, req.payload)
        else:
            build_batch_report(pdf, req.payload)

        pdf_bytes = bytes(pdf.output())

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={req.report_id}.pdf",
                "X-Generated-Pages": str(pdf.page_no()),
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to render report PDF: {str(e)}")
