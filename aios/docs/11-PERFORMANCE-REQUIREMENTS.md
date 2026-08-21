# 11 — Performance Requirements
## AIOS — Academic Intelligence Operating System

All targets below are measurable and CI/monitoring-enforceable — vague goals ("make it fast") are not acceptable per this document.

## 1. API Latency Targets (p95, measured server-side, excluding client network)
| Endpoint / Operation | Target |
|---|---|
| `POST /exams/:id/grade-sheet` (durable write only, excludes async mastery job) | **< 300 ms** |
| `POST /auth/login` | < 400 ms |
| Standard CRUD reads (`GET /questions`, `GET /users`, etc., paginated) | < 200 ms |
| Standard CRUD writes (`POST /academics/subjects`, etc.) | < 250 ms |
| `GET /analytics/student/:id/mastery` | < 300 ms |
| `GET /analytics/batch/:id/mastery-summary` (cached) | < 150 ms |
| `POST /papers/generate-ai` (full round trip incl. Python AI service) | < 8 s soft target, 15 s hard timeout |
| `POST /allow-list-entries/bulk-import` (per 1,000 rows) | < 5 s |
| `GET /audit-logs` (paginated, filtered) | < 400 ms |

## 2. Async Job Latency Targets
| Job | Target (from trigger to completion) |
|---|---|
| Topic Mastery recalculation | < 10 s (p95) after grading commit |
| Intervention/Assignment auto-generation (chained after mastery) | < 15 s (p95) after mastery recalculation completes |
| Notice dispatch (per channel, per recipient) | < 30 s (p95) from broadcast creation to provider handoff |
| Report generation (PDF, single student) | < 20 s (p95) |
| Report generation (Excel, batch-wide, up to 500 students) | < 90 s (p95) |

## 3. Frontend Performance Targets
| Metric | Target |
|---|---|
| Initial page load (Time to Interactive) | < 2.5 s on a standard broadband connection |
| Dashboard route transition (client-side navigation) | < 500 ms perceived |
| Lighthouse Performance score | > 90 |
| Lighthouse Accessibility score | > 90 |
| Largest Contentful Paint (LCP) | < 2.5 s |
| Cumulative Layout Shift (CLS) | < 0.1 |

## 4. Database Query Performance
| Query class | Target |
|---|---|
| Indexed point lookups (by PK or unique constraint) | < 20 ms |
| Filtered list queries using a documented index (04-DATABASE-SCHEMA.md §7) | < 100 ms |
| Aggregation queries (mastery summary, class report stats) — pre-cache | < 500 ms |
| Any query exceeding 500 ms | Logged to slow-query log automatically (see 12-LOGGING-MONITORING.md) and reviewed |

## 5. Throughput Targets
- NestJS API: sustain 500 req/s aggregate across all tenants at target scale (10-SCALABILITY-STRATEGY.md) without p95 latency breaching the targets above.
- FastAPI AI service: sustain 20 concurrent blueprint-generation requests without individual request latency exceeding the 15s hard timeout.
- Grading pipeline: sustain 100 AnswerSheet writes/second during peak evaluation windows.

## 6. File Upload/Processing Performance
| Operation | Target |
|---|---|
| Photo capture upload (single file, ≤10MB) response | < 1 s (upload + storage ack; OCR/grading is separate, human-driven, out of this timing) |
| CSV import validation (per 1,000 rows) | < 3 s |
| OMR file processing (per 1,000 sheets) | < 10 s |

## 7. How Targets Are Enforced
- API latency: automated load-test suite (see 13-TESTING-STRATEGY.md) run against staging before each release; CI gate fails a release candidate that regresses p95 by more than 20% against the previous baseline.
- Frontend: Lighthouse CI runs on every PR touching `apps/web`.
- Database: slow-query logging + alerting threshold at 500ms (12-LOGGING-MONITORING.md).
- Async jobs: job-duration metrics exported to the monitoring stack with alerting on p95 breach.

## 8. Explicit Non-Targets (What We Are Not Optimizing For, Phase 1)
- Sub-100ms global edge latency for API calls (API is regionally deployed, not multi-region-replicated, in Phase 1).
- Real-time (<1s) mastery score updates — the async pipeline's 10s target is an intentional, documented trade-off favoring grading-write speed over instant analytics.


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add the performance target tables already specified in `23` §8, `24` §8, `27` §9 directly as new rows under v1's existing "Async Job Latency Targets" and a new "Document/OCR/AI-Evaluation Targets" table (consolidated, not duplicated here — see those three documents for the authoritative figures). Add one explicit non-target (extends v1 §8): *"Real-time (<1 minute) full-booklet processing for large multi-page documents is not a v2 target — the documented 20-minute batch target for a 40-booklet set is the accepted trade-off favoring pipeline reliability and human-checkpoint quality over raw speed."*

