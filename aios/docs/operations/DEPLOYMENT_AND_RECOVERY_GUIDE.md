# AIOS / SARVLEKH — Production Deployment & Recovery Guide

**Scope:** Production Pilot Deployment & Operational Runbook (One Institute)  
**Target Infrastructure:** AWS Lightsail Mumbai (`ap-south-1a`) + Supabase Managed PostgreSQL Pro (Mumbai) + AWS S3 (Mumbai) + Let's Encrypt TLS  
**Verified Git Branch:** `feat/typescript7-fastify-low-cost-optimization`  
**Verified Git Commit:** `d6b4d324814f32d9b8cdd4788ac13d66948395d1`  

---

## 1. Cloud Architecture & Infrastructure Topology

```
+─────────────────────────────────────────────────────────────────────────────────────────+
|                                    INTERNET TRAFFIC                                     |
+────────────────────────────────────────────┬────────────────────────────────────────────+
                                             │ HTTPS (443) / HTTP (80)
                                             ▼
+─────────────────────────────────────────────────────────────────────────────────────────+
|                    AWS LIGHTSAIL VPS — MUMBAI ap-south-1a (4 GB / 2 vCPU)               |
|                                                                                         |
|  +───────────────────────────────────────────────────────────────────────────────────+  |
|  | Nginx Reverse Proxy (aios-prod-nginx: 172.28.0.10)                                 |  |
|  | - SSL Termination (Let's Encrypt via mounted /etc/letsencrypt)                    |  |
|  | - Client IP Sanitization (overwrites X-Forwarded-For with verified $remote_addr)   |  |
|  | - Rate Limiting (/api/v1/auth: 10r/s burst 20; Multipart upload limit: 3 conn)    |  |
|  +─────────────────────────┬───────────────────────────────────┬─────────────────────+  |
|                            │                                   │                        |
|               /api/        ▼                      / (SSR/RSC)  ▼                        |
|  +───────────────────────────────────────+   +───────────────────────────────────────+  |
|  | Fastify NestJS API (aios-prod-api)    |   | Next.js 15 Web Frontend (aios-prod-web|  |
|  | IP: 172.28.0.12 (Port 4000)           |   | IP: 172.28.0.15 (Port 3000)           |  |
|  | Memory Cap: 512M | CPU Quota: 0.60    |   | Memory Cap: 384M | CPU Quota: 0.40    |  |
|  | cpu_shares: 1024 (Interactive)        |   | cpu_shares: 1024 (Interactive)        |  |
|  +───────────────────┬───────────────────+   +───────────────────────────────────────+  |
|                      │                                                                  |
|                      ▼                                                                  |
|  +───────────────────────────────────────+   +───────────────────────────────────────+  |
|  | BullMQ Worker (aios-prod-worker)      |   | Python Vision Service (aios-prod-py)  |  |
|  | IP: 172.28.0.13                       |   | IP: 172.28.0.14 (Port 8000)           |  |
|  | Memory Cap: 512M | CPU Quota: 0.40    |   | Memory Cap: 768M | CPU Quota: 0.50    |  |
|  | cpu_shares: 512 (Batch Worker)        |   | cpu_shares: 512 (Batch Worker)        |  |
|  +───────────────────┬───────────────────+   +───────────────────────────────────────+  |
|                      │                                                                  |
|                      ▼                                                                  |
|  +───────────────────────────────────────────────────────────────────────────────────+  |
|  | Redis 7 Broker & Cache (aios-prod-redis: 172.28.0.11)                             |  |
|  | - Memory: maxmemory 128mb, noeviction (Zero silent job drops)                     |  |
|  | - Durability: appendonly yes, appendfsync everysec (Mounted redis_data volume)    |  |
|  | - Memory Pressure Alerting: QueueMonitorService samples INFO memory (>80% alert)   |  |
|  +───────────────────────────────────────────────────────────────────────────────────+  |
+──────────────────────────────┬─────────────────────────────────────┬────────────────────+
                               │                                     │
                               │ DATABASE_URL (Port 6543)            │ Presigned S3 PUT/GET
                               │ DIRECT_URL (Port 5432)              ▼
                               ▼                         +─────────────────────────────+
                 +───────────────────────────+           | AWS S3 Bucket (ap-south-1)  |
                 | Supabase Managed Postgres |           | - Private, Versioned        |
                 | - AWS Mumbai ap-south-1   |           | - Single Shared Bucket      |
                 | - PgBouncer Pool (25 cap) |           | - Key: institutes/{id}/...  |
                 | - Daily Physical Snapshots|           | - Lifecycle: pending/ (2d)  |
                 +───────────────────────────+           +─────────────────────────────+
```

---

## 2. Infrastructure Sizing & Official Cost Breakdown

The pilot architecture is optimized for 1–2 institutes (~500–2,000 students, 30–80 teachers, ~100–300 exams/year) deployed strictly within AWS Mumbai (`ap-south-1`) for sub-10ms network latency.

| Infrastructure Component | Specification / Tier | Billing Model | Monthly Cost (USD) | Monthly Cost (INR approx.) |
| :--- | :--- | :--- | :--- | :--- |
| **AWS Lightsail VPS** | 4 GB RAM, 2 vCPUs, 80 GB SSD, 3 TB Transfer | Flat monthly fee (includes 1 IPv4) | $24.00 | ₹2,000 |
| **Lightsail Auto-Snapshots** | Daily incremental VM images (7-day retention) | $0.05 / GB-month (~10–15 GB delta) | ~$0.75 | ₹65 |
| **Supabase PostgreSQL** | Pro Tier (8 GB disk, daily backups, PgBouncer) | Flat baseline subscription | $25.00 | ₹2,080 |
| **AWS S3 Object Storage** | Standard S3 (Mumbai `ap-south-1`), Versioning ON | $0.025 / GB-month (~10–20 GB usage) | ~$0.50 | ₹40 |
| **AWS S3 API Operations** | PUT/GET requests for scans & checked copies | $0.005 / 1k PUTs; $0.0004 / 1k GETs | ~$0.20 | ₹15 |
| **Let's Encrypt TLS** | Automated ACME renewal certificates | Open Source / Free | $0.00 | ₹0 |
| **Total Estimated Operating Cost** | **Complete High-Availability Pilot Baseline** | **Predictable Fixed Monthly Cost** | **~$50.45 / mo** | **~₹4,200 / mo** |

> [!NOTE]
> **Point-In-Time Recovery (PITR) Boundary:** Supabase Pro includes 7-day daily automated physical snapshots at no extra charge. Supabase's continuous Point-In-Time Recovery (PITR) is a separate **$100/mo add-on** and is explicitly **not enabled** in the baseline pilot tier. Off-site logical backups (`infra/backup/backup.js`) provide point-in-time disaster recovery snapshots at negligible storage cost.

---

## 3. Host VM Setup & Security Hardening (AWS Lightsail)

### 3.1 Provision Lightsail Instance
1. Log in to the [AWS Lightsail Console](https://lightsail.aws.amazon.com/).
2. Select Region: **Asia Pacific (Mumbai) (`ap-south-1`)**, Zone: **Zone A (`ap-south-1a`)**.
3. Select Platform: **Linux/Unix**, Blueprint: **OS Only -> Ubuntu 24.04 LTS**.
4. Select Plan: **$20/mo ($24/mo with IPv4)** — 4 GB RAM, 2 vCPUs, 80 GB SSD, 3 TB Transfer.
5. Resource Name: `aios-production-mumbai-1`.
6. Attach Static IP: Navigate to the **Networking** tab, click **Create static IP**, select `aios-production-mumbai-1`, and attach it.
7. Configure Lightsail Firewall:
   - **HTTP (TCP 80):** `0.0.0.0/0` (for ACME challenge and HTTPS redirect).
   - **HTTPS (TCP 443):** `0.0.0.0/0` (for production web traffic).
   - **SSH (TCP 22):** Restrict to your administrator's IP address (e.g., `203.0.113.50/32`).
   > [!CAUTION]
   > Do **NOT** expose ports `3000`, `4000`, `6379`, or `8000` in the Lightsail firewall. Internal services communicate exclusively via the internal Docker bridge network (`aios-net`).

### 3.2 Connect via SSH & Apply Hardening
Connect from your local terminal:
```bash
ssh -i ~/.ssh/LightsailDefaultKey-ap-south-1.pem ubuntu@<LIGHTSAIL_STATIC_IP>
```

#### A. System Packages & Timezone
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo timedatectl set-timezone Asia/Kolkata
```

#### B. Swapfile Configuration (2 GB Safety Valve)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Configure low swappiness so swap is used only to prevent physical RAM exhaustion
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.d/99-aios.conf
```

#### C. UFW Host Firewall & Fail2ban
```bash
sudo apt-get install -y ufw fail2ban postgresql-client

sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

sudo systemctl enable --now fail2ban
```

#### D. SSH Hardening
Verify your SSH key functions before disabling password authentication:
```bash
# Disable password authentication and root login
sudo tee /etc/ssh/sshd_config.d/50-aios.conf << 'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no
MaxAuthTries 4
EOF

sudo systemctl reload ssh
```

---

## 4. Toolchain & Runtime Installation

### 4.1 Install Docker Engine & Docker Compose Plugin
Install the official Docker repository for Ubuntu 24.04:
```bash
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
newgrp docker
```

### 4.2 Install Node.js 22 LTS on Host (Toolchain Tasks)
> [!NOTE]
> Node.js 22 LTS ("Jod") is the active LTS release. The host uses Node.js solely for executing Prisma schema migrations (`pnpm --filter @aios/db migrate:deploy`), admin onboarding scripts, and backup utilities. Production containers run pinned `node:20-alpine` images isolated from the host.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo corepack enable
corepack prepare pnpm@10.34.5 --activate

# Verify versions
node --version # Expected: v22.x.x
pnpm --version # Expected: 10.34.5
```

---

## 5. Repository Checkout & Environment Configuration

### 5.1 Clone Repository at Verified Commit
```bash
mkdir -p /home/ubuntu/sarvlekh
cd /home/ubuntu/sarvlekh

git clone https://github.com/chiragjain001/sravlekh.git aios
cd aios

git checkout feat/typescript7-fastify-low-cost-optimization
```

Verify the exact verified commit:
```bash
git rev-parse HEAD
# Expected output: d6b4d324814f32d9b8cdd4788ac13d66948395d1
```

### 5.2 Configure Supabase PostgreSQL Credentials
In the [Supabase Dashboard](https://supabase.com/dashboard) (Mumbai `ap-south-1` project):
1. **Transaction Pooler (Port 6543):**
   - Host: `aws-0-ap-south-1.pooler.supabase.com`
   - Port: `6543`
   - Used for: `DATABASE_URL` (Runtime API & Worker queries). Must include `?pgbouncer=true`.
   ```text
   postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```
2. **Session Pooler (Port 5432):**
   - Host: `aws-0-ap-south-1.pooler.supabase.com`
   - Port: `5432`
   - Used for: `DIRECT_URL` (Prisma migrations and `pg_dump` backups). Supports DDL, schema locks, and prepared statements.
   ```text
   postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
   ```
   *(Note: True direct connection is `db.[PROJECT_REF].supabase.co:5432`. If your VPS network uses IPv4, the Supavisor Session Pooler on port 5432 provides seamless IPv4 connectivity).*

### 5.3 Configure Single Shared AWS S3 Bucket
AIOS utilizes **one shared private production S3 bucket per environment** (e.g., `aios-production-storage-mumbai`). All multi-tenant data is segregated by object key prefix (`institutes/${instituteId}/...` and `pending/institutes/${instituteId}/...`).

In the [AWS S3 Console](https://s3.console.aws.amazon.com/s3/):
1. Create Bucket: `aios-production-storage-mumbai` in Region `ap-south-1`.
2. Block all public access: **ON** (100% private).
3. Bucket Versioning: **Enable**.
4. Configure CORS:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedOrigins": ["https://aios.your-institute.com"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
5. Apply Complete S3 Lifecycle Policy for Versioned Bucket:
   Create `s3-lifecycle.json`:
   ```json
   {
     "Rules": [
       {
         "ID": "PurgeAbandonedPendingUploads48h",
         "Status": "Enabled",
         "Filter": {
           "Prefix": "pending/"
         },
         "Expiration": {
           "Days": 2
         },
         "NoncurrentVersionExpiration": {
           "NoncurrentDays": 1
         },
         "ExpiredObjectDeleteMarker": true,
         "AbortIncompleteMultipartUpload": {
           "DaysAfterInitiation": 1
         }
       }
     ]
   }
   ```
   Apply to bucket:
   ```bash
   aws s3api put-bucket-lifecycle-configuration \
     --bucket aios-production-storage-mumbai \
     --lifecycle-configuration file://s3-lifecycle.json
   ```
   > [!IMPORTANT]
   > S3 Lifecycle rules evaluate daily around midnight UTC. Object purging is asynchronous and completes over 24–48 hours following qualification.

### 5.4 Prepare `.env.production`
Generate required cryptographic secrets:
```bash
JWT_SECRET=$(openssl rand -base64 48)
QR_SECRET=$(openssl rand -base64 32)
INTERNAL_TOKEN=$(openssl rand -base64 32)
```

Create `/home/ubuntu/sarvlekh/aios/.env.production` with strict permissions:
```bash
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

Ensure all keys are populated:
```env
NODE_ENV=production
AIOS_ENV=production
PORT=4000

# Explicit proxy trust for Fastify behind Docker bridge
TRUST_PROXY=172.28.0.0/16,127.0.0.1

# Supabase Mumbai Connections
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# Connection pool budget (API: 15 + Worker: 10 = 25 max connections)
DATABASE_POOL_LIMIT=15
DATABASE_POOL_TIMEOUT=20

# Authentication & Security
JWT_SECRET=your-generated-jwt-secret-here
JWT_EXPIRES_IN=15m
ENABLE_DEV_LOGIN=false

# Domain & Web URLs
FRONTEND_URL=https://aios.your-institute.com
PUBLIC_API_URL=https://aios.your-institute.com

# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Internal Microservice Networking
REDIS_URL=redis://172.28.0.11:6379
PYTHON_SERVICE_URL=http://172.28.0.14:8000
INTERNAL_SERVICE_TOKEN=your-generated-internal-token-here

# Worker Concurrency Caps (Preserves 4GB RAM)
QUEUE_CONCURRENCY_OCR=1
QUEUE_CONCURRENCY_PDF_SPLIT=1
QUEUE_CONCURRENCY_AI_EVALUATION=2
QUEUE_CONCURRENCY_SCORE_AGGREGATION=2
QUEUE_CONCURRENCY_MASTERY_RECALC=3
MAX_CONCURRENT_UPLOADS=3

# Object Storage (Single Shared Production S3 Bucket)
S3_BUCKET=aios-production-storage-mumbai
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key

# Examination Cryptography
BOOKLET_QR_SIGNING_KEY=your-generated-qr-secret-here
SHUTDOWN_DRAIN_MS=5000
```

---

## 6. Pre-Flight Database Migration

Install packages and apply Prisma schema migrations against `DIRECT_URL`:

```bash
cd /home/ubuntu/sarvlekh/aios
pnpm install --frozen-lockfile --filter @aios/db...

# Execute migrations safely against port 5432
pnpm --filter @aios/db migrate:deploy
```

Verify migration status:
```bash
pnpm --filter @aios/db exec prisma migrate status
```
*Expected: `Database schema is up to date!`*

---

## 7. TLS Certificate & Nginx Reverse Proxy Setup

### 7.1 Create Webroot Directory on Host
Create the shared ACME challenge directory:
```bash
sudo mkdir -p /var/www/certbot
sudo chown -R ubuntu:ubuntu /var/www/certbot
```

### 7.2 Obtain Initial Certificate via Certbot Webroot
Before starting Nginx, point your DNS A record `aios.your-institute.com` to `<LIGHTSAIL_STATIC_IP>`.

Install Certbot on host:
```bash
sudo apt-get install -y certbot
```

Obtain initial certificate (run temporary standalone ACME check before Nginx container binds port 80):
```bash
sudo certbot certonly --standalone \
  -d aios.your-institute.com \
  --non-interactive \
  --agree-tos \
  -m admin@your-institute.com
```

### 7.3 Update Nginx Configuration
Edit [`infra/nginx/nginx.conf`](file:///e:/sarvlekh/aios/infra/nginx/nginx.conf):
```bash
nano infra/nginx/nginx.conf
```
Update:
1. `server_name aios.your-institute.com;` (in both HTTP and HTTPS blocks).
2. SSL certificate paths:
   ```nginx
   ssl_certificate /etc/letsencrypt/live/aios.your-institute.com/fullchain.pem;
   ssl_certificate_key /etc/letsencrypt/live/aios.your-institute.com/privkey.pem;
   ```
3. If using Cloudflare proxy, uncomment the Cloudflare IPv4/IPv6 CIDR blocks and `real_ip_header CF-Connecting-IP;`.

### 7.4 Configure Automated Certbot Renewal with Zero-Downtime Reload
Test renewal with webroot mode against `/var/www/certbot`:
```bash
sudo certbot renew --webroot -w /var/www/certbot --dry-run
```

Set up automated renewal cron job with container reload deploy hook:
```bash
sudo tee /etc/cron.d/certbot-aios-renewal << 'EOF'
0 3 * * * root certbot renew --webroot -w /var/www/certbot --deploy-hook "docker exec aios-prod-nginx nginx -s reload" >> /var/log/certbot-renewal.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/certbot-aios-renewal
```

---

## 8. Stack Deployment & Health Verification

### 8.1 Build & Launch Containers
Always specify `--env-file .env.production` to ensure environment variables are deterministically passed to Compose:

```bash
cd /home/ubuntu/sarvlekh/aios

# 1. Build production images
docker compose --env-file .env.production -f docker-compose.prod.yml build

# 2. Start stack in detached mode
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 8.2 Verify Running Containers
```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```
**Expected Output:**
```text
NAME               IMAGE                     COMMAND                  SERVICE      STATUS
aios-prod-api      aios-api                  "node dist/main.js"      api          Up (healthy)
aios-prod-nginx    nginx:1.27-alpine         "/docker-entrypoint.…"   nginx        Up
aios-prod-python   aios-python               "uvicorn src.main:ap…"   api-python   Up (healthy)
aios-prod-redis    redis:7-alpine            "docker-entrypoint.s…"   redis        Up (healthy)
aios-prod-web      aios-web                  "node apps/web/serve…"   web          Up (healthy)
aios-prod-worker   aios-api                  "node dist/worker.js"    worker       Up
```

### 8.3 Execute Exact Subsystem Health Checks
Execute health checks from the host using safe loopback and container exec checks:

```bash
# 1. Redis Cache & Job Broker (Internal check, no host port exposed)
docker exec aios-prod-redis redis-cli ping
# Expected: PONG

# 2. Fastify API Liveness (Host loopback 127.0.0.1:4000)
curl -fsS -I http://127.0.0.1:4000/api/v1/health/live
# Expected: HTTP/1.1 200 OK

# 3. Fastify API Readiness (Verifies DB and Redis connections)
curl -fsS http://127.0.0.1:4000/api/v1/health/ready
# Expected: {"status":"ok","info":{"database":{"status":"up"},"redis":{"status":"up"}}}

# 4. Python PDF & Vision Engine (Host loopback 127.0.0.1:8000)
curl -fsS http://127.0.0.1:8000/health
# Expected: {"status":"ok"}

# 5. Next.js Web Frontend (Host loopback 127.0.0.1:3000)
curl -fsS -I http://127.0.0.1:3000/
# Expected: HTTP/1.1 200 OK (or 307/308 redirect to /login)

# 6. Public HTTPS via Nginx
curl -fsS -I https://aios.your-institute.com/api/v1/health/live
# Expected: HTTP/2 200
```

---

## 9. Initial Institute & Administrator Onboarding

To prevent unauthorized public access, AIOS strictly requires administrator emails to be authorized in `allow_list_entries`. Public webmail providers (`gmail.com`, `yahoo.com`, etc.) are forbidden from `domainAllowlist` to prevent arbitrary public account sign-ins.

Execute the onboarding script (`scripts/onboard-institute.js`):

```bash
cd /home/ubuntu/sarvlekh/aios

# Export connection to direct migration port
export DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"

# For institute with official academic domain:
node scripts/onboard-institute.js \
  --name "Delhi Public Academy" \
  --short-code "DPA" \
  --admin-email "director@dpa.edu.in" \
  --domain "dpa.edu.in" \
  --role "ADMIN"

# OR for administrator using personal Google Account (domain filter left empty):
node scripts/onboard-institute.js \
  --name "Apex Tutorial Institute" \
  --short-code "ATI" \
  --admin-email "director.apex@gmail.com" \
  --role "ADMIN"
```

The administrator can now navigate to `https://aios.your-institute.com/login`, click **Sign in with Google**, authenticate using that exact authorized Google email, and land in the administrative dashboard.

---

## 10. Automated Backups & Disaster Recovery

### 10.1 Three-Tier Backup Architecture
1. **Tier 1 (Host Snapshots):** AWS Lightsail automatic snapshots daily at 03:00 UTC (7-day retention).
2. **Tier 2 (Managed Database):** Supabase automated physical backups daily (7-day retention).
3. **Tier 3 (Off-Site Encrypted Logical Dumps):** Daily `-Fc` compressed PostgreSQL custom dump verified with SHA-256 and `pg_restore --list` readback, replicated to an isolated S3 bucket.

### 10.2 Configure Secure Scheduled Backups
Create backup directory with restricted permissions:
```bash
sudo mkdir -p /var/backups/aios
sudo chown -R ubuntu:ubuntu /var/backups/aios
sudo chmod 700 /var/backups/aios
```

Make backup runner executable:
```bash
chmod +x /home/ubuntu/sarvlekh/aios/infra/backup/run-backup.sh
```

Test backup manually:
```bash
/home/ubuntu/sarvlekh/aios/infra/backup/run-backup.sh
```
*Verification: The script reads `DIRECT_URL` from `.env.production` (never exposing credentials in process table args or crontab), creates a custom compressed dump (`-Fc`), validates readback, and logs exit code 0.*

Add cron entry (executes runner without command-line passwords):
```bash
sudo tee /etc/cron.d/aios-database-backup << 'EOF'
0 2 * * * ubuntu /home/ubuntu/sarvlekh/aios/infra/backup/run-backup.sh >> /var/log/aios-backup.log 2>&1
EOF
sudo chmod 644 /etc/cron.d/aios-database-backup
```

### 10.3 Disaster Recovery Verification (Against Disposable Target)
> [!CAUTION]
> Never run restoration tests against your active production database. The restore tool (`infra/backup/restore.js`) actively blocks execution against production endpoints unless forced with `--i-understand-this-overwrites-data`.

Verify recovery against a disposable test database:
```bash
node /home/ubuntu/sarvlekh/aios/infra/backup/restore.js \
  --archive /var/backups/aios/<backup-file>.dump \
  --url "postgresql://postgres:[PASSWORD]@disposable-test-db.supabase.com:5432/postgres"
```

---

## 11. Rollback Procedures

### 11.1 Container Restart / Graceful Rollback
```bash
cd /home/ubuntu/sarvlekh/aios

# Stop containers gracefully
docker compose --env-file .env.production -f docker-compose.prod.yml down

# Start containers
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 11.2 Rollback to Previous Git Commit
```bash
cd /home/ubuntu/sarvlekh/aios

# 1. Stop current containers
docker compose --env-file .env.production -f docker-compose.prod.yml down

# 2. Checkout previous verified commit
git checkout <previous-commit-hash>

# 3. Rebuild and launch
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

---

## 12. Post-Deployment Monitoring & Operational Diagnostics

### 12.1 Real-Time Container Resource Consumption
```bash
docker stats --no-stream
```
**Healthy Baselines on 4 GB VPS:**
- `aios-prod-nginx`: ~15–25 MB (Limit: 64M)
- `aios-prod-redis`: ~15–35 MB (Limit: 192M, `maxmemory 128mb`)
- `aios-prod-api`: ~150–250 MB (Limit: 512M)
- `aios-prod-worker`: ~120–220 MB (Limit: 512M)
- `aios-prod-python`: ~180–300 MB (Limit: 768M)
- `aios-prod-web`: ~110–180 MB (Limit: 384M)
- **Total Container Memory:** ~600–1,100 MB (~25% of host RAM).

### 12.2 Host RAM & Swap Headroom
```bash
free -h
```
*Verify physical `available` memory is consistently `> 1.5 GB` and `Swap` usage is minimal (`< 100 MB`).*

### 12.3 Non-Blocking Redis Inspection
> [!IMPORTANT]
> Never run `KEYS "bull:*"` in production. `KEYS` is an $O(N)$ blocking command that pauses the Redis event loop.

Use non-blocking diagnostics:
```bash
# 1. Total key count in O(1)
docker exec aios-prod-redis redis-cli dbsize

# 2. Memory utilization & eviction check
docker exec aios-prod-redis redis-cli info memory | grep -E "used_memory_human|maxmemory_human|evicted_keys"

# 3. Non-blocking key sampling (SCAN)
docker exec aios-prod-redis redis-cli --scan --pattern "bull:*" | head -n 20
```

### 12.4 Database Connection Pool Verification
Verify active connections to Supabase PostgreSQL:
```bash
psql "$DIRECT_URL" -c "SELECT count(*), application_name FROM pg_stat_activity GROUP BY application_name;"
```
*Verify that total connections across API and Worker stay within the 25-connection budget (`15` API + `10` Worker).*

### 12.5 Background Worker Queue Depths
```bash
docker logs --tail 50 -f aios-prod-worker
```
*Confirm that `QueueMonitorService` logs periodic sampling passes with zero `[ALERT queue.backlog]` or `[ALERT redis.memory_pressure]` events.*
