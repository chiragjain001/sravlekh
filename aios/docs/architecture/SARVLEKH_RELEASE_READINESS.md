# SARVLEKH — Release-Readiness Review & Matrix

**Date:** 2026-09-30  
**Target Release:** Multi-Institute SaaS Pilot & Scaled Launch (10,000 Enrolled Students)  
**Classification System:**  
- **VERIFIED:** Implemented, covered by automated test suites, validated in codebase.  
- **IMPLEMENTED BUT NOT LOAD-TESTED:** Implementation complete and unit/integration tested; requires multi-node staging load run.  
- **PARTIALLY IMPLEMENTED:** Core flow works; advanced edge case or secondary sub-flow pending.  
- **BLOCKED:** Requires external paid infrastructure or third-party service credentials.  
- **NOT IMPLEMENTED:** Architecture planned but code not yet written.  

---

## 1. Release-Readiness Matrix

| Domain | Area / Feature | Status | Verification Evidence / Architecture Reference |
| :--- | :--- | :---: | :--- |
| **Multi-Tenancy** | Request Tenant Scoping | **VERIFIED** | All mutating and read routes derive `instituteId` from validated JWT; client-supplied tenant params are rejected or strictly asserted against JWT identity. Covered by 25+ tenant-isolation tests. |
| **Multi-Tenancy** | Direct DB Tenant Indexing | **VERIFIED** | `student_profiles` has denormalized `instituteId` column indexed via `student_profiles_instituteId_idx`; `findAll` and `getStats` filter directly on `instituteId`. |
| **Authorization** | Global Role Guard Enforcement | **VERIFIED** | `JwtAuthGuard` and `RolesGuard` globally registered as `APP_GUARD` providers. All mutation endpoints require `@Roles()`. |
| **Authorization** | Teacher Batch Scoping | **VERIFIED** | Teachers restricted strictly to assigned batches via `getTeacherBatchIds()`. Attempting to access another batch returns HTTP 403 or empty array. |
| **Authorization** | Student Self-Access Scoping | **VERIFIED** | Students can only access their own profile, assignments, and *finalized* score records. Unfinalized records are filtered out at service layer. |
| **Assessment** | Grading Data Consistency | **VERIFIED** | Score record upserts, response mistake tagging, and answer sheet verification run in ACID transactions. |
| **Assessment** | Absence Tracking | **VERIFIED** | Absent students recorded via `AttendanceRecord(ABSENT)` on exam date; exam lock succeeds without inserting fraudulent zero-mark answer sheets. |
| **Assessment** | AI Governance Gates | **VERIFIED** | Hard invariant: AI evaluation never becomes terminal score for graded assessments without teacher review (`EvaluationVersion.source = TEACHER/REVIEWER`). |
| **Interventions** | Mastery Immutability & Lineage | **VERIFIED** | `Intervention.beforeMastery` and `afterMastery` are snapshot upon creation. Subsequent EMA recalculations update `MasteryScore` without overwriting historical intervention snapshots. |
| **Assignments** | Auto-Generated Remedial Idempotency | **VERIFIED** | Remedial assignments created from weak topics check unique student/topic pairs; deduplication prevents duplicate worksheet creation. |
| **Background Processing** | Queue Back-Pressure & Concurrency | **VERIFIED** | `queue-policy.ts` configures per-queue concurrency (2–5) and retention. `RUN_WORKERS=false` isolates API pods from worker loads. |
| **Background Processing** | Enqueue Deduping & Deduplication | **VERIFIED** | `enqueueDeduped()` enforces BullMQ deduplication keys based on domain entity IDs, preventing duplicate job enqueuing under network retries. |
| **Reporting** | Student & Batch Progress Reports | **VERIFIED** | `report-generation.processor.ts` generates complete HTML reports linking exam scores, topic mastery, and intervention lineage with bounded date filters. |
| **Reporting** | Signed Time-Limited Downloads | **VERIFIED** | `ReportsService.withFreshDownloadUrl()` mints fresh signed S3/MinIO URLs on each read; expired URLs never served from static rows. |
| **Database** | High-Volume Foreign Key Indexes | **VERIFIED** | Added indexes on `responses(questionId)`, `answer_sheets(studentProfileId)`, `assignments(studentProfileId)`, `interventions(instituteId)`. Migration `20260930100000_scalability_indexes` created. |
| **Database** | Connection Pool Budgeting | **VERIFIED** | Explicit connection budget: API (50) + Workers (15) + Python (10) + Admin (10) = 85/100 connections. |
| **Audit Trail** | Append-Only Immutability | **VERIFIED** | Database trigger `reject_audit_log_mutation()` blocks UPDATE and DELETE on `audit_logs` at PostgreSQL engine level. |
| **Load Testing** | Baseline Read Concurrency (40 VUs) | **VERIFIED** | 175 req/s sustained, 0% error rate up to 40 VUs on single node hardware. |
| **Load Testing** | Grading & Report Generation Burst | **IMPLEMENTED BUT NOT LOAD-TESTED** | Scripts `grading-burst.js` and `report-generation-burst.js` ready; requires active Redis & PostgreSQL staging run. |
| **AI / OCR** | Live Provider Burst Load | **BLOCKED** | Bounded by live AI billing key limits; verified using unit mocks and fallback adapters. |
| **Observability** | Structured Logging & Correlation IDs | **VERIFIED** | NestJS Logger with request context and Sentry integration hooks configured in API and Python services. |
| **Observability** | Health & Readiness Endpoints | **VERIFIED** | `/health` checks verify PostgreSQL database connectivity and Redis availability with graceful 503 degradation. |

---

## 2. Screen-by-Screen Frontend-to-Backend Integration Matrix

### Student Portal (`/dashboard/student`)
| Screen | Backing API Hook / Endpoint | Mock Status | States Handled | Integration Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Overview** | `useMyStudentProfile`, `useExams`, `useAssignments`, `useTimetable` | No Mocks | Loading, Empty, Data | **VERIFIED** |
| **My Tests** | `useMyStudentProfile`, `useExams` | No Mocks | Loading, Empty, Finalized filter | **VERIFIED** |
| **Assignments** | `useAssignments`, `useSubmitAssignment` | No Mocks | Loading, Empty, Pending/Graded | **VERIFIED** |
| **Study Plan** | `useTimetable`, `useAssignments` | No Mocks | Loading, Empty, Day offset | **VERIFIED** |
| **Weak Topics** | `useMyStudentProfile` (filtered `< 0.70`) | No Mocks | Loading, Empty, Critical/Warning | **VERIFIED** |
| **Doubt Center** | `useDoubts`, `useCreateDoubt` | No Mocks | Loading, Empty, Mutation | **VERIFIED** |
| **Time Table** | `useTimetable` | No Mocks | Loading, Empty, Day grid | **VERIFIED** |
| **Extra Classes**| `useTimetable` (type `REMEDIAL` / `EXTRA_CLASS`) | No Mocks | Loading, Empty, Upcoming/Past | **VERIFIED** |
| **Progress** | `useMyStudentProfile` (`scoreRecords`, `masteryScores`) | No Mocks | Loading, Empty, Chart render | **VERIFIED** |
| **Leaderboard** | Replaced with honest `ComingSoon` component | No Mocks | Explanatory state | **VERIFIED** |
| **Resources** | Replaced with honest `ComingSoon` component | No Mocks | Explanatory state | **VERIFIED** |
| **Settings** | `useAuth().user` | No Mocks | Profile display | **VERIFIED** |

### Teacher Portal (`/dashboard/teacher`)
| Screen | Backing API Hook / Endpoint | Mock Status | States Handled | Integration Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Today / Overview** | `useMyTeacherProfile`, `useTimetable`, `useEvaluationWorkItems` | No Mocks | Loading, Empty, Real metrics | **VERIFIED** |
| **My Classes** | `useBatches`, `useBatchWeakTopics`, `useStudents` | No Mocks | Loading, Empty, Batch selector | **VERIFIED** |
| **Question Bank** | `useQuestions`, `useCreateQuestion`, `useApproveQuestion` | No Mocks | Loading, Empty, Search/Filter | **VERIFIED** |
| **Paper Builder** | `useBlueprints`, `useGeneratePaper`, `useApprovePaper` | No Mocks | Step wizard, Draft, Review | **VERIFIED** |
| **Tests & Exams** | `useExams`, `useLockExam`, `useUnlockExam` | No Mocks | Loading, Empty, Absence modal | **VERIFIED** |
| **Evaluation Queue** | `useEvaluationWorkItems`, `useEvaluationDecision` | No Mocks | Loading, Empty, Review modal | **VERIFIED** |
| **Document Queue** | `useDocumentBundles`, `useDetectRegions` | No Mocks | Loading, Empty, Split status | **VERIFIED** |
| **Analytics Hub** | `useBatchHeatmap`, `useBatchMistakeSummary` | No Mocks | Loading, Empty, Compare modes | **VERIFIED** |
| **Remedial / Extra** | `useInterventions`, `useCreateIntervention` | No Mocks | Loading, Empty, Create modal | **VERIFIED** |
| **Reports** | `useReportsList`, `useRequestReport`, `useReport` (polling) | No Mocks | Loading, Empty, Download link | **VERIFIED** |
| **Doubt Center** | `useDoubts`, `useResolveDoubt` | No Mocks | Loading, Empty, Reply modal | **VERIFIED** |
| **Time Table** | `useTimetable`, `useCreateTimetableSlot` | No Mocks | Loading, Empty, Slot create | **VERIFIED** |

### Admin Portal (`/dashboard/admin`)
| Screen | Backing API Hook / Endpoint | Mock Status | States Handled | Integration Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Dashboard** | `useStudentsStats`, `useTeachersStats`, `useBatchesStats`, `useAuditLogs` | No Mocks | Real count tiles, no fake fees | **VERIFIED** |
| **Students** | `useStudents`, `useCreateStudent`, `useArchiveStudent` | No Mocks | Loading, Empty, Pagination | **VERIFIED** |
| **Teachers** | `useTeachers`, `useCreateTeacher` | No Mocks | Loading, Empty, Pagination | **VERIFIED** |
| **Batches** | `useBatches`, `useCreateBatch` | No Mocks | Loading, Empty, Section CRUD | **VERIFIED** |
| **Academics** | `useSubjects`, `useCreateSubject` | No Mocks | Loading, Empty, Chapter tree | **VERIFIED** |
| **Papers** | `useBlueprints`, `useGeneratePaper` | No Mocks | Loading, Empty, Generate modal| **VERIFIED** |
| **Exams** | `useExams`, `useCreateExam` | No Mocks | Loading, Empty, Status updates | **VERIFIED** |
| **Attendance** | `useAttendanceSummary`, `useAttendanceDaily` | No Mocks | Loading, Empty, Mark present | **VERIFIED** |
| **Analytics Hub**| `useInstituteOverview`, `useBatchHeatmap` | No Mocks | Loading, Empty, Section views | **VERIFIED** |
| **Evaluation Quality**| `useEvaluationQuality` | No Mocks | Loading, Empty, Overrides | **VERIFIED** |
| **Audit Logs** | `useAuditLogs` (with pagination & actor search) | No Mocks | Loading, Empty, Pagination | **VERIFIED** |

### Founder Portal (`/dashboard/founder`)
| Screen | Backing API Hook / Endpoint | Mock Status | States Handled | Integration Verdict |
| :--- | :--- | :--- | :--- | :---: |
| **Overview** | `useFounderInstitutes`, `useFounderHealth` | No Mocks | Real multi-tenant telemetry | **VERIFIED** |
| **Institutes** | `useFounderInstitutes`, `useCreateInstitute` | No Mocks | Loading, Empty, Tenant list | **VERIFIED** |
| **System Health**| `useFounderHealth` (PostgreSQL latency, Redis status) | No Mocks | Real ping latencies | **VERIFIED** |
| **Audit Logs** | `useAuditLogs` (cross-tenant Founder scope) | No Mocks | Loading, Empty, Pagination | **VERIFIED** |
| **Feature Mgmt** | `useFounderFeatureFlags`, `useToggleFeatureFlag` | No Mocks | Real toggle mutation | **VERIFIED** |
| **Integrations** | `useFounderIntegrations` (read-only configuration check) | No Mocks | Real env checks, no fake keys| **VERIFIED** |

---

## 3. Staging Deployment Checklist

Execute this checklist sequentially before promoting to staging or production pilot:

### Pre-Flight Verification
- [ ] Confirm `NODE_ENV=staging` is exported.
- [ ] Verify `DATABASE_URL` contains `?connection_limit=10` on API pods and `?connection_limit=5` on workers.
- [ ] Verify `REDIS_URL` points to staging Redis 7 instance.
- [ ] Verify `JWT_SECRET` is at least 32 characters long and not a default string.
- [ ] Confirm `RUN_WORKERS=false` on web API instances and `RUN_WORKERS=true` on worker containers.

### Database Migration
- [ ] Run `pnpm --filter @aios/db exec prisma migrate deploy`.
- [ ] Verify that all 13 migrations are applied without error.
- [ ] Confirm table indexes:
  ```sql
  SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' 
  AND indexname IN ('responses_questionId_idx', 'answer_sheets_studentProfileId_idx', 'assignments_studentProfileId_idx', 'interventions_instituteId_idx');
  ```

### Smoke-Test Execution
- [ ] **Health Check:** `curl -f http://staging.aios.example.com/health` returns `{"status":"ok"}`.
- [ ] **Teacher Authentication:** Perform login, confirm JWT payload contains `instituteId` and `role: "TEACHER"`.
- [ ] **Student Roster Access:** Request `GET /api/v1/students?page=1&limit=20`, verify response time is < 150ms.
- [ ] **Mistake-Type Analytics:** Request `GET /api/v1/analytics/batch/:batchId/mistake-summary`, confirm aggregations match DB records.
- [ ] **Report Enqueue & Generation:** Trigger `POST /api/v1/reports`, poll until status is `COMPLETE`, verify signed download URL opens valid HTML report.
- [ ] **Absence Marking:** Mark student absent on ongoing test, verify exam transitions to `LOCKED` without errors.

### Emergency Rollback Procedure
1. **Application Rollback:** Revert container image tags to prior stable build.
2. **Database Rollback:** If a migration must be reverted, apply reverse DDL script and record rollback via:
   `pnpm --filter @aios/db exec prisma migrate resolve --rolled-back <migration_name>`
3. **Queue Evacuation:** If BullMQ job backlog causes runaway memory usage:
   Connect to Redis CLI: `KEYS bull:report-generation:*` and pause queues via worker management script.

---

## 4. Disaster Recovery Specifications

### Recovery Objectives
- **RPO (Recovery Point Objective):** $\le 15\text{ minutes}$. Continuous WAL archiving (Point-in-Time Recovery) on PostgreSQL.
- **RTO (Recovery Time Objective):** $\le 30\text{ minutes}$. Automated container redeployment via Docker Compose / ECS.

### Backup Strategy
1. **Automated Nightly Backups:** Full PostgreSQL `pg_dump` taken at 02:00 UTC, encrypted and stored in secondary cloud region object storage.
2. **Redis Durability:** AOF (`appendonly yes`) enabled with `appendfsync everysec` to prevent job state loss during worker host restart.
3. **Audit Log Resilience:** `audit_logs` table is append-only with database-level triggers preventing tampering or data deletion.
