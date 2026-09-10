# 04 — Database Schema & Data Dictionary
## AIOS — Academic Intelligence Operating System

**Merged Status:** This file now includes both the original v1 baseline (Part 1) and the v2 extensions (Part 2) as a single current source of truth.
**Engine:** PostgreSQL 16+ | **ORM:** Prisma (dual client: `@prisma/client` for NestJS, `prisma-client-py` for FastAPI) | **Source of truth:** `packages/db/prisma/schema.prisma`

> This document is the field-level contract. If `schema.prisma` and this document ever diverge, `schema.prisma` is authoritative but the divergence must be reported per the Hierarchy of Truth (01-PRODUCT-REQUIREMENTS.md §13) and this doc updated in the same PR.

---

## 1. Multi-Tenancy Strategy
**Organization-based, single-schema, `instituteId`-scoped multi-tenancy.** All tenant-owned tables carry a mandatory `instituteId` foreign key. A single `Institute` may have multiple `Branch` sub-locations, but tenancy isolation happens at the `Institute` level, not `Branch` level (branch is a scoping dimension *within* a tenant, not a tenant boundary itself).

## 2. Soft-Delete Strategy
- Tables with downstream historical dependents (`Question`, `Subject`, `Chapter`, `Topic`, `Batch`, `User`) use `deletedAt: DateTime?` (nullable soft-delete timestamp). Queries default to `WHERE deletedAt IS NULL` unless explicitly including archived records.
- Tables that are themselves historical/immutable records (`AuditLog`, `QuestionVersion`, `StudentHistory`, `Response`, `ScoreRecord`) are **never deleted**, soft or hard.
- Join/link tables (`BatchTeacher`, `NoticeDelivery`, `PaperItem`) use `removedAt`/`endedAt` style fields to represent "no longer active" rather than deletion, preserving historical relationship integrity.

## 3. Audit Strategy
Every mutation on a "sensitive" entity (see list in 03-FEATURE-SPECIFICATIONS.md AUDIT module) is captured in `AuditLog`. Regular CRUD on low-sensitivity entities (e.g., a Topic name edit) is not separately audit-logged beyond standard `updatedAt` timestamping, to avoid unnecessary write amplification — see 09/10 docs for volume rationale.

## 4. Migration Strategy
- Single `schema.prisma` is the canonical model.
- Migrations generated via `prisma migrate dev` (local) / `prisma migrate deploy` (CI/CD, see 14-DEPLOYMENT-ARCHITECTURE.md).
- Python service **never** runs migrations; it only reads the already-migrated schema via `prisma-client-py generate`.
- Breaking schema changes require a documented migration plan noting backfill strategy for existing tenant data (no destructive migrations without a backfill/rollback plan recorded in the PR).

---

## 5. Entity Relationship Overview
```
Institute ──< Branch
Institute ──< User ──< StudentProfile / TeacherProfile
Institute ──< Batch ──< StudentProfile (enrollment)
Batch ──< BatchTeacher >── TeacherProfile
Institute ──< Subject ──< Chapter ──< Topic ──< Question ──< QuestionVersion
Blueprint ──< Paper ──< PaperVersion ──< PaperItem >── Question
Exam ──< Paper (used-by)
Exam ──< AnswerSheet ──< Response
StudentProfile ──< AnswerSheet
StudentProfile ──< MasteryScore >── Topic
StudentProfile ──< Intervention
StudentProfile ──< DoubtTicket >── TeacherProfile (resolves)
Institute ──< TimetableSlot
Institute ──< Assignment
Institute ──< Notice ──< NoticeDelivery
Institute ──< Report
Institute ──< AuditLog
Institute ──< AllowListEntry
```

---

## 6. Data Models (Field-Level Dictionary)

### 6.1 `Institute` (table: `institutes`)
| Column | Type | Nullable | Default | Unique | FK | Notes |
|---|---|---|---|---|---|---|
| id | uuid | No | gen_random_uuid() | Yes (PK) | — | |
| name | string | No | — | — | — | |
| domain | string | Yes | — | Yes | — | Primary email domain for allowlist matching |
| plan | enum(`TRIAL`,`BASIC`,`PRO`,`ENTERPRISE`) | No | `TRIAL` | — | — | |
| status | enum(`ACTIVE`,`SUSPENDED`,`ARCHIVED`) | No | `ACTIVE` | — | — | |
| logoUrl | string | Yes | — | — | — | |
| branding | json | Yes | — | — | — | colors, custom labels |
| createdAt | datetime | No | now() | — | — | |
| updatedAt | datetime | No | auto | — | — | |

### 6.2 `Branch` (table: `branches`)
| id (PK) | instituteId (FK→Institute) | name | address | isActive | createdAt |

### 6.3 `AllowListEntry` (table: `allow_list_entries`)
| id (PK) | instituteId (FK) | email | role (enum: FOUNDER/ADMIN/TEACHER/STUDENT) | branchId (FK, nullable) | invitedByUserId (FK→User, nullable) | createdAt |
Unique: `[instituteId, email]`

### 6.4 `User` (table: `users`)
| id (PK) | instituteId (FK) | email | googleSub (unique) | role (enum) | isActive | lastLoginAt | deletedAt | createdAt | updatedAt |
Unique: `[instituteId, email]`, `[googleSub]`

### 6.5 `StudentProfile` (table: `student_profiles`)
| id (PK) | userId (FK→User, unique) | instituteId (FK) | batchId (FK→Batch) | rollNumber | dateOfBirth | guardianName | guardianContact | address | profileImageUrl | documents (json array of URLs) | statusTags (string[]: e.g. "high-risk") | createdAt | updatedAt |
Unique: `[instituteId, rollNumber, batchId]`

### 6.6 `StudentHistory` (table: `student_history`) — immutable
| id (PK) | studentProfileId (FK) | changeType (enum: `BATCH_TRANSFER`/`PROMOTION`/`TAG_UPDATE`/`STATUS_CHANGE`) | oldValue (json) | newValue (json) | actorUserId (FK) | createdAt |

### 6.7 `TeacherProfile` (table: `teacher_profiles`)
| id (PK) | userId (FK, unique) | instituteId (FK) | qualifications (string[]) | subjectIds (string[]) | availability (json — weekly schedule blocks) | isReviewer (bool, default false) | createdAt | updatedAt |

### 6.8 `Batch` (table: `batches`)
| id (PK) | instituteId (FK) | branchId (FK, nullable) | name | academicYear | createdAt | deletedAt |
Unique: `[instituteId, name, academicYear]`

### 6.9 `BatchTeacher` (table: `batch_teachers`) — join
| id (PK) | batchId (FK) | teacherProfileId (FK) | subjectId (FK) | assignedAt | removedAt (nullable) |
Unique: `[batchId, teacherProfileId, subjectId]` (active constraint applies where `removedAt IS NULL`)

### 6.10 `Subject` (table: `subjects`)
| id (PK) | instituteId (FK) | name | order | deletedAt | createdAt |
Unique: `[instituteId, name]`

### 6.11 `Chapter` (table: `chapters`)
| id (PK) | subjectId (FK) | name | order | deletedAt | createdAt |

### 6.12 `Topic` (table: `topics`)
| id (PK) | chapterId (FK) | name | order | deletedAt | createdAt |

### 6.13 `Question` (table: `questions`)
| id (PK) | instituteId (FK) | topicId (FK) | authorUserId (FK) | type (enum: 7 values) | content (text/markdown) | options (json, nullable) | correctAnswer (json) | answerTolerance (float, nullable — NUMERICAL only) | difficulty (enum: EASY/MEDIUM/HARD) | marks (int) | solutionExplanation (text) | qualityScore (float, nullable) | isApproved (bool, default false) | approvedByUserId (FK, nullable) | approvedAt (nullable) | deletedAt | createdAt | updatedAt |

### 6.14 `QuestionVersion` (table: `question_versions`) — immutable
| id (PK) | questionId (FK) | versionNumber (int) | contentSnapshot (json — full question state at that version) | editedByUserId (FK) | createdAt |
Unique: `[questionId, versionNumber]`

### 6.15 `Blueprint` (table: `blueprints`)
| id (PK) | instituteId (FK) | name | subjectIds (string[]) | totalMarks | durationMinutes | instructions (text) | topicDistribution (json) | createdByUserId (FK) | createdAt |

### 6.16 `Paper` (table: `papers`)
| id (PK) | instituteId (FK) | blueprintId (FK, nullable) | title | totalMarks | isAiGenerated (bool) | targetStudentId (FK→StudentProfile, nullable — personalized papers) | createdByUserId (FK) | createdAt |

### 6.17 `PaperVersion` (table: `paper_versions`) — anti-cheating sets
| id (PK) | paperId (FK) | label (e.g. "Set A") | shuffleSeed (string) | questionOrder (json array of questionIds) | createdAt |
Unique: `[paperId, label]`

### 6.18 `PaperItem` (table: `paper_items`)
| id (PK) | paperId (FK) | questionId (FK) | questionVersionId (FK — pinned snapshot) | order | marksOverride (int, nullable) |

### 6.19 `Exam` (table: `exams`)
| id (PK) | instituteId (FK) | batchId (FK) | paperId (FK) | title | status (enum: 7-state) | version (int, default 1 — optimistic lock) | scheduledStart | scheduledEnd | captureMode (enum: MANUAL_GRID/CSV_IMPORT/PHOTO_CAPTURE/OMR_IMPORT) | unlockReason (text, nullable) | createdByUserId (FK) | createdAt | updatedAt |

### 6.20 `AnswerSheet` (table: `answer_sheets`)
| id (PK) | examId (FK) | studentProfileId (FK) | paperVersionId (FK, nullable) | sourceMode (enum, same as captureMode) | rawFileUrl (nullable — photo/OMR source) | status (enum: SUBMITTED/DUPLICATE/UNDER_REVIEW/FINALIZED) | isActiveAttempt (bool, default true — see constraint note) | submittedAt | createdAt |
**Uniqueness (implementation-explicit, corrected — see V2 §3.4):** `@@unique([examId, studentProfileId, isActiveAttempt])` where `isActiveAttempt` is `true` for the one live submission and is flipped to `false` (never deleted) on every row that becomes superseded/duplicate. This is a standard Prisma-expressible unique constraint — **not** a partial index — and requires no raw SQL. When a duplicate submission arrives: the existing `isActiveAttempt=true` row is left untouched, and the new row is inserted directly with `isActiveAttempt=false, status=DUPLICATE` (never toggled after the fact), so the constraint is never transiently violated.

### 6.21 `ScoreRecord` (table: `score_records`)
| id (PK) | examId (FK) | studentProfileId (FK) | totalMarksAwarded | totalMarksAvailable | percentage | rank (nullable, computed post-finalization) | isFinal (bool) | createdAt | updatedAt |
Unique: `[examId, studentProfileId]`

### 6.22 `Response` (table: `responses`) — immutable once exam LOCKED
| id (PK) | answerSheetId (FK) | questionId (FK) | questionVersionId (FK) | studentAnswer (json) | isCorrect (bool, nullable — null until graded) | marksAwarded (float, nullable) | mistakeTagType (enum, nullable: 6 values) | teacherComment (text, nullable) | gradedByUserId (FK, nullable) | gradedAt (nullable) |

### 6.23 `MasteryScore` (table: `mastery_scores`)
| id (PK) | studentProfileId (FK) | topicId (FK) | score (float 0.0–1.0, nullable until first data point) | trendDelta (float, nullable) | sampleCount (int) | lastCalculatedAt |
Unique: `[studentProfileId, topicId]`

### 6.24 `Intervention` (table: `interventions`)
| id (PK) | studentProfileId (FK) | topicId (FK) | status (enum: OPEN/ASSIGNMENT_CREATED/EXTRA_CLASS_SCHEDULED/RESOLVED) | triggeredByMasteryScoreId (FK) | assignmentId (FK, nullable) | timetableSlotId (FK, nullable) | createdAt | resolvedAt (nullable) |

### 6.25 `TimetableSlot` (table: `timetable_slots`)
| id (PK) | instituteId (FK) | batchId (FK, nullable) | teacherProfileId (FK, nullable) | slotType (enum: CLASS/EXAM/REVISION/REMEDIAL/EXTRA_CLASS/BREAK/HOLIDAY) | startTime | endTime | recurRule (string, iCal RRULE, nullable) | roomRef (string, nullable) | createdAt |

### 6.26 `DoubtTicket` (table: `doubt_tickets`)
| id (PK) | studentProfileId (FK) | subjectId (FK) | topicId (FK, nullable) | urgency (int 1–3) | queryText | attachmentUrls (string[]) | status (enum: OPEN/ASSIGNED/ANSWERED/CLOSED/ESCALATED) | assignedTeacherId (FK, nullable) | responseText (nullable) | createdAt | resolvedAt (nullable) |

### 6.27 `Assignment` (table: `assignments`)
| id (PK) | instituteId (FK) | batchId (FK, nullable) | studentProfileId (FK, nullable — mutually exclusive with batchId) | title | description | dueDate | attachedQuestionIds (string[]) | isAutoGenerated (bool) | interventionId (FK, nullable) | createdByUserId (FK, nullable — null if system-generated) | createdAt |

### 6.28 `Notice` (table: `notices`)
| id (PK) | instituteId (FK) | title | body | channels (enum[]: IN_APP/EMAIL/SMS/WHATSAPP) | targetAudience (json) | createdByUserId (FK) | createdAt |

### 6.29 `NoticeDelivery` (table: `notice_deliveries`)
| id (PK) | noticeId (FK) | userId (FK) | channel (enum) | status (enum: QUEUED/SENT/DELIVERED/FAILED/READ) | failureReason (nullable) | sentAt (nullable) | readAt (nullable) |

### 6.30 `Report` (table: `reports`)
| id (PK) | instituteId (FK) | type (enum: 6 values) | scope (json — studentId/batchId/dateRange) | format (enum: PDF/EXCEL) | status (enum: QUEUED/PROCESSING/COMPLETE/FAILED) | fileUrl (nullable) | requestedByUserId (FK) | createdAt | completedAt (nullable) |

### 6.31 `AuditLog` (table: `audit_logs`) — immutable, insert-only
| id (PK) | instituteId (FK, nullable for FOUNDER-global actions) | actorUserId (FK) | action (enum: CREATE/UPDATE/DELETE/APPROVE/PUBLISH/LOCK/UNLOCK/ROLE_CHANGE/LOGIN_FAILED) | entity (string) | entityId (string) | oldValue (json, nullable) | newValue (json, nullable) | ipAddress | userAgent | createdAt |

---

## 7. Indexes (High-Cardinality / Hot-Path)
| Table | Index | Reason |
|---|---|---|
| users | `[instituteId, role]` | role-scoped directory queries |
| student_profiles | `[instituteId, batchId]` | batch roster queries |
| questions | `[topicId, isApproved, difficulty]` | Blueprint Agent selection queries |
| exams | `[instituteId, status]` | dashboard "pending" lists |
| answer_sheets | `[examId, studentProfileId]` | duplicate-submission checks |
| responses | `[answerSheetId]`, `[questionId]` | grading + analytics joins |
| mastery_scores | `[studentProfileId, topicId]` | radar chart lookups, intervention triggers |
| interventions | `[studentProfileId, status]` | teacher remediation dashboards |
| audit_logs | `[instituteId, createdAt]`, `[actorUserId, createdAt]` | audit trail filtering |
| notice_deliveries | `[noticeId, status]` | delivery report aggregation |

## 8. Constraints Summary
- All FK relations use `ON DELETE RESTRICT` by default for historically significant data (`Response`, `ScoreRecord`, `AuditLog`, `QuestionVersion`), and `ON DELETE CASCADE` only for pure ownership hierarchies scoped to a soft-deletable parent (e.g., `Branch` cascades from `Institute`; `Chapter`/`Topic` cascade from `Subject`/`Chapter` **as soft-delete propagation in application logic**, not raw DB cascade, to preserve Question linkage).
- `Institute` deletion is never a hard DB operation in production; it is a `status = ARCHIVED` administrative action gated to FOUNDER only.

## 9. Prisma Dual-Client Parity
- `packages/db/prisma/schema.prisma` is generated once; both `pnpm --filter api prisma generate` (TS client) and the Python service's `prisma generate --generator client-py` (or equivalent) consume the identical schema file — **no service maintains its own copy of the model definitions.**
- Any schema change requires a coordinated release: migration deploy → regenerate both clients → deploy both services together.


---



---

# PART 2 — V2 EXTENSIONS (merged from 04-DATABASE-SCHEMA.md (V2 section))

## AIOS — Academic Intelligence Operating System

---

## 1. New Models

### 1.1 `Assessment` (table: `assessments`)
| id (PK) | instituteId (FK) | title | assessmentKind (enum: COACHING_TEST/SCHOOL_THEORY_EXAM/PRACTICE_TEST/DIAGNOSTIC/HOMEWORK_GRADED) | stakesLevel (enum: GRADED/PRACTICE/DIAGNOSTIC_ONLY) | subjectIds (string[]) | paperId (FK→Paper, nullable) | totalMarks | gradeLevel | createdByUserId | createdAt |

**Fix #3 — `assessmentKind` renamed and narrowed in scope (was `assessmentType`).** `assessmentKind` now describes *only* the pedagogical purpose/category of the assessment (what it's for) and carries **no workflow behavior**. It previously implicitly influenced capture and evaluation behavior, which is incorrect — a `SCHOOL_THEORY_EXAM` and a `PRACTICE_TEST` may both use `PHOTO_CAPTURE_SUBJECTIVE` capture and either `MANUAL` or `AI_ASSIST` evaluation; the kind alone must not determine this. Workflow behavior is now controlled by three independent dimensions, set per `AssessmentDelivery` (§1.2), not inferred from `assessmentKind`:
- **`CaptureProvider`** (§1.5, unchanged) — *how evidence is captured* (OMR, manual grid, CSV, photographed objective, photographed subjective).
- **`EvaluationPolicy`** (new, §1.2a below) — *how evidence is scored* (automatic, manual-only, AI-assisted-with-mandatory-human-review, AI-final for low-stakes only).
- **`stakesLevel`** (new field above) — *what the score is used for* (an official grade, ungraded practice, pure diagnostic) — this is what actually gates whether AI-final-scoring is permissible under `32-AI-GOVERNANCE-POLICY.md` §2, **not** `assessmentKind`. A `PRACTICE_TEST` kind with `stakesLevel=GRADED` (e.g., a graded practice test that still counts toward a report card) correctly still requires human evaluation — the governance gate checks `stakesLevel`, never `assessmentKind`.

### 1.2 `AssessmentDelivery` (table: `assessment_deliveries`)
| id (PK) | assessmentId (FK) | batchId (FK) | status (enum: 7-state, unchanged values from v1 Exam.status) | version (int, optimistic lock) | scheduledStart | scheduledEnd | captureProviderId (FK) | evaluationPolicyId (FK, new — §1.2a) | unlockReason (nullable) | createdByUserId | createdAt | updatedAt |

### 1.2a `EvaluationPolicy` (table: `evaluation_policies`) — new, fix #3
| id (PK) | instituteId (FK) | name | mode (enum: AUTOMATIC/MANUAL_ONLY/AI_ASSIST_MANDATORY_REVIEW/AI_FINAL_LOW_STAKES) | requiresHumanReview (bool, derived-but-stored for fast gate checks) | createdAt |
**Business rule (enforced at the `AssessmentDelivery.status → LOCKED` gate, per `32-AI-GOVERNANCE-POLICY.md` §2):** `mode = AI_FINAL_LOW_STAKES` is only a legal selection when the parent `Assessment.stakesLevel != GRADED`. This reconciliation is validated server-side at `AssessmentDelivery` creation time — an attempt to pair a graded, official assessment with an AI-final policy is rejected (`422 EVALUATION_POLICY_STAKES_MISMATCH`, new error code), not silently allowed and caught only later at the lock gate.

### 1.3 `Attempt` (table: `attempts`)
| id (PK) | assessmentDeliveryId (FK) | studentProfileId (FK) | status (enum: IN_PROGRESS/SUBMITTED/DUPLICATE/UNDER_EVALUATION/FINALIZED) | isActiveAttempt (bool, default true) | submittedAt | createdAt |
**Uniqueness (corrected, fix #2 below):** `@@unique([assessmentDeliveryId, studentProfileId, isActiveAttempt])` — same `isActiveAttempt` pattern as `AnswerSheet` (§6.20), applied consistently across both the legacy and v2 tables. **This replaces the earlier "soft unique where status != DUPLICATE" wording**, which was not a directly implementable Prisma construct and would have forced the coding agent to either invent a raw-SQL partial index or silently skip the constraint. `isActiveAttempt` is a plain boolean column, indexed, expressible as a standard `@@unique` in `schema.prisma` with zero raw SQL required.
**Note on `documentId` — removed from this table.** Per fix #7 (§3.5 below), `Attempt` does not hold a `documentId` FK. The relationship is one-directional: `Document → IdentityResolution → Attempt`. See §3.5 for the corrected ownership model.

### 1.4 `Response` (table: `responses`) — **redefined**, see §3.1 for migration note
| id (PK) | attemptId (FK) | questionId (FK) | questionVersionId (FK) | evidenceType (enum: DIGITAL_VALUE/OMR_MARK/PAGE_REGION) | digitalValue (json, nullable) | questionRegionId (FK, nullable) | isCorrect (bool, nullable — objective types only) | createdAt |
*Removed fields (moved to `EvaluationVersion`): `marksAwarded`, `mistakeTagType`, `teacherComment`, `gradedByUserId`, `gradedAt`.*

### 1.5 `CaptureProvider` (table: `capture_providers`)
| id (PK) | instituteId (FK) | type (enum: OMR/MANUAL_GRID/CSV_IMPORT/PHOTO_CAPTURE_OBJECTIVE/PHOTO_CAPTURE_SUBJECTIVE) | config (json) | createdAt |

### 1.6 `DocumentBundle` (table: `document_bundles`)
| id (PK) | assessmentDeliveryId (FK) | uploadedByUserId (FK) | expectedDocumentCount (int, nullable) | status (enum: UPLOADING/PROCESSING/PARTIALLY_RESOLVED/COMPLETE/FAILED) | createdAt |

### 1.7 `Document` (table: `documents`)
| id (PK) | documentBundleId (FK, nullable) | attemptId (FK, nullable — populated only after identity resolution confirms/creates the link) | expectedPageCount (int, nullable) | layoutType (enum: TEMPLATE_KNOWN/FREE_FORM — new, fix #4, see `23-DOCUMENT-PROCESSING-ARCHITECTURE.md` §4.0; set at ingest from `CaptureProvider.config.bookletTemplateId` presence) | status (enum: UPLOADED/PAGE_PROCESSING/IDENTITY_PENDING/REGION_MAPPING/READY_FOR_EVALUATION/FAILED) | createdAt |

**Fix #7 — canonical ownership direction (was ambiguous/circular).** The relationship between `Document` and `Attempt` is **one-directional only**: `Document.attemptId` is the single FK connecting them. `Attempt` **does not** hold a `documentId` field (removed from §1.3 above). The flow is strictly:
```
Document  →  IdentityResolution  →  (creates or links)  →  Attempt
```
`Document.attemptId` starts `null`, is populated exclusively by the `IdentityResolution` workflow (`30-IDENTITY-PAGE-MAPPING.md`) once a match is confirmed — either linking to a pre-existing `Attempt` (if one was already created via another path, e.g., a roster pre-population) or causing a new `Attempt` to be created with `status=UNDER_EVALUATION`. No code path may set `Document.attemptId` outside the `IdentityResolution` confirmation action, and no `Attempt` field ever points back to a `Document` — if a UI needs "the document behind this attempt," it queries `Document WHERE attemptId = :attemptId`, never the reverse via a stored FK. This removes the prior ambiguity where both entities appeared to reference each other.

### 1.8 `Page` (table: `pages`)
| id (PK) | documentId (FK) | pageNumber (int) | status (enum: PENDING/PROCESSED/FLAGGED) |
Unique: `[documentId, pageNumber]`

### 1.9 `PageImage` (table: `page_images`)
| id (PK) | pageId (FK) | rawImageUrl | processedImageUrl (nullable) | deskewAngle (float, nullable) | qualityScore (float, nullable) | createdAt |

### 1.10 `PageRegion` (table: `page_regions`) — also serves as `QuestionRegion` when `questionId` is non-null (§ per `23`)
| id (PK) | pageImageId (FK) | boundingBox (json: {x,y,width,height}) | regionType (enum: QUESTION_ANSWER/HEADER/MARGIN/ROLL_NUMBER_FIELD/SIGNATURE/UNCLASSIFIED) | questionId (FK, nullable) | detectionMethod (enum: AUTO_LAYOUT_DETECTION/MANUAL_TEACHER_MARKUP/TEMPLATE_MATCHED) | detectionConfidence (float, nullable) | createdAt |

### 1.11 `OCRBlock` (table: `ocr_blocks`)
| id (PK) | questionRegionId (FK→PageRegion) | blockType (enum: PRINTED_TEXT/HANDWRITTEN_TEXT/MATHEMATICAL_EXPRESSION/DIAGRAM_SKETCH/TABLE) | boundingBox (json) |

### 1.12 `OCRResult` (table: `ocr_results`)
| id (PK) | ocrBlockId (FK) | extractedText (text, nullable) | confidence (float) | alternativeReadings (json, nullable) | aiModelVersionId (FK → `AIModelVersion`, §1.26 — replaces bare `engineUsed` string, fix #6) | processedAt |

### 1.13 `ProcessingJob` (table: `processing_jobs`)
| id (PK) | documentId (FK) | stage (enum: VALIDATE/DESKEW/PAGE_ORDER/IDENTITY_RESOLVE/REGION_DETECT/LAYOUT_ANALYSIS/OCR/QUESTION_MAP — `LAYOUT_ANALYSIS` added per fix #4, used only for `layoutType=FREE_FORM` documents) | status (enum: QUEUED/RUNNING/SUCCEEDED/FAILED) | attemptCount (int) | startedAt (nullable) | completedAt (nullable) |

### 1.14 `ProcessingArtifact` (table: `processing_artifacts`)
| id (PK) | processingJobId (FK) | artifactType (string) | data (json or storage reference) | createdAt |

### 1.15 `Annotation` (table: `annotations`)
| id (PK) | pageImageId (FK) | authorUserId (FK) | boundingBox (json, nullable) | annotationType (enum: CIRCLE/TICK/CROSS/COMMENT) | text (nullable) | createdAt |

### 1.16 `IdentityResolution` (table: `identity_resolutions`)
| id (PK) | documentId (FK, unique) | method (enum: BARCODE/ROLL_NUMBER_OCR/QR_CODE/MANUAL_ADMIN_MATCH) | candidateStudentProfileId (FK, nullable) | confidence (float) | resolvedStudentProfileId (FK, nullable) | resolvedByUserId (FK, nullable) | status (enum: PENDING/AUTO_RESOLVED/MANUALLY_CONFIRMED/MANUALLY_CORRECTED/UNRESOLVED) | createdAt | resolvedAt (nullable) |

### 1.17 `Rubric` (table: `rubrics`)
| id (PK) | instituteId (FK) | questionId (FK) | name | maxMarks | scoringMode (enum: CRITERION_ADDITIVE/STEP_WISE/HOLISTIC_WITH_GUIDANCE) | createdByUserId | createdAt |

### 1.18 `RubricVersion` (table: `rubric_versions`)
| id (PK) | rubricId (FK) | versionNumber (int) | criteriaSnapshot (json) | editedByUserId (FK) | createdAt |
Unique: `[rubricId, versionNumber]`

### 1.19 `RubricCriterion` (table: `rubric_criteria`)
| id (PK) | rubricVersionId (FK) | order (int) | description | maxMarks | keywordHints (string[], nullable) | dependsOnCriterionId (FK, nullable, self-ref) |

### 1.20 `Evaluation` (table: `evaluations`)
| id (PK) | responseId (FK, unique) | currentEvaluationVersionId (FK, nullable) | status (enum: PENDING/AI_SUGGESTED/TEACHER_REVIEWED/REVIEWER_FINALIZED) |

### 1.21 `EvaluationVersion` (table: `evaluation_versions`) — immutable
| id (PK) | evaluationId (FK) | previousVersionId (FK, nullable, self-ref) | source (enum: AI/TEACHER/REVIEWER) | authorUserId (FK, nullable) | marksAwarded (float) | mistakeTagType (enum, nullable — v1's 6-value MistakeTagType, extensible) | teacherComment (text, nullable) | aiRecommendationId (FK, nullable) | disputeReason (text, nullable) | createdAt |

### 1.22 `EvaluationCriterionScore` (table: `evaluation_criterion_scores`)
| id (PK) | evaluationVersionId (FK) | rubricCriterionId (FK) | marksAwarded (float) | note (text, nullable) |

### 1.23 `AIRecommendation` (table: `ai_recommendations`) — **expanded for full reproducibility, fix #5**
| id (PK) | responseId (FK) | questionVersionId (FK — pins exact question content used) | rubricVersionId (FK, nullable — pins exact rubric used) | evidenceRef (json: `{ evidenceType, digitalValue? , ocrResultId? }` — exactly what evidence was scored) | ocrResultId (FK, nullable — pins exact OCR extraction used, if any) | evaluationPolicyId (FK — which policy authorized this AI attempt) | aiModelVersionId (FK → `AIModelVersion`, §1.24 — replaces the old bare `modelVersion` string) | promptVersionId (FK → `PromptVersion`, §1.26) | modelParameters (json — e.g. temperature, max_tokens, any provider-specific config actually used for this call) | inputArtifactHash (string — SHA-256 of the exact serialized input payload sent to the model, for tamper-evidence and exact-reproduction verification) | suggestedMarks (float) | suggestedCriterionScores (json, nullable) | confidence (float) | flags (string[]) | createdAt |

**Fix #5 rationale:** the previous shape (`modelVersion` string alone) could not answer "why did AI give 4/10 six months ago" with full confidence, because the question/rubric content, the exact evidence shown to the model, and the model's exact configuration could all have changed since. Every field above is either an immutable FK (to a versioned entity) or a content hash, so the full input context of any historical `AIRecommendation` is reconstructable byte-for-byte, not just "which model" but "which exact question wording, which exact rubric wording, which exact evidence, which exact prompt, which exact parameters."

### 1.24 `AIProvider` (table: `ai_providers`) — new, fix #6
| id (PK) | name (e.g. "OpenAI", "Google", "Anthropic", "self-hosted") | createdAt |

### 1.25 `AIModel` (table: `ai_models`) — new, fix #6
| id (PK) | aiProviderId (FK) | name (e.g. "gpt-4o", "gemini-1.5-pro" — a logical model family, not a specific dated snapshot) | purpose (enum: EVALUATION/OCR/HANDWRITING — which pipeline this model serves) | createdAt |

### 1.26 `AIModelVersion` (table: `ai_model_versions`) — new, fix #6
| id (PK) | aiModelId (FK) | versionLabel (e.g. "2024-08-06", "v1.2") | isActive (bool — whether this version may currently be selected for new evaluations) | deprecatedAt (nullable) | createdAt |

### 1.27 `PromptVersion` (table: `prompt_versions`) — new, fix #6
| id (PK) | aiModelId (FK) | versionLabel | promptTemplate (text — the actual template used, with placeholders) | createdByUserId (FK) | createdAt |

**Fix #6 rationale:** these four tables form an explicit model registry so that no evaluation-domain code may hardcode a vendor SDK call (e.g., an `OpenAIService` or `GeminiService` invoked directly from `evaluation/ai_evaluator.py`). All AI calls resolve `AIProvider → AIModel → AIModelVersion` + `PromptVersion` from these tables at call time, and every `AIRecommendation` records exactly which rows were used (§1.23). Adding a new provider/model/prompt version is a data change, not a code change, in the evaluation pipeline itself — the abstraction boundary is enforced by this registry existing as the only path to a model invocation, not by convention alone.

## 2. New Enums
```
AssessmentKind: COACHING_TEST | SCHOOL_THEORY_EXAM | PRACTICE_TEST | DIAGNOSTIC | HOMEWORK_GRADED  (renamed from AssessmentType — fix #3, carries no workflow behavior)
StakesLevel: GRADED | PRACTICE | DIAGNOSTIC_ONLY  (new — fix #3, this is what gates AI-final-scoring eligibility, not AssessmentKind)
EvaluationPolicyMode: AUTOMATIC | MANUAL_ONLY | AI_ASSIST_MANDATORY_REVIEW | AI_FINAL_LOW_STAKES  (new — fix #3)
EvidenceType: DIGITAL_VALUE | OMR_MARK | PAGE_REGION
CaptureProviderType: OMR | MANUAL_GRID | CSV_IMPORT | PHOTO_CAPTURE_OBJECTIVE | PHOTO_CAPTURE_SUBJECTIVE
DocumentBundleStatus: UPLOADING | PROCESSING | PARTIALLY_RESOLVED | COMPLETE | FAILED
DocumentStatus: UPLOADED | PAGE_PROCESSING | IDENTITY_PENDING | REGION_MAPPING | READY_FOR_EVALUATION | FAILED
PageStatus: PENDING | PROCESSED | FLAGGED
RegionType: QUESTION_ANSWER | HEADER | MARGIN | ROLL_NUMBER_FIELD | SIGNATURE | UNCLASSIFIED
DetectionMethod: AUTO_LAYOUT_DETECTION | MANUAL_TEACHER_MARKUP | TEMPLATE_MATCHED
OCRBlockType: PRINTED_TEXT | HANDWRITTEN_TEXT | MATHEMATICAL_EXPRESSION | DIAGRAM_SKETCH | TABLE
ProcessingStage: VALIDATE | DESKEW | PAGE_ORDER | IDENTITY_RESOLVE | REGION_DETECT | LAYOUT_ANALYSIS | OCR | QUESTION_MAP  (LAYOUT_ANALYSIS added, fix #4 — used only by layoutType=FREE_FORM documents, see `23` §4.1)
DocumentLayoutType: TEMPLATE_KNOWN | FREE_FORM  (new — fix #4)
ProcessingJobStatus: QUEUED | RUNNING | SUCCEEDED | FAILED
IdentityMethod: BARCODE | ROLL_NUMBER_OCR | QR_CODE | MANUAL_ADMIN_MATCH
IdentityStatus: PENDING | AUTO_RESOLVED | MANUALLY_CONFIRMED | MANUALLY_CORRECTED | UNRESOLVED
RubricScoringMode: CRITERION_ADDITIVE | STEP_WISE | HOLISTIC_WITH_GUIDANCE
EvaluationStatus: PENDING | AI_SUGGESTED | TEACHER_REVIEWED | REVIEWER_FINALIZED
EvaluationSource: AI | TEACHER | REVIEWER
AttemptStatus: IN_PROGRESS | SUBMITTED | DUPLICATE | UNDER_EVALUATION | FINALIZED
```

## 3. Changes to Existing v1 Models

### 3.1 `Response` — Field Migration
v1's `Response.marksAwarded`, `mistakeTagType`, `teacherComment`, `gradedByUserId`, `gradedAt` are **removed** from `Response` and become the seed content of a `TEACHER`-sourced `EvaluationVersion` for every existing v1 `Response` row, during migration:
```sql
-- Conceptual migration (full script lives in the actual migration file, not here)
INSERT INTO evaluations (id, response_id, status)
  SELECT gen_random_uuid(), id, 'TEACHER_REVIEWED' FROM responses WHERE graded_at IS NOT NULL;
INSERT INTO evaluation_versions (id, evaluation_id, source, author_user_id, marks_awarded, mistake_tag_type, teacher_comment, created_at)
  SELECT gen_random_uuid(), e.id, 'TEACHER', r.graded_by_user_id, r.marks_awarded, r.mistake_tag_type, r.teacher_comment, r.graded_at
  FROM responses r JOIN evaluations e ON e.response_id = r.id;
UPDATE evaluations SET current_evaluation_version_id = ev.id
  FROM evaluation_versions ev WHERE ev.evaluation_id = evaluations.id;
-- Only then: ALTER TABLE responses DROP COLUMN marks_awarded, DROP COLUMN mistake_tag_type, ...
```
This migration is **non-destructive and fully reversible** until the final `DROP COLUMN` step, which is run only after verifying row-count parity between `responses` (previously graded) and `evaluation_versions` (newly created).

### 3.2 `Question` — Additive Change
New nullable field: `rubricId` (FK → `Rubric`, nullable). No migration impact on existing rows.

### 3.3 `Exam` — Retained as Compatibility View
The v1 `Exam` table is **not dropped**. It becomes a view (or a thin table kept in sync via application logic, implementation-decision deferred to `20-IMPLEMENTATION-PLAN.md` (V2 section)) joining `Assessment` + `AssessmentDelivery` for the simple single-batch-single-schedule case, preserving `GET /exams/:id` response shape exactly. `AnswerSheet` similarly becomes a compatibility view over `Attempt` for non-document-backed attempts.

## 4. New Indexes
| Table | Index | Reason |
|---|---|---|
| assessment_deliveries | `[instituteId via assessment, status]` | mirrors v1 exams status-filter index |
| attempts | `@@unique([assessmentDeliveryId, studentProfileId, isActiveAttempt])`, `[assessmentDeliveryId, studentProfileId]` (non-unique, for lookup) | corrected duplicate-attempt constraint, fix #2 — see §1.3 |
| answer_sheets | `@@unique([examId, studentProfileId, isActiveAttempt])` | same corrected pattern applied to the legacy v1 table, fix #2 — see §6.20 |
| responses | `[attemptId]`, `[questionId]`, `[evidenceType]` | grading/pipeline queries |
| documents | `[documentBundleId, status]`, `[attemptId]` | processing queue queries; `attemptId` FK per the one-directional model, fix #7 |
| processing_jobs | `[documentId, stage, status]` | pipeline orchestration |
| evaluations | `[responseId]` (unique) | fast current-state lookup |
| evaluation_versions | `[evaluationId, createdAt]` | chain traversal, history queries |
| identity_resolutions | `[status]`, `[documentId]` (unique) | manual-review queue |
| ai_recommendations | `[responseId, createdAt]`, `[aiModelVersionId]`, `[promptVersionId]` | reprocessing history, fix #5 reproducibility queries |
| ai_model_versions | `[aiModelId, isActive]` | resolving the currently-active model for a new evaluation call, fix #6 |

## 5. Constraints Summary — Additions to v1 §8
- `EvaluationVersion` rows are **never** UPDATE'd or DELETE'd at the application DB-role level, same insert-only discipline as `AuditLog` (v1 §8, extended here to a second table).
- `Response.evidenceType` determines which of `digitalValue`/`questionRegionId` must be non-null — enforced at the application/DTO validation layer (Prisma doesn't natively express this XOR constraint; a CHECK constraint may additionally be added at the DB level as defense-in-depth).
- `Rubric.maxMarks` and the sum of its current `RubricVersion`'s `RubricCriterion.maxMarks` must reconcile — enforced at the application layer on write, per `26-RUBRIC-EVALUATION-SPECIFICATION.md` §5.
- **`Attempt`/`AnswerSheet` uniqueness (fix #2, corrected):** `@@unique([assessmentDeliveryId, studentProfileId, isActiveAttempt])` is a plain composite unique index, fully expressible in `schema.prisma` with no raw SQL and no partial-index feature dependency. The insert-time rule (§1.3, §6.20) — new duplicates are inserted directly with `isActiveAttempt=false` rather than the existing row being toggled — means the constraint is satisfiable by construction and never needs a transactional toggle-then-insert dance that could race.
- **`Document.attemptId` / `Attempt` (fix #7, corrected):** the relationship is enforced one-directional at the schema level simply by `Attempt` having no `documentId` column at all — there is nothing to keep in sync or that could drift out of consistency, by construction.
- **`AssessmentDelivery.evaluationPolicyId` (fix #3):** application-layer validation at creation time rejects `EvaluationPolicy.mode = AI_FINAL_LOW_STAKES` paired with `Assessment.stakesLevel = GRADED` (`422 EVALUATION_POLICY_STAKES_MISMATCH`) — see §1.2a.

## 6. Prisma Dual-Client Parity
Unchanged discipline from v1 §9 — all 23 new models are added to the single `schema.prisma`; both NestJS and FastAPI clients are regenerated together on every schema change, deployed together, per `14-DEPLOYMENT-ARCHITECTURE.md` v1 §6 (unchanged).

---

# PART 3 — FOUNDER CONSOLE EXTENSIONS

Additive-only tables backing the Founder/Super-Admin dashboard's remaining screens (see the "Founder Console" implementation phases in `33-GAP-ANALYSIS-AND-BUILD-PLAN.md`). No v1/V2 table is touched or renamed; `Institute` gains only new nullable/relation fields.

### 3.1 `PlanDefinition` (table: `plan_definitions`) — Founder Console Phase 2
| plan (PK, enum InstitutePlan) | maxUsers (nullable) | maxStudents (nullable) | maxTeachers (nullable) | maxStorageGb (nullable) | maxAssessmentsPerMonth (nullable) | trialDurationDays (nullable) | defaultFeatureFlags (json) | updatedAt |

Limits are advisory/informational — surfaced on the Founder dashboard as usage-vs-limit. Write-time enforcement (blocking growth past a limit) is explicitly out of scope for this build; nothing fabricates an enforced limit that doesn't exist.

### 3.2 `InstitutePlanHistory` (table: `institute_plan_history`) — Founder Console Phase 2
| id (PK) | instituteId (FK) | fromPlan (nullable enum) | toPlan (enum) | changedByUserId | reason (nullable) | createdAt |
Append-only. Kept separate from the generic `AuditLog` so plan-change history can be rendered as a timeline without parsing generic old/new JSON.

`Institute` additions: `trialEndsAt` (nullable DateTime, set when plan moves to `TRIAL`).

### 3.3 `SupportTicket` (table: `support_tickets`) — Founder Console Phase 8
| id (PK) | instituteId (FK) | subject | description | status (enum: OPEN/IN_PROGRESS/RESOLVED/CLOSED) | priority (enum: LOW/MEDIUM/HIGH/URGENT) | createdByUserId | assignedToUserId (nullable) | createdAt | updatedAt | resolvedAt (nullable) |

A genuinely new subsystem — no prior backend existed, only a mock UI. ADMIN creates/replies within their own institute; FOUNDER has cross-tenant status/priority/assignment control.

### 3.4 `SupportTicketMessage` (table: `support_ticket_messages`) — Founder Console Phase 8
| id (PK) | ticketId (FK) | authorUserId | body | createdAt |
