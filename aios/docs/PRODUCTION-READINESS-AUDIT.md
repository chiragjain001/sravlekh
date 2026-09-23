# PRODUCTION READINESS AUDIT & GAP REGISTER

STATUS: LIVING DOCUMENT — Phase 1 deliverable of the production-readiness programme.
Created: 2026-09-03. Updated as gaps close. Last update: 2026-09-20 (§5, digital answer sheet).

This document is **evidence-based**. Every "Current State" below was verified by reading source
code or executing a command in this repository — not by trusting `docs/00-33`. Where this audit
contradicts an older doc (notably `33-GAP-ANALYSIS-AND-BUILD-PLAN.md`, which predates the current
working tree), **this document is authoritative for current state**.

---

## 0. Method & baseline

**Verified baselines (executed, not assumed):**

| Suite | Command | Result |
| :--- | :--- | :--- |
| `apps/api` | `pnpm --filter @aios/api test` | **479 passed / 479**, 38 suites, 61s, exit 0 |
| `apps/api-python` | `python -m pytest -q` | **148 passed**, 25s, exit 0 |
| `apps/web` | `pnpm --filter @aios/web test` | **5 passed**, 1 file, exit 0 |

**Static scan results (whole repo, excluding `node_modules`):**

| Signal | Count | Note |
| :--- | :--- | :--- |
| Real `TODO/FIXME/HACK` | **2** | `papers.service.ts:80`, `ErrorBoundary.tsx:45` |
| `console.log` in prod source | **2** | non-spec files only |
| `ComingSoon` placeholder screens | **2** | StudentLeaderboard, StudentResources (honest, not fake) |
| Secrets committed to git history | **0** | `git log --diff-filter=A` over all `.env*` — never committed |
| Hardcoded API-key literals in source | **0** | scanned `sk-*`, `AKIA*`, PEM private keys |
| Prisma models / `@@index` / `@@unique` | 65 / 38 / 18 | 64 `onDelete` rules, 7 migrations |
| Tenant-isolation assertions in specs | **222** across 15+ spec files | genuine coverage |

**Codebase honesty assessment:** unusually high. The prior sessions consistently used explicit
`ComingSoon` components and honest failure states (`provider_not_configured`) instead of fake
success paths. **No instance of "fake API response → hardcoded success" was found.** This audit
found no evidence of the anti-pattern the master brief prohibits in §59.

**Working-tree risk (flagged, not resolved):** 247 uncommitted changes exist (214 modified,
31 untracked), including entire new modules (`attendance/`, `feature-flags/`, `support-tickets/`,
`providers/`, `intervention_engine.py`). This is substantial unversioned work. It is **not**
line-ending noise — `useApi.ts` alone is +1585 lines. Recommend committing before further work.

---

## 1. GAP REGISTER

Priority: **P0** blocks production/customer usage · **P1** required for strong commercial release ·
**P2** important competitive improvement · **P3** future enhancement

State codes: **A** production-ready · **B** implemented, needs hardening · **C** partial ·
**D** UI-only · **E** backend-only · **F** mock/demo · **G** dead/unreachable · **H** missing

### 1.1 COMMERCIAL / REVENUE — the blocking category

| Area | Feature | State | Evidence | Risk | Required Work | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Billing | Payment processing | **H** | `grep -cE "^model (Payment\|Invoice\|Subscription\|Transaction)"` on schema = **0**. No `razorpay`/`stripe` dependency anywhere. Only match repo-wide is a deleted mock UI string. | **Cannot charge a single customer.** No revenue path exists. | Razorpay: plans, order creation, server-side verification, signed webhooks, idempotency, invoice records, payment lifecycle states | **P0** | OPEN |
| Billing | Subscription lifecycle | **H** | No renewal/grace/cancellation/dunning logic anywhere | Cannot operate recurring revenue | Subscription state machine + renewal + failed-payment grace | **P0** | OPEN |
| Entitlements | Plan limit **enforcement** | ~~**C**~~ → **A** | Limits were *defined only* (`founder.service.ts:24-28`); `grep` for them outside `founder/` returned **zero hits**. The schema comment admitted it: "Write-time enforcement … is a deliberately separate, not-yet-built concern". | A TRIAL institute could create **unlimited** students, teachers and assessments. Plan tiers gated nothing — nothing to sell. | ~~Central `EntitlementService` + creation-point gates~~ | **P0** | ✅ **FIXED** (see §4 P3) |
| Entitlements | Usage tracking / metering | **H** | No usage counters; `maxAssessmentsPerMonth` has no counter to compare against | Cannot bill by usage, cannot show customer their consumption | Usage aggregation + per-institute meters (students, storage, AI credits, OCR credits) | **P0** | OPEN |
| Onboarding | Self-serve institute provisioning | **C** | `POST /institutes` exists (`institutes.controller.ts:30`) but is FOUNDER-gated; no signup → configure → first-assessment flow | Every new customer needs founder/dev intervention | Guided onboarding flow per master brief §45 | **P1** | OPEN |
| Billing UI | Customer-facing plan/usage/invoices | **H** | No billing screen in any dashboard | Customer cannot self-serve upgrade/see invoices | Billing screens once billing backend lands | **P1** | OPEN |

### 1.2 SECURITY

| Area | Feature | State | Evidence | Risk | Required Work | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Auth | `POST /auth/dev-login` fail-open | ~~**B**~~ → **A** | `auth.controller.ts:51` `@Public()` mints a real JWT by role. Was gated **only** by `NODE_ENV === 'production'` (`auth.service.ts:210`). | **Config-dependent total auth bypass.** If `NODE_ENV` was unset/misspelled at deploy (common in Docker/PaaS), anyone reaching the API could `POST {role:'FOUNDER'}` and receive a valid founder token, provided seeded mock users existed in that DB. Failed **open** on misconfiguration. | ~~Require explicit opt-in; refuse to boot in prod; regression test~~ | **P0** | ✅ **FIXED** (see §4 P2) |
| Auth | Refresh-token rotation | **H** | `grep -i "refresh.?token"` in `apps/api/src` = **0 hits** | Single long-lived access token; no rotation. Partial mitigation exists (`tokenVersion` force-logout). | Refresh token + rotation + revocation list | **P1** | OPEN |
| Auth | Token storage | **B** | `api-client.ts:34` reads `localStorage.getItem('aios_access_token')` | XSS → token exfiltration | Move to httpOnly cookie, or document accepted risk with CSP | **P1** | OPEN |
| Tenancy | Cross-institute isolation | **A** | 222 `instituteId`/`assertInstituteAccess` assertions across 15+ spec files; per-service tenant scoping; fuzzing tests present | — | None. **Verified strong.** | — | GREEN |
| AuthZ | Global guards | **A** | `JwtAuthGuard` + `RolesGuard` registered as `APP_GUARD`; regression test `auth.module.spec.ts` asserts registration + order | — | None | — | GREEN |
| Transport | Helmet / CORS / validation | **A** | `main.ts:28` helmet; CORS restricted to `FRONTEND_URL` in prod (no wildcard); `ValidationPipe` with `whitelist` + `forbidNonWhitelisted` | — | None | — | GREEN |
| Rate limit | Throttling | **A** | `ThrottlerModule` global + `@Throttle` 10/s, 100/min on login specifically | — | None | — | GREEN |
| Secrets | Exposure | **A** | No `.env` ever committed (history-verified); all `.env` files gitignored; no key literals in source | — | None | — | GREEN |
| Audit | Immutability | **A** | `manual-sql/audit_log_immutability.sql` present; insert-only discipline | SQL is written but **grant execution is environment-dependent** | Confirm applied in production DB | P1 | OPEN |

### 1.3 INFRASTRUCTURE & OPERATIONS

| Area | Feature | State | Evidence | Risk | Required Work | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Deployment | Any deployment artifact | **H** | `infra/` directory is **completely empty**. No `Dockerfile`, no `docker-compose`, no IaC anywhere in repo. | **Cannot deploy reproducibly.** No documented path from repo → running production. | Dockerfiles (web/api/python/worker), compose for local+staging, deployment runbook | **P0** | OPEN |
| Database | Backup & restore | **H** | No backup script, no restore procedure, no documentation | **Unrecoverable data loss risk.** An untested backup is not a backup. | Automated backup + *executed* restore drill + documented RPO/RTO | **P0** | OPEN |
| Observability | Sentry | **B** | Sentry wired in `main.ts`; dead-letter reporting for all 6 queues | Alerting rules/dashboards undefined | Alert thresholds, AI cost/latency metrics | **P1** | OPEN |
| Health | Liveness/readiness | **B** | `GET /health` checks DB + Redis (Redis fail-open) | No separate liveness vs readiness for orchestrators | Split `/health/live` and `/health/ready` | **P1** | OPEN |
| Queues | BullMQ reliability | **A** | 6 queues, retries + exponential backoff, dead-letter → Sentry (`dead-letter.spec.ts`) | — | Verify graceful shutdown + concurrency caps | P2 | GREEN* |
| Storage | S3 | **A** | Tenant-scoped `buildKey(instituteId,…)`, signed URLs, access gating, cross-tenant tests | — | Retention/deletion policy | P2 | GREEN* |
| Perf | Load testing | **C** | 5 k6 scripts exist in `load-tests/`; **never executed** — no results anywhere | Unknown breaking point; no capacity plan | Execute against staging, record p50/p95/p99 | **P1** | OPEN |
| Perf | Question sampling at scale | **B** | `papers.service.ts:80` TODO — in-memory random sampling | Degrades with large question banks | Raw SQL `TABLESAMPLE`/ordered random | P2 | OPEN |

### 1.4 TESTING

| Area | Feature | State | Evidence | Risk | Required Work | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| E2E | Any E2E framework | **H** | No Playwright/Cypress config, no `e2e/` dir anywhere | No proof any full user journey works end-to-end | Playwright + the 5 journeys in master brief §36 | **P0** | OPEN |
| Frontend | Unit/component coverage | **C** | **5 tests in 1 file** vs 479 backend tests | UI regressions ship undetected | Component tests for critical screens | **P1** | OPEN |
| Backend | Unit coverage | **A** | 479 tests, 38 suites, incl. concurrency/TOCTOU and governance-race tests | — | Maintain | — | GREEN |
| CI | Pipeline | **B** | `.github/workflows/ci.yml`: lint→typecheck→test→build ×3 apps + blocking dependency scan | No migration validation, no E2E gate, no deploy gate | Add migration check + E2E stage | **P1** | OPEN |

### 1.5 PRODUCT FEATURES

| Area | Feature | State | Evidence | Risk | Required Work | Priority | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Automation | Intervention engine | **B** | `intervention_engine.py` (untracked) — real: threshold-driven, configurable, idempotent via atomic DB claim on `MasteryScore.interventionTriggeredAt`, creates Assignment + teacher Notice | Untracked/uncommitted; needs end-to-end verification | Commit, verify loop live, add E2E | **P1** | OPEN |
| Notifications | Email / SMS / WhatsApp | **C** | `notice-dispatch.processor.ts:32` marks all EMAIL/SMS/WHATSAPP deliveries `FAILED: provider_not_configured` — **honest stub, not fake success**. IN_APP is real (marked SENT synchronously). | Parent/student comms impossible | Provider abstraction + real SendGrid/WhatsApp/SMS adapters | **P1** | OPEN |
| Real-time | WebSocket/SSE | **H** | `grep -i "websocket\|socket.io\|EventSource"` across all 3 apps = **0 hits** | None functionally — React Query refetch covers current UX. **Marketing risk only.** | Add only where justified (evaluation queue, OCR status) | P2 | OPEN |
| ML | Predictive models | **H** | `grep -i "sklearn\|tensorflow\|torch\|regression\|xgboost"` = **0 hits**. Mastery = deterministic EMA formula. | **Positioning risk**: must never be marketed as "ML-powered" or "predictive" | Data pipeline first; ML only when data justifies (§19) | P3 | OPEN |
| OCR | Auto page-order / region / roll-number detection | **H** | Confirmed absent; teacher-assisted steps are real and built | Throughput limit per booklet | Evaluate vision-assisted detection | P2 | OPEN |
| OCR | Handwriting transcription | **B** | Real `gpt-4o` vision call through AI Model Registry | Self-reported confidence, not calibrated | Confidence calibration study | P2 | OPEN |
| AI | Governance gate | **A** | `SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED` keys off `stakesLevel`; parametrized test across all 5 `AssessmentKind` values; AI never terminal for GRADED | — | None. **Verified strong.** | — | GREEN |
| AI | Provider abstraction | **B** | `src/providers/` (untracked, new): base/errors/openai_adapter/types | Needs timeout/retry/cost-tracking verification | Verify per master brief §12 | **P1** | OPEN |
| Student | Leaderboard, Resources | **H** | Both render `ComingSoon` — honest placeholder, no fake data | Feature gap only | Build or keep explicitly unavailable | P2 | OPEN |
| Admin | Questions/Papers/Doubts/Assignments nav | **G** | Backends real; screens exist but unreachable from admin sidebar | Admin cannot reach real functionality | Wire into sidebar + `renderScreen()` | **P1** | OPEN |
| Founder | Console | **A** | All 11 screens verified wired to real `useFounder*` hooks; backend has 24 real endpoints; `getIntegrations()` self-reports `wired: false` honestly rather than fabricating | — | None (billing separate) | — | GREEN |
| Admin/Teacher/Student | Core dashboards | **A** | Verified real API wiring; only 2 `ComingSoon` screens repo-wide | — | None | — | GREEN |

---

## 2. Headline conclusions

1. **The engineering foundation is genuinely production-grade.** Security, tenant isolation, RBAC,
   audit immutability, queue reliability, AI governance, and backend test coverage are all real and
   verified. This is *not* a prototype dressed as a product.

2. **The blocking gaps are commercial and operational, not academic.** The product can teach; it
   cannot yet **charge**, **deploy**, or **recover**. Specifically:
   - No billing → no revenue path.
   - Plan limits defined but never enforced → nothing meaningful to sell.
   - Empty `infra/` → no reproducible deployment.
   - No backup/restore → unacceptable data-loss exposure.

3. **One config-dependent security hole:** `dev-login` fails *open* on `NODE_ENV` misconfiguration.
   Cheap to fix, catastrophic if hit. Highest-priority security item.

4. **Positioning constraint (non-negotiable):** ML, predictive analytics, real-time, and fully
   automatic handwriting evaluation are **not implemented**. They must not appear in marketing until
   built. Truthful claims available today: AI-assisted paper generation, AI handwriting
   transcription, AI-suggested grading with mandatory human approval, automated mastery tracking,
   automated intervention generation.

---

## 3. Execution order (adapted from master brief §64 to this evidence)

| Phase | Scope | Priority |
| :--- | :--- | :--- |
| **P1** | This audit | ✅ COMPLETE |
| **P2** | `dev-login` fail-closed hardening | ✅ COMPLETE |
| **P3** | Entitlement enforcement (central service + creation-point gates + usage meters) | ✅ COMPLETE |
| **P4** | Billing: Razorpay (schema → orders → verification → webhooks → entitlement activation) | P0 |
| **P5** | Deployment: Dockerfiles, compose, runbook | P0 |
| **P6** | Backup/restore with executed restore drill | P0 |
| **P7** | E2E (Playwright) — the 5 journeys | P0/P1 |
| **P8** | Notification provider abstraction + real adapters | P1 |
| **P9** | Admin nav wiring; refresh tokens; CI migration+E2E gates | P1 |
| **P10** | Load-test execution; frontend test coverage | P1 |
| **P11** | Final production audit + `CURRENT-CAPABILITIES.md` + scorecard | P1 |

---

## 4. Implementation record

### P2 — `dev-login` fail-closed hardening ✅

**The bug.** `POST /auth/dev-login` is `@Public()` and mints a real, signed JWT for any
requested role with no credentials whatsoever. Its only gate was
`NODE_ENV === 'production'`. That check fails **open**: every misconfiguration that leaves
`NODE_ENV` unset, misspelled (`Production`), or at a container default is `!== 'production'`,
which left a credential-less "become FOUNDER" endpoint publicly reachable.

**The fix — two independent defences, both defaulting to denied:**

1. `apps/api/src/config/env.schema.ts` — new `ENABLE_DEV_LOGIN` (default `false`). It is
   `z.enum(['true','false'])`, **not** `z.coerce.boolean()`, because `Boolean('false') === true`
   in JavaScript — coercion would read the reassuring `ENABLE_DEV_LOGIN=false` as *enabled*.
   A `superRefine` makes the API **refuse to boot** if the flag is true while
   `NODE_ENV=production`: a crash at startup beats a running production API with an open
   login endpoint.
2. `apps/api/src/auth/auth.service.ts` — `loginAsMockRole` now requires the flag to be
   *exactly* boolean `true` **and** `NODE_ENV !== 'production'`. Absent config = denied.

**Tests (11 new).** `env.schema.spec.ts` (7) covers default-deny, the `'false'`-is-not-true
trap, boot refusal in production, and that normal production/staging boots are unaffected.
`auth.service.spec.ts` (+5 within its existing 20) covers each real misconfiguration shape:
flag unset, `NODE_ENV` unset, `NODE_ENV` misspelled, flag true in production, and a truthy
non-boolean value — each asserting the DB is never even queried.

**Operational note.** Local dev keeps working via `ENABLE_DEV_LOGIN=true` in the gitignored
`apps/api/.env`; `.env.example` documents the flag with an explicit warning. The frontend's
demo-role buttons call this endpoint, so any environment that wants them must opt in
deliberately — which is the point.

### P3 — Entitlement enforcement ✅

**The gap.** `PlanDefinition` carried real per-plan limits (TRIAL 100 students / BASIC 1000 /
PRO 5000 / ENTERPRISE unlimited) that **nothing ever checked**. The schema's own comment
conceded it. Commercially this meant the paid tiers gated nothing: a TRIAL institute could
enrol unlimited students, hire unlimited teachers, and run unlimited assessments forever.

**What was built:**

- `entitlements/plan-definitions.ts` — the limits, moved out of `FounderService`'s private
  constant so the numbers the Founder console *displays* and the numbers enforcement
  *applies* are physically one constant. Two copies would drift silently until a customer hit
  a limit their dashboard said they hadn't reached.
- `entitlements/entitlements.service.ts` — `assertCanCreate(instituteId, resource, tx?)`,
  `getSnapshot()`, and the (relocated) idempotent `ensurePlanDefinitions()`.
- `entitlements/entitlements.module.ts` — `@Global`, since enforcement is cross-cutting and
  threading it through every feature module makes gates easier to forget.
- Enforcement wired at three creation points: `StudentsService.create`,
  `TeachersService.create` (both **inside** their existing `$transaction`, sharing the `tx`
  client) and `AssessmentsService.createAssessment`.
- `GET /institutes/:id/entitlements` — the same snapshot exposed to the institute's own
  ADMIN, not just FOUNDER: once limits actually block writes, the customer must be able to
  see why and how close they are. Tenant-scoped by reusing the existing access check.

**Design decisions worth recording:**

| Decision | Reasoning |
| :--- | :--- |
| Check runs **inside** the caller's transaction | Outside, it is a TOCTOU race — two concurrent enrolments at the plan boundary both read the same count, both pass, both write. The codebase already fixed this exact bug class once (`shared/version-guard.ts`, Phase 15). |
| `null` limit = **unlimited**, never zero | ENTERPRISE has all-null limits. Reading null as 0 would block everything for the highest-paying tier. ENTERPRISE also skips the count query entirely. |
| Missing `PlanDefinition` row falls back to **compiled defaults** | A missing seed must never read as "unlimited" — that would silently disable enforcement platform-wide. |
| Expired trial blocks **new records only** | Never reads or edits. Locking a customer out of their own data over an expired trial is hostile, and blocks the very work a renewal conversation depends on. |
| TRIAL with **no** `trialEndsAt` is treated as running | An operator provisioning a trial without a date must not create an instantly-locked institute. |
| Refusal carries `code` + `details` | `PLAN_LIMIT_EXCEEDED` with plan/limit/current lets the UI say "TRIAL allows 100 students — upgrade to add more" instead of a bare 403. |
| Assessments counted **per calendar month** | `maxAssessmentsPerMonth` is a rate, not a total. |

**Tests (25 new).** `entitlements.service.spec.ts` (20) covers seeding, the boundary
(`>=` not `>`), null-is-unlimited, per-resource counting, the monthly window, the missing-row
fallback, tx threading, all four trial-expiry cases, and snapshot headroom never going
negative for an institute downgraded below its current usage. Call-site specs (5) prove each
service actually consults the gate, that students/teachers do it inside the transaction, and
that a refusal creates nothing.

**One test was changed rather than added:** `founder.service.spec.ts`'s "seeds default plan
definitions once" asserted on `prisma.planDefinition.createMany`, which moved into
`EntitlementsService`. The assertion now proves *delegation*; the seeding behaviour itself
(seeds when empty / never reseeds over operator-tuned values) is asserted directly in the new
spec. No coverage was lost — it moved to where the behaviour now lives.

### Verification after P2+P3

| Check | Before | After |
| :--- | :--- | :--- |
| `apps/api` tests | 479 passed / 38 suites | **515 passed / 40 suites** (+36) |
| `apps/api` typecheck | clean | clean |
| `apps/api` lint | 0 errors | **0 errors** (104 pre-existing warnings, none new) |

---

*Phases 1–3 complete. Next: P4 billing, P5 deployment, P6 backup/restore, P7 E2E.*

---

## 5. Digital Answer Sheet — hardening & end-to-end verification (2026-09-20)

Scope: the AI-assisted answer-sheet flow end to end — upload (images **and PDF**), region
suggestion and correction, OCR, AI evaluation with tag-wise marks, teacher review, final
submission, ScoreRecord/mastery, and the checked-copy PDF. Full description:
`DIGITAL-ANSWER-SHEET-EVALUATION-FLOW.md`.

### 5.1 Verified baselines (executed, this session)

| Suite | Command | Result |
| :--- | :--- | :--- |
| `apps/api` | `npx jest` | **797 passed**, 7 skipped, 52 suites, 113 s |
| `apps/api-python` | `python -m pytest -q` | **316 passed**, 28 s |
| `apps/web` | `npx vitest run` | **56 passed**, 6 files |
| Typecheck | `tsc --noEmit` (api, web) | clean |
| Lint | `eslint src` / `ruff check` | **0 errors** (136 pre-existing TS warnings, none new); ruff clean |
| Build | `nest build`, `next build` | both pass |
| Migration drift | `prisma migrate diff --from-url <staging> --to-schema-datamodel` | **empty** — a freshly migrated database matches the schema exactly |

### 5.2 Defects found and fixed (all had real consequences)

| # | Defect | Consequence | Fix |
| :-- | :--- | :--- | :--- |
| 1 | OCR was sent the **whole page** for every region | On a page with two answers, each answer's transcript contained both — the second answer was graded against the first's text | Each region is cropped and read on its own (`ocr/region_box.py`); `OCRBlock.boundingBox` records the box that was read |
| 2 | A handwritten **NUMERICAL** counted as "objective, scored at capture" | A real 4-mark answer contributed **0** to the student's total, never appeared in the evaluation queue, and could not be graded | `needsHumanEvaluation()` — subjective question types **or** `PAGE_REGION` evidence; mirrored in Python; applied to the queue, the LOCK gate, score aggregation and the review sheet |
| 3 | A **late AI job could overwrite an approved mark** | Moving the current-version pointer off the teacher's version silently dropped it from ScoreRecord | `ai_evaluator.py` skips with `already_reviewed_by_teacher`; `runAiCheck` never queues approved answers; submit does compare-and-swap per answer |
| 4 | Booklet page image never loaded in the review panel | Region marking was impossible — the panel passed a `PageImage` id to an endpoint keyed by `Page` id | One-line fix in `DocumentDetailPanel` |
| 5 | AI recommendations recorded **"OpenAI / gpt-4o"** while Gemini did the work | Audit trail wrong; deactivating the model was not a kill switch | Registry chain resolved per active provider (`providers/factory.py`) |
| 6 | Provider **429 answered as 500** | Queue burned three retries in ten seconds and dead-lettered work that would have succeeded (observed: 4 dead OCR jobs) | 429 + `Retry-After` from all three AI routes; jobs rescheduled without spending an attempt; in-process pacing to `PROVIDER_MAX_RPM` |
| 7 | Upload trusted the client's `Content-Type` and used its **filename** in the storage key | A crafted upload could steer the object's name and served type | Signature sniffing, generated object names, per-type size limits |
| 8 | Region delete/re-map **silently deleted confirmed marks** | A teacher could lose approved marks with one click | Refused with `REGION_HAS_FINAL_MARKS` unless explicitly discarded; the UI asks first |
| 9 | Marks printed **over the student's handwriting** in the checked copy | Answers unreadable in the archived copy | Marks are placed beside the box, margin-first |
| 10 | LOCK gate's two `OR` clauses overwrote each other (introduced while fixing #2, caught by its own spec) | The gate would have counted answers it should ignore | Both clauses composed under `AND`; the spec now asserts the composed shape |

### 5.3 What was built on top

PDF booklet upload (stored privately, rendered by pdfium through a retrying `pdf-split` queue,
unreadable files failed with a reason); AI region suggestions with per-box confidence and unmapped
fallback; full region editing (move, resize, split, merge, delete, re-map); reference-less grading
where the model solves the question itself; tag-wise marks end to end (AI → review screen → stored
version → PDF); the whole-sheet review screen and all-or-nothing submit; and a checked-copy PDF with
embedded fonts, correct Devanagari shaping, LaTeX→Unicode maths and totals that are verified before
anything is printed.

### 5.4 End-to-end run (staging stack, real provider)

`infra/staging/fixtures/`: `seed-fixture.js` (institute, teacher, student, 5-question paper —
numerical without a reference answer, theory with one, Hindi, LaTeX, and an objective MCQ),
`make-answer-sheet.py` (3-page booklet as PDF **and** images, with a right-method/wrong-arithmetic
numerical, an incomplete theory answer and an off-topic answer), `run-e2e.js` (drives the flow over
HTTP as the teacher and asserts on what each step produced).

Observed on the disposable staging stack (`localhost:5433` / `localhost:6380`, migrations applied by
the guarded script):

| Stage | Result |
| :--- | :--- |
| PDF upload → render | 1 PDF → **3 pages**, `IDENTITY_PENDING`, queued and rendered by the worker |
| Identity confirmation | attempt created and linked |
| Region suggestion | **5 regions across 3 pages, all auto-mapped**, confidence 0.95–0.98 |
| OCR | 4/4 answers read, self-reported confidence **0.98**, each transcript **its own answer** (the assertion that would have caught defect #1 is in the runner) |
| AI evaluation | **BLOCKED — free-tier quota**: `gemini-3.6-flash` allows **20 requests/day**, spent by the day's detection/OCR runs. Jobs were rescheduled, not lost (rate-limit handling verified live). |
| Teacher review → submit | 4 answers approved in one transaction |
| ScoreRecord | **10/17, `isFinalized: true`**, written synchronously |
| Reload | sheet `FINAL`, reviewer named, **tag-wise marks persisted exactly** |
| Late AI check | refused to queue over approved answers (`enqueuedCount: 0`) |
| Checked copy | 4-page PDF, 341 KB, downloaded and opened; scans embedded unchanged, marks in the margin |

AI grading itself was verified live earlier the same day against the same provider (four cases:
numerical with an arithmetic slip → 3/4 with the calculation tag zeroed; correct numerical → 4/4;
partial theory → 2/5; off-topic → 0 with `offTopicSuspected`), plus 316 Python tests. What has **not**
been observed is one uninterrupted run through *both* the AI stage and submission — the daily cap
stops it. `run-e2e.js --resume <attemptId>` re-runs the second half without re-spending quota.

### 5.5 Status

| Area | Status | Evidence / what remains |
| :--- | :--- | :--- |
| Upload (images + PDF), validation, storage | **GREEN** | E2E render of a 3-page PDF; sniffing/limits/safe-key tests; private storage with signed URLs |
| Region suggestion + teacher correction | **GREEN** | 5/5 auto-mapped in the E2E; unit tests for unmapped/objective/failed-page/rate-limited paths; full edit set in the UI |
| OCR per region | **GREEN** | Per-answer transcripts at 0.98 in the E2E; stale-box invalidation tested on both sides |
| Teacher governance (AI never final) | **GREEN** | Three independent enforcement points, each with tests; E2E confirms the score only moves on submit and a late AI check is refused |
| Submission → ScoreRecord → reload persistence | **GREEN** | E2E: 10/17 finalized, FINAL after reload, tags exact |
| Checked-copy PDF (incl. Hindi, maths, totals) | **GREEN** | 10 renderer tests incl. no-missing-glyph and byte-for-byte scan embedding; real copy generated in the E2E |
| Concurrency & idempotency | **GREEN** | Per-answer CAS + all-or-nothing transaction; idempotent re-submit; dedupe keys on every queue |
| Security & tenant isolation | **GREEN** | Cross-institute reads 404 at service level (tested); internal routes token-gated and re-check the tenant; provider errors never returned |
| AI evaluation against a live provider **at production volume** | **YELLOW** | Works per answer; **the free-tier key allows 20 requests/day**, which cannot grade a class. Needs a paid key (then `PROVIDER_MAX_RPM` raised) before real use. |
| OCR accuracy on **real** handwriting | **YELLOW** | Verified on synthetic handwriting only. Measure on real scripts before promising accuracy; confidence is self-reported, not calibrated. |
| Migrations applied to production | **YELLOW** | Three additive migrations applied and drift-checked on staging; **not** applied to any shared/production database by this session, by design. |
| Fonts in the deployed image | **YELLOW** | Dockerfile and CI now install `fonts-noto-core`/`fonts-dejavu-core`; the image has not been rebuilt/deployed here. |
| Malware scanning / EXIF stripping on uploads | **RED (pre-existing, unchanged)** | Still no provider wired (07 §9, 17). Uploads are institute-scoped and private, but this remains an accepted gap. |

---

