# 01 — Product Requirements Document (PRD)
## AIOS — Academic Intelligence Operating System

**Merged Status:** This file now includes both the original v1 baseline (Part 1) and the v2 extensions (Part 2) as a single current source of truth.
**Version:** 1.0.0 | **Status:** Source of Truth | **Owner:** Product

---

## 1. Product Name & One-Line Description
**AIOS (Academic Intelligence Operating System)** — a multi-tenant B2B SaaS platform that replaces administrative-only LMS/ERP tools with a closed-loop diagnostic-and-remediation engine for coaching institutes, schools, and academic chains.

## 2. Purpose
Traditional LMS/ERP systems record attendance, store documents, and display plain marks. AIOS instead treats every test as a diagnostic event: it classifies *why* a student lost marks, computes a per-topic mastery index, and automatically triggers remediation (homework, extra classes) — closing the loop between assessment and correction without manual teacher effort.

## 3. Target Users (Tenant Personas)
| Persona | Type | Primary Goal |
|---|---|---|
| Coaching Institute Owner/Founder-tenant Admin | ADMIN | Operational governance across branches, batches, exams |
| Subject Teacher / Faculty | TEACHER | Minimize grading/admin friction, maximize teaching time |
| Student | STUDENT | Understand *why* marks were lost and what to do next |
| AIOS Platform Owner | FOUNDER | Operate AIOS itself as a SaaS business across tenants |

## 4. Problems Being Solved
1. **The Score Illusion** — a 70/100 score does not explain whether the missing 30% was conceptual, procedural, careless, or unattempted.
2. **Cheating & Paper Fatigue** — manual creation of anti-cheating variant sets (Set A/B/C) for physical exam halls is slow and error-prone.
3. **Marks-Capture Friction** — most real classrooms still use paper/OMR; forcing digital-only entry causes delayed results and low adoption.
4. **Disconnected Remediation** — weak topics are usually discovered only at final exams, when it's too late to intervene.

## 5. Core Workflows
1. **Curriculum Setup** → Admin/Teacher define `Subject → Chapter → Topic` hierarchy.
2. **Question Authoring & Approval** → Teachers author questions (7 types, LaTeX/Markdown); Admin approves before use.
3. **Blueprint & Paper Generation** → Teacher defines a `Blueprint` (marks/duration/topic distribution); the AI Blueprint Agent (Python) auto-selects questions and produces anti-cheating `PaperVersion` sets.
4. **Exam Lifecycle** → Exam moves through the 7-stage state machine: `DRAFT → REVIEW → APPROVED → PUBLISHED → ONGOING → EVALUATING → LOCKED`.
5. **Multi-Mode Marks Capture** → `MANUAL_GRID`, `CSV_IMPORT`, `PHOTO_CAPTURE`, `OMR_IMPORT`.
6. **Evaluation & Error Tagging** → Teacher tags every wrong `Response` with one of 6 `MistakeTagType` values.
7. **Mastery Calculation** → Async Python service computes `MasteryScore` per `(studentProfileId, topicId)`.
8. **Remediation** → If mastery < 0.50, system auto-creates an `Intervention`: auto-generated `Assignment` and/or `EXTRA_CLASS` grouping.
9. **Communication & Reporting** → Notices broadcast across channels; formal `Report` documents (report cards, progress cards) are generated.

## 6. Features (Top-Level Inventory)
- Multi-tenant institute/branch management with pre-approved AllowList onboarding.
- 3-tier academic hierarchy (Subject/Chapter/Topic).
- Question Bank Engine (7 question types, versioning, approval workflow).
- AI Blueprint Agent (Python) for balanced, anti-cheating paper generation.
- 7-stage exam state machine with immutable unlock audit trail.
- 4-mode marks capture (Manual Grid, CSV, Photo, OMR).
- 6-tag Error Taxonomy engine.
- Real-time Topic Mastery Index (0.0–1.0) with trend (ΔM).
- Automated Intervention engine (homework + extra class generation).
- Doubt Resolution ticketing pipeline.
- Omnichannel Notice Center (In-App, Email, SMS, WhatsApp) with delivery receipts.
- Timetable & scheduling with iCal recurrence and conflict checks.
- Reports & Analytics engine (6 report types, PDF/Excel export).
- Immutable Audit Log across all sensitive actions.
- Founder/Platform-owner SaaS console (tenant provisioning, plans, feature flags, health).

## 7. User Roles (Summary — full matrix in 06-AUTH-AUTHORIZATION.md)
`FOUNDER > ADMIN > TEACHER > STUDENT` — strict 4-tier RBAC, tenant-scoped except FOUNDER.

## 8. Business Rules (Selected — full detail in 03-FEATURE-SPECIFICATIONS.md)
- A user can only authenticate if their email exists in `AllowListEntry` for that institute domain.
- All queries except FOUNDER-scoped ones must filter by `instituteId`; cross-tenant access is structurally forbidden.
- Subject names are unique per institute (`@@unique([instituteId, name])`).
- Questions default to `isApproved = false` until reviewed.
- An exam cannot skip a state in the 7-stage machine; `LOCKED → EVALUATING` requires an Admin-supplied `unlockReason`, and this transition is always audit-logged.
- `MasteryScore` < 0.50 is the hard threshold that triggers an `Intervention`.
- Every `Response` marked incorrect during evaluation should carry a `MistakeTagType` (recommended; enforced as a completion-quality gate on the evaluation queue, not a hard DB constraint).

## 9. Constraints
- Must support classrooms that are majority **offline/paper-based** — digital capture cannot be a hard requirement for exam execution.
- Must remain fast under evaluation load: marks submission must return **HTTP 200 in <300ms**, with all mastery/intervention computation deferred to async jobs.
- Must run as a **polyglot monorepo** (NestJS transactional core + FastAPI analytics/AI core) sharing one Prisma-defined schema across both languages.
- Must support **on-premise-feel multi-branch institutes** (single Institute → many Branches) without cross-tenant leakage.

## 10. Non-Goals (Phase 1)
- Not a payments/billing engine for tuition fee collection (may be added later, out of scope now).
- Not a full video-conferencing/LMS content-delivery platform.
- Not an automated proctoring system for remote online exams (no webcam/browser lockdown in Phase 1).
- Not a generic school ERP (no transport, hostel, or library management).
- No handwritten-OCR auto-grading in Phase 1 (Photo Capture requires human-in-the-loop grading; OCR is Phase 2).

## 11. Success Metrics
| Metric | Target |
|---|---|
| Time to generate an anti-cheating paper set | ≤ 3 clicks / < 2 minutes teacher effort |
| Marks-submission API latency (p95) | < 300 ms |
| % of tests with error-taxonomy tagging completed | > 80% within 48h of grading |
| Median time from exam LOCKED to Intervention created for weak students | < 5 minutes (async job) |
| Teacher adoption of Paper Builder vs. manual paper creation | > 70% of exams generated via AI Blueprint Agent by month 6 |
| Student weak-topic mastery improvement (ΔM) after intervention | positive ΔM in > 60% of remediated topics within one term |

## 12. Feature Specification Template (used across 03-FEATURE-SPECIFICATIONS.md)
```
Feature:
Purpose:
Who can use it:
Input:
Output:
Business logic:
Edge cases:
Permissions:
Failure behavior:
Acceptance criteria:
```
This structure is mandatory for every feature documented in this package so that no coding agent invents undocumented business logic.

## 13. Document Hierarchy of Truth
See `27` in the reference template — this package enforces:
1. Security requirements (07)
2. Product requirements (this doc)
3. Architecture (02)
4. API contracts (05)
5. Database contracts (04)
6. Coding standards (15)
7. UI/UX specifications (implicit in 03 + Vision doc)
8. Implementation details (20)

When two documents conflict, the higher-priority source wins, and the conflict must be reported, not silently resolved.


---



---

# PART 2 — V2 EXTENSIONS (merged from 01-PRODUCT-REQUIREMENTS.md (V2 section))

## AIOS — Academic Intelligence Operating System

---

## 1. What Changes and Why
v1's PRD defined AIOS around **testing → marks capture → diagnosis → remediation**, implicitly assuming objective/OMR-style grading as the norm. v2 extends the mission to explicitly and equally serve **school theory exams**: multi-question-type, handwritten, rubric-graded, human+AI-evaluated assessment — without weakening anything v1 already does well for coaching institutes.

## 2. Updated Mission Statement
**v1:** "give every teacher an AI co-pilot that generates balanced, anti-cheating test papers in 3 clicks, processes marks from any physical or digital medium, classifies student errors automatically, and delivers automated, topic-specific remedial interventions."

**v2 (extends, does not replace):** "...and evaluate any answer — objective or subjective, typed or handwritten — with the same diagnostic rigor, using AI-assisted evaluation that is always transparent, always human-accountable, and never a black box."

## 3. New/Expanded Problems Being Solved (extends v1 §4)
5. **The Subjective-Evaluation Bottleneck** — grading handwritten, multi-part theory answers is the single largest time cost for school teachers, and it's where v1's diagnostic philosophy (error taxonomy, mastery index) was previously unreachable, because no digital evidence of the answer existed to tag or measure.
6. **Evaluation Opacity** — students who lose marks on a theory question often can't see *why* beyond a total; there's no criterion-level transparency into what was and wasn't awarded.
7. **Grading Consistency** — different teachers (or the same teacher on different days) grading the same rubric can drift; nothing today ANY LMS/ERP does to leaves a reconstructable, auditable trail of *how* a subjective score was arrived at.

## 4. Updated Target Users (extends v1 §3)
| Persona | Type | Primary Goal (v2 addition) |
|---|---|---|
| School Subject Teacher | TEACHER | Evaluate handwritten theory answers with AI-assisted first-pass scoring, without losing the ability to see and trust the underlying evidence |
| Exam Coordinator / Reviewer | New scoped permission (`21-DOMAIN-MODEL-V2.md` §4.10, not a new hardcoded role) | Moderate evaluation quality, resolve disputes, spot-check AI-teacher agreement |

## 5. Updated Core Workflows (extends v1 §5)
The v1 workflow (steps 1–9) is entirely preserved for OMR/coaching-style assessments via the `CaptureProvider` abstraction (`29-CAPTURE-PROVIDER-ARCHITECTURE.md`). For school theory exams, the workflow gains these steps, inserted between v1's steps 5 (Multi-Mode Marks Capture) and 6 (Evaluation & Error Tagging):

5a. **Document Ingestion** — scanned/photographed booklets uploaded as a `DocumentBundle` (`23-DOCUMENT-PROCESSING-ARCHITECTURE.md`).
5b. **Identity Resolution** — each booklet matched to a student (`30-IDENTITY-PAGE-MAPPING.md`), conservatively, with mandatory human confirmation below a high confidence threshold.
5c. **Region & Question Mapping** — pages segmented into per-question regions, human-confirmable (`23` §4).
5d. **OCR/Handwriting Extraction** — text/math/diagram content extracted per region (`24-OCR-HANDWRITING-ARCHITECTURE.md`), never presented without the source image alongside it.
5e. **AI-Assisted First-Pass Evaluation** — subjective answers scored against a rubric (or holistically) with confidence + flags (`27-AI-EVALUATION-ARCHITECTURE.md`).
5f. **Human Evaluation** — teacher reviews/adjusts/accepts every AI suggestion; **mandatory**, never optional, for graded theory exams (`25-EVALUATION-ENGINE.md`, `32-AI-GOVERNANCE-POLICY.md`).
5g. **(Optional) Reviewer Override** — senior/moderator second pass for disputes or spot-checks.

Steps 6–9 (Error Tagging, Mastery, Remediation, Communication/Reporting) then apply identically, reading from the now-versioned `Evaluation` result rather than directly from `Response`.

## 6. New Features Inventory (adds to v1 §6)
- Unified Assessment domain (`Assessment`/`AssessmentDelivery`/`Attempt`) supporting both coaching and school exam types under one model.
- Document Processing pipeline for scanned/handwritten answer booklets.
- OCR/Handwriting Recognition with confidence-gated routing to human review.
- Rubric authoring, versioning, and criterion-level scoring.
- Versioned Evaluation Engine (AI → Teacher → Reviewer), never destructive.
- AI-assisted subjective evaluation, governed by an explicit AI Governance Policy.
- Identity & page-mapping resolution for scanned booklets.
- Digital Copy evaluation UX for teachers, reviewers, and students.
- Evaluation-quality analytics (AI-teacher agreement, reviewer override rate) for institute-level oversight.

## 7. Updated Business Rules (extends v1 §8)
- A `Response` is never graded by direct mutation; every score is a versioned `EvaluationVersion` (`25`).
- No AI-generated evaluation is ever terminal for a graded school theory exam without human review (`32` §2, hard state-machine gate).
- Identity resolution for scanned booklets never auto-links below a 0.95 confidence threshold by default (`30` §4).
- Rubric criterion marks must reconcile to question marks (`26` §5), same discipline as v1's Blueprint marks reconciliation.
- The v1 mastery formula and 0.50 threshold are unchanged; they now read from the current `Evaluation`, not directly from `Response`.

## 8. Updated Constraints (extends v1 §9)
- Must support **both** objective (OMR/MCQ) and subjective (handwritten/theory) assessment within the same platform, the same institute, and even the same `Assessment`, without forcing an institute to choose one mode exclusively.
- AI evaluation must degrade gracefully to fully-manual evaluation if the AI service is unavailable — grading must never be blocked by AI infrastructure (extends v1's "physical/paper-based classroom" resilience philosophy into the AI-evaluation domain).
- Raw scanned page images must be retained indefinitely as ground-truth evidence for dispute resolution.

## 9. Updated Non-Goals (extends v1 §10)
- **Not** a fully-automated grading system with no human in the loop for graded assessments — this is an explicit, permanent non-goal (governance policy, not a temporary Phase 1 limitation).
- **Not** attempting AI evaluation of diagrams/sketches/tables in v2 day one (`24` §3.3) — flagged for direct human evaluation instead.
- **Not** building a reusable cross-question rubric template library in v2 day one (`26` §3.1 note) — each rubric is question-specific initially; templating is a documented future extension.

## 10. Updated Success Metrics (extends v1 §11)
| Metric | Target |
|---|---|
| % of subjective responses receiving an AI first-pass suggestion before human evaluation begins | > 80% (where AI service available) |
| AI-teacher agreement rate (within 1 mark, criterion-additive rubrics) | Tracked as a quality baseline, target improving over time — not a launch gate |
| Time from document upload to "ready for evaluation" (full pipeline) | < 20 minutes for a 40-booklet batch (p95) |
| Identity-resolution manual-confirmation rate | Tracked; expected to decrease as institutes adopt barcode-based booklets over roll-number-OCR |
| Zero incidents of AI-final-scoring on a graded school theory exam | Hard requirement, monitored continuously, not a target with tolerance |

## 11. Updated Hierarchy of Truth
The v1 hierarchy (`01` v1 §13) is extended with `32-AI-GOVERNANCE-POLICY.md` inserted immediately after Security:
1. Security requirements (`07`)
2. **AI Governance Policy (`32`)** — new
3. Product requirements (this document)
4. Domain Model (`21`) and Architecture (`02`/`02-SYSTEM-ARCHITECTURE.md` (V2 section))
5. API contracts (`05`/`05-API-SPECIFICATION.md` (V2 section))
6. Database contracts (`04`/`04-DATABASE-SCHEMA.md` (V2 section))
7. Coding standards (`15`)
8. UI/UX specifications (`03`, `28`)
9. Implementation details (`20`/`20-IMPLEMENTATION-PLAN.md` (V2 section))
