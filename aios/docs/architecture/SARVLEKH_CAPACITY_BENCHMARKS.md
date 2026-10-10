# SARVLEKH — Capacity & Load-Testing Benchmarks

**Date:** 2026-09-30  
**Target Workload:** 10,000 Enrolled Students Multi-Institute SaaS  
**Baseline Test:** `load-tests/read-path-baseline.js`  

---

## 1. Enrolled Users vs. Simultaneous Concurrency

A fundamental principle of this capacity assessment is:
$$\text{Enrolled Students} \neq \text{Simultaneous Active Users}$$

In a multi-institute K-12 and coaching EdTech platform:
- **10,000 Enrolled Students** represents the persistent database footprint:
  - 20–50 Institutes (schools/centers)
  - 150–250 Batches (class sections of 40–60 students)
  - ~1,000 Exams per academic term
  - ~100,000 AnswerSheets
  - ~2,500,000 Question Responses
- **Typical Daily Concurrency (Normal Traffic):**
  - **1% to 3%** active concurrent users: **100 to 300 concurrent browsing users** (students reviewing homework, teachers recording grades, admins inspecting attendance).
- **Peak Concurrency (Synchronous Examination or Result Release):**
  - **5% to 10%** peak active users: **500 to 1,000 concurrent active users** submitting responses or loading report cards simultaneously.
- **10,000 Simultaneous Active Connections:**
  - Corresponds to an enrolled base of **100,000 to 500,000 students**. Supporting 10,000 *simultaneous* socket connections requires PgBouncer connection pooling, multiple API pods behind an Application Load Balancer, and read replicas. SARVLEKH's single-node default configuration is designed and sized for the 10,000 enrolled students workload.

---

## 2. Measured Benchmark Results (`read-path-baseline.js`)

The baseline read-path load test exercises the critical four-endpoint pipeline called by every dashboard screen:
- `GET /api/v1/auth/me` (JWT verification, user lookup, tenant validation)
- `GET /api/v1/questions` (Question bank query with tenant scope)
- `GET /api/v1/batches` (Batch listing for teacher/admin)
- `GET /api/v1/students` (Student roster with pagination)

### Benchmark Measurement Matrix
Measured against a real NestJS API and PostgreSQL 16 instance ([load-tests/RESULTS-2026-09-11.md](file:///e:/sarvlekh/aios/load-tests/RESULTS-2026-09-11.md)):

| Virtual Users (VUs) | Throughput (req/s) | Median Latency (p50) | 95th Percentile (p95) | 99th Percentile (p99) | HTTP Error Rate | Connection Exhaustion |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1 VU** | 44 req/s | 21 ms | 37 ms | ~52 ms | **0.00%** | None |
| **5 VUs** | 122 req/s | 39 ms | 66 ms | ~89 ms | **0.00%** | None |
| **10 VUs** | 135 req/s | 70 ms | 119 ms | ~175 ms | **0.00%** | None |
| **20 VUs** | 123 req/s | 153 ms | 272 ms | ~340 ms | **0.00%** | None |
| **40 VUs** | 175 req/s | 219 ms | 412 ms | ~580 ms | **0.00%** | None |

### Analytical Observations
1. **Saturation Knee:** Throughput plateaus between 120 and 175 req/s. Beyond 10 VUs, adding concurrency increases queue wait time rather than throughput.
2. **Latency Degradation:** Latency increases near-linearly from 10 VUs (119 ms p95) to 40 VUs (412 ms p95).
3. **SLA Adherence:** Target read latency ($p95 < 300\text{ ms}$) is met up to ~20 concurrent users on single-node hardware.
4. **Zero-Error Resilience:** No timeouts, connection resets, or 5xx server errors occurred up to 40 VUs. The system degrades gracefully by queuing requests.
5. **Database Connections Under Load:** During the 40-VU test, PostgreSQL reported **10 of 100** connections active, proving that database connection pool exhaustion was not the limiting bottleneck.

---

## 3. Catalog of Existing Load-Test Scenarios

All load test scripts reside in the `load-tests/` directory:

| Script Name | Simulated Scenario | Target Objective | Execution Prerequisites | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`read-path-baseline.js`** | 4-endpoint dashboard loop | p95 < 300ms at 20 VUs | Seeded user, batch, questions | **EXECUTED** |
| **`grading-burst.js`** | 100 concurrent grading submissions/sec sustained 10 min | p95 < 300ms write latency; zero data loss | Seeded ONGOING exam and unverified AnswerSheet | Ready to run with `seed-fixtures.ts` |
| **`report-generation-burst.js`**| 500 concurrent report generation requests | Queue absorbs burst; zero dead letters | BullMQ Redis and student exam history | Ready to run with `seed-fixtures.ts` |
| **`ai-evaluation-burst.js`** | 2,000 concurrent AI evaluation batch triggers | Fast transition call (p95 < 500ms) | Delivery IDs with submitted subjective responses | Gated by mock AI provider |
| **`blueprint-generation-burst.js`**| 20 concurrent AI blueprint generation calls | Clean 504 on timeout; no process starvation | Fast API worker running | Gated by mock AI provider |
| **`document-processing-burst.js`** | 10,000 pages/day peak + 500 concurrent identity confirms | Upload p95 < 2s; confirm p95 < 500ms | S3/MinIO storage + seeded bundles | Gated by storage container |

---

## 4. Fixture Seeder Infrastructure (`load-tests/seed-fixtures.ts`)

The fixture seeder enables deterministic, representative state generation without impacting production or other tenants:

### Scale Modes
```bash
# 10 students, 1 batch, 2 exams, interventions, assignments (Pilot validation)
pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts --scale=pilot

# 500 students, 10 batches across 2 institutes (Standard load validation)
pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts --scale=standard

# ~10,000 students, 50 batches across 3 institutes (Full scale validation)
pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts --scale=full
```

### Safety & Tenant Isolation Guarantees
- **Production Block:** Throws fatal error if `NODE_ENV === 'production'` or if `DATABASE_URL` contains `prod`.
- **Tenant Scope:** Operates strictly on `inst-loadtest-${SCALE_ARG}`. Cleanup queries delete only test records associated with this specific tenant ID.
- **Output Artifacts:** Writes test IDs and configuration to `load-tests/.env.loadtest` (ignored by git).

---

## 5. Capacity Recommendations for 10,000 Enrolled Students

| Subsystem | Single Node (Staging/Pilot) | Multi-Node Recommended (Production at 10k Enrolled) |
| :--- | :--- | :--- |
| **Web API Nodes** | 1 instance (1 vCPU, 2GB RAM) | 3 instances (2 vCPU, 4GB RAM) behind ALB |
| **Worker Nodes** | 1 instance (`RUN_WORKERS=true`) | 2 dedicated worker instances (`RUN_WORKERS=true`, API has `RUN_WORKERS=false`) |
| **Python Analytics** | 1 instance (1 vCPU, 2GB RAM) | 2 instances (2 vCPU, 4GB RAM) |
| **PostgreSQL** | PostgreSQL 16 (2 vCPU, 4GB RAM) | PostgreSQL 16 (4 vCPU, 16GB RAM, SSD IOPS ≥ 3,000) |
| **Connection Pooling** | Prisma Client (pool = 10) | PgBouncer in transaction mode (pool size = 60 to PG) |
| **Redis** | Redis 7 (256MB) | Redis 7 (2GB RAM, AOF persistence enabled) |
| **Throughput Capacity** | 120–175 req/s read | 500–750 req/s read; 250 req/s write |
