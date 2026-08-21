# 23 — Document Processing Architecture
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `21-DOMAIN-MODEL-V2.md`, `22-ASSESSMENT-ENGINE.md`.

---

## 1. Purpose
Specify the pipeline that turns a scanned/photographed handwritten answer booklet into structured, question-mapped, gradeable evidence (`Response` rows of `evidenceType = PAGE_REGION`). This is the architecture that makes school theory-exam support possible without touching the OMR/coaching-test path at all.

## 2. Trigger
Only invoked when `AssessmentDelivery.captureProviderId` resolves to `type = PHOTO_CAPTURE_SUBJECTIVE` (`21` §4.9). OMR, MANUAL_GRID, CSV_IMPORT, and PHOTO_CAPTURE_OBJECTIVE deliveries never enter this pipeline.

## 3. Entities (full detail — summarized in `21` §4.5)

**Fix #7 note — one-directional ownership.** `Document.attemptId` is the only FK connecting `Document` and `Attempt`; `Attempt` holds no `documentId` field. The flow is strictly `Document → IdentityResolution → Attempt`, populated exclusively by the identity-resolution workflow (`30-IDENTITY-PAGE-MAPPING.md`). Full rationale and constraint detail in `04-DATABASE-SCHEMA.md` (V2 section) §1.7.

### 3.1 `DocumentBundle`
| Field | Notes |
|---|---|
| id | |
| assessmentDeliveryId | FK |
| uploadedByUserId | e.g. an exam coordinator or teacher doing a batch scan-upload |
| expectedDocumentCount | optional, e.g. "40 booklets for Class 10-A" — used for completeness validation |
| status | `UPLOADING` / `PROCESSING` / `PARTIALLY_RESOLVED` / `COMPLETE` / `FAILED` |
| createdAt | |

### 3.2 `Document`
| Field | Notes |
|---|---|
| id | |
| documentBundleId | FK, nullable (a Document can also be created singly, e.g., a single re-scanned booklet, without a bundle) |
| attemptId | FK, nullable until `IdentityResolution` (§30) assigns it — see §4.0 below for the corrected one-directional ownership model (fix #7) |
| expectedPageCount | from the institute's booklet template config, if known |
| layoutType | enum: `TEMPLATE_KNOWN` / `FREE_FORM` — new, fix #4, see §4.0 below |
| status | `UPLOADED` / `PAGE_PROCESSING` / `IDENTITY_PENDING` / `REGION_MAPPING` / `READY_FOR_EVALUATION` / `FAILED` |

### 3.3 `Page`
| Field | Notes |
|---|---|
| id | |
| documentId | FK |
| pageNumber | ordered, 1-indexed |
| status | `PENDING` / `PROCESSED` / `FLAGGED` (e.g., blank, unreadable, out-of-sequence) |

### 3.4 `PageImage`
| Field | Notes |
|---|---|
| id | |
| pageId | FK |
| rawImageUrl | original upload, immutable, retained for audit/dispute purposes |
| processedImageUrl | deskewed/cropped/enhanced version used for OCR and teacher viewing |
| deskewAngle | float, degrees corrected |
| qualityScore | float 0.0–1.0 — blur/contrast/resolution assessment |

### 3.5 `PageRegion` / `QuestionRegion`
| Field | Notes |
|---|---|
| id | |
| pageImageId | FK |
| boundingBox | `{x, y, width, height}` normalized 0.0–1.0 coordinates (resolution-independent) |
| regionType | `QUESTION_ANSWER` / `HEADER` / `MARGIN` / `ROLL_NUMBER_FIELD` / `SIGNATURE` / `UNCLASSIFIED` |
| questionId | FK, nullable — populated only for `regionType = QUESTION_ANSWER` once mapped; this is what makes it a `QuestionRegion` conceptually (same table, discriminated by this field being non-null, not a separate table — kept as one entity to avoid an awkward supertype/subtype split) |
| detectionMethod | `AUTO_LAYOUT_DETECTION` / `MANUAL_TEACHER_MARKUP` / `TEMPLATE_MATCHED` (if institute uses a pre-defined answer-booklet template with known question positions) |
| detectionConfidence | float, nullable (null for manual markup) |

### 3.6 `ProcessingJob` / `ProcessingArtifact`
| Field (`ProcessingJob`) | Notes |
|---|---|
| id | |
| documentId | FK |
| stage | enum: `VALIDATE` / `DESKEW` / `PAGE_ORDER` / `IDENTITY_RESOLVE` / `REGION_DETECT` / `LAYOUT_ANALYSIS` / `OCR` / `QUESTION_MAP` — `LAYOUT_ANALYSIS` used only for `Document.layoutType=FREE_FORM` documents (Path B, §4 below), never for `TEMPLATE_KNOWN` (Path A) |
| status | `QUEUED` / `RUNNING` / `SUCCEEDED` / `FAILED` |
| attemptCount | retry tracking |
| startedAt / completedAt | |

`ProcessingArtifact` stores each stage's raw output (e.g., the deskew stage's before/after image references, the region-detect stage's raw bounding-box candidate list before human confirmation) — retained specifically so a failed or disputed pipeline run can be diagnosed and selectively re-processed from a specific stage rather than restarting the entire pipeline from upload.

## 4. Full Pipeline Specification — **Two Paths, Not One (Fix #4)**

**The single linear pipeline previously specified here was incorrect as a universal model.** Region detection can only precede question mapping cleanly when the booklet follows a **known, pre-registered template** (fixed positions per question). For an **unknown/free-form paper** — a student's own ruled notebook pages, a school with no pre-printed template, or a booklet whose layout varies student-to-student — question boundaries are not discoverable by pure geometric layout analysis; determining "where does Q3's answer start and end" itself requires reading the page's handwritten/printed question numbers, i.e., OCR/vision-assisted understanding, **before** a `QuestionRegion` can be finalized. The document is now typed at `DocumentBundle` (or `Document`, if templates vary within one bundle) creation time via a new field, and the pipeline branches accordingly.

### 4.0 New Field: `Document.layoutType`
`layoutType: enum(TEMPLATE_KNOWN | FREE_FORM)` — set at upload time (defaulted from the `CaptureProvider.config.bookletTemplateId` presence, per `29-CAPTURE-PROVIDER-ARCHITECTURE.md` §6: if a `bookletTemplateId` is configured, `TEMPLATE_KNOWN`; otherwise `FREE_FORM`). This field determines which of the two paths below a given `Document` takes — it is not a global institute setting, since a single institute may use pre-printed templated booklets for board exams and free-form notebooks for regular class tests.

### Path A — `TEMPLATE_KNOWN` (the pipeline as originally specified, unchanged)
```
1. UPLOAD           Operator uploads a batch of booklet images/PDFs → DocumentBundle + Document(s) + Page(s) created
2. VALIDATE          File type/size/page-count sanity check (07-SECURITY-SPECIFICATION.md upload rules apply identically)
3. DESKEW/ENHANCE    Per-page image correction → PageImage.processedImageUrl populated
4. PAGE_ORDER        Confirm/correct page sequence within a Document (auto-detected via page-number OCR if visible, else operator-confirmed)
5. IDENTITY_RESOLVE  Match Document → studentProfileId/Attempt — see 30-IDENTITY-PAGE-MAPPING.md for full detail
6. REGION_DETECT     Auto-detect candidate PageRegions per page using the registered template's known coordinates (high confidence, geometry-only, no OCR needed at this stage)
7. QUESTION_MAP      Map detected QUESTION_ANSWER regions to specific questionIds — template positions are pre-associated with questionIds, so this is largely a confirmation step, not a detection step
8. OCR               Extract text per QuestionRegion → OCRResult (24-OCR-HANDWRITING-ARCHITECTURE.md)
9. READY             Document.status = READY_FOR_EVALUATION
```

### Path B — `FREE_FORM` (new — fix #4)
```
1. UPLOAD           (identical to Path A)
2. VALIDATE          (identical to Path A)
3. DESKEW/ENHANCE    (identical to Path A)
4. PAGE_ORDER        (identical to Path A)
5. IDENTITY_RESOLVE  (identical to Path A)
6. LAYOUT_ANALYSIS   New stage. Vision/OCR-assisted pass over the full page (not per-region — no regions
                      exist yet) to detect question-number markers ("Q1", "Q.2", "3)", handwritten or
                      printed) and provisional text blocks between them. Produces provisional PageRegion
                      candidates with regionType=QUESTION_ANSWER but questionId still null and
                      detectionMethod=AUTO_LAYOUT_DETECTION, detectionConfidence populated.
7. QUESTION_MAP      Auto-suggested mapping from detected question-number markers to actual questionIds
                      (matched against the Assessment's question sequence), but — unlike Path A — this
                      is a REAL detection step here, not a confirmation step, and carries materially
                      lower default confidence. ALWAYS routed through mandatory human confirmation
                      before proceeding (§5 below applies with zero exceptions for FREE_FORM documents,
                      whereas Path A permits a bulk "confirm all high-confidence" action).
8. OCR               Extract text per now-confirmed QuestionRegion → OCRResult (24-OCR-HANDWRITING-ARCHITECTURE.md)
                      — this is a SECOND, finer-grained OCR pass distinct from stage 6's layout-analysis
                      pass; stage 6 only needs to read question-number markers, stage 8 reads full answer content.
9. READY             Document.status = READY_FOR_EVALUATION
```

**Key distinction:** Path A's `REGION_DETECT` (stage 6) is geometry-driven and template-confirmed; Path B's `LAYOUT_ANALYSIS` (stage 6) is vision/OCR-driven and detection-driven, renamed to a distinct stage name specifically so `ProcessingJob.stage` values are never ambiguous between the two paths — a job record's `stage` value alone tells you which path produced it. Both paths converge again at `QUESTION_MAP` and `OCR`, though Path B's confidence handling is stricter throughout.

Each numbered stage (in either path) is an independent `ProcessingJob`, queued separately (queue: `document-processing`, sub-queues per stage per `10-SCALABILITY-STRATEGY.md` extension), so a bottleneck or failure at one stage doesn't block progress on unrelated documents still earlier in the pipeline, or on documents following the other path.

### 4.1 New `ProcessingStage` Enum Value
`LAYOUT_ANALYSIS` is added to the `ProcessingStage` enum (`04-DATABASE-SCHEMA.md` V2 section) alongside the existing `VALIDATE/DESKEW/PAGE_ORDER/IDENTITY_RESOLVE/REGION_DETECT/OCR/QUESTION_MAP` values — used only by `FREE_FORM` documents, never by `TEMPLATE_KNOWN` ones.

## 5. Human-in-the-Loop Checkpoints (Mandatory, Not Optional)
- **Identity resolution** below a confidence threshold always requires manual confirmation before a `Document` is linked to an `Attempt` — misidentification risk is too high to auto-resolve silently (`30-IDENTITY-PAGE-MAPPING.md`).
- **Question mapping** is always human-reviewable in the Teacher UI (`28-DIGITAL-COPY-UX-SPECIFICATION.md`) before evaluation begins on that document, even when auto-detection confidence is high — a lightweight "confirm all" action is available for high-confidence template-matched documents to avoid unnecessary friction, but the review step itself is never skippable by the system.
- **Flagged pages** (blank, unreadable, out-of-sequence) always route to a manual-resolution queue, never silently dropped or silently assumed blank.

## 6. Failure Handling
- Any `ProcessingJob` stage failing after 3 retries moves the `Document` to `status = FAILED` with the specific failing stage recorded, surfaced on an Admin-facing "Processing Issues" queue (extends `12-LOGGING-MONITORING.md`'s dead-letter dashboard concept to the document pipeline).
- A failed `Document` never silently blocks the rest of its `DocumentBundle` — sibling documents continue processing independently.
- Re-processing (after a manual fix, e.g., re-uploading a clearer scan of one page) restarts only from the affected stage forward, using retained `ProcessingArtifact`s from earlier successful stages, not from `UPLOAD` again.

## 7. Storage & Security
- All page images (`rawImageUrl`, `processedImageUrl`) follow the same tenant-scoped, signed-URL object storage pattern as v1 (`07-SECURITY-SPECIFICATION.md` §9, §16) — path convention: `institutes/{instituteId}/documents/{documentId}/pages/{pageId}/...`.
- Raw images are retained indefinitely alongside processed versions (not deleted after OCR) — they are the ground-truth evidence a teacher or reviewer must be able to inspect directly when disputing an AI or even a human evaluation.
- Upload validation (file type, size, malware scanning) is identical to v1's `PHOTO_CAPTURE` rules, extended to accept multi-page PDF uploads for whole-booklet submission in addition to per-page images.

## 8. Performance Targets (extends `11-PERFORMANCE-REQUIREMENTS.md`)
| Stage | Target (per document, p95) |
|---|---|
| Upload + validate | < 3s |
| Deskew/enhance (per page) | < 2s |
| Auto page-order | < 1s |
| Identity resolution (auto-attempt) | < 3s |
| Region detection (per page) | < 3s |
| Full pipeline, single 8-page booklet, end-to-end excluding human checkpoints | < 60s |
| Full pipeline, 40-booklet batch | < 20 minutes, parallelized |

## 9. Acceptance Criteria
- [ ] OMR/digital deliveries never touch this pipeline — zero coupling, zero added latency.
- [ ] A failed stage on one document never blocks sibling documents in the same bundle.
- [ ] Every automated stage output is human-reviewable/correctable before it feeds evaluation.
- [ ] Raw source images are retained and directly viewable alongside any evaluation, indefinitely.
- [ ] Re-processing after a fix resumes from the affected stage, not from scratch.
