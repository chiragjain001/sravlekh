# 17 — Third-Party Integrations
## AIOS — Academic Intelligence Operating System

## 1. Google OAuth 2.0 (Authentication)
- **Why used:** Sole authentication provider (06-AUTH-AUTHORIZATION.md) — avoids first-party password storage/risk entirely.
- **Credentials:** OAuth 2.0 Client ID/Secret, per-environment (dev/staging/production each have distinct OAuth app registrations with distinct authorized redirect URIs).
- **Endpoints used:** Google's `tokeninfo`/`id_token` verification endpoint (or equivalent server-side verification library).
- **Rate limits:** Google's standard OAuth quota — not typically a bottleneck at AIOS's scale, but monitored.
- **Retries:** 1 retry on transient network failure, no retry on a definitively invalid/expired token.
- **Timeout:** 5 seconds.
- **Fallback:** None (login fails, user sees a generic "couldn't sign in, try again" message) — auth has no fallback provider by design.
- **Failure behavior:** `401 OAUTH_VERIFICATION_FAILED` (08-ERROR-HANDLING.md §8).

## 2. Object Storage (S3-Compatible)
- **Why used:** Photo-capture answer sheets, OMR files, report exports (PDF/Excel), doubt-ticket attachments, notice attachments.
- **Credentials:** IAM/access-key scoped to a single bucket per environment, least-privilege (write to `institutes/{instituteId}/...` prefix only from the application role).
- **Endpoints:** Standard S3 API (PutObject, GetObject via signed URL, DeleteObject for soft-delete/GDPR-style purges).
- **Rate limits:** Provider default (effectively non-limiting at AIOS scale).
- **Retries:** 3 retries with exponential backoff on upload failures.
- **Timeout:** 10 seconds per file operation.
- **Fallback:** None — a failed upload surfaces immediately to the user with a retry action (this is a synchronous, user-facing operation, not queued).
- **Webhook handling:** N/A (no event-driven callbacks from storage in Phase 1; virus-scan pipeline, if implemented via a provider like ClamAV-as-a-service, would be a separate integration entry once selected).

## 3. Email Provider
- **Why used:** `EMAIL` channel for Notice Center broadcasts and system transactional emails (e.g., report-ready notifications).
- **Credentials:** Provider API key (e.g., a transactional email service), per-environment.
- **Rate limits:** Provider-tier-dependent; AIOS batches sends per-recipient job (10-SCALABILITY-STRATEGY.md §6) to respect provider throughput limits, not a single bulk call.
- **Retries:** 2 retries, exponential backoff.
- **Timeout:** 5 seconds per send.
- **Fallback provider:** None configured Phase 1 — a failed send is recorded as `NoticeDelivery.status = FAILED` with reason, not silently retried indefinitely.
- **Webhook handling:** Provider delivery/bounce/open webhooks (where supported) update `NoticeDelivery.status` to `DELIVERED`/`READ` asynchronously.

## 4. SMS Gateway
- **Why used:** `SMS` channel for Notice Center broadcasts (e.g., attendance alerts, exam reminders to guardians).
- **Credentials:** Gateway API key/sender ID, managed under FounderIntegrations (per-institute or platform-shared, per the institute's plan tier).
- **Rate limits:** Gateway-tier-dependent; per-institute throughput caps enforced at the AIOS job-dispatch layer to avoid one tenant exhausting a shared gateway quota.
- **Retries:** 2 retries, exponential backoff.
- **Timeout:** 5 seconds.
- **Fallback provider:** Documented as a Phase 2 resilience item (secondary gateway) — Phase 1 has a single configured provider per environment.
- **Failure behavior:** `NoticeDelivery.status = FAILED`, `failureReason` populated (e.g., `"invalid_number"`, `"gateway_timeout"`).

## 5. WhatsApp Business API
- **Why used:** `WHATSAPP` channel — high-engagement guardian communication (per the Product Vision's Phase 2 "Parent WhatsApp Intelligence Bot" roadmap; Phase 1 supports basic notice dispatch over this channel).
- **Credentials:** WhatsApp Business API token, managed under FounderIntegrations.
- **Rate limits:** WhatsApp's messaging-tier limits (varies by business verification tier) — respected via the same per-institute job-dispatch throttling as SMS.
- **Retries:** 2 retries, exponential backoff.
- **Timeout:** 8 seconds.
- **Fallback:** None — failed WhatsApp delivery does not auto-fallback to SMS (would change the audience's expected channel and cost profile); it's surfaced as a failed delivery for admin visibility.
- **Template compliance:** All outbound WhatsApp messages use pre-approved message templates per WhatsApp Business policy — free-form text is not sent to users who haven't messaged first (24-hour session window rule respected).

## 6. Internal: NestJS ↔ FastAPI AI Service
- **Why used:** AI Blueprint Agent, Mastery Engine, Diagnostic/Remediation Engine (02-SYSTEM-ARCHITECTURE.md §8).
- **Credentials:** Shared internal service token (`X-Internal-Service-Token` header), rotated quarterly (07-SECURITY-SPECIFICATION.md §1) — not a public API key, never exposed to the browser.
- **Endpoints:** `/ai/generate-blueprint-paper`, `/analytics/recalculate-mastery`, `/analytics/diagnostic-remediation` (05-API-SPECIFICATION.md §16).
- **Timeout:** Blueprint generation — **5 second soft target, 15 second hard timeout** (matches the documented retry pattern in the project's own guidance: "AI provider timeout: 5 seconds, Retry: 2 times, Exponential backoff"). Mastery/diagnostic triggers — fire-and-forget, `202 Accepted` returned immediately by the async endpoint contract.
- **Retry:** 2 retries with exponential backoff on the client (NestJS) side for the blueprint-generation call, using the same `Idempotency-Key` so a retried call doesn't produce duplicate `Paper` records.
- **Fallback:** None — if the AI service is down, teachers fall back to manual paper assembly (already a supported first-class workflow, not a degraded one) rather than the system attempting a lesser automated fallback.
- **Failure behavior:** `502 AI_SERVICE_UNAVAILABLE` / `504 AI_GENERATION_TIMEOUT` (08-ERROR-HANDLING.md §8).

## 7. Malware/Virus Scanning (Uploads)
- **Why used:** Scan photo-capture, OMR, and attachment uploads before they are persisted to object storage (07-SECURITY-SPECIFICATION.md §9).
- **Provider:** To be selected per deployment environment (e.g., a managed scanning API or a self-hosted ClamAV sidecar) — this document is updated with the specific provider once selected; the contract (timeout, retry, fallback) must be documented here before the integration ships.
- **Fallback behavior (interim policy until a provider is finalized):** Uploads are quarantined (stored but not linked to any live `AnswerSheet`/`DoubtTicket` record) until a scan result is available; a scan failure/timeout defaults to **quarantine, not auto-approve** — a fail-closed posture for user-uploaded content.

## 8. Monitoring & Error Tracking (Sentry)
- **Why used:** Cross-service error tracking (12-LOGGING-MONITORING.md).
- **Credentials:** Per-environment Sentry DSN.
- **Timeout/retry:** Sentry SDK's own async batching/retry — non-blocking to the request path (fire-and-forget from the app's perspective).
- **Fallback:** If Sentry is unreachable, errors still write to structured application logs (§ not lost, just not aggregated in Sentry until it recovers).

## 9. General Integration Policy
- Every third-party credential is environment-scoped (07-SECURITY-SPECIFICATION.md §1) and never shared across dev/staging/production.
- Every integration failure degrades gracefully per its documented fallback above — no third-party outage may take down core AIOS functionality (exam grading, mastery calculation, curriculum management) since none of those core loops depend synchronously on an external provider.
- New third-party integrations require: credentials documented here, timeout/retry/fallback policy defined here, and a corresponding entry in 07-SECURITY-SPECIFICATION.md if they touch PII or file uploads — before merging the integration code.
