# 02 — System Architecture
## AIOS — Academic Intelligence Operating System

**Merged Status:** This file now includes both the original v1 baseline (Part 1) and the v2 extensions (Part 2) as a single current source of truth.
---

## 1. Architecture Style
**Polyglot monorepo**, pnpm workspaces, 3 deployable apps sharing one database contract.

```
Client (Next.js) --HTTP/REST/JSON--> NestJS API (transactional gateway)
                                          |--(sync, <300ms)--> PostgreSQL (Prisma)
                                          |--(async, fire-and-forget job)--> FastAPI Python service
                                                                                  |--> PostgreSQL (Prisma Python client)
                                                                                  |--> writes MasteryScore / Intervention / Blueprint output back
```

## 2. Monorepo Layout
```
aios/
├── apps/
│   ├── web/           # Next.js 14/15 App Router, port 3000
│   ├── api/            # NestJS REST API, port 4000
│   └── api-python/     # FastAPI AI/analytics microservice, port 8000
├── packages/
│   ├── db/              # Prisma schema.prisma — single source of truth
│   ├── ui/              # Shared design system components/tokens
│   └── config/          # Shared eslint/tsconfig/tailwind config
├── infra/               # Deployment templates
├── package.json
└── pnpm-workspace.yaml
```

## 3. Component Responsibilities
| Component | Owns | Does NOT own |
|---|---|---|
| **web** (Next.js) | Routing, role-based dashboard rendering, client-side form validation (UX only), calling API | Business logic, DB access, authorization decisions |
| **api** (NestJS) | AuthN/AuthZ, RBAC guards, tenant scoping, all transactional writes/reads, request validation, rate limiting, audit logging, orchestrating async triggers to Python | Heavy math (mastery calc), AI paper generation, vector trend computation |
| **api-python** (FastAPI) | AI Blueprint Agent (question selection), Topic Mastery calculation, trend/diagnostic computation, Intervention generation | AuthN, direct client-facing traffic, RBAC decisions (trusts the NestJS-issued internal service call) |
| **db** (Prisma schema) | Canonical data model consumed by both `@prisma/client` (TS) and `prisma-client-py` | Business rules (enforced in service layers, not in DB triggers, except FK/unique constraints) |
| **PostgreSQL** | Durable transactional storage, uniqueness/FK integrity | Caching, session state |

## 4. Component Diagram
```
                    ┌──────────────┐
                    │  Next.js Web │
                    └──────┬───────┘
                           │ HTTPS/REST
                           ▼
                    ┌──────────────┐
                    │  NestJS API   │  ← RBAC guards, tenant scope, validation
                    └──────┬───────┘
             ┌─────────────┼───────────────┐
             ▼             ▼               ▼
        Auth Module   Domain Modules   Audit Logger
     (Google OAuth,   (Institutes,     (writes AuditLog,
      AllowList)      Academics,        never mutated)
                       Exams, Capture)
             │             │
             ▼             ▼
        ┌─────────────────────┐        ┌─────────────────────┐
        │     PostgreSQL       │◄──────►│  FastAPI AI Service  │
        │  (Prisma - Node)     │        │  (Prisma - Python)    │
        └─────────────────────┘        └─────────────────────┘
                                          Blueprint Agent
                                          Mastery/Trend Engine
                                          Diagnostic Remediation
```

## 5. Synchronous vs. Asynchronous Operations
| Operation | Mode | Rationale |
|---|---|---|
| Login / AllowList check | Sync | Must gate access immediately |
| CRUD on curriculum, users, batches | Sync | Transactional, low latency |
| Exam state transitions | Sync | Must be atomic and immediately visible |
| Marks/score submission (`AnswerSheet`/`Response` write) | Sync write, then **async trigger** | Write must be durable instantly; downstream analytics must not block the teacher |
| Topic Mastery recalculation | **Async** (background job triggered by NestJS, executed by FastAPI) | CPU/aggregation heavy across historical responses |
| Intervention (homework/extra-class) generation | **Async**, chained after mastery recalculation | Depends on mastery result |
| AI Blueprint paper generation | **Sync request, async-capable** — NestJS proxies to FastAPI and awaits a bounded-time response (see 17-THIRD-PARTY-INTEGRATIONS.md for timeout/retry policy) | Teacher is actively waiting in Paper Builder UI, but computation is non-trivial |
| Notice dispatch (Email/SMS/WhatsApp) | Async (queued) | External gateway latency must not block the composer UI |
| Report generation (PDF/Excel) | Async (queued), status-polled | File generation may exceed request timeout |

## 6. Where Things Happen
| Concern | Location |
|---|---|
| Input validation | NestJS `class-validator`/`zod` DTOs at controller boundary; FastAPI Pydantic models at its boundary |
| Authorization | NestJS `RolesGuard` + custom `TenantScopeGuard` on every route |
| Tenant isolation | Enforced in the NestJS service layer via mandatory `instituteId` filter injected from the authenticated actor — never trusted from client payload |
| Caching | See 09-CACHING-STRATEGY.md — Redis, NestJS layer only |
| Business logic | NestJS service classes (`*.service.ts`) for transactional domain logic; Python service modules for analytics/AI logic |
| Audit logging | NestJS `AuditInterceptor`, writes to `AuditLog` on every mutating request tagged as sensitive |

## 7. Technology Stack
- **Frontend**: Next.js 14+ (App Router), React 18/19, TypeScript, Tailwind CSS, Recharts, Framer Motion, Zustand + Context API.
- **Backend (transactional)**: NestJS (Node.js ≥ 20), TypeScript, `@nestjs/throttler`, `class-validator`, `zod`.
- **AI/Analytics service**: FastAPI (Python 3.11+), Pydantic, `prisma-client-py` (asyncio).
- **Database**: PostgreSQL 16+, Prisma ORM (26 models).
- **Auth**: Google OAuth 2.0 (`googleSub`) + `AllowListEntry` pre-approval gate.
- **Cache/Queue**: Redis (cache) + BullMQ-style job queue (async triggers — see 10-SCALABILITY-STRATEGY.md).
- **Storage**: S3-compatible object storage for photo captures, OMR files, report exports, attachments.
- **Monitoring**: Sentry (errors), structured JSON logs (see 12-LOGGING-MONITORING.md).

## 8. Inter-Service Communication Contract
- NestJS → FastAPI calls are **internal service-to-service HTTP calls**, authenticated via a shared internal service token (not user JWTs), never exposed to the browser.
- FastAPI never receives the raw user session; it receives a scoped, validated payload (`instituteId`, `studentProfileId`, etc.) that NestJS has already authorized.
- FastAPI writes results directly to PostgreSQL via its own Prisma Python client — it does not call back into NestJS to persist results, avoiding a synchronous round trip.

## 9. Deployment Topology (summary — full detail in 14-DEPLOYMENT-ARCHITECTURE.md)
```
Vercel (web) ── NestJS API (container, e.g. AWS ECS/Fly.io) ── FastAPI (container)
                              │                                      │
                              └──────────────┬───────────────────────┘
                                              ▼
                                     Managed PostgreSQL (RDS/Neon)
                                              │
                                        Redis (ElastiCache)
                                              │
                                     S3-compatible Object Storage
```

## 10. Key Architectural Decisions (ADR summary — full ADRs in 17/engineering:architecture skill outputs)
1. **Why polyglot instead of Node-only AI**: Python's numerical/analytics ecosystem is materially better for mastery-vector and blueprint-optimization workloads; isolating it as a microservice avoids polluting the transactional API's dependency graph.
2. **Why Prisma dual-client instead of a separate ORM per language**: guarantees schema parity — a single migration source (`schema.prisma`) prevents drift between the two services.
3. **Why fire-and-forget async instead of synchronous mastery calc**: teacher-facing grading UX must stay under 300ms; mastery computation over historical responses is not bounded-time-safe to run inline.
4. **Why tenant isolation is enforced in the service layer, not solely via RLS**: gives explicit, auditable, testable authorization code paths; Postgres Row-Level Security may be added as defense-in-depth (see 07-SECURITY-SPECIFICATION.md) but is not the sole enforcement mechanism.


---



---

# PART 2 — V2 EXTENSIONS (merged from 02-SYSTEM-ARCHITECTURE.md (V2 section))

## AIOS — Academic Intelligence Operating System

---

## 1. What Changes
The monorepo topology (`web` / `api` / `api-python`, Prisma-shared schema, PostgreSQL, Redis, S3) is **entirely unchanged**. What's added is: (a) new NestJS modules for the Assessment/Document/Evaluation domains, (b) new FastAPI services for OCR/Handwriting and AI Evaluation, (c) new async queues, (d) new object-storage patterns for page images.

## 2. Updated Component Diagram
```
                    ┌──────────────┐
                    │  Next.js Web │  + new screens: TeacherDigitalCopyEvaluator,
                    └──────┬───────┘    TeacherDocumentQueue, ReviewerEvaluationConsole,
                           │            StudentDigitalCopyReview (28)
                           ▼
                    ┌──────────────┐
                    │  NestJS API   │
                    └──────┬───────┘
       ┌───────────────────┼────────────────────────────┐
       ▼                   ▼                             ▼
  Auth/Institutes    Assessment Domain              Evaluation Domain
  (v1, unchanged)    (Assessment, AssessmentDelivery,  (Evaluation, EvaluationVersion,
                      Attempt, Response — 22)           AIRecommendation — 25)
                           │                             │
                           ▼                             ▼
                   Document Domain                CaptureProvider
                   (Document, Page, PageRegion,    Registry (29)
                    IdentityResolution — 23, 30)
                           │
             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
        PostgreSQL      Redis/Queue   S3 (page images,
        (Prisma)        (BullMQ,      raw + processed)
                         new queues)
                           │
                           ▼
                  ┌─────────────────────┐
                  │   FastAPI AI Service  │
                  │  ┌─────────────────┐  │
                  │  │ Blueprint Agent  │  │ (v1, unchanged)
                  │  ├─────────────────┤  │
                  │  │ Mastery Engine   │  │ (v1, updated read-path per 21 §4.8)
                  │  ├─────────────────┤  │
                  │  │ OCR/HWR Service  │  │ (new — 24)
                  │  ├─────────────────┤  │
                  │  │ AI Evaluator     │  │ (new — 27)
                  │  └─────────────────┘  │
                  └─────────────────────┘
```

## 3. New NestJS Modules
| Module | Owns | Depends on |
|---|---|---|
| `assessments` | `Assessment`, `AssessmentDelivery` CRUD + state machine (carries v1 `exams` module's logic, generalized) | `academics`, `papers` (v1, unchanged) |
| `attempts` | `Attempt` lifecycle, `Response` evidence recording, `CaptureProvider` dispatch | `assessments`, capture-provider registry |
| `documents` | `DocumentBundle`, `Document`, `Page`, `PageImage`, `PageRegion` CRUD + pipeline orchestration | `attempts`, object storage, queue |
| `identity-resolution` | `IdentityResolution` workflow | `documents`, `users` (v1, unchanged) |
| `rubrics` | `Rubric`, `RubricVersion`, `RubricCriterion` | `questions` (v1, unchanged) |
| `evaluations` | `Evaluation`, `EvaluationVersion`, work-queue endpoints | `attempts`, `rubrics`, async trigger to FastAPI AI Evaluator |
| `exams` (v1, retained) | Backward-compatible alias layer over `assessments`/`attempts` (`22` §6) | `assessments`, `attempts` |

## 4. New FastAPI Services
| Service | Owns | Depends on |
|---|---|---|
| `ocr/` | Text/handwriting/math extraction (`OCRBlock`/`OCRResult` production) | `documents` module's stored page images (via signed URL, not direct DB write from NestJS side) |
| `evaluation/ai_evaluator.py` | AI Evaluation Engine (`27`) — produces `AIRecommendation` | `rubrics`, `questions` data (read via Prisma Python client), OCR output |
| `blueprint_agent.py`, `mastery_engine.py` | v1, unchanged, except mastery engine's read query updated per `21` §4.8 |

## 5. New Async Queues (extends v1 `10-SCALABILITY-STRATEGY.md` §6)
| Queue | Job types |
|---|---|
| `document-processing` | One sub-queue per pipeline stage (`validate`, `deskew`, `page-order`, `identity-resolve`, `region-detect`, `question-map`) — per `23` §4 |
| `ocr` | Per-`OCRBlock` extraction jobs — per `24` |
| `ai-evaluation` | Per-`Response` (or batched per-delivery) AI evaluation jobs — per `27` §6 |
| `evaluation-aggregation` | `ScoreRecord` recomputation triggered on every `EvaluationVersion` write — per `25` §5 |

Each queue remains isolated (v1 principle, `10` v1 §6 — "isolated so a backlog in one cannot delay another"), extended here to ensure a document-processing backlog cannot delay the existing mastery-recalculation queue, and vice versa.

## 6. New Object Storage Pattern
Extends v1's `institutes/{instituteId}/...` convention:
```
institutes/{instituteId}/documents/{documentId}/pages/{pageId}/raw.jpg
institutes/{instituteId}/documents/{documentId}/pages/{pageId}/processed.jpg
```
Same signed-URL access pattern, same tenant-scoping discipline as v1 (`07-SECURITY-SPECIFICATION.md` §16, unchanged).

## 7. Synchronous vs. Asynchronous — Additions to v1 §5 Table
| Operation | Mode | Rationale |
|---|---|---|
| Document upload (per file) | Sync write to storage + DB record, async pipeline trigger | Mirrors v1's marks-submission pattern — durable write fast, heavy processing deferred |
| Document processing pipeline (all stages) | Fully async | Multi-minute, multi-stage; teacher/operator does not wait on a single request |
| AI evaluation (single response, background) | Async, batched per delivery | Per `27` §6 — never synchronous from the teacher's browser |
| Teacher evaluation submission (accept/adjust/reject) | Sync write (creates `EvaluationVersion`), async trigger for `ScoreRecord` recomputation | Mirrors v1's grading-write-then-async-mastery pattern exactly |

## 8. Inter-Service Communication — Additions to v1 §8
- NestJS → FastAPI OCR service and AI Evaluator service calls use the same internal service token mechanism as the v1 Blueprint Agent call (`07-SECURITY-SPECIFICATION.md` §1, unchanged) — no new auth mechanism introduced.
- The AI Evaluator reads `Rubric`/`RubricVersion`/`Question` data directly via its own Prisma Python client (same dual-client pattern as v1's mastery engine), not via a NestJS round trip, for the same latency reasons documented in v1 `02` §8.

## 9. Key Architectural Decisions (extends v1 §10)
5. **Why Document Processing is a separate NestJS module from Attempts**: the document pipeline has an entirely different lifecycle (multi-stage, human-checkpointed, potentially spanning hours between upload and evaluation-readiness) than the attempt/response lifecycle — coupling them would make the `attempts` module's contract inconsistent between OMR-style (instant) and document-style (delayed) attempts.
6. **Why OCR is a separate FastAPI service from AI Evaluation**: different scaling profiles (OCR is invoked once per region; AI Evaluation may be re-invoked on reprocess), different vendor/model dependencies, and OCR output must exist and be human-correctable *before* AI evaluation should reasonably run against it — a clean pipeline dependency, not a monolith.
7. **Why `EvaluationVersion` writes stay in NestJS, not FastAPI**: evaluation state changes are triggered by human (teacher/reviewer) action via the API, which is NestJS's domain (transactional, authorized, audited) — FastAPI's AI Evaluator only *proposes* a version (via a scoped internal call back to NestJS, or a direct Prisma-Python write followed by NestJS-driven read, consistent with how v1's mastery engine already writes directly via its own Prisma client) — the exact write path (FastAPI direct-write vs. NestJS-mediated) is finalized in implementation (`20-IMPLEMENTATION-PLAN.md` (V2 section)), but either way the versioning/audit guarantees in `31` apply uniformly.
