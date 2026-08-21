# 18 — Edge Cases
## AIOS — Academic Intelligence Operating System

Each edge case states expected behavior — coding agents must handle these explicitly, not assume the happy path is sufficient.

## Authentication & Tenancy
| Edge Case | Expected Behavior |
|---|---|
| User's email exists in AllowList for Institute A but they attempt login on Institute B | 403, no tenant hint leaked (06-AUTH-AUTHORIZATION.md §3) |
| Admin changes a user's role in AllowList while the user has an active session | Role changes only take effect on next login (JWT is not live-revoked mid-session unless `tokenVersion` is explicitly bumped, e.g. via Force Logout) |
| Two Admins edit the same AllowListEntry simultaneously | Last-write-wins at the row level; both succeed, no optimistic lock on this low-risk entity (contrast with Exam state, which does use optimistic locking) |
| Force logout is triggered on a user mid-request | In-flight request completes (JWT was valid when the request started); subsequent requests fail with `401 TOKEN_EXPIRED`-equivalent once `tokenVersion` mismatch is detected |
| Google account's email changes after initial AIOS signup | `googleSub` is the anchor, not email — user remains matched to their existing `User` row; email field is updated on next login, AllowList re-checked against the *new* email for future admin-facing displays but existing `User.instituteId`/role are not revoked by an email change alone |

## Exam State Machine
| Edge Case | Expected Behavior |
|---|---|
| Two Admins click "Approve" on the same exam simultaneously | Optimistic locking via `Exam.version` — second request gets `409` stale-state, must refetch and retry |
| Admin attempts to unlock an exam without a reason | `400 UNLOCK_REASON_REQUIRED` |
| Teacher attempts to skip DRAFT→PUBLISHED directly | `409 INVALID_STATE_TRANSITION` |
| Exam is `ONGOING` when the scheduled end time passes but no one manually transitions it | System does not auto-transition state (state changes are always explicit human/admin actions, per FR-EXAM-01) — dashboards flag it as "overdue for evaluation transition," but no silent auto-lock occurs, to avoid accidentally locking out legitimate late submissions in physical-exam contexts |
| Exam is unlocked, corrected, and re-locked multiple times | Each unlock/lock cycle is independently audit-logged; there is no cap on unlock count, but each requires its own justification |

## Marks Capture
| Edge Case | Expected Behavior |
|---|---|
| Teacher uploads the same photo-capture answer sheet twice for one student | Second `AnswerSheet` is flagged `DUPLICATE`, requires manual teacher resolution (choose which to keep), never silently overwrites |
| CSV import references a RollNumber not enrolled in the target batch | That row is rejected with a per-row error (`INVALID_STUDENT_REFERENCE`); the rest of the file still processes |
| OMR file's option-count/key structure doesn't match the linked Paper's questions | Entire file rejected before any row commits, with a diagnostic report (mismatch is a systemic error, not a per-row one) |
| Teacher loses network connection mid-MANUAL_GRID entry, midway through a batch | Client-side, partially-entered rows not yet submitted are not persisted server-side; teacher must resubmit those rows on reconnect — no partial-batch server-side commit occurs (the write is per-request, request either fully succeeds or the unsent rows simply weren't sent) |
| Two teachers (e.g., co-teaching) attempt to grade the same student's answer sheet concurrently | Second submission attempt for an already-`FINALIZED` AnswerSheet is rejected (`409`); if still `UNDER_REVIEW`, last-write-wins per question-response row is acceptable since grading is typically single-owner per exam in practice, but this is a documented known limitation, not silently unhandled |
| Exam's marks-capture mode is `PHOTO_CAPTURE` but a student took the test digitally by mistake (institute policy mismatch) | System does not block cross-mode entry at the API level — an Admin/Teacher can still record via `MANUAL_GRID` for that individual student even if the exam's default `captureMode` differs, since real classrooms are imperfect (documented flexibility, not a rigid gate) |

## Mastery & Remediation
| Edge Case | Expected Behavior |
|---|---|
| Student has zero prior attempts in a topic | Mastery shown as "not yet assessed," never defaults to 0.0 or 1.0 |
| A Topic is renamed or merged into another Topic | Historical `MasteryScore` rows remain attributed to the original `topicId`; a topic-merge operation (if supported) must explicitly re-attribute or clearly mark historical data as pre-merge, never silently lose it |
| Student's mastery in a topic crosses below 0.50, then above 0.50, then below again within a short window | Existing open `Intervention` is updated/reused rather than creating duplicate open records for the same student+topic (FR-INTEL-04 edge case, 03-FEATURE-SPECIFICATIONS.md) |
| Auto-generated Assignment creation fails (e.g., transient DB error) after Intervention record is created | `Intervention` persists regardless (diagnostic truth is never lost); Assignment creation is retried independently |
| Teacher manually deletes/edits an auto-generated Assignment before the student sees it | Allowed — teacher has full edit rights over auto-generated content; the underlying `Intervention.assignmentId` link is updated accordingly |
| Mastery recalculation job runs for a student who was transferred to a different batch mid-term | Mastery is tracked per `(studentProfileId, topicId)`, independent of current batch — batch transfer does not reset or fragment mastery history |

## Question Bank
| Edge Case | Expected Behavior |
|---|---|
| Teacher edits a Question that is already embedded in a `PUBLISHED`/`ONGOING` exam | Live Question content changes do not retroactively alter what's shown to students in that exam — the Paper uses the pinned `QuestionVersion` snapshot from generation time |
| Approving a Question that was edited after the approval request was initiated (race condition) | Approval action is version-pinned (`questionVersionId`); approving a stale version fails with a "question has been modified since review" error, requiring re-review |
| Admin attempts to hard-delete a Question already used in a historical (LOCKED) exam | Rejected — Questions with historical `Response` dependents are soft-archived only, never hard-deleted |

## AI Blueprint Generation
| Edge Case | Expected Behavior |
|---|---|
| Blueprint requests more questions of a given topic/difficulty than exist in the approved bank | Partial paper generated with `warnings[]` identifying the shortfall; teacher must top up manually or relax the blueprint |
| AI generation call times out (>15s) | `504`, client retries safely using the same `Idempotency-Key` — no duplicate `Paper` created on retry |
| Personalized remedial paper requested for a student with no diagnosed weak topics yet | Generation falls back to standard (non-personalized) selection with a `warnings[]` note, rather than failing outright |

## Communication
| Edge Case | Expected Behavior |
|---|---|
| Recipient has no phone number on file but SMS/WhatsApp selected as a channel | That channel's `NoticeDelivery` is immediately `FAILED` with `"no_contact_info"`; other selected channels for that recipient proceed independently |
| Notice targets a batch that is later deleted before all deliveries complete | In-flight deliveries complete normally (audience was snapshotted at broadcast time, not re-resolved live) |

## Timetable
| Edge Case | Expected Behavior |
|---|---|
| A recurring weekly slot conflicts with a one-time holiday on a specific date | Holiday exception suppresses that single occurrence without deleting/modifying the recurring rule |
| Admin schedules a slot that overlaps an existing slot for the same teacher | `409` conflict, rejected before persistence |

## Reports & Audit
| Edge Case | Expected Behavior |
|---|---|
| Report requested for a date range with zero data | Generation succeeds, producing an explicit "no data in range" document — not a failure |
| AuditLog write fails during a LOCK/UNLOCK/ROLE_CHANGE action | The entire operation (including the triggering mutation) is rolled back — these specific actions are never persisted without their audit counterpart (07-SECURITY-SPECIFICATION.md §13, 03-FEATURE-SPECIFICATIONS.md AUDIT module) |
| Bulk CSV import of 500 AllowList rows | Not logged as 500 individual AuditLog rows — logged as one summary audit entry referencing the import batch, to avoid write amplification (see 04-DATABASE-SCHEMA.md §3 audit-granularity note) |

## System-Level
| Edge Case | Expected Behavior |
|---|---|
| Database temporarily unavailable during a grading submission | Client receives `500`/`503`; the request is safe to retry (no partial write, since it's a single transaction); async downstream jobs are simply never enqueued if the transaction never committed |
| Redis (cache) unavailable | System degrades to direct-DB reads/writes; caching interceptor fails open, not closed (09-CACHING-STRATEGY.md §5) |
| FastAPI AI service is down during peak exam-generation demand | Manual paper assembly remains fully available as a first-class fallback workflow (not degraded UX) |
| Session expires mid-multi-step operation (e.g., mid-CSV-import review) | Import progress state, if any was persisted server-side with an operation ID, survives re-login; if purely client-held, user must restart the review step (never a partial/corrupt server-side commit either way) |


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add a new table, **Document Processing & Evaluation Edge Cases**, consolidating the edge cases already specified across `22`–`31` (identity conflicts, flagged pages, low-confidence OCR routing, rubric mid-window edits, AI-unavailability fallback, duplicate document uploads, criterion-dependency overrides in STEP_WISE rubrics, post-lock reviewer override via unlock). Each entry cross-references its authoritative source document rather than being redefined here, per this addendum's stated purpose of consolidation, not duplication.

