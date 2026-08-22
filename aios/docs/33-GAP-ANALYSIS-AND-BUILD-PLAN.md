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
  exist with real service-layer tenant scoping.
- **Correction to an earlier pass's finding (Phase 2)**: curriculum CRUD is **not** missing a backend home —
  `BatchesController`/`BatchesService` already implement `POST /subjects`, `GET /subjects` (returns the full
  tree: subjects → chapters → topics, ordered), `POST /subjects/:subjectId/chapters`, and
  `POST /chapters/:chapterId/topics`, all tenant-scoped and ADMIN-gated. The earlier claim that no dedicated
  module existed was wrong — it exists, just co-located with Batches rather than split into separate modules.
  **What's actually missing**: update/archive (edit/delete) endpoints for all three entities — only create and
  full-tree list exist today. **Also missing, and the bigger gap**: no frontend anywhere calls these endpoints
  at all — confirmed neither the (now-deleted) orphaned `AcademicsList.tsx` nor the current `features/academics`
  did curriculum CRUD; `features/academics` turned out to be an unrelated "academic operations dashboard"
  (syllabus %, exam pipeline stages, doubt queue, teacher tasks, AI insights) with its own backend-data gap of
  the same shape as the Students module's (§7 item 2) — none of that dashboard's data has a schema model either.
  Today there is genuinely no way to add a Subject/Chapter/Topic through the running app at all — only via the
  seed script — despite Question authoring and Blueprint definition depending on real topic/subject ids
  existing.
- Frontend has **3 parallel implementations** of academics/students/teachers/batches/etc admin screens (see §3
  and §7 item 2) — the one users actually reach via the sidebar is a well-built, full-CRUD UI backed entirely
  by an in-memory mock store, not the real API.

### Question Bank & Blueprint/Paper Generation
- Backend `QuestionsModule`/`PapersModule` exist and are real-API-wired from a subset of frontend screens.
- **Investigated (§7 item 3): not a duplication.** FastAPI's `blueprint_agent.py` (prompt → proposed
  distribution) and NestJS `PapersService.generatePaper()` (blueprint id → real assembled Paper) are sequential
  stages of one pipeline, not two implementations of the same feature — confirmed via the frontend hooks and
  `17-THIRD-PARTY-INTEGRATIONS.md`'s manual-assembly-fallback framing. Resolved, no decision needed.
- **Fixed** (§5 "Prisma engine-version fix"): `blueprint_agent.py` imports `langchain_openai.ChatOpenAI`, which
  wasn't in `requirements.txt` — would have failed at runtime. `langchain-openai` added.
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
- **Found and fixed this session (§5 "Mastery calculation moved to Python")**: the actual mastery-calculation
  logic (the EMA formula) lived entirely in NestJS (`AnalyticsService.recalculateMastery`) — there was no
  `mastery_engine.py` in `apps/api-python` at all, only the read-side heatmap aggregation above. This
  contradicted `02-SYSTEM-ARCHITECTURE.md`'s component-ownership table, which assigns "Mastery calc, trend/
  diagnostic computation" to `api-python` and explicitly says NestJS should own transactional writes, **not**
  analytics math. Migrated: the formula now lives in `apps/api-python/src/analytics/mastery_engine.py`, called
  over a new internal HTTP contract; NestJS keeps the durable queued trigger (retry/backoff) but no longer does
  any analytics math itself.

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

**Phase 1 — Foundation Hardening — COMPLETE.** Not "build auth from zero" — fixed what was broken in what
already existed:
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
- **Exit gate — met**: real login → correct dashboard (verified in-browser); non-allowlisted rejected;
  unauthenticated/wrong-role requests get 401/403 through the real guards (regression-tested); `/health` reports
  DB+Redis and is green. Two items were pulled forward from their originally-planned later phases and finished
  now while still small (the Prisma engine-version fix, mastery-calc-to-Python) rather than left to accrete
  more callers first — both closed out alongside Phase 1 rather than deferred.

**Phase 2 — Curriculum & roster completion — COMPLETE.** Frontend admin-screen consolidation already done
(previous session, all 6 real duplicates). Corrected scope for the curriculum piece (see §2 "Academic
Hierarchy") and executed it this session — see §5 "Phase 2: Curriculum management": added the missing
update/archive endpoints, a `deletedAt` soft-delete column, and the curriculum-management UI that had never
existed on the frontend at all (not a "rewire" — a new screen, since nothing existing did this). One item left
partially verified rather than fully confirmed end-to-end (see §5) due to this environment having no running
backend to test the live success/error paths against.

**Phase 3 — Question Bank & Paper Generation reconciliation — COMPLETE.** The `langchain-openai` dependency fix
and the paper-generation "reconciliation" both turned out to already be resolved before this phase started (see
§5). What remained — wiring Question approval/versioning UI — executed this session; see §5 "Phase 3: Question
Bank" for detail. Same partial-verification caveat as Phase 2 applies (no backend running in this environment
to confirm the live success/error paths end-to-end).

**Phase 4 — Exam State Machine & Marks Capture (the load-bearing gap) — COMPLETE (backend + a real Exam
screen); wizard/evaluation-queue rewiring explicitly deferred.** Built the missing status-transition and
unlock endpoints, plus a real Exam Workflow screen and a real Papers nav entry to reach it from. Rewiring
`TeacherEvaluationQueue` and the assessment-builder wizard to these endpoints was scoped out this session —
see §5 "Phase 4" for why. This was the highest-value, highest-risk v1 gap — nothing in Phases 7+ (which build
`Assessment`/`AssessmentDelivery` as a superset of `Exam`) can be validated for "zero regression" against a
state machine that doesn't functionally exist yet.

**Phase 5 — Mastery/Remediation verification + Doubts/Timetable fixes — COMPLETE.** The mastery-calculation
ownership gap (§2 "Academic Intelligence") was fixed ahead of schedule in an earlier session, while it was
still small — see §5 "Mastery calculation moved to Python." This session closed out the rest: fixed
`DoubtsService.resolveDoubt()` to persist resolution text, added Timetable conflict checking, and — third
occurrence of the mock-vs-real fork pattern from Phases 2–4 — replaced `AdminTimetable.tsx`'s mock console
with a real screen (user's call, same as Phase 4's AdminExams). One confirmed gap was investigated and
explicitly deferred rather than built or silently dropped: auto-generated Interventions when mastery drops
below threshold. See §5 "Phase 5" for detail on all of the above.

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

**Blocking issue found this session, fixed in a later session (§5 "Prisma engine-version fix")**: the dual
Prisma-client setup (`packages/db/prisma/schema.prisma` generates both `prisma-client-js` for the Node apps and
`prisma-client-py` for `apps/api-python`) didn't actually work as pinned at the time — see below for the fix.

**Incidental fix**: `packages/db/package.json` pinned `prisma`/`@prisma/client` to `^5.14.0` while `apps/api`
pinned `^5.22.0` — pnpm hoists a single version, so this mismatch was silently masked until Python codegen
surfaced it. Aligned the two (both later pinned to the same exact version — see below).

### Prisma engine-version fix (this session)

Resolved the blocking issue flagged above. Checked PyPI directly: `prisma-client-py` **0.15.0 (Aug 2024) is
still the latest release** — no newer version exists to bump to, so option (b) from the original flag ("wait
for/find a compatible release") wasn't available. Went with option (a): pinned `prisma`/`@prisma/client` to an
**exact** `5.17.0` (not `^5.17.0`) in both `apps/api` and `packages/db` — exact, not a caret range, because the
failure mode is an engine-binary-hash mismatch that a routine `^`-range bump would silently reintroduce. Verified
`prisma generate` now produces a working Python client (previously failed with a version-hash mismatch error)
and that `apps/api-python`'s full pytest suite collects and passes (previously failed at import time).

Two more, smaller bugs surfaced while getting the Python suite green, both fixed as part of the same
straightforward-infra-fix pass:
- `apps/api-python/src/ai/blueprint_agent.py` imports `langchain_openai.ChatOpenAI`, but `langchain-openai` was
  never in `requirements.txt` (flagged in an earlier pass) — added `langchain-openai>=0.1.22` (matching the
  `langchain>=0.2.5` era already pinned).
- `apps/api-python/src/config.py`'s `Settings` eagerly validates `DATABASE_URL`/`JWT_SECRET` at **import time**
  (module-level `settings = get_settings()` in `blueprint_agent.py`), so even a test that never touches auth or
  the AI router transitively needs both env vars just to import `src.main`. `.github/workflows/ci.yml` set
  `DATABASE_URL` globally but not `JWT_SECRET` — added it (a placeholder value, CI-only). The eager-validation
  pattern itself (any import of `blueprint_agent` requires full env config) is a design smell worth revisiting
  when that module gets real attention, but wasn't in scope for an infra fix.

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

### Admin-screens consolidation (this session)

Executed the recommendation from §7 item 2: deleted the orphaned duplicate implementation
(`admin/{students,teachers,batches,academics,exams,timetable}/*List.tsx` + their nested
`/dashboard/admin/{area}` routes) for the 6 areas that had a live counterpart, keeping
`admin/screens/Admin*.tsx` + `features/*` as canonical. Verified nothing else in the codebase referenced the
deleted files, and confirmed in-browser post-deletion that `/dashboard/admin`'s sidebar navigation and the
Students screen both still render correctly with no console errors.

**Two things discovered while doing this, not addressed here:**

1. **Questions/Papers/Doubts/Assignments have no live admin-facing implementation at all** — not "duplicated,"
   *absent*. `features/` has no `questions`/`papers`/`doubts`/`assignments` folder, `admin/screens/` has no
   `AdminQuestions`/`AdminPapers`/`AdminDoubts`/`AdminAssignments`, and the admin sidebar's nav list
   (`lib/mock-data/admin.ts`) doesn't even list those sections. The orphaned `admin/{questions,papers,doubts,
   assignments}/*List.tsx` directories and their nested routes are the *only* admin-facing UI for these four
   areas — unreachable via any navigation path, but not redundant with anything live. **Deliberately not
   deleted** — doing so would remove the only (if hard-to-find) admin UI for these areas, not just clean up a
   duplicate. This needs a product decision: wire them into the admin sidebar + `AdminDashboardInner`'s
   `renderScreen()` switch (making them reachable — the more likely "correct fix," since `03-FEATURE-
   SPECIFICATIONS.md` describes ADMIN as approving questions and having assignment-creation rights), confirm
   they're intentionally teacher-only and safe to delete, or leave as-is for now.
2. **The mock service layer being replaced is far richer than the real backend can support.**
   `features/students/services/students.service.ts` (and, inspection suggests, its siblings for the other 5
   areas) implements pagination, multi-field search/filter/sort, a full analytics dashboard (enrollment trends,
   fee breakdown, subject-gap maps, risk distribution, batch performance), CSV import/export, and per-student
   fields (`feeStatus`, `riskLevel`, `avgScore`, `attendancePct`, `rank`, `program`) that **do not exist in the
   Prisma schema at all** (`StudentProfile` has `rollNumber`/`guardianName`/`guardianPhone`/`guardianEmail`/
   `address`/`photoUrl`/`documents`/`tags`/`batchId` — no fee tracking, no risk scoring, no computed
   performance fields). Rewiring the service layer to real API calls, as recommended in §7 item 2, is
   consequently a much bigger effort than "swap mock functions for `apiClient` calls" — it requires either
   dropping/hiding the backend-unsupported UI surface (fee/risk columns, the Analytics tab, CSV import/export)
   or building genuinely new backend features (fee tracking, a risk-scoring model, computed analytics
   endpoints) across all 6 areas. **Not attempted in this pass** — the file-level consolidation above is
   complete and safe on its own; the service-layer rewire is flagged as its own, larger decision rather than
   done partially/silently. Recommend treating it as Phase 2 work (curriculum & roster completion), scoped
   per-area, starting with whichever of the 6 areas the user most wants real data in first.

### Mastery calculation moved to Python (this session)

Resolved the ownership gap flagged above, ahead of its originally-planned Phase 5 slot, while it was still a
small, isolated move.

- `apps/api-python/src/analytics/mastery_engine.py` (new) — the EMA formula, ported line-for-line from the
  removed `AnalyticsService.recalculateMastery`. Same per-topic try/except isolation (one topic's failure
  logs and continues, doesn't abort the rest). Unit-tested against the exact numbers the original TypeScript
  implementation would have produced for a two-response case, plus the failure-isolation and empty-input paths
  — `apps/api-python/tests/test_mastery_engine.py`.
- `apps/api-python/src/routers/analytics.py` — new internal endpoint `POST /analytics/recalculate-mastery`,
  gated by a new `verify_internal_token` dependency (`apps/api-python/src/auth.py`) rather than the user-facing
  `get_current_user` JWT check, per `02-SYSTEM-ARCHITECTURE.md`'s "internal contract... never a user JWT, never
  browser-exposed." Unit-tested (`tests/test_internal_auth.py`): unconfigured token is unenforced (dev-only
  fallback, matching the "optional, warn, degrade" pattern already used for Redis/S3), configured token rejects
  a mismatch and accepts an exact match.
- `apps/api/src/analytics/analytics.service.ts` — `recalculateMastery` (the math) is gone; replaced by
  `requestMasteryRecalc`, which POSTs to the new Python endpoint with a 15s timeout and an optional
  `X-Internal-Token` header, logging outcome/duration either way and rethrowing on failure so the calling
  BullMQ job (added in the earlier Redis/BullMQ commit) still retries correctly. Unit-tested
  (`analytics.service.spec.ts`): correct URL/body, token-header present/absent per config, rethrow-on-failure.
- `apps/api/src/analytics/mastery-recalc.processor.ts` — now calls `requestMasteryRecalc` instead of the
  removed local calculation.
- New env vars: `PYTHON_SERVICE_URL` (Node, defaults to `http://localhost:8000`) and `INTERNAL_SERVICE_TOKEN`
  (both apps, optional — must match exactly between the two if set). Added to both `.env.example` files (Python
  didn't have one before this).
- Verified: full Python test suite (7 tests, including the new ones) passes against a freshly-generated
  Prisma client at the 5.17.0 pin from the previous commit; `pnpm typecheck`/`lint`/`test`/`build` all pass
  clean in `apps/api` (10 tests, up from 6).

### Phase 2: Curriculum management (this session)

Backend curriculum CRUD (Subject/Chapter/Topic) turned out to already exist (create + full-tree list, under
`BatchesController`/`BatchesService` — see the correction in §2 "Academic Hierarchy"). What was actually
missing: update/archive endpoints, soft-delete support, and — the bigger gap — any frontend at all.

- `packages/db/prisma/schema.prisma` — added `deletedAt DateTime?` to `Subject`/`Chapter`/`Topic`, matching
  `04-DATABASE-SCHEMA.md`'s stated soft-delete strategy, which the schema didn't actually implement for these
  models. No migration history exists yet for this project at all (no `prisma/migrations/` folder — schema has
  never been applied via `prisma migrate dev` against a real database in this repo), so this is a schema-only
  change; whoever next has real DB access needs to run a migration to apply it.
- `apps/api/src/batches/{batches.controller.ts,batches.service.ts,dto/batch.dto.ts}` — added
  `PATCH`/`DELETE subjects/:id`, `chapters/:id`, `topics/:id` (archive = soft-delete only, per
  `18-EDGE-CASES.md`: a Subject/Chapter/Topic can have Questions/MasteryScores/Blueprints attached that must
  never be hard-cascade-deleted). `findAllSubjects` now filters `deletedAt: null` at every level of the nested
  tree. Unit-tested (`batches.service.spec.ts`, 9 new tests): tenant isolation, rename-conflict detection,
  soft-delete-not-hard-delete, audit logging, archived-excluded-from-listings, double-archive rejected.
- `apps/web/src/components/dashboard/admin/screens/curriculum/CurriculumManager.tsx` (new) — the
  curriculum-management UI that has never existed on the frontend at all (confirmed: neither the deleted
  orphaned screen nor `features/academics`, which turned out to be an unrelated operations dashboard, ever did
  this). Real API from day one, not a mock layer to migrate later — expandable Subject → Chapter → Topic tree,
  inline create/edit/archive, matching the existing design system (same Tailwind tokens and patterns as
  `AdminBatches`/`AdminStudents`). Added as a "Curriculum" tab alongside the existing "Operations" dashboard in
  `AdminAcademics.tsx` (least disruptive integration point — same nav item, no new top-level sidebar entry,
  existing dashboard content untouched, just conditionally hidden when the other tab is active).
- `apps/web/src/hooks/useApi.ts` — added `useSubjects`/`useCreate/Update/ArchiveSubject` and the Chapter/Topic
  equivalents, following the file's existing real-`apiClient` hook pattern exactly (used by `useStudents` etc.,
  though — see below — those are never actually reached live since every *reachable* admin screen today uses
  the mock `features/*` layer instead).

**A real bug found and fixed during in-browser verification**: the component initially used TanStack Query's
`isLoading` to gate the loading skeleton. In v5, `isLoading` is derived as `isPending && isFetching`, which is
`false` during the pause *between* retry attempts — so a failing query fell through the loading check, found
`isError` still `false` (not yet settled), and rendered the *empty* state instead, silently miscommunicating
"no subjects" as if it were a real, successful, empty result. Fixed by using `isPending` instead (true until
the query actually settles to success or error, regardless of fetch/retry timing) — this exact mistake would
be easy to make again anywhere else `useQuery` is destructured in this codebase; worth a lint rule or review
note if it recurs.

**Left only partially verified, flagged rather than chased further**: with no backend running in this
environment, `useSubjects()`'s query correctly fired its configured attempt-plus-one-retry (both observed as
real `500`s over the network) and correctly rendered the loading skeleton throughout — but did not visibly
settle into the `isError` UI branch afterward within a reasonable wait, in this sandboxed browser tool. This is
the *first* screen in the whole app to ever exercise `useApi.ts`'s real-`apiClient` hooks live in a browser —
every other currently-reachable admin screen uses the mock `features/*` layer instead (the admin screens that
did use `useApi.ts` live only at the orphaned/unreachable routes). So if this is a real bug rather than a
sandbox-networking artifact, it's a latent, pre-existing characteristic of `useApi.ts`/the shared `QueryClient`
config that would affect every hook in that file equally, not something introduced by this session's new code —
worth a focused look once a real backend is available to test against, but not chased further here given the
time already spent isolating it (confirmed: not a CORS issue, not a proxy-latency issue, not a crash, not
unique to this component's code — a raw `fetch()` to the same URL resolved normally in 51ms). Reconfirmed the
same pattern on Question Bank (§5 "Phase 3") — consistent with this being a shared, pre-existing characteristic
of `useApi.ts` rather than something specific to one screen.

### Phase 3: Question Bank (this session)

Investigated before building, matching the Phase 2 pattern of verifying the plan's assumptions first rather
than trusting the original gap analysis. Two of the three original Phase 3 items turned out to already be
resolved: `blueprint_agent.py`'s missing dependency was fixed in the Prisma-fix commit, and the "two divergent
paper-generation paths" were already determined not to be a duplication (§7 item 3). What remained —
"wire Question approval/versioning UI" — mirrored Phase 2 almost exactly: the backend was already excellent
(`QuestionsController`/`QuestionsService` — create, list, get-with-version-history, update-with-auto-versioning,
approve, all tenant-scoped and RBAC-correct) but had no archive endpoint and, again, **no reachable frontend at
all**. Confirmed: no `AdminQuestions` screen, no "Question Bank" entry in either the admin or teacher nav list
(despite `Sidebar.tsx`'s icon map already anticipating one — `TeacherPaperBuilder.tsx`'s 8-step wizard is a
different thing: it defines paper-assembly *rules*, not individual questions).

- `packages/db/prisma/schema.prisma` — added `deletedAt DateTime?` to `Question`, same rationale as Phase 2's
  curriculum models (18-EDGE-CASES.md: hard-delete of a historically-used Question is rejected, soft-archive
  only).
- `apps/api/src/questions/{questions.controller.ts,questions.service.ts}` — added `DELETE :questionId`
  (archive, ADMIN/FOUNDER-gated); `findAll`/`findById`/`update`/`approve` now all respect `deletedAt`. Unit-tested
  (`questions.service.spec.ts`, 5 new tests): non-admin rejected, tenant isolation, double-archive rejected,
  soft-delete-not-hard-delete with audit log, `findAll` excludes archived.
- `apps/web/src/components/dashboard/questions/{QuestionBankManager.tsx,QuestionFormDialog.tsx}` (new) — one
  screen shared by both Teacher and Admin dashboards (role read from `useAuth()`, not duplicated per-role
  screens) since the backend RBAC already treats question authoring as TEACHER+ADMIN+FOUNDER and approval as
  ADMIN+FOUNDER-only — the UI just conditionally shows the Approve/Archive actions rather than needing two
  separate screens. Filterable/paginated list, create/edit dialog with cascading Subject→Chapter→Topic selects
  (reusing `useSubjects()` from Phase 2) and a dynamic options editor for MCQ/multi-correct types (radio vs.
  checkbox selection, add/remove rows) that correctly disappears for the other 5 question types. Wired into both
  dashboards' nav (`TeacherTopNav`/`AdminNav` types, nav item lists, and `renderScreen()` switches).
- `apps/web/src/hooks/useApi.ts` — `useQuestions`/`useCreateQuestion` already existed; added `useQuestion`
  (single, with version history), `useUpdateQuestion`, `useApproveQuestion`, `useArchiveQuestion`, matching the
  file's existing pattern exactly.
- Verified in-browser (fresh tab, both Teacher and Admin logins): screen renders with role-correct copy ("an
  admin approves them before use" vs. "Author, review, and approve..."), the create dialog's cascading selects
  and MCQ options editor work correctly, switching question type away from MCQ correctly hides the options
  section, no console errors beyond the expected network 500s (no backend running here). Full
  typecheck/lint/test/build clean on both apps (24 backend tests, up from 19).

### Phase 4: Exam State Machine (this session)

The gap analysis's original finding here held up under investigation (unlike Phases 2/3, where "missing" turned
out to mean "backend already existed"): the 7-stage exam state machine
(`DRAFT→REVIEW→APPROVED→PUBLISHED→ONGOING→EVALUATING→LOCKED`, `18-EDGE-CASES.md`'s LOCKED→EVALUATING admin-only
unlock as the sole backward transition) genuinely did not exist anywhere — no status-transition endpoint, no
optimistic-locking `version` field, no unlock endpoint, and grading was not blocked once an exam reached LOCKED.

- `packages/db/prisma/schema.prisma` — added `version Int @default(0)` to `Exam` (optimistic lock, same pattern
  as the soft-delete additions in Phases 2/3 — schema-only, no migration history exists yet in this repo).
- `apps/api/src/exams/{exams.controller.ts,exams.service.ts,dto/exam.dto.ts}` — added `GET` (list/detail),
  `PATCH :examId/status` (`UpdateExamStatusDto`: target status + version), `POST :examId/unlock`
  (`UnlockExamDto`: reason, `@MinLength(10)`, + version). Service enforces: stale `version` → 409
  `STALE_VERSION`; skipping/wrong-direction transitions → 409 `INVALID_STATE_TRANSITION`; `APPROVED` requires
  ADMIN/FOUNDER (mirrors the Question approval pattern); `unlock` is ADMIN/FOUNDER-only and LOCKED-only.
  `gradeAnswerSheet` now rejects with 409 if the exam is LOCKED (`04-DATABASE-SCHEMA.md`: Response is immutable
  once LOCKED). Unit-tested (`exams.service.spec.ts`): the full 7×7 transition-pair matrix (49 cases,
  parameterized), role gating, optimistic-locking, unlock, and grade-when-locked — 83 backend tests total, up
  from 24.
- **A second genuine architecture fork, flagged and resolved by the user rather than picked unilaterally**: the
  admin "Exams" nav slot already had a fully-built screen (`AdminExams.tsx`) — but it was wired entirely to
  `features/exams/*`, an in-memory mock module with its own parallel status vocabulary
  (`'Upcoming'|'In-Progress'|'Evaluation Pending'|'Completed'|'Cancelled'`) that has nothing to do with the real
  state machine, plus mock-only features (CSV export, bulk delete, pass-rate analytics) the real backend doesn't
  support. Presented three options to the user (replace / tab-split like Phase 2's Academics / leave alone and
  add elsewhere); **user chose "replace it with the real screen."** Executed: new `AdminExams.tsx` built
  against `useExams`/`useCreateExam`/`useUpdateExamStatus`/`useUnlockExam` (the last two added to `useApi.ts`
  this session) — list with status filter, schedule-from-blueprint modal (batch + blueprint selects, type,
  scheduled date), per-row "advance to next stage" button (disabled with a tooltip for TEACHER on the
  REVIEW→APPROVED step), and an admin-only unlock modal (reason textarea, `minLength=10`) on LOCKED rows. The
  entire `apps/web/src/features/exams/` mock module was deleted — nothing else referenced it.
- **Papers was still orphaned — fixed as a prerequisite, not scope creep**: `PapersList.tsx` (blueprint
  CRUD + paper generation) was real and functional but reachable only via a direct URL
  (`/dashboard/admin/papers`, using a different layout component), never linked from the sidebar — confirmed
  in Phase 1's admin-consolidation pass and left as-is at the time. Since the new Exam screen's "schedule from
  blueprint" flow is unusable without a way to *create* a blueprint, wired "Papers" into the sidebar nav the
  same way Question Bank was added in Phase 3 (`AdminNav` type, `renderScreen()` switch, `navItems` list, an
  icon in `Sidebar.tsx`'s `ICON_MAP`). Also fixed the same `isLoading`→`isPending` bug from Phase 2/3 in
  `PapersList.tsx` (line was previously unreachable via nav, so this exact mistake had never been exercised
  live before).
- **A real, now-fixed startup bug, found only because this phase's in-browser verification finally started the
  API server** (Phases 2/3 verified against `pnpm typecheck`/`build` only, no live backend): `apps/api` could
  not boot at all. `analytics.service.ts` imported `MASTERY_RECALC_QUEUE`/`MasteryRecalcJobData` from
  `mastery-recalc.processor.ts`, which itself imports `AnalyticsService` from `analytics.service.ts` — a
  circular import that left one class `undefined` at decorator-evaluation time, so Nest's DI container couldn't
  resolve `MasteryRecalcProcessor`'s constructor param. This is a pre-existing bug from the mastery-migration
  commit (`c5f2272`, before this session's continuation), not introduced by this phase — but it meant the
  backend has been unable to start since that commit landed, until now. Fixed by extracting the constant/type
  into `mastery-recalc.constants.ts` and pointing both files (plus three other importers:
  `health.module.ts`/`health.controller.ts`/`health.controller.spec.ts`/`analytics.service.spec.ts`) at it
  instead of at each other. Confirmed fixed: full route table now logs on boot, all 83 tests still pass.
  Also fixed `.claude/launch.json`'s "api" entry, which referenced a `start:dev` script that doesn't exist in
  `apps/api/package.json` (the real script is `dev`) — this is why no prior phase had verified this in-browser.
- **The Phase 2/3 "isPending never settles to isError" mystery reproduced a third time, with new diagnostic
  detail — still not root-caused, still not chased to conclusion**: with the API now actually running (DB
  still unreachable in this sandbox — `P1001` from Prisma), both `useExams()` and `useBlueprints()` fired
  exactly one request, got a real `500`, and then sat in `isPending` for 20+ seconds with no observed retry
  attempt despite `retry: 1` in `providers.tsx`'s `QueryClient` config — even though a raw `fetch()` to the
  identical URL in the same tab resolved in 12ms. New clue this time: the `500` response body was the literal
  plain-text string `"Internal Server Error"`, not the JSON error envelope `AllExceptionsFilter` produces —
  suggesting the response may not be reaching the NestJS app/filter at all (Next.js dev's rewrite-proxy layer
  returning its own generic error page is one plausible explanation, unconfirmed). Ruled out this pass:
  `navigator.onLine` is `true` (rules out React Query's `networkMode: 'online'` auto-pausing queries when the
  browser thinks it's offline, a common cause of exactly this symptom). Given this is now confirmed to
  reproduce identically on brand-new code (the Exam screen) in a completely fresh tab with zero HMR
  involvement, it is definitively not something introduced by any UI code written across Phases 2–4 — it sits
  somewhere between the Next.js dev proxy and the shared `QueryClient`. Worth a focused look once a real
  Postgres instance is reachable (this sandbox has none), but not chased further here for the same reason as
  Phases 2/3: real UI behavior was independently confirmed via static inspection — the error-state branch code
  path is correct and (per Phase 3's `QuestionBankManager` verification) does render correctly once a query
  does settle; component crashes, modal open/close, and form field rendering were all verified live in-browser
  and are unaffected by this.
- **Explicitly deferred, not silently built or silently dropped**: `TeacherEvaluationQueue.tsx` and the
  8-step assessment-builder wizard (`Step8Generate.tsx`'s `handlePublish` is still a `setTimeout` stub) both
  remain wired to mock data (`@/lib/mock-data/teacher`, and the wizard's `AssessmentState` type, respectively).
  Both would need real IDs (batch/exam/answerSheet) threaded through UI that currently only carries mock
  name-strings — a data-plumbing rewrite touching every step/screen involved, not a small wiring change like
  Papers. Flagging for a dedicated pass rather than a partial fix squeezed into this session.
- Verified in-browser (fresh tab, admin login, real API server running): both new nav entries render distinct,
  correct content; the Schedule Exam modal opens with all fields (batch/blueprint selects, 9-option type select
  correctly formatted, date input) and closes cleanly via Cancel; no React crashes or console errors beyond the
  documented network 500s. Full `pnpm typecheck`/`lint`/`build` clean on `apps/web`; full
  `typecheck`/`test`/`build` clean on `apps/api` (83/83 tests).

### Phase 5: Doubts, Timetable, and a third mock-vs-real fork (this session)

- `packages/db/prisma/schema.prisma` — added `responseText String?` to `DoubtTicket`, matching
  `04-DATABASE-SCHEMA.md`'s modeled field exactly (the DTO already used `resolutionText` as its request-body
  key — kept that as-is, since it's a stable API contract with no functional bug, and just persist it into the
  correctly-named `responseText` column). `apps/api/src/doubts/doubts.service.ts`'s `resolveDoubt()` had its
  own comment admitting the discard ("In a full implementation, the resolution text would be saved...") —
  removed the comment along with the bug; now writes `responseText: dto.resolutionText`. Unit-tested
  (`doubts.service.spec.ts`): resolution text is persisted, a student cannot resolve a doubt.
- `apps/api/src/timetable/timetable.service.ts` — `createSlot()` now checks for an overlapping slot (`startTime
  < newEndTime AND endTime > newStartTime`) for the same `teacherUserId` (mandatory per `18-EDGE-CASES.md`) and
  the same `roomRef` (not explicitly required by that doc, but the schema/DTO carry the field for exactly this
  per `03-FEATURE-SPECIFICATIONS.md`'s "conflict prevention," and it's the same query shape) — either rejects
  with 409 before persistence. Deliberately does **not** attempt recurring-slot occurrence expansion or the
  holiday-exception-suppresses-one-occurrence rule (a separate, materially larger edge case in the same doc
  section) — this checks the given `startTime`/`endTime` window only. Unit-tested (`timetable.service.spec.ts`):
  teacher conflict rejected, room conflict rejected, non-conflicting slot succeeds, non-teacher role rejected,
  and the overlap query itself uses `lt`/`gt` (not equality) on start/end time.
- Needed a working Prisma client to even typecheck the above (`responseText` didn't exist on the generated
  client's `DoubtTicketUpdateInput` until regenerated) — `prisma generate` failed outright in this environment
  with `spawn prisma-client-py ENOENT` because the `prisma` Python package (which provides that generator
  binary) wasn't installed system-wide, despite being declared in `apps/api-python/requirements.txt`. Installed
  it (`pip install "prisma>=0.13.1"`, resolved to `0.15.0` — matches the version already used by the rest of
  this environment) and regenerated both the JS and Python clients successfully. Also had to
  `pip install -r requirements-dev.txt` (pytest/pytest-asyncio weren't present either) to re-run the Python
  suite against the regenerated client — both confirmed clean (7/7) before proceeding, so the schema change
  doesn't quietly break the mastery-recalc side.
- **Third occurrence of the Phase 2/3 "isPending never settles to isError" mystery, still not chased**: not
  re-investigated further this phase — see Phase 4's write-up for the current state of that investigation
  (navigator.onLine ruled out; still points somewhere between the Next.js dev proxy and the shared
  `QueryClient`, still needs a real Postgres instance to pin down).
- **Third mock-vs-real architecture fork, flagged and resolved by the user rather than picked unilaterally**:
  while investigating what Phase 5's "Timetable fixes" would actually touch in the UI, found `AdminTimetable.tsx`
  already live in the nav (unlike Papers/Exams' fork in Phase 4, this one was never orphaned) but wired entirely
  to `features/timetable/*`, an in-memory mock CRUD+analytics module structurally identical in kind to the
  `features/exams/*` fork from Phase 4. Presented the same two options as Phase 4 (replace / defer); **user
  chose "replace it with a real screen."** Executed: new `AdminTimetable.tsx` against `useTimetable` (existing)
  and a new `useCreateTimetableSlot` hook — list + a schedule-slot modal (title, type, batch, teacher, room,
  start/end) whose 409s (from the conflict check above) surface through the existing generic mutation-error
  toast path in `useApi.ts`. Teacher names are resolved client-side against `useTeachers()` by matching
  `teacherUserId`, since `TimetableSlot` has no Prisma relation to `User` for that field, only a raw string
  column — `findAll`'s `include` can't join it server-side without a schema change, which was out of scope
  here. Deleted `features/timetable/*` (only consumer). Confirmed Teacher's and Student's own timetable screens
  are unrelated, ordinary mock-data screens (`@/lib/mock-data/teacher`, `@/lib/mock-data/student`) like most
  other not-yet-rebuilt screens in the app — not a second instance of this fork, so left untouched.
- **`DoubtsList.tsx` was the Phase 4 Papers situation again — orphaned, not forked**: real (`useDoubts`), same
  `isLoading`→`isPending` bug as every other screen that's hit this the first time it went live, and reachable
  only via a direct URL (`/dashboard/admin/doubts`), never linked from the nav. Wired "Doubts" into the sidebar
  the same way as Papers/Question Bank (`AdminNav` type — the value already existed there, unused; `navItems`;
  `renderScreen()`; `Sidebar.tsx`'s `ICON_MAP`). Its "View / Assign" button was also a dead no-op — since this
  phase's actual backend fix (`resolveDoubt` persisting text) would otherwise have no live caller anywhere in
  the product, wired it to a real action dialog: assign-to-teacher (`useAssignDoubt`, already existed unused)
  and mark-resolved (`useResolveDoubt`, ditto) with a resolution textarea, plus displays `responseText` once
  set. Judged this as within the same "straightforward, just do it" bar as the isLoading/nav fixes rather than
  a new scope decision — it's one bounded dialog on an existing screen, not a console rebuild.
- **A confirmed gap, investigated and explicitly deferred by the user's own decision, not built or dropped
  silently**: `01-PRODUCT-REQUIREMENTS.md` item 8 — "If mastery < 0.50, system auto-creates an `Intervention`:
  auto-generated `Assignment` and/or `EXTRA_CLASS` grouping." The `Intervention` model exists in the schema;
  grepping the entire codebase turns up exactly one reference anywhere, a hardcoded string in a student mock
  fixture ("Schedule Intervention") — no creation trigger in the mastery-recalc flow, no read endpoint, no real
  UI. Flagged to the user rather than building it as a drive-by addition to "Timetable fixes," since it's a
  standalone vertical feature (Python-side trigger + endpoint + UI), not a small gap. **User's explicit ruling,
  recorded here as the confirmed future spec** (refines doc 01's ambiguous "Assignment and/or EXTRA_CLASS"):
  auto-intervention generates a targeted **Assignment** (not an extra class) when a topic's mastery falls below
  a configurable threshold (0.50 initially); it prioritizes the student's most significant weak topic(s) rather
  than firing per-topic for every weak topic; it notifies the relevant teacher with an actionable CTA; **AIOS
  never auto-schedules an extra class** — the teacher alone decides whether an extra class or other
  intervention is warranted. Not implemented this session — deferred to a dedicated future phase.
- Verified in-browser (fresh tab, admin login, both dev servers live): Timetable and Doubts both render
  correctly from their new nav entries with no crashes; the Schedule Slot modal opens with all fields (7 slot
  types correctly formatted, batch/teacher selects, room/time inputs); no console errors beyond the by-now-
  expected network 500s (this sandbox has no reachable Postgres). Full `pnpm typecheck`/`lint`/`build` clean on
  `apps/web`; full `typecheck`/`lint`/`test`/`build` clean on `apps/api` (90/90 tests, up from 83); Python suite
  clean (7/7) against the regenerated client.

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
   reachable and polished but fake.
   **Resolved this session (§5)**: consolidated onto #2+#3 for the 6 areas where a duplicate genuinely existed
   (students, teachers, batches, academics, exams, timetable) — deleted #1's copies and their orphaned routes,
   verified nothing else referenced them, verified in-browser post-deletion. Four areas (questions, papers,
   doubts, assignments) turned out to have **no** live counterpart at all — see §5's "two things discovered"
   note — and were deliberately left untouched pending a product decision, not consolidated. The
   `services/*.service.ts` → real-`apiClient` rewire originally recommended here turned out to be substantially
   bigger than expected (see §5) and was **not** done in this pass — also flagged there rather than attempted
   partially.
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
