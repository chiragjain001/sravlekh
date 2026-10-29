# AIOS / SARVLEKH — Staging Release Checklist & Deployment Runbook

**Document Version:** 1.0.0  
**Target Release:** AIOS v2.0-rc1  
**Date:** October 29, 2026  
**Auditor & Release Engineer:** Principal Systems Architect & Release Manager  
**Branch:** `chore/staging-db-migrations` (Commit: `8e27d5a`)  

---

## 1. Executive Summary & Staging Readiness Gate

This runbook defines the prerequisites, deployment procedures, verification gates, and rollback plans required to transition AIOS / SARVLEKH from the local development/audit baseline to an authorized **Staging / Controlled Institutional Pilot Environment**.

### 1.1 Gate Verdict & Deployment Status
- **Current Verdict:** **READY FOR CONTROLLED STAGING / ON-SITE INSTITUTIONAL PILOT**
- **Public Production Status:** **NOT READY (Blocked by absent public DNS & cloud ingress orchestration)**

---

## 2. Hard Deployment Blockers & Resolution Steps

Before the application can be served publicly or accessed by external pilot institutions over the internet, the following blockers must be addressed by the operations/DevOps team:

| Blocker ID | Description | Impact | Required Resolution Steps | Owner |
| :--- | :--- | :--- | :--- | :--- |
| **BLK-01** | **Unassigned Public DNS Records** | `app.sarvlekh.com` and `staging.sarvlekh.com` return `ENOTFOUND`. Users cannot resolve the host. | 1. Access the domain registrar / DNS provider for `sarvlekh.com`.<br>2. Create a CNAME or A record pointing `staging.sarvlekh.com` to the staging ingress IP or Cloudflare proxy. | DevOps / DNS Admin |
| **BLK-02** | **Missing Cloud Container Runner** | No cloud container orchestration (AWS ECS, Render, Railway, Fly.io, or Docker Swarm) is currently provisioned for remote hosting. | 1. Provision a staging host or cluster (min 2 vCPUs, 8 GB RAM).<br>2. Deploy services using the Docker Compose profile or container specifications in `docker-compose.staging.yml`. | DevOps / Cloud Architect |
| **BLK-03** | **SSL / TLS Certificate Provisioning** | No valid SSL certificate exists for `staging.sarvlekh.com`. | 1. Provision Let's Encrypt or Cloudflare Edge SSL certificate for `*.sarvlekh.com`.<br>2. Enforce HTTPS redirect and HSTS. | Security / DevOps |
| **BLK-04** | **Host RAM Constraint for Self-Hosted Pilots** | Host hardware with < 8 GB RAM risks memory thrashing (`WinError 1450` / OOM) under concurrent PDF rendering + OpenCV OMR. | Ensure staging/pilot VM or bare-metal server has a minimum of **8 GB RAM** (16 GB recommended). | Infrastructure Team |

---

## 3. Environment Variable Configuration & Secrets Matrix

All staging services must be configured with the following validated environment variables. **Never commit production or staging `.env` files into source control.**

### 3.1 Next.js Web Frontend (`apps/web/.env.production`)

| Variable | Staging Example Value | Purpose / Validation Rule |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enforces optimized React build and disables dev overlays |
| `PORT` | `3000` | Port for the Next.js Node server |
| `NEXT_PUBLIC_API_URL` | `https://staging-api.sarvlekh.com/api/v1` | Public API gateway URL accessed by browser clients |
| `INTERNAL_API_URL` | `http://aios-api:4000/api/v1` | Server-side internal API proxy route (avoids external loopback) |

### 3.2 NestJS API Application (`apps/api/.env.production`)

| Variable | Staging Example Value | Purpose / Validation Rule |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production logger and disables debug endpoints |
| `PORT` | `4000` | API listener port |
| `AIOS_ENV` | `staging` | Runtime environment identifier |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | PgBouncer connection pooler URL for transaction queries |
| `DIRECT_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres` | **Direct connection (Port 5432)** required for Prisma migrations (`prisma migrate deploy`) |
| `REDIS_URL` | `redis://aios-redis:6379` | In-memory cache and BullMQ broker URL |
| `JWT_SECRET` | `[64-byte high-entropy hex string]` | Secret for signing access tokens (must differ from dev secret) |
| `JWT_REFRESH_SECRET`| `[64-byte high-entropy hex string]` | Secret for signing refresh tokens |
| `INTERNAL_SERVICE_TOKEN`| `[64-byte high-entropy hex string]` | Shared token for Python FastAPI <-> NestJS inter-service auth |
| `PYTHON_SERVICE_URL`| `http://aios-python:8000` | Internal network URL for Python vision engine |
| `CORS_ORIGIN` | `https://staging.sarvlekh.com` | Allowed browser origins (never `*` in staging/production) |

### 3.3 Python FastAPI Vision Engine (`apps/api-python/.env`)

| Variable | Staging Example Value | Purpose / Validation Rule |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `staging` | FastAPI operational mode |
| `DATABASE_URL` | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | Read/write database connection |
| `INTERNAL_SERVICE_TOKEN`| `[64-byte high-entropy hex string]` | Must match `INTERNAL_SERVICE_TOKEN` in NestJS API |
| `OPENAI_API_KEY` | `sk-...` (or configured provider) | LLM provider key for AI handwriting evaluation & OCR |
| `GEMINI_API_KEY` | `AIza...` | Google GenAI provider key (fallback/primary evaluation model) |

---

## 4. Database Migration & Connection Pooler Guidance

### 4.1 Connection String Discipline
1. **Transaction & Runtime Queries (Port 6543):**
   - Must use the connection pooler URL: `...supabase.com:6543/postgres?pgbouncer=true`.
   - Ensures connection pooling across ephemeral serverless requests and worker processes.
2. **Schema Migrations (Port 5432):**
   - **Do NOT run Prisma migrations through PgBouncer on port 6543.** PgBouncer in transaction mode does not support the advisory locks and session-level statement manipulation required by Prisma Migrate.
   - Run migrations using the `DIRECT_URL` on port 5432:
     ```powershell
     pnpm --filter @aios/db prisma migrate deploy
     ```

### 4.2 Migration Execution Steps
```powershell
# 1. Verify schema drift before running migrations
pnpm --filter @aios/db prisma migrate status

# 2. Apply pending migrations using direct connection
$env:DATABASE_URL=$env:DIRECT_URL
pnpm --filter @aios/db prisma migrate deploy

# 3. Regenerate Prisma Client in both API runtimes
pnpm --filter @aios/db prisma generate
cd apps/api-python; python -m prisma generate; cd ../..
```

---

## 5. Security & Isolation Verification Gates

Before signing off on staging readiness, execute the following security gates:

- [ ] **Global Guard Verification:** Ensure `JwtAuthGuard` and `RolesGuard` are registered globally as `APP_GUARD` providers in `app.module.ts`.
- [ ] **Adversarial Security Test Pass:**
  ```powershell
  pnpm --filter @aios/api test src/security/adversarial-security.spec.ts
  ```
  *Requirement:* All 11 tests must pass (verifying JWT tenant claims, IDOR rejection, and audit log trigger immutability).
- [ ] **Cross-Tenant Isolation Gate:** Confirm tenant queries filter by `instituteId` extracted exclusively from JWT claims, never from client query parameters or request bodies.
- [ ] **AI Evaluation Finalization Gate:** Verify that no AI recommendation (`EvaluationVersion(source=AI)`) can finalize grades on a graded exam without explicit human teacher approval.

---

## 6. Backup, Retention & Disaster Recovery Procedures

### 6.1 Database Automated Backups
- Supabase provides point-in-time recovery (PITR) with daily physical backups.
- For local or institutional pilot deployments, ensure automated pg_dump execution:
  ```powershell
  pg_dump -Fc --no-owner --no-acl $env:DIRECT_URL > "backups/aios_staging_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"
  ```

### 6.2 Backup Pruning & Manifest Retention Test
- Execute automated retention verification:
  ```powershell
  pnpm --filter @aios/api test infra/backup/retention.test.js
  ```
  *Requirement:* 7/7 tests must pass (verifying GFS rotation and SHA256 integrity verification).

---

## 7. Institutional Pilot Hardware & Operational Acceptance Criteria

For controlled on-site institutional pilots (e.g. Apex Academy):

### 7.1 Physical Scanner Requirements
- **Scanner Type:** Sheet-fed Automatic Document Feeder (ADF) or high-speed flatbed.
- **Resolution:** 200 DPI to 300 DPI (recommended: 300 DPI for handwriting OCR).
- **Color Mode:** 8-bit Grayscale or 24-bit Color (avoid 1-bit monochrome/black-and-white mode as it degrades handwriting gradient analysis).
- **Output Format:** Multi-page PDF or individual uncompressed PNG images.
- **Fiducial Alignment:** Ensure top-left, top-right, and bottom-left corner registration marks (`AIOS:V1`) are intact and not cropped by scanner margins.

### 7.2 Teacher & Evaluator Workstations
- **Browser:** Chromium-based browser (Google Chrome, Microsoft Edge, Brave) v115+ or Firefox v120+.
- **Display Resolution:** Minimum 1366x768 (1920x1080 recommended for side-by-side answer booklet zoom and rubric scoring).
- **Network Bandwidth:** Minimum 10 Mbps broadband connection per 10 concurrent active evaluators.

---

## 8. Rollback & Contingency Plan

If an unrecoverable defect or data corruption occurs during staging deployment:

### 8.1 Instant Traffic Reversion
1. Re-point Cloudflare / Load Balancer DNS from the staging container cluster back to the previous stable release container.
2. Invalidate Cloudflare edge cache completely (`Purge Everything`).

### 8.2 Database Rollback Steps
1. If a migration corrupted schema tables, restore the database from the pre-deployment dump:
   ```powershell
   pg_restore --clean --if-exists --no-owner --no-acl -d $env:DIRECT_URL "backups/pre_deploy_backup.dump"
   ```
2. Flush Redis cache to prevent serving stale or mismatched data:
   ```powershell
   docker exec -it aios-dev-redis redis-cli FLUSHALL
   ```

### 8.3 Service Restart Sequence
1. Start Redis broker.
2. Start Python FastAPI Vision Engine (`port 8000`). Verify `/health` returns HTTP 200.
3. Start NestJS API Server (`port 4000`). Verify `/api/v1/health` returns HTTP 200.
4. Start Next.js Web Server (`port 3000`). Verify `GET /login` serves HTTP 200.

