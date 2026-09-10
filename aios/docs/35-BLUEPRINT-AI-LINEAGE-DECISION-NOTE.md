# 35 — Blueprint AI Lineage: Decision Note

**Status: DECISION NOTE ONLY. No schema change proposed for implementation.** Recommendation below is *defer*; implement nothing without explicit approval.

## 1. The current state

Blueprint is the only one of the three AI paths that records nothing about the model that ran:

| Path | Persisted artifact | Model lineage | Prompt lineage |
|---|---|---|---|
| Evaluation | `AIRecommendation` | `aiModelVersionId` | `promptVersionId` |
| OCR | `OCRResult` | `aiModelVersionId` | — |
| **Blueprint** | **none** | **none** | **none** |

B5 and B1 Stage 4 brought Blueprint under registry *execution* control — `isActive` is a genuine kill switch, and the registry-selected model is the model invoked (verified 9/9 against real Postgres). What was deferred is *recording* which model ran.

## 2. The structural fact that drives this decision

**The AI's output is never persisted.** `generate_blueprint_from_prompt()` returns a `BlueprintGenerationResult` as JSON; the router writes nothing. The web client calls `setValue(...)` to pre-fill form fields (`CreateBlueprintModal.tsx`), the teacher edits them, and the `Blueprint` row is then created from **human-submitted form data** by a separate endpoint (`papers.service.ts:34`).

This is categorically different from the other two paths. `AIRecommendation` and `OCRResult` persist the machine's own output as an auditable artifact; a `Blueprint` row is a human-authored object that *may* have been seeded by a suggestion. Human review is not a policy applied to Blueprint — it is structural, with no code path that bypasses it.

## 3. What would be gained

1. **Answering "was AI involved here at all?"** Today a Blueprint made with the AI assistant is byte-for-byte indistinguishable from a hand-made one. An institution that wants to know how much AI assistance its staff use cannot find out.
2. **Model-regression forensics.** If a model version starts producing skewed distributions (everything HARD, absurd durations), there is currently no way to identify which blueprints were seeded by it. Evaluation has this; Blueprint does not.
3. **Symmetry.** One consistent story for "which model ran, on what, when."

Reason 3 is the weakest and is not on its own a justification — it is the "architectural symmetry" argument previously ruled out.

## 4. What limits the value

The teacher edits the suggestion before anything is saved, and **the extent of that editing is not captured**. A stored `aiModelVersionId` would mean "a model was consulted at some point during the creation of this row" — not "this model produced this distribution." That is materially weaker evidence than `AIRecommendation` provides, and it is easy to over-read.

Making it strong enough to be genuinely useful means persisting the AI's *original* output alongside the human's final version, so the delta is inspectable. That is a bigger change than adding a column, and it starts to look like the `AIRecommendation`/`EvaluationVersion` pattern — which exists because evaluation decisions are high-stakes in a way that exam planning is not.

## 5. Schema and API implications

**Minimal option** — two nullable columns on `Blueprint`:

```prisma
aiModelVersionId String?
aiPromptVersionId String?   // only if a PromptVersion is also introduced
```

- Nullable is required: hand-made blueprints have no model, and every existing row would backfill as `NULL`. Backfilling anything else would violate `docs/32` §7 (no retroactive attribution).
- **The API implication is the real cost.** The value lives on the *client*, which currently has no reason to send anything back. `POST /blueprints` would need to accept an optional AI-provenance field, and the AI response would need to return the version id it used. That is a cross-service contract change (FastAPI response → web client state → NestJS create endpoint), not a Python-only change.
- A client-supplied provenance field is also **self-asserted and unverifiable** server-side — the API cannot confirm the claim, which weakens it as an audit record. Making it trustworthy would require the Python service to persist a row at generation time and hand back its id.
- Blueprint has no `PromptVersion` today. `blueprint_model_registry.py` deliberately resolves a model version only; adding prompt lineage means introducing prompt versioning for Blueprint as well.

## 6. Is it required for production governance?

**No.** On the evidence in `docs/32-AI-GOVERNANCE-POLICY.md`:

- §3's scope table permits this agent to "select/suggest questions for paper assembly" and forbids it from authoring content, altering marks/rubrics, or making any evaluation-related decision. Blueprint stays inside that boundary — it writes nothing, and B1 Stage 4 did not change its scope.
- The §2 human-in-the-loop gate is keyed on `stakesLevel` and governs **evaluation** decisions — marks that reach a student. A blueprint is a planning artifact upstream of an exam; no student outcome is attributable to it.
- §7's no-retroactive-reattribution rule is about not rewriting existing lineage. It does not require creating lineage where none exists.

The governance-critical property is *execution control* — that an admin can stop a model from running and that the registry-selected model is the one invoked. **That property is already implemented and verified.** Recording the choice afterwards is an observability improvement, not a governance requirement.

## 7. Recommendation

**Defer.** Revisit if any of these becomes true:

- An institution or regulator asks which blueprints were AI-assisted
- A model regression occurs and the absence of lineage actually obstructs the investigation
- Blueprint's scope expands such that AI output can reach a student without human editing — **this one would change the answer immediately**, since the structural human-in-the-loop in §2 is what makes the current gap acceptable

If it is later approved, do the minimal option (nullable `aiModelVersionId`) and be explicit in the column comment that it means "a model was consulted," not "this model produced this distribution."
