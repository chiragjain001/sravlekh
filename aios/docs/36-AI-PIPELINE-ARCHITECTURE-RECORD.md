# 36 — AI Pipeline Architecture Record (post-P0/P1)

Final state of the three production AI call sites after P0 remediation and P1 (A4, C3, D1, D2, E1, B5, B3, B1) plus post-B1 hardening. Descriptive record, not a proposal.

## 1. The shared spine

```
Evaluation / OCR / Blueprint
        │
        ├─ 1. registry            resolve AIModel → active AIModelVersion (isActive, createdAt desc)
        │                         no active row → explicit failure, never a fallback model
        ├─ 2. prompt construction render template + parser format instructions
        ├─ 3. GenerateRequest     content parts, model, temperature, max_tokens
        ├─ 4. ModelProviderAdapter  abstract boundary (providers/base.py)
        ├─ 5. OpenAIAdapter       the ONLY module importing a vendor SDK
        │        └─ provider      vendor call; errors normalized to AdapterError
        ├─ 6. parser              PydanticOutputParser, above the adapter
        └─ 7. persistence/governance   unchanged by B1
```

The adapter returns **raw text**. Parsing, timeout policy, and all persistence stay above it — deliberately, so the boundary is "how do we reach a model," not "what do we do with the answer."

## 2. Where the three pipelines genuinely differ

They are not one pipeline with three callers. The differences are load-bearing.

| | **Evaluation** | **OCR** | **Blueprint** |
|---|---|---|---|
| Entry | `evaluate_response()` | `POST /ocr/extract` | `POST /ai/generate-blueprint` |
| Registry purpose | `EVALUATION` | `OCR` | `BLUEPRINT` |
| Prompt lineage | **`PromptVersion` (v2) + `inputArtifactHash`** | none | none |
| Content parts | 1 × `TextPart` | **`[TextPart, ImagePart]`** | 1 × `TextPart` |
| Temperature | 0.2 | **0.0** | 0.2 |
| `max_tokens` | **800** | unset | unset |
| Timeout | **20s hard (`docs/27` §6)** | none | none |
| No active model | `Skipped` → human queue | **HTTP 503** | `ValueError` → HTTP 500 |
| Persists | `AIRecommendation` + `EvaluationVersion(source=AI)` | `OCRResult` | **nothing** |
| Governance weight | High — feeds marks | Medium — feeds evaluation | Low — a suggestion |
| Human review | Mandatory, enforced server-side | Confidence-routed | **Structural** (see §4) |

### Why each difference exists

- **OCR is the only multimodal path.** Its `ImagePart` is why the adapter has a content-part vocabulary at all; a text-only interface would have forced OCR to keep its own vendor client.
- **OCR runs at temperature 0.0** because transcription is deterministic. Evaluation and Blueprint use 0.2 for analytical consistency without rigidity.
- **Only Evaluation sets `max_tokens`.** It was a *dead parameter* before B1 Stage 2 — constructed but never passed. Its first real-traffic exercise is still pending (`docs/34` check 5).
- **Only Evaluation has a timeout.** A stuck grading call blocks a student's result; `docs/27` §6 sets 20s. Timeout lives *above* the adapter, which is why `AdapterError` has no timeout category.
- **Failure modes differ because the callers differ.** Evaluation degrades to the human queue (a skipped evaluation is safe). OCR is a synchronous internal endpoint, so 503 is the honest answer. Blueprint surfaces through the router's existing 500 mapping.
- **Only Evaluation carries prompt lineage.** A mark must be reconstructible: which model, which prompt, which exact rendered input. `inputArtifactHash` is the sha256 of the rendered prompt. OCR records the model but not a prompt; Blueprint records neither (§4).

## 3. Per-feature call graphs

**Evaluation** — the only path with concurrency control and lineage:
```
evaluate_response → tenant + governance checks
  → OCR confidence gate (<0.5 skip · 0.5–0.85 flag, docs/24 §5)
  → registry: AIModelVersion + PromptVersion(v2)
  → _build_prompt(PROMPT_TEMPLATE, …) → sha256 → inputArtifactHash
  → GenerateRequest(1 TextPart, 0.2, max_tokens=800)
  → asyncio.wait_for(adapter.generate, 20s) ─ timeout → Skipped(ai_evaluation_timeout)
  → parse → AIRecommendation + EvaluationVersion(source=AI)
  → compare-and-swap on currentEvaluationVersionId
```

**OCR** — registry resolved **once**, before the block write:
```
POST /ocr/extract → tenant check via 6-hop region traversal
  → registry: AIModelVersion (once) ─ none → 503, no provider call, no orphan block
  → OCRBlock find/create
  → GenerateRequest([TextPart, ImagePart], 0.0)
  → parse → OCRResult(aiModelVersionId = the row that ran)
```

**Blueprint** — writes nothing:
```
POST /ai/generate-blueprint → require_role(TEACHER|ADMIN|FOUNDER)
  → registry: AIModelVersion ─ none → ValueError → 500
  → PROMPT_TEMPLATE.format(user_prompt, format_instructions)   ← ONE pass
  → GenerateRequest(1 TextPart, 0.2)
  → parse → BlueprintGenerationResult returned as JSON
```

The single `.format()` pass is load-bearing, not stylistic: `get_format_instructions()` embeds a JSON schema containing literal braces, so a two-pass render raises `KeyError`. Verified empirically during the LCEL→adapter conversion, which produced **byte-identical** prompts on all four representative inputs.

## 4. Governance boundary

`docs/32` §3 confines Blueprint to selecting/suggesting distribution — never authoring content, altering marks, or making an evaluation decision.

Blueprint's human review is **structural, not policy**: `generate_blueprint_from_prompt()` persists nothing. Its result pre-fills form fields (`CreateBlueprintModal.tsx`); the teacher edits them; a separate endpoint creates the `Blueprint` row from human-submitted data. There is no code path by which AI output reaches storage unedited. This is what makes Blueprint's missing lineage acceptable (§5).

Evaluation's gate is enforced server-side: an AI-sourced `EvaluationVersion` is never authoritative, `ScoreRecord` never reflects it, and students never see an unfinalized record.

## 5. Deferred — decisions and improvements, not bugs

None of these is a defect. Each is a deliberate stopping point with a stated trigger for revisiting.

| Item | Why deferred | Revisit when |
|---|---|---|
| **Blueprint AI lineage schema** | AI output is never persisted; human editing is structural. Governance-critical property is *execution control*, which is implemented and verified. Real cost is a cross-service contract change, and a client-supplied field would be self-asserted and unverifiable. Full note: [docs/35](35-BLUEPRINT-AI-LINEAGE-DECISION-NOTE.md) | An institution asks which blueprints were AI-assisted; a model regression is obstructed by the gap; **or Blueprint's scope changes so AI output can reach a student unedited** — this one flips the answer immediately |
| **`PromptVersion` ordering hardening** | `resolve_evaluation_prompt_version_id` has the same nondeterminism class as the model-version lookup (no unique constraint on `PromptVersion`). Impact is narrower: duplicate rows would carry *identical* `promptTemplate` content from the same constant, so only the stamped lineage id could differ — never the prompt actually used | Prompt templates become editable per-tenant, or duplicates are ever observed |
| **Provider-selection factory** | One provider does not justify an abstraction whose only purpose is symmetry. `ModelProviderAdapter` already defines the seam a second provider would slot into | A genuine second provider is adopted |
| **Shared connection/pooling optimization** | Each call constructs its own client. Not measured as a bottleneck; optimizing unmeasured cost risks introducing shared mutable state across async requests for no demonstrated gain | Provider latency or connection churn shows up in production metrics |

## 6. Verification state

| Layer | Status |
|---|---|
| Python suite | 166/166 |
| Node suite | 515/515 |
| Ruff · Nest build · web `tsc` | clean |
| AST vendor-import guard | enforced in CI; proven non-vacuous |
| Real Postgres | scoring/governance/tenant flows, registry behavior (all three), OCR, Blueprint, evaluation persistence + concurrency, prompt lineage |
| **Real provider** | **NOT VERIFIED — blocked, see [docs/34](34-STAGING-PROVIDER-SMOKE-TEST.md) §6** |

The single outstanding gap is real-provider traffic. Highest-value unknown within it: whether `openai.AuthenticationError` / `RateLimitError` / `BadRequestError` are still the classes actually raised. The adapter's mapping is asserted against the SDK's *declared* classes, never observed traffic — an upstream rename would fall through to `AdapterProviderError` with no test failing.
