# SARVLEKH_TARGET_SYSTEM_DESIGN

## 1. Target Architecture Overview
The target architecture remains a **Modular Monolith** for core business domains (NestJS) coupled with a **Specialized Compute Sidecar** (Python FastAPI) for heavy, stateless analytics, ML, and AI tasks.

This approach provides the simplicity of a monolith with the operational isolation required by long-running GPU/CPU intensive tasks.

## 2. Key Architectural Decisions
- **ADR 001: Webhook-based Async AI Processing**
  - *Context*: NestJS workers currently block on Python HTTP responses for up to 20 minutes for batch AI evaluations.
  - *Decision*: Python will immediately return a `202 Accepted` with a `jobId`. Upon completion, Python will trigger a webhook back to NestJS or update the DB status directly, eliminating blocking HTTP calls.
- **ADR 002: PgBouncer for Connection Pooling**
  - *Context*: Both NestJS and Python open direct connections to Postgres. Scale-out will rapidly exhaust connection limits.
  - *Decision*: Introduce PgBouncer in transaction mode between applications and Postgres.

## 3. Deployment Topology
- **API & Web**: Deployed as autoscaling containers (ECS/EKS).
- **Workers**: Scaled independently based on BullMQ queue depth.
- **Python Engine**: Scaled independently, bound by AI provider rate limits.
- **Database**: Managed PostgreSQL (e.g. RDS/Cloud SQL) with PgBouncer.

## 4. Migration Plan
1. Re-engineer the AI-Evaluation flow to be fully asynchronous (DB status polling or webhook).
2. Wire real Next.js UI components to the NestJS API.
3. Deploy PgBouncer and update Prisma connection strings.
