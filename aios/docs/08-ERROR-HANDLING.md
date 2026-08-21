# 08 — Error Handling
## AIOS — Academic Intelligence Operating System

---

## 1. Standard Error Envelope
All NestJS API errors follow this shape:
```json
{
  "success": false,
  "error": {
    "code": "EXAM_NOT_FOUND",
    "message": "Exam not found",
    "requestId": "req_9f2c...",
    "details": {}
  }
}
```
- `code`: stable, machine-readable, SCREAMING_SNAKE_CASE, unique per failure condition — frontend logic branches on `code`, never on `message` text (message may be localized later).
- `message`: human-readable, safe to display, never leaks internals (no stack traces, no SQL, no file paths).
- `requestId`: correlates to structured logs (see 12-LOGGING-MONITORING.md) for support/debugging.
- `details`: optional structured context (e.g., which CSV rows failed, which field failed validation) — never includes secrets or unrelated PII.

FastAPI internal errors (service-to-service only) use the same envelope shape for consistency when NestJS logs/forwards them, though they are never returned raw to the browser — NestJS always translates a FastAPI failure into an appropriate client-facing code (e.g., `502`/`504`).

## 2. Error Category → HTTP Status Mapping
| Category | HTTP Status | Example `code` |
|---|---|---|
| Validation error | 400 / 422 | `VALIDATION_ERROR`, `MARKS_MISMATCH` |
| Authentication error | 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` |
| Authorization error | 403 | `FORBIDDEN`, `TENANT_MISMATCH`, `BATCH_NOT_ASSIGNED` |
| Not found | 404 | `EXAM_NOT_FOUND`, `QUESTION_NOT_FOUND` |
| Conflict / business rule | 409 | `DUPLICATE_ANSWER_SHEET`, `INVALID_STATE_TRANSITION`, `DUPLICATE_SUBJECT_NAME` |
| Rate limited | 429 | `RATE_LIMITED` |
| Upstream/internal service error | 502 | `AI_SERVICE_UNAVAILABLE` |
| Upstream timeout | 504 | `AI_GENERATION_TIMEOUT` |
| Unexpected/internal | 500 | `INTERNAL_ERROR` |

## 3. Validation Errors
- Field-level errors return `details.fields: [{ field, reason }]` so the frontend can inline-annotate the exact form field.
- Bulk operations (CSV import, bulk allowlist) never fail the entire batch for one bad row — they return `207`-style partial success with `details.rows: [{ row, code, reason }]` per the pattern established in 03-FEATURE-SPECIFICATIONS.md and 05-API-SPECIFICATION.md.

## 4. Authentication Errors
- `401 UNAUTHENTICATED`: missing/invalid/expired JWT — frontend redirects to login.
- `403` on failed AllowList match at login is intentionally generic (`"Email not authorized for this institute"`) to avoid tenant-enumeration — see 07-SECURITY-SPECIFICATION.md.

## 5. Authorization Errors
- `403 FORBIDDEN`: role not permitted for the action at all.
- `403 TENANT_MISMATCH`: role permitted, but resource belongs to a different institute.
- `403 BATCH_NOT_ASSIGNED`: TEACHER role permitted for the action type, but not assigned to this specific batch.
- These are kept as **distinct codes** (not collapsed into one generic 403) so audit/monitoring can distinguish "wrong role" attempts from "cross-tenant probing" attempts, which have different security severity.

## 6. Business (Domain) Errors
| Code | Meaning |
|---|---|
| `INVALID_STATE_TRANSITION` | Exam state machine violated (e.g., DRAFT→PUBLISHED skip) |
| `UNLOCK_REASON_REQUIRED` | Unlock attempted without a valid reason |
| `DUPLICATE_ANSWER_SHEET` | Second submission for same student+exam |
| `MARKS_MISMATCH` | Blueprint totalMarks doesn't reconcile with topicDistribution |
| `INSUFFICIENT_QUESTION_BANK` | AI generation couldn't fully satisfy blueprint (returned as a `warnings[]` on 201, not a hard error, per 03-FEATURE-SPECIFICATIONS.md) |
| `INTERVENTION_ALREADY_OPEN` | Duplicate open intervention prevented |
| `ASSIGNMENT_TARGET_CONFLICT` | Both batchId and studentProfileId supplied |

## 7. Database Errors
- Prisma unique-constraint violations (`P2002`) are translated to `409` with a code specific to the violated constraint (e.g., `DUPLICATE_SUBJECT_NAME`), never surfaced as a raw Prisma error to the client.
- Foreign-key violations (`P2003`) translate to `400 INVALID_REFERENCE`.
- Connection/timeout failures translate to `500 INTERNAL_ERROR` (or `503 SERVICE_UNAVAILABLE` if the DB is confirmed down at the health-check level) and are always logged with full internal detail server-side even though the client sees a generic message.

## 8. External Service Errors
- Google OAuth verification failure → `401 UNAUTHENTICATED` with code `OAUTH_VERIFICATION_FAILED`.
- SMS/WhatsApp/Email provider failure on a `NoticeDelivery` → does not raise an API error to the caller (the broadcast call already returned `201`); it is recorded per-recipient as `status: FAILED, failureReason` (see 03-FEATURE-SPECIFICATIONS.md COMMUNICATION module).
- FastAPI AI service unreachable → `502 AI_SERVICE_UNAVAILABLE`; FastAPI timeout beyond hard limit → `504 AI_GENERATION_TIMEOUT`. Both are retried by the client using the same `Idempotency-Key`.

## 9. Unexpected Errors
- Any uncaught exception is caught by a global NestJS exception filter, logged with full stack trace + `requestId` server-side, and returned to the client as:
```json
{ "success": false, "error": { "code": "INTERNAL_ERROR", "message": "Something went wrong. Please try again.", "requestId": "req_..." } }
```
- Stack traces, SQL, and internal file paths are **never** included in the client-facing response, in any environment (including staging) — this prevents habit-forming reliance on verbose errors that later leak in production.

## 10. Async Job Failure Handling
- Mastery recalculation and intervention-generation jobs (fire-and-forget from NestJS's perspective) use retry with exponential backoff (3 attempts: 1s, 5s, 25s) inside the job runner.
- After exhausting retries, the job is moved to a dead-letter state, logged as `severity: error`, and surfaced on the FounderHealth/AdminAuditLogs dashboards — it is never silently dropped, since a silently-failed mastery recalculation means a student's diagnostic data goes stale without anyone knowing.
- Report generation jobs (08 applies equally): failure after 3 retries surfaces a "regenerate" action to the original requester (see 03-FEATURE-SPECIFICATIONS.md REPORTS module).

## 11. Frontend Error UX Contract
- Every screen must implement 4 states: **loading**, **empty**, **error**, **success** (see 03-FEATURE-SPECIFICATIONS.md acceptance criteria and 15-CODING-STANDARDS.md).
- Error state renders `error.message` from the envelope, never a raw exception string, and offers a retry action where the underlying operation is safely retryable (idempotent or read-only).
- Validation errors render inline at the specific field named in `details.fields`.

## 12. Logging of Errors
See 12-LOGGING-MONITORING.md for the structured log format. Every error response includes a `requestId` that is present in the corresponding server log line, enabling support staff to look up full context from a user-reported `requestId` without needing DB or code access.


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add the new error codes table from `05-API-SPECIFICATION.md` (V2 section) §11 directly into the v1 §2/§6 category tables. Add **Section 13: Async Pipeline Failure Handling (Document/OCR/AI-Evaluation)**:
- Extends v1 §10 (Async Job Failure Handling) with the same retry/backoff/dead-letter discipline, applied to the four new queues (`document-processing`, `ocr`, `ai-evaluation`, `evaluation-aggregation`, per `02-SYSTEM-ARCHITECTURE.md` (V2 section) §5).
- Specific rule: a failed `ai-evaluation` job **must** still allow the response to enter the human evaluation queue (never a blocking failure state) — this is the error-handling-level restatement of the AI-unavailability-never-blocks-grading principle (`27` §6, `32` §2).

