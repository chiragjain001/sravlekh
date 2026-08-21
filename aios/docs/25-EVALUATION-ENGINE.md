# 25 — Evaluation Engine
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `21-DOMAIN-MODEL-V2.md`, `22-ASSESSMENT-ENGINE.md`, `26-RUBRIC-EVALUATION-SPECIFICATION.md`.

---

## 1. Purpose
Replace v1's direct, mutable `Response.marksAwarded`/`Response.mistakeTagType` fields with a versioned, source-attributed evaluation history — the single most important structural change in the v2 pack, per the critique's point 12 ("audit records tell you something happened; evaluation versions tell you what the evaluation state actually was").

## 2. Core Rule
**A `Response` is never graded in place.** Every scoring action — whether by AI, TEACHER, or REVIEWER — creates a new `EvaluationVersion`. `Evaluation` is a thin, always-current pointer to the latest `EvaluationVersion` for a given `Response`, maintained for fast reads (dashboards, mastery calculation) without requiring a walk of the full version chain on every read.

## 3. Entities

### 3.1 `Evaluation`
| Field | Notes |
|---|---|
| id | |
| responseId | FK, unique — exactly one `Evaluation` row per `Response` |
| currentEvaluationVersionId | FK → `EvaluationVersion` — always the latest |
| status | `PENDING` (no version yet — response exists, unscored), `AI_SUGGESTED`, `TEACHER_REVIEWED`, `REVIEWER_FINALIZED` |

### 3.2 `EvaluationVersion` (immutable, append-only)
| Field | Notes |
|---|---|
| id | |
| evaluationId | FK |
| previousVersionId | FK, nullable — self-referencing chain: `AI suggested 5/10 → Teacher changed 7/10 → Reviewer changed 6/10` is three `EvaluationVersion` rows chained by this field |
| source | enum: `AI`, `TEACHER`, `REVIEWER` |
| authorUserId | FK → User, nullable (null when `source = AI`) |
| marksAwarded | float |
| mistakeTagType | enum, nullable — the v1 6-value taxonomy, unchanged, extensible per `21-DOMAIN-MODEL-V2.md` §4.7 |
| teacherComment | text, nullable |
| criterionScores | relation → `EvaluationCriterionScore[]` (populated only for `CRITERION_ADDITIVE`/`STEP_WISE` rubric-scored responses, per `26`) |
| aiRecommendationId | FK, nullable — populated when `source = AI`, linking to the full AI output detail (§3.3) |
| createdAt | |

### 3.3 `AIRecommendation`
**Fix #5/#6 update:** `AIRecommendation`'s full field list (question/rubric/evidence pinning, model registry FKs, input hash) is specified authoritatively in `04-DATABASE-SCHEMA.md` (V2 section) §1.23–1.27 and `27-AI-EVALUATION-ARCHITECTURE.md` §4/§8a — summarized here only as: it carries everything needed to reconstruct the exact input context of any historical AI suggestion (question version, rubric version, evidence reference, model version, prompt version, model parameters, input hash), resolved through an explicit `AIProvider`/`AIModel`/`AIModelVersion` registry rather than a bare `modelVersion` string. No evaluation-domain code hardcodes a vendor SDK call — see `27` §8a.

### 3.4 `TeacherDecision` and `EvaluationOverride`
These are **not separate tables** — they are `EvaluationVersion` rows with `source = TEACHER` or `source = REVIEWER` respectively. They are named as distinct concepts in the domain model purely for clarity of business meaning and for query ergonomics (e.g., an analytics query "how often does a reviewer change a teacher's decision" filters `EvaluationVersion WHERE source = 'REVIEWER' AND previousVersion.source = 'TEACHER'"). No additional schema is required beyond `EvaluationVersion` itself.

## 4. Evaluation Workflow — Full Specification

### 4.1 Feature: AI-Assisted Evaluation Pass
- **Purpose:** Produce a first-pass suggested score for every subjective `Response` in a `LOCKED`-bound `Attempt` (triggered when `AssessmentDelivery` enters `EVALUATING`, mirroring v1's timing).
- **Who can use it:** System-triggered (async), never exposed as a direct user action beyond "re-run AI evaluation" (an explicit TEACHER/ADMIN action for reprocessing).
- **Input:** responseId, its evidence (digital value or OCR'd page-region text), the linked Question + RubricVersion (if any).
- **Output:** `AIRecommendation` + a new `EvaluationVersion(source=AI)`, `Evaluation.status = AI_SUGGESTED`.
- **Business logic:** See `27-AI-EVALUATION-ARCHITECTURE.md` for the AI scoring logic itself; this document only specifies the versioning contract around it.
- **Edge cases:** AI evaluation fails/times out for a given response → `Evaluation.status` remains `PENDING`, response is queued directly into the human evaluation queue with a flag noting AI processing failed (never silently blocks human evaluation — AI unavailability must not gate the grading pipeline, mirroring v1's "manual paper assembly remains available if AI service is down" principle from `18-EDGE-CASES.md` v1).
- **Acceptance criteria:**
  - [ ] Objective-type Responses never enter this pipeline (they're graded directly, unchanged from v1).
  - [ ] AI unavailability degrades to a fully-manual evaluation queue, never blocks grading.

### 4.2 Feature: Teacher Evaluation Review
- **Purpose:** Human review of AI-suggested (or unscored) responses.
- **Who can use it:** TEACHER (assigned batch/subject).
- **Input:** responseId, decision (`accept AI suggestion as-is` / `adjust marks or criteria` / `override tag` / `reject entirely and re-score from scratch`).
- **Output:** New `EvaluationVersion(source=TEACHER, previousVersionId = <the AI version if one existed>)`; `Evaluation.status = TEACHER_REVIEWED`.
- **Business logic:** "Accept as-is" still creates a new `EvaluationVersion` (not a no-op) — this is deliberate: it records *that* a human reviewed and endorsed the AI's number, which is a materially different fact from "no human has looked at this yet," and matters for both audit and for future AI-accuracy analysis (`32-AI-GOVERNANCE-POLICY.md`).
- **Edge cases:** Teacher adjusts marks on a `CRITERION_ADDITIVE` rubric question by editing individual criterion scores rather than the total — the total is always **derived**, never independently editable when criteria exist, preventing an inconsistent state where the sum of criteria doesn't match the recorded total.
- **Permissions:** TEACHER assigned batch, ADMIN.
- **Acceptance criteria:**
  - [ ] "Accept as-is" is a real, distinct `EvaluationVersion`, not a UI-only no-op.
  - [ ] Total marks on criterion-based rubrics are always derived from criterion scores, never independently set.

### 4.3 Feature: Reviewer Override
- **Purpose:** A second-pass, higher-authority review (e.g., moderation, dispute resolution, senior-evaluator spot-check).
- **Who can use it:** A role holding the `REVIEW_EVALUATION` permission (see the Role/Permission/Scope model, `21-DOMAIN-MODEL-V2.md` §4.10 — not necessarily a new hardcoded role, could be an ADMIN or a delegated senior TEACHER granted this permission).
- **Input:** responseId, decision.
- **Output:** New `EvaluationVersion(source=REVIEWER, previousVersionId = <prior version>)`; `Evaluation.status = REVIEWER_FINALIZED`.
- **Business logic:** A `REVIEWER_FINALIZED` evaluation is the terminal state for that response within the current `AssessmentDelivery` lifecycle — it can still theoretically be re-opened (e.g., a post-result dispute), but doing so is itself a new `EvaluationVersion` with a mandatory reason, treated with the same seriousness as v1's exam-unlock-with-reason pattern.
- **Edge cases:** Reviewer override on a delivery that is already `LOCKED` — permitted only via the same `unlock`-with-reason mechanism that governs `AssessmentDelivery` state (§`22-ASSESSMENT-ENGINE.md`), since re-scoring a locked exam has identical integrity implications to v1's exam unlock.
- **Permissions:** Explicitly scoped permission, not implied by ADMIN role alone (an ADMIN does not automatically have evaluation-review rights unless granted, per the Permission/Scope model — this prevents accidental grading authority sprawl).
- **Acceptance criteria:**
  - [ ] Reviewer changes are queryable independently from teacher changes for AI-accuracy analysis.
  - [ ] Post-lock evaluation changes require the same reason-and-audit discipline as v1's exam unlock.

## 5. Aggregation into `ScoreRecord`
`ScoreRecord.totalMarksAwarded` (unchanged entity from v1) is computed by summing, across all `Response`s in an `Attempt`, the `marksAwarded` of each `Response`'s **current** `EvaluationVersion` (via `Evaluation.currentEvaluationVersionId`). This recalculation is triggered on every `EvaluationVersion` write, async, using the same fire-and-forget pattern as v1's mastery-recalculation trigger — writing an evaluation must remain fast (mirrors the `<300ms` grading-write target from `11-PERFORMANCE-REQUIREMENTS.md` v1), with aggregate recomputation happening downstream.

## 6. Relationship to `AuditLog`
`AuditLog` (v1, unchanged) continues to record the *fact* that an evaluation-related action occurred (who, when, what entity) for institute-wide security/compliance audit purposes. `EvaluationVersion` records the *content* of each evaluation state. These are complementary, not redundant — see `31-EVALUATION-AUDIT-VERSIONING.md` for the precise division of responsibility and query patterns for each.

## 7. Evaluation Work Queue (replaces/extends v1's Evaluation Queue)
- `GET /evaluation-work-items` (new v2 endpoint, see `05-API-SPECIFICATION.md` (V2 section)) returns `Response`s needing human attention, prioritized by: AI-flagged-low-confidence first, then oldest-submitted-first, filterable by batch/subject/AI-flag-type.
- This generalizes v1's `GET /exams/:id/evaluation-queue` (which remains available as a scoped, backward-compatible view for a single delivery).

## 8. Acceptance Criteria (Document-Level)
- [ ] No `Response` is ever graded by direct field mutation — every score change is a new, chained `EvaluationVersion`.
- [ ] Full AI→Teacher→Reviewer history is reconstructable for any response, in order, with no gaps.
- [ ] `ScoreRecord` aggregation always reflects each response's *current* evaluation, recomputed async on every version write.
- [ ] Objective (MCQ/OMR/numerical) grading path is entirely unaffected — zero behavior change, zero added latency.
