# 32 — AI Governance Policy
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Governs `27-AI-EVALUATION-ARCHITECTURE.md` and the AI Blueprint Agent (v1, unchanged). Sits conceptually alongside `07-SECURITY-SPECIFICATION.md` in the Hierarchy of Truth — AI-specific policy does not override security requirements, it adds a parallel governance layer specific to AI-generated academic judgments.

---

## 1. Purpose
Establish the non-negotiable rules governing how AI-generated content (question selection, and especially subjective-answer evaluation) may and may not be used, so that AI assistance never becomes an unaccountable authority over a student's academic record.

## 2. Core Principle: AI Recommends, Humans Decide
This is restated from `27-AI-EVALUATION-ARCHITECTURE.md` §7 and elevated here as a governance-level, cross-document rule.

**Fix #3 — the gate condition is corrected to key off `stakesLevel`, not `assessmentKind`.** The original wording gated on "is this a `SCHOOL_THEORY_EXAM`," which conflated pedagogical category with stakes — a graded `PRACTICE_TEST` (still contributing to a report card) was incorrectly exempt under the old wording, while an ungraded `SCHOOL_THEORY_EXAM` (pure diagnostic, e.g. a low-stakes practice paper delivered as a theory exam) was incorrectly captured by it. The corrected rule:

- No AI-generated evaluation (`EvaluationVersion(source=AI)`) is ever the terminal, official score for **any `Assessment` where `stakesLevel = GRADED`** without a human (`TEACHER` or higher) `EvaluationVersion` superseding it — regardless of `assessmentKind`.
- The **only** exception is when the linked `AssessmentDelivery.evaluationPolicyId` resolves to `EvaluationPolicy.mode = AI_FINAL_LOW_STAKES`, which (per `04-DATABASE-SCHEMA.md` V2 section §1.2a) is only a legal, server-validated selection when `Assessment.stakesLevel != GRADED` (`PRACTICE` or `DIAGNOSTIC_ONLY`) — the two rules are reciprocal by construction, not just by convention. Even then, the student-facing UI must clearly disclose the score was AI-generated and not human-reviewed (transparency requirement, §5).
- This rule is enforced as a **hard state-machine gate** (`27` §7), not a policy document alone — `AssessmentDelivery.status` cannot reach `LOCKED` while `Assessment.stakesLevel = GRADED` and any subjective `Response` lacks a `TEACHER`+ `EvaluationVersion`, irrespective of `assessmentKind`. See `05-API-SPECIFICATION.md`'s corrected `SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED` error condition.

## 3. AI Model Scope Boundaries
| AI Component | What it MAY do | What it MUST NOT do |
|---|---|---|
| AI Blueprint Agent (v1, unchanged) | Select/suggest questions for paper assembly based on topic/difficulty balance | Author new question content, alter marks/rubrics, or make any evaluation-related decision |
| AI Evaluation Engine (v2) | Suggest marks/criterion scores with confidence + flags, for human review | Auto-finalize scores for any `stakesLevel=GRADED` delivery (corrected, was worded as "SCHOOL_THEORY_EXAM deliveries" — see §2 fix); auto-score diagrams/tables (`24` §3.3); score without a reference answer present (`27` §3); infer or apply grader-specific bias calibration (`27` §3); call a vendor AI SDK directly rather than through the model registry (`27` §8a, fix #6) |
| Mastery/Diagnostic Engine (v1, unchanged) | Compute mastery index and trigger interventions from finalized scores | Use AI-suggested (not-yet-human-reviewed) marks as input — mastery calculation always reads from `Evaluation.currentEvaluationVersionId`, and for subjective responses this is guaranteed by §2's gate to be human-authored by the time `LOCKED` is reached |

## 4. Bias & Fairness Monitoring
- `AdminEvaluationQualityDashboard` (`31-EVALUATION-AUDIT-VERSIONING.md` §3) is extended to surface AI-teacher agreement rate **segmented by student subgroup** where the institute has opted to track such segmentation (e.g., by batch, by language of instruction) — specifically to detect if the AI systematically under- or over-scores certain groups' handwriting/language patterns. This is opt-in per institute (privacy-sensitive segmentation), not a default-on cross-institute comparison.
- A sustained, statistically notable disagreement pattern between AI and teacher scores for a specific question, rubric, or student subgroup triggers a flag on the Admin dashboard for manual review — this is a monitoring/alerting mechanism, not an automatic model change (no auto-retraining or auto-adjustment happens silently).

## 5. Transparency Requirements
- Every AI-assisted evaluation retains its `modelVersion` (`27` §8) — an institute or regulator can always determine which model version produced a given historical recommendation.
- Students never see raw AI-recommendation detail (`28-DIGITAL-COPY-UX-SPECIFICATION.md` §5) — they see only finalized, human-accountable results, consistent with holding a named human (teacher/reviewer) accountable for every score that reaches a student, even when AI assisted in producing it.
- Where AI-final-scoring is enabled for low-stakes assessments (§2 exception), this must be disclosed in the student-facing result view (e.g., a visible "AI-scored practice test" label) — never presented identically to a teacher-graded result.

## 6. Data Usage Boundaries
- Student answer content (text, OCR'd handwriting, images) sent to the AI Evaluation Engine is used **only** for producing that specific `AIRecommendation** — it is not used to further train or fine-tune any shared/cross-tenant model without a separate, explicit, documented consent and data-processing agreement per institute (extends `07-SECURITY-SPECIFICATION.md` §12 PII handling to cover AI-processing-specific consent, since evaluation content is student academic work product, a category warranting the same tenant-isolation discipline as any other PII).
- No student's answer content or evaluation history is used for cross-tenant benchmarking or shared-model improvement without that explicit consent — this mirrors the platform's existing multi-tenant isolation philosophy (`07-SECURITY-SPECIFICATION.md` §16) extended into the AI-processing domain specifically.

## 7. Reprocessing & Model Upgrade Policy
- Upgrading the AI evaluation model/prompt version does **not** retroactively alter any historical `EvaluationVersion` — per `27` §8, re-scoring with a new model is always an explicit, audited, additive action (`POST /evaluations/:id/reprocess`), never a silent batch rewrite of past results.
- Before a new model version is enabled institute-wide, it is evaluated against a held-out sample of already-human-finalized evaluations to establish its agreement-rate baseline (feeding §4's monitoring) — this is a pre-launch quality gate, not a post-hoc discovery process.

## 8. Escalation & Appeals
Any AI-influenced evaluation is subject to the same dispute/appeal workflow as any human evaluation (`31-EVALUATION-AUDIT-VERSIONING.md` §4) — there is no separate, lesser appeals process for AI-assisted scores; a student's right to dispute a mark is identical regardless of whether AI contributed to the initial suggestion.

## 9. Acceptance Criteria
- [ ] No delivery of an `Assessment` with `stakesLevel=GRADED` can reach `LOCKED` with any subjective response lacking a human `EvaluationVersion`, regardless of `assessmentKind` — enforced at the state-machine level, verified by an automated test attempting to bypass this gate (including via each `assessmentKind` value, to confirm the gate truly keys off `stakesLevel` and not `assessmentKind`).
- [ ] No evaluation-domain or OCR-domain code directly imports/instantiates a vendor AI SDK — all calls route through the `AIProvider`/`AIModel`/`AIModelVersion` registry and adapter layer (`27` §8a).
- [ ] AI-final-scoring is only possible for explicitly-configured low-stakes assessment types, and always visibly disclosed to the student where used.
- [ ] Model version is recorded on every AI recommendation and never retroactively reattributed.
- [ ] Student evaluation data is never used for cross-tenant model training without explicit, documented per-institute consent.
- [ ] Bias-monitoring dashboards exist and flag sustained disagreement patterns without performing any automatic corrective action on the model itself.
