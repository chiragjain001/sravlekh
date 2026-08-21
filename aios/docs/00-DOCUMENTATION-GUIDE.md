# 00 — Documentation Guide (Read This First)
## AIOS — Academic Intelligence Operating System

---

## Canonical Rule
**Files `01-PRODUCT-REQUIREMENTS.md` through `32-AI-GOVERNANCE-POLICY.md`, exactly as they exist in this folder, are the single authoritative documentation set.**

- Files `01` through `20` each contain the original v1 specification followed by a clearly marked **"V2 Extensions" / "V2 Addendum"** section.
- **Where a V2 section exists, it is authoritative.** Any earlier v1-only statement on the same topic elsewhere in that same file is superseded by its V2 section.
- Files `21` through `32` are v2-only architecture documents (no v1 predecessor existed for these topics).
- **There are no other files.** Do not search for, expect, or reference `01B`, `02B`, `04B`, `05B`, `16B`, `20B`, `33-V1-EXTENSIONS-ADDENDUM.md`, or any other `*B*`/`*-V2*` filename. These were intermediate drafts, already merged into `01`–`32`, and no longer exist. If any remaining text in these 32 files appears to reference such a filename, treat it as a documentation bug — the content it points to is already present in the same-numbered file's V2 section, not in a separate file.

## Reading Order for a Coding Agent
```
STEP 1   Read this file (00).
STEP 2   Read 01–20 in order (each is v1 baseline + V2 extensions, single source of truth).
STEP 3   Read 21–32 in order (v2-only architecture — domain model, assessment engine,
         document processing, OCR, evaluation engine, rubrics, AI evaluation, digital
         copy UX, capture providers, identity mapping, audit/versioning, AI governance).
STEP 4   Follow the Execution Protocol defined in 20-IMPLEMENTATION-PLAN.md.
```

## Hierarchy of Truth (Consolidated, Final)
When any two statements across these 32 files conflict, resolve in this order and **report the conflict rather than silently choosing**:
1. `07-SECURITY-SPECIFICATION.md`
2. `32-AI-GOVERNANCE-POLICY.md`
3. `01-PRODUCT-REQUIREMENTS.md`
4. `21-DOMAIN-MODEL-V2.md` and `02-SYSTEM-ARCHITECTURE.md`
5. `05-API-SPECIFICATION.md`
6. `04-DATABASE-SCHEMA.md`
7. `15-CODING-STANDARDS.md`
8. UI/UX specifications (`03-FEATURE-SPECIFICATIONS.md`, `28-DIGITAL-COPY-UX-SPECIFICATION.md`)
9. `20-IMPLEMENTATION-PLAN.md`

## Document Index
| # | File | Scope |
|---|---|---|
| 00 | DOCUMENTATION-GUIDE | This file |
| 01 | PRODUCT-REQUIREMENTS | What AIOS is, for whom, why |
| 02 | SYSTEM-ARCHITECTURE | Monorepo, services, data flow |
| 03 | FEATURE-SPECIFICATIONS | Per-feature business logic contracts |
| 04 | DATABASE-SCHEMA | Full data dictionary, all models |
| 05 | API-SPECIFICATION | Every endpoint's contract |
| 06 | AUTH-AUTHORIZATION | Roles, permissions, tenant boundary |
| 07 | SECURITY-SPECIFICATION | Non-negotiable security requirements |
| 08 | ERROR-HANDLING | Error envelope, codes, retry/failure behavior |
| 09 | CACHING-STRATEGY | Redis usage rules |
| 10 | SCALABILITY-STRATEGY | Target scale, bottleneck mitigations |
| 11 | PERFORMANCE-REQUIREMENTS | Measurable latency/throughput targets |
| 12 | LOGGING-MONITORING | Observability, alerts, log format |
| 13 | TESTING-STRATEGY | Test pyramid, coverage goals, required E2E workflows |
| 14 | DEPLOYMENT-ARCHITECTURE | CI/CD, environments, rollback |
| 15 | CODING-STANDARDS | Language rules, guardrails |
| 16 | FOLDER-STRUCTURE | Authoritative monorepo layout |
| 17 | THIRD-PARTY-INTEGRATIONS | Every external dependency's contract |
| 18 | EDGE-CASES | Explicit expected behavior for non-happy-paths |
| 19 | ACCEPTANCE-CRITERIA | Per-feature "definition of done" checklists |
| 20 | IMPLEMENTATION-PLAN | Phased build order, execution protocol |
| 21 | DOMAIN-MODEL-V2 | Core entity redesign (Assessment/Attempt/Response/Evaluation) |
| 22 | ASSESSMENT-ENGINE | Assessment/AssessmentDelivery/Attempt full spec |
| 23 | DOCUMENT-PROCESSING-ARCHITECTURE | Scan-to-region pipeline |
| 24 | OCR-HANDWRITING-ARCHITECTURE | Text/handwriting/math extraction |
| 25 | EVALUATION-ENGINE | Versioned AI→Teacher→Reviewer scoring |
| 26 | RUBRIC-EVALUATION-SPECIFICATION | Rubric/criterion model |
| 27 | AI-EVALUATION-ARCHITECTURE | AI scoring pipeline, confidence/flags |
| 28 | DIGITAL-COPY-UX-SPECIFICATION | Teacher/student/reviewer screens for document-based grading |
| 29 | CAPTURE-PROVIDER-ARCHITECTURE | Pluggable OMR/digital/document capture abstraction |
| 30 | IDENTITY-PAGE-MAPPING | Scanned-booklet-to-student matching |
| 31 | EVALUATION-AUDIT-VERSIONING | AuditLog vs. EvaluationVersion division of responsibility |
| 32 | AI-GOVERNANCE-POLICY | Non-negotiable AI usage boundaries |

## Known Open Items (Tracked, Not Yet Resolved in This Pack)
As of this version, the following items were flagged in review and are being actively fixed in this same pack — see the changelog note at the bottom of the relevant file for what changed and when:
- Partial-unique-constraint implementation for `Attempt` (`04-DATABASE-SCHEMA.md`).
- Separation of `AssessmentKind` / `DeliveryMode` / `CaptureProvider` / `EvaluationPolicy` / `StakesLevel` as independent dimensions (`21`, `22`, `04`).
- Dual-path Document Processing pipeline for template vs. free-form papers (`23`, `24`).
- Full reproducibility contract for AI evaluation (`04`, `25`, `27`).
- AI Model/Provider registry to prevent hardcoded vendor coupling (`04`, `27`).
- Single canonical `Document`↔`Attempt` ownership direction (`21`, `22`, `23`, `04`, `30`).
