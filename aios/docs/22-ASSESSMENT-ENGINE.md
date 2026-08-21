# 22 — Assessment Engine
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `21-DOMAIN-MODEL-V2.md`. Until the full v2 pack is approved, v1's `Exam` model (`03/04/05` v1) remains the implementation baseline.

---

## 1. Purpose
Specify `Assessment`, `AssessmentDelivery`, `Attempt`, and the redefined `Response` in full — the entities that replace v1's `Exam`/`AnswerSheet` as the conceptual core, while preserving the v1 state machine and API surface as closely as possible.

## 2. `Assessment` — Full Specification
**Feature: Define Assessment**
- **Purpose:** Describe *what* is being measured, decoupled from *when* it's delivered.
- **Who can use it:** TEACHER, ADMIN.
- **Input:** title, assessmentKind, stakesLevel, subjectId(s), paperId, totalMarks, gradeLevel/batchScope. **(Fix #3: `assessmentType` renamed to `assessmentKind`, plus new required `stakesLevel` field — see `04-DATABASE-SCHEMA.md` V2 section §1.1. `assessmentKind` carries no workflow behavior; `stakesLevel` is what gates AI-final-scoring eligibility per `32-AI-GOVERNANCE-POLICY.md` §2.)**
- **Output:** `Assessment` record.
- **Business logic:** An `Assessment` may have zero, one, or many `AssessmentDelivery` instances (e.g., the same half-yearly Math paper delivered to two parallel sections on different days is one `Assessment`, two `AssessmentDelivery` rows).
- **Edge cases:** Changing `totalMarks` on an `Assessment` that already has a `PUBLISHED`/`ONGOING` delivery is blocked — marks must be locked once any delivery has started, exactly mirroring v1's rule that Paper content is pinned once in use.
- **Permissions:** TEACHER/ADMIN.
- **Acceptance criteria:**
  - [ ] One `Assessment` can back multiple `AssessmentDelivery` rows (parallel sections, retest, makeup).
  - [ ] `totalMarks` immutable once any linked delivery leaves `DRAFT`.

## 3. `AssessmentDelivery` — Full Specification (carries the v1 state machine, unchanged)
```
DRAFT → REVIEW → APPROVED → PUBLISHED → ONGOING → EVALUATING → LOCKED
LOCKED → EVALUATING (Admin override, reason required, audit-logged)
```
This state machine, its guards, its optimistic-locking (`version` field), and its unlock-audit requirements are **identical to v1 FR-EXAM-01/02** (`03-FEATURE-SPECIFICATIONS.md` v1) — nothing about exam-lifecycle governance changes in v2. The only structural difference is that `status`, `scheduledStart/End`, `captureProviderId`, `evaluationPolicyId`, and `unlockReason` now live on `AssessmentDelivery` rather than directly on a monolithic `Exam` row.

**New responsibility not present in v1:** `AssessmentDelivery.captureProviderId` (FK → `CaptureProvider`, see `29-CAPTURE-PROVIDER-ARCHITECTURE.md`) replaces the flat `captureMode` enum, since a school theory exam's capture provider (`PHOTO_CAPTURE_SUBJECTIVE`) carries materially more configuration (expected page count, booklet template, identity-resolution method) than a coaching OMR sheet's provider (`OMR`, answer-key reference only).

**New responsibility (fix #3):** `AssessmentDelivery.evaluationPolicyId` (FK → `EvaluationPolicy`, see `04-DATABASE-SCHEMA.md` V2 section §1.2a) independently controls how captured evidence is scored (`AUTOMATIC`/`MANUAL_ONLY`/`AI_ASSIST_MANDATORY_REVIEW`/`AI_FINAL_LOW_STAKES`) — set alongside, but never derived from, `captureProviderId` or the parent `Assessment.assessmentKind`. Server-side validation at creation time rejects any combination where `EvaluationPolicy.mode = AI_FINAL_LOW_STAKES` is paired with a parent `Assessment.stakesLevel = GRADED` (`422 EVALUATION_POLICY_STAKES_MISMATCH`).

## 4. `Attempt` — Full Specification
**Feature: Attempt Lifecycle**
- **Purpose:** Track one student's participation in one `AssessmentDelivery`, independent of how their evidence was captured.
- **Input (system/teacher/student-driven depending on capture provider):** studentProfileId, assessmentDeliveryId.
- **Output:** `Attempt` record, status `IN_PROGRESS → SUBMITTED → (DUPLICATE | UNDER_EVALUATION → FINALIZED)`.
- **Business logic:**
  - For `OMR`/`MANUAL_GRID`/`CSV_IMPORT` providers, an `Attempt` is created implicitly at marks-capture time (mirrors v1's `AnswerSheet` creation-on-submit behavior exactly).
  - For `PHOTO_CAPTURE_SUBJECTIVE`, an `Attempt` may exist in `IN_PROGRESS` (created by `IdentityResolution` once a scanned `Document` is matched to a student, see `30-IDENTITY-PAGE-MAPPING.md`) before evaluation begins, since document processing is itself a multi-step async pipeline that must be tracked against something.
- **Edge cases:** Identical to v1's duplicate-submission handling (`18-EDGE-CASES.md` v1, Marks Capture section) — a second `Attempt` for the same student+delivery is flagged `DUPLICATE`, never silently overwritten. This behavior is unchanged, just relocated conceptually from `AnswerSheet` to `Attempt`.
- **Permissions:** Same as v1 marks-capture permissions (TEACHER assigned batch, ADMIN any).
- **Acceptance criteria:**
  - [ ] `AnswerSheet`-style v1 API consumers see no behavior change for OMR/digital deliveries (compatibility view, §6).
  - [ ] Document-backed attempts correctly transition `IN_PROGRESS → SUBMITTED` only once all expected pages are present and identity-resolved.

## 5. `Response` — Full Specification (Evidence Pointer)
**Feature: Response Evidence Capture**
- **Purpose:** Record, per question, what evidence exists of the student's answer — without assuming a single storage shape.
- **Input:** attemptId, questionId, evidenceType, and exactly one of `digitalValue` / OMR read / `questionRegionId` depending on `evidenceType`.
- **Business logic:**
  - `evidenceType = DIGITAL_VALUE`: identical to v1 — a typed/selected answer value, immediately gradeable for objective types.
  - `evidenceType = OMR_MARK`: the v1 OMR path, unchanged — a bubble read result, immediately gradeable.
  - `evidenceType = PAGE_REGION`: new — the `Response` exists but has **no answer value at all** until the Document Processing pipeline (`23`) produces a `QuestionRegion` and OCR result for it. A `Response` of this type can legitimately sit in a "pending evidence" state.
- **Edge cases:**
  - A `PAGE_REGION`-type Response whose linked `QuestionRegion` was never successfully detected (e.g., student skipped the question, or region-detection failed) — must be distinguishable from "not yet processed" vs "confirmed blank/not attempted." This distinction feeds directly into whether `NOT_ATTEMPTED` (a `MistakeTagType`) is applied automatically or requires human confirmation — **human confirmation is required**; the pipeline never auto-assigns `NOT_ATTEMPTED` from a detection failure, since detection failure and genuine blank answers are not reliably distinguishable by the current pipeline stage alone.
  - Multiple `PageRegion`s legitimately map to one question (e.g., a long-answer response spanning 3 pages) — `QuestionRegion` supports a one-to-many `Response`↔`PageRegion` relationship for exactly this reason (modeled via a join, not a single FK, see `23-DOCUMENT-PROCESSING-ARCHITECTURE.md` §schema).
- **Permissions:** System-created (capture-provider-driven) or TEACHER-created (manual override, e.g., re-linking a misdetected region).
- **Acceptance criteria:**
  - [ ] Objective-type Responses (`DIGITAL_VALUE`/`OMR_MARK`) behave identically to v1 — zero regression.
  - [ ] `PAGE_REGION`-type Responses correctly track a "pending evidence" state distinct from "confirmed blank."
  - [ ] A single question's evidence can span multiple page regions without data loss.

## 6. Backward-Compatibility Layer: `Exam` and `AnswerSheet` as API Aliases
To protect existing v1 API consumers and avoid a disruptive frontend rewrite on day one of v2:
- `POST /exams` continues to exist. Internally, it creates one `Assessment` + one `AssessmentDelivery` in a single transaction when the request shape matches the simple v1 pattern (single batch, single schedule window). The response is shaped identically to v1's `Exam` object (a computed view joining `Assessment` + `AssessmentDelivery` fields).
- `GET /exams/:id`, `PATCH /exams/:id/status`, `POST /exams/:id/unlock`, `POST /exams/:id/grade-sheet` all continue to work unchanged for OMR/digital-capture deliveries, resolving internally to `AssessmentDelivery`/`Attempt` operations.
- New v2-native endpoints (`POST /assessments`, `POST /assessment-deliveries`, `POST /attempts`, `POST /documents`, ...) are additive, not replacements — see `05-API-SPECIFICATION.md` (V2 section).
- This alias layer is **not permanent scaffolding to be deleted later without a plan** — it is the documented, intentional path for coaching-institute-style simple deliveries indefinitely, since not every institute needs the full Assessment/Delivery decomposition exposed in their UI.

## 7. What Is Unaffected
Blueprint, Paper, PaperVersion, PaperItem, Question, QuestionVersion — all unchanged from v1, now referenced from `Assessment.paperId` instead of directly from `Exam.paperId` (a rename, not a behavior change). The AI Blueprint Agent's question-selection logic is untouched by this document.
