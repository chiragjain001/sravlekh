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

### 5.1 Automated Database Backups (Supabase)
Supabase Pro automatically retains daily physical backups with a 7-day retention period. No manual cron dumps are required for database reliability.

### 5.2 Application Data Backup Script
To take a full manual logical snapshot of institute schemas and configuration:
```bash
# Uses the built-in backup orchestrator
node infra/backup/backup.js --out /backup/aios-manual-$(date +%F).tar.gz
```

### 5.3 Automated Host Snapshots (Lightsail)
In the AWS Lightsail console:
- Navigate to the **Snapshots** tab on the instance.
- Enable **Automatic Snapshots** at `03:00 UTC` daily with 7-day retention (~$1.00/month).

### 5.4 Database Restoration Drill
To test or execute a disaster recovery restoration into a target database:
```bash
node infra/backup/restore.js --file /backup/aios-manual.tar.gz --target "$RESTORE_DATABASE_URL"
```

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

