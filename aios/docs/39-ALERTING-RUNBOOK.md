# 39 — ALERTING RUNBOOK

Status: **implemented** 2026-09-11. Closes the "Sentry — alerting rules/dashboards
undefined" item in `PRODUCTION-READINESS-AUDIT.md` §1.3.

Extends `12-LOGGING-MONITORING.md` §7 with the conditions that are now actually
emitted, the thresholds behind them, and what to do when one fires.

---

## 1. What was already covered, and what was not

| Signal | Before | Reached anyone? |
| :--- | :--- | :--- |
| Thrown exceptions in a request | `AllExceptionsFilter` → Sentry | Yes |
| Dead-lettered jobs | `reportDeadLetter` → Sentry | Yes |
| **A queue quietly growing** | nothing | **No** |
| **A refresh token being replayed** | `logger.warn` | **No** |

The gap was everything that is **not an exception**. A dead worker or a stalled
AI provider throws nothing at all: jobs are accepted, nothing fails, and the only
symptom is that a teacher's evaluations never arrive. That failure is silent for
exactly as long as nobody happens to look at the Founder console.

## 2. The alerts

All are emitted through `shared/logging/alerts.ts`, which writes a log line
**and** a Sentry event. The log line is unconditional: `SENTRY_DSN` is optional
throughout this codebase, and the alerting story must not depend entirely on one
vendor being configured.

Every event carries a stable `alert` tag. **Write vendor rules against that tag,
never against message text** — the text will be reworded, the tag will not.

| `alert` tag | Severity | Fires when |
| :--- | :--- | :--- |
| `security.refresh_token_reuse` | `error` | A refresh token was presented after rotation, outside the concurrency grace window |
| `queue.backlog` | `warning` | A queue's `waiting` depth exceeds its threshold |
| `queue.dead_letter_present` | `error` | A queue has `failed` jobs |
| `dependency.unavailable` | `error` / `fatal` | A dependency the API cannot serve without is unreachable |

### 2.1 `security.refresh_token_reuse` — page

**What it means.** Not a suspicion. Under rotation a correctly behaving client
never sends the same refresh token twice, and the 30-second concurrency grace
window has already excluded the benign two-tab race. **Two copies of the
credential exist.**

**What has already happened automatically:** the entire session family is
revoked. The user (and the thief) are both logged out.

**Why it must page.** It is the only signal in the system that names a specific
compromised account, and it fires *after* the automatic response — so if nobody
sees it, nobody ever learns the theft happened.

**Respond by:**
1. `userId` and `familyId` are in the event. Query `refresh_tokens` for that
   family — `ipAddress` and `userAgent` show where each rotation came from.
2. One user, once: likely a stale client or a restored browser session. Note it.
3. **Several users in a short window: escalate.** That pattern means something
   systemic — a leaked backup, a compromised device fleet, a proxy logging
   cookies — not one unlucky person.
4. Consider `PATCH /users/:id/force-logout` if other sessions look suspect.

No token, hash, IP or user agent is in the alert itself; it describes an event,
and the forensic detail stays in the database behind normal access control.

### 2.2 `queue.backlog` — investigate, do not page

**Severity is `warning` deliberately.** A backlog is a capacity problem, not an
outage: work is still accepted and will still be done, just late. It becomes an
outage only if it keeps *growing* — which is a trend, and the vendor rule should
require it **sustained over ~10 minutes** before notifying. A single sample above
the line during marking week is normal and self-clearing.

Thresholds are per queue, not one global number, because a depth that is alarming
for one is a normal Tuesday for another. Each is set relative to what that
queue's own concurrency (`queue-policy.ts`) clears in a few minutes:

| Queue | Threshold | Why |
| :--- | ---: | :--- |
| `ai-evaluation` | 1000 | Concurrency 4, seconds per job. A few hundred is an exam finishing. |
| `ocr` | 500 | Concurrency 3, slow vision calls — backs up faster. |
| `score-aggregation` | 200 | Cheap and fast; a backlog means something is wrong. |
| `mastery-recalc` | 200 | As above. |
| `notice-dispatch` | 2000 | Fan-out per notice; a school-wide announcement legitimately spikes. |
| `report-generation` | 50 | Rare, heavy, user-initiated. More than a handful is unusual. |

**Respond by:** check whether the worker process is alive (`RUN_WORKERS`,
`/health/live` on the worker), then whether the AI provider is slow — a provider
at 10× normal latency looks exactly like a dead worker from the queue's side.

### 2.3 `queue.dead_letter_present` — investigate

Jobs that exhausted every retry. The individual failures already reached Sentry
via `reportDeadLetter`; this alert exists because a job can dead-letter at 3am and
sit unnoticed until someone asks why a report never arrived.

**Respond by:** find the per-job Sentry events (tagged `queue`, `jobId`,
`deadLettered`), fix the cause, then retry from the Founder console.

### 2.4 `dependency.unavailable`

`fatal` for the database — nothing works without it. `error` for anything the app
degrades around.

**Redis is deliberately NOT fatal.** Caching fails open (`09-CACHING-STRATEGY.md`)
and enqueue paths fail fast rather than hanging, so the API keeps serving almost
every request. Treating Redis as fatal would pull every instance out of the load
balancer during a blip and take down an API that was still working.

## 3. Where the queue sampler runs

`QueueMonitorService` samples every 60s (`QUEUE_MONITOR_INTERVAL_MS`, `<= 0`
disables).

It is provided **only where `RUN_WORKERS` is true**. Sampling from every API
replica would multiply one real backlog into N identical alerts, which is exactly
how a useful alert becomes one people mute. `RUN_WORKERS` is the existing flag
distinguishing a job-consuming process from a request-serving one, so the monitor
follows the workers rather than adding a second switch that could disagree.

The timer is `unref()`d, so it never delays a graceful shutdown, and `sample()`
never throws — an unhandled rejection inside `setInterval` would take the process
down, meaning the monitor could kill the worker it exists to watch.

## 4. Health probes are not alerts

| Endpoint | Consumer |
| :--- | :--- |
| `/health/live` | Orchestrator liveness — restarts the container. Checks nothing external, by design. |
| `/health/ready` | Orchestrator readiness — stops routing. 503 while draining or if the DB is down. |
| `/health` | Legacy combined check, unchanged. |

A liveness probe pointed at a dependency check turns a database outage into a
cluster-wide crash loop. See `38`'s sibling discussion in
`health.controller.ts`.

## 5. Still missing — do not assume these exist

- **No latency or error-RATE alerting.** Sentry receives individual exceptions,
  but "5xx rate above 2% for 5 minutes" and "p99 above 2s" are not emitted. Both
  need a metrics pipeline (Prometheus/OTel or the APM side of Sentry) that is not
  wired up. **This is the largest remaining observability gap.**
- **No connection-pool exhaustion alert.** Prisma pool saturation currently shows
  up only as slow requests. Related: `P2028` under refresh contention was found
  by load-shaped testing, not by an alert — see `38` §4.
- **No request/correlation IDs.** Logs cannot be tied together across a single
  request, or across the API → Python engine hop.
- **No cost or token-usage alerting** for the AI provider.
- **Thresholds are unvalidated against production traffic.** They are reasoned
  from each queue's concurrency, not measured. Revisit once real volume exists;
  a threshold that has never fired is not the same as a correct one.
