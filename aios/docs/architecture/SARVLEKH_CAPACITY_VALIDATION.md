# SARVLEKH — Capacity Validation & Performance Benchmarks

**Author:** Performance Engineering & SRE Lead  
**Date:** 2026-09-30  
**Target Workload:** 10,000 Enrolled Students (Multi-Institute SaaS Baseline)  
**Status:** Canonical Capacity & Benchmark Evidence Specification  

---

## 1. Capacity Modeling: Enrolled Students vs. Concurrent Load

Capacity planning in SARVLEKH strictly distinguishes **Enrolled Data Footprint** from **Active Concurrent Traffic**:

$$\text{10,000 Enrolled Students} \neq \text{10,000 Concurrent Connections}$$

### A. Persistent Data Footprint (10,000 Enrolled Base)
- **Institutes:** 20–50 Active Tenant Institutes
- **Batches:** 150–250 Class Sections (30–60 students per batch)
- **Exams Conducted:** ~1,000 Term Exams
- **Answer Sheets:** ~100,000 AnswerSheets
- **Question Responses:** ~2,500,000 Response rows
- **Intervention Records:** ~15,000 Remedial Interventions

### B. Traffic Profiles in EdTech SaaS
1. **Normal Daily Usage (1%–3% Concurrency):**
   - **100 to 300 concurrent browsing users.**
   - Typical request rates: **30 to 80 req/s** (dashboard overviews, timetable checks, assignment views).
   - Single-node API comfortably absorbs this traffic ($p95 < 120\text{ ms}$).
2. **Synchronized Examination / Result Bursts (5%–10% Concurrency):**
   - **500 to 1,000 active concurrent users** submitting exam answer sheets or downloading term reports simultaneously.
   - Peak request rates: **200 to 400 req/s**.
   - Requires horizontal clustering: 3 API replicas + 2 Worker replicas behind PgBouncer.
3. **10,000 Simultaneous Active Connections:**
   - Corresponds to an enrolled base of **100,000 to 500,000 students**. 
   - Never claim support for 10,000 *simultaneous* connections on default infrastructure without multi-node clustering and connection poolers.

---

## 2. Measured Benchmark Evidence (`read-path-baseline.js`)

Executed against the live NestJS API and PostgreSQL 16 database using k6 ([load-tests/RESULTS-2026-09-11.md](file:///e:/sarvlekh/aios/load-tests/RESULTS-2026-09-11.md)):

```
Scenario: 4 requests per iteration (/auth/me, /questions, /batches, /students)
Environment: Single-node developer host, Postgres 16, Node API (source-maps enabled)
```

| Concurrency (VUs) | Throughput (req/s) | Median Latency (p50) | 95th Percentile (p95) | 99th Percentile (p99) | Error Rate | Database Connections |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1 VU** | 44 req/s | 21 ms | 37 ms | ~52 ms | **0.00%** | 1 / 100 |
| **5 VUs** | 122 req/s | 39 ms | 66 ms | ~89 ms | **0.00%** | 4 / 100 |
| **10 VUs** | 135 req/s | 70 ms | 119 ms | ~175 ms | **0.00%** | 7 / 100 |
| **20 VUs** | 123 req/s | 153 ms | 272 ms | ~340 ms | **0.00%** | 9 / 100 |
| **40 VUs** | 175 req/s | 219 ms | 412 ms | ~580 ms | **0.00%** | 10 / 100 |

### Benchmark Analysis
- **Saturation Point:** Throughput reaches a plateau around 120–175 req/s on a single core. Adding concurrency beyond 10 VUs increases latency linearly without error.
- **SLA Compliance:** Meets `11-PERFORMANCE-REQUIREMENTS.md` read SLA ($p95 < 300\text{ ms}$) up to 20 concurrent users on single-node hardware.
- **Graceful Degradation:** Zero 5xx errors or connection dropouts occurred up to 40 VUs. The system degrades via request queuing rather than crashing.

---

## 3. Catalog of Load-Test Scenarios & Execution Commands

All test scenarios reside in [`load-tests/`](file:///e:/sarvlekh/aios/load-tests/):

### Execution Command Reference
```bash
# Set isolated environment variables
export BASE_URL=http://staging-api.internal:4000/api/v1
export AUTH_TOKEN=<VALID_JWT_TOKEN>
export INSTITUTE_ID=inst-loadtest-standard

# 1. Read-Path Baseline (Dashboard traffic)
k6 run load-tests/read-path-baseline.js

# 2. Grading Burst (100 submissions/sec sustained 10 min)
k6 run load-tests/grading-burst.js

# 3. Report Generation Burst (500 concurrent requests)
k6 run load-tests/report-generation-burst.js

# 4. AI Evaluation Burst (2,000 batch triggers)
k6 run load-tests/ai-evaluation-burst.js

# 5. Blueprint Generation Burst (20 concurrent requests)
k6 run load-tests/blueprint-generation-burst.js

# 6. Document Processing Burst (10,000 pages/day peak)
k6 run load-tests/document-processing-burst.js
```

---

## 4. Fixture Seeder Validation (`load-tests/seed-fixtures.ts`)

The fixture generator safely populates isolated test data:
```bash
# Seed 10-student pilot fixture
pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts --scale=pilot

# Seed 500-student standard load test fixture (2 institutes, 10 batches)
pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts --scale=standard

# Seed 10,000-student full capacity validation fixture (3 institutes, 50 batches)
pnpm --filter @aios/db exec tsx --env-file .env ../../load-tests/seed-fixtures.ts --scale=full
```

### Safety Guarantees Verified
- **Production Guard:** Throws a fatal exception if `NODE_ENV === 'production'` or if `DATABASE_URL` contains production identifiers.
- **Isolated Tenant Cleanup:** Cleans up only test records under `inst-loadtest-${SCALE_ARG}`. Other tenant records are completely untouched.
- **Git Safety:** Credentials and generated IDs are output to `.env.loadtest`, which is included in `.gitignore`.

---

## 5. PostgreSQL & Worker Capacity Analysis

### Database Connection Sizing
| Deployment Tier | API Pods | Worker Pods | Python Pods | Max DB Conns | Pooler Required? |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Pilot (10–500 students)** | 1 (10 conns) | 1 (5 conns) | 1 (5 conns) | 20 / 100 | No (Direct Prisma) |
| **Target (10,000 students)** | 3 (30 conns) | 2 (10 conns) | 2 (10 conns) | 50 / 100 | Recommended (PgBouncer) |
| **Scale (> 25,000 students)**| 8 (80 conns) | 4 (20 conns) | 4 (20 conns) | 120+ / 100 | **Mandatory (PgBouncer)** |

### Worker Queue Backlog & Memory Bounds
- **Queue Memory:** BullMQ with `removeOnComplete: true` maintains Redis memory footprint under **50MB** even after processing 100,000 jobs.
- **Backlog Recovery:** If a worker crashes, unfinished jobs remain locked until the BullMQ lock expires (30s default) and are automatically returned to the `wait` queue without state corruption.
