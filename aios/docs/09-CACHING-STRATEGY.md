# 09 — Caching Strategy
## AIOS — Academic Intelligence Operating System

**Cache layer:** Redis, owned exclusively by the NestJS API layer. FastAPI does not maintain its own cache in Phase 1 — it reads directly from PostgreSQL for correctness on analytics-critical paths (mastery numbers must never be served stale from a second cache).

---

## 1. What Is Cached

### 1.1 Academic Hierarchy Tree (`GET /academics/tree`)
- **Cache:** Redis
- **Key:** `academics-tree:{instituteId}`
- **TTL:** 30 minutes
- **Invalidate on:** Create/Update/Delete of Subject, Chapter, or Topic within that institute.
- **Rationale:** Read-heavy, low-change-frequency data used on nearly every screen (question authoring, blueprint builder, student progress views).

### 1.2 Question Bank Listing (`GET /questions`)
- **Cache:** Redis
- **Key:** `question-bank:{instituteId}:{page}:{filtersHash}`
- **TTL:** 5 minutes
- **Invalidate on:** Create, Update, Approve, Reject, Delete of any Question in that institute (broad invalidation by `instituteId` prefix scan, not per-filter-key precision — acceptable given short TTL).

### 1.3 Institute Profile / Feature Flags (`GET /institutes/me`)
- **Cache:** Redis
- **Key:** `institute-profile:{instituteId}`
- **TTL:** 10 minutes
- **Invalidate on:** Plan change, feature-flag toggle (Founder actions) — invalidated immediately on write, not just TTL-expired, since plan/flag changes must take effect promptly.

### 1.4 Mastery Radar Summary (`GET /analytics/batch/:id/mastery-summary`)
- **Cache:** Redis
- **Key:** `mastery-summary:{batchId}`
- **TTL:** 2 minutes
- **Invalidate on:** Any `MasteryScore` write for a student in that batch (invalidated by the async analytics job immediately after it commits the new score, not left to TTL alone, so teacher dashboards reflect post-grading updates promptly).

### 1.5 AllowList Existence Check (login-path hot lookup)
- **Cache:** Redis
- **Key:** `allowlist-check:{instituteId}:{emailHash}`
- **TTL:** 60 seconds
- **Invalidate on:** AllowListEntry create/delete for that email.
- **Rationale:** Login is a hot path; a very short TTL bounds staleness risk (a newly-revoked entry taking up to 60s to fully propagate) while still cutting DB load under login bursts (e.g., start of school day).

### 1.6 Timetable Weekly View (`GET /timetable-slots`, resolved/expanded view)
- **Cache:** Redis
- **Key:** `timetable:{instituteId}:{batchId|teacherId}:{weekStart}`
- **TTL:** 15 minutes
- **Invalidate on:** Any TimetableSlot create/update/delete affecting that batch/teacher.

## 2. What Is NOT Cached (Explicit)
- `MasteryScore` individual student records (source-of-truth reads always hit DB — only the aggregated batch summary is cached, per §1.4, to avoid ever serving a stale diagnostic number for an individual student's decision-relevant view).
- `Response`/grading data — always live, since grading is an active in-progress workflow.
- `AuditLog` reads — always live; caching audit trails risks masking recent tampering-detection scenarios.
- Any FOUNDER cross-tenant aggregate (health, MRR) — computed live or via a scheduled materialized snapshot job (see 10-SCALABILITY-STRATEGY.md), not ad-hoc request-time caching, since these queries are infrequent (Founder-only) but must be trustworthy.

## 3. Cache Key Format Convention
`{resource-type}:{scope-id}:{sub-scope}:{variant-hash}` — always begins with `instituteId` (or a tenant-derivable scope) as the second segment so that a full-tenant cache flush (e.g., on institute archival) is a single prefix-scan delete: `SCAN academics-tree:{instituteId}*`.

## 4. Invalidation Strategy
- **Write-through invalidation** (not TTL-only) is required for anything user-facing-immediate: academic hierarchy edits, question approval, institute plan changes, allowlist changes.
- **TTL-only** is acceptable for aggregate/summary views where a few minutes of staleness is an acceptable trade-off (mastery summary, timetable view).
- No cache is ever the system of record — Redis unavailability must degrade to direct-DB reads (fail-open to DB, not fail-closed to an error), implemented via a try/catch around the cache-read step in the NestJS caching interceptor.

## 5. Fallback Behavior
If Redis is unreachable:
1. Cache reads fail silently and fall through to PostgreSQL.
2. Cache writes are attempted but failure is swallowed (logged at `warn` level) — the request still succeeds using the freshly-fetched DB data.
3. A sustained Redis outage is surfaced on FounderHealth (see 12-LOGGING-MONITORING.md), not silently tolerated indefinitely, since it materially increases DB load.

## 6. Session/Token Caching
JWTs are stateless and not cached server-side; the only session-adjacent cache is the `tokenVersion` revocation check (06-AUTH-AUTHORIZATION.md §8), which reads `User.tokenVersion` — this specific check is cached with a short TTL (30s) keyed `token-version:{userId}` to avoid a DB hit on every single authenticated request while still bounding force-logout propagation delay to 30 seconds.
