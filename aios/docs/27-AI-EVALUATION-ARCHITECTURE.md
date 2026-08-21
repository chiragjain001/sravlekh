# 27 — AI Evaluation Architecture
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `21`, `25-EVALUATION-ENGINE.md`, `26-RUBRIC-EVALUATION-SPECIFICATION.md`. Governed by `32-AI-GOVERNANCE-POLICY.md`.

---

## 1. Purpose & Scope
Specify how the FastAPI AI service produces an `AIRecommendation` (§25 §3.3) for a subjective `Response`. This is explicitly **distinct** from the v1 AI Blueprint Agent (which *selects questions* for paper generation) — different input, different model, different failure mode, different risk profile. The two must never be conflated in code or in this documentation.

## 2. High-Level Pipeline
```
Response (evidenceType = DIGITAL_VALUE or PAGE_REGION+OCRResult)
        +
Question content
        +
RubricVersion (if present) — else HOLISTIC fallback
        +
Model expected/reference answer (Question.solutionExplanation)
        ↓
AI Evaluation Service (FastAPI: apps/api-python/src/evaluation/ai_evaluator.py)
        ↓
Per-criterion (or holistic) suggested scores + confidence + flags
        ↓
AIRecommendation persisted
        ↓
New EvaluationVersion(source=AI) created
        ↓
Evaluation.status = AI_SUGGESTED
        ↓
Surfaced in Teacher's Evaluation Work Queue
```

## 3. Inputs to the AI Evaluator
| Input | Source | Notes |
|---|---|---|
| Answer text | `Response.digitalValue` (typed) or `OCRResult.extractedText` (handwritten, via `PageRegion`) | If OCR confidence is below a documented threshold (`24-OCR-HANDWRITING-ARCHITECTURE.md`), the AI evaluator still runs but the resulting `AIRecommendation.flags` includes `ocr_low_confidence`, signaling the teacher to verify the source image directly rather than trust the score blindly |
| Question content + marks | `Question`/`QuestionVersion` | unchanged v1 entity |
| Reference/model answer | `Question.solutionExplanation` | required for meaningful AI evaluation — a question authored without a solution explanation cannot be AI-evaluated; falls straight to the human queue with a flag `no_reference_answer` |
| Rubric | `RubricVersion` + `RubricCriterion` list, or absence thereof (→ `HOLISTIC` mode) | per `26` |
| Prior evaluation context | none by default — each `AIRecommendation` is generated fresh; batch-level calibration (e.g., "this teacher tends to grade generously") is an explicit non-goal for v2 day one, to avoid the AI silently drifting scores based on inferred grader bias |

## 4. Output Contract — **Expanded for Full Reproducibility (Fix #5)**
The output contract previously carried only a bare `modelVersion` string, which is insufficient to reconstruct "why did the AI give this score" months later — the question wording, rubric wording, and exact evidence shown to the model could all have since changed. The contract now mirrors `AIRecommendation`'s full schema (`04-DATABASE-SCHEMA.md` V2 section §1.23):
```json
{
  "responseId": "...",
  "questionVersionId": "...",
  "rubricVersionId": "...",
  "evidenceRef": { "evidenceType": "PAGE_REGION", "ocrResultId": "..." },
  "evaluationPolicyId": "...",
  "aiModelVersionId": "...",
  "promptVersionId": "...",
  "modelParameters": { "temperature": 0.2, "maxTokens": 800 },
  "inputArtifactHash": "sha256:9f8c...",
  "suggestedMarks": 4.0,
  "suggestedCriterionScores": [
    { "rubricCriterionId": "...", "marksAwarded": 1.0, "note": "Correctly states chlorophyll's role" },
    { "rubricCriterionId": "...", "marksAwarded": 0.0, "note": "Chemical equation missing or incorrect" }
  ],
  "confidence": 0.82,
  "flags": ["none"]
}
```
`inputArtifactHash` is computed by the evaluator service over the exact serialized payload it sent to the model (question content + rubric + evidence text, in the exact prompt-assembled form) — this lets a later audit verify not just "which model" but "was the input actually what we think it was," independent of trusting the service's own logs. `aiModelVersionId` and `promptVersionId` resolve to the model registry (`04-DATABASE-SCHEMA.md` V2 section §1.24–1.27, fix #6) — the bare `modelVersion` string field is removed from this contract entirely, replaced by these FK references.

For `HOLISTIC_WITH_GUIDANCE` rubrics or no-rubric questions, `suggestedCriterionScores` is omitted and only `suggestedMarks` + a free-text `note` justifying the holistic score is returned; all other reproducibility fields above are still populated identically.

## 5. Confidence & Flag Taxonomy
| Flag | Meaning | Effect on workflow |
|---|---|---|
| `low_confidence` | Model's own confidence score below threshold (default 0.6, configurable per institute) | Prioritized higher in the evaluation work queue (`25` §7) |
| `ocr_low_confidence` | Underlying OCR text extraction confidence was low | Teacher UI surfaces the original page image prominently, not just the OCR'd text |
| `illegible_handwriting` | OCR pipeline itself flagged the source as likely illegible | Routed directly to human evaluation without an AI score attempt (AI evaluation is skipped, not attempted on unreliable text) |
| `off_topic_suspected` | Answer text has low semantic relevance to the question | Flagged for careful human review — never auto-scored zero on this basis alone |
| `no_reference_answer` | Question lacks a solution explanation to evaluate against | AI evaluation skipped entirely, routed to human queue |
| `answer_exceeds_expected_length` | Possible multi-question bleed (student's answer for Q5 accidentally includes part of Q6) | Flagged for a document/region-mapping check, not just a scoring check |

**Design rule:** flags **downgrade confidence in the AI's output and route work to humans faster** — they never cause the AI to silently withhold a `Response` from the evaluation queue altogether, and they never cause an automatic zero or automatic pass. The AI recommendation, however low-confidence, is always still produced and shown (governance principle, `32-AI-GOVERNANCE-POLICY.md`).

## 6. Timeout, Retry, and Fallback (mirrors v1's third-party integration discipline)
- **Timeout:** 8 second soft target, 20 second hard timeout per response (subjective evaluation is more computationally involved than v1's Blueprint generation call, hence a higher ceiling).
- **Retry:** 2 retries with exponential backoff on transient failure.
- **Fallback:** On exhausted retries, the `Response` is placed directly into the human Evaluation Work Queue with `Evaluation.status` remaining `PENDING` and a system flag noting AI processing failed — **teacher evaluation is never blocked by AI unavailability**, identical in spirit to v1's "manual paper assembly if Blueprint Agent is down."
- **Batch processing:** Unlike the single-request Blueprint generation call, AI evaluation for a `LOCKED`-bound delivery's responses runs as a **batched async job** (queue: `ai-evaluation`, see `29`/`10-SCALABILITY-STRATEGY.md` extension), not a per-response synchronous request from the teacher's browser — the teacher never waits on AI evaluation latency directly.

## 7. Human-in-the-Loop Is Structural, Not Optional
No `EvaluationVersion(source=AI)` is ever treated as the authoritative final score for a `ScoreRecord` used in official results, report cards, or rank calculation **unless the delivery's `EvaluationPolicy.mode = AI_FINAL_LOW_STAKES`**, which is only a legal, server-validated configuration when the parent `Assessment.stakesLevel != GRADED` (`04-DATABASE-SCHEMA.md` V2 section §1.2a) — governed and gated by `32-AI-GOVERNANCE-POLICY.md`. **Fix #3 correction:** this gate keys off `stakesLevel`, not `assessmentKind` — for **any** `Assessment` where `stakesLevel = GRADED`, regardless of `assessmentKind` (a graded `SCHOOL_THEORY_EXAM`, a graded `PRACTICE_TEST`, a graded `COACHING_TEST` all qualify equally), a `TEACHER`-or-higher `EvaluationVersion` is **mandatory** before an `AssessmentDelivery` can transition to `LOCKED` — this is enforced as a hard gate in the state machine, extending v1's `EVALUATING → LOCKED` guard.

## 8. Model Versioning & Reproducibility
Every `AIRecommendation` records its exact `aiModelVersionId` and `promptVersionId` (fix #5/#6, §4). If the underlying model/prompt is updated, historical recommendations remain attributed to the exact version row that produced them — they are never silently re-labeled as having come from the new version, and since these are FK references to immutable registry rows (`AIModelVersion`, `PromptVersion`), there is no string-drift risk (e.g., two different "v1.2" labels meaning different things over time, which a bare string field would not prevent). Re-running evaluation with a newer model version on an already-evaluated response is an explicit, audited action (`POST /evaluations/:id/reprocess`, see `05-API-SPECIFICATION.md` (V2 section)), producing a new `EvaluationVersion(source=AI)` chained after the prior one, referencing the newer `aiModelVersionId`, never overwriting it.

## 8a. AI Model Registry — No Hardcoded Vendor Calls (Fix #6)
`evaluation/ai_evaluator.py` (and the OCR service, `24-OCR-HANDWRITING-ARCHITECTURE.md`) **must never** directly instantiate a vendor-specific SDK client (e.g., an `OpenAIService`, `GeminiService`, or `AnthropicService` class hardcoded into evaluation-domain code). All model invocation is mediated by the registry defined in `04-DATABASE-SCHEMA.md` (V2 section) §1.24–1.27:
```
AIProvider  →  AIModel (purpose=EVALUATION)  →  AIModelVersion (isActive=true)
                                              ↘
                                                PromptVersion
```
- At call time, the evaluator resolves the currently-`isActive` `AIModelVersion` for `AIModel.purpose=EVALUATION` (institute-configurable, defaulting to a platform-wide default) and the corresponding `PromptVersion`, rather than referencing a vendor name/model string anywhere in application code.
- A thin, single **provider adapter layer** (one adapter class per `AIProvider` row, e.g. `providers/openai_adapter.py`, `providers/anthropic_adapter.py`) is the *only* place vendor SDKs are imported — selected dynamically at call time via `AIProvider.name`, never via an `if/else` chain scattered through evaluation logic.
- Adding a new provider or promoting a new model version is a **registry data change** (new rows in `AIModel`/`AIModelVersion`, plus a new adapter class if it's a genuinely new provider) — never a change to `ai_evaluator.py`'s scoring/routing logic itself.
- This same registry and adapter-layer discipline applies identically to the OCR/Handwriting service (`24`), which has its own `AIModel` rows with `purpose=OCR`/`purpose=HANDWRITING`.

## 9. Performance Targets (extends `11-PERFORMANCE-REQUIREMENTS.md`)
| Operation | Target |
|---|---|
| Single-response AI evaluation (batched job, per item) | < 5s (p95) |
| Full-delivery batch AI evaluation (e.g., 40 students × 5 subjective questions = 200 responses) | < 15 minutes (p95), running as parallelized workers, not sequential |
| AI recommendation surfaced to teacher queue after generation | < 10s (matches v1's mastery-recalculation propagation target philosophy) |

## 10. Acceptance Criteria
- [ ] AI evaluation never blocks or gates human evaluation availability.
- [ ] Every AI recommendation carries a confidence score and, where applicable, specific flags — never a bare number with no context.
- [ ] `stakesLevel=GRADED` deliveries (any `assessmentKind`) cannot reach `LOCKED` without at least one human (`TEACHER`+) evaluation per subjective response.
- [ ] Model version is always recorded and never silently reattributed on model upgrades.
- [ ] Re-processing an evaluation with a newer model creates a new chained version, never overwrites history.
