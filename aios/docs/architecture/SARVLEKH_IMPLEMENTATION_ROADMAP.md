# SARVLEKH Implementation Roadmap

## Overview
This roadmap outlines the path towards transforming SARVLEKH into a robust, scalable multi-tenant EdTech platform supporting 10,000+ enrolled students, as formulated during the architectural audit and remediation efforts.

## Phase 1: High-Risk Defect Remediation (Current)
- [x] **Identify Timeout Risks**: Profiled AI evaluation and mapped API boundary risks.
- [x] **Refactor AI Evaluation (Durable Dispatch)**: Transitioned long-lived 20+ minute polling requests to chunked, resilient background processes using BullMQ and FastAPI limits.
- [x] **Eliminate Mock Data**: Replaced placeholders with real API-driven React hooks inside Admin and Founder dashboards (e.g. `FounderIntegrations.tsx`, `FounderFeatureManagement.tsx`).
- [x] **Verify Architecture Invariants**: Validated logical isolation, checking all services properly validate `instituteId`.

## Phase 2: Database & Connection Scale-Out (Next)
- [ ] **Implement PgBouncer**: Deploy and configure PgBouncer as a sidecar/service to manage Postgres transaction pools.
- [ ] **Prisma Pooling**: Adjust Prisma config to rely on PgBouncer proxy instead of internal pooling limits.
- [ ] **Database Indexes**: Audit missing composite indexes on hot tables like `AssessmentDelivery`, `Response`, and `Evaluation`.

## Phase 3: AI Engine Decoupling
- [ ] **Webhook Refactoring**: Evolve the batch evaluation mechanism from NestJS chunk polling to a pure decoupled webhook callback.
- [ ] **Provider Abstraction**: Expand the AI adapter interface to easily swap LLM vendors for evaluation if throughput limits (e.g. tokens per minute) are reached on OpenAI.

## Phase 4: Observability & Production Readiness
- [ ] **Structured Logging**: Standardize Winston logs inside NestJS to include tracing (X-Request-ID).
- [ ] **Sentry Integration**: Add Sentry to track frontend boundary errors and API exceptions.
- [ ] **Load Testing Verification**: Simulate 2,000 concurrent students performing high-velocity quiz submissions to ensure Redis and BullMQ queues remain stable.

## Phase 5: Caching & Latency Optimizations
- [ ] **Read-Through Cache**: Introduce Redis read-through caching for high-volume static paths (e.g., standard rubric configurations, non-sensitive public assets).
- [ ] **Edge Deployment**: Move the Next.js frontend to an Edge network (e.g., Vercel or Cloudflare) closer to the student bases.
