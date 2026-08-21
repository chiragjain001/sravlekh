# 26 — Rubric / Evaluation Model
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `21-DOMAIN-MODEL-V2.md`, `22-ASSESSMENT-ENGINE.md`. Sequenced **before** `25-EVALUATION-ENGINE.md` because evaluation granularity (question-level vs criterion-level) is determined by rubric shape, not the other way around.

---

## 1. Purpose
Define how a subjective question's marking scheme is modeled, so that both human evaluators and the AI Evaluation Engine (`27`) score against the same structured criteria rather than an unstructured "just give it a mark" instruction.

## 2. Design Principle: Rubrics Are Optional and Additive
Objective question types (`MCQ`, `MULTI_CORRECT`, `NUMERICAL`, `MATCH_THE_FOLLOWING`) **never require a rubric** — they are scored directly (correct/incorrect, full marks or zero, or partial-credit-by-option-count for multi-correct) exactly as in v1. Rubrics apply only to `SHORT_ANSWER`, `LONG_ANSWER`, and subjective sub-questions of `PASSAGE_BASED` items. A subjective question with no attached rubric is still fully supported — it falls back to **holistic evaluation** (a single mark + tag, human or AI, with no criterion breakdown), which is exactly v1's behavior for subjective questions today. Rubrics are how you *upgrade* a subjective question's evaluation quality, not a requirement to use the system at all.

## 3. Entities

### 3.1 `Rubric`
| Field | Notes |
|---|---|
| id | |
| instituteId | |
| questionId | FK — one rubric belongs to exactly one question (a rubric is not a reusable template across questions in v2 day one; templated/reusable rubrics are a documented future extension, not built now) |
| name | e.g. "Photosynthesis explanation — 5 mark rubric" |
| maxMarks | must equal the linked Question's `marks` |
| scoringMode | enum: `CRITERION_ADDITIVE` (sum of criterion scores), `STEP_WISE` (sequential — a later step's credit depends on an earlier step being correct, for math proofs), `HOLISTIC_WITH_GUIDANCE` (single mark but with descriptive band guidance, no discrete criteria) |
| createdByUserId | |

### 3.2 `RubricVersion` (immutable — mirrors `QuestionVersion`'s discipline)
| Field | Notes |
|---|---|
| id | |
| rubricId | FK |
| versionNumber | |
| criteriaSnapshot | json — full frozen criteria list at this version |
| editedByUserId | |
| createdAt | |

**Rule (identical in spirit to v1's Question versioning):** once a `Rubric` has been used to produce any `EvaluationVersion` for a `LOCKED` or `EVALUATING`-stage `AssessmentDelivery`, editing it creates a new `RubricVersion` rather than mutating the live rubric — every `EvaluationVersion` references the exact `rubricVersionId` it was scored against, so re-grading disputes can always reconstruct "what rubric was in effect at the time."

### 3.3 `RubricCriterion`
| Field | Notes |
|---|---|
| id | |
| rubricVersionId | FK |
| order | sequence within the rubric |
| description | e.g. "Correctly identifies chlorophyll's role" |
| maxMarks | |
| keywordHints | string[], optional — terms/phrases that suggest this criterion is met, used as *input signal* to the AI Evaluation Engine, never as an automatic pass/fail on their own |
| dependsOnCriterionId | FK, nullable — used for `STEP_WISE` scoring mode (e.g., "final answer" criterion depends on "correct method" criterion) |

### 3.4 `EvaluationCriterionScore` (lives in the Evaluation cluster, `25`, but defined here for completeness since its shape is rubric-derived)
| Field | Notes |
|---|---|
| id | |
| evaluationVersionId | FK → `EvaluationVersion` (see `25`) |
| rubricCriterionId | FK |
| marksAwarded | 0 ≤ x ≤ criterion.maxMarks |
| note | optional free-text justification (human or AI-generated) |

## 4. Scoring Modes — Business Logic

### 4.1 `CRITERION_ADDITIVE`
Total = Σ(`EvaluationCriterionScore.marksAwarded`) across all criteria in the rubric version, capped at `Rubric.maxMarks`. This is the default and most common mode — matches the critique's photosynthesis example exactly (five 1-mark criteria summing to a 5-mark question).

### 4.2 `STEP_WISE`
Criteria form a dependency chain (`dependsOnCriterionId`). A criterion cannot be awarded marks if its dependency criterion scored zero, **unless** the evaluator explicitly overrides this with a documented reason (e.g., correct final answer reached via an unconventional but valid method) — the override itself is recorded as part of the `EvaluationVersion`'s criterion score note, not silently allowed to bypass the rule without a trace.

### 4.3 `HOLISTIC_WITH_GUIDANCE`
No discrete `EvaluationCriterionScore` rows are created. `RubricVersion.criteriaSnapshot` instead holds descriptive scoring bands (e.g., "4–5: comprehensive and accurate," "2–3: partially correct," "0–1: minimal/incorrect understanding") shown to the evaluator (human or AI) as guidance for a single holistic mark. This mode exists specifically so that not every subjective question needs to be decomposed into rigid criteria — some genuinely benefit from expert holistic judgment, and forcing artificial criteria onto them would degrade evaluation quality, not improve it.

## 5. Rubric Authoring Workflow
**Feature: Author Rubric**
- **Who can use it:** TEACHER (question author or assigned), ADMIN.
- **Input:** questionId, scoringMode, criteria list (description, maxMarks, keywordHints?, dependsOnCriterionId?).
- **Business logic:** Sum of criterion `maxMarks` must equal `Rubric.maxMarks` must equal `Question.marks` — three-way reconciliation, validated server-side, mirroring the Blueprint marks-reconciliation rule from v1 (`03-FEATURE-SPECIFICATIONS.md` v1, Blueprint feature).
- **Edge cases:** A rubric authored after an `AssessmentDelivery` using its question has already entered `PUBLISHED` — allowed (rubrics can be added/refined up until evaluation begins), but blocked once the delivery enters `EVALUATING` for that specific delivery's already-in-progress evaluations (new evaluations in that batch would otherwise be scored against a moving target mid-evaluation-window).
- **Acceptance criteria:**
  - [ ] Criterion marks always reconcile to Question marks.
  - [ ] Editing a rubric mid-evaluation-window for a specific delivery is blocked; editing before evaluation starts is allowed freely.
  - [ ] Every `EvaluationVersion` is permanently traceable to the exact `RubricVersion` used.

## 6. Relationship to Question Bank
`Question.rubricId` is a new optional FK added in v2 (nullable — most objective questions will never populate it). This is a strictly additive schema change to the v1 `Question` model; no existing Question rows require migration.

## 7. Relationship to Mastery/Diagnostic Engine
Criterion-level scores are **not** individually fed into `MasteryScore` calculation — mastery remains computed from the aggregate `marksAwarded`/`marksAvailable` at the question level (v1 formula, unchanged, per `21-DOMAIN-MODEL-V2.md` §4.8). However, criterion-level data is retained and available for a richer *future* diagnostic view (e.g., "students consistently lose the 'correct equation' criterion across chlorophyll-related questions") — this is a documented Phase-2-of-v2 analytics opportunity, not built into the mastery formula on day one, to avoid destabilizing the well-understood v1 mastery philosophy.

## 8. Acceptance Criteria (Document-Level)
- [ ] Objective questions require zero rubric interaction — no regression for the existing OMR/MCQ coaching workflow.
- [ ] A subjective question with no rubric still evaluates correctly via holistic scoring (matches v1 behavior exactly).
- [ ] Rubric versioning guarantees any historical evaluation can be traced to its exact scoring criteria, even after the rubric is later edited.
