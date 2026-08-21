# 28 — Digital Copy UX Specification
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `23`, `24`, `25`, `26`. Extends v1's `03-FEATURE-SPECIFICATIONS.md` Teacher/Student screen inventory (`05` SRS §5.2/§5.3) with new screens specific to document-based evaluation.

---

## 1. Purpose
Define the teacher-facing and student-facing UI/UX contract for viewing, evaluating, and reviewing a "digital copy" — the scanned/photographed answer booklet — so that a coding agent building these screens has the same level of explicit guidance v1 gave for TeacherEvaluationQueue etc.

## 2. New Teacher Screen: **TeacherDigitalCopyEvaluator**
Replaces/extends `TeacherEvaluationQueue` (v1) specifically for `PHOTO_CAPTURE_SUBJECTIVE` deliveries. Layout, split-pane:

```
┌─────────────────────────────┬──────────────────────────────┐
│                               │  Question N of M               │
│      Source Page Image        │  [Question text + max marks]   │
│   (pan/zoom, page navigator)  │                                 │
│                               │  Transcript (OCR, editable)     │
│   Region overlay highlighting │  [low-confidence text           │
│   the current question's      │   underlined/highlighted]       │
│   mapped region                │                                 │
│                               │  Rubric Criteria (if present)   │
│                               │  [ ] Criterion 1 — 1/1 mark      │
│                               │  [ ] Criterion 2 — 0/1 mark      │
│                               │                                 │
│                               │  AI Suggestion: 4/5 (conf 0.82) │
│                               │  [Accept] [Adjust] [Reject]      │
│                               │                                 │
│                               │  Mistake Tag: [dropdown]         │
│                               │  Comment: [text]                 │
└─────────────────────────────┴──────────────────────────────┘
```
**Required behaviors:**
- Source image and transcript are always shown together, never transcript-only (per `24-OCR-HANDWRITING-ARCHITECTURE.md` §5's non-negotiable rule).
- AI suggestion, when present, is visually distinct from a human-entered score, and its confidence/flags are always visible, not hidden behind a tooltip.
- "Accept" creates a real `EvaluationVersion(source=TEACHER)` per `25` §4.2 — the UI must never let a teacher believe they've "done nothing" when accepting; a brief confirmation toast ("Score accepted: 4/5") reinforces this.
- Criterion-level scoring, when a rubric exists, disables direct total-marks editing (total is derived) — the UI enforces the same rule as the backend (`26` §5, `25` §4.2 edge case), not just relying on server-side rejection.
- Navigation between questions/students supports keyboard shortcuts for grading-queue speed (mirrors v1's TeacherEvaluationQueue "high-speed mark entry" design goal, `05` SRS §5.2).

## 3. New Teacher Screen: **TeacherDocumentQueue**
Manages the Document Processing pipeline's human checkpoints (`23` §5) before evaluation begins:
- List of `Document`s by status (`IDENTITY_PENDING`, `REGION_MAPPING`, `FLAGGED`, `READY_FOR_EVALUATION`).
- Identity resolution UI: side-by-side "detected roll number / name field crop" + a searchable student picker, with a confidence indicator and a "confirm" action (`30-IDENTITY-PAGE-MAPPING.md`).
- Question-mapping confirmation UI: page image with auto-detected region overlays, drag-to-adjust bounding boxes, and a "confirm all high-confidence regions" bulk action for template-matched booklets.
- Flagged-page resolution: blank/unreadable/out-of-sequence pages surfaced with a re-upload or manual-order-correction action.

## 4. New Teacher Screen: **TeacherEvaluationWorkQueue**
Cross-delivery view backing `GET /evaluation-work-items` (`25` §7) — a teacher's personal prioritized queue across all their assigned batches/subjects, sorted by AI-flag severity then submission age, replacing the need to navigate delivery-by-delivery for routine grading.

## 5. New Student Screen: **StudentDigitalCopyReview**
Extends `StudentTests` (v1) — after evaluation is `REVIEWER_FINALIZED` or the institute's policy permits earlier visibility:
- Student sees their own original page images alongside the awarded marks per question/criterion and the teacher's comments — full transparency into *why* marks were awarded or lost, directly extending the Product Vision's "no-anxiety, actionable clarity" philosophy (`Product Vision doc` §4.4) into the theory-exam context.
- Criterion-level breakdown shown exactly as scored (e.g., "Correct chemical equation: 0/1 — missing"), not just a total.
- No AI-recommendation detail is shown to students (that's an internal grading-workflow artifact, not a student-facing feature) — students see only the final, human-finalized evaluation.

## 6. Reviewer Screen: **ReviewerEvaluationConsole** (new role-scoped screen, gated by the `REVIEW_EVALUATION` permission, `21` §4.10)
Same split-pane layout as TeacherDigitalCopyEvaluator, but additionally shows the full `EvaluationVersion` chain for the response (AI → Teacher → [this reviewer]) so the reviewer has full context before overriding, not just the current state.

## 7. Accessibility & Performance
- Page image viewer supports pinch-zoom/pan on tablet (a realistic teacher grading device) as a first-class interaction, not just desktop mouse-based zoom.
- Image loading is progressive (low-res placeholder → full-res) to keep the evaluation queue feeling responsive even on modest institute-side internet connections — this directly serves the Product Vision's "meeting institutes where they are" philosophy (`Product Vision doc` §2.2).
- All 4 required states (loading/empty/error/success, per `08-ERROR-HANDLING.md` v1 §11) apply to every new screen in this document, no exceptions.

## 8. Acceptance Criteria
- [ ] Source image is always visible alongside any OCR transcript or AI suggestion — no screen in this document permits transcript-only or score-only evaluation views.
- [ ] Accepting an AI suggestion is visibly, unambiguously a distinct recorded action, not an implicit default.
- [ ] Students never see internal AI-recommendation detail, only finalized human evaluation.
- [ ] Criterion-derived totals cannot be overridden independently in the UI layer (defense-in-depth alongside the server-side rule).
