# SARVLEKH Security & Failure Analysis

## 1. Security Analysis

### 1.1 Authentication & Authorization
- **Guard Rails:** The NestJS API leverages `JwtAuthGuard` globally, ensuring that every route requires an authenticated user token unless decorated with `@Public()`. Role-based access control is managed via `RolesGuard`.
- **Tenant Validation:** An essential security invariant in SARVLEKH is tenant isolation. `instituteId` is derived exclusively from the authenticated JWT token context on the server side (`req.user.instituteId`). No endpoint should ever trust a client-supplied `instituteId`.

### 1.2 Data Privacy
- **AI Integration:** The platform evaluates user responses using large language models. The prompt adapter strictly isolates LLM calls, ensuring user data is sent anonymously without PII (e.g., stripping names from scanned text).
- **OCR Confidence Scoring:** Security rules mandate that any scanned text with confidence `< 0.5` is deemed illegible and skips automatic grading to prevent LLM hallucinations from returning false marks.

## 2. Failure Analysis & Resiliency

### 2.1 Database & Connection Exhaustion
- **Postgres Connections:** High concurrency operations previously opened large numbers of connections. PgBouncer is heavily recommended at scale (as per ADR-002) to maintain transaction throughput without blowing past maximum connection limits.

### 2.2 Redis Unavailability
- **Rate Limiting Degradation:** Redis is utilized for sliding window rate limiting. If Redis fails, the system safely falls back to a per-instance memory cache, allowing traffic to continue albeit with reduced precision across instances.

### 2.3 Async AI Pipeline Failure
- **Long-Running Webhooks:** AI evaluation previously blocked an HTTP thread for 20+ minutes during batch jobs. The system now utilizes a chunked paginated queue processor to dispatch AI evaluations in chunks of 5, guaranteeing timeouts aren't triggered at the proxy layer and jobs can safely resume on failure.
- **Durable Queuing:** Jobs are enqueued through BullMQ which manages backoff and max-attempts. Any failed chunks simply retry gracefully without forcing a full 15-minute retry loop.

### 2.4 Race Conditions
- **Double Evaluation:** To prevent multiple concurrent grades, the `ai_evaluator.py` utilizes compare-and-swap (CAS) logic (`currentEvaluationVersionId`) before appending new AI grades.
