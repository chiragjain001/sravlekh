# DIGITAL ANSWER SHEET — AI-ASSISTED EVALUATION FLOW

STATUS: LIVING DOCUMENT. Describes what the code does today, verified end to end against the
disposable staging stack (`infra/staging/`). Where an older doc disagrees, this one is
authoritative for current behaviour; where something is not built, it says so.

**Positioning, and the rule the whole design follows:** *AI-assisted subjective answer evaluation
with teacher verification.* The AI reads handwriting, proposes marks and splits them tag-wise. A
teacher reviews, edits and submits. **No AI suggestion ever becomes an official mark on its own**
(32-AI-GOVERNANCE-POLICY.md §2), and the code enforces that in three independent places:
`ScoreAggregationService` counts only human-authored current versions, `ai_evaluator.py` refuses to
write over an answer a teacher has approved, and the LOCK gate blocks an assessment with
unevaluated answers.

---

## 1. The flow, end to end

Teacher → **Digital Answer Sheets** → pick the assessment → **Upload Booklet**

| # | Step | Who / what | Where in code |
| :-- | :--- | :--- | :--- |
| 1 | Upload one booklet: page images **or a single PDF** | Teacher | `documents.service.ts` `uploadDocument` |
| 2 | A PDF is rendered into page images (queued) | `pdf-split` worker → api-python | `documents.service.ts` `splitPdfDocument`, `documents/pdf_render.py` |
| 3 | Confirm which student the booklet belongs to | Teacher | `identity-resolution.service.ts` |
| 4 | **Suggest regions** — one box per answer, with a confidence | AI (vision) | `documents/region_detect.py`, `documents.service.ts` `detectRegions` |
| 5 | Correct the boxes: move, resize, split, merge, delete, map to a question | Teacher | `PageImageViewer.tsx`, `DocumentDetailPanel.tsx` |
| 6 | **Run OCR** — each region is cropped and read on its own | AI (vision) | `ocr.service.ts` → `routers/ocr.py` → `handwriting_ocr.py` |
| 7 | **Check with AI** — marks + tag-wise split per answer | AI | `checked-copy.service.ts` `runAiCheck` → `ai_evaluator.py` |
| 8 | Review every answer, edit any tag's marks, add remarks | Teacher | `CheckedCopyReview.tsx` |
| 9 | **Submit final marks** (all-or-nothing, confirmation required) | Teacher | `checked-copy.service.ts` `submit` |
| 10 | ScoreRecord, mastery, reports update; checked-copy PDF is stored | System | `score-aggregation.service.ts`, `analytics.service.ts`, `checked_copy_pdf.py` |

Objective answers captured digitally (MCQ tapped in an app, OMR bubbles) never enter this flow —
they are scored at capture. **Anything handwritten on a page does enter it**, whatever the question
type: a NUMERICAL worked out in a booklet is a page of working that a human must mark
(`needsHumanEvaluation`, mirrored in `analytics/evaluation_status.py`).

---

## 2. Upload and PDF rendering

* Accepted: `image/jpeg`, `image/png`, `image/webp` (10 MB each, up to 60 per booklet) or **one
  `application/pdf`** (25 MB, 60 pages).
* **The bytes decide the type, not the Content-Type header** (`upload-validation.ts` sniffs the
  file signature), and **storage keys are generated** (`page-3.jpg`, `source.pdf`) — a crafted
  filename cannot steer where an object lands.
* A PDF is stored privately as `institutes/<id>/documents/<doc>/source.pdf`, the document goes to
  `PAGE_PROCESSING`, and the `pdf-split` queue renders pages through api-python (pdfium, 150 dpi,
  JPEG). Pages are written in one transaction, so a retry after a partial failure starts clean.
* A PDF the renderer cannot use (password-protected, corrupt, too many pages) fails the document
  **with the reason on the processing job** (`ProcessingJob.errorMessage`) instead of retrying
  forever. "Retry processing" re-queues it.
* Not implemented, and deliberately not pretended: malware scanning, EXIF stripping
  (17-THIRD-PARTY-INTEGRATIONS.md — no provider wired).

## 3. Region detection and teacher control

`POST /documents/:id/detect-regions` asks the vision model for one box per answer on each page that
has none, with a confidence and the question number it believes the answer belongs to.

* Confidence ≥ 0.7 **and** a question on this paper → the region is created mapped.
* Otherwise the region is created **unmapped**: the teacher picks the question. A wrong mapping is
  worse than none, because OCR would then read one answer as another question's.
* Pages that already have answer regions are skipped — a teacher's work is never overwritten.
* A page whose detection call fails is skipped, not fatal; manual marking always works.
* Teacher controls (all real, all in `DocumentDetailPanel`/`PageImageViewer`): draw, **drag to
  move**, **corner-resize**, **split** a box in half, **merge** with the next, **delete**, and
  **re-map** to a different question.

**Editing a box invalidates the OCR read from the old box.** `OCRBlock.boundingBox` records the
page-normalised box that was actually read; a reading whose box no longer matches the region is
treated as stale everywhere (`shared/region-box.ts`, `ocr/region_box.py`): the UI shows
"RE-READ NEEDED", `OcrService` re-queues it, and the evaluator refuses to grade on it.

**Deleting or re-mapping a region deletes the answer it is evidence for** — and with it any marks.
If those marks were confirmed by a teacher, the API refuses with `REGION_HAS_FINAL_MARKS` and the
UI asks before sending `discardMarks: true`.

## 4. OCR

Each region is **cropped from the page** and sent on its own (`region_box.crop_to_data_url`). This
is load-bearing: before it, the whole page went to the model for every region, so on a page with
two answers each answer's transcript contained both — and the second answer was graded against the
first's text.

Confidence is the model's **own self-report**, not a calibrated metric (surfaced as such by
`AiConfidenceBadge`). Below 0.5, or when the model reports the region as needing visual evaluation,
the answer is routed to the teacher and never graded (`OCR_ILLEGIBLE_CONFIDENCE_THRESHOLD`,
mirrored on both sides).

## 5. AI evaluation and tag-wise marks

`ai_evaluator.py` produces an `AIRecommendation` plus a chained `EvaluationVersion(source=AI)`:

* **With a reference answer** (`Question.solution`): graded against it (prompt version `v3`).
* **Without one**: the model solves the question itself, records that solution, and grades against
  it (prompt version `v3-no-reference`). The result is flagged `no_reference_answer` so the teacher
  knows nothing authoritative stood behind it, and the model's own solution is shown in the review
  screen and the PDF.
* **Tag-wise split**: 2–5 parts (`FORMULA`, `CALCULATION`, `FINAL_ANSWER`, `CONCEPT`, `KEY_POINTS`,
  …), each with its own max and awarded marks, plus a verdict, a mistake tag and a note. The
  question's total is the **sum of the parts**, each part clamped to its own max. If the parts do
  not add up to the question's marks, the result is flagged `breakdown_mismatch` for review.
* Rubric-scored questions keep their rubric criteria; the tag split is for questions without one.
* Unusable outcomes never become marks: a timeout (40 s), truncated output, unparseable output, an
  illegible transcript or a deconfigured model all route to the human queue with a recorded reason.

**Model, provider and prompt are tracked per recommendation.** The registry chain
(`AIProvider → AIModel → AIModelVersion`) is resolved **for the provider actually in use**, so a
Gemini-backed deployment records Gemini — and deactivating that version is a real kill switch for
it. `modelParameters` is derived from the request that was sent, and the prompt template stored as
`PromptVersion.promptTemplate` is the same constant the code renders.

## 6. Teacher review and submission

`GET /attempts/:id/checked-copy` returns the whole sheet: every answer's state
(`NEEDS_OCR` · `ILLEGIBLE` · `READY_FOR_AI` · `AI_SUGGESTED` · `REVIEWED`), the transcript, the AI's
marks, tags, flags and solution, the region on the page, and the current ScoreRecord.

`POST /attempts/:id/checked-copy/submit` is the moment marks become official:

* `confirmed: true` is required (the teacher ticks "I have checked every answer").
* **Every** subjective answer must be included — a half-checked sheet is refused.
* Marks are derived from the tags the teacher submits; a mismatch between a stated total and its
  tags is refused, as is a tag over its own max or a total over the question's marks.
* All answers are written in **one transaction**, each with a compare-and-swap on the evaluation's
  current-version pointer. If an AI check committed while the teacher was reviewing, nothing is
  saved and the teacher is asked to reload (`CHECKED_COPY_CHANGED`).
* Re-submitting an unchanged, already-approved answer writes no new version (idempotent).
* A LOCKED assessment refuses edits until an admin unlocks it.

After the transaction: ScoreRecord is recalculated **synchronously** (so the teacher sees the new
total immediately), mastery recalculation is queued for the affected topics, an audit row records
every per-answer decision, and the final checked-copy PDF is generated and stored.

## 7. The checked copy (PDF)

`POST /attempts/:id/checked-copy/pdf` renders and stores the copy, returning a short-lived signed
URL. DRAFT before submission (banner: "AI-suggested marks, not yet confirmed"), FINAL after, naming
the reviewing teacher and date.

* Page 1 is a summary: student, total with percentage, and a table of every question — marks,
  verdict, tag-wise split, mistake tag and remark.
* Then **every scanned page, embedded unchanged** (a JPEG scan is passed through byte for byte),
  with each answer boxed in red and its marks and tags drawn over it as vector text.
* **Totals are checked before anything is printed**: if the per-question marks do not add up to the
  stated total — or, on a FINAL copy, if the tags do not add up to their question's marks — the
  render is refused (422) rather than printing a wrong number.
* Text is real, selectable PDF text with **embedded subset fonts**, shaped by HarfBuzz, so Hindi
  matras and conjuncts are correct. LaTeX-ish content is converted to readable Unicode
  (`\frac{1}{2}at^2` → `1/2at²`, `\sqrt{2} \leq \pi` → `√2 ≤ π`) by `math_text.py`, which leaves
  anything it does not recognise untouched.
* Fonts come from the host: the production image installs `fonts-noto-core` and
  `fonts-dejavu-core`; `PDF_FONT_DIRS` overrides the search path. Without a Devanagari font, Hindi
  cannot render — that is logged as a warning, and the PDF still renders everything else.

## 8. Failures, retries and rate limits

| Failure | What happens |
| :--- | :--- |
| Provider rate limit (429) | api-python answers **429 + Retry-After**; the job is rescheduled for exactly that long without spending an attempt (`provider-rate-limit.ts`). Requests are also **paced** in-process to `PROVIDER_MAX_RPM` (default 10, matching Gemini's free tier). |
| Provider error / timeout | Queue retries with exponential backoff; after the last attempt the job is dead-lettered and alerted (`QueueMonitorService`). The answer stays with the teacher. |
| Unusable model output | Recorded as a skip reason; routed to the teacher. Never a mark. |
| PDF unreadable | Document `FAILED` with the reason on the processing job; "Retry processing" re-queues. |
| One page's detection fails | That page is skipped; the rest proceed. |
| Python service down during submit | Marks are saved; only the PDF is missing, and the UI says so with a retry. |
| Concurrent AI check during review | Submit is refused wholesale (`CHECKED_COPY_CHANGED`); nothing partial is written. |
| Late AI job after approval | Skipped with `already_reviewed_by_teacher` — a teacher's mark is never replaced. |

## 9. Security and tenant isolation

Every route resolves the institute from the authenticated user and refuses cross-tenant access
(cross-institute reads return 404, matching the codebase convention). The internal NestJS→FastAPI
routes require `INTERNAL_SERVICE_TOKEN` and re-check `instituteId` themselves. Storage is private:
S3 objects are served through short-lived pre-signed URLs (local-disk fallback uses HMAC-signed,
expiring URLs); students may never fetch raw pre-annotation images. Provider errors are logged, not
returned — they can contain signed URLs and key fragments.

## 10. Deployment requirements

1. **Migrations** (additive, nullable, no backfill):
   `20260920090000_add_grading_breakdown`, `20260920120000_document_source_file`,
   `20260920130000_processing_job_error`. Apply with `prisma migrate deploy` (staging:
   `node infra/staging/migrate-staging.js`, which refuses any non-staging target).
2. **Python dependencies**: `fpdf2`, `uharfbuzz`, `pypdfium2`, `pylatexenc`, `pillow`, `httpx`
   (`apps/api-python/requirements.txt`).
3. **Fonts** in the api-python image: `fonts-noto-core`, `fonts-dejavu-core`.
4. **Feature flags** per institute: `documentProcessing`, `aiEvaluation`.
5. **Env**: `PYTHON_SERVICE_URL`, `INTERNAL_SERVICE_TOKEN` (same on both sides), a provider key
   (`OPENAI_API_KEY` or `GEMINI_API_KEY`), optional `PROVIDER_MAX_RPM`, Redis for the queues, and a
   worker process (`node dist/worker.js`) — the API alone does not consume queues.

## 11. Known limits

* **Auto region detection is a suggestion engine, not automation.** It is confident on clean,
  well-spaced scans; every box remains editable, and an answer spanning two pages still needs a
  teacher (one region per question is what the pipeline stores).
* **OCR accuracy on real handwriting is unverified.** Synthetic handwriting reads at ~0.95+
  self-reported confidence; real student handwriting has not been measured. Confidence is
  self-reported, not calibrated.
* Deskew, auto page-ordering and auto roll-number detection are not built.
* A question's answer is a single region: a long answer split across pages must be merged into one
  box or re-drawn on the page that holds most of it.
* fpdf2 is LGPL-3.0, used as an unmodified library dependency.

## 12. Testing evidence

* Unit/integration: `apps/api` Jest, `apps/api-python` pytest, `apps/web` Vitest — see
  `PRODUCTION-READINESS-AUDIT.md` §5 for the counts from the verification run.
* Staging fixture: `infra/staging/fixtures/seed-fixture.js` seeds one institute, teacher, student
  and a five-question paper (a numerical **without** a reference answer, a theory question with one,
  a Hindi question, a LaTeX question, and an objective MCQ that must never reach the AI).
  `make-answer-sheet.py` builds the matching 3-page booklet — as a PDF *and* as page images — whose
  answers are deliberately imperfect (right method with wrong arithmetic, an incomplete theory
  answer, an off-topic answer).
* End-to-end: `infra/staging/fixtures/run-e2e.js` drives the whole flow over HTTP as a teacher and
  asserts on what each step produced, including that AI marks stay out of the official score until
  submission and that a late AI job cannot touch approved answers.
