# 20 — Implementation Plan
## AIOS — Academic Intelligence Operating System

**Merged Status:** This file now includes both the original v1 baseline (Part 1) and the v2 extensions (Part 2) as a single current source of truth.
This plan breaks delivery into vertical phases. **Do not attempt to build the entire system in one pass** — each phase produces a working, testable increment.

---

## Execution Protocol (for any coding agent working from this doc package)
```
STEP 1   Read AGENTS.md (repo root — engineering rules, mirrors 15-CODING-STANDARDS.md §13).
STEP 2   Read all documents in /docs (this package), in Hierarchy-of-Truth order (01 §13).
STEP 3   Identify contradictions or missing requirements; report them — do not silently resolve.
STEP 4   Confirm/refine the implementation plan (this document) against current repo state.
STEP 5   Create or verify the project skeleton per 16-FOLDER-STRUCTURE.md.
STEP 6   Implement one vertical feature at a time (never a full-phase big-bang commit).
STEP 7   For each feature: requirement → database → API → business logic → UI → tests → docs update.
STEP 8   Run: typecheck, lint, unit tests, integration tests, build (per 14-DEPLOYMENT-ARCHITECTURE.md §5).
STEP 9   Fix failures — do not proceed with a red pipeline.
STEP 10  Review security (07), performance (11), and edge cases (18) for the feature just built.
STEP 11  Only then mark the feature complete against 19-ACCEPTANCE-CRITERIA.md.
```

---

## Phase 1 — Foundation
**Goal:** a working monorepo skeleton with auth and tenancy — nothing academic yet.
- Repository scaffold per 16-FOLDER-STRUCTURE.md (pnpm workspaces, all 3 apps + 3 packages).
- `packages/db/prisma/schema.prisma`: `Institute`, `Branch`, `AllowListEntry`, `User` models only.
- NestJS: Auth module (Google OAuth verification, JWT issuance, AllowList gate), `RolesGuard`, `TenantScopeGuard`.
- Next.js: login page, role-based dashboard shell (empty screens, routing only).
- CI/CD pipeline stood up (lint, typecheck, test, build gates per 14-DEPLOYMENT-ARCHITECTURE.md §5).
- Base error envelope + global exception filter (08-ERROR-HANDLING.md).
- `/health` endpoints on NestJS and FastAPI (FastAPI stood up as an empty shell service at this stage).
- **Exit criteria:** a user can log in via mock/dev OAuth, land on an empty role-correct dashboard, and be rejected if not allowlisted. Auth E2E test (13-TESTING-STRATEGY.md §6, workflow #1 partial) passes.

## Phase 2 — Core Domain
**Goal:** users, curriculum, and org structure — the nouns everything else depends on.
- Models: `StudentProfile`, `TeacherProfile`, `StudentHistory`, `Batch`, `BatchTeacher`, `Subject`, `Chapter`, `Topic`.
- NestJS modules: `users`, `academics`.
- Admin screens: AdminAcademics, AdminStudents, AdminTeachers, AdminBatches (basic CRUD UI).
- Caching layer stood up for the academic-hierarchy tree (09-CACHING-STRATEGY.md §1.1).
- **Exit criteria:** Admin can fully set up an institute's curriculum and roster end-to-end; workflow #1 (13-TESTING-STRATEGY.md §6) passes in full.

## Phase 3 — Question Bank, Blueprint & Exam System
**Goal:** the paper-generation and exam-lifecycle core — the product's primary differentiator begins here.
- Models: `Question`, `QuestionVersion`, `Blueprint`, `Paper`, `PaperVersion`, `PaperItem`, `Exam`.
- NestJS modules: `questions` (authoring + approval), `papers` (blueprint + manual assembly + variant generation).
- FastAPI stood up for real: `ai/blueprint_agent.py` — AI Blueprint Generation endpoint.
- Exam state machine implemented with full transition-matrix test coverage (13-TESTING-STRATEGY.md §2).
- Teacher screens: TeacherPaperBuilder, TeacherTestsExams.
- Admin screens: AdminExams (schedule, transitions, lock overrides).
- **Exit criteria:** workflows #2 and #3 (13-TESTING-STRATEGY.md §6) pass; a teacher can go from blank blueprint to a locked, printable anti-cheating exam paper set.

## Phase 4 — Marks Capture, Evaluation & Academic Intelligence
**Goal:** close the diagnostic loop — this is the heart of AIOS's value proposition.
- Models: `AnswerSheet`, `Response`, `ScoreRecord`, `MasteryScore`, `Intervention`, `Assignment`.
- NestJS: multi-mode capture endpoints (`MANUAL_GRID`, `CSV_IMPORT`, `PHOTO_CAPTURE`, `OMR_IMPORT`), mistake-tagging, async job triggers to FastAPI.
- FastAPI: `analytics/mastery_engine.py`, `analytics/diagnostic_engine.py` — mastery calculation + intervention generation.
- Job queue infrastructure stood up (BullMQ/Redis) per 10-SCALABILITY-STRATEGY.md §6.
- Teacher screens: TeacherEvaluationQueue, TeacherAnalytics, TeacherRemedialExtraClass, TeacherAssignments.
- Student screens: StudentTests, StudentPerformance, StudentWeakTopics, StudentStudyPlan, StudentAssignments.
- **Exit criteria:** workflows #4, #5, #6 (13-TESTING-STRATEGY.md §6) pass end-to-end, including the async mastery→intervention→assignment chain, verified within its documented latency targets (11-PERFORMANCE-REQUIREMENTS.md §2).

## Phase 5 — Communication, Scheduling & Reporting
**Goal:** the operational layer that keeps the loop humming day-to-day.
- Models: `TimetableSlot`, `DoubtTicket`, `Notice`, `NoticeDelivery`, `Report`.
- NestJS: `timetable`, `doubts`, `notices`, `reports` modules; third-party integrations wired per 17-THIRD-PARTY-INTEGRATIONS.md (Email/SMS/WhatsApp, object storage for report files).
- Teacher/Student/Admin screens: TeacherDoubtCenter, TeacherTimeTable, StudentDoubtCenter, StudentTimetable, StudentExtraClasses, AdminTimetable, AdminCommunication, AdminReports, StudentResources, StudentLeaderboard.
- **Exit criteria:** workflows #8, #9, #10 (13-TESTING-STRATEGY.md §6) pass.

## Phase 6 — Governance, Founder Console & Production Hardening
**Goal:** the platform-operator layer plus everything needed to run this safely at scale.
- Model: `AuditLog` (audit writer wired retroactively into all prior phases' sensitive mutations — the model itself and interceptor are built here, but every module from Phase 1 onward gets an audit-logging pass in this phase to close coverage gaps).
- Founder module + screens: FounderOverview, FounderInstitutes, FounderSubscriptions, FounderUsers, FounderAnalytics, FounderFeatureManagement, FounderHealth, FounderIntegrations, FounderTickets, FounderAuditLogs, FounderSettings.
- Admin screens: AdminAuditLogs, AdminSystemSettings, AdminOverview, AdminAttendance.
- Production hardening pass:
  - Rate limiting finalized across all endpoints (07-SECURITY-SPECIFICATION.md §7).
  - Full caching strategy implemented (09-CACHING-STRATEGY.md).
  - Load testing executed against 10-SCALABILITY-STRATEGY.md targets.
  - Monitoring/alerting fully wired (12-LOGGING-MONITORING.md).
  - Security test suite run in full (13-TESTING-STRATEGY.md §7).
  - Row-Level Security evaluation (07-SECURITY-SPECIFICATION.md §16, defense-in-depth decision made and documented, whether adopted or deferred).
- **Exit criteria:** workflow #7 passes; full E2E suite green; load tests meet targets; security test suite green; production deployment checklist (14-DEPLOYMENT-ARCHITECTURE.md §11) satisfied.

---

## Post-Phase-6 (Phase 2/3 of Product Roadmap — see Vision doc §5)
Not part of this implementation plan's scope, tracked separately once Phase 1–6 above ship:
- Generative AI question synthesis from PDF scans.
- Automated handwritten-OCR answer sheet evaluation.
- Parent WhatsApp diagnostic bot (beyond basic notice dispatch already in Phase 5).
- Predictive competitive-exam rank estimation.
- AI voice/video doubt-resolution tutor.

---

## Definition of Done (Global — Applies to Every Phase/Feature)
```
A feature is NOT complete until:
[ ] Requirement implemented
[ ] API implemented
[ ] Validation implemented
[ ] Authorization implemented (role + tenant + batch scope)
[ ] Error handling implemented
[ ] Loading/empty/error/success UI implemented
[ ] Database migration added
[ ] Tests added (unit + integration + contract; E2E if a core workflow)
[ ] Logging added where required
[ ] Documentation updated
[ ] TypeScript/mypy passes
[ ] ESLint/ruff passes
[ ] Unit tests pass
[ ] Integration tests pass
[ ] Build passes
[ ] No secrets exposed
[ ] No unnecessary dependencies added
[ ] Performance considered
[ ] Edge cases (18-EDGE-CASES.md) handled
```
This is identical to the checklist in 19-ACCEPTANCE-CRITERIA.md's global gate — repeated here because it is the phase-exit gate, not just the feature-exit gate: **no phase above is considered complete while any of its features fail this checklist.**

## Hierarchy of Truth (Reference)
When any two documents in this package conflict during implementation, resolve in this order and **report the conflict rather than silently choosing**:
1. `07-SECURITY-SPECIFICATION.md`
2. `01-PRODUCT-REQUIREMENTS.md`
3. `02-SYSTEM-ARCHITECTURE.md`
4. `05-API-SPECIFICATION.md`
5. `04-DATABASE-SCHEMA.md`
6. `15-CODING-STANDARDS.md`
7. UI/UX specifications (03-FEATURE-SPECIFICATIONS.md + Product Vision doc)
8. This implementation plan


---



---

# PART 2 — V2 EXTENSIONS (merged from 20-IMPLEMENTATION-PLAN.md (V2 section))

## AIOS — Academic Intelligence Operating System

---

## Execution Protocol (extends v1, unchanged in spirit)
Same 11-step protocol as `20-IMPLEMENTATION-PLAN.md` v1, with one addition to Step 3:
```
STEP 3   Identify contradictions or missing requirements; report them — do not silently
         resolve. For v2 work specifically: verify the v1 compatibility layer (22 §6,
         04-DATABASE-SCHEMA.md (V2 section) §3.3) is not broken by any change before proceeding.
```

---

## Phase 7 — Domain Refactor (Architecture Reset)
**Goal:** introduce the v2 domain model without breaking any existing v1 functionality.
- Add all 23 new Prisma models (`04-DATABASE-SCHEMA.md` (V2 section)) as an additive migration — no v1 table is dropped in this phase.
- Run the `Response` field-migration script (`04-DATABASE-SCHEMA.md` (V2 section) §3.1) against a staging copy first; verify row-count parity before any `DROP COLUMN`.
- Implement the `Exam`/`AnswerSheet` compatibility views (`22` §6, `04-DATABASE-SCHEMA.md` (V2 section) §3.3).
- Full v1 regression suite (`13-TESTING-STRATEGY.md` v1) run against the refactored schema — **zero regressions is the exit gate**, not a target.
- **Exit criteria:** Every v1 E2E workflow (`13` §6, workflows #1–10) passes unchanged against the new schema, through the compatibility layer, with no visible behavior difference to an existing coaching-institute tenant.

## Phase 8 — Assessment Engine
**Goal:** stand up `Assessment`/`AssessmentDelivery`/`Attempt`/`Response` as first-class, directly-usable entities (not just compatibility-layer internals).
- NestJS modules: `assessments`, `attempts` (`02-SYSTEM-ARCHITECTURE.md` (V2 section) §3).
- New endpoints: `POST /assessments`, `POST /assessments/:id/deliveries`, `POST /attempts` (`05-API-SPECIFICATION.md` (V2 section) §2/§4).
- `CaptureProvider` registry implemented, with `OMR`/`MANUAL_GRID`/`CSV_IMPORT`/`PHOTO_CAPTURE_OBJECTIVE` providers wrapping v1 logic unchanged (`29` §3).
- **Exit criteria:** A coaching-institute-style delivery can be created via the new native endpoints (not just the `/exams` alias) with identical results.

## Phase 9 — Rubric Engine
**Goal:** enable rubric authoring before evaluation depends on it.
- Models: `Rubric`, `RubricVersion`, `RubricCriterion` (already migrated in Phase 7, now wired to endpoints).
- NestJS module: `rubrics`.
- Endpoints: `POST /questions/:id/rubric`, `PATCH /rubrics/:id` (`05-API-SPECIFICATION.md` (V2 section) §7).
- Teacher UI: rubric authoring screen (extends Question authoring, `03` v1 Question Bank Engine screens).
- **Exit criteria:** A teacher can attach a criterion-additive rubric to a subjective question, with server-side marks reconciliation enforced.

## Phase 10 — Document Processing Pipeline
**Goal:** the scan-to-region pipeline, without evaluation yet.
- NestJS module: `documents`. FastAPI: none yet (pure image/layout processing can run in NestJS-orchestrated workers initially, or a lightweight Python worker — implementation detail decided at build time, doesn't require the full AI Evaluator service to exist first).
- Models wired: `DocumentBundle`, `Document`, `Page`, `PageImage`, `PageRegion`, `ProcessingJob`, `ProcessingArtifact`, `Annotation`.
- Module: `identity-resolution` — `IdentityResolution` workflow, conservative auto-accept threshold (`30` §4).
- New queues: `document-processing` (all sub-stages except OCR).
- Teacher UI: `TeacherDocumentQueue` (`28` §3).
- **Exit criteria:** A batch of scanned booklets can be uploaded, identity-resolved (with mandatory manual confirmation below threshold), and question-mapped, producing `Response(evidenceType=PAGE_REGION)` rows with linked `QuestionRegion`s — no evaluation yet, just clean structured evidence.

## Phase 11 — OCR / Handwriting Recognition
**Goal:** extract text/math from mapped regions.
- FastAPI service: `ocr/` (`02-SYSTEM-ARCHITECTURE.md` (V2 section) §4).
- Models wired: `OCRBlock`, `OCRResult`.
- New queue: `ocr`.
- Endpoint: `POST /ocr/extract` (internal), surfaced via `GET /documents/:id` region detail.
- Confidence-threshold routing implemented (`24` §5).
- **Exit criteria:** Every `PAGE_REGION`-type Response has an associated OCR transcript (or an explicit `illegible_handwriting` flag), always paired with the source image in any read API/UI.

## Phase 12 — Evaluation Engine (Manual-Only First)
**Goal:** get versioned human evaluation working *before* introducing AI scoring — de-risks the highest-value, highest-trust part of the system by proving it manually first.
- NestJS module: `evaluations`.
- Models wired: `Evaluation`, `EvaluationVersion`, `EvaluationCriterionScore`.
- Endpoints: `POST /evaluations/:responseId/decide`, `GET /evaluations/:responseId/history`, `GET /evaluation-work-items` (`05-API-SPECIFICATION.md` (V2 section) §8).
- Teacher UI: `TeacherDigitalCopyEvaluator`, `TeacherEvaluationWorkQueue` (`28` §2/§4) — manual-scoring mode only, no AI suggestion panel yet.
- `ScoreRecord` aggregation updated to read from `Evaluation.currentEvaluationVersionId` (`25` §5).
- **Exit criteria:** A full school-theory-exam delivery can go from scanned booklets to finalized, versioned, human-graded scores, with complete evaluation history, entirely without AI involvement.

## Phase 13 — AI Evaluation
**Goal:** add the AI first-pass layer on top of the now-proven manual evaluation engine.
- FastAPI service: `evaluation/ai_evaluator.py` (`27`).
- Models wired: `AIRecommendation`.
- New queue: `ai-evaluation`.
- Endpoint: `POST /evaluation/ai-evaluate(-batch)` (internal), `POST /evaluations/:responseId/reprocess` (`05-API-SPECIFICATION.md` (V2 section) §8/§10).
- **Governance gate implemented and tested first**, before UI exposure: `stakesLevel=GRADED` deliveries (any `assessmentKind`) cannot reach `LOCKED` with unevaluated subjective responses (`32` §2, `05-API-SPECIFICATION.md` (V2 section) §11 `SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED`, corrected trigger condition per fix #3).
- Teacher UI updated: AI suggestion panel added to `TeacherDigitalCopyEvaluator` (`28` §2).
- **Exit criteria:** AI recommendations appear in the evaluation queue, teachers can accept/adjust/reject, full AI→Teacher version chain is correct and queryable, and the governance gate is verified un-bypassable by an explicit adversarial test.

## Phase 14 — Reviewer Layer & Evaluation Quality Analytics
**Goal:** moderation, disputes, and institute-level oversight.
- Role/Permission/Scope model implemented (`21` §4.10) — `REVIEW_EVALUATION` permission introduced.
- Endpoint: `POST /evaluations/:responseId/override` (`05-API-SPECIFICATION.md` (V2 section) §8).
- UI: `ReviewerEvaluationConsole` (`28` §6).
- Dispute/reissue workflow: `Report.supersedesReportId` extension (`31` §4).
- `AdminEvaluationQualityDashboard` + `GET /analytics/evaluation-quality` (`31` §3, `05-API-SPECIFICATION.md` (V2 section) §9).
- **Exit criteria:** A disputed score can be reviewed, overridden with a documented reason, correctly recomputes `ScoreRecord`, and correctly reissues an updated Report while preserving the original.

## Phase 15 — Enterprise Hardening for v2
**Goal:** production-readiness pass mirroring v1 Phase 6, extended to the new domains.
- Load testing: document-processing and AI-evaluation queues under a realistic exam-week burst (extends `10-SCALABILITY-STRATEGY.md` v1 targets — see v1-extension addendum, the relevant V2 section of that document).
- Security test suite extended: identity-resolution conflict fuzzing, rubric-marks-mismatch fuzzing, evaluation-permission-boundary tests (extends `13-TESTING-STRATEGY.md` v1 §7).
- Monitoring/alerting extended for new queues and pipeline dead-letter states (extends `12-LOGGING-MONITORING.md` v1 §7).
- AI Governance Policy compliance audit: automated test suite specifically asserting the §2 hard gate cannot be bypassed under any tested condition, including race conditions (concurrent lock attempts).
- **Exit criteria:** Full v1 + v2 E2E suite green; v2-specific load/security tests pass; governance gate audit passes; production deployment checklist (`14-DEPLOYMENT-ARCHITECTURE.md` v1 §11) satisfied for the v2 feature set.

---

## Sequencing Rationale (Why This Order)
- **Rubric before Evaluation Engine** (Phase 9 before 12): per your explicit correction — evaluation granularity depends on knowing whether scoring is question-level, criterion-level, or step-level.
- **Document Processing before OCR** (Phase 10 before 11): region-mapping must exist before there's anything to run OCR against.
- **Manual Evaluation before AI Evaluation** (Phase 12 before 13): proves the versioning/governance/UX model works correctly with a trusted human-only baseline before introducing AI, and gives Phase 13 a working system to layer onto and compare against for AI-teacher agreement analytics from day one.
- **Reviewer layer after AI** (Phase 14 after 13): reviewer override analytics (§`31` §3) are only meaningful once both teacher and AI evaluation history exist to compare against.
- **Domain Refactor is its own phase** (Phase 7), isolated from all feature work, specifically so the highest-risk step (migrating `Response` data, introducing 23 new tables) is validated for zero-regression in isolation before any new feature logic is built on top of it.

## Definition of Done (unchanged from v1 `20` §"Definition of Done", extended)
All v1 DoD items apply identically. Add:
```
[ ] For any change touching Response/Evaluation: verified that no code path mutates
    a Response's evidence or an EvaluationVersion in place — append-only discipline
    checked in code review, not just tested.
[ ] For any change touching AssessmentDelivery state transitions where the parent
    Assessment.stakesLevel=GRADED (any assessmentKind): governance gate (32 §2,
    corrected trigger per fix #3) explicitly tested.
[ ] For any new AI-facing endpoint: confidence/flag handling tested per the
    routing table in 24 §5 / 27 §5.
```

## Hierarchy of Truth (v2, extends v1 `20` §"Hierarchy of Truth")
1. `07-SECURITY-SPECIFICATION.md`
2. `32-AI-GOVERNANCE-POLICY.md`
3. `01-PRODUCT-REQUIREMENTS.md` (V2 section)
4. `21-DOMAIN-MODEL-V2.md`, `02-SYSTEM-ARCHITECTURE.md` (V2 section)
5. `05-API-SPECIFICATION.md` (V2 section)
6. `04-DATABASE-SCHEMA.md` (V2 section)
7. `15-CODING-STANDARDS.md` (v1, unchanged)
8. UI/UX specifications (`03` v1, `28`)
9. This implementation plan
