# 10 — Scalability Strategy
## AIOS — Academic Intelligence Operating System

## 1. Target Scale (Phase 1–2 Planning Horizon)
```
500 institute tenants
50,000 total students across tenants
5,000 concurrent active users (peak: exam windows, result-announcement days)
200,000 API requests/day baseline, spiking to 5x during exam evaluation weeks
10,000 answer sheets graded per day at peak
```
These are planning targets, not current production traffic — the architecture must not require a rewrite to reach them, but infrastructure is provisioned incrementally against real usage (see 14-DEPLOYMENT-ARCHITECTURE.md).

## 2. Horizontal Scaling
- **NestJS API:** stateless — no in-memory session state (JWT is self-contained; cache is externalized to Redis). Horizontally scalable behind a load balancer; instance count scales on CPU/request-latency metrics.
- **FastAPI AI service:** stateless per-request; scales independently of NestJS since its load profile (bursty, CPU-heavy blueprint generation and mastery computation) differs from NestJS's steady transactional load. Scaled separately so a spike in grading traffic doesn't starve AI generation capacity or vice versa.
- **Web (Next.js):** deployed on an edge/CDN-backed platform (Vercel) — scales automatically per request, no custom scaling logic needed.

## 3. Statelessness Requirements
- No API instance may hold request-scoped or session-scoped state in local memory that a subsequent request depends on (rules out sticky sessions for correctness, though a load balancer may still use them for minor cache-locality benefit only).
- Any "in-progress" workflow state (e.g., a multi-step CSV import) is persisted to the DB or Redis with an explicit ID the client references — never held in a server process's memory across requests.

## 4. Database Scaling
- **Connection pooling:** PgBouncer (or platform-managed equivalent) in front of PostgreSQL; NestJS and FastAPI each maintain bounded connection pools (e.g., 10–20 per instance) rather than one connection per request.
- **Read replicas:** analytics-heavy, non-real-time-critical reads (Founder cross-tenant reports, historical trend charts) are routed to a read replica once tenant count/query volume justifies it (Phase 2 trigger, not Day 1 requirement) — the mastery-critical read path (`GET /analytics/student/:id/mastery`) stays on the primary until replica-lag guarantees are proven acceptable for a diagnostic-accuracy-sensitive feature.
- **Indexing:** see 04-DATABASE-SCHEMA.md §7 — indexes are added proactively for every documented hot-path query, and reactively via slow-query-log review (see 12-LOGGING-MONITORING.md).
- **Partitioning:** `AuditLog` and `Response` (highest-growth, append-mostly tables) are candidates for time-based partitioning once row counts justify it (tracked, not implemented Phase 1).

## 5. Caching
Fully specified in 09-CACHING-STRATEGY.md — caching is the primary lever for absorbing read-heavy academic-hierarchy and question-bank traffic without database scaling.

## 6. Queues & Background Jobs
- A job queue (BullMQ on Redis, or equivalent) decouples:
  - Marks-submission write → async mastery recalculation trigger.
  - Mastery recalculation result → async intervention/assignment generation.
  - Notice broadcast → per-channel dispatch jobs (Email/SMS/WhatsApp independently).
  - Report generation → PDF/Excel rendering jobs.
- Queue depth and job-age are monitored (12-LOGGING-MONITORING.md); sustained queue growth triggers autoscaling of worker consumers before it triggers user-facing symptoms.
- Each job type has an isolated queue (not one shared queue) so a backlog in, say, report generation cannot delay time-sensitive mastery recalculation jobs.

## 7. File Storage & CDN
- Photo captures, OMR files, report exports, and attachments go to S3-compatible object storage, not the application database or local disk — this scales storage independently of compute and keeps DB backups lean.
- Static web assets are served via CDN (Vercel's edge network); generated report files are served via signed URLs with a short TTL, optionally CDN-fronted for high-traffic report-card-download days (e.g., result announcement).

## 8. Pagination & Rate Limiting (Scalability Angle)
- All list endpoints are paginated (05-API-SPECIFICATION.md §17) — no endpoint returns an unbounded result set, preventing a single large-tenant query from degrading shared infrastructure.
- Rate limits are plan-tiered: `TRIAL`/`BASIC` institutes get the baseline limits (07-SECURITY-SPECIFICATION.md §7); `PRO`/`ENTERPRISE` institutes may be granted higher per-institute throughput ceilings, configured via the Founder feature-flag/plan system, not hardcoded per-tenant exceptions in application code.

## 9. Bottleneck Identification & Mitigation
| Potential Bottleneck | Mitigation |
|---|---|
| Mass grading during exam evaluation week (thousands of AnswerSheet writes/hour) | Async mastery pipeline (already decoupled); worker autoscaling on queue depth |
| AI Blueprint Agent under concurrent paper-generation requests from many teachers at term start | FastAPI service scaled independently; bounded timeout + idempotent retry (05-API-SPECIFICATION.md §16) prevents pile-up from client-side retries |
| Large-institute CSV/OMR bulk imports | Row-count cap (10,000/import, 07-SECURITY-SPECIFICATION.md §9) + chunked processing in a background job rather than inline request handling |
| Report generation on result-announcement day (many parents/students requesting Report Cards simultaneously) | Async job queue + CDN-fronted signed URLs; pre-generation option — Admin can trigger batch report generation ahead of the announcement window |
| Notice broadcast to large audiences (e.g., "all guardians, WhatsApp") | Per-recipient job fan-out with provider-level rate-limit respect (17-THIRD-PARTY-INTEGRATIONS.md), not a single blocking loop |
| Cross-tenant Founder analytics queries | Scheduled aggregation job producing a materialized snapshot table read by FounderOverview/Analytics, rather than live cross-tenant aggregation on every dashboard load |

## 10. Multi-Tenant Noisy-Neighbor Protection
Per-institute rate limiting and per-institute job-queue fairness (round-robin worker dispatch across institutes rather than strict FIFO) ensure one large or misbehaving tenant cannot degrade response times for other tenants sharing the platform.


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add to the Target Scale table (v1 §1):
```
10,000 scanned pages processed per day at peak (school exam season)
2,000 concurrent AI evaluation jobs (batched, not per-request)
500 concurrent identity-resolution manual-review actions
```
Add to the Bottleneck table (v1 §9):
| Potential Bottleneck | Mitigation |
|---|---|
| Exam-season surge of scanned-booklet uploads across many schools simultaneously | Document-processing queue autoscaled independently of the grading/mastery queues (`02-SYSTEM-ARCHITECTURE.md` (V2 section) §5); per-institute fair-dispatch (v1 §10 principle, extended) |
| AI Evaluation batch jobs for large deliveries (e.g., 500-student board exam) competing with smaller institutes' real-time evaluation needs | Separate `ai-evaluation` queue with per-institute throughput caps, same pattern as v1's notice-dispatch fairness mechanism (v1 §10) |
| OCR service under a burst of concurrent handwriting-heavy documents | OCR queue scaled independently from Blueprint Agent/Mastery Engine FastAPI workloads (`02-SYSTEM-ARCHITECTURE.md` (V2 section) §5, mirrors v1's stated rationale for separating AI service scaling from NestJS scaling) |

