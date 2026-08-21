# 14 — Deployment Architecture
## AIOS — Academic Intelligence Operating System

## 1. Environment Pipeline
```
Local (developer machine)
    ↓
Development (auto-deploy on push to feature/*, ephemeral preview envs)
    ↓
Staging (auto-deploy on merge to develop)
    ↓
Production (deploy on merge to main, manual approval gate)
```

## 2. Branch Strategy
```
main       → production
develop    → staging
feature/*  → development / preview environments
hotfix/*   → branched from main, merged to both main and develop
```
- No direct commits to `main` or `develop` — all changes via PR with required checks (see §5).
- `feature/*` branches get an ephemeral preview deployment (web + api, pointed at a shared or ephemeral test DB) for review-app-style QA before merge.

## 3. Infrastructure Topology
```
                    ┌───────────────┐
                    │   Next.js Web │  (Vercel — edge/CDN)
                    └───────┬───────┘
                            │ HTTPS
                            ▼
                    ┌───────────────┐
                    │  NestJS API    │  (containerized, e.g. AWS ECS/Fly.io — horizontally scaled)
                    └───────┬───────┘
                            │ internal HTTPS + service token
                            ▼
                    ┌───────────────┐
                    │  FastAPI AI    │  (containerized — separately scaled)
                    └───────┬───────┘
                            │
                ┌───────────┴────────────┐
                ▼                        ▼
        Managed PostgreSQL         Redis (cache + queue)
        (RDS / Neon, 16+)          (ElastiCache or equivalent)
                │
                ▼
        S3-compatible Object Storage (uploads, reports)
```

## 4. Docker & Containerization
- Each app (`apps/api`, `apps/api-python`) ships its own `Dockerfile`, built via a multi-stage build (deps → build → slim runtime image).
- `docker-compose.yml` at repo root spins up: `api`, `api-python`, `postgres`, `redis`, and `web` (dev mode) for local full-stack development — this is the canonical "getting started" path, documented in `README.md`.
- Production containers run as non-root users, with read-only root filesystems where feasible, and healthcheck directives (`/health`) wired to the orchestrator.

## 5. CI/CD Pipeline (per PR)
1. Install dependencies (pnpm workspace-aware install).
2. Lint (ESLint for TS, ruff/flake8-equivalent for Python).
3. Typecheck (`tsc --noEmit`; `mypy` or `pyright` for Python).
4. Unit + integration tests (13-TESTING-STRATEGY.md §2–3).
5. `pnpm audit` / `pip-audit` dependency vulnerability scan (07-SECURITY-SPECIFICATION.md §15) — high/critical blocks merge.
6. Build all apps.
7. API contract tests against ephemeral test DB (13-TESTING-STRATEGY.md §4).
8. OpenAPI drift check (05-API-SPECIFICATION.md §18).
9. Lighthouse CI (frontend PRs only, 11-PERFORMANCE-REQUIREMENTS.md §7).
10. On merge to `develop`/`main`: E2E suite (13-TESTING-STRATEGY.md §6) against a staging-equivalent stack.

**Merge is blocked** if any of steps 2–9 fail. Nothing is merged with failing tests or type errors, per 15-CODING-STANDARDS.md and the project's Definition of Done (20-IMPLEMENTATION-PLAN.md).

## 6. Database Migrations
- `prisma migrate dev` used locally to author migrations; committed migration files are the source of truth (never hand-edited after commit).
- CI runs `prisma migrate deploy` against staging automatically on merge to `develop`.
- Production migrations run as a **separate, explicit deployment step** (not silently bundled into the app-container startup command) — gated by manual approval, run before the new application version receives traffic, with a documented rollback migration for any destructive change (per 04-DATABASE-SCHEMA.md §4 migration strategy).
- Both Prisma clients (`@prisma/client` for NestJS, `prisma-client-py` for FastAPI) are regenerated from the same migrated schema before either service's new image is built — the two services are always deployed together when the schema changes, never independently with a schema mismatch window.

## 7. Environment Variables Per Environment
Each environment (`development`, `staging`, `production`) has its own isolated secret set (07-SECURITY-SPECIFICATION.md §1) — no environment ever points at another environment's database, storage bucket, or third-party provider credentials, including preview/ephemeral dev environments (which use a disposable/seeded test DB, never a staging or production copy with real PII).

## 8. Rollback Strategy
- Application rollback: redeploy the previous known-good container image/build (platform-native rollback, e.g., Vercel instant rollback for web, previous ECS task definition for API/AI service).
- Database rollback: only via an authored, tested down-migration for the specific change — "restore from backup" is the last-resort fallback for catastrophic failures, not the default rollback mechanism for routine schema changes.
- A rollback is only executed after confirming the previous version's schema compatibility with the current DB state (a forward migration that's already partially applied cannot always be blindly reversed — this is assessed case-by-case per the migration's documented rollback plan).

## 9. Health Checks & Deployment Verification
- `/health` on both NestJS and FastAPI checks DB connectivity, Redis connectivity, and reports service uptime — orchestrator will not route traffic to a new instance until `/health` returns healthy.
- Post-deploy smoke test (subset of E2E: login, one read, one write) runs automatically against production immediately after a production deploy completes; failure triggers an automatic rollback + on-call page.

## 10. Domains, SSL, CDN
- Production domain(s) per tenant-facing web app and a separate API subdomain; all traffic TLS-terminated at the edge (Vercel/load balancer), with TLS 1.2+ enforced end-to-end per 07-SECURITY-SPECIFICATION.md §10.
- Static web assets and generated report files (via signed URL) are CDN-cacheable; API responses are never CDN-cached (always dynamic, tenant-scoped).

## 11. Deployment Checklist (Definition of Ready to Ship — see also 14/engineering:deploy-checklist skill for live use)
- [ ] All CI gates green (§5).
- [ ] Database migration (if any) reviewed, has a rollback plan, and was successfully applied to staging.
- [ ] Feature flags for any incomplete/risky feature are set to `off` by default for existing tenants.
- [ ] Monitoring/alerting updated if new endpoints or job types were introduced (12-LOGGING-MONITORING.md).
- [ ] Post-deploy smoke test plan confirmed.
- [ ] Rollback plan documented for this specific release.
