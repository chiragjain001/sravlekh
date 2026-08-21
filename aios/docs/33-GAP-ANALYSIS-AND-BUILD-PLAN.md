# 33 — Gap Analysis & Adapted Build Plan (v2 Kickoff)

STATUS: LIVING DOCUMENT — written at the start of the v2 build, updated as phases close.
Produced per the kickoff protocol in `20-IMPLEMENTATION-PLAN.md` §"Execution Protocol" steps 3–4
("identify contradictions/missing requirements, confirm/refine plan against current repo state").

This document does two things: (1) states what actually exists in the codebase today versus what
`docs/00-32` specify, module by module; (2) adapts the phased plan in `20-IMPLEMENTATION-PLAN.md` to
start from this partial codebase instead of from zero.

---

## 0. How to read this document

- "**Works**" = implemented, wired end-to-end (UI → API → DB), matches the docs closely enough to build on.
- "**Broken/Partial**" = code exists but is stubbed, mock-only, disconnected, or contradicts the spec in a
  way that would mislead a user.
- "**Missing**" = no implementation at all.
- Every conflict between existing code and the docs is flagged with a recommendation, not silently resolved,
  per the Hierarchy of Truth (`00-DOCUMENTATION-GUIDE.md`): 07 Security → 32 AI Governance → 01 Product →
  21/02 Architecture → 05 API → 04 DB → 15 Coding Standards → 03/28 UI-UX → 20 Implementation Plan.

---

## 1. Stack & repo shape vs. docs

Matches `16-FOLDER-STRUCTURE.md` almost exactly: `apps/{web,api,api-python}`, `packages/{db,ui,config}`,
`infra/`. No structural divergence. Confirmed stack matches `02-SYSTEM-ARCHITECTURE.md`: Next.js 14 App
Router, NestJS 10, FastAPI, Prisma dual-client (JS + Python), PostgreSQL. One real gap: **`packages/ui` is
completely empty** (no files at all) despite being the canonical shared design-system package in the folder
structure doc — the actual design system (Tailwind tokens, `foundation.tsx` skeleton/empty-state components)
lives ad hoc inside `apps/web`. **Flagged, not resolved unilaterally** (see §7).

Two root-level docs (`AIOS_Product_Vision_Philosophy_Approach.md`, `AIOS_Software_Requirements_Specification.md`)
predate `docs/00-32` and are already stale against the actual code in places (claim RolesGuard is wired when
it wasn't until this session; claim Framer Motion is in the stack when it isn't; claim 26 DB models when the
schema has 31; several documented endpoints don't exist). Treat `docs/00-32` as authoritative; treat the two
root docs as historical/aspirational context only.

---

## 2. Module-by-module gap analysis

### Auth & Tenancy
- **Backend**: `JwtStrategy`, `JwtAuthGuard`, `RolesGuard`, `@Public()`/`@Roles()` decorators, and per-service
  `assertInstituteAccess` tenant checks were all correctly written — **but the guards were never registered
  globally** (no `APP_GUARD` provider, no `useGlobalGuards`). Every `@Roles()` decorator was inert metadata;
  no request was actually authenticated or authorized at runtime. **This was the single highest-priority gap
  against `07-SECURITY-SPECIFICATION.md` (Hierarchy-of-Truth rank #1: "never trust client permissions").
  Fixed in this session** — see §5.
- **Frontend, fixed this session**: `/login` rendered a mock-role-selector ("Testing Mode — No auth
  required") that never called `POST /auth/google`; the real `login()` was a stub. A second, better-built,
  fully-wired-for-real-Google-Sign-In component (`components/auth/LoginPage.tsx`, matching the actual navy/
  teal design tokens) already existed in the codebase but was **never imported by any route** — dead code.
  Wired it in as the real `/login` screen instead of writing a new one, per the "don't rewrite working code
  unnecessarily" / preserve-the-design-system rules. It also had its own second mock-login mechanism
  (`handleDemoLogin`, writing directly to `localStorage` and flipping a global `aios_demo_mode` flag that
  silently mocks all API responses) duplicating `AuthContext.loginAsMock` — consolidated onto the one
  mechanism. Both the context's `loginAsMock` and the login page's demo buttons are now hard-gated behind
  `NODE_ENV !== 'production'`; verified the mock UI and its strings are absent from the production bundle
  (`.next/static`), not just hidden at runtime.
- The frontend `AuthenticatedUser` type (`permissions`, `featureFlags`, `branchConfig`, `parentId`, etc.) does
  not match the backend's actual shape (`id, email, name, role, instituteId`). Frontend type is aspirational —
  align it to the backend contract as auth is wired for real, extending the backend contract only where a doc
  (e.g. the v2 Role/Permission/Scope model in `21-DOMAIN-MODEL-V2.md` §4.10) actually calls for it.
- No `Parent`/`Guardian` user role exists in the `UserRole` enum despite a `parentId` field already present in
  the frontend type — out of scope for v1/v2 Phase 1-15 per `01-PRODUCT-REQUIREMENTS.md` non-goals; leave as is.

### Academic Hierarchy (Institute/Branch/AllowList/Batch/Subject/Chapter/Topic)
- **Works, partially**: `InstitutesModule`, `UsersModule`, `StudentsModule`, `TeachersModule`, `BatchesModule`
  exist with real service-layer tenant scoping. **Missing**: no dedicated `SubjectsModule`/`ChaptersModule`/
  `TopicsModule` controllers — curriculum CRUD (`03-FEATURE-SPECIFICATIONS.md` "Subject/Chapter/Topic") has no
  backend home despite `AdminAcademics` frontend screens expecting one, and despite `Subject`/`Chapter`/`Topic`
  models existing in the schema.
- Frontend has **3 parallel implementations** of academics/students/teachers/batches/etc admin screens (see §3
  and §7 item 2) — the one users actually reach via the sidebar is a well-built, full-CRUD UI backed entirely
  by an in-memory mock store, not the real API.

### Question Bank & Blueprint/Paper Generation
- Backend `QuestionsModule`/`PapersModule` exist and are real-API-wired from a subset of frontend screens.
- **Investigated (§7 item 3): not a duplication.** FastAPI's `blueprint_agent.py` (prompt → proposed
  distribution) and NestJS `PapersService.generatePaper()` (blueprint id → real assembled Paper) are sequential
  stages of one pipeline, not two implementations of the same feature — confirmed via the frontend hooks and
  `17-THIRD-PARTY-INTEGRATIONS.md`'s manual-assembly-fallback framing. Resolved, no decision needed.
- `blueprint_agent.py` imports `langchain_openai.ChatOpenAI`, which is not in `requirements.txt` — will fail
  at runtime as written today.
- Question `isApproved` approval workflow, `QuestionVersion` snapshotting exist in the schema; approval-endpoint
  wiring not fully traced but questions controller exists — verify in Phase-1 hardening pass.

### Exam Lifecycle & Marks Capture
- **Critical gap**: `Exam.status` (7-stage enum) is modeled, but **no status-transition endpoint exists at
  all** — no `PATCH /exams/:id/status`, no unlock endpoint. An exam created via the API can never leave `DRAFT`
  today. The audited unlock-with-reason flow (`Exam.unlockReason`, `lockedByUserId`) has zero implementation
  despite being one of the most-referenced business rules across `01`, `03`, `18`, `19`.
  Only `createExam`, `linkPaper`, `createAnswerSheet`, `gradeAnswerSheet` exist.
- Frontend's `TeacherEvaluationQueue` and the assessment-builder wizard (`Step8Generate.tsx`) are UI shells —
  "Publish" just does a `setTimeout` and never calls the backend; "Start Grading" only flips local nav state,
  never opens a real grading flow against `POST /exams/:id/grade-sheet`.
- **No document/OCR/handwritten-answer-sheet UI exists anywhere in the frontend** — confirms v2's entire
  Digital Copy feature set (docs 21–32) is a 0%-built greenfield addition on both frontend and backend; no
  conflicting legacy code to reconcile there, which simplifies Phases 7–15.

### Academic Intelligence (Mastery/Remediation)
- **Correction to an earlier pass's finding**: `/analytics/batch/:id/heatmap` *does* exist in
  `apps/api-python/src/routers/analytics.py` (pandas-based aggregation over `MasteryScore` rows) — it was
  mischaracterized as missing before its contents were actually read. It's a real, working read-side endpoint.
  `apps/web`'s `BatchHeatmap.tsx` calling it is fine.
- **Real finding, found while wiring the mastery-recalc queue (§5)**: the actual mastery-calculation logic (the
  EMA formula) lives entirely in NestJS (`AnalyticsService.recalculateMastery`) — there is no
  `mastery_engine.py` in `apps/api-python` at all, only the read-side heatmap aggregation above. This
  contradicts `02-SYSTEM-ARCHITECTURE.md`'s component-ownership table, which assigns "Mastery calc, trend/
  diagnostic computation" to `api-python` and explicitly says NestJS should own transactional writes, **not**
  analytics math. Not fixed this session — moving the calculation to Python is a bigger, structural move
  (changes the sync/async contract between the two services) and belongs in Phase 5's "Mastery/Remediation
  verification" work, not bundled into the queue-infrastructure fix. Flagged here so it isn't rediscovered
  cold later.

### Doubts, Assignments, Timetable
- `DoubtsModule`/`AssignmentsModule`/`TimetableModule` exist with real controllers.
- **`DoubtsService.resolveDoubt()` discards the resolution text** — the code contains its own comment
  admitting this ("In a full implementation, the resolution text would be saved..."). Contradicts
  `03-FEATURE-SPECIFICATIONS.md`'s Doubt Ticket Lifecycle spec (`responseText` is a modeled field).
- **`TimetableService.createSlot()` performs no room/teacher conflict check** despite the schema carrying the
  fields needed for it and `18-EDGE-CASES.md` explicitly requiring "overlapping slot for same teacher → 409
  pre-persistence."

### Communication, Reports, Audit
- **Missing entirely on the backend**: no `NoticesModule` (Notice/NoticeDelivery exist in schema, no
  controller), no `ReportsModule` (Report exists in schema, no controller), no audit-log read endpoints
  (`AuditLog` is write-only today — nothing ever queries it despite `AdminAuditLogs`/`FounderAuditLogs`
  frontend screens expecting to).
- Frontend Communication/Reports/AuditLogs screens are entirely mock-data-driven as a direct consequence.
- No email/SMS/WhatsApp/S3/Redis integration code exists anywhere despite `env.schema.ts` validating config
  for all of them — these are configuration placeholders for unbuilt integrations, not partial implementations.

### Founder Console
- 11 Founder screens exist on the frontend, **100% mock-data-driven**; **zero backend module** exists for any
  of them (no institutes-admin, subscriptions/billing, feature-flags, platform health, or tickets endpoints).
  Consistent with `01-PRODUCT-REQUIREMENTS.md`'s Phase 1 non-goal of "no billing/payments engine" for the
  subscriptions piece, but Founder Overview/Institutes/AuditLogs/Health are in-scope per `20`'s Phase 6 and are
  simply not started.

### Cross-cutting: Error handling, logging, testing, CI
- **No global exception filter existed** (fixed this session, see §5) — error responses were Nest's raw default
  shape (`{statusCode, message, error}`), not the `08-ERROR-HANDLING.md` envelope, and some list endpoints
  returned inconsistent pagination shapes across modules.
- **No `/health` endpoint existed** on either service, despite being a named Phase 1 exit criterion in `20` and
  a hard requirement in `14-DEPLOYMENT-ARCHITECTURE.md`. Added for `apps/api` this session (DB check only —
  Redis check pending Redis actually being wired up, see below).
- **Zero automated tests anywhere in the repo at session start**, contradicting `13-TESTING-STRATEGY.md`'s
  coverage requirements and the global Definition-of-Done in `19`/`20`. **Fixed this session** (§5): Jest/
  Vitest/pytest scaffolding stood up in all three apps with an initial (intentionally small) spec per app,
  including a regression test for the auth-guard bug found above.
- **No CI at all, and no lint tooling installed, at session start** (`eslint` binary missing from `node_modules`
  despite the `lint` script existing), contradicting `14-DEPLOYMENT-ARCHITECTURE.md`'s required pipeline.
  **Fixed this session** (§5): `.github/workflows/ci.yml` runs lint → typecheck → test → build for all three
  apps on every push/PR; 9 real pre-existing lint errors fixed so it starts green.
- **No Redis/queue infrastructure existed at session start.** **Fixed this session** (§5): `QueueModule` +
  a real `mastery-recalc` BullMQ queue/processor now back the one async trigger that existed
  (`gradeAnswerSheet`'s mastery recalc). The queues v2 will need (`document-processing`, `ocr`, `ai-evaluation`,
  `evaluation-aggregation`) still don't exist — expected, since nothing in v2 is built yet — but the shared
  connection infrastructure they'll register against is now in place.
- **No S3/object-storage client existed at session start.** **Fixed this session** (§5): `StorageService` is
  available repo-wide (tenant-scoped keys, signed URLs) but not yet wired to any endpoint — no upload endpoint
  exists yet to wire it to.
- A populated `apps/api/.env` file is present in the working tree (not just `.env.example`); verified it is
  covered by `.gitignore` and untracked (`git check-ignore -v` confirms), so no secret-leak concern — not
  opened or read by this analysis regardless, to avoid handling credentials.

### v2 subsystems (docs 21–32)
100% unbuilt — no Assessment/AssessmentDelivery/Attempt/Document/Rubric/Evaluation models exist in
`schema.prisma` yet, no corresponding modules, no UI. This is expected (v2 docs are all `STATUS: PROPOSED`)
and means Phases 7–15 are genuinely greenfield with no legacy code fighting them — the only real dependency is
that Phase 7 (domain refactor) must land cleanly on top of a *stabilized* v1 foundation, which is why Phase 1
(this session's focus) matters disproportionately.

---

## 3. Frontend duplication — flagged, not resolved unilaterally

Three parallel implementations of the same admin feature set coexist:

1. `components/dashboard/admin/{feature}/*List.tsx` + `Create*Modal.tsx` — oldest, partially wired to
   `useApi.ts`/`api-client.ts` (real axios calls), partially hardcoded arrays.
2. `components/dashboard/admin/screens/Admin*.tsx` — a second, more complete-looking set matching the SRS
   screen catalogue, reading from static `lib/mock-data/admin.ts`.
3. `features/{academics,batches,...}/` — newest, best-architected (types/hooks/services/mock split), but every
   `*.service.ts` is explicitly commented as mock-only with an in-memory `_store` and artificial network delay,
   never calling `apiClient`.

Plus a fourth cross-cutting mock layer: `api-client.ts`'s `isDemoMode` flag intercepts requests and returns
canned JSON regardless of which of the three implementations called it.

**Recommendation** (not yet executed — this is a structural consolidation decision, flagged per the kickoff
instructions rather than done silently): standardize on the `features/` architecture (cleanest separation,
already closest to `16-FOLDER-STRUCTURE.md`'s intent) and delete the other two once each feature area's
`*.service.ts` is rewired to call `apiClient` against the real (now-authenticated) backend. This should happen
feature-by-feature as part of the normal Phase 2+ vertical-slice work — data model → API → business logic → UI
→ tests — not as a single big-bang rewrite PR. Flagging for confirmation before treating it as the default plan.

---

## 4. Adapted phase plan

`20-IMPLEMENTATION-PLAN.md`'s phases 1–15 are the target shape. Adapting for a partial existing codebase:

**Phase 1 — Foundation Hardening (in progress, this session).** Not "build auth from zero" — fix what's broken
in what already exists:
- [x] Wire `JwtAuthGuard`/`RolesGuard` as global guards (`APP_GUARD`) — done this session.
- [x] Global exception filter matching the `08-ERROR-HANDLING.md` envelope, incl. Prisma error translation and
      field-level validation details — done this session.
- [x] `GET /health` (DB check) — done this session.
- [x] Wire real Google Sign-In on the frontend; mock-login path gated behind non-prod (verified stripped from
      the production bundle); introduced `GoogleLoginApiResponse` as the precise frontend/backend contract
      type instead of overloading the full local `AuthenticatedUser` shape — done this session.
- [x] Stand up test tooling (Jest for `apps/api`, Vitest/RTL for `apps/web`, pytest for `apps/api-python`) and a
      CI workflow (lint → typecheck → test → build) at `.github/workflows/ci.yml` — done this session. Every
      commit from here forward is gated; see §5 for what's covered today (near-zero, by design — the point was
      to stop accumulating untested code, not to retroactively write a full suite in one pass).
- [x] Install/fix lint tooling — done this session for all three apps. Found and fixed real pre-existing lint
      errors along the way (see §5) so CI starts green rather than red from commit one.
- [x] Stand up Redis + BullMQ — done this session. `infrastructure/queue/QueueModule` (global BullMQ connection,
      fails open — an unreachable Redis logs and keeps retrying rather than crashing boot, verified in isolation)
      + a `mastery-recalc` queue/processor replacing the raw in-process fire-and-forget call in
      `ExamsService.gradeAnswerSheet` with a real queued job (3 attempts, exponential backoff, failed-job
      logging as the dead-letter signal per `08-ERROR-HANDLING.md`). `/health` now also reports Redis status
      (fail-open — Redis down doesn't flip overall health to unhealthy, per `09-CACHING-STRATEGY.md`).
- [x] Stand up S3-compatible storage client — done this session. `infrastructure/storage/StorageService`
      (`@aws-sdk/client-s3`), tenant-scoped `buildKey(instituteId, ...)` always prefixing
      `institutes/{instituteId}/...` per `07-SECURITY-SPECIFICATION.md`, signed-URL downloads, throws clearly
      rather than silently no-op-ing when S3 env vars are missing. **Not yet wired to any endpoint** — no
      multipart-upload handling exists anywhere in `apps/api` today (confirmed: no `multer`/`FileInterceptor`
      usage repo-wide), so this is the shared client Phase 4's photo-capture/OMR endpoints will build on, not
      a wired feature yet.
- **Exit gate**: real login → correct dashboard; non-allowlisted rejected; unauthenticated/wrong-role requests
  get 401/403 through the real guards; `/health` green in CI.

**Phase 2 — Curriculum & roster completion.** Add missing `SubjectsModule`/`ChaptersModule`/`TopicsModule`
controllers. Begin consolidating the 3 duplicate frontend implementations per feature area, starting with
Academics (lowest-risk, no exam-state-machine coupling), rewiring `features/academics` to the real API.

**Phase 3 — Question Bank & Paper Generation reconciliation.** Fix `blueprint_agent.py`'s missing
`langchain-openai` dependency (or replace, see §7). Reconcile the two divergent paper-generation code paths into
one coherent AI-Blueprint-Agent flow per `03-FEATURE-SPECIFICATIONS.md`. Wire Question approval/versioning UI.

**Phase 4 — Exam State Machine & Marks Capture (the load-bearing gap).** Build the missing status-transition
and unlock endpoints. Wire `TeacherEvaluationQueue` and the assessment-builder wizard to real endpoints instead
of `setTimeout` stubs. This is the highest-value, highest-risk v1 gap — nothing in Phases 7+ (which build
`Assessment`/`AssessmentDelivery` as a superset of `Exam`) can be validated for "zero regression" against a
state machine that doesn't functionally exist yet.

**Phase 5 — Mastery/Remediation verification + Doubts/Timetable fixes.** Decide and execute on the
mastery-calculation ownership gap (§2 "Academic Intelligence" — the EMA formula lives in NestJS today, contrary
to `02-SYSTEM-ARCHITECTURE.md`'s component ownership; moving it to `apps/api-python` is a real, structural
move, not a quick fix). Fix `DoubtsService.resolveDoubt()` to persist resolution text. Add Timetable conflict
checking.

**Phase 6 — Communication, Reports, Audit, Founder console.** Build the entirely-missing `NoticesModule`,
`ReportsModule`, audit-log read endpoints, and the Founder-facing backend. Wire the corresponding frontend
screens off mock data.

**Phase 6.5 — v1 Hardening (was v1 Phase 6 in `20`).** Full security test suite, load testing against
`10-SCALABILITY-STRATEGY.md` targets, monitoring/alerting, RLS evaluation — now feasible once auth/tests/CI
exist. **This is the true exit gate before starting the v2 domain refactor** — `20`'s own Sequencing Rationale
requires the v1 baseline to be regression-testable before Phase 7 touches the schema.

**Phases 7–15 — v2 (Domain Refactor → Assessment Engine → Rubric Engine → Document Processing → OCR →
Evaluation Engine [manual-only] → AI Evaluation → Reviewer Layer → v2 Hardening).** Unchanged from
`20-IMPLEMENTATION-PLAN.md` — no existing code conflicts with these phases since none of this is built yet. The
sequencing rationale in `20` (rubric before evaluation, document-processing before OCR, manual before AI
evaluation, reviewer after AI) stands as written and should not be reordered.

Two forward-reference gaps inherited from the v2 doc pack itself (not this codebase): `04-DATABASE-SCHEMA.md`'s
V2 section, `05-API-SPECIFICATION.md`'s V2 section, `02-SYSTEM-ARCHITECTURE.md`'s V2 section, and
`06B-AUTH-AUTHORIZATION-V2.md` are referenced throughout docs 21–32 but not yet written as of this session. They
need to be drafted (from the detail already present in docs 21, 26, 27, 30) before or during Phase 7, not
discovered as missing mid-implementation.

---

## 5. What changed in this session

- `apps/api/src/auth/auth.module.ts` — registered `JwtAuthGuard` and `RolesGuard` as global `APP_GUARD`
  providers (order matters: authenticate, then authorize).
- `apps/api/src/shared/filters/all-exceptions.filter.ts` (new) — standard error envelope, Prisma error
  translation (P2002/P2003/P2025), no internals ever leaked to the client.
- `apps/api/src/shared/middleware/request-id.middleware.ts` (new) — `requestId` correlation for logs and the
  error envelope.
- `apps/api/src/main.ts` — registers the global filter's dependency (`ValidationPipe.exceptionFactory` now
  produces `{code, message, fields}`), request-id middleware applied globally in `app.module.ts`.
- `apps/api/src/health/` (new) — `GET /health` (`@Public()`, checks DB via Prisma).
- Verified: `pnpm typecheck` and `pnpm build` pass clean in `apps/api` after these changes.
- `apps/api/src/auth/{auth.types.ts,auth.service.ts}` — `AuthenticatedUser` now carries `avatarUrl` (it was
  fetched from the Google payload and written to the DB but silently dropped before reaching the client).
- `apps/web/src/app/login/page.tsx` — now renders the real, previously-unwired `components/auth/LoginPage.tsx`
  instead of the ad-hoc mock-role-selector markup that used to live directly in the route file.
- `apps/web/src/components/auth/LoginPage.tsx` — `handleDemoLogin` now delegates to `AuthContext.loginAsMock`
  instead of writing its own localStorage/demo-mode session; the demo-login block is gated to non-production.
- `apps/web/src/contexts/auth.context.tsx` — real `login(idToken)` now POSTs to `/auth/google`, builds the
  full local `AuthenticatedUser` from the backend's minimal response plus role-based defaults for the fields
  that aren't modeled server-side yet (permissions/featureFlags/institute-branch config — see the type-level
  comment in `auth.types.ts`), persists the session, and redirects by role. `loginAsMock` is now hard-gated
  to `NODE_ENV !== 'production'`.
- `apps/web/src/types/auth.types.ts` — added `GoogleLoginApiResponse`, the actual (narrower) shape
  `POST /auth/google` returns, instead of typing the raw response as the full local `AuthenticatedUser`.
- Verified end-to-end in the browser (dev server): `/login` renders correctly on-brand, real Google button
  renders via GSI, mock "Demo as Teacher" flow redirects to the Teacher dashboard with no console errors, and
  `pnpm build` confirms the mock-login UI/strings are absent from `.next/static` (production bundle).

**Still open**: `GET /institutes/me` doesn't exist (only `GET /institutes/:id`), so `instituteConfig`/
`branchConfig` are currently defaulted client-side rather than fetched — real institute name/branding won't
show until that's wired, likely alongside the Academics module work in Phase 2. `branchId`/`sessionId` have no
backend model at all (`User` has no `branchId`; there's no `Branch`↔`User` relation and no "active academic
session" entity) — currently defaulted to `''`, which the existing `AcademicContext` store already tolerates.

### CI stood up (this session)

`.github/workflows/ci.yml` — three parallel jobs (`api`, `web`, `api-python`), each running lint → typecheck →
test → build (Python: `ruff check` → `pytest`). Runs on every push/PR to `main`/`develop`, matching
`14-DEPLOYMENT-ARCHITECTURE.md`'s required pipeline order. This is deliberately the *starting* gate, not a
finished test suite — coverage is near-zero today by design (the ask was to stop untested code from
accumulating further, not to backfill weeks of missing tests in one pass).

**Per app:**
- `apps/api` — added `jest` + `ts-jest`, `.eslintrc.cjs` (`@typescript-eslint`), `tsconfig.eslint.json` (so
  typed linting can see `.spec.ts` files, which the build's `tsconfig.json` deliberately excludes). Two spec
  files: `health/health.controller.spec.ts` (DB-up/DB-down cases), and — because this session's biggest finding
  was the unwired auth guards — `auth/auth.module.spec.ts`, a **regression test asserting `JwtAuthGuard` and
  `RolesGuard` are actually registered as global `APP_GUARD` providers, in the right order**, so that exact bug
  class can never silently reappear.
- `apps/web` — added `vitest` + React Testing Library + `jsdom`. `.eslintrc.json` extends `next/core-web-vitals`
  (Next 14.2.4's config doesn't register `@typescript-eslint` rules by default, which broke several pre-existing
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comments — registered the plugin explicitly).
  One spec file: `lib/permissions/rbac.test.ts` (the RBAC permission-check logic — the closest thing on the
  frontend to auth-adjacent business logic, per `13-TESTING-STRATEGY.md`'s "100% on shared auth-guard logic").
- `apps/api-python` — added `ruff` + `pytest` + `httpx`, `pyproject.toml`, `requirements-dev.txt`,
  `tests/test_health.py` (deliberately constructs `TestClient(app)` without the `with` context manager, so the
  app's `lifespan` — which calls `connect_db()` — never runs; a DB-dependent smoke test isn't a smoke test).

**Lint severity calibration**: per `15-CODING-STANDARDS.md` ("no merge with lint errors; warnings tracked,
don't block"), each app now lints with **0 errors** — but getting there meant fixing 9 real pre-existing errors
in `apps/api` (2 `prefer-const`, 4 empty `catch` blocks in `writeAudit` helpers now logging via the class's
existing `Logger` instead of silently swallowing, 1 stale `eslint-disable` comment naming the wrong rule) and
letting two high-volume, low-severity rule categories (`react/no-unescaped-entities` in `apps/web`, ~30
instances across 15 files; `E501` line-length in `apps/api-python`) stay as warnings rather than hand-editing
dozens of files in this pass. Ruff's `--fix` auto-resolved 20 real style issues in `apps/api-python`
(unsorted/unused imports, `Optional[X]` → `X | None`) with zero manual edits needed.

**Blocking issue found, not resolved — needs a decision**: the dual Prisma-client setup
(`packages/db/prisma/schema.prisma` generates both `prisma-client-js` for the Node apps and `prisma-client-py`
for `apps/api-python`) **does not actually work as currently pinned**. `prisma generate` (Node CLI, pinned
`^5.22.0` — matching `apps/api`, after fixing `packages/db`'s own stale `^5.14.0` pin, see below) fails the
Python generator step with an engine-version mismatch: the latest available `prisma-client-py` (`0.15.0`, per
PyPI as of this session) expects the Prisma engine that ships with Node CLI **5.17.0**, not 5.22.0. This means
`apps/api-python` has almost certainly never had a working generated DB client — `from prisma import Prisma`
fails at import time in a fresh install. `.github/workflows/ci.yml`'s `api-python` job will surface this
visibly (fails at the `pnpm db:generate` step) rather than hide it. Two ways to resolve, both consequential
enough that this is flagged rather than picked: **(a)** downgrade the Node `prisma`/`@prisma/client` pin
repo-wide to `5.17.0` (loses whatever 5.18–5.22 features/fixes apps/api may or may not actually be using —
unclear whether `^5.22.0` was a deliberate choice or just "latest at the time"), or **(b)** wait for / find a
`prisma-client-py` release compatible with a newer engine and re-pin `apps/api-python/requirements.txt`. Until
one of these lands, `apps/api-python` cannot talk to the database at all in this repo, current state or CI.

**Incidental fix**: `packages/db/package.json` pinned `prisma`/`@prisma/client` to `^5.14.0` while `apps/api`
pinned `^5.22.0` — pnpm hoists a single version, so this mismatch was silently masked until Python codegen
surfaced it. Bumped `packages/db` to `^5.22.0` to match; this fix stands regardless of how the (a)/(b) decision
above resolves.

### Redis/BullMQ + S3 (this session)

- `apps/api/src/infrastructure/queue/QueueModule` (new, global) — one shared BullMQ/ioredis connection off
  `REDIS_URL` (defaults to `redis://localhost:6379` with a warning if unset, matching the env schema's existing
  "optional" stance on this var). Verified in isolation that an unreachable Redis logs a connection error and
  leaves the process running rather than crashing boot.
- `apps/api/src/analytics/mastery-recalc.processor.ts` (new) + `AnalyticsService.enqueueMasteryRecalc` — the
  `mastery-recalc` queue. `ExamsService.gradeAnswerSheet` now enqueues instead of calling
  `AnalyticsService.recalculateMastery` directly with a bare `.catch()` (the old version had no retry and would
  silently lose the recalculation entirely on any transient failure). 3 attempts, exponential backoff, failed
  jobs logged at error severity once retries are exhausted (`08-ERROR-HANDLING.md`'s dead-letter requirement).
- `apps/api/src/health/health.controller.ts` — now also reports Redis status (`redis: 'up'|'down'`), fail-open
  per `09-CACHING-STRATEGY.md` (Redis down doesn't flip the overall health check to unhealthy; DB down still
  does).
- `apps/api/src/infrastructure/storage/StorageService` (new, global) — S3-compatible client
  (`@aws-sdk/client-s3` + presigner), `buildKey(instituteId, ...)` enforcing the tenant-scoped
  `institutes/{instituteId}/...` prefix from `07-SECURITY-SPECIFICATION.md`, throws clearly rather than
  silently no-op-ing when S3 env vars are unset. Not wired to any endpoint yet — there's nothing to wire it to
  (no upload endpoint exists anywhere in `apps/api` today).
- Verified: `pnpm typecheck`/`lint`/`test`/`build` all pass clean in `apps/api` after these changes (6 tests
  across 3 spec files, up from 3).

---

## 6. Definition of Done reminder

Every feature built from here forward is checked against the global gate in `19-ACCEPTANCE-CRITERIA.md` /
`20-IMPLEMENTATION-PLAN.md`: requirement implemented per spec, API per `05`, input validation, authorization
(role+tenant+batch scope), error handling per `08`, all four UI states, migration reviewed, unit+integration+
contract tests passing, logging per `12`, docs updated if architecture changed, typecheck/lint/build/tests
green, no secrets exposed, no unjustified deps, performance considered (`11`), edge cases (`18`) addressed.

---

## 7. Open items requiring a decision (flagged, not decided here)

1. **`packages/ui` is empty.** Options: (a) keep building shared components inside `apps/web/src/components/ui`
   as today and treat `packages/ui` as aspirational/unused, or (b) actually populate `packages/ui` and have
   `apps/web` consume it, matching `16-FOLDER-STRUCTURE.md` literally. This is a structural decision beyond
   "preserve the existing design system" — recommend (a) for now (lowest risk, no visual change, matches what's
   actually working) unless there's a reason (e.g. a second consuming app) to invest in (b).
2. **Frontend triple-duplication (§3), investigated further** — the three implementations aren't equally
   "live." The sidebar (`Sidebar.tsx`) drives `/dashboard/admin` via client-side nav-state switching
   (`onNavChange`, no URL change), rendering **implementation #2** (`admin/screens/Admin*.tsx`). Those screens
   are *not* mock-only as first assessed — they compose their actual tables/dialogs/drawers from
   **implementation #3** (`features/*/components`), so what a real user sees today is #2+#3 combined: a
   genuinely well-built, full-CRUD UI ("zero hardcoded values" per its own header comment) — but its data
   layer (`features/*/services/*.service.ts`) is entirely in-memory mock, confirmed never calling `apiClient`.
   **Implementation #1** (`admin/{feature}/*List.tsx`, the one partially wired to the real backend via
   `useApi.ts`) lives at nested routes (`/dashboard/admin/students`, etc.) that **nothing in the app links
   to** — confirmed by grepping for those paths outside their own route tree. It's real but orphaned; #2+#3 is
   reachable and polished but fake. Recommendation: keep #2+#3 as the canonical implementation (best
   architecture, matches `16-FOLDER-STRUCTURE.md`, already what users see) and rewire its `services/*.service.ts`
   files to call `apiClient` — using implementation #1's `useApi.ts` hooks as the reference for endpoints that
   are already proven to work — then delete #1 and its orphaned routes. Flagged rather than executed since it
   touches many files; awaiting confirmation.
3. **Paper-generation "fork," investigated — not actually a duplication.** `POST /ai/generate-blueprint`
   (FastAPI, `blueprint_agent.py`) takes a free-text prompt and returns a *proposed distribution* (topics/
   difficulty/counts) — it never selects real `Question` rows. `POST /papers/generate` (NestJS,
   `PapersService.generatePaper`) takes an already-saved `Blueprint` **by id** and deterministically selects
   real approved questions matching its distribution, inside a transaction that creates the `Paper` +
   `PaperVersion`. These are sequential stages of one pipeline (AI *drafts a distribution* → teacher reviews/
   saves it as a `Blueprint` via `POST /blueprints` → NestJS *assembles the paper* from it), not two
   implementations of the same feature — confirmed via the frontend hooks (`useGenerateBlueprintAI` calls the
   prompt endpoint; `useGeneratePaper` separately calls the blueprint-id endpoint) and via `17-THIRD-PARTY-
   INTEGRATIONS.md`'s framing of manual paper assembly as a first-class, always-available fallback: since
   `generatePaper` never calls FastAPI, a manually-authored `Blueprint` (skipping the AI-drafting step
   entirely) flows through the identical `generatePaper` code path. **No decision needed here — this item is
   resolved, not open.** (`03-FEATURE-SPECIFICATIONS.md`'s prose description undersells the split by describing
   it as one "NestJS proxies to FastAPI" flow; the actual code's two-stage shape is correct and matches doc 17's
   intent better than doc 03's summary does — worth a documentation note, not a code change.)
4. **`apps/api/.env`** — verified gitignored/untracked, no action needed.
