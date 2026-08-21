# 05 — API Specification
## AIOS — Academic Intelligence Operating System

**Merged Status:** This file now includes both the original v1 baseline (Part 1) and the v2 extensions (Part 2) as a single current source of truth.
**Base URLs:** NestJS API `https://api.aios.app/v1` (internal dev: `http://localhost:4000`) | Python AI service is **internal-only**, never exposed to the browser, reached only via NestJS proxy.

**Conventions:**
- All responses: `{ "success": boolean, "data"?: ..., "error"?: {...}, "meta"?: {...} }`.
- All list endpoints support `?page=&pageSize=` (default pageSize 20, max 100) and return `meta: { page, pageSize, total }`.
- All mutating endpoints require `Idempotency-Key` header where noted.
- All endpoints require `Authorization: Bearer <JWT>` except `/auth/login`.
- Standard error envelope defined fully in 08-ERROR-HANDLING.md.

---

## 1. Auth

### `POST /auth/login`
- **Purpose:** Authenticate via Google OAuth id_token; issue JWT.
- **Auth:** Public.
- **Request:** `{ "idToken": string }`
- **Validation:** idToken required, valid Google-issued JWT.
- **Success:** `201` `{ success: true, data: { accessToken, user: { id, role, instituteId, name, email } } }`
- **Errors:** `400` invalid token format; `403` email not on AllowList; `429` rate limited.
- **Rate limit:** 10 req/s, 100 req/min per IP.

### `POST /auth/logout`
- **Auth:** Any authenticated role.
- **Success:** `200` `{ success: true }`

---

## 2. Institutes & Tenancy

### `GET /institutes/me`
- **Auth:** Any role (tenant-scoped, except FOUNDER who must pass `?instituteId=`).
- **Success:** `200` institute profile, plan, feature flags.

### `POST /allow-list-entries`
- **Auth:** ADMIN (`instituteId:write`), FOUNDER.
- **Request:** `{ email, role, branchId? }`
- **Errors:** `409` duplicate; `403` ADMIN attempting to grant FOUNDER role.

### `POST /allow-list-entries/bulk-import`
- **Auth:** ADMIN, FOUNDER.
- **Request:** multipart CSV file.
- **Success:** `200` `{ data: { successCount, failedRows: [{ row, reason }] } }` — never all-or-nothing.

---

## 3. Users, Students, Teachers

### `GET /users`
- **Auth:** ADMIN, TEACHER (read-limited to own batches), FOUNDER.
- **Query:** `role?, batchId?, search?, page, pageSize`
- **Success:** `200` paginated user list.

### `POST /students`
- **Auth:** ADMIN.
- **Request:** `{ userId, batchId, rollNumber, dateOfBirth, guardianName, guardianContact, address? }`
- **Errors:** `409` duplicate rollNumber in batch; `400` invalid batch reference.

### `PATCH /students/:id/tags`
- **Auth:** ADMIN, TEACHER (assigned batch).
- **Request:** `{ statusTags: string[] }`
- **Business logic:** writes a `StudentHistory` row (`TAG_UPDATE`) alongside the update.

### `POST /teachers`
- **Auth:** ADMIN.
- **Request:** `{ userId, qualifications[], subjectIds[], availability }`

---

## 4. Academics (Subject / Chapter / Topic)

### `POST /academics/subjects`
- **Auth:** ADMIN, TEACHER.
- **Request:** `{ name, order? }`
- **Errors:** `409` duplicate name per institute.

### `POST /academics/subjects/:id/chapters`
- **Auth:** ADMIN, TEACHER.
- **Request:** `{ name, order? }`

### `POST /academics/chapters/:id/topics`
- **Auth:** ADMIN, TEACHER.
- **Request:** `{ name, order? }`

### `GET /academics/tree`
- **Auth:** All roles (STUDENT read-only).
- **Success:** `200` nested Subject→Chapter→Topic tree for the institute.

---

## 5. Question Bank

### `POST /questions`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ topicId, type, content, options?, correctAnswer, answerTolerance?, difficulty, marks, solutionExplanation? }`
- **Validation:** type-specific field rules (see 03-FEATURE-SPECIFICATIONS.md).
- **Success:** `201` question, `isApproved: false`.
- **Errors:** `422` type-specific validation failure.

### `PATCH /questions/:id`
- **Auth:** Author TEACHER, ADMIN.
- **Business logic:** writes `QuestionVersion` snapshot before applying changes if question was previously approved.

### `POST /questions/:id/approve`
- **Auth:** ADMIN (or reviewer-flagged TEACHER).
- **Request:** `{ questionVersionId, qualityScore? }`
- **Errors:** `403` non-reviewer TEACHER.

### `POST /questions/:id/reject`
- **Auth:** ADMIN (or reviewer).
- **Request:** `{ reason }` (required).

### `GET /questions`
- **Auth:** TEACHER, ADMIN.
- **Query:** `topicId?, difficulty?, isApproved?, type?, search?, page, pageSize`

---

## 6. Blueprint & Paper Generation

### `POST /blueprints`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ name, subjectIds[], totalMarks, durationMinutes, instructions?, topicDistribution }`
- **Errors:** `422` marks reconciliation failure.

### `POST /papers/generate-ai`
- **Auth:** TEACHER, ADMIN.
- **Headers:** `Idempotency-Key` required.
- **Request:** `{ blueprintId, targetStudentId?, excludedQuestionIds? }`
- **Business logic:** NestJS proxies to Python `POST /ai/generate-blueprint-paper` with a bounded timeout (see 17-THIRD-PARTY-INTEGRATIONS.md).
- **Success:** `201` `{ data: { paper, warnings: [] } }` (warnings present if topic coverage fell short).
- **Errors:** `502` AI service unreachable; `504` AI generation timeout; `422` under-specified blueprint.

### `POST /papers/:id/variants`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ variantCount, shuffleStrategy }`
- **Success:** `201` array of `PaperVersion`.

---

## 7. Exams

### `POST /exams`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ batchId, paperId, title, scheduledStart, scheduledEnd, captureMode }`
- **Success:** `201` exam, `status: DRAFT`.

### `PATCH /exams/:id/status`
- **Auth:** TEACHER (DRAFT→REVIEW only), ADMIN (all forward transitions), see 06-AUTH-AUTHORIZATION.md.
- **Request:** `{ targetStatus }`
- **Errors:** `409` invalid/out-of-order transition (includes `currentStatus`, `attemptedStatus` in error detail).

### `POST /exams/:id/unlock`
- **Auth:** ADMIN only.
- **Request:** `{ unlockReason }` (min 10 chars).
- **Business logic:** atomic transaction — status update + AuditLog write, or both fail.
- **Errors:** `400` missing/short reason.

### `POST /exams/:id/grade-sheet`
- **Auth:** TEACHER (assigned batch), ADMIN.
- **Headers:** `Idempotency-Key` required.
- **Request (MANUAL_GRID):** `{ studentProfileId, responses: [{ questionId, marksAwarded, mistakeTagType?, teacherComment? }] }`
- **Request (CSV_IMPORT / OMR_IMPORT):** multipart file.
- **Request (PHOTO_CAPTURE):** multipart image(s) + `studentProfileId`.
- **Success:** `200`/`207` (bulk with per-row status) within **<300ms for the durable write**; async job enqueued for mastery recalculation.
- **Errors:** `409` duplicate AnswerSheet; `422` row-level validation errors (bulk modes return per-row detail, not a single blocking error).

### `GET /exams/:id/evaluation-queue`
- **Auth:** TEACHER (assigned), ADMIN.
- **Success:** `200` list of ungraded/partially-tagged answer sheets with completion percentage.

---

## 8. Analytics & Mastery

### `GET /analytics/student/:id/mastery`
- **Auth:** Self (STUDENT), TEACHER (assigned batch), ADMIN.
- **Success:** `200` `{ data: [{ topicId, topicName, score, trendDelta, lastCalculatedAt }] }`

### `GET /analytics/batch/:id/mastery-summary`
- **Auth:** TEACHER (assigned), ADMIN.
- **Success:** `200` aggregate radar data across the batch.

---

## 9. Doubts

### `POST /doubts`
- **Auth:** STUDENT.
- **Request:** `{ subjectId, topicId?, urgency, queryText, attachmentUrls? }`

### `PATCH /doubts/:id/assign`
- **Auth:** ADMIN, TEACHER (self-claim).

### `POST /doubts/:id/respond`
- **Auth:** Assigned TEACHER.
- **Request:** `{ responseText }`

---

## 10. Assignments

### `POST /assignments`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ title, description, dueDate, batchId? | studentProfileId?, attachedQuestionIds? }`
- **Errors:** `422` dueDate in past; `400` both batchId and studentProfileId provided (mutually exclusive).

### `POST /assignments/:id/submit`
- **Auth:** STUDENT (own only).

---

## 11. Timetable

### `POST /timetable-slots`
- **Auth:** ADMIN, TEACHER (own remedial/extra-class only).
- **Request:** `{ batchId?, teacherProfileId?, slotType, startTime, endTime, recurRule?, roomRef? }`
- **Errors:** `409` teacher/room conflict.

---

## 12. Notices

### `POST /notices`
- **Auth:** ADMIN, TEACHER (own batches).
- **Request:** `{ title, body, channels[], targetAudience }`
- **Success:** `201` notice + queued deliveries.

### `GET /notices/:id/delivery-report`
- **Auth:** ADMIN, TEACHER (own).

---

## 13. Reports

### `POST /reports`
- **Auth:** ADMIN, TEACHER (own batch scope).
- **Request:** `{ type, scope, format }`
- **Success:** `202` `{ data: { reportId, status: "QUEUED" } }`

### `GET /reports/:id`
- **Success:** `200` status + `fileUrl` (signed URL) once `COMPLETE`.

---

## 14. Audit Logs

### `GET /audit-logs`
- **Auth:** ADMIN (own institute), FOUNDER (any/all, `?instituteId=`).
- **Query:** `actorUserId?, action?, entity?, dateFrom?, dateTo?, page, pageSize`

---

## 15. Founder / Platform

### `GET /founder/institutes`
- **Auth:** FOUNDER only.
### `PATCH /founder/institutes/:id/plan`
- **Auth:** FOUNDER only.
- **Request:** `{ plan }`
### `GET /founder/health`
- **Auth:** FOUNDER only.
- **Success:** latency stats for NestJS, FastAPI, PostgreSQL.
### `PATCH /founder/feature-flags`
- **Auth:** FOUNDER only.
- **Request:** `{ instituteId, flag, enabled }` (e.g. toggle OMR capture, AI blueprint agent per tenant).

---

## 16. Internal Python AI Microservice Contract (`apps/api-python`)
Not reachable from the browser; called only by NestJS using a shared internal service secret in an `X-Internal-Service-Token` header.

### `POST /ai/generate-blueprint-paper`
- **Request:** `{ instituteId, blueprintId, blueprintSnapshot, targetStudentId?, excludedQuestionIds? }`
- **Response:** `{ paperItems: [...], warnings: [...] }`
- **Timeout:** 8s soft, 15s hard (see 17-THIRD-PARTY-INTEGRATIONS.md). On hard timeout NestJS returns `504` to the client with an idempotency-safe retry path.

### `POST /analytics/recalculate-mastery`
- **Request:** `{ instituteId, studentProfileId, examId }` (fire-and-forget trigger, NestJS does not await completion beyond enqueue ack).
- **Response:** `202 Accepted` immediately; actual write happens async inside the Python service.

### `POST /analytics/diagnostic-remediation`
- **Request:** `{ instituteId, studentProfileId, topicId, masteryScore }`
- **Response:** `{ interventionId, assignmentId? }`

---

## 17. Pagination, Rate Limiting, Idempotency (Global Rules)
- **Pagination:** cursor or offset (`page`/`pageSize`) — offset chosen for admin/teacher list screens (bounded dataset sizes per tenant); all list endpoints capped at `pageSize=100`.
- **Rate limiting:** global default 100 req/min per authenticated user; `/auth/*` has its own stricter limit (see §1). See 10-SCALABILITY-STRATEGY.md for tiering by plan.
- **Idempotency:** required (`Idempotency-Key` header, UUID) on: `POST /exams/:id/grade-sheet`, `POST /papers/generate-ai`, `POST /allow-list-entries/bulk-import`. Server caches the response for a given key for 24h and replays it on retry instead of re-executing.

## 18. OpenAPI Contract
A machine-readable `openapi.yaml` mirroring this document must be maintained under `apps/api/openapi.yaml` and regenerated from NestJS decorators (`@nestjs/swagger`) on every build; this markdown is the human-readable companion and must not drift from it — CI fails the build if `openapi.yaml` diff is not committed alongside a controller change (see 14-DEPLOYMENT-ARCHITECTURE.md CI gates).


---



---

# PART 2 — V2 EXTENSIONS (merged from 05-API-SPECIFICATION.md (V2 section))

## AIOS — Academic Intelligence Operating System

---

## 1. Compatibility Strategy
Every v1 endpoint under `/exams/*` continues to work unchanged, resolving internally to `Assessment`/`AssessmentDelivery`/`Attempt` operations per `22-ASSESSMENT-ENGINE.md` §6. New v2-native endpoints below are **additive** — no v1 endpoint is removed or renamed in this document.

## 2. Assessments

### `POST /assessments`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ title, assessmentKind, stakesLevel, subjectIds[], paperId?, totalMarks, gradeLevel? }` **(fix #3: `assessmentType` renamed to `assessmentKind`; `stakesLevel` is new and required — see `04-DATABASE-SCHEMA.md` V2 section §1.1)**
- **Success:** `201` Assessment.

### `POST /assessments/:id/deliveries`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ batchId, scheduledStart, scheduledEnd, captureProviderId, evaluationPolicyId }` **(fix #3: `evaluationPolicyId` is new and required)**
- **Success:** `201` AssessmentDelivery, `status: DRAFT`.
- **Errors:** `422 EVALUATION_POLICY_STAKES_MISMATCH` if the resolved `EvaluationPolicy.mode = AI_FINAL_LOW_STAKES` is paired with a parent `Assessment.stakesLevel = GRADED`.

### `PATCH /assessment-deliveries/:id/status`
- Identical contract to v1 `PATCH /exams/:id/status` — same state machine, same error codes (`409 INVALID_STATE_TRANSITION`).

### `POST /assessment-deliveries/:id/unlock`
- Identical contract to v1 `POST /exams/:id/unlock`.

## 3. Capture Providers

### `POST /capture-providers`
- **Auth:** ADMIN.
- **Request:** `{ type, config }` (config shape per `29-CAPTURE-PROVIDER-ARCHITECTURE.md` §6).

### `GET /capture-providers`
- **Auth:** TEACHER, ADMIN.

## 3a. Evaluation Policies (new, fix #3)

### `POST /evaluation-policies`
- **Auth:** ADMIN.
- **Request:** `{ name, mode }` (`mode` ∈ `AUTOMATIC`/`MANUAL_ONLY`/`AI_ASSIST_MANDATORY_REVIEW`/`AI_FINAL_LOW_STAKES`).
- **Success:** `201` EvaluationPolicy.
- **Business logic:** creation alone does not validate against any `Assessment` — the `stakesLevel` reconciliation check (§2, `422 EVALUATION_POLICY_STAKES_MISMATCH`) happens at `POST /assessments/:id/deliveries` time, when a policy is actually paired with a specific assessment, not here.

### `GET /evaluation-policies`
- **Auth:** TEACHER, ADMIN.
- **Success:** `200` list, for populating the delivery-creation UI's policy selector.

## 4. Attempts & Responses

### `POST /attempts`
- **Auth:** System-invoked (via capture provider ingest) or TEACHER (manual override, e.g., cross-mode entry per `29` §4).
- **Request:** `{ assessmentDeliveryId, studentProfileId, captureProviderId }`

### `GET /attempts/:id/responses`
- **Auth:** TEACHER (assigned batch), ADMIN, STUDENT (self, own attempt only).
- **Success:** `200` — for `evidenceType=PAGE_REGION` responses, includes the linked `PageRegion`/`OCRResult` summary (not the full image — see §6).

## 5. Documents

### `POST /document-bundles`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ assessmentDeliveryId, expectedDocumentCount? }`
- **Success:** `201` DocumentBundle.

### `POST /document-bundles/:id/documents`
- **Auth:** TEACHER, ADMIN.
- **Headers:** `Idempotency-Key` required (mirrors v1's grade-sheet idempotency requirement).
- **Request:** multipart — one or more page images or a multi-page PDF.
- **Success:** `202` `{ data: { documentId, status: "UPLOADED" } }` — pipeline processing is async (per `23-DOCUMENT-PROCESSING-ARCHITECTURE.md`).
- **Errors:** `413` oversized file; `422` invalid file type (per `07-SECURITY-SPECIFICATION.md` §9 rules, extended to multi-page PDF).

### `GET /documents/:id`
- **Success:** `200` — full status, page list, processing job statuses.

### `GET /documents/:id/pages/:pageId/image`
- **Success:** `200` signed URL to `processedImageUrl` (and `rawImageUrl` via a query param `?raw=true`, permission-gated to TEACHER/ADMIN/REVIEWER only — students never receive raw pre-annotation image access outside their own finalized result view, per `28-DIGITAL-COPY-UX-SPECIFICATION.md` §5).

### `POST /documents/:id/reprocess`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ fromStage: ProcessingStage }`
- **Business logic:** resumes from the specified stage using retained `ProcessingArtifact`s, per `23` §4/§6.

### `PATCH /page-regions/:id`
- **Auth:** TEACHER, ADMIN — manual region correction (drag-to-adjust bounding box, or re-map to a different questionId).
- **Request:** `{ boundingBox?, questionId? }`

## 6. Identity Resolution

### `GET /identity-resolutions?status=PENDING`
- **Auth:** TEACHER (assigned batch), ADMIN.
- **Success:** `200` queue of documents awaiting manual identity confirmation, per `30-IDENTITY-PAGE-MAPPING.md`.

### `POST /identity-resolutions/:id/confirm`
- **Auth:** TEACHER, ADMIN.
- **Request:** `{ studentProfileId }` (confirms or corrects the candidate match).
- **Success:** `200` — on confirmation, `Document.attemptId` is populated/created if needed.
- **Errors:** `409` if this would create a duplicate attempt for that student+delivery (per `30` §5).

## 7. Rubrics

### `POST /questions/:id/rubric`
- **Auth:** TEACHER (author/assigned), ADMIN.
- **Request:** `{ scoringMode, criteria: [{ description, maxMarks, keywordHints?, dependsOnCriterionId? }] }`
- **Errors:** `422 MARKS_MISMATCH` if criteria don't reconcile to Question.marks (mirrors v1 Blueprint error code pattern).

### `PATCH /rubrics/:id`
- **Auth:** TEACHER, ADMIN.
- **Business logic:** creates a new `RubricVersion`; blocked (`409`) if the linked delivery is currently `EVALUATING` (per `26` §5).

## 8. Evaluations

### `GET /evaluation-work-items`
- **Auth:** TEACHER (own batches/subjects), ADMIN.
- **Query:** `batchId?, subjectId?, aiFlag?, priority?, page, pageSize`
- **Success:** `200` prioritized queue per `25-EVALUATION-ENGINE.md` §7.

### `POST /evaluations/:responseId/decide`
- **Auth:** TEACHER (assigned batch), ADMIN.
- **Request:** `{ decision: "ACCEPT_AI" | "ADJUST" | "REJECT_RESCORE", marksAwarded?, criterionScores?, mistakeTagType?, teacherComment? }`
- **Business logic:** always creates a new `EvaluationVersion(source=TEACHER)`, even for `ACCEPT_AI` (per `25` §4.2).
- **Success:** `201` new EvaluationVersion.

### `POST /evaluations/:responseId/override`
- **Auth:** Requires `REVIEW_EVALUATION` permission (not implied by ADMIN role alone — per `21-DOMAIN-MODEL-V2.md` §4.10).
- **Request:** `{ marksAwarded?, criterionScores?, mistakeTagType?, teacherComment?, disputeReason? }`
- **Errors:** `409` if the delivery is `LOCKED` and no unlock has been performed (mirrors v1 exam-lock discipline).

### `POST /evaluations/:responseId/reprocess`
- **Auth:** TEACHER, ADMIN.
- **Business logic:** triggers a fresh `AIRecommendation` (per `27` §8), creates a new chained `EvaluationVersion(source=AI)` without discarding prior versions.
- **Idempotency:** `Idempotency-Key` required.

### `GET /evaluations/:responseId/history`
- **Auth:** TEACHER (assigned), ADMIN, REVIEWER-permission holders.
- **Success:** `200` full ordered `EvaluationVersion` chain (per `31-EVALUATION-AUDIT-VERSIONING.md` §5).

## 9. Analytics Additions

### `GET /analytics/evaluation-quality`
- **Auth:** ADMIN, FOUNDER.
- **Query:** `instituteId? (FOUNDER only), modelVersion?, dateFrom?, dateTo?, segmentBy? (opt-in, per 32-AI-GOVERNANCE-POLICY.md §4)`
- **Success:** `200` AI-teacher agreement rate, reviewer override rate, time-to-finalize distribution.

## 10. Internal FastAPI Contracts (extends v1 §16)

### `POST /ocr/extract`
- **Request:** `{ instituteId, questionRegionId, imageUrl, blockType }`
- **Response:** `{ ocrResultId, extractedText, confidence, alternativeReadings? }`
- **Timeout:** 2s soft (text), 4s soft (math), 10s hard.

### `POST /evaluation/ai-evaluate`
- **Request:** `{ instituteId, responseId, questionId, rubricVersionId?, referenceAnswer, studentAnswerText }`
- **Response:** `{ suggestedMarks, suggestedCriterionScores?, confidence, flags[], modelVersion }`
- **Timeout:** 8s soft, 20s hard (per `27` §6).
- **Batch variant:** `POST /evaluation/ai-evaluate-batch` — `{ instituteId, assessmentDeliveryId }`, processes all pending subjective responses for a delivery as one queued job.

## 11. New Error Codes (extends `08-ERROR-HANDLING.md` v1 §2/§6)
| Code | HTTP Status | Meaning |
|---|---|---|
| `DOCUMENT_VALIDATION_FAILED` | 422 | Upload failed pipeline validation stage |
| `IDENTITY_RESOLUTION_CONFLICT` | 409 | Would create duplicate attempt linkage |
| `RUBRIC_MARKS_MISMATCH` | 422 | Criteria don't reconcile to question marks |
| `RUBRIC_LOCKED_FOR_EVALUATION` | 409 | Rubric edit attempted mid-evaluation-window |
| `EVALUATION_ALREADY_FINALIZED` | 409 | Attempt to modify a REVIEWER_FINALIZED evaluation without going through override/unlock flow |
| `AI_EVALUATION_SKIPPED_LOW_CONFIDENCE` | — (not an error; informational flag in response body) | OCR confidence too low for AI attempt, routed directly to human queue |
| `SCHOOL_EXAM_LOCK_BLOCKED_UNEVALUATED` | 409 | **Corrected trigger condition (fix #3):** this gate now checks `Assessment.stakesLevel = GRADED`, not `assessmentKind = SCHOOL_THEORY_EXAM` — a graded delivery of any kind (including a graded `PRACTICE_TEST`) is blocked from `LOCKED` with unevaluated subjective responses; an ungraded `SCHOOL_THEORY_EXAM` (`stakesLevel != GRADED`, e.g. a diagnostic-only theory exam) is not blocked. Per `32-AI-GOVERNANCE-POLICY.md` §2, updated. |
| `EVALUATION_POLICY_STAKES_MISMATCH` | 422 | New (fix #3) — `POST /assessments/:id/deliveries` or `PATCH` rejected an `evaluationPolicyId` whose `mode=AI_FINAL_LOW_STAKES` paired with a parent `Assessment.stakesLevel=GRADED`. See `04-DATABASE-SCHEMA.md` (V2 section) §1.2a. |
