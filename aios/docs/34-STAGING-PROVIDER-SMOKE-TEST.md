# 34 — Staging Real-Provider Smoke Test (P1 B1 adapter layer)

**Status: PROCEDURE READY — NOT EXECUTED. Blocked on infrastructure (§6).**

## 1. Why this exists

P1 B1 routed all three production AI call sites through one adapter:

```
Evaluation + OCR + Blueprint → GenerateRequest → ModelProviderAdapter → OpenAIAdapter → provider
```

Every completed B1 verification — 166 Python tests, 515 Node tests, four real-Postgres gates — **stubbed the vendor call**. That is the right boundary for automated testing, but it leaves one class of claim unproven: that the adapter's request shaping and vendor-exception mapping match what the provider *actually* does, rather than what we believe it does. Only a real call settles that.

## 2. Preconditions

Everything below lives in **one file**, `infra/staging/staging.env`, and every
staging entrypoint reads it and nothing else. There is deliberately no second way
to configure a staging process.

| Requirement | Needed by |
|---|---|
| `AIOS_ENV=staging` | Smoke-test refusal guard #1, and it arms the boot guard in every service |
| `DATABASE_URL` **and** `DIRECT_URL`, both staging | Boot guard, migrations — see §7 for why both |
| `REDIS_URL` — the staging broker on `:6380` | Boot guard; API and worker queues |
| `STAGING_DB_ALLOWLIST` naming the target `host:port` | Refusal guard #2, boot guard, migration wrapper |
| `STAGING_REDIS_ALLOWLIST` naming the broker `host:port` | Boot guard |
| `OPENAI_API_KEY` — a **staging** key | All checks |
| Disposable Postgres + Redis (`infra/staging/docker-compose.yml`) | Checks 4, 8, 9; queues |
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

That is the whole procedure, and it is the only one. The runner starts the
disposable Postgres and Redis, **proves the targets are live and correct**,
applies migrations **through the guarded wrapper**, generates both Prisma
clients, invokes the smoke test **unmodified**, and verifies isolation
afterwards.

Do not assemble the steps by hand. The previous arrangement — remember to export
the right variables on every command — is exactly what let a "staging" run come
up attached to the shared database while looking completely normal. If you need
a single step on its own:

```bash
./infra/staging/run-stack.sh prove     # target proof only, starts nothing
```
```bash
node infra/staging/migrate-staging.js  # migrations, guarded
```
```bash
node infra/staging/verify-isolation.js # post-run proof, needs the stack running
```

To run the API, worker or Python service against staging, use the launcher —
never a hand-assembled command line:

```bash
./infra/staging/run-stack.sh api       # also: worker | python
```

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

**Not executed.** Re-checked 2026-09-06.

### Prepared and verified live

- `infra/staging/docker-compose.yml` — disposable Postgres on `127.0.0.1:5433` and Redis on `127.0.0.1:6380`, both RAM-backed so data cannot outlive the container
- `infra/staging/staging.env.example` — the single source of staging configuration; the filled-in `staging.env` is gitignored
- `infra/staging/run-stack.sh` — the only supported way to start a staging API, worker or Python service
- `infra/staging/run-smoke.sh` — the only supported way to run the smoke procedure end to end
- `infra/staging/migrate-staging.js` — the only supported way to migrate staging (§7)
- `infra/staging/prove-targets.js` / `verify-isolation.js` — layers 1 and 3 of the isolation proof (§7)
- Boot-time target guard in `apps/api/src/config/env.schema.ts` and `apps/api-python/src/config.py`
- Prisma migrations committed (they were untracked, so no fresh environment could build the schema at all)
- Guard #2 rewritten from a substring blocklist to an explicit allowlist

### Still blocking

| Blocker | Needs |
|---|---|
| **No provider credential** | A staging-scoped, spend-capped key |
| **No OCR test image** | A publicly reachable URL hosting synthetic printed text |

Both need the operator's own accounts. Nothing was simulated.

### To unblock

1. `docker compose -f infra/staging/docker-compose.yml up -d`
2. `cp infra/staging/staging.env.example infra/staging/staging.env`
3. Fill in `OPENAI_API_KEY` (staging-scoped, spend-capped) and `SMOKE_OCR_IMAGE_URL`
4. `./infra/staging/run-smoke.sh` — it performs the target proof, the guarded migration, the run and the isolation check
5. Record each result as **Verified live / Verified by tests only / Unable to verify** in §8

## 7. Database and Redis targeting — read before migrating

**Staging Postgres: `localhost:5433`, database `aios_staging`.
Staging Redis: `localhost:6380`.** Both from
`infra/staging/docker-compose.yml`; loopback-only and RAM-backed.
**Required env file: `infra/staging/staging.env`** (gitignored; copy from the
`.example`).

### The trap

This command looks right and is WRONG. **Do not run it.**

```
DATABASE_URL=postgresql://...localhost:5433/aios_staging  prisma migrate deploy
```

It migrates the **shared** database. `schema.prisma` declares both
`url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`, and Prisma
**migrations use `directUrl`** — which `packages/db/.env` points at the shared
Supabase instance. Setting only `DATABASE_URL` leaves migrations aimed there,
and nothing in the output makes that obvious.

This is NOT an override problem. Verified precedence, all three runtimes:

| Component | Loads | Which wins |
|---|---|---|
| Nest API / worker | `apps/api/.env` via `ConfigModule.forRoot` (no `envFilePath`) | **process env** |
| Python service | `apps/api-python/.env`, now anchored to an absolute path | **process env** |
| Prisma CLI | `packages/db/.env` | **process env** — but `migrate` reads `DIRECT_URL`, not `DATABASE_URL` |

Process env wins everywhere. The trap is the *second variable*, which is why it
is silent. `prisma 5.17` has no `--env-file` flag.

Redis had the same shape of problem for a different reason: `REDIS_URL` is
optional and falls back to `redis://localhost:6379` behind a log warning, so a
staging process that never received it attached to the developer's **dev** broker
and looked fine.

### The three layers

Configuration is checked three times, by three mechanisms that fail for
different reasons. None of them reads an env file to decide whether it is safe.

| Layer | What it proves | When |
|---|---|---|
| 1. `prove-targets.js` | the nominated targets pass the guards, are live, and are the database and broker they claim to be | before anything starts |
| 2. **boot guard** — `env.schema.ts`, `config.py` | the **resolved** config of each running process is a nominated target | at every process start |
| 3. `verify-isolation.js` | identifiable marker data landed in staging and never reached the shared database | after the run |

Layer 2 is the one that matters most: layers 1 and 3 check intent and outcome,
but only the boot guard checks what the process actually ended up with. It is
armed by `AIOS_ENV=staging` and is completely inert for ordinary development and
production boots.

### The safe migration command

```bash
node infra/staging/migrate-staging.js
```

It reads `infra/staging/staging.env`, requires **both** `DATABASE_URL` and
`DIRECT_URL`, then — before applying anything — asks Prisma which datasource it
**actually resolved**, parses the reported host, and refuses unless it is
nominated in `STAGING_DB_ALLOWLIST` and does not look like a hosted instance. It
verifies the outcome rather than trusting the intent.

It prints, and requires, a line such as:

```
Datasource "db": PostgreSQL database "aios_staging", schema "public" at "localhost:5433"
  confirmed: localhost:5433 — proceeding.
```

If that line names a Supabase/pooler host, it aborts instead of migrating.

### Starting the services

```bash
./infra/staging/run-stack.sh api       # also: worker | python | prove
```

The launcher sources `staging.env` and starts one process. Anything not in that
file — Google OAuth client, S3, Sentry — still comes from the app's own `.env`,
which is left untouched; `staging.env` supplies the targets and the staging
secrets and overrides those files because process env wins. The boot guard is
what proves the override actually happened, so a launch that silently failed to
take effect stops rather than serving.

### Proving it, rather than reading it

```bash
node infra/staging/verify-isolation.js
```

Creates a uniquely-named institute, reads it back **through the running API**,
writes through the API, confirms the API's cache key exists on the staging broker
and not on the dev one, has the Python service resolve a staging-only id, has the
worker consume a staging-only job, and asserts the shared database's row counts
are unchanged and contain no marker rows. It refuses to run if the staging and
shared URLs resolve to the same host, and it never writes to the shared database.

### What is deliberately NOT changed

`apps/api/.env`, `apps/api-python/.env` and `packages/db/.env` still point at the
shared database. They are per-machine, gitignored developer files: editing them
would fix one clone while the next still had the footgun, and would repoint the
configuration developers actually work against. The protection belongs in the
launcher and the boot guard, which every clone inherits.

## 8. Results log

*(empty — no run has occurred)*

| Date | Check | Classification | Notes |
|---|---|---|---|
| — | 1–9, S | Unable to verify | No provider credential or OCR image (§6) |
