# SARVLEKH_CURRENT_ARCHITECTURE

## 1. System Context & Overview
SARVLEKH is a multi-tenant EdTech SaaS platform designed to facilitate assessment creation, subjective AI-driven evaluation, objective grading, OCR processing of handwritten answers, and mastery analytics for students.

## 2. Component Inventory
| Component | Technology | Responsibility | Verification Status |
| --- | --- | --- | --- |
| **Frontend Web App** | Next.js 14, React, TailwindCSS, Zustand | Renders the dashboard and web interfaces. Proxies `/api/v1` to NestJS and `/api/py` to Python. | PARTIALLY VERIFIED (Heavy mocking present in UI) |
| **Backend API** | NestJS, TypeScript | Primary orchestration, authorization, core business logic, tenant boundary enforcement. | VERIFIED |
| **Background Workers** | NestJS | Consumes BullMQ jobs for OCR, AI-evaluation, Score Aggregation, Mastery Recalc. | VERIFIED |
| **Python Engine** | FastAPI, Python | AI adapter, OCR pipeline, Mastery EMA calculation, blueprint generation. | VERIFIED |
| **Database** | PostgreSQL 16, Prisma | Primary persistent data store (multi-tenant). | VERIFIED |
| **Message Broker** | Redis | Job queue state for BullMQ, rate limiting storage. | VERIFIED |

## 3. Trust Boundaries & Data Ownership
- **PostgreSQL** is the sole source of truth. Python reads/writes directly to the DB using `prisma-client-py`.
- **Tenant Isolation** is enforced via `instituteId` attached to JWT tokens.
- **Internal Service Auth**: NestJS to Python requests are secured via a static `X-Internal-Token`.

## 4. Current Architecture Weaknesses
1. **Long-lived HTTP Connections**: The `ai-evaluate-batch` endpoint in Python holds connections open for up to 20 minutes while evaluating batches of subjective responses. NestJS blocks on this Axios call, risking connection exhaustion and silent failures.
2. **Frontend Mocking**: The Next.js frontend relies on mock data files (e.g. `audit_raw.json`) rather than fully integrating with existing NestJS APIs.
3. **Graceful Degradation of Rate Limits**: The rate limiter degrades to per-instance memory counting when Redis is down, effectively multiplying the allowed limits by the number of instances.
4. **AI Costs**: All subjective responses are sent to premium models without a cascading fallback mechanism.
