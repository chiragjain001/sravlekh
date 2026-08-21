# 03 — Feature Specifications
## AIOS — Academic Intelligence Operating System

Every feature below follows the mandatory template so no implementation detail is invented by a coding agent.

---

## MODULE: AUTHENTICATION & TENANT ONBOARDING

### Feature: Google SSO Login with AllowList Gate
**Purpose:** Ensure only pre-approved users can access a given institute tenant.
**Who can use it:** Anyone with a Google account whose email is present in that institute's `AllowListEntry`.
**Input:** Google OAuth token (id_token).
**Output:** JWT access token containing `userId`, `role`, `instituteId`.
**Business logic:**
1. Verify Google id_token signature/audience.
2. Extract email + `googleSub`.
3. Look up `AllowListEntry` by `(instituteId-resolvable-domain, email)`.
4. If found: upsert `User` (set `googleSub`, `lastLoginAt`), issue JWT.
5. If not found: return 403, log `LOGIN_FAILED` to `AuditLog`.
**Edge cases:**
- Email exists in AllowList for Institute A but user attempts login on Institute B's subdomain → 403, no cross-tenant fallback.
- AllowListEntry role differs from previously issued `User.role` (role was changed by Admin) → sync `User.role` from AllowListEntry on every login.
- Google account has multiple emails/aliases → only the primary verified email is matched.
**Permissions:** Public endpoint (pre-auth), rate-limited.
**Failure behavior:** 403 with generic `"Email not authorized for this institute"` (never reveal which institutes exist). 429 if throttled.
**Acceptance criteria:**
- [ ] Non-allowlisted email always rejected with 403.
- [ ] Allowlisted email always receives a valid JWT with correct `instituteId`/`role`.
- [ ] Failed logins are audit-logged with IP + user-agent.
- [ ] Rate limit: max 10 req/sec, 100 req/min per IP on `/auth/login`.

### Feature: AllowList Management
**Purpose:** Let Admin/Founder pre-approve emails and roles before a user ever signs in.
**Who can use it:** ADMIN (own institute), FOUNDER (any institute).
**Input:** email, role, instituteId, optional batchId/branchId.
**Output:** `AllowListEntry` record.
**Business logic:** Email must be unique per `instituteId`; role must be one of the 4 valid roles; ADMIN cannot grant `FOUNDER` role.
**Edge cases:** Duplicate entry → 409 conflict. Bulk CSV import of allowlist entries → partial success report (row-level errors returned, not all-or-nothing).
**Permissions:** ADMIN (own tenant only), FOUNDER (any tenant).
**Failure behavior:** 409 on duplicate; 400 on invalid role/email format.
**Acceptance criteria:**
- [ ] Admin cannot create a FOUNDER-role allowlist entry (403).
- [ ] Duplicate email+institute rejected.
- [ ] Bulk import reports per-row success/failure.

---

## MODULE: ACADEMIC HIERARCHY

### Feature: Subject / Chapter / Topic Management
**Purpose:** Provide the 3-tier taxonomy that every question, mastery score, and analytics view is anchored to.
**Who can use it:** ADMIN (RW), TEACHER (RW), STUDENT (R).
**Input:** name, order, parent reference (Chapter→Subject, Topic→Chapter), instituteId (implicit from actor).
**Output:** Created/updated `Subject`, `Chapter`, or `Topic`.
**Business logic:**
- Subject name unique per `instituteId`.
- Chapter/Topic `order` field controls UI display sequence; reordering shifts siblings.
- Deleting a Topic that has associated `Question`/`MasteryScore` records is a soft operation (see 04-DATABASE-SCHEMA.md soft-delete strategy) — never a hard delete.
**Edge cases:** Renaming a Subject already referenced by hundreds of Questions must not break foreign keys (rename is metadata-only). Deleting a Chapter with active Topics requires cascading soft-delete confirmation.
**Permissions:** ADMIN/TEACHER write; STUDENT read-only.
**Failure behavior:** 409 on duplicate Subject name; 400 on invalid parent reference; 422 if attempting hard-delete on a Topic with dependent live data.
**Acceptance criteria:**
- [ ] Duplicate subject name within institute rejected.
- [ ] Topic list correctly nested under Chapter → Subject in API responses.
- [ ] Soft-deleted taxonomy nodes excluded from Question authoring dropdowns but retained in historical MasteryScore records.

---

## MODULE: QUESTION BANK ENGINE

### Feature: Author Question
**Purpose:** Build a reusable, versioned, LaTeX-capable question repository.
**Who can use it:** TEACHER, ADMIN.
**Input:** type (1 of 7 `QuestionType`), topicId, content (Markdown/LaTeX), options (for MCQ/MULTI_CORRECT/MATCH_THE_FOLLOWING), correctAnswer, difficulty (`EASY`/`MEDIUM`/`HARD`), marks, solutionExplanation, tags.
**Output:** `Question` record, `isApproved = false` by default.
**Business logic:**
- 7 supported types: `MCQ`, `MULTI_CORRECT`, `SHORT_ANSWER`, `LONG_ANSWER`, `NUMERICAL` (with tolerance range), `MATCH_THE_FOLLOWING`, `PASSAGE_BASED`.
- Every edit to an existing, previously-approved Question writes a `QuestionVersion` snapshot before applying the change (immutable history).
- `NUMERICAL` questions must define `answerTolerance` (± range) alongside `correctAnswer`.
- `PASSAGE_BASED` questions link a parent passage block to N child sub-questions.
**Edge cases:** Editing a Question that is already embedded in a `PaperItem` of a `PUBLISHED`/`ONGOING` exam must NOT silently change what students see — the Paper snapshot uses the `QuestionVersion` at publish time, not live Question content. Deleting an approved Question in active use is blocked (soft-archive only).
**Permissions:** TEACHER/ADMIN create & edit; only ADMIN (or designated reviewer) can set `isApproved = true`.
**Failure behavior:** 422 if a MCQ has < 2 options or no correct option flagged; 422 if NUMERICAL lacks tolerance; 409 if attempting hard delete on an in-use question.
**Acceptance criteria:**
- [ ] All 7 question types validate their type-specific required fields.
- [ ] Editing an approved question creates a QuestionVersion row.
- [ ] Unapproved questions never selectable by the AI Blueprint Agent.

### Feature: Question Approval Workflow
**Purpose:** Quality gate before a question enters live exams.
**Who can use it:** ADMIN (or Head Teacher, if institute enables delegated approval).
**Input:** questionId, qualityScore (optional numeric rating), approve/reject decision, rejection reason (if rejected).
**Output:** Updated `Question.isApproved`, `approvedByUserId`, `approvedAt`.
**Business logic:** Only `isApproved = true` questions are eligible for Blueprint selection and manual paper assembly.
**Edge cases:** Approving a question that has since been edited by its author (race condition) — approval must reference the specific `QuestionVersion` id being approved, not just the Question id.
**Permissions:** ADMIN only (or explicitly delegated TEACHER with reviewer flag).
**Failure behavior:** 403 if a TEACHER without reviewer rights attempts approval.
**Acceptance criteria:**
- [ ] Approval is version-pinned.
- [ ] Rejected questions return to author with a mandatory reason.

---

## MODULE: BLUEPRINT & AI PAPER GENERATION

### Feature: Define Blueprint
**Purpose:** Specify the pattern (not the literal questions) a test paper must satisfy.
**Who can use it:** TEACHER, ADMIN.
**Input:** name, totalMarks, durationMinutes, instructions, topicDistribution (JSON: topicId → {count, difficultyMix}), subjectId(s).
**Output:** `Blueprint` record.
**Business logic:** Sum of marks across `topicDistribution` entries must equal `totalMarks`; each topic entry's difficulty mix must sum to its question count.
**Edge cases:** Blueprint references a topic with insufficient approved questions in the bank (e.g., needs 5 HARD Physics-Optics questions but only 2 exist) — flagged at generation time, not at blueprint-save time (a blueprint can be saved as a template before the bank is fully stocked).
**Permissions:** TEACHER/ADMIN.
**Failure behavior:** 422 if marks don't reconcile.
**Acceptance criteria:**
- [ ] Marks reconciliation enforced server-side.
- [ ] Blueprint reusable across multiple Papers/Exams.

### Feature: AI Blueprint Paper Generation
**Purpose:** Auto-select a balanced, non-repetitive question set from the approved bank.
**Who can use it:** TEACHER, ADMIN.
**Input:** blueprintId, optional `targetStudentId` (for personalized remedial papers), optional excludedQuestionIds (avoid recent repeats).
**Output:** Draft `Paper` with `PaperItem`s populated; async proxy call to FastAPI `/ai/generate-blueprint-paper`.
**Business logic:**
1. NestJS validates blueprint + caller authorization, then calls the Python service with a scoped payload.
2. Python queries approved Questions matching topic + difficulty requirements, applying weighted-random selection to reduce repeat-question fatigue across recent papers for the same batch.
3. If `targetStudentId` present, question selection is biased toward that student's weak topics (mastery < 0.50) — this produces a **Personalized Remedial Paper**.
4. Result returned to NestJS, which persists the `Paper` + `PaperItem` rows.
**Edge cases:** Insufficient matching questions in bank → partial paper returned with a `warnings[]` list identifying under-filled topics; teacher must manually top up or approve with gaps. Generation timeout (see 17-THIRD-PARTY-INTEGRATIONS.md) → NestJS returns 504 with a retry-safe idempotency key.
**Permissions:** TEACHER/ADMIN.
**Failure behavior:** 502 if Python service unreachable; 422 if blueprint under-specified; partial success returns 207-style warnings payload.
**Acceptance criteria:**
- [ ] Generated paper's total marks always equals Blueprint.totalMarks (or explicit shortfall is reported, never silently under-marked).
- [ ] Personalized papers only draw from the target student's actual weak topics.
- [ ] Generation call is idempotent under retry.

### Feature: Anti-Cheating Variant Set Generation
**Purpose:** Produce Set A / Set B / Set C from one Paper for physical exam-hall distribution.
**Who can use it:** TEACHER, ADMIN.
**Input:** paperId, number of variants (2–4 typical), shuffle strategy (question order only / options only / both).
**Output:** Multiple `PaperVersion` rows, each with a deterministic shuffle seed stored for reproducibility (so a printed/reprint request regenerates identically).
**Business logic:** Each variant preserves the same question set and total marks; only sequence/option order differs, so grading keys remain comparable.
**Edge cases:** MATCH_THE_FOLLOWING and PASSAGE_BASED question types have constrained shuffle rules (sub-questions of a passage must stay grouped).
**Permissions:** TEACHER/ADMIN.
**Failure behavior:** 422 if variant count < 1.
**Acceptance criteria:**
- [ ] Each PaperVersion's shuffle seed is persisted and reproducible.
- [ ] Passage/Match-type integrity preserved across shuffles.

---

## MODULE: EXAM LIFECYCLE

### Feature: Exam State Machine
**Purpose:** Govern the integrity of an exam from creation through grading finalization.
**Who can use it:** TEACHER (create, submit for review), ADMIN (approve, publish, lock/unlock).
**Input:** examId, target status, (for unlock) `unlockReason` (required, min 10 chars).
**Output:** Updated `Exam.status`, `AuditLog` entry on every transition.
**Business logic:** Strict forward sequence: `DRAFT → REVIEW → APPROVED → PUBLISHED → ONGOING → EVALUATING → LOCKED`. The only backward transition allowed is `LOCKED → EVALUATING`, and only by ADMIN, and only with a mandatory reason.
**Edge cases:** Attempting to skip a state (e.g., DRAFT → PUBLISHED directly) is rejected. Concurrent transition requests (two admins clicking "Approve" simultaneously) resolved via optimistic locking (`version` column) — second request gets 409 stale-state.
**Permissions:** See 06-AUTH-AUTHORIZATION.md permission matrix.
**Failure behavior:** 409 on invalid/out-of-order transition; 400 if unlock reason missing/too short.
**Acceptance criteria:**
- [ ] No state can be skipped, verified by a transition-matrix unit test covering all 7×7 combinations.
- [ ] Every transition writes an AuditLog row with old/new state.
- [ ] Unlock always requires and stores a reason.

### Feature: Multi-Mode Marks Capture
**Purpose:** Ingest scores regardless of physical/digital exam medium.
**Who can use it:** TEACHER, ADMIN.
**Input (mode-dependent):**
- `MANUAL_GRID`: batchId, examId, per-student per-question marks array.
- `CSV_IMPORT`: file (columns: RollNumber, QuestionId, AwardedMarks).
- `PHOTO_CAPTURE`: image files per student (answer sheet scans) linked to an `AnswerSheet`.
- `OMR_IMPORT`: OMR scanner output file + answer key mapping.
**Output:** `AnswerSheet` + `Response` rows per student per question; `ScoreRecord` aggregate.
**Business logic:**
1. Write path is synchronous and transactional — response persisted, HTTP 200 returned in <300ms.
2. Immediately after commit, an async job is enqueued to trigger Python mastery recalculation (fire-and-forget; does not block the response).
3. CSV/OMR imports run row-level validation; a single bad row does not fail the whole batch — a per-row error report is returned.
**Edge cases:** Duplicate submission for the same student+exam (double photo upload) → second submission flagged `DUPLICATE`, requires manual teacher resolution, not auto-overwritten. CSV references a RollNumber not enrolled in the batch → row rejected with reason, not silently skipped. OMR key mismatch (option count differs from question bank) → whole file rejected with a diagnostic report before any row is committed.
**Permissions:** TEACHER (assigned batch only), ADMIN (any batch in tenant).
**Failure behavior:** 207-style multi-status response for bulk imports (per-row success/failure); 409 for duplicate AnswerSheet.
**Acceptance criteria:**
- [ ] Marks submission returns in <300ms regardless of import mode or class size.
- [ ] Mastery recalculation is verifiably decoupled (fire-and-forget) and does not affect submission latency.
- [ ] Duplicate submissions never silently overwrite prior scores.

### Feature: Mistake Tagging
**Purpose:** Attach the Error Taxonomy to every incorrect Response.
**Who can use it:** TEACHER, ADMIN.
**Input:** responseId, `mistakeTagType` (1 of 6), optional teacherComment.
**Output:** Updated `Response.mistakeTagType`, `teacherComment`.
**Business logic:** Tag is only meaningful when `Response.isCorrect = false` or partially correct; system UI nudges (not blocks) untagged incorrect responses before an exam can move to `LOCKED`.
**Edge cases:** Bulk-tagging identical mistakes across many students in one action (e.g., "mark all blank NUMERICAL responses as NOT_ATTEMPTED").
**Permissions:** TEACHER (assigned batch), ADMIN.
**Failure behavior:** 400 if tag type invalid enum value.
**Acceptance criteria:**
- [ ] Evaluation Queue surfaces a completion percentage of tagged-vs-untagged incorrect responses before allowing `EVALUATING → LOCKED`.

---

## MODULE: ACADEMIC INTELLIGENCE (MASTERY & REMEDIATION)

### Feature: Topic Mastery Calculation
**Purpose:** Produce the diagnostic core metric of the platform.
**Who can use it:** System (async job); read by TEACHER/ADMIN (any student in tenant), STUDENT (self only).
**Input:** studentProfileId, topicId (triggered after any graded submission touching that topic).
**Output:** `MasteryScore` upsert: `score = Σ(marks awarded in topic) / Σ(marks available in topic)`, plus trend delta (ΔM) vs. prior value.
**Business logic:** Recomputed incrementally on every new graded Response in that topic (not a full historical replay each time, for performance — see 09/10 docs); trend compares the rolling last-N-attempts average against the historical average.
**Edge cases:** Student has zero prior attempts in a topic → mastery is `null`/`ungraded` until first data point, never defaults to 0 or 1. Topic gets renamed/merged → mastery history must remain attributable to the same `topicId` (no data loss).
**Permissions:** STUDENT can view only their own scores.
**Failure behavior:** Job retried with exponential backoff on transient DB failure (see 08-ERROR-HANDLING.md); never silently dropped — failures are logged and alertable.
**Acceptance criteria:**
- [ ] Mastery formula matches the documented formula exactly.
- [ ] A student with no attempts in a topic shows "not yet assessed", not 0%.
- [ ] Recalculation triggered within seconds of grading completion (async, not blocking).

### Feature: Automated Intervention
**Purpose:** Convert a diagnosed weakness into a concrete corrective action without manual teacher initiation.
**Who can use it:** System-triggered; TEACHER/ADMIN can review, edit, or dismiss generated interventions.
**Input:** studentProfileId, topicId, computed mastery < 0.50.
**Output:** `Intervention` record + auto-generated `Assignment` (`isAutoGenerated = true`) targeted at the weak topic, and/or a flag for `EXTRA_CLASS` grouping.
**Business logic:** Threshold is a hard `< 0.50`. Teachers may adjust the auto-generated assignment before it's published to the student, but cannot suppress the underlying diagnostic record.
**Edge cases:** Same student re-diagnosed as weak in the same topic before the previous intervention is resolved — system should update the existing open `Intervention` rather than duplicate it. Teacher's dashboard groups multiple students sharing the same weak topic into a single suggested `EXTRA_CLASS`, but does not auto-schedule a timetable slot without teacher confirmation (avoids creating phantom classes).
**Permissions:** TEACHER/ADMIN can act on interventions for their assigned batches.
**Failure behavior:** If Assignment auto-creation fails, the `Intervention` record still persists (diagnostic truth is never lost even if remediation action fails) and is retried.
**Acceptance criteria:**
- [ ] No duplicate open Interventions for the same student+topic.
- [ ] Extra-class grouping is suggested, never auto-committed to the timetable without teacher approval.

---

## MODULE: DOUBT RESOLUTION

### Feature: Doubt Ticket Lifecycle
**Purpose:** Route student questions to the right faculty with SLA visibility.
**Who can use it:** STUDENT (create), TEACHER (respond, assigned only), ADMIN (oversight/reassignment).
**Input:** subjectId, topicId, urgency (1–3), query text, image attachments.
**Output:** `DoubtTicket`, status `OPEN → ASSIGNED → ANSWERED → CLOSED` (or `ESCALATED`).
**Business logic:** Auto-assignment picks an available batch teacher for the subject; if none respond within an SLA window, ticket may be manually `ESCALATED` by Admin.
**Edge cases:** Student attaches an image exceeding size/type limits → rejected client- and server-side. Teacher leaves institute mid-ticket → ticket must be reassignable, not orphaned.
**Permissions:** STUDENT create/read own; TEACHER read/respond to assigned; ADMIN full oversight.
**Failure behavior:** 413 on oversized attachment; 422 on invalid urgency value.
**Acceptance criteria:**
- [ ] No ticket remains permanently assigned to a removed teacher.
- [ ] Status transitions are logged with timestamps for SLA reporting.

---

## MODULE: HOMEWORK / ASSIGNMENTS

### Feature: Assignment Creation (Manual & Auto)
**Purpose:** Deliver targeted or batch-wide homework.
**Who can use it:** TEACHER, ADMIN (manual); System (auto, via Intervention).
**Input:** title, description, dueDate, target (batchId OR studentProfileId), attached questions/resources, `isAutoGenerated` flag.
**Output:** `Assignment` record; student-facing submission tracking.
**Business logic:** Auto-generated assignments are always individually targeted (`studentProfileId`), never batch-wide, since they stem from a personal mastery gap.
**Edge cases:** Due date in the past rejected. Student submits after due date → flagged `LATE`, still accepted unless teacher disables late submission.
**Permissions:** TEACHER/ADMIN create; STUDENT submit only their own.
**Failure behavior:** 422 on past due date.
**Acceptance criteria:**
- [ ] Auto-generated assignments always individually scoped.
- [ ] Late submissions are flagged, not silently rejected, unless explicitly disabled.

---

## MODULE: TIMETABLE

### Feature: Timetable Slot Scheduling
**Purpose:** Manage class/exam/remedial calendar with conflict prevention.
**Who can use it:** ADMIN (full), TEACHER (own availability + remedial scheduling).
**Input:** batchId, teacherId, slotType (`CLASS`/`EXAM`/`REVISION`/`REMEDIAL`/`EXTRA_CLASS`/`BREAK`/`HOLIDAY`), start/end time, `recurRule` (iCal RRULE format), roomRef.
**Output:** `TimetableSlot` record(s) (recurrence expanded at query time, not pre-materialized for every future date).
**Business logic:** Before persisting, validate no overlapping slot exists for the same teacher or same room within the tenant.
**Edge cases:** Recurring rule conflicts only on some occurrences (e.g., a holiday cancels one instance) — holiday exceptions must suppress specific occurrences without deleting the whole recurring rule.
**Permissions:** ADMIN full; TEACHER limited to their own remedial/extra-class scheduling within assigned batches.
**Failure behavior:** 409 on teacher/room double-booking.
**Acceptance criteria:**
- [ ] No two slots for the same teacher overlap in time.
- [ ] Holiday exceptions correctly suppress single occurrences of a recurring slot.

---

## MODULE: COMMUNICATION / NOTICE CENTER

### Feature: Multi-Channel Notice Broadcast
**Purpose:** Reach students/guardians/staff across preferred channels with delivery accountability.
**Who can use it:** ADMIN, TEACHER (batch-scoped).
**Input:** title, body, channels (`IN_APP`/`EMAIL`/`SMS`/`WHATSAPP`, one or more), targetAudience (role/batch/explicit list).
**Output:** `Notice` + one `NoticeDelivery` row per recipient per channel.
**Business logic:** Dispatch is queued asynchronously per channel; each channel has its own provider (see 17-THIRD-PARTY-INTEGRATIONS.md) and independent delivery status (`QUEUED`/`SENT`/`DELIVERED`/`FAILED`/`READ`).
**Edge cases:** Recipient has no phone number on file but SMS/WhatsApp selected → that channel's delivery row is immediately `FAILED` with reason `"no_contact_info"`, other channels proceed normally.
**Permissions:** ADMIN any audience in tenant; TEACHER only their assigned batches.
**Failure behavior:** Partial channel failure never blocks other channels; failure reasons stored per delivery row.
**Acceptance criteria:**
- [ ] Each recipient×channel combination has an independently tracked delivery status.
- [ ] Missing contact info fails gracefully without blocking the whole broadcast.

---

## MODULE: REPORTS & ANALYTICS

### Feature: Report Generation
**Purpose:** Produce formal exportable academic documents.
**Who can use it:** ADMIN, TEACHER (own batch scope).
**Input:** reportType (`REPORT_CARD`/`PROGRESS_CARD`/`CLASS_REPORT`/`CHAPTER_REPORT`/`TEACHER_REPORT`/`IMPROVEMENT_SHEET`), scope (studentId/batchId/dateRange), format (`PDF`/`EXCEL`).
**Output:** Queued job → `Report` record with `fileUrl` once complete.
**Business logic:** Generation is async; UI polls or is notified on completion; files are stored in tenant-scoped object storage paths.
**Edge cases:** Requesting a report for a date range with zero data → generation succeeds with an explicit "no data in range" document, not a failure.
**Permissions:** Tenant-scoped; a Teacher can only generate reports for their own assigned batches.
**Failure behavior:** Job failure retried up to 3 times, then surfaced to the requester with a "regenerate" action.
**Acceptance criteria:**
- [ ] Report file always tenant-scoped in storage path (no cross-tenant file access possible even via guessed URL — signed URLs only).
- [ ] Empty-data reports still generate cleanly.

---

## MODULE: AUDIT & GOVERNANCE

### Feature: Immutable Audit Logging
**Purpose:** Provide a tamper-evident record of every sensitive action.
**Who can use it:** System writes automatically; ADMIN (tenant-scoped read), FOUNDER (global read).
**Input (system-captured):** actorId, action (`CREATE`/`UPDATE`/`DELETE`/`APPROVE`/`PUBLISH`/`LOCK`/`UNLOCK`/`ROLE_CHANGE`/`LOGIN_FAILED`), entity, entityId, oldValue, newValue, ipAddress, userAgent, timestamp.
**Output:** `AuditLog` row.
**Business logic:** Application-level roles have INSERT-only privilege on this table; no UPDATE/DELETE grant exists at the database role level for the app's DB user on this table (defense-in-depth beyond ORM-level restriction).
**Edge cases:** High-volume bulk operations (e.g., CSV import of 500 rows) should not create 500 audit rows if a single "bulk import" summary row with a reference/count is the documented behavior — see 04-DATABASE-SCHEMA.md for the exact granularity decision.
**Permissions:** Read: ADMIN (own tenant), FOUNDER (global). Write: system only.
**Failure behavior:** If an audit write fails, the triggering mutation must be rejected/rolled back (audit failure is not tolerated silently) for `LOCK`/`UNLOCK`/`ROLE_CHANGE` actions specifically; for lower-severity actions it is logged to an error channel and retried.
**Acceptance criteria:**
- [ ] No application role can UPDATE or DELETE an AuditLog row.
- [ ] Unlock and role-change actions are guaranteed atomic with their audit entry (same DB transaction).


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add a new module section, **MODULE: DOCUMENT-BASED ASSESSMENT & EVALUATION**, containing the feature blocks already fully specified in `22`, `23`, `24`, `25`, `26`, `27`, `30`:
- Feature: Define Assessment (`22` §2)
- Feature: Attempt Lifecycle (`22` §4)
- Feature: Response Evidence Capture (`22` §5)
- Feature: Document Ingestion & Pipeline (`23` §4)
- Feature: Identity Resolution (`30`)
- Feature: Rubric Authoring (`26` §5)
- Feature: AI-Assisted Evaluation Pass (`25` §4.1)
- Feature: Teacher Evaluation Review (`25` §4.2)
- Feature: Reviewer Override (`25` §4.3)

No existing v1 feature block in `03` is modified — this is a pure addition. Cross-reference: the v1 "Multi-Mode Marks Capture" feature (`03` v1, EXAM LIFECYCLE module) gains one clarifying note: *"`PHOTO_CAPTURE` as originally specified covers objective/bubble-style photographed sheets only. Handwritten subjective booklets are handled by the Document-Based Assessment module (v2) via the `PHOTO_CAPTURE_SUBJECTIVE` capture provider, not by this feature."*

