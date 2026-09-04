# 34 — Staging Real-Provider Smoke Test (P1 B1 adapter layer)

**Status: PROCEDURE READY — NOT EXECUTED. Blocked on infrastructure (§6).**

## 1. Why this exists

P1 B1 routed all three production AI call sites through one adapter:

```
Evaluation + OCR + Blueprint → GenerateRequest → ModelProviderAdapter → OpenAIAdapter → provider
```

Every completed B1 verification — 166 Python tests, 515 Node tests, four real-Postgres gates — **stubbed the vendor call**. That is the right boundary for automated testing, but it leaves one class of claim unproven: that the adapter's request shaping and vendor-exception mapping match what the provider *actually* does, rather than what we believe it does. Only a real call settles that.

## 2. Preconditions

| Requirement | Needed by |
|---|---|
| `AIOS_ENV=staging` | Refusal guard #1 |
| `STAGING_DB_ALLOWLIST` naming the target `host:port` | Refusal guard #2 |
| `OPENAI_API_KEY` — a **staging** key, exported into the environment | All checks |
| Disposable Postgres (`infra/staging/docker-compose.yml`) | Checks 4, 8, 9 |
| `SMOKE_OCR_IMAGE_URL` — provider-reachable image of legible printed text | Check 2 |

The registry **bootstraps its own rows** on an empty database, so no seed script
is needed — the `BLUEPRINT` model and version check 4 reads are created on first
resolution.

### Data safety

- **Never production data.** Guards #1 and #2 are independent and both must pass.
- **Guard #2 is an allowlist, not a blocklist.** It was a blocklist (`prod`/`production`
  substrings) and that failed open for this project: the shared development database is a
  Supabase pooler whose hostname contains neither word, so a developer running the script
  with their normal `.env` loaded would have seeded a tenant straight into it. The allowlist
  has to be told which database is safe, and refuses everything it was not told about.
- Checks 8–9 **seed their own disposable tenant** (`STAGING-SMOKE-<runid>`), evaluate only rows they created, and tear it down in a `finally` block. No pre-existing row is read, written, or evaluated.
- `SMOKE_OCR_IMAGE_URL` must be synthetic or consented material — **never a real student's answer sheet**. Sending one to a third-party provider outside the normal evaluation flow is a privacy exposure with no offsetting benefit.
- Registry rows are deployment-wide and are deliberately left alone by teardown.

## 3. Running it

```bash
cp infra/staging/staging.env.example infra/staging/staging.env   # then fill in the key
```
```bash
./infra/staging/run-smoke.sh
```

The runner starts the disposable database, applies migrations, generates both
Prisma clients, and invokes the smoke test **unmodified**. To run it by hand
instead, export the variables from `staging.env` and call
`python scripts/staging_provider_smoke.py` directly — the runner is a
convenience, never a substitute.

`--skip-ocr` omits the vision call; `--only {evaluation,ocr,blueprint,registry,errors,governance}` runs one group. Roughly eight provider calls — cents. Run after any change to `src/providers/`, and before any release touching an AI call site.

## 4. What it verifies

| # | Check | Method |
|---|---|---|
| 1 | Evaluation → real provider | Real grading call at `temperature=0.2`, `max_tokens=800`; asserts a parseable `AIEvaluationResult` with marks in range |
| 2 | OCR multimodal → real provider | Real vision call with `[TextPart, ImagePart]`; asserts transcription returns |
| 3 | Blueprint → real provider | Real generation; asserts a valid `BlueprintGenerationResult` meeting the output contract |
| 4 | Registry-selected model actually invoked | Subclasses the real adapter to observe `request.model` **while the call still goes out**; compares to the active registry row |
| 5 | `max_tokens=800` behaves correctly | A truncated response parses as *malformed*, not as a shorter correct answer — so a clean parse is itself the evidence the budget is adequate |
| 6 | Auth / rate-limit / bad-request mapping | Invalid key → `AdapterAuthError`; unknown model → `AdapterInvalidRequestError`; rate limit → see §5 |
| 7 | 20s timeout vs. real latency | 7a records observed latency and headroom against the budget; 7b proves the mechanism fires on the real adapter path |
| 8 | B3 prompt lineage/hash through a real call | Captures the **exact prompt sent**, asserts `inputArtifactHash` is its sha256, that `promptVersionId` points at the active `v2` row, that the row's stored template still matches the constant that rendered it, and that `modelParameters` + the model FK agree with what was invoked |
| 9 | P0 human-review invariants intact | After the real AI evaluation: the version is `AI`-sourced and not human-approved, `is_authoritative_response` is `False`, `Response.marksAwarded` is unmoved, and no finalized `ScoreRecord` exists |
| S | No vendor imports outside `providers/` | Reuses the CI guard's AST checker |

**Why check 8 hashes the captured prompt rather than recomputing one:** recomputing through a parallel derivation would drift from production's the moment either changes, and would then verify only itself. Hashing what actually went over the wire cannot drift. Check 8c is the load-bearing one — production renders from the `PROMPT_TEMPLATE` constant while the FK points at a DB row seeded from it, so an in-place edit of that row would make the lineage claim a template that never ran (`docs/32` §7).

## 5. Deliberate limitations

**Rate limiting (`AdapterRateLimitError`) is not provoked — reported as CODE-VERIFIED, TRAFFIC-UNVERIFIED.** Hammering a provider to force a 429 is abusive. Confirm from production logs, or with a temporarily rate-capped staging key.

**Check 7 does not force a genuinely slow response.** 7a assesses whether 20s is well-calibrated from observed latency (and warns if headroom is under 5s); 7b proves the mechanism with a 0.001s budget. A real >20s response is not reliably reproducible without abusing the provider.

**Check 9 covers the Python half only.** `ScoreRecord` aggregation and mastery recalculation are Node-side (`ScoreAggregationService`, mastery engine) and are covered by the Node E2E harness. Check 9 proves the Python AI path does not itself produce an authoritative or finalized score — it does not re-verify Node's aggregator. Run the Node E2E harness against the same staging tenant for full P0 coverage.

## 6. Infrastructure status

**Not executed.** Re-checked 2026-09-04.

### Prepared and committed

- `infra/staging/docker-compose.yml` — disposable Postgres on `127.0.0.1:5433`, RAM-backed so data cannot outlive the container
- `infra/staging/staging.env.example` — template; the filled-in `staging.env` is gitignored
- `infra/staging/run-smoke.sh` — brings the database up, applies migrations, generates both Prisma clients, runs the smoke test **unmodified**
- Prisma migrations committed (they were untracked, so no fresh environment could build the schema at all)
- Guard #2 rewritten from a substring blocklist to an explicit allowlist

### Still blocking

| Blocker | Needs |
|---|---|
| **Docker is not installed** | Docker Desktop — admin rights, ~500 MB download, licence acceptance, likely a reboot for the WSL2 backend. No `docker`/`podman` binary on this machine; no local Postgres either |
| **No provider credential** | A staging-scoped, spend-capped key |
| **No OCR test image** | A publicly reachable URL hosting synthetic printed text |

All three need the operator's own accounts or machine privileges. Nothing was simulated.

### To unblock

1. Install Docker Desktop (or provide any Postgres reachable at a nominated `host:port`)
2. `cp infra/staging/staging.env.example infra/staging/staging.env`
3. Fill in `OPENAI_API_KEY` (staging-scoped, spend-capped) and `SMOKE_OCR_IMAGE_URL`
4. `./infra/staging/run-smoke.sh`
5. Record each result as **Verified live / Verified by tests only / Unable to verify** in §7

## 7. Results log

*(empty — no run has occurred)*

| Date | Check | Classification | Notes |
|---|---|---|---|
| — | 1–9, S | Unable to verify | No staging environment or credential (§6) |
