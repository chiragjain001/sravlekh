# 19 — Acceptance Criteria
## AIOS — Academic Intelligence Operating System

Answers: *how does the agent/team know a feature is actually finished?* Each block below is copy-pasteable as a PR checklist.

---

## Feature: AllowList-Gated Google Login
- [ ] Non-allowlisted email always rejected with `403`, generic message (no tenant enumeration)
- [ ] Allowlisted email receives a valid JWT with correct `instituteId`/`role`
- [ ] Failed logins recorded in `AuditLog` (`LOGIN_FAILED`) with IP + user-agent
- [ ] Rate limit enforced: 10 req/s, 100 req/min per IP
- [ ] Mock/dev login path is unreachable in production builds (CI-verified)
- [ ] Unit + integration + API contract tests pass

## Feature: Academic Hierarchy (Subject/Chapter/Topic)
- [ ] Duplicate Subject name within institute rejected (`409`)
- [ ] Topic list correctly nested under Chapter → Subject in `GET /academics/tree`
- [ ] Soft-deleted nodes excluded from active dropdowns but retained in historical MasteryScore joins
- [ ] Cache invalidated on any hierarchy write (09-CACHING-STRATEGY.md)
- [ ] Role permissions match matrix (ADMIN/TEACHER write, STUDENT read-only)

## Feature: Question Authoring & Approval
- [ ] All 7 question types validate type-specific required fields
- [ ] Editing an approved question creates a `QuestionVersion` snapshot
- [ ] Unapproved questions never selectable by AI Blueprint Agent
- [ ] Approval is version-pinned; approving a stale version fails cleanly
- [ ] Non-reviewer TEACHER cannot approve (`403`)

## Feature: AI Blueprint Paper Generation
- [ ] Generated paper's total marks equals `Blueprint.totalMarks`, or shortfall explicitly reported via `warnings[]`
- [ ] Personalized papers only draw from the target student's actual diagnosed weak topics
- [ ] Generation call is idempotent under retry (same `Idempotency-Key` → same result, no duplicate Paper)
- [ ] Timeout at 15s hard limit returns clean `504`
- [ ] Manual paper assembly remains available if AI service is down

## Feature: Anti-Cheating Variant Set Generation
- [ ] Each `PaperVersion` shuffle seed persisted and reproducible
- [ ] Passage/Match-the-Following question integrity preserved across shuffles
- [ ] Total marks identical across all variants of the same Paper

## Feature: Exam State Machine
- [ ] No state can be skipped (verified by full 7×7 transition-matrix test)
- [ ] Every transition writes an `AuditLog` row with old/new state
- [ ] Unlock always requires and stores a reason (min 10 chars)
- [ ] Concurrent transition attempts resolved via optimistic locking (`409` on stale version)
- [ ] Unauthorized user (wrong role or wrong tenant) receives `403`

## Feature: Multi-Mode Marks Capture
- [ ] Submission returns `<300ms` (p95) regardless of import mode or class size
- [ ] Mastery recalculation is verifiably fire-and-forget (does not block submission response)
- [ ] Duplicate `AnswerSheet` submissions never silently overwrite prior scores
- [ ] Bulk imports (CSV/OMR) return per-row success/failure, never all-or-nothing
- [ ] Invalid student references rejected per-row with a clear reason

## Feature: Mistake Tagging
- [ ] Evaluation Queue surfaces tagged-vs-untagged completion percentage
- [ ] Bulk-tagging action works across multiple identical incorrect responses
- [ ] Tag type restricted to the 6 documented `MistakeTagType` enum values

## Feature: Topic Mastery Calculation
- [ ] Formula matches documented spec exactly: `Σ marks awarded / Σ marks available` per topic
- [ ] Student with zero prior attempts shows "not yet assessed," never 0%
- [ ] Recalculation triggered within seconds of grading completion, async
- [ ] Job failures retried with backoff, never silently dropped; dead-letter surfaced on dashboards

## Feature: Automated Intervention (Homework + Extra Class)
- [ ] No duplicate open Interventions for the same student+topic pair
- [ ] Threshold strictly `< 0.50`
- [ ] Extra-class grouping is suggested only, never auto-committed to timetable without teacher confirmation
- [ ] Intervention persists even if downstream Assignment auto-creation fails

## Feature: Doubt Ticket Lifecycle
- [ ] Status transitions logged with timestamps for SLA reporting
- [ ] Reassignable if the originally assigned teacher leaves the institute
- [ ] Oversized/invalid attachments rejected client- and server-side

## Feature: Assignment (Homework)
- [ ] Auto-generated assignments always individually scoped (never batch-wide)
- [ ] Past due dates rejected on creation
- [ ] Late submissions flagged, not silently rejected (unless explicitly disabled)

## Feature: Timetable Scheduling
- [ ] No two slots overlap for the same teacher or room
- [ ] Holiday exceptions suppress single occurrences without deleting the recurring rule

## Feature: Notice Broadcast
- [ ] Each recipient×channel combination has independently tracked delivery status
- [ ] Missing contact info fails gracefully without blocking other channels
- [ ] Broadcast scoped correctly to ADMIN (any tenant audience) vs TEACHER (own batches only)

## Feature: Report Generation
- [ ] Report files always tenant-scoped in storage path, accessible only via signed URL
- [ ] Empty-data date ranges still generate a clean "no data" document
- [ ] Failed jobs retried up to 3 times, then surfaced with a regenerate action

## Feature: Immutable Audit Logging
- [ ] No application DB role can UPDATE or DELETE an `AuditLog` row (DB-level grant test)
- [ ] LOCK/UNLOCK/ROLE_CHANGE actions are atomic with their audit entry (same transaction)
- [ ] PII fields in audit `oldValue`/`newValue` are redacted per 07-SECURITY-SPECIFICATION.md §12

---

## Global Definition-of-Done Gate (applies to every feature above)
- [ ] Requirement implemented per its `03-FEATURE-SPECIFICATIONS.md` entry
- [ ] API implemented per `05-API-SPECIFICATION.md`
- [ ] Input validation implemented
- [ ] Authorization (role + tenant + batch scope, as applicable) implemented
- [ ] Error handling implemented per `08-ERROR-HANDLING.md` envelope
- [ ] Loading / empty / error / success UI states implemented (frontend features)
- [ ] Database migration added and reviewed (if schema changed)
- [ ] Unit, integration, and API contract tests added and passing
- [ ] Logging added where required (`12-LOGGING-MONITORING.md`)
- [ ] Documentation updated if architecture/behavior changed
- [ ] TypeScript/mypy typecheck passes
- [ ] ESLint/ruff passes
- [ ] Full test suite passes (unit, integration, contract; E2E if a core workflow)
- [ ] Build passes for all affected apps
- [ ] No secrets exposed in code or logs
- [ ] No unnecessary dependencies added
- [ ] Performance targets considered/met (`11-PERFORMANCE-REQUIREMENTS.md`)
- [ ] Edge cases from `18-EDGE-CASES.md` addressed for this feature


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add acceptance-criteria blocks (using the identical checklist format as v1) for each feature listed in the `03` addendum above — the concrete checklists already exist embedded in `22`–`32`'s own "Acceptance Criteria" sections; this addendum's role is simply to confirm they are pulled into the master `19` checklist document verbatim when v2 is approved, so `19` remains the single place a coding agent checks for "is this feature done," without needing to hunt across 12 separate v2 documents.

