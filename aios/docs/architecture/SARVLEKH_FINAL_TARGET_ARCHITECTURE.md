# SARVLEKH — Final Target System Architecture

**Author:** Principal Software Architect & Distributed Systems Engineer  
**Date:** 2026-09-30  
**Target Scale:** 10,000+ Enrolled Students across Multi-Tenant SaaS Deployments  
**Status:** Canonical Target Architecture Specification  

---

## 1. System Overview & Architectural Tenets

SARVLEKH is designed as a **Modular Monolith** for transactional business domains paired with a **Specialized Compute Sidecar** for ML/AI and heavy analytics.

```mermaid
graph TD
    subgraph Client Layer
        WebClient["Next.js 14 App Router (Web Client)"]
        MobileClient["Mobile/PWA Client (Future)"]
    end

    subgraph Edge & Ingress
        ALB["Application Load Balancer (HTTPS)"]
    end

    subgraph Application Tier
        NestAPI["NestJS API Cluster (Stateless Monolith)<br/>RUN_WORKERS=false"]
        NestWorker["NestJS BullMQ Workers<br/>RUN_WORKERS=true"]
        PythonService["Python FastAPI Engine (Stateless Sidecar)<br/>AI, OCR, EMA Analytics"]
    end

    subgraph Data & Queue Tier
        RedisCluster["Redis 7 (BullMQ & Cache)<br/>AOF Persistence"]
        PgBouncer["PgBouncer Connection Pooler<br/>Transaction Pooling Mode"]
        Postgres["PostgreSQL 16 Multi-Tenant DB<br/>WAL Archiving (PITR)"]
        ObjStorage["Object Storage (S3 / MinIO)<br/>Documents, Booklets, Reports"]
    end

    subgraph External Providers
        OpenAI["AI Provider (OpenAI / Gemini / Anthropic)"]
    end

    WebClient -->|HTTPS| ALB
    MobileClient -->|HTTPS| ALB
    ALB -->|/api/v1/*| NestAPI
    
    NestAPI -->|Enqueues Jobs| RedisCluster
    NestAPI -->|Transactional Queries| PgBouncer
    
    NestWorker -->|Consumes Jobs| RedisCluster
    NestWorker -->|Chunked POST /evaluation/*| PythonService
    NestWorker -->|Transactional Queries| PgBouncer
    NestWorker -->|Reads/Writes Files| ObjStorage
    
    PythonService -->|DB Queries via Prisma Python| PgBouncer
    PythonService -->|AI Inference Calls| OpenAI
    
    PgBouncer -->|Pooled Connections| Postgres
```

### Core Architecture Principles
1. **Preserve the Monolith for Business Transactions:** No microservices are introduced for academic entities (Exams, Batches, Students, Grades). Core workflows execute with transactional consistency inside PostgreSQL ACID boundaries.
2. **Dedicated Worker Isolation:** User-facing API pods run with `RUN_WORKERS=false` to ensure the HTTP event loop is never starved by CPU-heavy tasks. Background workers run dedicated containers with `RUN_WORKERS=true`.
3. **Decoupled Asynchronous Compute:** High-latency operations (OCR extraction, batch AI grading, PDF splitting, report rendering) never execute synchronously within HTTP request-response cycles. They are queued to Redis and processed in bounded, rate-limited chunks.
4. **Strict Multi-Tenant Isolation:** Every query enforces `instituteId` derived from the server-validated JWT session. All cross-tenant data leakage is prevented at the data access layer.
5. **Bounded Resource Footprint:** Every collection endpoint enforces bounded pagination. Application memory never loads unbounded cohorts or multi-million row response tables.

---

## 2. Component Inventory & Responsibilities

| Subsystem | Technology | Runtime Role | Concurrency / Scaling Model |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Next.js 14, React 18, TailwindCSS, Zustand | Renders responsive portals for Teachers, Students, Admins, and Founders. | Stateless SSR/SSG behind CDN/ALB. Autoscales on CPU/Memory. |
| **Core API** | NestJS, TypeScript, Express | Owns authentication, authorization, role guards, tenant isolation, and REST APIs. | Stateless pods behind ALB. Horizontal scaling (`HPA: 3–5 pods`). |
| **Worker Tier** | NestJS BullMQ Workers | Consumes jobs across 6 dedicated queues (`ai-evaluation`, `ocr`, `pdf-split`, etc.). | Scaled on queue depth (`HPA: 2–4 worker pods`). |
| **Analytics & AI Engine** | Python 3.13, FastAPI, NumPy, Pandas | ML OCR inference, EMA mastery calculation, prompt formatting, and LLM calls. | Scaled independently based on AI provider throughput quotas. |
| **Relational Database** | PostgreSQL 16 | ACID system of record for all curriculum, assessment, student, and tenant data. | Primary instance (4 vCPU, 16GB RAM) + Read Replicas for analytics. |
| **Connection Pooler** | PgBouncer | Multiplexes hundreds of client connections into a tight server connection pool. | Transaction pooling mode (60 shared server connections). |
| **Job Queue & Cache** | Redis 7 | BullMQ job states, rate limiting counters, and short-lived session caches. | Redis with AOF persistence enabled (`appendfsync everysec`). |
| **Object Storage** | S3 / MinIO | Stores scanned answer sheet booklets, rendered page images, and exported PDF reports. | Cloud object store with pre-signed time-limited download URLs. |

---

## 3. Asynchronous AI & OCR Workflow

To resolve historical 20-minute HTTP holding connections between NestJS and Python, the target architecture implements **Chunked Asynchronous Dispatch**:

```mermaid
sequenceDiagram
    autonumber
    actor Teacher as Teacher / Admin
    participant API as NestJS API
    participant Queue as Redis (BullMQ)
    participant Worker as NestJS Worker
    participant Python as Python FastAPI
    participant AI as AI Model Provider
    participant DB as PostgreSQL

    Teacher->>API: Publish Exam / Trigger Grading Batch
    API->>DB: Verify Exam Status (EVALUATING)
    API->>Queue: enqueueDeduped(jobKey('batch', deliveryId))
    API-->>Teacher: HTTP 202 Accepted (Batch Queued)

    loop BullMQ Job Execution
        Queue->>Worker: Dequeue AI Evaluation Job
        Worker->>Python: POST /evaluation/ai-evaluate-batch (take=5, timeout=60s)
        activate Python
        Python->>DB: Query up to 5 PENDING subjective responses
        Python->>AI: Call LLM with Rubric & Student Answer
        AI-->>Python: Return marks, confidence & feedback
        Python->>DB: Create EvaluationVersion(source=AI, status=COMPLETED)
        Python-->>Worker: HTTP 200 OK { totalResponses: 5, hasMore: true }
        deactivate Python
        Note over Worker: Worker loops chunk-by-chunk until hasMore=false
    end

    Worker->>Queue: Enqueue score-aggregation & mastery-recalc
    Worker->>Queue: Mark BullMQ Job Completed
```

### Design Guarantees
- **No Long-Lived Sockets:** Each HTTP chunk completes within 10–25 seconds. If a network blip occurs, the worker retries and resumes from the remaining `PENDING` responses.
- **Idempotent Transitions:** Each response evaluated transitions its DB state. Re-running the job evaluates only remaining un-evaluated responses.
- **Provider Rate-Limit Pacing:** If the LLM provider returns HTTP 429, `deferIfRateLimited()` catches the exception and reschedules the job with exponential backoff without spending a retry attempt.

---

## 4. Connection Pooling Architecture (PgBouncer)

### The Scaling Problem
Without pooling, connection consumption across replicas scales as:
$$\text{Connections} = (N_{\text{api}} \times 17) + (N_{\text{worker}} \times 17) + (N_{\text{py}} \times 10) > 136$$
This immediately exceeds PostgreSQL's default `max_connections = 100`.

### Target PgBouncer Configuration (v1.21.0+)
Deploy PgBouncer (version 1.21.0 or higher is **required** to support Prisma's prepared statements in transaction mode) as a sidecar or managed service between application nodes and PostgreSQL:

```ini
[databases]
aios = host=postgres port=5432 dbname=aios pool_size=60 reserve_pool=10

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = scram-sha-256
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 20
min_pool_size = 5
reserve_pool_size = 5
reserve_pool_timeout = 5
max_db_connections = 75
```

### Prisma Compatibility Note
Because Prisma uses prepared statements in certain extended queries, Prisma's `DATABASE_URL` connects to PgBouncer in transaction mode with `?pgbouncer=true`:
```env
DATABASE_URL="postgresql://user:password@pgbouncer:6432/aios?pgbouncer=true&connection_limit=10"
DIRECT_URL="postgresql://user:password@postgres:5432/aios"
```
`DIRECT_URL` is used exclusively for Prisma migrations (`prisma migrate deploy`), while all runtime application traffic passes through PgBouncer.

---

## 5. AI Cost & Operational Governance

1. **Model Hierarchy:**
   - Vision & Handwriting OCR: Specialized OCR pipeline / fine-tuned vision models.
   - Routine MCQ & Numerical Validation: Deterministic code logic inside PostgreSQL/NestJS ($0 AI cost).
   - Subjective Answers: High-efficiency models (e.g. GPT-4o-mini / Gemini 1.5 Flash) with strict temperature (0.1) and JSON schemas.
2. **Hard Human-in-the-Loop Governance:**
   - Per `32-AI-GOVERNANCE-POLICY.md` §2, `EvaluationVersion(source=AI)` is **never** terminal for `GRADED` assessments. Teacher confirmation or manual adjustment is enforced at the state-machine level before score finalization.
3. **Usage Accounting & Telemetry:**
   - Prompt tokens, completion tokens, model version, and latency are recorded in structured logs and telemetry metrics for every provider call.
