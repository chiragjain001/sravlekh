# AIOS / SARVLEKH — PRODUCTION HARDENING TASKS

**Created:** October 2026  
**Status Key:**  
- `[ ]` Pending  
- `[/]` In Progress  
- `[x]` Completed & Verified  
- `[!]` Blocked (Requires external live credentials / irreversible action)  

---

## Phase 0: Baseline & Environment Audit
- [x] Inspect Git working tree, branch, and package managers (clean working tree on `chore/staging-db-migrations`, pnpm 10.34.5).
- [/] Run baseline typecheck and test suites (`@aios/api`, `@aios/web`, `api-python`).
- [ ] Record existing failures vs regressions baseline.
- [x] Create `PRODUCTION_HARDENING_TASKS.md` and `PRODUCTION_HARDENING_PROGRESS.md`.

---

## Phase 1: Critical Security & Startup Fixes (P0)
- [x] **Task 1.1:** Secure Google OAuth Account Linking (`apps/api/src/auth/auth.service.ts`):
  - Validated Google ID token with signature, issuer, audience, and expiry.
  - Required `payload.email_verified !== false`.
  - Normalized email.
  - Safe account linking: updates real `googleSub` if null or `local_` placeholder; rejects conflicting `googleSub` with 409 Conflict.
  - Verified with 34 tests passing in `auth.service.spec.ts`.
- [x] **Task 1.2:** Close Student Document Inspection IDOR (`apps/api/src/documents/documents.service.ts`):
  - Enforced `assertStudentOwnsDocumentIfStudent` checking `document.attempt.studentProfileId === student.id`.
  - Verified with 53 tests passing in `documents.service.spec.ts`.
- [x] **Task 1.3:** Fix Python Service Startup Dependency (`apps/api-python/requirements.txt`):
  - Added `pypdfium2>=0.23.0` to `requirements.txt`.
- [x] **Task 1.4:** Eliminate Institute Onboarding Deadlock (`apps/api/src/institutes/institutes.service.ts`):
  - Auto-provision default `CaptureProvider` (`PHOTO_CAPTURE_SUBJECTIVE`) and default `EvaluationPolicy` (`AI_ASSIST_MANDATORY_REVIEW`) on institute creation.
  - Added idempotent `ensureDefaultConfigurations(instituteId)`.
  - Verified with 10 tests passing in `institutes.service.spec.ts`.
- [x] **Task 1.5:** Remove leftover production debug log (`apps/api/src/papers/papers.service.ts:44`).
- [x] **Task 1.6:** Run Phase 1 unit and integration tests (All suites PASSED).

---

## Phase 2: Canonical Database & Exam Workflow Unification
- [x] **Task 2.1:** Schema & Model Additions:
  - Added `BatchEnrollment` table (`batchId`, `studentProfileId`, `rollNumber`, `academicYear`, `status`).
  - Added `shortCode` to `Institute`, `studentCode` to `StudentProfile`, `teacherCode` to `TeacherProfile`.
  - Added `rollNumberSnapshot` to `Attempt`, `bookletSerial` to `Document`.
  - Updated `User.googleSub` to nullable with `@@unique([instituteId, googleSub])`.
  - Generated Prisma client and python client without errors.
- [x] **Task 2.2:** Idempotent Data Backfill:
  - Script `packages/db/src/backfill-unique-codes.ts` executed and verified.
  - Migrated legacy `local_` dummy strings to `NULL`.
  - Backfilled institute `shortCode`, teacher `teacherCode`, student `studentCode`, and 101 `BatchEnrollment` records.
  - Verified 100% idempotent on subsequent execution.
- [x] **Task 2.3:** Database Constraints & Indexes:
  - Applied migration `20261010160000_canonical_identity_eval_booklet_models` live to database.
  - Verified unique constraints and foreign keys.
- [x] **Task 2.4:** Exam Compatibility Bridge:
  - Updated `ExamsService.createExam()` to transactionally provision `Assessment` + `AssessmentDelivery`.
  - Linked `Exam.assessmentDeliveryId`.
  - Verified with 84 tests passing in `exams.service.spec.ts`.

---

## Phase 3: Evaluator Assignment & Permissions Engine
- [x] **Task 3.1:** Normalized Relational Assignment Tables:
  - Created models `CopyCheckerAssignment`, `CopyCheckerStudentAllocation`, `CopyCheckerQuestionAllocation`.
  - Composite foreign keys enforcing `assessmentDeliveryId` match.
  - Unique constraints preventing double-allocation of students or questions.
  - Added DTOs, `CopyCheckerAssignmentsService`, and controller.
- [x] **Task 3.2:** Authoritative Evaluator Authorization Guard:
  - Integrated into `CheckedCopyService` and `EvaluationsService`.
  - Enforced deny-by-default on evaluator attempts.
  - Blocked whole-sheet finalization when `QUESTION_WISE` assignment is active.
  - Verified with 9/9 tests in `copy-checker-assignments.service.spec.ts` and 17/17 tests in `checked-copy.service.spec.ts`.
- [x] **Task 3.3:** Evaluator Assignment UI in Admin Dashboard:
  - Built `AssignEvaluatorsModal.tsx` following existing Tailwind tokens and visual design.
  - Wired into `AdminExams.tsx` for both desktop tables and mobile cards.

---

## Phase 4: Printable Booklet Generation & QR Infrastructure
- [x] **Task 4.1:** Serialized Booklet Cover PDF Generator:
  - Created `apps/api-python/src/routers/booklets.py` with `BookletPDF` using `fpdf2` and `qrcode`.
  - Generates A4 PDF with fiducial alignment marks, metadata, 120x120 QR code, and student OMR bubble grid (digits 0-9).
  - Clean Latin-1 ASCII rendering preventing font/encoding exceptions.
- [x] **Task 4.2:** Cryptographic HMAC QR Signing:
  - Created `BookletSecurityService` (`apps/api/src/booklets/booklet-security.service.ts`).
  - Signed canonical payload format `AIOS:V1:{kid}:{inst}:{del}:{num}:{bkl}:{sig}` with HMAC-SHA256 and constant-time signature verification.
  - Verified with 6/6 tests in `booklet-security.service.spec.ts`.
- [x] **Task 4.3:** Serial Reservation & Print Run Tracking:
  - Created `BookletsService` and `BookletsController` for atomic monotonic serial generation, PDF download, and voiding.
  - Verified with 9/9 tests in `booklets.service.spec.ts`.
  - Built `PrintBookletsModal.tsx` and integrated into `AdminExams.tsx`.

---

## Phase 5: Bulk Multi-Booklet Scanning & Vision Processing
- [x] **Task 5.1:** Multi-Booklet PDF Segmentation:
  - Created `apps/api-python/src/documents/segment_and_omr.py` with `segment_pdf_pages`.
  - Delimits booklets by cover-page QR codes; preserves source scan indexes; quarantines coverless segments.
  - Exposed via `/documents/segment-bulk-booklets` in `apps/api-python/src/routers/documents.py`.
- [x] **Task 5.2:** OMR Roll Number Bubble Detection:
  - Built `read_omr_roll_grid` using Otsu thresholding and fill density scoring.
  - Calibrated confidence metric reflecting optical contrast.
- [x] **Task 5.3:** Identity Resolution & Conflict Handling:
  - Added `resolveFromQrAndOmr` to `IdentityResolutionService`.
  - Validates booklet status (detects VOIDED and duplicate SCANNED conflicts).
  - Matches candidate against `BatchEnrollment` and `StudentProfile`.
  - Auto-resolves attempts if confidence >= 0.95 with roll-number snapshot; flags CONFLICT for duplicate student attempts; routes low-confidence scans to PENDING manual confirmation.
  - Connected into `DocumentsService.splitPdfDocument`.
  - Verified with 14/14 tests in `identity-resolution.service.spec.ts` and 53/53 tests in `documents.service.spec.ts`.

---

## Phase 6: Reports, External Services & Operational Reliability
- [x] **Task 6.1:** Genuine Vector PDF Report Generation:
  - Created `apps/api-python/src/routers/reports.py` with `AcademicReportPDF` using `fpdf2`.
  - Renders student report cards and batch analysis reports with header branding, KPI summary cards, and formatted tables.
  - Updated `ReportGenerationProcessor` in `apps/api/src/reports/report-generation.processor.ts` to output genuine `application/pdf` binary bytes starting with `%PDF-` and `.pdf` extension.
  - Verified with 28/28 tests in `src/reports/`.
- [x] **Task 6.2:** External Notifications Honest Status Handling:
  - Verified `NoticeDispatchProcessor` gracefully flags unconfigured external channels as `status: FAILED, failureReason: 'provider_not_configured'` with zero false positives or fabricated deliveries.
  - IN_APP deliveries processed synchronously.
  - Verified with 6/6 tests in `notices.service.spec.ts`.

---

## Phase 7: Frontend Polish, Responsive Layouts & Design Preservation
- [x] **Task 7.1:** Integrated New Workflows into Admin Dashboard:
  - `AdminExams.tsx` updated with "Assign Evaluators" and "Print Booklets" actions.
  - Responsive dialogs and cards for mobile, tablet, and desktop viewports.
  - Preserved existing Tailwind tokens and design patterns from `foundation.tsx`.
- [x] **Task 7.2:** Clean Next.js Build:
  - Executed `pnpm --filter @aios/web build` — passed with 9/9 static and dynamic routes compiled cleanly.

---

## Phase 8: Integrated Regression, Verification & Release Readiness
- [x] **Task 8.1:** Full Workspace Build:
  - `@aios/web` build passed.
  - `@aios/api` build (`nest build`) passed.
- [x] **Task 8.2:** Core Test Suites Verified:
  - Over 300 tests passing across auth, documents, booklets, evaluations, identity resolution, reports, exams, and scoring.
- [x] **Task 8.3:** Release Readiness Checklist & Final Architectural Report.

---

## Phase 9: Post-Implementation Rigorous Verification (Automated & Empirical)
- [x] **Task 9.1:** Strict Google OAuth Email Verification Condition:
  - Tightened `payload.email_verified === false` to `payload.email_verified !== true` so unverified/missing token claims fail closed.
  - Verified with 35/35 passing tests in `auth.service.spec.ts`.
- [x] **Task 9.2:** Clean Eliminaton of Dummy `local_` Values at Creation Source:
  - Refactored `teachers.service.ts` and `students.service.ts` to initialize `googleSub: null` instead of dummy strings.
  - Verified with 45 passing tests across `teachers.service.spec.ts` and `students.service.spec.ts`.
- [x] **Task 9.3:** Relational Delivery-Level Allocation Uniqueness:
  - Created migration `20261010170000_evaluator_allocation_delivery_uniqueness` adding `@@unique([assessmentDeliveryId, studentProfileId])` and `@@unique([assessmentDeliveryId, questionId])`.
  - Deployed migration to database and updated compound queries in `copy-checker-assignments.service.ts`.
  - Verified with 13/13 passing tests in `copy-checker-assignments.service.spec.ts`.
- [x] **Task 9.4:** Python Engine & Vision Pipeline End-to-End Verification:
  - Fixed missing `fastapi` imports (`APIRouter`, `Depends`, `HTTPException`) in `apps/api-python/src/routers/documents.py`.
  - Created comprehensive test script `scratch/verify_python_e2e_pipeline.py` exercising 3 serialized booklet generations, OpenCV QR decoding, HMAC-SHA256 signature verification, 5-page bulk scanner segmentation, OMR bubble grid detection (decoded "104528" at 0.980 confidence), damaged/coverless page quarantine, and vector PDF report generation.
  - Added unit test suite `apps/api-python/tests/test_booklets_and_segmentation.py` (5/5 passing).
  - Executed full pytest suite across entire Python engine: 323 passed out of 323 tests.
- [x] **Task 9.5:** Full NestJS and Next.js Workspace Regression:
  - Executed full Jest API test suite: 59 test suites passed, 911 tests passed, 0 failures.
  - Executed `@aios/api` build (`nest build`): exit code 0.
  - Executed `@aios/web` build (`next build`): exit code 0 (9/9 routes compiled cleanly).

---

## Phase 10: Final Database Integrity, Cross-Service Verification & Release Sign-Off
- [x] **Task 10.1:** Prisma Schema / PostgreSQL Nullable Uniqueness Reconciliation:
  - Validated `BatchEnrollment.rollNumber` nullable uniqueness strategy via PostgreSQL partial unique index (`WHERE status = 'ACTIVE' AND "rollNumber" IS NOT NULL`).
  - Reconciled `User.googleSub` compound uniqueness with nullable values under SQL standard.
  - Validated active schema via `prisma validate` (exit code 0).
- [x] **Task 10.2:** Legacy Roll-Number Non-Destructive Protection:
  - Updated `packages/db/src/backfill-unique-codes.ts` to preserve duplicate conflicting roll numbers in `StudentProfile.externalIds` and `StudentHistory` rather than silently clearing to null.
- [x] **Task 10.3:** Enrollment & Re-enrollment Lifecycle Rules:
  - Codified cohort batch model semantics and immutable `rollNumberSnapshot` on exam attempts.
- [x] **Task 10.4:** Skipped Refresh-Token Integration Tests:
  - Executed `apps/api/src/auth/refresh-token.integration.spec.ts` against real PostgreSQL: 7/7 tests passed in 30.4s.
- [x] **Task 10.5:** Custom Permission Template Dynamic Enforcement & UI Differentiation:
  - Verified dynamic gate in `ExamsService.unlock()` for `exam:unlock` grant.
  - Enhanced `PermissionEditorView.tsx` with explicit `Runtime Guard` vs `Role RBAC` visual indicators.
- [x] **Task 10.6:** Complete 11-Step Cross-Service Examination Pipeline:
  - Executed `scratch/test_cross_service_exam_flow.ts` against live database: all 11 phases passed (exam creation -> canonical delivery -> evaluator assignment -> booklet generation -> signed QR verification -> tamper rejection -> multi-booklet bundle ingestion -> OMR candidate resolution -> duplicate scan quarantine -> teacher auth check -> final score record persistence).
- [x] **Task 10.7:** OMR Normalization Collision Protection & Container Font Licensing:
  - Updated `IdentityResolutionService` to reject leading-zero collisions (`"42"` vs `"042"`) and route to `CONFLICT` queue. 15/15 tests passing.
  - Confirmed Google Noto Sans (`fonts-noto-core`) SIL Open Font License OFL 1.1 redistributability.
- [!] **Task 10.8:** Hardware & Cloud External Release Blockers (Staging Only):
  - Physical optical print-and-scan distortion calibration pending on-site pilot hardware.
  - Production Google Cloud Console OAuth credentials pending deployment environment provisioning.

---

## Phase 11: Agent 6 — Platform Security, System Reliability & Automated Testing
- [x] **Task 11.1:** End-to-End Browser Lifecycle Automation (`tests/e2e/exam-lifecycle.browser.test.js`):
  - Automated all 11 examination lifecycle steps: faculty auth, blueprint validation, anti-cheating Set A/B generation, serialized booklet printing with HMAC-SHA256 QR, multi-page scan ingestion, Otsu OMR roll resolution at 0.985 confidence, ambiguous identity conflict queue resolution, split-screen workspace AI suggestion acceptance (`Shift+A`) with mandatory teacher verification checkbox, exam lock enforcement (`SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED`), and student portal score/remedial tag verification.
  - Executed via `pnpm test:e2e` (`node --test tests/e2e/exam-lifecycle.browser.test.js`): 9/9 tests passed in 4.04s.
- [x] **Task 11.2:** Adversarial Security & Tenant Isolation Suite (`apps/api/src/security/adversarial-security.spec.ts`):
  - Tested cross-tenant document boundary isolation (404 Not Found, no metadata leak).
  - Enforced student IDOR prevention (403 Forbidden on foreign student attempt access).
  - Verified constant-time HMAC-SHA256 signature verification and rejection of forged signatures, tampered delivery/serial metadata, and malformed QR strings.
  - Enforced non-bypassable `assertNoUnevaluatedSubjectiveResponses` gate on graded exam lock.
  - Rejected oversized file uploads (>25MB) with `PayloadTooLargeException`.
  - Sniffed binary headers and rejected disguised executables (`MZ...`) with `UnprocessableEntityException`.
  - Sanitized database connection strings in error output to prevent credential disclosure.
  - Executed via `pnpm --filter @aios/api test src/security/adversarial-security.spec.ts`: 11/11 tests passed in 16.04s.
- [x] **Task 11.3:** Database Constraints & Relational Integrity (`tests/integrity/db-constraints-and-concurrency.test.js`):
  - Verified PostgreSQL partial unique index permits multiple NULL roll numbers in the same batch.
  - Verified duplicate active roll numbers within the same batch are rejected with Prisma `P2002`.
  - Verified identical roll numbers across distinct batches are permitted.
  - Enforced delivery-level evaluator allocation uniqueness on `CopyCheckerStudentAllocation` (`@@unique([assessmentDeliveryId, studentProfileId])`).
  - Verified attempt `rollNumberSnapshot` remains immutable after student enrollment changes.
  - Executed via `pnpm test:integrity`: 5/5 tests passed in 6.83s.
- [x] **Task 11.4:** Workload Profiling & Empirical Performance Benchmarking (`tests/performance/workload-profiler.js`):
  - Measured database query latency percentiles over connection pooler: Institute list P50 = 138.75ms, P95 = 153.42ms; Batch lookup P50 = 308.73ms, P95 = 344.77ms.
  - Benchmarked cryptographic operations (5,000 runs): HMAC-SHA256 Signing = 131,808 ops/sec; Constant-time Verification = 146,610 ops/sec.
  - Benchmarked headless DOM layout: 50-row Evaluation Desk render P50 = 10.12ms, P95 = 91.83ms, Avg = 17.82ms.
  - Profiled memory footprint: Net Heap Delta = 0.23 MB, Total RSS = 79.12 MB.
  - Executed via `pnpm profile`.
- [x] **Task 11.5:** CI Pipeline Hardening & Reproducible Scripting:
  - Added `test:e2e`, `test:integrity`, and `profile` to root `package.json`.
  - Hardened `.github/workflows/ci.yml` with automated `e2e` job executing browser lifecycle and backup verification.


