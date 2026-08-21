# 31 — Evaluation Audit & Versioning
## AIOS — Academic Intelligence Operating System (v2)

> **STATUS: PROPOSED — PART OF V2 PACK.** Depends on `25-EVALUATION-ENGINE.md`. Clarifies the division of responsibility between `AuditLog` (v1, unchanged) and `EvaluationVersion` (v2, new) — the critique's point 12.

---

## 1. The Core Distinction
> "Audit records tell you that something happened. Evaluation versions tell you what the evaluation state actually was."

| | `AuditLog` (v1, unchanged) | `EvaluationVersion` (v2, new) |
|---|---|---|
| **Purpose** | Security/compliance record of sensitive actions across the whole system | Domain-specific, queryable history of scoring state for one response |
| **Scope** | Cross-cutting (auth, exam locks, role changes, evaluations, everything) | Evaluation-domain only |
| **Shape** | `actorId, action, entity, entityId, oldValue, newValue, ip, userAgent, timestamp` | `source, marksAwarded, criterionScores, mistakeTag, previousVersionId` — evaluation-shaped, not generic |
| **Query pattern** | "Who did what, when, from where" | "What did the score used to be, and who/what (AI/Teacher/Reviewer) set it" |
| **Mutability** | Insert-only at the DB-role level (v1, unchanged) | Insert-only by construction (`EvaluationVersion` rows are never updated, only chained) |
| **Retention** | Indefinite (v1, unchanged) | Indefinite |

Both are written for **every** evaluation action — they are complementary layers, not alternatives. A single "teacher adjusts AI-suggested marks" action produces: one `AuditLog` row (`action: UPDATE, entity: Evaluation, entityId, oldValue: {marks:5}, newValue: {marks:7}`) **and** one `EvaluationVersion` row (`source: TEACHER, marksAwarded: 7, previousVersionId: <AI version>`). Neither is optional; neither substitutes for the other.

## 2. Why Both Are Necessary
- `AuditLog` alone cannot answer "show me the full scoring history for this specific response, with rubric criterion breakdown, in a UI timeline" efficiently — its `oldValue`/`newValue` are opaque JSON blobs meant for security review, not for building the ReviewerEvaluationConsole's version-chain UI (`28-DIGITAL-COPY-UX-SPECIFICATION.md` §6).
- `EvaluationVersion` alone cannot answer "which IP address made this change" or serve institute-wide cross-entity security audit queries (`AdminAuditLogs`/`FounderAuditLogs`, v1 screens, unchanged) — it's domain-shaped, not security-shaped.

## 3. AI-Accuracy Analytics (New Capability Enabled by This Split)
Because `EvaluationVersion.source` and `previousVersionId` are structured and queryable (unlike `AuditLog`'s generic diff blobs), v2 enables analytics that were not previously possible:
- **AI-Teacher agreement rate**: % of `EvaluationVersion(source=TEACHER)` rows where `marksAwarded` equals the immediately-prior `AI` version's `suggestedMarks` (within a small tolerance) — a direct measure of AI evaluation quality, trended over time and per model version.
- **Reviewer override rate**: % of `EvaluationVersion(source=REVIEWER)` rows that differ from the immediately-prior `TEACHER` version — a measure of grading consistency/dispute frequency, useful for identifying teachers or question types needing calibration support.
- **Time-to-finalize**: elapsed time from a `Response`'s creation to its `REVIEWER_FINALIZED` (or `TEACHER_REVIEWED`, if no review stage is configured) state — an operational efficiency metric for the evaluation pipeline.

These feed a new Admin-facing screen, **AdminEvaluationQualityDashboard** (extends the v1 Admin screen inventory), governed by `32-AI-GOVERNANCE-POLICY.md` for what's surfaced and to whom.

## 4. Dispute Resolution Workflow
When a student/guardian disputes a finalized score (post-result, e.g., a Report Card correction request):
1. Admin/Reviewer opens the `Response`'s full `EvaluationVersion` chain in `ReviewerEvaluationConsole`.
2. If the dispute is upheld, a **new** `EvaluationVersion(source=REVIEWER)` is created with a mandatory `disputeReason` field (extends the base `EvaluationVersion` shape for this specific action) — never a silent edit.
3. If the underlying `AssessmentDelivery` is `LOCKED`, this follows the same unlock-with-reason mechanism as v1's exam unlock (`22-ASSESSMENT-ENGINE.md` §3, carried from v1 FR-EXAM-02).
4. `ScoreRecord` is recomputed (per `25` §5), and if a `Report`/Report Card was already generated and distributed, a `CORRECTED` reissue is generated (extends v1's `Report` model with a `supersedesReportId` field) — the original is never silently replaced, both remain retrievable.

## 5. Query Contract Examples (for API/implementation reference)
```
GET /evaluations/:id/history
→ returns the full ordered EvaluationVersion chain for a response,
  each entry showing source, author (if human), marks, criterion
  breakdown, timestamp — the data backing ReviewerEvaluationConsole.

GET /analytics/evaluation-quality?instituteId=&modelVersion=&dateRange=
→ returns AI-teacher agreement rate, reviewer override rate,
  time-to-finalize distribution — backing AdminEvaluationQualityDashboard.
```
(Full endpoint contracts specified in `05-API-SPECIFICATION.md` (V2 section).)

## 6. Acceptance Criteria
- [ ] Every evaluation-changing action produces both an `AuditLog` row and an `EvaluationVersion` row — verified by an integration test asserting both exist after any evaluation mutation.
- [ ] Full evaluation history for any response is reconstructable via `EvaluationVersion` chain traversal alone, without needing to parse `AuditLog` JSON blobs.
- [ ] AI-accuracy analytics queries never require scanning `AuditLog` — they're computed entirely from structured `EvaluationVersion` data.
- [ ] A finalized score correction after dispute always creates a new version, never mutates history, and correctly triggers `ScoreRecord` recomputation and superseded-report tracking.
