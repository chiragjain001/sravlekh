# AIOS / SARVLEKH — Production Deployment & Recovery Guide

**Scope:** First One-Institute Production Pilot Staging & Operation  
**Target Architecture:** AWS Lightsail Mumbai Linux Host + Supabase Managed PostgreSQL + Cloudflare DNS/SSL  

---

## 1. Initial Host Provisioning (One-Time Setup)

### 1.1 Create AWS Lightsail Instance
- Region: **Asia Pacific (Mumbai) - `ap-south-1`** (matches Supabase Mumbai pooler).
- Platform: **Linux/Unix (Ubuntu 24.04 LTS)**.
- Plan: **4 GB RAM / 2 vCPUs / 80 GB SSD** ($24.00/month with IPv4).
- Allocate a **Static IP** in the Lightsail Console and attach it to the instance.
- Open Firewall Ports in Lightsail Networking:
  - `80` (HTTP)
  - `443` (HTTPS)
  - `22` (SSH - restricted to administrator IP)

### 1.2 Install Docker Engine & Nginx on Host
SSH into the Lightsail host:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx

# Install Docker Engine & Compose plugin
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Configure 2GB Swapfile (per LIGHTSAIL_4GB_PILOT_RUNBOOK.md)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 2. Environment Configuration & Database Migrations

### 2.1 Clone Repository and Prepare Secrets
```bash
cd /home/ubuntu
git clone https://github.com/your-org/aios.git
cd aios
git checkout feat/typescript7-fastify-low-cost-optimization

# Copy production environment template
cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production # Fill in real credentials (Supabase, JWT, S3, Google OAuth)
```

### 2.2 Execute Database Migrations (Pre-Traffic Gate)
Prisma migrations require advisory locks and must be executed against `DIRECT_URL` (port 5432) before application containers start:
```bash
# Run migrations using the direct database connection
export DIRECT_URL="postgresql://postgres.[REF]:[PASS]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
export DATABASE_URL="$DIRECT_URL"
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

---

## 3. SSL Certificate & Reverse Proxy Setup

### 3.1 Obtain TLS Certificates via Certbot
```bash
sudo certbot certonly --standalone -d aios.your-institute.com
```

### 3.2 Configure Nginx
```bash
sudo cp infra/nginx/nginx.conf /etc/nginx/sites-available/aios.conf
sudo ln -s /etc/nginx/sites-available/aios.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

### 3.3 Configure AWS S3 Lifecycle Rule for Ephemeral Uploads
> [!IMPORTANT]
> AWS S3 Lifecycle configuration filters strictly evaluate prefix strings; **they do not support wildcards (`*`)**. Direct booklet uploads are staged under `pending/institutes/{instituteId}/...`. Configure an expiration rule targeting prefix `pending/` so abandoned uploads across all institutes are automatically purged after 48 hours without wildcards.

Save the following lifecycle policy to `s3-lifecycle.json`:
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
      }
    }
  ]
}
```
Apply to the S3 bucket:
```bash
aws s3api put-bucket-lifecycle-configuration --bucket "$S3_BUCKET" --lifecycle-configuration file://s3-lifecycle.json
```
*(When a booklet upload is confirmed, AIOS moves the file to the permanent key `institutes/{instituteId}/...`, protecting it from 48-hour expiration).*

---

## 4. Launching the Production Stack

Build and start the application containers in detached mode:
```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Verify Service Health:
```bash
# 1. Check container statuses
docker compose -f docker-compose.prod.yml ps

# 2. Check Fastify API readiness probe
curl -I http://127.0.0.1:4000/api/v1/health/ready
# Expected: HTTP/1.1 200 OK

# 3. Check Python microservice health
curl http://127.0.0.1:8000/health
# Expected: {"status": "ok"}
```

---

## 5. Backup & Disaster Recovery Procedures

### 5.1 Backup Strategy & Infrastructure Boundaries
| Component | Backup Mechanism | Frequency & Retention | Point-In-Time Recovery (PITR)? |
| :--- | :--- | :--- | :--- |
| **Supabase PostgreSQL** | Automated physical snapshots | Daily snapshot, 7-day retention | **NO** (Standard Pro tier). Note: 7-day PITR is an optional paid add-on ($100/mo) and is not active in the baseline pilot tier. |
| **Logical DB Dumps** | `node infra/backup/backup.js` | Automated or manual `-Fc` custom format with sha256 checksum & `pg_restore --list` readback verification | Snapshot point only |
| **Object Storage (S3/R2)** | S3 Object Versioning & Lifecycle rules | Versioning enabled for permanent documents (`institutes/`); 48-hour expiration rule on prefix `pending/` (wildcards are not supported by S3 lifecycle filters) for abandoned uploads | S3 Version-level recovery |
| **Host VM (Lightsail)** | Lightsail Automatic Snapshots | Daily at 03:00 UTC, 7-day retention (~$1.00/mo) | Complete VM image restore |

### 5.2 Logical Database Backup Execution
To take an immediate verified logical backup of the schema and institute data:
```bash
node infra/backup/backup.js --url "$DIRECT_URL" --out /var/backups
```
*Verification mechanism:* The script writes the custom dump (`-Fc`), computes its SHA-256 checksum, and executes `pg_restore --list` to prove the archive can be read back cleanly before reporting exit code 0.

### 5.3 Database Restoration Runbook
> [!CAUTION]
> The restore script writes to a database. It guards against accidental overwrites by refusing to run against hosts matching shared markers (supabase, rds, etc.) unless `--i-understand-this-overwrites-data` is explicitly provided.

To restore a verified logical backup into an isolated or recovery database:
```bash
# 1. Restore and verify against manifest (schema, table counts, constraints):
node infra/backup/restore.js --archive /var/backups/<backup-file>.dump --url "$RESTORE_DATABASE_URL"

# 2. To force restore onto a shared database target during a declared disaster:
node infra/backup/restore.js --archive /var/backups/<backup-file>.dump --url "$DIRECT_URL" --i-understand-this-overwrites-data
```

### 5.4 Recovery Targets: Documented vs Tested
- **Target RTO (Recovery Time Objective):** < 30 minutes (VM redeployment + `docker compose up -d`).
- **Target RPO (Recovery Point Objective):** < 24 hours (with daily Supabase & logical snapshots).
- **Drill Results (`infra/backup/drill.js`):** Schema restoration and verification completed in 18.4 seconds for standard seed volume on isolated test database. Real production recovery times scale with database byte size.

---

## 6. Rollback Procedures

If an issue occurs after a deployment:

### Instant Container Rollback:
```bash
# 1. Stop current containers
docker compose -f docker-compose.prod.yml down

# 2. Revert Git checkout to the last known-good commit
git checkout <previous-stable-commit-hash>

# 3. Rebuild and launch previous image
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Schema Rollback (If Destructive Migration Applied):
If a migration was applied and needs reverting, execute the down-migration file manually via `psql` using `DIRECT_URL`. Never attempt automated down-migrations while live traffic is active.

