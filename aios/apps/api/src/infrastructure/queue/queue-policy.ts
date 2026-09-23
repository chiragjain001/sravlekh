import type { JobsOptions } from 'bullmq';

/**
 * Per-queue retention and concurrency, in one place.
 *
 * Deliberately NOT one global value applied to all six. The queues differ in
 * volume, cost per job, what a lost job costs a real person, and what else
 * already records the outcome — so a single number would be either wasteful for
 * the cheap high-volume queues or negligent for the expensive ones.
 *
 * ── Why removeOnComplete is `true` on every queue ──────────────────────────
 *
 * This one IS uniform, but for a reason established per queue rather than
 * assumed: every queue already writes a durable Postgres record of its own
 * outcome — ScoreRecord, AIRecommendation/EvaluationVersion, OCRResult,
 * MasteryScore, NoticeDelivery, Report. Retaining a completed job in Redis
 * would duplicate an audit trail that already exists in the database, where it
 * is queryable, tenant-scoped and permanent.
 *
 * It would also actively break things: job ids are dedupe keys (see enqueue.ts)
 * and BullMQ refuses an `add` whose id exists in ANY state, completed included.
 * Retaining completed jobs would silently block the legitimate re-runs the
 * product depends on — re-evaluating a response, re-extracting a corrected OCR
 * region, re-aggregating after a second teacher decision.
 *
 * ── Why removeOnFail differs per queue ─────────────────────────────────────
 *
 * A dead-lettered job's payload is the cheapest way to see WHAT failed, and the
 * cost of losing one differs sharply by queue. Both a count and an age bound are
 * set everywhere: count bounds Redis memory under a burst, age stops a
 * low-volume queue quietly hoarding jobs from months ago. Neither alone is
 * enough, and "forever" is not an option.
 *
 * Failures are additionally reported to logs and Sentry by reportDeadLetter, so
 * losing a job body past its window costs context, never the alert itself.
 *
 * Sized for ONE PILOT INSTITUTE. Revisit with real volume rather than by
 * guessing higher.
 */

const DAY = 24 * 60 * 60;

export interface QueuePolicy {
  /** Max jobs this process handles at once for the queue. */
  concurrency: number;
  /** Retention, merged into every job this queue enqueues. */
  jobOptions: Pick<JobsOptions, 'removeOnComplete' | 'removeOnFail'>;
}

function fromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const QUEUE_POLICY = {
  /**
   * AI EVALUATION — one provider call per job; the most expensive work here.
   *
   * Concurrency 4: bounded by the provider's rate limit and the Python service,
   * not by this process. Each job is a Node→Python hop plus a provider call, so
   * it is idle-waiting almost end to end; but raising this past what the
   * provider absorbs converts a slow queue into a queue of 429s. Evaluation also
   * owns a 20s hard timeout (docs/27 §6), so a stuck job cannot hold a slot.
   *
   * Failures retained longest and largest: a dead-lettered evaluation means a
   * student's paper is ungraded AND the provider spend is already incurred, so
   * the payload is worth keeping long enough to investigate across a weekend.
   */
  aiEvaluation: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_AI_EVALUATION', 4),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 500, age: 14 * DAY } },
  },

  /**
   * OCR — vision calls, heavier and slower per job than text evaluation.
   *
   * Concurrency 3, below evaluation: images are larger payloads against the same
   * provider budget, and OCR competes with evaluation for it.
   *
   * Idempotency matters most here. OCRResult is append-only by design
   * (24-OCR-HANDWRITING-ARCHITECTURE.md §6), so a duplicate job writes a second
   * machine reading that nothing downstream collapses — hence the dedupe key,
   * and hence removeOnComplete: true so a corrected region can be re-extracted.
   */
  ocr: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_OCR', 3),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 500, age: 14 * DAY } },
  },

  /**
   * PDF SPLIT — one job per uploaded PDF booklet, rendering every page through
   * api-python. Heavier per job than OCR (a whole file, not one region) and
   * rarer, so it runs at low concurrency; a booklet that fails to render is
   * failed on the document rather than retried forever.
   */
  pdfSplit: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_PDF_SPLIT', 2),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 500, age: 14 * DAY } },
  },

  /**
   * SCORE AGGREGATION — the highest-volume queue: one job per evaluation
   * decision, and a teacher grades in bursts.
   *
   * Concurrency 5. Pure database work (an upsert over one attempt's responses),
   * so the real limit is the Prisma connection pool, not CPU. Kept at 5 because
   * the workers share that pool with the API's own request traffic, and the
   * production-readiness audit measured a 197ms round-trip to a remote database:
   * connections are the scarce resource until co-location lands.
   *
   * Safe to run in parallel despite ordering not being guaranteed: recalculate()
   * upserts on attemptId from the current authoritative versions, so the last
   * writer converges on the same answer rather than corrupting it.
   *
   * Higher failure count, shorter age: high volume means a burst of failures
   * would be a burst, and a stale score is noticed within days, not weeks.
   */
  scoreAggregation: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_SCORE_AGGREGATION', 5),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 1000, age: 7 * DAY } },
  },

  /**
   * MASTERY RECALC — Node→Python round-trip, no provider call, so cheaper and
   * faster than the AI queues but still not local work.
   *
   * Concurrency 5: the Python service is the constraint, and it holds its own
   * Postgres connections. Shares that budget with OCR and evaluation, which is
   * why no single queue is set high.
   *
   * SMALLEST failure retention: mastery is derived, self-healing state. The next
   * evaluation for that student re-enqueues a recalculation over the same topics
   * and overwrites the result, so a lost failure payload costs little. Retained
   * at all only because a PERSISTENT failure here is worth spotting — it would
   * silently freeze intervention triggering.
   */
  masteryRecalc: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_MASTERY_RECALC', 5),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 200, age: 7 * DAY } },
  },

  /**
   * NOTICE DISPATCH — fan-out to external delivery providers.
   *
   * LOWEST concurrency, 2. One notice can expand to thousands of recipient
   * deliveries, so parallelism here multiplies against a third party's rate
   * limit rather than our own capacity — two jobs can already be thousands of
   * outbound messages.
   *
   * Failures retained LONGEST. A dead-lettered dispatch means real people were
   * not told something they were meant to be told; that is the queue whose
   * failures someone will still be asking about a month later. The per-recipient
   * outcome lives in NoticeDelivery rows, so this retention is for the job-level
   * "why did the whole dispatch fail" question the database cannot answer.
   */
  noticeDispatch: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_NOTICE_DISPATCH', 2),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 500, age: 30 * DAY } },
  },

  /**
   * REPORT GENERATION — the only genuinely CPU-bound work in this list; rendering
   * happens in-process rather than waiting on a network hop.
   *
   * Concurrency 2, kept near serial: parallel rendering competes with the event
   * loop the other five queues need to stay responsive on their I/O.
   *
   * Note that reissueForStudent creates a NEW Report row with a new id, so a
   * report is generated once per id and the dedupe key is never legitimately
   * reused — removeOnComplete: true here is for memory, not for re-runnability.
   */
  reportGeneration: {
    concurrency: fromEnv('QUEUE_CONCURRENCY_REPORT_GENERATION', 2),
    jobOptions: { removeOnComplete: true, removeOnFail: { count: 300, age: 14 * DAY } },
  },
} as const satisfies Record<string, QueuePolicy>;

/**
 * Whether this process consumes jobs.
 *
 * Default ON, so a single-process deployment (and every existing dev setup and
 * test) behaves exactly as before. Set RUN_WORKERS=false on the API once a
 * dedicated worker (worker.ts) runs alongside it, so the API stops competing for
 * jobs it should no longer run. Verified end-to-end: with this false, a queued
 * job stays waiting until the worker process starts.
 *
 * Implemented with BullMQ's `autorun` rather than by conditionally registering
 * the processor providers, so producers, health checks and queue metrics keep
 * working identically whichever mode a process runs in.
 */
export const RUN_WORKERS = process.env['RUN_WORKERS'] !== 'false';

/** Worker options for a @Processor: concurrency plus the autorun switch. */
export function workerOptions(policy: QueuePolicy) {
  return { concurrency: policy.concurrency, autorun: RUN_WORKERS };
}
