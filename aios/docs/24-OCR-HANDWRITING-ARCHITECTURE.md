# 24 — OCR / Handwriting Architecture
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `23-DOCUMENT-PROCESSING-ARCHITECTURE.md`. Feeds `25-EVALUATION-ENGINE.md` and `27-AI-EVALUATION-ARCHITECTURE.md`.

---

## 1. Purpose
Specify how text and handwriting are extracted from a `QuestionRegion`'s image into structured `OCRResult` data usable by both human evaluators (as a readable transcript alongside the source image) and the AI Evaluation Engine (as scoring input).

## 2. Position in the Pipeline — **Two Distinct OCR Passes (Fix #4)**
Per `23-DOCUMENT-PROCESSING-ARCHITECTURE.md` §4's corrected two-path pipeline, this document's extraction logic is invoked at **two different points**, which must not be conflated:

- **Content-extraction OCR** (stage 8, `OCR`, both Path A and Path B): runs per confirmed `QuestionRegion`, after question mapping — this is the primary subject of this document, producing the `OCRResult` that feeds the Evaluation Engine (`25`). Different regions on the same page (a math region with equations vs. a prose region) may use different extraction strategies (§4 below).
- **Layout-detection OCR** (stage 6, `LAYOUT_ANALYSIS`, Path B / `FREE_FORM` documents only): a lighter-weight, whole-page pass whose only job is locating question-number markers to produce provisional region candidates — it does **not** need to accurately transcribe full answer content, only detect and roughly locate short numeric/alphanumeric markers ("Q1", "3)"). This pass may reuse the same underlying `PRINTED_TEXT`/`HANDWRITTEN_TEXT` extraction engines (§4) at a coarser confidence bar, but produces `PageRegion` candidates, not `OCRResult` rows — its output type is structurally different from content-extraction OCR and is not persisted as an `OCRBlock`/`OCRResult`.

`TEMPLATE_KNOWN` documents (Path A) never invoke layout-detection OCR — their regions are geometry-derived from the registered template, so only content-extraction OCR applies to them.

## 3. Entities

### 3.1 `OCRBlock`
| Field | Notes |
|---|---|
| id | |
| questionRegionId | FK |
| blockType | `PRINTED_TEXT` / `HANDWRITTEN_TEXT` / `MATHEMATICAL_EXPRESSION` / `DIAGRAM_SKETCH` / `TABLE` — classified before extraction, since each type routes to a different extraction strategy (§4) |
| boundingBox | sub-region within the parent `QuestionRegion`, for multi-block regions (e.g., a region containing both prose and a diagram) |

### 3.2 `OCRResult`
| Field | Notes |
|---|---|
| id | |
| ocrBlockId | FK |
| extractedText | the recognized text (for `PRINTED_TEXT`/`HANDWRITTEN_TEXT`) or a structured representation (for `MATHEMATICAL_EXPRESSION`, see §4.3) |
| confidence | float 0.0–1.0, per-block |
| alternativeReadings | json array, optional — top-N alternative transcriptions for low-confidence text, surfaced to the human evaluator as quick-correction suggestions rather than forcing free-text retyping |
| engineUsed | which OCR/handwriting-recognition engine/model produced this — resolves to the `AIModel`/`AIModelVersion` registry (`04-DATABASE-SCHEMA.md` V2 section §1.24–1.27, fix #6), not a bare string, same discipline as `AIRecommendation`'s registry-FK fields in `27` §4 |
| processedAt | |

### 3.3 `DiagramSketch` handling
For `blockType = DIAGRAM_SKETCH` or `TABLE`, **no text extraction is attempted** — `OCRResult.extractedText` is left null, and the block is flagged `requires_visual_evaluation: true`, routing directly to a human evaluator who views the source image; the AI Evaluation Engine (`27`) does not attempt to score diagram/table content in v2 day one (documented non-goal — vision-based diagram evaluation is a future extension, not built now, to avoid an unreliable AI judgment on content its confidence taxonomy can't meaningfully bound).

## 4. Extraction Strategy by Block Type

### 4.1 `PRINTED_TEXT`
Standard OCR (high accuracy, mature technology) — used for pre-printed question stems being re-confirmed, roll-number fields, or any typed/printed content appearing on a scanned page.

### 4.2 `HANDWRITTEN_TEXT`
Handwriting Recognition (HWR) model, tuned for exam-answer handwriting patterns (cursive/print mix, common abbreviations). This is the primary, highest-value, and highest-risk extraction path — confidence scores here are treated with the most caution throughout the system (§5).

### 4.3 `MATHEMATICAL_EXPRESSION`
Specialized math-OCR (e.g., LaTeX-producing recognition for equations, fractions, exponents, integrals) — output stored as a LaTeX-like structured string in `extractedText`, consistent with how `Question.content` itself already supports LaTeX rendering in v1 (`03-FEATURE-SPECIFICATIONS.md` v1, Question Bank Engine). This lets a math answer's OCR output render identically to how question content renders in the UI.

## 5. Confidence Handling — Explicit Policy
- **No OCR result is ever presented to a human evaluator as if it were verified ground truth.** Every `OCRResult` is always shown alongside (never instead of) the source `PageImage`, with confidence visually indicated (e.g., low-confidence text underlined/highlighted in the transcript view — full UX spec in `28-DIGITAL-COPY-UX-SPECIFICATION.md`).
- **Threshold-based routing:**
  | Confidence range | Behavior |
  |---|---|
  | ≥ 0.85 | Text used as-is for AI evaluation input; still human-visible/correctable |
  | 0.5 – 0.85 | AI evaluation proceeds but `AIRecommendation.flags` includes `ocr_low_confidence`; evaluation work queue prioritizes this item higher for human attention |
  | < 0.5 | AI evaluation is **skipped** for this block (flag `illegible_handwriting` set directly, per `27` §5); routed straight to human evaluation with the source image as primary evidence |
- Teachers can correct an `OCRResult.extractedText` directly (a lightweight text-edit action) — this correction is stored as a new `OCRResult` version-equivalent (append, don't overwrite, mirroring the append-only discipline used throughout the v2 pack) so the original machine reading remains auditable.

## 6. Re-processing
If an institute later adopts an improved OCR/HWR engine, `POST /documents/:id/reprocess?stage=OCR` (see `05-API-SPECIFICATION.md` (V2 section)) re-runs extraction using retained `ProcessingArtifact`s from the region-detection stage (no need to re-upload or re-detect regions), producing new `OCRResult` rows without discarding the originals — same non-destructive-reprocessing discipline as the AI Evaluation Engine (`27` §8).

## 7. Language & Script Support
- v2 day one targets English and the institute's primary regional instruction language(s) as configured per tenant (`Institute` branding/config, extended) — the specific initial language set is an implementation/model-selection decision made in `20-IMPLEMENTATION-PLAN.md` (V2 section), not fixed rigidly in this architecture document, since it depends on which HWR engine/vendor is selected.
- A `QuestionRegion`/`OCRBlock` may carry a `languageHint` (inherited from the `Subject`/`Institute` configuration) to route to the correct language model — mis-detected language is treated as a low-confidence condition (§5), not a hard failure.

## 8. Performance Targets (extends `11-PERFORMANCE-REQUIREMENTS.md`)
| Operation | Target |
|---|---|
| Single `OCRBlock` extraction (printed or handwritten text) | < 2s (p95) |
| Single mathematical expression extraction | < 4s (p95) |
| Full page (all blocks) | < 10s (p95) |

## 9. Acceptance Criteria
- [ ] No OCR output is ever the sole evidence shown to an evaluator — source image is always co-presented.
- [ ] Confidence below 0.5 always routes to human evaluation without an AI scoring attempt.
- [ ] Diagram/table content is never auto-scored by the AI Evaluation Engine in v2 day one.
- [ ] Teacher corrections to OCR text are additive/versioned, never destructive overwrites of the original machine reading.
- [ ] Math expressions render using the same LaTeX rendering path already used for Question content (no new renderer needed).
