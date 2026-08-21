# 16 — Folder Structure
## AIOS — Academic Intelligence Operating System

**Merged Status:** This file now includes both the original v1 baseline (Part 1) and the v2 extensions (Part 2) as a single current source of truth.
This is the authoritative monorepo layout. Coding agents must place new files according to this structure — do not invent parallel folders.

```
aios/  (e:\sarvlekh\aios)
│
├── apps/
│   ├── web/                                # Next.js 14/15 App Router — port 3000
│   │   └── src/
│   │       ├── app/
│   │       │   ├── login/page.tsx           # Google SSO login + role redirect
│   │       │   └── dashboard/
│   │       │       └── [role]/              # dynamic route per FOUNDER/ADMIN/TEACHER/STUDENT
│   │       ├── components/
│   │       │   └── dashboard/
│   │       │       ├── admin/screens/       # 13 Admin screens (05.1)
│   │       │       ├── teacher/screens/     # 12 Teacher screens (05.2)
│   │       │       ├── student/             # 14 Student screens (05.3)
│   │       │       └── founder/screens/     # 11 Founder screens (05.4)
│   │       ├── hooks/                       # shared React hooks (useAuth, useMastery, etc.)
│   │       ├── lib/                         # API client, fetch wrappers, auth cookie helpers
│   │       └── styles/
│   │
│   ├── api/                                 # NestJS backend — port 4000
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── auth/                        # Google OAuth, AllowList, JWT guards
│   │       ├── institutes/                  # Institute, Branch, AllowListEntry
│   │       ├── users/                       # User, StudentProfile, TeacherProfile, StudentHistory
│   │       ├── academics/                   # Subject, Chapter, Topic
│   │       ├── questions/                   # Question, QuestionVersion, approval workflow
│   │       ├── papers/                      # Blueprint, Paper, PaperVersion, PaperItem, AI-proxy
│   │       ├── exams/
│   │       │   └── exams.service.ts          # state machine + multi-mode capture orchestration
│   │       ├── analytics/                   # mastery/intervention read endpoints (proxy + cache)
│   │       ├── doubts/                      # DoubtTicket
│   │       ├── assignments/                 # Assignment
│   │       ├── timetable/                   # TimetableSlot
│   │       ├── notices/                     # Notice, NoticeDelivery
│   │       ├── reports/                     # Report generation orchestration
│   │       ├── audit/                       # AuditLog writer + query endpoints
│   │       ├── founder/                     # Founder-only cross-tenant module
│   │       ├── shared/
│   │       │   ├── guards/                  # RolesGuard, TenantScopeGuard, BatchScopeGuard
│   │       │   ├── interceptors/            # AuditInterceptor, CachingInterceptor
│   │       │   ├── filters/                 # global exception filter (08-ERROR-HANDLING.md envelope)
│   │       │   ├── dto/                     # shared DTO base classes
│   │       │   └── utils/
│   │       ├── config/                      # env schema validation, module config
│   │       └── infrastructure/
│   │           ├── prisma/                  # Prisma service wrapper
│   │           ├── redis/                   # cache client
│   │           └── queue/                   # BullMQ producers
│   │
│   └── api-python/                          # FastAPI AI/analytics microservice — port 8000
│       └── src/
│           ├── main.py
│           ├── ai/
│           │   └── blueprint_agent.py        # AI Blueprint Generator
│           ├── analytics/
│           │   ├── mastery_engine.py         # Topic Mastery calculation
│           │   └── diagnostic_engine.py      # Intervention/remediation generation
│           ├── routes/                      # FastAPI route modules mirroring §ai/analytics
│           ├── schemas/                     # Pydantic request/response models
│           └── infrastructure/
│               └── prisma_client.py          # prisma-client-py wrapper
│
├── packages/
│   ├── db/
│   │   └── prisma/
│   │       └── schema.prisma                 # single source of truth — 26 models, 17 enums
│   ├── ui/                                   # shared design tokens/components (Tailwind-based)
│   └── config/                               # shared eslint/tsconfig/tailwind config
│
├── infra/                                    # deployment templates (Dockerfiles referenced from apps/*, docker-compose, IaC snippets)
│
├── docs/                                     # this documentation package
├── .github/
│   └── workflows/                            # CI/CD pipeline definitions
├── AGENTS.md
├── README.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── .env.example
├── package.json
└── pnpm-workspace.yaml
```

## What Belongs Where — Rules
- **A new domain concept (e.g., "Fee Payment") gets its own NestJS module folder** under `apps/api/src/`, never bolted onto an existing unrelated module.
- **Cross-cutting concerns** (auth guards, error filters, caching interceptors) live only in `apps/api/src/shared/` — never duplicated per-module.
- **Any AI/analytics/math-heavy logic** belongs in `apps/api-python/src/`, never reimplemented in NestJS.
- **Any UI screen** belongs under `apps/web/src/components/dashboard/{role}/screens/` matching its role scope; a screen used by multiple roles (rare — e.g., a shared "profile settings" pattern) lives in a `shared/` sibling folder, not duplicated per role.
- **Database schema changes** only ever touch `packages/db/prisma/schema.prisma` — no service maintains a local copy of model definitions.
- **Shared UI components/design tokens** go in `packages/ui`, not duplicated inside `apps/web`.


---



---

# PART 2 — V2 EXTENSIONS (merged from 16-FOLDER-STRUCTURE.md (V2 section))

## AIOS — Academic Intelligence Operating System

---

## New Directories Under `apps/api/src/`
```
apps/api/src/
├── assessments/            # Assessment, AssessmentDelivery (22)
├── attempts/                # Attempt, Response evidence recording (22 §4/§5)
├── capture-providers/       # CaptureProvider registry + provider implementations (29)
│   └── providers/
│       ├── omr.provider.ts                    # wraps v1 OMR engine, unchanged
│       ├── manual-grid.provider.ts             # wraps v1 logic, unchanged
│       ├── csv-import.provider.ts              # wraps v1 logic, unchanged
│       ├── photo-capture-objective.provider.ts # v1 PHOTO_CAPTURE, objective path
│       └── photo-capture-subjective.provider.ts # new v2 — hands off to documents/
├── documents/                # DocumentBundle, Document, Page, PageImage, PageRegion (23)
│   └── pipeline/              # stage orchestration: validate, deskew, page-order,
│                               # region-detect, question-map (23 §4)
├── identity-resolution/      # IdentityResolution workflow (30)
├── rubrics/                  # Rubric, RubricVersion, RubricCriterion (26)
├── evaluations/               # Evaluation, EvaluationVersion, EvaluationCriterionScore (25)
│   └── work-queue/            # GET /evaluation-work-items logic
├── exams/                    # v1, RETAINED as compatibility alias layer over
│                              # assessments/ + attempts/ (22 §6)
```

## New Directories Under `apps/api-python/src/`
```
apps/api-python/src/
├── ocr/                       # OCRBlock/OCRResult extraction (24)
│   ├── printed_text.py
│   ├── handwriting.py
│   └── math_expression.py
├── evaluation/
│   └── ai_evaluator.py         # AIRecommendation generation (27)
```

## New Directories Under `apps/web/src/components/dashboard/`
```
teacher/screens/
├── TeacherDigitalCopyEvaluator/   (28 §2)
├── TeacherDocumentQueue/          (28 §3)
└── TeacherEvaluationWorkQueue/    (28 §4)

student/
└── StudentDigitalCopyReview/      (28 §5)

shared/screens/    # NEW top-level sibling — screens usable by both TEACHER-role
│                  # holders and REVIEWER-permission holders, since REVIEWER is a
│                  # permission grant, not a distinct hardcoded role (21 §4.10, 06 addendum)
└── ReviewerEvaluationConsole/     (28 §6)

admin/screens/
└── AdminEvaluationQualityDashboard/  (31 §3)
```

## New Package Directory
```
packages/db/prisma/schema.prisma   # unchanged path — 23 new v2 models added to the
                                     # SAME file, per 04-DATABASE-SCHEMA.md (V2 section) §6 dual-client parity rule.
                                     # No new packages/ directory needed for this.
```

## Rule Reinforcement (extends `16` v1's "What Belongs Where")
- **Any `CaptureProvider` implementation** belongs under `capture-providers/providers/`, implementing the shared interface (`29` §3) — never scattered inline inside `attempts/` or `documents/`.
- **Any AI-facing FastAPI logic that evaluates a student answer** belongs under `evaluation/`, never under `ai/` (which remains reserved for the v1 Blueprint Agent's question-selection logic only) — keeps the critical governance-relevant boundary from `32-AI-GOVERNANCE-POLICY.md` §3 visible in the codebase layout itself, not just in documentation.
- **`exams/` is not deleted or deprecated-and-ignored** — it is actively maintained as the compatibility layer for as long as `22-ASSESSMENT-ENGINE.md` §6 remains in force (indefinitely, per that document).
