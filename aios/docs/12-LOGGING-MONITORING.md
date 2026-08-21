# 12 — Logging & Monitoring
## AIOS — Academic Intelligence Operating System

## 1. Observability Stack
| Concern | Tool |
|---|---|
| Application error tracking | Sentry (NestJS, FastAPI, Next.js) |
| Structured application logs | JSON logs shipped to a log aggregator (e.g., CloudWatch/Datadog/Better Stack — platform-dependent, see 14-DEPLOYMENT-ARCHITECTURE.md) |
| API/latency metrics | Request-duration histograms per route, exported to the monitoring stack |
| Database monitoring | Managed Postgres provider dashboard + slow-query log |
| Background job monitoring | Queue depth, job duration, job failure rate (per queue, per job type) |
| Uptime/health checks | `/health` endpoints on NestJS and FastAPI, polled by the platform's uptime monitor |
| Audit logs (business/security, not technical) | `AuditLog` table, queried via AdminAuditLogs/FounderAuditLogs screens (03-FEATURE-SPECIFICATIONS.md) |

## 2. Structured Log Format
```json
{
  "level": "error",
  "service": "exams-service",
  "requestId": "req_9f2c1a",
  "instituteId": "inst_...",
  "userId": "user_...",
  "route": "POST /exams/:id/grade-sheet",
  "errorCode": "DUPLICATE_ANSWER_SHEET",
  "durationMs": 42,
  "timestamp": "2026-08-19T10:32:00Z"
}
```
- Every log line from a request-handling context includes `requestId` (matches the client-facing error envelope's `requestId`, 08-ERROR-HANDLING.md), enabling direct correlation from a user bug report to the exact server log.
- `service` identifies which module/service emitted the log (`auth`, `exams-service`, `blueprint-agent`, `mastery-engine`, etc.).
- Log levels: `debug` (dev only, disabled in prod by default), `info` (normal operation milestones — e.g. "exam locked"), `warn` (recoverable anomalies — e.g. cache miss fallback), `error` (failed operation, needs attention), `fatal` (process-crashing).

## 3. What Must Never Be Logged
- Passwords — N/A (no first-party passwords, but rule stands for any future auth path).
- JWTs / access tokens / refresh tokens / OAuth tokens.
- API keys, internal service tokens, DB connection strings.
- Full guardian contact numbers/addresses or other PII in plaintext (log `userId`/`studentProfileId` as the reference, not the PII value itself — matches 07-SECURITY-SPECIFICATION.md §12).
- Full request/response bodies for endpoints carrying PII or answers/grades — log metadata (route, status, duration, ids) not payload content, except at `debug` level in non-production environments only.
- Payment/billing secrets (N/A Phase 1, no payments module, but the rule is pre-established for when billing is added).

## 4. Application Logs (What Should Be Logged)
- Every mutating API request: route, actor, instituteId, duration, outcome (success/error code).
- Every exam state transition (mirrors AuditLog but at `info` level for operational visibility, separate from the immutable business audit record).
- Every async job start/success/failure with duration.
- Every external service call (Google OAuth verification, SMS/WhatsApp/Email provider, Python AI service) with duration and outcome — critical for diagnosing 17-THIRD-PARTY-INTEGRATIONS.md failure modes.
- Cache hit/miss ratio sampling (not every hit, but periodic aggregate metrics) for the caches defined in 09-CACHING-STRATEGY.md.

## 5. Error Tracking (Sentry)
- All `error`/`fatal` level logs are also forwarded to Sentry with full stack trace, breadcrumbs, and the same `requestId`/`instituteId`/`userId` tags (PII-scrubbed per §3).
- Sentry alerts route to the on-call channel for `fatal` and any `error` spike (>N occurrences of the same error signature within 5 minutes).
- Sentry release tracking is tied to deployment tags (see 14-DEPLOYMENT-ARCHITECTURE.md) so a regression can be bisected to a specific deploy.

## 6. Performance Monitoring
- Request-duration histograms per route feed the p95 dashboards used to enforce 11-PERFORMANCE-REQUIREMENTS.md targets.
- Async job-duration histograms per job type (mastery recalculation, intervention generation, notice dispatch, report generation).
- Database query duration is sampled via the ORM's query-logging hook; anything > 500ms is logged as a slow-query event with the (parameterized, not literal-value) query shape.

## 7. Alerts
| Condition | Severity | Action |
|---|---|---|
| API p95 latency breaches target for 3 consecutive 5-min windows | High | Page on-call |
| Async job dead-letter rate > 0 for mastery/intervention queues | High | Page on-call (diagnostic data going stale) |
| `/health` check failing on NestJS or FastAPI | Critical | Page on-call immediately |
| Redis unreachable > 5 minutes | Medium | Notify on-call (system degrades gracefully per 09-CACHING-STRATEGY.md but DB load risk) |
| Repeated 403 `TENANT_MISMATCH`/`FORBIDDEN` from same actor | Medium (security) | Notify security channel, review for probing behavior |
| AuditLog write failure on a LOCK/UNLOCK/ROLE_CHANGE action | Critical | Page on-call (per 07-SECURITY-SPECIFICATION.md, these must be transactionally atomic — a failure here indicates a serious integrity issue) |
| Notice delivery failure rate > 20% for any channel | Medium | Notify integrations owner — likely provider outage (17-THIRD-PARTY-INTEGRATIONS.md) |

## 8. Dashboards
- **FounderHealth screen** (in-app, 03-FEATURE-SPECIFICATIONS.md / SRS §5.4): surfaces live latency for NestJS API, FastAPI, and PostgreSQL response time — a product-facing view of a subset of this monitoring data.
- **AdminAuditLogs / FounderAuditLogs screens**: business-audit view, distinct from technical logs — see §1 distinction.
- Internal ops dashboard (outside the app, in the monitoring tool): full request/error/latency/job dashboards for engineering use.

## 9. Log Retention
- Technical application logs: 30 days hot, 1 year cold storage (compliance/debugging window).
- `AuditLog` table (business audit): retained indefinitely, never purged, per its immutability requirement (04-DATABASE-SCHEMA.md, 07-SECURITY-SPECIFICATION.md).
- Sentry error events: per Sentry plan retention (typically 90 days), sufficient given the AuditLog and long-term technical log archive cover the longer-term need.


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add to the Alerts table (v1 §7):
| Condition | Severity | Action |
|---|---|---|
| Document-processing dead-letter rate > 0 for any stage | High | Page on-call — booklets stuck mid-pipeline block evaluation for affected students |
| Identity-resolution `UNRESOLVED` queue depth exceeds a configurable threshold sustained > 1 hour | Medium | Notify institute Admin — likely indicates a booklet-template/barcode issue needing operator attention |
| AI Evaluation governance gate (`32` §2) blocked a LOCK attempt | Info (expected behavior, logged for visibility) | No page — this is the gate working correctly; logged so evaluation-completion bottlenecks are visible on dashboards |
| Sustained AI-teacher disagreement spike for a specific model version | Medium (per `32` §4) | Notify AI-governance-responsible party, not paged as an incident |

Add PII exclusion rule (extends v1 §3): raw page image URLs and extracted OCR text are never logged in plaintext at any log level above `debug`, and `debug`-level logging of this content is disabled outside non-production environments — same discipline as v1's guardian-contact-info rule, extended to scanned academic work product.

