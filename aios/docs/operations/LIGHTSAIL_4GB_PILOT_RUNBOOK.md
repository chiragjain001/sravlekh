# AIOS / SARVLEKH — AWS Lightsail 4GB Host Operations Runbook

**Target Infrastructure:** AWS Lightsail Linux (Ubuntu 24.04 LTS), 2 vCPU, 4 GB RAM, 80 GB NVMe SSD  
**Target Profile:** 1-Institute Controlled Pilot (~500–1,500 active students, 30–60 teachers/admins)  
**Database Topology:** Supabase Managed PostgreSQL in AWS Mumbai (`ap-south-1`) via PgBouncer Pooler  

---

## 1. Physical Memory Budget & Container Allocations

The 4 GB host memory is strictly partitioned to guarantee stability during peak student and teacher activity. All database compute is offloaded to Supabase, leaving the entire 4 GB available for application runtimes, caching, and Linux OS page cache.

| Process / Container | Hard Memory Limit | Working Set Reservation | V8 Heap / Runtime Config | CPU Limit | Primary Function |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Linux OS & Systemd** | N/A (Host) | ~550 MB | System baseline | Baseline | Kernel, SSH, systemd, journald |
| **Nginx Reverse Proxy** | 64 MB | 32 MB | Default worker pool | 0.25 vCPU | SSL termination, proxying, rate-limiting |
| **Redis 7 (`redis:7-alpine`)** | 192 MB | 64 MB | `maxmemory 128mb` (`noeviction`, AOF) | 0.25 vCPU | Session cache & durable BullMQ broker |
| **NestJS API (Fastify)** | 512 MB | 256 MB | `--max-old-space-size=384` | 0.75 vCPU | Core REST API, authentication, RBAC |
| **BullMQ Dedicated Worker** | 512 MB | 256 MB | `--max-old-space-size=384` | 0.75 vCPU | Asynchronous grading & split jobs |
| **Python FastAPI Microservice** | 768 MB | 384 MB | Uvicorn single worker (PyMuPDF) | 1.00 vCPU | PDF rasterization & vision |
| **Next.js Web Frontend** | 384 MB | 192 MB | `--max-old-space-size=256` | 0.50 vCPU | SSR and React Server Components |
| **Total Container Limits** | **2,432 MB** | **1,184 MB (~1.2 GB)** | **True Physical Headroom: 1,064 MB (Worst Case) / 2,312 MB (Normal)** |

> [!NOTE]
> Under normal operation at working set reservations (~1,184 MB containers + ~550 MB OS = ~1,734 MB total), **over 2.3 GB of physical RAM is free** for Linux OS page caches, socket buffers, and burst headroom. Even if every single container were pushed to its hard memory limit simultaneously (2,432 MB + 550 MB OS = 2,982 MB), **over 1.0 GB of real physical RAM remains unallocated**, guaranteeing that the Linux kernel never runs out of physical memory.

---

## 2. Queue Concurrency Caps for Low-Memory Stability

Heavy background processing (OCR handwriting extraction and PDF page rendering) is bounded via environment variables in `.env.production` to prevent CPU and memory thrashing:

```bash
# Strictly cap resource-intensive vision and PDF jobs to 1 concurrent task
QUEUE_CONCURRENCY_OCR=1
QUEUE_CONCURRENCY_PDF_SPLIT=1

# Moderate concurrency for I/O-bound AI evaluation calls and score aggregation
QUEUE_CONCURRENCY_AI_EVALUATION=2
QUEUE_CONCURRENCY_SCORE_AGGREGATION=3
QUEUE_CONCURRENCY_MASTERY_RECALC=3
```

**Why this matters:** A single 40-page PDF booklet rasterized via PyMuPDF consumes ~350 MB to 600 MB of transient memory in Python. Limiting `QUEUE_CONCURRENCY_PDF_SPLIT=1` ensures Python never renders multiple booklets simultaneously, eliminating the risk of multi-gigabyte memory spikes.

---

## 3. Host Hardening: 2 GB Swapfile Installation

> [!IMPORTANT]
> **A swapfile is an emergency insurance policy, NOT a substitute for physical RAM.**  
> Swap prevents the Linux Out-Of-Memory (OOM) killer from abruptly terminating Node.js or Redis during transient memory spikes (e.g. concurrent PDF upload bursts). Constant swapping degrades performance; if memory routinely exceeds 3.5 GB, upgrade the VM to 8 GB.

### Installation Steps on Lightsail (Ubuntu 24.04):
```bash
# 1. Check existing swap (Lightsail instances ship with 0 swap by default)
sudo swapon --show

# 2. Allocate 2 GB swapfile
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile

# 3. Format and activate
sudo mkswap /swapfile
sudo swapon /swapfile

# 4. Make permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 5. Tune swappiness (prefer physical RAM, swap only under real pressure)
sudo sysctl vm.swappiness=10
sudo sysctl vm.vfs_cache_pressure=50
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# 6. Verify activation
free -h
```

---

## 4. Upload Protection & Concurrency Throttling

To prevent in-memory buffering bottlenecks:
1. **Direct Presigned S3 Uploads (Primary Flow):**  
   The frontend automatically requests a presigned URL from `POST /upload-url` and streams the file directly to S3 / Cloudflare R2. File bytes never traverse the Fastify Node.js server.
2. **Fallback Multipart Concurrency Guard:**  
   If presigned uploads fail or legacy multipart endpoints are used, `FastifyFileInterceptor` limits concurrent in-flight multipart uploads via `MAX_CONCURRENT_UPLOADS=3`. Any excess simultaneous upload requests receive `429 Too Many Requests` (`UPLOAD_CONCURRENCY_LIMIT`) rather than exhausting the Node.js V8 heap.

---

## 5. Health Probes & Graceful Shutdown

### Health Endpoints:
- `GET /api/v1/health`: Basic liveness check (HTTP 200).
- `GET /api/v1/health/ready`: Readiness check verifying database and Redis connectivity.
- `GET http://127.0.0.1:8000/health`: Python microservice health.

### Graceful Draining:
During deployments or host restarts, Fastify listens for `SIGTERM` and executes:
1. Calls `beginShutdown()`, causing `/health/ready` to immediately return `503 Service Unavailable`.
2. Sleeps for `SHUTDOWN_DRAIN_MS=5000` (5 seconds), allowing Nginx or load balancers to route new requests away.
3. Finishes all active in-flight HTTP requests before closing database connections and exiting cleanly.

---

## 6. Daily Operations & Emergency Commands

### Inspect Real-Time Container Memory Usage:
```bash
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### Check Host Free Memory & Swap:
```bash
free -m
```

### Inspect Application Logs:
```bash
# View Fastify API logs
docker logs -f --tail 100 aios-prod-api

# View Background Worker logs
docker logs -f --tail 100 aios-prod-worker

# View Python PDF / OCR logs
docker logs -f --tail 100 aios-prod-python
```

### Emergency Restart Procedures:
```bash
# Restart API without touching Redis queues
docker compose -f docker-compose.prod.yml restart api

# Restart Background Worker
docker compose -f docker-compose.prod.yml restart worker

# Full Clean Stack Restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

