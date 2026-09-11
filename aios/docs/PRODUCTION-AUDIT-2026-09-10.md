# PRODUCTION AUDIT — 2026-09-10

Independent verification pass over the working tree on `chore/staging-db-migrations`.
Companion to `PRODUCTION-READINESS-AUDIT.md` (2026-09-03), which remains accurate on
scope and commercial gaps. This document does not repeat it; it records what a fresh,
**execution-based** pass found and fixed.

**Method.** Nothing here is inferred from reading alone. Every defect below was
reproduced — by running the code, building the image, or measuring the behaviour —
before it was fixed, and re-verified afterwards. Where something is *not* verified,
it says so.

---

## 0. Baseline (executed, this session)

| Suite | Command | Before | After |
| :--- | :--- | :--- | :--- |
| `apps/api` | `pnpm --filter @aios/api test` | 660 passed / 45 suites | **665 passed / 46 suites** |
| `apps/api-python` | `python -m pytest tests/ -q` | 224 passed | **233 passed** |
| `apps/web` | `pnpm --filter @aios/web test` | 5 passed | 5 passed |
| typecheck | `tsc --noEmit` (api, web) | clean | clean |
| lint | `pnpm --filter @aios/api lint` | 0 errors / 108 warnings | **0 errors / 108 warnings** |

All 14 new tests are regression tests for defects reproduced below. No test was
weakened; two were rewritten because the contract they pinned deliberately changed
(both noted in §2).

**Confirmation of the prior audit's strong findings.** Independently re-checked and
still true: `JwtAuthGuard` + `RolesGuard` + `MaintenanceGuard` + `UserThrottlerGuard`
are all registered as `APP_GUARD` (`auth.module.ts:43-46`); no unsafe raw SQL exists
(the only two `$queryRaw` uses are parameterless `SELECT 1` health probes); tenant
scoping on the cross-tenant read paths is real (`users.findAllGlobal` and
`audit.findAllGlobal` accept a client `instituteId` but are reachable only through
`FounderController`, which is class-level `@Roles(FOUNDER)`).

---

## 1. What was actually broken

Ordered by blast radius. Severity reflects consequence in production, not effort.

### P0-1 — The frontend called the AI engine at the user's own computer

`apps/web/src/lib/api-client.ts:108` — `aiClient` was `baseURL: 'http://localhost:8000'`,
with a comment explaining the choice. In any deployed environment the browser resolves
that to *the machine the browser is running on*, not the server.

Five shipped features were therefore broken for every user who was not a developer
running the engine locally:

| Feature | Call site |
| :--- | :--- |
| Teacher Today — batch heatmap | `TeacherToday.tsx:47` |
| AI blueprint generation (Paper Builder) | `useApi.ts:895` |
| Batch mastery heatmap | `useApi.ts:1098` |
| Bulk batches heatmap | `useApi.ts:1112` |
| Evaluation-quality dashboard | `useApi.ts:1125` |

**Fixed** by routing the engine same-origin through the web server, as `apiClient`
already does for the NestJS API. See §2 for why this became a route handler rather
than the obvious rewrite.

### P0-2 — No deployment image built. None of the three.

`infra/docker/` is the repo's only deployment artifact, and `docker build` failed on
every Dockerfile. Four independent blockers, stacked — each one only discoverable
after fixing the one before it, which is consistent with the images never having been
built at all:

1. **`corepack prepare pnpm@9`** in all three Dockerfiles. `pnpm-workspace.yaml` holds
   23 security `overrides`, and only pnpm >= 10 reads overrides from that file; pnpm 9
   reads them from `package.json`, finds none, compares against the 23 recorded in
   `pnpm-lock.yaml` and aborts — `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. The overrides
   were added by commit `f30bcbd` ("close 37 of 65 pnpm audit findings via scoped
   overrides"); the images have been unbuildable since.
2. **No `.dockerignore` anywhere in the repo** (see P0-3 — this is also a security
   finding). The host's `node_modules` was copied over the Linux dependencies
   installed in the `deps` stage, so `prisma generate` failed with
   `Cannot find module /repo/packages/db/node_modules/prisma/build/index.js`.
3. **Unfiltered `prisma generate`.** `schema.prisma` declares two generators —
   `client` (JS) and `client_py` (prisma-client-py). Running both in a Node image
   fails: `Generator "prisma-client-py" failed: prisma-client-py: not found`.
4. **`packages/config` was never copied.** Every app's `tsconfig.json` does
   `"extends": "../../packages/config/tsconfig.base.json"`. Missing, tsc does not
   error — it silently falls back to its *default* options (target ES3) and the build
   dies with a wall of `TS2802`/`TS18028` errors in code that compiles fine locally.

Also fixed while in there: Alpine ships no OpenSSL, so Prisma logged *"failed to detect
the libssl/openssl version… defaulting to openssl-1.1.x"* and would have selected a
query engine this Alpine (OpenSSL 3.x) cannot load — a failure that surfaces at
**runtime, on the first query**, not at build.

A related pin was added: the repo had no `packageManager` field, so CI's pnpm version
(via `pnpm/action-setup@v4`) was implicit and unrelated to the images'. Pinned to
`pnpm@10.34.5` — pnpm 11 requires Node >= 22.13 and every image is `node:20-alpine`,
which fails mid-install with `ERR_UNKNOWN_BUILTIN_MODULE` (also verified by building).
Bumping the runtime to Node 22 is a separate decision needing its own testing.

**Verified after fixing:** all three images build; `aios-api` 701 MB, `aios-web`
1.34 GB, `aios-python` 1.72 GB.

### P0-3 — Secrets would have been baked into every image layer

Because no `.dockerignore` existed, `COPY apps/api apps/api` copied `apps/api/.env`
into the image. Three real secret files are present on disk:

```
apps/api/.env              DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, INTERNAL_SERVICE_TOKEN
apps/api-python/.env       same class
infra/staging/staging.env  provider keys
```

All three are correctly `.gitignore`d and — as the prior audit verified — have never
been committed. **`.gitignore` has no bearing on a Docker build context.** The
git-hygiene discipline was complete and the image-hygiene discipline did not exist,
so the secrets would have shipped to anyone able to pull an image.

**Verified after fixing:** `find / -name ".env"` inside both `aios-api` and
`aios-python` returns nothing; grepping the image filesystem for `JWT_SECRET=` and
`OPENAI_API_KEY=sk-` returns nothing.

### P1-4 — SIGTERM was ignored; every deploy hard-killed the API

`worker.ts:44-60` has had `enableShutdownHooks()` and SIGTERM/SIGINT handlers since it
was written. `main.ts` had neither. The Dockerfile's `CMD ["node", "dist/main.js"]` is
exec form, so **node is PID 1 — and PID 1 has no default signal dispositions, so an
unhandled SIGTERM is ignored outright.**

Measured, in Docker, with and without a handler:

| | `docker stop` duration | exit code |
| :--- | :--- | :--- |
| No SIGTERM handler (`main.ts` as it was) | **11 s** | **137** (SIGKILL) |
| With handler (after the fix) | **1 s** | **0** |

So every rolling deploy, container restart and scale-down was hanging for the full
termination grace period and then hard-killing the process. In-flight HTTP requests
died mid-response (clients see a connection reset, not a retryable status);
`PrismaService.onModuleDestroy()` — which calls `$disconnect()` — is invoked *only* by
Nest's shutdown hooks and therefore **never ran in the API process**, leaving Postgres
to time out abandoned sessions; and any request inside `$transaction()` died with no
rollback issued.

### P1-5 — Paper generation was not random

`papers.service.ts:103` used `candidates.sort(() => 0.5 - Math.random())`. This is not
a shuffle: `Array.prototype.sort` requires a *consistent* comparator, and a random one
leaves the result determined by V8's TimSort rather than by chance.

Measured on this call site's real shape — bank of 60, draw 10, 20 000 generated papers:

```
first 10 positions:  187% 135% 122% 149% 101% 111% 119% 134%  84%  98%
last 10 positions:    90%  96%  91%  95%  94%  97%  91%  91%  95%  95%
min 83.2%   max 186.8%     (100% = uniform)
```

The first question in the bank was selected **1.87x as often as it should be**, and
the tail consistently under-selected — a 2.2x spread. In product terms: two papers
generated from one blueprint overlapped far more than a teacher would expect, and
newly added questions were systematically under-used.

**Fixed** with a partial Fisher–Yates draw over `crypto.randomInt`
(`shared/random-sample.ts`). `crypto` rather than `Math.random` for two reasons: it is
uniform over the requested range (scaling `Math.random` reintroduces modulo bias), and
paper composition is assessment content whose selection a student should not be able
to anticipate from observed output.

### P1-6 — Malformed AI output crashed the evaluation route and billed three times for it

`ai_evaluator.py:204` called `parser.parse(generated.text)` unguarded. Reproduced:
`PydanticOutputParser` raises `OutputParserException` on prose, empty completions, or
schema-violating values.

Every *other* failure mode in that function — timeout, illegible OCR, no active model,
lost concurrency claim — returns `Skipped(reason=…)` and routes to the human queue.
This one propagated: out of `evaluate_response`, out of `/evaluation/ai-evaluate` as a
500, into the BullMQ caller's `attempts: 3` (`ai-evaluation.service.ts:37`) — which
re-sent the **identical** prompt at temperature 0.2 twice more, paid for all three
calls, failed identically each time, then dead-lettered the job leaving the `Response`
stuck `PENDING` with no recorded reason. The batch path masked it entirely, because
`run_one()` catches everything; only the single-response route was exposed.

**Fixed** to match the module's existing convention: `Skipped(reason="ai_output_unparseable")`.

### P1-7 — Truncated AI completions were silently accepted as finished grades

Found while writing the test for P1-6, and materially worse than it.

langchain's `PydanticOutputParser` **repairs** cut-off JSON rather than rejecting it.
Verified directly:

```
parse('{"suggestedMarks": 3, "confidence": 0.9, "not')
  -> suggestedMarks=3.0 confidence=0.9 note=None
```

A completion killed at `max_tokens=800` therefore parsed into a perfectly well-formed
`AIEvaluationResult` whose optional fields — `note` (the justification) and
`suggestedCriterionScores` (the per-criterion breakdown) — were simply absent. A
teacher saw a confident mark with no reasoning, indistinguishable from a model that
genuinely had nothing to add. Nothing in the pipeline could tell the two apart,
because `GenerateResult` carried only `text`.

**Fixed** by normalizing a `truncated` flag onto the adapter contract
(`providers/types.py`), populating it in both adapters (OpenAI `finish_reason ==
"length"`, Gemini `MAX_TOKENS`, both read defensively), and discarding a truncated
evaluation to the human queue. The AI-governance gate means AI is never terminal for a
`GRADED` assessment, so this degraded suggestion quality rather than corrupting
scores — but silently, which is the part that mattered.

### P1-8 — Provider error text returned to callers

`routers/ai.py:33` returned `detail=str(e)` for **any** exception, and
`routers/ocr.py:100` returned `f"OCR extraction failed: {e}"`.

What that string actually contains: an `openai.AuthenticationError` message names the
model, the organisation id, a request id and a partially-redacted API key; a provider
error raised against a signed S3 URL can echo the URL *with its signature*; and a bare
`ValueError` there was literally `"OPENAI_API_KEY is not configured in the environment."`
The blueprint route is reachable by any authenticated TEACHER.

**Fixed**: adapter errors are categorised (429 for rate limit, 502 otherwise), the real
exception goes to the log with its traceback, and the response body carries no provider
text. The one message deliberately still shown is the deconfigured-registry one — we
author it, it names no internals, and it tells an administrator what to do; it now has
its own type (`NoActiveBlueprintModelError`) and a 503, matching the OCR router's
existing precedent for the identical case.

### P1-9 — Python engine's CORS allowlist was a hardcoded localhost literal

`main.py:52-58` — `allow_origins=["http://localhost:3000"]` compiled into source.
**Fixed**: `CORS_ALLOWED_ORIGINS` in `config.py`, with a `model_validator` that refuses
to boot if it contains `*` under `NODE_ENV=production` (wildcard origin plus
`allow_credentials=True` is not a valid configuration). Follows the file's existing
fail-closed pattern. Largely defence-in-depth now, since the browser reaches the engine
same-origin through the web app after P0-1.

---

## 2. Two things that changed my mind mid-fix

Recorded because both were cases where the obvious fix was wrong and testing caught it.

**Next.js rewrites are build-time configuration wearing runtime clothes.** P0-1's first
fix was a `next.config.js` rewrite reading `process.env.PYTHON_API_URL`. It passed a
host test — falsely. Next evaluates `rewrites()` during `next build` and freezes the
resolved string into `.next/routes-manifest.json`; the host test only passed because
the baked default `http://localhost:8000` happened to match the stub's address. Read
out of the built image, the manifest contained a literal `http://localhost:8000/:path*`,
and a container with `PYTHON_API_URL` set correctly still logged
`Failed to proxy http://localhost:8000/... ECONNREFUSED`.

Replaced with a route handler (`app/api/py/[...path]/route.ts`) that reads
`process.env` per request, so one image can be promoted across environments.
Re-verified against an engine reachable *only* as `py-stub:8000` — an address that
cannot come from the baked default:

```
GET  /api/py/analytics/batch/b1/heatmap  -> {"proxied":true,"path":"/analytics/batch/b1/heatmap","auth":"Bearer tok-abc"}
POST /api/py/ai/generate-blueprint       -> body + Authorization forwarded
GET  ...?batchIds=b1,b2                  -> query preserved
engine unreachable                       -> HTTP 502, generic body, real reason in server log only
```

**The pre-existing `/api/v1` rewrite has the identical constraint** — whatever
`NEXT_PUBLIC_API_URL` is set to at build time is what the image will always use.
`web.Dockerfile` therefore declares it as a build `ARG` with the constraint spelled
out. Converting it to a route handler too would make one image fully promotable, but
it is the primary data path and deserves its own change and review; it is listed in §4
rather than done here.

**A test I wrote failed for the right reason.** The P1-6 regression test included a
truncated-JSON case, expecting a parse error. It passed the parser instead — which is
how P1-7 was found. The case was moved into its own test that asserts the repair
happens (as the premise) and that `truncated` is what catches it.

---

## 3. Files changed

New:
```
.dockerignore
infra/docker/web.Dockerfile
apps/web/src/app/api/py/[...path]/route.ts
apps/api/src/shared/random-sample.ts
apps/api/src/shared/random-sample.spec.ts
```
Modified:
```
package.json                                       packageManager pin + engines.pnpm >=10
infra/docker/api.Dockerfile                        corepack, openssl, --generator client, packages/config
infra/docker/python.Dockerfile                     corepack
apps/api/src/main.ts                               graceful shutdown
apps/api/src/papers/papers.service.ts              uniform sampling
apps/web/next.config.js                            /api/py note; rewrite removed
apps/web/src/lib/api-client.ts                     aiClient -> /api/py
apps/web/.env.example                              PYTHON_API_URL
apps/api-python/src/config.py                      CORS_ALLOWED_ORIGINS + prod guard
apps/api-python/src/main.py                        CORS from config
apps/api-python/src/evaluation/ai_evaluator.py     parse guard + truncation guard
apps/api-python/src/providers/types.py             truncated flag
apps/api-python/src/providers/openai_adapter.py    truncation detection
apps/api-python/src/providers/gemini_adapter.py    truncation detection
apps/api-python/src/routers/ai.py                  error mapping
apps/api-python/src/routers/ocr.py                 error mapping
apps/api-python/src/ai/blueprint_agent.py          typed error
apps/api-python/src/ai/blueprint_model_registry.py NoActiveBlueprintModelError
```
Tests: +5 API (`random-sample.spec.ts`), +9 Python (`test_ai_evaluator.py`,
`test_ai_router.py`, `test_ocr_router.py`); 2 rewritten for deliberately changed
contracts (`test_ai_router.py`, `test_blueprint_agent.py`).

---

## 4a. Status update — 2026-09-12

Follow-up work on branch `chore/staging-db-migrations`. Each row says how it was
verified; "unverified" means exactly that.

| Item from §4 below | Status | Evidence |
| :--- | :--- | :--- |
| Refresh-token rotation | **Done** | docs/38; 25 unit + 7 integration tests against real Postgres (10-way concurrent rotation). Found and fixed a `P2028` pool-exhaustion bug only visible against a real DB. |
| `GET /users/:id` role scoping | **Done** | Callers surveyed first (zero legitimate ones). Role matrix tests in `users.service.spec.ts`. |
| `/api/v1` build-time rewrite | **Done** | One build run twice with different `API_URL` reached two different backends. Found and fixed an `Expect: 100-continue` upload failure and a `..` path-traversal escape in the proxy. |
| Health live/ready split, timer leak | **Done** | `/health/live`, `/health/ready` (503 while draining). 12 tests. |
| Load tests | **Partly done** | load-tests/RESULTS-2026-09-11.md. Read path measured (saturates at 5–10 VUs on a starved laptop, 0% errors). The five domain scripts remain unrun — they need seeded exam/delivery state. |
| Production alerting | **Done, partial scope** | docs/39. Queue backlog, dead-letter, refresh-token reuse. **No latency or error-rate alerting** — needs a metrics pipeline. |
| Frontend test coverage | **Improved, still thin** | 5 → 34 tests. Covers the proxy and session refresh; no component tests. |
| Image sizes | **Changed, UNVERIFIED** | Standalone output in `web.Dockerfile` (commit `f54699d`). **Never built** — Docker could not start at 0.4 GB free RAM. Build it before merging. Python image untouched. |
| E2E tests | **Not started** | Needs the full stack incl. Postgres; Docker was unavailable. A mock-mode browser test would pass while proving nothing, so none was written. |
| Billing / revenue path | **Not started** | Product decision, not a hardening task. |

New findings from this work, not yet acted on:

- **Prisma connection pool is never sized.** Defaults to `cpus × 2 + 1` per
  process; five replicas at 17 each approach Postgres's default
  `max_connections=100`. Needs `?connection_limit=` set against the real topology.
- **Deployment coupling:** `JWT_EXPIRES_IN` now defaults to `15m`. Deploy API and
  web together, or set `JWT_EXPIRES_IN=7d` until the web app ships (docs/38 §6).

## 4. Not fixed — open, with evidence

**Unchanged from the 2026-09-03 audit, re-verified as still open today:**

| Gap | Evidence (run today) |
| :--- | :--- |
| Billing / revenue path | `grep -cE "^model (Payment\|Invoice\|Subscription\|Transaction)"` = **0**; no razorpay/stripe dependency anywhere |
| E2E tests | no `playwright.config*` / `cypress.config*` in the repo |
| Backup & restore | nothing under `infra/`; no script, no drill, no documented RPO/RTO |
| Load tests | 5 k6 scripts in `load-tests/`, still never executed |
| Refresh-token rotation | still absent |
| Frontend test coverage | 5 tests, 1 file, against 665 backend tests |

**New, found this session, deliberately not fixed:**

- **`GET /users/:id` has no `@Roles()`.** `RolesGuard` allows any authenticated user
  when no roles are declared (`roles.guard.ts:28`), and `UsersService.findById` checks
  only `instituteId`. So a STUDENT or PARENT can read any user record in their own
  institute — id, email, name, role, status, `lastLoginAt`. Tenant isolation holds;
  intra-tenant role scoping does not. Not trivially exploitable (ids are not
  sequential), and tightening it could break screens that legitimately resolve a user
  by id, so it needs a survey of callers rather than a blind decorator. **MEDIUM.**
- **`/api/v1` rewrite is build-time-baked** — see §2. **MEDIUM.**
- **Image sizes**: web 1.34 GB, python 1.72 GB. Next `output: 'standalone'` and a
  slimmer Python runtime stage would cut both substantially. **LOW.**
- **`health.controller.ts:70`'s `raceTimeout` leaks a timer** — the `setTimeout` is
  never cleared when the promise wins, so each health check leaves two pending timers
  for up to 2 s. Self-limiting, not a leak that grows. **LOW.**
- **Still one `/health`**, not split into `/health/live` and `/health/ready`. Carried
  over from the prior audit. **LOW.**

**Explicitly not verified by me:** the restore drill, load-test figures, and any
production alerting. I did not run them, and nothing here should be read as evidence
about them.

---

## 5. Where this leaves things

The prior audit's headline was that the engineering foundation is genuinely
production-grade while the commercial and operational layers are not. That still reads
correctly — the guard registration, tenant scoping, AI-governance gate, queue
reliability and fail-closed config validation all held up under independent checking,
and the AI evaluation module in particular is carefully built.

What this pass adds is narrower and more uncomfortable: **the operational layer had
never been executed.** The deployment artifacts did not build, the images would have
shipped secrets, and the API ignored the signal every orchestrator uses to stop it.
None of that is visible from reading the code — all three look correct on the page, and
the failures only appear when you run `docker build` and `docker stop`. That is the
pattern worth carrying forward: the remaining P0s in §4 (backup/restore especially)
are the same shape, and an untested backup is not a backup.

Deployment is now reproducible: three images build from a clean tree, contain no
secrets, refuse to start without required configuration, and shut down cleanly.

---

## 6. Working-tree warning (unchanged, now larger)

The 2026-09-03 audit flagged 247 uncommitted changes. There are now **253**, including
entire modules that exist only in the working tree. Everything in this document was
added on top of that uncommitted work and is itself uncommitted. Committing is the
single highest-value next action — none of this is recoverable if the tree is lost.
