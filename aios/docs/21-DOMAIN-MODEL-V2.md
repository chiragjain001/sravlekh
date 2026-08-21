# 21 — Domain Model v2
## AIOS — Academic Intelligence Operating System

> **STATUS: PROPOSED — FOUNDATIONAL V2 DOCUMENT**
> This document introduces the core domain model for AIOS v2. It does not by itself supersede any v1 document, but every subsequent v2 document (22 onward, and the v1-superseding `0XB-*-V2.md` files) is built to conform to the concepts defined here. Until the full v2 pack is approved, v1 (`01–20`) remains the current implementation baseline — see `01-PRODUCT-REQUIREMENTS.md` §13 Hierarchy of Truth, which this document does not yet outrank.

---

## 1. Why This Document Exists

AIOS v1's data model is **exam-centric**: `Institute → Batch → Exam → AnswerSheet → Response → ScoreRecord`. This is an excellent fit for OMR-based and MCQ-heavy coaching-institute workflows, but it cannot cleanly absorb:
- Multi-question-type school theory exams (short/long answer, proofs, diagrams).
- Handwritten answer booklets requiring page-level document processing and OCR.
- Rubric-based, criterion-level evaluation with AI-assisted scoring and human override.
- Versioned evaluation history (AI suggestion → teacher decision → reviewer override → final).

AIOS v2 reframes the core around **Assessment** (the thing being measured) and **Evidence** (however a response was captured — OMR bubble, typed text, or a photographed handwritten page) as first-class, decoupled concepts. This lets the OMR/coaching workflow keep working unchanged while opening the door to document processing, OCR, and AI evaluation as additive capabilities rather than a rewrite.

## 2. Core Design Principle: Assessment ≠ Exam, Response ≠ Answer Text

- **v1** conflated "the test event" with "the paper" with "the grading medium." v2 separates these into: `Assessment` (what is being measured), `AssessmentDelivery` (a scheduled instance of it, e.g., today's 10am sitting), `Attempt` (one student's participation in a delivery), and `Capture` (how evidence of that attempt was gathered — OMR sheet, digital form, photographed booklet).
- **v1**'s `Response` held a direct `studentAnswer` value. **v2**'s `Response` becomes a **question-level evidence record** that *points to* the evidence (a digital value, an OMR bubble read, or a `PageRegion` + OCR result) rather than assuming the answer is always a simple stored value. This is what allows the same `Response` concept to serve MCQ, numerical, and handwritten-essay answers without three parallel data models.
- **v1**'s grading (`marksAwarded`, `mistakeTagType` directly on `Response`) becomes **v2**'s `Evaluation` — a separate, versioned, rubric-aware entity that references a `Response`, rather than mutating it in place. This is what enables AI-suggested → teacher-decided → reviewer-overridden history without losing any state.

## 3. Domain Map (High Level)

```
                         ┌─────────────┐
                         │  Assessment  │  (the "what" — e.g. "Class 10 Half-Yearly Math")
                         └──────┬──────┘
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
          ┌───────────────────┐   ┌────────────────────┐
          │ AssessmentDelivery │   │  Blueprint / Paper   │  (carried over from v1, now
          │ (scheduled sitting)│   │  (still exists as a  │   attached to Assessment
          └─────────┬──────────┘   │  question-selection  │   instead of directly to Exam)
                    │              │  artifact)            │
                    ▼              └────────────────────┘
             ┌─────────────┐
             │   Attempt    │  (one student's participation — replaces AnswerSheet conceptually)
             └──────┬──────┘
                     │
        ┌────────────┼─────────────────┐
        ▼            ▼                 ▼
  ┌───────────┐ ┌───────────┐   ┌───────────────┐
  │  Response  │ │ Document   │   │ CaptureProvider│  (OMR / Digital / Scanned — see 29)
  │ (per-Q     │ │ (if photo/ │   │  metadata      │
  │  evidence  │ │  scan-based│   └───────────────┘
  │  pointer)  │ │  capture)  │
  └─────┬──────┘ └─────┬──────┘
        │              │
        │        ┌─────▼─────┐
        │        │   Page     │───▶ PageImage ───▶ OCRResult
        │        └─────┬─────┘
        │              │
        │        ┌─────▼──────┐
        │        │ PageRegion  │───▶ QuestionRegion (maps a region to a specific question)
        │        └─────────────┘
        │
        ▼
  ┌────────────┐        ┌───────────┐       ┌────────────┐
  │   Rubric    │◀───────│ Evaluation │──────▶│ EvaluationVersion │ (AI → Teacher → Reviewer chain)
  └────────────┘        └───────────┘       └────────────┘
                               │
                     ┌─────────┴─────────┐
                     ▼                   ▼
             AIRecommendation      TeacherDecision / EvaluationOverride
```

## 4. New/Redefined Core Entities

### 4.1 `Assessment` (new — generalizes v1's `Exam` as a *concept*, not a scheduled event)
Represents what is being measured, independent of when/how it's delivered.
| Field | Notes |
|---|---|
| id | |
| instituteId | tenant scope |
| title | e.g. "Class 10 Mathematics — Half Yearly" |
| assessmentKind | enum: `COACHING_TEST`, `SCHOOL_THEORY_EXAM`, `PRACTICE_TEST`, `DIAGNOSTIC`, `HOMEWORK_GRADED` — extensible. **Corrected (fix #3, see `04-DATABASE-SCHEMA.md` V2 §1.1):** describes pedagogical category only and drives **no** capture/evaluation workflow behavior. Capture is set via `CaptureProvider`, evaluation behavior via `EvaluationPolicy`, and AI-governance eligibility via the separate `stakesLevel` field — all three independent of this field. |
| stakesLevel | enum: `GRADED` \| `PRACTICE` \| `DIAGNOSTIC_ONLY` — new (fix #3). This, not `assessmentKind`, is what `32-AI-GOVERNANCE-POLICY.md`'s human-review gate checks. |
| subjectId(s) | |
| paperId | FK → `Paper` (v1 concept retained — a Blueprint-generated or manually assembled question set) |
| totalMarks | |
| gradeLevel / batchScope | which cohort this assessment definition applies to |
| createdByUserId | |

**Relationship to v1 `Exam`:** an `Exam` in v1 conflated "the assessment definition" with "the scheduled sitting." In v2, `Exam` becomes a **thin, backward-compatible alias resource** at the API layer (`POST /exams` still works) that under the hood creates one `Assessment` + one `AssessmentDelivery` together for the simple coaching-test case, preserving v1 API contracts where possible (see `05-API-SPECIFICATION.md` (V2 section), to be written).

### 4.2 `AssessmentDelivery` (new)
A scheduled instance of an `Assessment` — replaces the "scheduling + state machine" responsibilities v1 placed directly on `Exam`.
| Field | Notes |
|---|---|
| id | |
| assessmentId | FK |
| batchId | |
| status | **the 7-stage state machine moves here, unchanged**: `DRAFT → REVIEW → APPROVED → PUBLISHED → ONGOING → EVALUATING → LOCKED` |
| version | optimistic lock, as in v1 |
| scheduledStart / scheduledEnd | |
| captureProviderId | FK → `CaptureProvider` config (replaces the flat `captureMode` enum — see §4.9) |
| unlockReason | as in v1 |

This is a **pure decomposition**, not a behavior change: everything the v1 `Exam` state machine, unlock rules, and audit requirements specified (03/04/05/06 v1) applies identically to `AssessmentDelivery` — see `22-ASSESSMENT-ENGINE.md` for the full carried-over spec.

### 4.3 `Attempt` (new — replaces `AnswerSheet` as the conceptual anchor, though `AnswerSheet` is retained as a v1-compatible view)
One student's participation in one `AssessmentDelivery`.
| Field | Notes |
|---|---|
| id | |
| assessmentDeliveryId | FK |
| studentProfileId | FK |
| status | `IN_PROGRESS` / `SUBMITTED` / `DUPLICATE` / `UNDER_EVALUATION` / `FINALIZED` |
| submittedAt | |

**Fix #7 (corrected from an earlier draft of this document): `Attempt` holds no `documentId` field.** The `Document`↔`Attempt` relationship is one-directional only — `Document.attemptId` is the sole FK, populated by the `IdentityResolution` workflow (§4.5, `30-IDENTITY-PAGE-MAPPING.md`). Code needing "the document behind this attempt" queries `Document WHERE attemptId = :id`, never a stored reverse reference. See `04-DATABASE-SCHEMA.md` (V2 section) §1.7 for the full rationale.

**Relationship to v1 `AnswerSheet`:** `AnswerSheet` becomes a synonym/legacy view over `Attempt` for OMR/MCQ-style coaching deliveries where no document pipeline is involved — no data migration is required for existing v1 rows; `Attempt` is the generalized superset.

### 4.4 `Response` (redefined — evidence pointer, not a raw answer value)
One question's worth of evidence within an `Attempt`.
| Field | Notes |
|---|---|
| id | |
| attemptId | FK |
| questionId / questionVersionId | as in v1 |
| evidenceType | enum: `DIGITAL_VALUE` (typed/selected answer, v1-equivalent), `OMR_MARK` (bubble read), `PAGE_REGION` (points to a `QuestionRegion` on a scanned/photographed page) |
| digitalValue | json, populated only if `evidenceType = DIGITAL_VALUE` (this is the v1-equivalent path — MCQ/numerical/short-answer typed directly) |
| questionRegionId | FK → `QuestionRegion`, populated only if `evidenceType = PAGE_REGION` |
| isCorrect | nullable — **for objective types only** (MCQ, numerical, matching); for subjective/rubric-scored types this field is not authoritative, `Evaluation` is (see §4.7) |

**Critical distinction from v1:** in v1, `Response.marksAwarded` and `Response.mistakeTagType` were mutable fields on the response itself. In v2, grading is **never written directly onto `Response`** — it always goes through `Evaluation` (§4.7), which references the `Response` it evaluates. This is what makes AI-suggested → teacher-overridden → reviewer-finalized scoring possible without losing history, and it's the single most important structural change in this document.

### 4.5 Document Processing Cluster (new)
Only populated for scan/photo-captured attempts (`PHOTO_CAPTURE`/scanned-booklet workflows). Fully specified in `23-DOCUMENT-PROCESSING-ARCHITECTURE.md`; summarized here for domain-map completeness.

| Entity | Purpose |
|---|---|
| `Document` | The logical answer booklet for one `Attempt` (may span many pages) |
| `DocumentBundle` | A batch upload unit (e.g., a school scans 40 booklets in one operator session) containing many `Document`s before student-identity resolution assigns each to an `Attempt` |
| `Page` | One physical page within a `Document`, ordered |
| `PageImage` | The raw and processed (deskewed, cropped) image artifacts for a `Page` |
| `PageRegion` | A detected/annotated rectangular region on a `PageImage` (could be a question area, a header, a margin) |
| `QuestionRegion` | A `PageRegion` that has been mapped to a specific `questionId` — this is what `Response.questionRegionId` points to |
| `OCRBlock` / `OCRResult` | Extracted text/handwriting-recognition output for a region, with confidence scores |
| `ProcessingJob` / `ProcessingArtifact` | Tracks the async pipeline (upload → validate → deskew → page-order → identity-resolve → region-detect → OCR → question-map), with each stage's output retained as an artifact for debuggability and re-processing |
| `Annotation` | Teacher/reviewer marks made directly on a page image during evaluation (circles, ticks, margin comments) — distinct from `Evaluation`'s structured scoring data, this is the visual/free-form layer |
| `IdentityResolution` | Records how a scanned `Document` was matched to a specific `studentProfileId`/`Attempt` (barcode, roll-number OCR, manual admin match), with a confidence/method field and an audit trail, since misidentification here is a serious correctness risk |

### 4.6 `Rubric` Cluster (new)
Fully specified in `26-RUBRIC-EVALUATION-SPECIFICATION.md`; summarized here.
| Entity | Purpose |
|---|---|
| `Rubric` | A named scoring scheme attachable to a `Question` (e.g., "Photosynthesis explanation — 5 mark rubric") |
| `RubricVersion` | Immutable snapshot, same versioning discipline as `QuestionVersion` in v1 — a rubric used to grade a LOCKED assessment must remain reconstructable even if later edited |
| `RubricCriterion` | One scorable line item within a rubric (e.g., "Correct chemical equation — 1 mark"), with its own max marks and optional keyword/pattern hints for AI matching |

Rubrics are **optional and additive** — objective question types (MCQ, numerical, matching) continue to be scored directly (`isCorrect`/marks-equal-to-question-marks) exactly as in v1, with no rubric required. Rubrics apply to subjective types (`SHORT_ANSWER`, `LONG_ANSWER`, `PASSAGE_BASED` sub-answers, and any future essay/diagram type).

### 4.7 `Evaluation` Cluster (new — the core structural addition)
Fully specified in `25-EVALUATION-ENGINE.md`; summarized here as the domain-model anchor.
| Entity | Purpose |
|---|---|
| `Evaluation` | The current authoritative scoring state for one `Response`. Exactly one *current* `Evaluation` per `Response`, but it is backed by an append-only version chain (below) — `Evaluation` is a materialized "latest" pointer, not the history itself. |
| `EvaluationVersion` | Immutable snapshot of one evaluation state: who/what produced it (`AI`, `TEACHER`, `REVIEWER`), the marks awarded, mistake tag(s), criterion scores (if rubric-based), and a reference to the *previous* version — forming a linked history: `AI suggested 5/10 → Teacher changed 7/10 → Reviewer changed 6/10`, with every step retained. |
| `EvaluationCriterionScore` | Per-`RubricCriterion` score within one `EvaluationVersion`, only present for rubric-graded responses |
| `AIRecommendation` | The AI's suggested `EvaluationVersion` content plus its confidence score and any flags (e.g., "low confidence, illegible handwriting," "answer appears off-topic") — always superseded-not-deleted when a human acts on it |
| `TeacherDecision` | A human `EvaluationVersion` entered by a TEACHER — may accept the AI recommendation as-is, adjust it, or reject it entirely |
| `EvaluationOverride` | A human `EvaluationVersion` entered by a REVIEWER/senior role, specifically modeled as distinct from `TeacherDecision` so review-stage changes are queryable separately (e.g., for AI-accuracy auditing: "how often does a reviewer change a teacher's decision?") |

**Relationship to v1's `mistakeTagType`:** the 6-value `MistakeTagType` enum (`CONCEPT_ERROR`, `FORMULA_ERROR`, `CALCULATION_ERROR`, `CARELESS`, `NOT_ATTEMPTED`, `PRESENTATION_ERROR`) is **preserved unchanged** as the tag field on `EvaluationVersion` (moved from `Response`, per §4.4). It remains the diagnostic backbone feeding `MasteryScore`. It is explicitly designed to be **extensible** (not a breaking v2 change) — new tag values (`READING_COMPREHENSION_ERROR`, `METHOD_ERROR`, `KNOWLEDGE_GAP`, `UNIT_ERROR`, `LOGIC_ERROR`, `INCOMPLETE_ANSWER`, `IRRELEVANT_ANSWER`) may be added to the enum without a structural migration, since the field's shape doesn't change, only its value domain.

### 4.8 `MasteryScore` / `Intervention` (unchanged in structure, reattached in source)
The formula and threshold (`< 0.50`) are **unchanged from v1**. The only change is upstream: mastery calculation now reads `marksAwarded` from the *current* `Evaluation` (via its latest `EvaluationVersion`) instead of directly from `Response.marksAwarded`, since that field no longer exists on `Response` (§4.4). This is a read-path change in the FastAPI mastery engine, not a formula or philosophy change — see `25-EVALUATION-ENGINE.md` for the exact query contract.

### 4.9 `CaptureProvider` (new — generalizes v1's flat `captureMode` enum)
```
                 Assessment
                     ↓
              Capture Method
                     ↓
       ┌─────────────┼─────────────┐
       │             │             │
      OMR        Digital        Scanned/
       │           Exam         Photographed
       │             │           Booklet
       └─────────────┼─────────────┘
                     ↓
              Response Evidence
                     ↓
                 Evaluation
```
| Field | Notes |
|---|---|
| id | |
| type | enum: `OMR`, `MANUAL_GRID` (digital direct-entry), `CSV_IMPORT`, `PHOTO_CAPTURE_OBJECTIVE` (photographed OMR/MCQ sheet, v1-equivalent), `PHOTO_CAPTURE_SUBJECTIVE` (photographed handwritten booklet — triggers the full Document Processing pipeline) |
| config | json — provider-specific settings (e.g., OMR key-mapping reference, expected page count for a booklet) |

This is the mechanism described in the critique's "capture provider" diagram: **the v1 OMR engine is preserved entirely unchanged** as one provider implementation (`type = OMR`), not rebuilt. `PHOTO_CAPTURE` from v1 splits into two v2 providers (`PHOTO_CAPTURE_OBJECTIVE` vs `PHOTO_CAPTURE_SUBJECTIVE`) because they trigger fundamentally different downstream pipelines (direct bubble-equivalent reading vs full document/OCR/rubric/AI-evaluation pipeline) — conflating them in v1 was fine when only objective photo-capture existed, but is no longer accurate.

### 4.10 Role / Permission / Scope (redesigned — replaces flat 4-role enum as the *extensibility* mechanism, not as a v2-day-one behavior change)
v1's `FOUNDER > ADMIN > TEACHER > STUDENT` roles and permission matrix (`06-AUTH-AUTHORIZATION.md`) **remain fully valid and unchanged in v2 day one**. What changes is the *underlying mechanism* so that future roles (Principal, Exam Coordinator, Evaluator, Senior Evaluator, Reviewer, Academic Analyst, Parent, Platform Admin) can be added as **data**, not as new enum values requiring code changes everywhere:
```
User ──< UserRoleAssignment >── Role
                                   │
                                   ▼
                              Permission
                                   +
                                Scope (batchId? subjectId? branchId? — nullable = unscoped/institute-wide)
```
Example: `TEACHER` + permission `EVALUATE` + scope `{ batchId: "10-A", subjectId: "Mathematics" }`. The existing 4 roles are simply the seeded, day-one rows in this table with their v1-documented permission sets — **no v1 authorization behavior changes**; this is purely a forward-compatibility refactor, detailed fully in a future `06B-AUTH-AUTHORIZATION-V2.md` (not yet written — sequenced after the Evaluation Engine per the agreed dependency order, since evaluator/reviewer roles are meaningless without the Evaluation cluster existing first).

## 5. v1 → v2 Entity Mapping (Migration Reference)
| v1 Entity | v2 Status |
|---|---|
| `Exam` | Split into `Assessment` (definition) + `AssessmentDelivery` (scheduled sitting, carries the state machine) |
| `AnswerSheet` | Generalized to `Attempt`; `AnswerSheet` retained as a compatibility view for pure-OMR/digital deliveries |
| `Response` | Redefined as an evidence pointer (`evidenceType`-discriminated); `marksAwarded`/`mistakeTagType` **move off** this entity onto `EvaluationVersion` |
| `ScoreRecord` | **Unchanged** — remains the per-attempt aggregate (`totalMarksAwarded`/`percentage`/`rank`), now computed by summing current `Evaluation` marks across a `Attempt`'s `Response`s instead of summing `Response.marksAwarded` directly |
| `MasteryScore`, `Intervention`, `Assignment` | **Unchanged in structure**; upstream read-path updated per §4.8 |
| `Question`, `QuestionVersion` | **Unchanged**, gain an optional `rubricId` reference |
| `Blueprint`, `Paper`, `PaperVersion`, `PaperItem` | **Unchanged**, `Paper` now referenced from `Assessment` rather than directly from `Exam` |
| `MistakeTagType` enum | **Unchanged values**, relocates from `Response` to `EvaluationVersion`, extensible per §4.7 |
| `AuditLog` | **Unchanged** — continues to log all sensitive mutations; `EvaluationVersion`'s own append-only history is a *complementary* fine-grained record for the evaluation domain specifically, not a replacement for `AuditLog` (per the critique's point 12: "audit records tell you something happened; evaluation versions tell you what the evaluation state actually was") |

No v1 data requires destructive migration — every v1 row has a direct, non-lossy v2 representation (`Exam`→`Assessment`+`AssessmentDelivery` pair; `AnswerSheet`→`Attempt`; `Response.marksAwarded`→ becomes the seed `EvaluationVersion` for that response, authored as `TEACHER` type, backdated to its original `gradedAt`). The exact migration script is specified in `04-DATABASE-SCHEMA.md` (V2 section) (upcoming).

## 6. What Explicitly Does NOT Change
To keep this refactor bounded and safe, per the agreed approach ("preserve almost all engineering disciplines"):
- Multi-tenancy strategy, tenant-scoping enforcement mechanism (07-SECURITY-SPECIFICATION.md v1).
- The OMR engine's internal logic — it becomes one `CaptureProvider` implementation, not a rewrite.
- The AI Blueprint Agent (question *selection* for paper generation) — entirely separate concern from AI *evaluation*, unaffected by this document.
- Caching, deployment, coding standards, folder structure (fundamentals) — extended, not replaced (see `18` critique table: "mostly reusable").
- The mastery formula and 0.50 threshold philosophy.
- The 6-value `MistakeTagType` core set.
- Monorepo/stack choices (Next.js, NestJS, FastAPI, PostgreSQL, Prisma, Redis, BullMQ).

## 7. Next Documents in This Chain
Per the agreed dependency order:
1. ✅ **21-DOMAIN-MODEL-V2.md** (this document)
2. **22-ASSESSMENT-ENGINE.md** — full v2 spec for `Assessment`/`AssessmentDelivery`/`Attempt`, carrying forward the v1 state machine unchanged and specifying the `Exam`-alias compatibility layer.
3. **Response evidence model** (folded into 22, or a short dedicated section) — the `Response` redefinition's full validation/business rules.
4. **26-RUBRIC-EVALUATION-SPECIFICATION.md** — per your correction, rubric design comes before the full Evaluation Engine spec, since evaluation granularity (question-level vs criterion-level vs step-level) depends on rubric shape.
5. **25-EVALUATION-ENGINE.md** — the versioned AI→Teacher→Reviewer scoring engine.
6. **27-AI-EVALUATION-ARCHITECTURE.md**
7. **23-DOCUMENT-PROCESSING-ARCHITECTURE.md**
8. **24-OCR-HANDWRITING-ARCHITECTURE.md**
9. **04-DATABASE-SCHEMA.md (V2 section)**
10. **02-SYSTEM-ARCHITECTURE.md (V2 section)**
11. **05-API-SPECIFICATION.md (V2 section)**
12. Security/Auth, Error/Queue, Testing/Acceptance, Performance/Scalability updates
13. **20-IMPLEMENTATION-PLAN.md (V2 section)**

I'll proceed to **22-ASSESSMENT-ENGINE.md** next.
