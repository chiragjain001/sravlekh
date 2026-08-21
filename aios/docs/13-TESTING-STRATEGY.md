# 13 — Testing Strategy
## AIOS — Academic Intelligence Operating System

## 1. Test Pyramid & Coverage Goals
| Layer | Coverage Goal |
|---|---|
| Critical business logic (exam state machine, mastery calculation, RBAC/tenant guards, marks capture) | **> 90%** |
| Overall codebase (NestJS `apps/api`, FastAPI `apps/api-python`) | **> 80%** |
| Frontend (`apps/web`) components/hooks | > 70%, with 100% on shared form-validation and auth-guard logic |

## 2. Unit Tests
**Scope:** pure functions and isolated service methods, no DB/network.
- Mastery formula calculation (`M = marks awarded / marks available`) across edge cases: zero attempts, single attempt, tie-breaking trend delta.
- Exam state machine transition validator: all 7×7 state-pair combinations, asserting only the documented forward path + the single LOCKED→EVALUATING backward path succeed.
- DTO validation rules for each of the 7 Question types.
- Error-envelope mapping functions (Prisma error code → API error code, per 08-ERROR-HANDLING.md).
- Blueprint marks-reconciliation validator.

## 3. Integration Tests
**Scope:** service + real (test) database, no HTTP layer.
- `AllowListEntry` → login upsert flow, including role-sync-on-relogin behavior.
- Tenant-scope guard: attempt cross-institute resource access, assert rejection at the service layer, not just the controller layer.
- Marks capture write path: assert `AnswerSheet`+`Response` persisted transactionally, and that the async mastery-trigger is enqueued (using a test queue double) without blocking the transaction commit.
- Audit log atomicity: assert that an UNLOCK operation and its AuditLog row commit/rollback together (simulate a failure mid-transaction and assert neither row exists).
- Cache invalidation: assert academic-hierarchy cache is invalidated on Topic create.

## 4. API (Contract) Tests
**Scope:** full HTTP request/response against a running NestJS instance + test DB.
- Every endpoint documented in 05-API-SPECIFICATION.md has at least: one happy-path test, one auth-failure test (wrong role), one tenant-isolation test (cross-institute attempt), one validation-failure test.
- Idempotency-key behavior: replaying the same key returns the cached prior response, not a duplicate side effect.
- Pagination boundary tests (page beyond available data, `pageSize` cap enforcement).
- OpenAPI contract drift check: generated `openapi.yaml` is diffed against the committed version in CI (05-API-SPECIFICATION.md §18).

## 5. Component Tests (Frontend)
- Dashboard screen components render correctly across the 4 required states: loading / empty / error / success (per 08-ERROR-HANDLING.md §11).
- Role-based navigation renders only the screens permitted for the logged-in role (06-AUTH-AUTHORIZATION.md matrix), verified per role.
- Paper Builder Studio: variant-set generation UI correctly displays `warnings[]` from a partial-success AI generation response.
- Evaluation Queue: mistake-tagging UI correctly blocks/warns (per documented UX, not hard blocks) on untagged incorrect responses.

## 6. End-to-End (E2E) Tests
**Required core workflows (mirrors the product's closed loop):**
1. Admin onboards institute → adds AllowListEntry → Teacher logs in via mock/dev OAuth → Teacher creates Subject/Chapter/Topic.
2. Teacher authors Question → Admin approves → Teacher builds Blueprint → generates AI paper → generates Set A/Set B variants.
3. Admin schedules Exam → transitions DRAFT→REVIEW→APPROVED→PUBLISHED→ONGOING.
4. Teacher captures marks via MANUAL_GRID → tags mistakes → exam transitions EVALUATING→LOCKED.
5. System (async) computes MasteryScore → creates Intervention for a student below 0.50 → auto-generates Assignment.
6. Student logs in → views weak topics → views auto-generated Assignment → submits it.
7. Admin unlocks a LOCKED exam with a reason → verifies AuditLog entry exists → re-locks.
8. Student raises a Doubt Ticket → Teacher responds → ticket closes.
9. Admin broadcasts a Notice across all 4 channels → verifies per-recipient delivery status.
10. Admin generates a Report Card → downloads via signed URL.

## 7. Security Tests
- Automated tenant-isolation fuzzing: for a sample of endpoints, attempt access using a valid JWT for Institute A against Institute B's resource IDs — must always fail with `403 TENANT_MISMATCH`.
- RBAC matrix test: for every endpoint × every role combination not marked allowed in 06-AUTH-AUTHORIZATION.md's matrix, assert `403`.
- Injection tests: attempt SQL/NoSQL/XSS payloads in every text-input field (question content, notice body, doubt ticket text); assert safe storage/rendering.
- Rate-limit tests: confirm `/auth/login` throttles at the documented thresholds.
- File-upload validation tests: reject oversized/wrong-type/malformed CSV, OMR, and image uploads per 07-SECURITY-SPECIFICATION.md §9.
- AuditLog immutability test: attempt UPDATE/DELETE against `audit_logs` using the application's DB role; assert DB-level rejection (not just application-level).

## 8. Load Tests
- Simulate peak evaluation-week traffic (10-SCALABILITY-STRATEGY.md targets): 100 concurrent MANUAL_GRID/CSV grading submissions/second sustained for 10 minutes; assert p95 write latency stays < 300ms and no data loss/duplication occurs.
- Simulate term-start Blueprint-generation burst: 20 concurrent `POST /papers/generate-ai` calls; assert FastAPI queue does not starve and no request exceeds the 15s hard timeout without a clean `504`.
- Simulate result-announcement-day report generation burst: 500 concurrent `POST /reports` requests; assert queue absorbs load without exceeding job dead-letter thresholds.

## 9. Regression Tests
- Every closed bug ships with a regression test reproducing the original failure before the fix, added to the relevant suite (unit/integration/E2E per bug type).
- Full regression suite runs on every PR to `main`/`develop` (see 14-DEPLOYMENT-ARCHITECTURE.md CI pipeline); E2E suite runs on every merge to `main` and nightly on `develop`.

## 10. Test Data & Environments
- Tests run against an isolated, ephemeral test database per CI run (migrated fresh, seeded with deterministic fixtures), never against staging/production data.
- Fixture factories exist for every core entity (`Institute`, `User`, `StudentProfile`, `Question`, `Exam`, etc.) to keep test setup declarative and DRY.
- E2E tests run against a full staging-equivalent stack (all 3 apps + test DB + test Redis), using the mock/dev OAuth login path (06-AUTH-AUTHORIZATION.md §1) rather than real Google accounts.

## 11. Definition of "Tested" for a Feature
A feature is not considered test-complete until it has: unit tests for its core logic, an integration test for its DB interaction, an API contract test for each of its endpoints (happy path + at least one auth/validation failure), and — if it's part of a core workflow (§6) — coverage in the E2E suite. See 19-ACCEPTANCE-CRITERIA.md and the Definition of Done in 20-IMPLEMENTATION-PLAN.md.


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add to Unit Tests (v1 §2): rubric marks-reconciliation validator; `EvaluationVersion` chain-integrity validator (no orphaned/cyclic `previousVersionId` references); confidence-threshold routing logic (`24` §5, `27` §5).

Add to Integration Tests (v1 §3): document-pipeline stage transitions with simulated failures at each stage; identity-resolution conflict detection; `ScoreRecord` recomputation correctness after a multi-hop `EvaluationVersion` chain (AI→Teacher→Reviewer).

Add to Security Tests (v1 §7): governance-gate bypass attempts (concurrent lock + evaluation-decide race, per Phase 15 (20-IMPLEMENTATION-PLAN.md V2 section)); cross-tenant document/page-image access attempts via guessed signed-URL patterns; `REVIEW_EVALUATION` permission-boundary fuzzing (an ADMIN without explicit grant must never succeed at `POST /evaluations/:id/override`).

Add new required E2E workflow (extends v1 §6's numbered list, becomes workflow #11): *Admin uploads a scanned booklet batch → identity resolution (one auto, one manual-confirmed) → question regions confirmed → OCR completes → AI evaluation runs → Teacher reviews and adjusts one AI suggestion, accepts another as-is → Delivery attempts to LOCK with one response still unevaluated (must be blocked, `SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED`) → remaining response evaluated → LOCK succeeds → Student views their finalized, criterion-level result → Reviewer overrides one score post-lock via unlock-with-reason → Report re-issued as a correction, original retained.*

