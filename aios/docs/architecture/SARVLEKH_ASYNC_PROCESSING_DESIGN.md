# SARVLEKH_ASYNC_PROCESSING_DESIGN

## 1. Queue Contracts & Responsibilities
SARVLEKH uses BullMQ backed by Redis for asynchronous durable execution.

| Queue | Producer | Consumer | SLA / Timeout |
| --- | --- | --- | --- |
| `ai-evaluation` | NestJS API | NestJS Worker | High-latency (Async webhook transition planned) |
| `ocr` | NestJS API | NestJS Worker | Medium-latency |
| `mastery-recalc`| NestJS API | NestJS Worker | Low-latency |
| `score-aggregation` | NestJS API | NestJS Worker | Low-latency |

## 2. Re-engineered AI Workflow (Target Design)
Instead of blocking HTTP requests:
1. NestJS Worker dequeues `ai-evaluation` job.
2. NestJS Worker POSTs to Python `/evaluation/ai-evaluate-batch/async`.
3. Python creates a background Task and returns `202 Accepted`.
4. NestJS Worker completes the BullMQ job immediately.
5. Python processes the batch, writes results to the DB, and triggers a NestJS webhook `/api/v1/webhooks/evaluation-complete`.
6. NestJS webhook enqueues `score-aggregation` and `mastery-recalc`.

## 3. Delivery Semantics & Failure Handling
- **Idempotency**: All jobs must verify DB state before execution. (e.g. skip if `Assessment` is already `GRADED`).
- **Retries**: BullMQ handles exponential backoff (e.g., attempts: 3, backoff: 1s, 5s, 25s).
- **Dead-letter**: Failed jobs after maximum retries are moved to the DLQ and logged to Sentry.
