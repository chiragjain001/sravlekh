# 07 — Security Specification
## AIOS — Academic Intelligence Operating System

**Priority:** This document sits at the top of the Hierarchy of Truth (01-PRODUCT-REQUIREMENTS.md §13). Security requirements override convenience, performance, or feature requests when in conflict.

---

## 1. Secrets Management
- All secrets (DB URL, Google OAuth client secret, internal service token, S3 keys, SMS/WhatsApp provider keys, Sentry DSN) live in environment variables, never committed to source control.
- Production secrets are managed via the hosting platform's secret manager (e.g., Vercel/AWS Secrets Manager) — `.env` files are for local dev only and are `.gitignore`d.
- `.env.example` in repo root documents every required variable name with a placeholder, never a real value.
- Internal NestJS↔FastAPI service token is rotated on a documented schedule (quarterly minimum) and stored separately per environment.

## 2. Environment Variables
- NEVER hardcode secrets in source.
- NEVER expose server secrets to frontend — Next.js env vars prefixed `NEXT_PUBLIC_` are the *only* variables allowed to reach the browser bundle; anything else (DB URL, service tokens) must never carry that prefix.
- Server-only env vars are validated at boot (fail-fast) via a schema (e.g., `zod`) so a missing required secret crashes startup rather than silently degrading.

## 3. Input Validation
- Every NestJS controller uses DTO classes validated by `class-validator`/`zod` before the handler runs — the ValidationPipe rejects unknown/extraneous fields (`whitelist: true, forbidNonWhitelisted: true`).
- Every FastAPI endpoint uses Pydantic models with strict typing; no endpoint accepts a raw untyped dict.
- File uploads (CSV, OMR, photo capture) validate MIME type, extension, and size **before** the file touches disk/storage, and are re-validated server-side (never trust the client `Content-Type` header alone).

## 4. Injection Prevention
- **SQL injection:** Prisma's parameterized queries are the only DB access path; raw SQL (`$queryRaw`) is disallowed unless explicitly reviewed and uses tagged-template parameterization — string concatenation into `$queryRawUnsafe` is prohibited by lint rule.
- **XSS:** All user-generated content (question text, doubt tickets, notice bodies) rendered in the frontend is sanitized before rendering as Markdown/LaTeX (allow-list renderer, not `dangerouslySetInnerHTML` on raw input).
- **CSV/formula injection:** CSV import/export values beginning with `=`, `+`, `-`, `@` are neutralized (prefixed) on export to prevent spreadsheet-formula injection when Admins open exported reports in Excel.

## 5. CSRF Strategy
- JWT is delivered via httpOnly cookie; all state-changing requests require either a custom header (`X-Requested-With`) or a CSRF token bound to the session for cookie-based auth flows, since cookies alone are vulnerable to CSRF without this.
- OAuth login flow uses the `state` parameter as CSRF protection specifically for the redirect handshake.

## 6. CORS
- API allows only explicitly configured origins (the production web app domain, plus documented staging/preview domains) — no wildcard `*` origin in any environment that carries credentials.
- `Access-Control-Allow-Credentials: true` paired only with an explicit origin allowlist, never a wildcard.

## 7. Rate Limiting & API Abuse Prevention
- `/auth/login`: 10 req/s, 100 req/min per IP.
- All other endpoints: 100 req/min per authenticated user (tier-adjustable per plan, see 10-SCALABILITY-STRATEGY.md).
- Bulk endpoints (CSV import, blueprint generation): separately capped per institute per hour to prevent one tenant from starving shared FastAPI capacity.
- Repeated 403s from the same actor/IP trigger a temporary lockout + AuditLog `LOGIN_FAILED`/suspicious-activity flag.

## 8. Authentication & Authorization
Fully specified in 06-AUTH-AUTHORIZATION.md; this section states the non-negotiable invariants:
- **NEVER trust client permissions** — every authorization decision is recomputed server-side from the JWT and DB state on every request; the client's displayed UI role is a UX convenience only.
- **NEVER trust client-provided organization/institute IDs** — `instituteId` used for every query is always derived from the authenticated actor's token, never from request body/query params (see 06 §3).
- **ALWAYS validate server-side**, even for actions the frontend already prevents via disabled buttons.

## 9. File Upload Validation
| Upload type | Max size | Allowed types | Extra validation |
|---|---|---|---|
| Photo capture (answer sheet) | 10 MB/file | jpg, jpeg, png, webp, pdf | Virus/malware scan before storage (see 17-THIRD-PARTY-INTEGRATIONS.md), EXIF stripped |
| CSV import | 5 MB | csv | Header validation, row count cap (10,000 rows/import) |
| OMR import | 5 MB | csv, proprietary OMR export format | Schema validation against expected answer-key structure |
| Doubt ticket attachments | 5 MB/file, 3 files max | jpg, jpeg, png, pdf | Same scan pipeline as photo capture |
| Notice/report attachments | 10 MB | pdf, docx, xlsx | Type-sniffed (magic bytes), not trusted by extension alone |

## 10. Encryption
- **In transit:** TLS 1.2+ enforced everywhere (browser↔Vercel, Vercel↔NestJS, NestJS↔FastAPI, all↔PostgreSQL via `sslmode=require`).
- **At rest:** Managed PostgreSQL and S3-compatible storage encryption-at-rest enabled at the provider level.
- **Sensitive fields:** guardian contact numbers and addresses are treated as PII (see §12) but not separately field-level encrypted in Phase 1 beyond provider-level at-rest encryption; this is a documented Phase 2 hardening candidate for `guardianContact`.

## 11. Password Hashing
Not applicable in Phase 1 — no first-party password storage exists (Google OAuth only, see 06-AUTH-AUTHORIZATION.md §6). If a first-party password path is ever added, it must use `argon2id` with per-user salt, never plain bcrypt with a low cost factor, and this document must be updated before that feature ships.

## 12. Sensitive Data Handling (PII)
- PII in scope: student/guardian name, contact number, address, date of birth, profile images, uploaded documents.
- PII is always institute-scoped and never returned in any cross-tenant query path.
- PII fields are excluded from application logs and from `AuditLog.oldValue`/`newValue` snapshots where the changed field is itself PII — audit records for PII-field edits store `"[REDACTED]"` for the value while still recording *that* a change occurred, actor, and timestamp.
- Report exports (Report Card, Progress Card) containing PII are only reachable via time-limited signed URLs, never public/static paths.

## 13. Audit Logging (Security Angle)
See 03-FEATURE-SPECIFICATIONS.md (AUDIT module) and 04-DATABASE-SCHEMA.md §6.31 for the data contract. Security-relevant invariant: the application DB role has **INSERT-only** grant on `audit_logs` — no `UPDATE`/`DELETE` grant exists for the app user at the Postgres role level, so even a code bug or compromised app credential cannot tamper with history.

## 14. API Abuse Prevention (Beyond Rate Limiting)
- Idempotency keys (05-API-SPECIFICATION.md §17) prevent duplicate-submission abuse on grading/import endpoints.
- Anomaly signals (e.g., one TEACHER account issuing thousands of grade-sheet writes in a minute) feed into the FounderHealth/Admin audit dashboards as flags for manual review, not automatic account suspension in Phase 1.

## 15. Dependency Security
- `pnpm audit` / `pip-audit` run in CI on every PR (see 14-DEPLOYMENT-ARCHITECTURE.md); high/critical vulnerabilities block merge.
- Dependabot (or equivalent) enabled on the monorepo for both `package.json` (per app/package) and Python `requirements`/`pyproject.toml`.
- No dependency is added without justification (see 15-CODING-STANDARDS.md §"MUST NOT").

## 16. Multi-Tenant Isolation — Defense in Depth
1. **Application layer (primary):** every service method requires and filters by `instituteId` derived from the authenticated actor (06-AUTH-AUTHORIZATION.md).
2. **Database layer (secondary, recommended hardening):** PostgreSQL Row-Level Security policies scoped to `instituteId` may be enabled as a second independent layer so that even a bug in application-layer scoping cannot leak cross-tenant rows. This is tracked as a Phase 2 hardening item in 20-IMPLEMENTATION-PLAN.md, not assumed present by default in Phase 1 unless explicitly enabled per table.
3. **Object storage layer:** all file paths are prefixed `institutes/{instituteId}/...` and access is via signed URLs scoped to that prefix.

## 17. Incident Response Hooks
Security-relevant errors (auth failures spike, guard bypass attempt, audit-write failure) route to the same alerting pipeline defined in 12-LOGGING-MONITORING.md, tagged `severity: security`.


---

# V2 ADDENDUM (merged from the relevant V2 section of that document)

## V2 Extension Notes
Add **Section 18: AI Evaluation & Document Processing Security**:
- **File uploads (extends §9):** multi-page PDF booklet uploads follow the same size/type/malware-scan pipeline as photo captures, with an added page-count sanity check (reject uploads wildly exceeding `expectedPageCount` before processing, to prevent resource-exhaustion via oversized malformed PDFs).
- **PII in scanned documents (extends §12):** a scanned answer booklet may contain a student's name/roll number/handwriting, all treated as PII with the same tenant-isolation and signed-URL access discipline as any other institute file (§16, unchanged). Raw page images are **never** included in any export, report, or cross-tenant analytics payload — only derived, de-identified metrics (confidence scores, aggregate agreement rates) leave the per-institute boundary, and even those require explicit opt-in (`32-AI-GOVERNANCE-POLICY.md` §4/§6).
- **AI data-processing consent (new, extends §12):** per `32` §6, student answer content sent to the AI Evaluation Engine requires per-institute documented consent before AI evaluation is enabled for that tenant — this is a provisioning-time gate (Founder/Admin plan configuration), not a per-request check.
- **Identity-resolution integrity (new):** misidentification of a scanned booklet is treated as a security-severity concern, not merely a data-quality one — the conservative auto-accept threshold (`30` §4) and mandatory audit logging (`30` §7) are security controls, cross-referenced here.

