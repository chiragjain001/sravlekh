# SARVLEKH Data & API Design

## 1. Data Architecture

SARVLEKH operates as a multi-tenant SaaS application (B2B2C). Its core data architecture relies on a shared-database, shared-schema approach managed via Prisma (PostgreSQL).

### 1.1 Tenant Isolation
The system mandates logical isolation using the `instituteId` column. 
Every query MUST strictly filter by `instituteId` derived from the server-side JWT session, **never** trusting client-provided tenant identifiers.

- **Isolation Level:** Logical (Row-level application logic).
- **Enforcement:** Global query constraints and service-level access checks.
- **Cross-Tenant Access:** Strictly forbidden. A system administrator must assume an identity (impersonation) within the boundary of a single institute to perform administrative actions.

### 1.2 Caching Strategy (Redis)
Redis is leveraged to alleviate PostgreSQL load for high-throughput, frequently read data:
- **Session State:** JWT token denylists and active sessions.
- **Rate Limiting:** Sliding window logs.
- **Read-heavy Entities:** Features like FeatureFlags which dictate conditional logic.

*Constraint:* Redis is ephemeral. No persistent source-of-truth data resides in Redis.

## 2. API Design Principles (NestJS)

The API layer is built on NestJS using strict Decorator-based Routing and Validation.

### 2.1 Default Security Stance
- **Authentication:** All routes are protected by `JwtAuthGuard` by default. Public routes must explicitly use the `@Public()` decorator.
- **Authorization:** Enforced via `RolesGuard` (`@Roles()`). Unannotated endpoints accessible only to authenticated users still require explicit tenant scoping.

### 2.2 Validation and Transformation
- **Input Validation:** Enforced using `class-validator` and `class-transformer` across all DTOs.
- **Type Safety:** TypeScript types must strictly mirror API contracts. Any schema divergence is treated as a severe defect.

### 2.3 Modular Monolith Constraints
- Inter-module communication must happen via exported services.
- Database access is scoped to the module's domain (e.g., the `AiEvaluation` module does not query `Users` directly without going through the `UsersService`).

## 3. Asynchronous APIs

Certain high-latency operations (like batch AI evaluations) follow an asynchronous chunking or webhook design pattern to prevent HTTP timeouts and TCP exhaustions.
- **Pattern:** HTTP POST returns `{"hasMore": true}`. The NestJS worker orchestrates loop calls internally without exceeding short proxy timeouts.
- **Queue:** BullMQ manages concurrency and rate-limiting.
