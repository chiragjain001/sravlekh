"""Generate PDF grading reports for teacher review with editable marks.

A grading report shows:
- Question content
- Student's answer
- AI-suggested marks (total + per-criteria breakdown)
- Confidence and flags
- Note for teacher to edit and approve
"""

import json
from dataclasses import dataclass
from datetime import datetime


@dataclass
class CriterionGrade:
    rubric_criterion_id: str
    description: str
    max_marks: float
    awarded_marks: float
    note: str | None = None


@dataclass
class GradingReportData:
    """Complete grading information for a single response (one student answer)."""

    student_name: str
    question_content: str
    student_answer: str
    ai_suggested_marks: float
    max_marks: float
    criteria_grades: list[CriterionGrade] | None = None
    confidence: float = 0.0
    flags: list[str] | None = None
    ai_note: str | None = None
    evidence_type: str = "DIGITAL"  # DIGITAL or PAGE_REGION


def generate_grading_report_html(report: GradingReportData) -> str:
    """Generate an HTML grading report that teachers can review and edit in a modal/dialog.

    Output: interactive HTML with:
    - Read-only question + student answer
    - Editable marks (total + per-criterion)
    - Flags and confidence display
    - Teacher review notes field
    - Accept/Override buttons
    """

    criteria_rows = ""
    if report.criteria_grades:
        for crit in report.criteria_grades:
            criteria_rows += f"""
            <tr class="border-t border-slate-200">
              <td class="px-3 py-2 text-[12px] text-slate-600">{crit.description}</td>
              <td class="px-3 py-2 text-[12px] text-slate-600 text-right">{crit.max_marks}</td>
              <td class="px-3 py-2">
                <input type="number" min="0" max="{crit.max_marks}" step="0.5"
                       value="{crit.awarded_marks}"
                       data-criterion-id="{crit.rubric_criterion_id}"
                       class="criterion-marks w-16 px-2 py-1 border border-slate-300 rounded text-[12px]" />
              </td>
              <td class="px-3 py-2 text-[12px] text-slate-600 italic">{crit.note or '-'}</td>
            </tr>
            """

    flags_html = ""
    if report.flags:
        flags_html = "<div class='flex flex-wrap gap-1 mt-2'>"
        for flag in report.flags:
            color = "bg-amber-100 text-amber-700" if flag == "low_confidence" else "bg-slate-100 text-slate-600"
            flags_html += f'<span class="text-[10px] font-bold px-2 py-1 rounded {color}">{flag.replace("_", " ").upper()}</span>'
        flags_html += "</div>"

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Grading Report - {report.student_name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
            .answer-box {{ max-height: 300px; overflow-y: auto; }}
        </style>
    </head>
    <body class="bg-slate-50 p-6">
        <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-lg p-8">
            <!-- Header -->
            <div class="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                <div>
                    <h1 class="text-[24px] font-bold text-slate-900">Grading Report</h1>
                    <p class="text-[13px] text-slate-500">Student: <strong>{report.student_name}</strong></p>
                </div>
                <div class="text-right text-[12px] text-slate-500">
                    Generated: {datetime.now().strftime('%b %d, %Y %H:%M')}
                </div>
            </div>

            <!-- Question -->
            <div class="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p class="text-[12px] font-bold text-slate-600 mb-2">QUESTION</p>
                <p class="text-[14px] text-slate-800 leading-relaxed">{report.question_content}</p>
            </div>

            <!-- Student Answer -->
            <div class="mb-6">
                <p class="text-[12px] font-bold text-slate-600 mb-2">STUDENT'S ANSWER</p>
                <div class="answer-box p-4 bg-slate-50 rounded-lg border border-slate-200 text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">
                    {report.student_answer}
                </div>
            </div>

            <!-- Grading Section -->
            <div class="mb-6">
                <p class="text-[12px] font-bold text-slate-600 mb-3">AI RECOMMENDATION & TEACHER REVIEW</p>

                <!-- Confidence & Flags -->
                <div class="mb-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-[12px] font-semibold text-indigo-700">Confidence: {report.confidence:.0%}</span>
                        <span class="text-[11px] text-indigo-600">{report.ai_note}</span>
                    </div>
                    {flags_html}
                </div>

                <!-- Marks Table -->
                <table class="w-full mb-4 border-collapse">
                    <thead>
                        <tr class="bg-slate-100">
                            <th class="px-3 py-2 text-left text-[12px] font-bold text-slate-700">Criterion / Component</th>
                            <th class="px-3 py-2 text-right text-[12px] font-bold text-slate-700">Max</th>
                            <th class="px-3 py-2 text-right text-[12px] font-bold text-slate-700">Marks Awarded</th>
                            <th class="px-3 py-2 text-left text-[12px] font-bold text-slate-700">AI Note</th>
                        </tr>
                    </thead>
                    <tbody>
                        {criteria_rows if criteria_rows else f'<tr class="border-t border-slate-200"><td colspan="4" class="px-3 py-2 text-[12px] text-slate-500 italic">No rubric criteria — holistic scoring</td></tr>'}
                        <tr class="bg-slate-50 font-bold">
                            <td class="px-3 py-2 text-[13px] text-slate-900">TOTAL</td>
                            <td class="px-3 py-2 text-right text-[13px] text-slate-900">{report.max_marks}</td>
                            <td class="px-3 py-2 text-right">
                                <input type="number" min="0" max="{report.max_marks}" step="0.5"
                                       value="{report.ai_suggested_marks}" id="total-marks"
                                       class="total-marks font-bold px-2 py-1 border-2 border-indigo-300 rounded text-[13px] w-20 text-right" />
                            </td>
                            <td class="px-3 py-2 text-[12px] text-slate-600 italic">AI suggested</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Teacher Review Notes -->
                <div class="mb-4">
                    <label class="block text-[12px] font-bold text-slate-700 mb-2">Teacher Review Notes</label>
                    <textarea id="teacher-notes" placeholder="Optional: Explain any changes you made..."
                              class="w-full px-3 py-2 border border-slate-300 rounded-lg text-[12px] leading-relaxed"
                              rows="3"></textarea>
                </div>

                <!-- Action Buttons -->
                <div class="flex gap-3 pt-4 border-t border-slate-200">
                    <button id="accept-btn" class="flex-1 px-4 py-2.5 bg-emerald-600 text-white text-[12px] font-bold rounded-lg hover:bg-emerald-700">
                        ✓ Accept & Submit
                    </button>
                    <button id="edit-btn" class="flex-1 px-4 py-2.5 bg-slate-200 text-slate-700 text-[12px] font-bold rounded-lg hover:bg-slate-300">
                        ← Back to Edit
                    </button>
                </div>
            </div>
        </div>

        <script>
            // Return grading data when user submits
            window.getGradingData = function() {{
                const totalMarks = parseFloat(document.getElementById('total-marks').value) || 0;
                const criteriaMarks = {{}};
                document.querySelectorAll('.criterion-marks').forEach(input => {{
                    criteriaMarks[input.dataset.criterionId] = parseFloat(input.value) || 0;
                }});
                const teacherNotes = document.getElementById('teacher-notes').value;
                return {{ totalMarks, criteriaMarks, teacherNotes }};
            }};
        </script>
    </body>
    </html>
    """

    return html


def generate_grading_report_json(report: GradingReportData) -> dict:
    """Generate a JSON representation for API responses."""
    return {
        "studentName": report.student_name,
        "questionContent": report.question_content,
        "studentAnswer": report.student_answer,
        "aiSuggestedMarks": report.ai_suggested_marks,
        "maxMarks": report.max_marks,
        "criteriaGrades": [
            {
                "rubricCriterionId": crit.rubric_criterion_id,
                "description": crit.description,
                "maxMarks": crit.max_marks,
                "awardedMarks": crit.awarded_marks,
                "note": crit.note,
            }
            for crit in (report.criteria_grades or [])
        ],
        "confidence": report.confidence,
        "flags": report.flags or [],
        "aiNote": report.ai_note,
        "evidenceType": report.evidence_type,
    }
