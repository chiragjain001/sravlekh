# AIOS / SARVLEKH — PRODUCTION HARDENING PROGRESS LOG

**Started:** October 2026  
**Operating Branch:** `chore/staging-db-migrations`  
**Workspace Manager:** pnpm 10.34.5  

---

## Baseline Observations (Phase 0)
- **Git Working Tree:** Clean. No uncommitted modifications.
- **Node & Dependencies:** Node 20+, pnpm 10.34.5, Prisma 5.17.0.
- **`@aios/api` Typecheck:** PASSED (`tsc --noEmit` exited code 0).
- **Python Service Requirements:** Confirmed missing `pypdfium2` in `apps/api-python/requirements.txt` (imported in `pdf_render.py:16`).

---

## Log of Key Changes & Verification Steps

### Phase 0: Baseline & Tracking Setup
- Created `PRODUCTION_HARDENING_TASKS.md` with granular checklists across all phases.
- Created `PRODUCTION_HARDENING_PROGRESS.md` for persistent execution audit.

### Phase 1: Critical Security & Startup Fixes (P0) - [COMPLETED]
- **Target 1.1 (Google OAuth Linking):** Enforced `email_verified !== false`, normalized email, safe linking for unlinked/placeholder `local_` users, rejected cross-account takeover attempts with 409 Conflict. Verified: 34 tests passing in `auth.service.spec.ts`.
- **Target 1.2 (Student Document IDOR):** In `documents.service.ts:findById`, enforced student profile verification against `document.attempt.studentProfileId`. Verified: 53 tests passing in `documents.service.spec.ts`.
- **Target 1.3 (Python Dependency):** Added `pypdfium2>=0.23.0` to `apps/api-python/requirements.txt`.
- **Target 1.4 (Onboarding Deadlock):** Added transactional provisioning of default `CaptureProvider` (`PHOTO_CAPTURE_SUBJECTIVE`) and `EvaluationPolicy` (`AI_ASSIST_MANDATORY_REVIEW`) to `InstitutesService.create()`. Added idempotent helper `ensureDefaultConfigurations()`. Verified: 10 tests passing in `institutes.service.spec.ts`.
- **Target 1.5 (Debug Log Cleanup):** Removed debug log in `papers.service.ts:44`.

---

## Phase 2: Canonical Database & Exam Workflow Unification - [COMPLETED]
- **Target 2.1 (Schema & Models):** Added `BatchEnrollment`, `CopyCheckerAssignment`, `CopyCheckerStudentAllocation`, `CopyCheckerQuestionAllocation`, `BookletPrintRun`, `Booklet`. Added `shortCode`, `studentCode`, `teacherCode`, `rollNumberSnapshot`, `bookletSerial`. Updated `User.googleSub` to nullable with `@@unique([instituteId, googleSub])`. Generated JS & Python clients.
- **Target 2.2 (Database Migration):** Created and applied migration `20261010160000_canonical_identity_eval_booklet_models` live via `prisma migrate deploy`. All tables, enums, indexes, and foreign keys active.
- **Target 2.3 (Idempotent Backfill):** Created `packages/db/src/backfill-unique-codes.ts` (`pnpm backfill:codes`). Executed live: backfilled 2 institute shortCodes (`AAD`, `ZGIT`), 5 teacherCodes, 101 studentCodes, 101 `BatchEnrollment` records, cleared 1 `local_` placeholder `googleSub`. Verified 100% idempotent on second pass (0 modifications).
- **Target 2.4 (ExamsService Compatibility Bridge):** Updated `ExamsService.createExam()` to transactionally provision canonical `Assessment` + `AssessmentDelivery` linked by `Exam.assessmentDeliveryId`. Verified: 84 tests passing in `exams.service.spec.ts`.

---

### Phase 3: Copy-Checker Assignment & Evaluation Authorization Engine - [COMPLETED]
- **Target 3.1 (Models & Backend):** Created `CopyCheckerAssignmentsService`, controller, and DTOs. Enforced relational integrity for `CopyCheckerAssignment`, `CopyCheckerStudentAllocation`, and `CopyCheckerQuestionAllocation`.
- **Target 3.2 (Authorization Engine):** Enforced deny-by-default evaluator authorization across `CheckedCopyService` and `EvaluationsService`. Blocked whole-sheet finalization when questions are allocated question-wise. Verified: 9/9 tests in `copy-checker-assignments.service.spec.ts` and 17/17 tests in `checked-copy.service.spec.ts`.
- **Target 3.3 (Admin Dashboard UI):** Built `AssignEvaluatorsModal.tsx` following existing Tailwind design system. Integrated into `AdminExams.tsx` for desktop tables and mobile cards.

---

### Phase 4: Printable Booklet Generation & QR Security - [COMPLETED]
- **Target 4.1 (Python Cover Generator):** Created `apps/api-python/src/routers/booklets.py` using `fpdf2` and `qrcode`. Renders A4 covers with fiducial alignment marks, metadata box, 120x120 QR code, student instructions, and OMR roll-number bubble grid (digits 0-9). Uses Latin-1 ASCII safe formatting.
- **Target 4.2 (Cryptographic QR Signing):** Created `BookletSecurityService` (`apps/api/src/booklets/booklet-security.service.ts`). Computes HMAC-SHA256 signatures with canonical formatting `AIOS:V1:{kid}:{inst}:{del}:{num}:{bkl}:{sig}` and verifies using `crypto.timingSafeEqual`. Verified: 6/6 tests passing.
- **Target 4.3 (Print-Run Management & UI):** Created `BookletsService` and `BookletsController` for atomic monotonic print runs, voiding with auditable reasons, and PDF downloads. Built `PrintBookletsModal.tsx` and wired into `AdminExams.tsx`. Verified: 9/9 tests passing in `booklets.service.spec.ts`.

---

### Phase 5: Bulk Scanning, OMR & Identity Resolution - [COMPLETED]
- **Target 5.1 (PDF Page Segmentation):** Created `apps/api-python/src/documents/segment_and_omr.py` with `segment_pdf_pages`. Identifies booklet boundaries via QR codes on cover pages and quarantines coverless segments.
- **Target 5.2 (OMR Bubble Detection):** Implemented `read_omr_roll_grid` using Otsu thresholding and fill density scoring.
- **Target 5.3 (Identity Resolution Engine):** Built `resolveFromQrAndOmr` in `IdentityResolutionService`. Checks booklet validity (detects VOIDED and duplicate SCANNED conflicts), matches candidate in `BatchEnrollment` and `StudentProfile`, auto-resolves attempts if confidence >= 0.95 with `rollNumberSnapshot`, flags CONFLICT on duplicate attempts, and routes lower confidence scans to manual review queue. Wired into `DocumentsService.splitPdfDocument`. Verified: 14/14 tests passing in `identity-resolution.service.spec.ts` and 53/53 tests in `documents.service.spec.ts`.

---

### Phase 6: Reports & Operational Reliability - [COMPLETED]
- **Target 6.1 (Genuine PDF Reports):** Created `apps/api-python/src/routers/reports.py` with `AcademicReportPDF` using `fpdf2`. Upgraded `ReportGenerationProcessor` in `apps/api/src/reports/report-generation.processor.ts` to output genuine `application/pdf` binary bytes starting with `%PDF-` and `.pdf` extension. Verified: 28/28 tests passing in `src/reports/`.
- **Target 6.2 (Honest Notifications):** Verified `NoticeDispatchProcessor` accurately marks unconfigured external notification channels as `status: FAILED, failureReason: 'provider_not_configured'` with zero false positives or fabricated deliveries. Verified: 6/6 tests passing in `notices.service.spec.ts`.

---

### Phase 7: Frontend Polish & Verification - [COMPLETED]
- Built and integrated modals in `AdminExams.tsx` (`AssignEvaluatorsModal.tsx` and `PrintBookletsModal.tsx`) matching design tokens.
- Executed `pnpm --filter @aios/web build` — passed with 100% clean production bundle (9/9 routes compiled).

---

### Phase 8: Integrated Regression & Release Readiness - [COMPLETED]
- Executed `pnpm --filter @aios/api build` (`nest build`) — compiled with 0 errors.
- Executed core regression test suites across the API — over 300 tests passing with 0 failures across auth, documents, booklets, evaluations, identity resolution, reports, exams, and scoring.

---

### Phase 9: Post-Implementation Rigorous Verification - [COMPLETED & VERIFIED]
- **Target 9.1 (Strict OAuth Verification Condition):**
  - Defect Fixed: In Google OIDC token validation, checking `payload.email_verified === false` fails open if the provider omits the claim (`undefined`). Changed to strict `payload.email_verified !== true`. Added regression test. 35/35 tests passing in `auth.service.spec.ts`.
- **Target 9.2 (Zero Dummy Values at Creation Source):**
  - Defect Fixed: `teachers.service.ts` and `students.service.ts` generated placeholder `local_${Date.now()}...` strings. Switched to `googleSub: null`. 45/45 tests passing in `teachers.service.spec.ts` and `students.service.spec.ts`.
- **Target 9.3 (Relational Delivery-Level Allocation Uniqueness):**
  - Defect Fixed: Evaluator allocations were only unique per assignment (`[copyCheckerAssignmentId, studentProfileId]`), which allowed two distinct teachers to claim the same student or question on the same delivery.
  - Added schema constraint `@@unique([assessmentDeliveryId, studentProfileId])` and `@@unique([assessmentDeliveryId, questionId])`.
  - Created & deployed migration `20261010170000_evaluator_allocation_delivery_uniqueness` live to database.
  - Added friendly 400 Bad Request conflict detection in `CopyCheckerAssignmentsService.assign`. 13/13 tests passing in `copy-checker-assignments.service.spec.ts`.
- **Target 9.4 (Python Engine & Computer Vision Pipeline):**
  - Defect Fixed: Missing `fastapi` imports (`APIRouter`, `Depends`, `HTTPException`) in `apps/api-python/src/routers/documents.py`.
  - Created and executed `scratch/verify_python_e2e_pipeline.py`:
    1. Generated 3 unique serialized booklet covers via `BookletPDF` (`fpdf2`).
    2. Decoded and verified HMAC-SHA256 signatures with OpenCV (`cv2.QRCodeDetector`).
    3. Combined 5-page bulk scanner PDF and segmented 3 booklet boundaries via `segment_pdf_pages`.
    4. Decoded 6-digit OMR bubble grid ("104528") with Otsu thresholding at 0.980 confidence via `read_omr_roll_grid`.
    5. Confirmed coverless/damaged pages are safely quarantined into `quarantinedPages` without misattributing students.
    6. Generated genuine vector PDF report card (2,251 bytes).
  - Added `apps/api-python/tests/test_booklets_and_segmentation.py` (5/5 passed).
  - Executed full Python test suite: 323 passed out of 323 tests in 39.46s.
- **Target 9.5 (Comprehensive Regression Testing):**
  - NestJS API Jest Suite: 59 suites passed, 911 tests passed, 0 failures in 316s.
  - NestJS API Build (`nest build`): exit code 0.
  - Next.js Web Build (`next build`): exit code 0.

---

### Phase 10: Final Database Integrity, Cross-Service Verification & Release Sign-Off - [COMPLETED]
- **Target 10.1 (Prisma / PostgreSQL Nullable Uniqueness Reconciliation):**
  - Clarified and verified: `BatchEnrollment.rollNumber` uniqueness is enforced at database level via active-only partial unique index (`WHERE status = 'ACTIVE' AND "rollNumber" IS NOT NULL`), allowing multiple NULLs and preserving historical roll reuse on student completion/transfer.
  - Reconciled `User.googleSub`: In PostgreSQL, `UNIQUE ("instituteId", "googleSub")` permits multiple NULLs while enforcing strict institute-scoped uniqueness for linked accounts. `pnpm --filter db exec prisma validate` passed with 0 errors.
- **Target 10.2 (Legacy Roll-Number Data Protection):**
  - Updated `packages/db/src/backfill-unique-codes.ts` to distinguish blank strings from duplicate rolls. Conflicting roll numbers are never erased to NULL; preserved in `StudentProfile.externalIds` (`legacyDuplicateRollNumber`, `rollConflictBatchId`, `rollConflictPreservedAt`) and audited in `StudentHistory` (`ROLL_NUMBER_CONFLICT`).
- **Target 10.3 (Enrollment & Re-enrollment Lifecycle Rules):**
  - Formalized batch semantics: Batches represent academic-year cohorts. `@@unique([batchId, studentProfileId])` guarantees lifecycle integrity without corrupting past attempts or score snapshots (`rollNumberSnapshot`).
- **Target 10.4 (Skipped Refresh-Token Integration Tests):**
  - Executed `apps/api/src/auth/refresh-token.integration.spec.ts` against real PostgreSQL via `TEST_DATABASE_URL`: **7 passed, 0 skipped, 0 failed** in 30.4s. Verified atomic rotation, race condition serialization, and token family invalidation.
- **Target 10.5 (Custom Permission Template Enforcement & UI Clarity):**
  - Validated dynamic gate in `ExamsService.unlock()` enforcing `exam:unlock` grant with audit logging.
  - Enhanced `PermissionEditorView.tsx` with explicit `Runtime Guard` vs `Role RBAC` badges and contextual security tooltips.
- **Target 10.6 (Complete Cross-Service 11-Step Examination Flow):**
  - Created and executed `scratch/test_cross_service_exam_flow.ts` against real PostgreSQL: Verified all 11 phases (exam creation -> canonical delivery -> evaluator assignment -> booklet generation -> signed QR verification -> tamper rejection -> multi-booklet bundle ingestion -> OMR candidate resolution -> duplicate scan quarantine -> teacher auth check -> final score record persistence).
- **Target 10.7 (OMR Normalization Collisions & Devanagari Redistribution):**
  - Fixed `identity-resolution.service.ts` to reject leading-zero collisions (`"42"` vs `"042"`) and route to `CONFLICT` queue. 15/15 tests passing.
  - Verified Google Noto Sans (`fonts-noto-core`) under SIL Open Font License OFL 1.1 in production container.
- **Final Release Recommendation:** `CONDITIONAL STAGING/PILOT`. Ready for staging deployment and on-site hardware pilot.

---

### Phase 11: Agent 6 — Platform Security, System Reliability & Automated Testing - [COMPLETED & VERIFIED]
- **Target 11.1 (End-to-End Browser Exam Lifecycle Automation):**
  - Path: `tests/e2e/exam-lifecycle.browser.test.js`
  - Command: `pnpm test:e2e` (`node --test tests/e2e/exam-lifecycle.browser.test.js`)
  - Covered all 11 mandatory lifecycle steps: (1) Authenticate faculty account, (2) Validate 50-mark blueprint, (3) Generate anti-cheating Set A/B, (4) Generate serialized printable booklets with HMAC-SHA256 signed QR codes, (5 & 6) Bulk scanner ingestion and Otsu OMR roll resolution at 0.985 confidence, (7) Evaluation Desk review queue resolution of ambiguous roll conflict ("042" vs "42"), (8 & 9) Split-screen workspace AI suggestion acceptance (`Shift+A`) and mandatory teacher verification enforcement, (10) State-machine exam lock gate blocking unevaluated subjective copies (`SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED`), (11) Student portal verification of marks, question breakdowns, diagnostic tags (`CONCEPT_ERROR`), and remedial homework.
  - Result: **PASSED (9/9 tests, 1 suite in 4.04s)**.
- **Target 11.2 (Adversarial Security & Tenant Isolation Suite):**
  - Path: `apps/api/src/security/adversarial-security.spec.ts`
  - Command: `pnpm --filter @aios/api test src/security/adversarial-security.spec.ts`
  - Tested: Cross-tenant document isolation (404 Not Found), student IDOR prevention (403 Forbidden on foreign student attempt), constant-time HMAC-SHA256 signature verification, rejection of tampered delivery/serial metadata, rejection of forged signatures, rejection of malformed QR strings, enforcement of `assertNoUnevaluatedSubjectiveResponses` blocking unverified exam lock, rejection of oversized uploads (>25MB) with `PayloadTooLargeException`, binary magic-byte sniffing rejecting disguised executables (`MZ...`) with `UnprocessableEntityException`, and sanitization of database connection strings in error responses.
  - Result: **PASSED (11/11 tests, 1 suite in 16.04s)**.
- **Target 11.3 (Database Constraints & Relational Integrity):**
  - Path: `tests/integrity/db-constraints-and-concurrency.test.js`
  - Command: `pnpm test:integrity` (`node --test tests/integrity/db-constraints-and-concurrency.test.js`)
  - Tested: (1) Multiple NULL roll numbers permitted in same batch via PostgreSQL partial unique index, (2) Duplicate active roll numbers in same batch rejected with Prisma `P2002`, (3) Identical roll numbers across different batches allowed, (4) Delivery-level evaluator allocation uniqueness enforced on `CopyCheckerStudentAllocation` (`@@unique([assessmentDeliveryId, studentProfileId])`), (5) Attempt `rollNumberSnapshot` remains immutable after enrollment roll changes.
  - Result: **PASSED (5/5 tests, 1 suite in 6.83s)** against live PostgreSQL.
- **Target 11.4 (Workload Profiling & Performance Benchmarks):**
  - Path: `tests/performance/workload-profiler.js`
  - Command: `pnpm profile` (`node tests/performance/workload-profiler.js`)
  - Benchmarks measured empirically:
    - *Database Query Latency* (50 runs over Supabase pooler): Institute list P50 = 138.75ms, P95 = 153.42ms, P99 = 373.87ms; Indexed `BatchEnrollment` lookup P50 = 308.73ms, P95 = 344.77ms, P99 = 379.97ms.
    - *Cryptographic Throughput* (5,000 ops): HMAC-SHA256 Signing = 131,808 signatures/sec; Constant-time Verification = 146,610 verifications/sec (100% verified).
    - *Headless Browser Layout Latency*: 50-row Evaluation Desk DOM render P50 = 10.12ms, P95 = 91.83ms, Avg = 17.82ms.
    - *Memory Footprint*: Net Heap Delta = 0.23 MB, Total RSS = 79.12 MB.
- **Target 11.5 (CI/CD Pipeline Hardening):**
  - Updated `.github/workflows/ci.yml` adding automated `e2e` job executing browser lifecycle and backup verification on every pull request and push.
  - Added `test:e2e`, `test:integrity`, and `profile` commands to root `package.json`.


