import { createHash } from 'crypto';
import { Logger } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';

/**
 * How long a producer will wait on Redis before giving up on an enqueue.
 *
 * Against a healthy Redis an `add` is sub-millisecond, so this only ever
 * expires when Redis is actually unreachable. It cannot be left unbounded:
 * queue.module.ts must set `maxRetriesPerRequest: null` (BullMQ requires it),
 * and ioredis's `enableOfflineQueue` defaults to true — together those mean a
 * command issued while the connection is down is buffered in memory and
 * retried forever rather than rejecting. The request awaiting it then never
 * gets a response at all: the caller sees the socket die (ECONNRESET), not an
 * error it can act on.
 *
 * Fixing this on the shared connection instead (enableOfflineQueue: false)
 * would also change how *workers* behave across a brief blip, which is a
 * different and riskier trade. Bounding the producer side keeps the blast
 * radius at the one place that has an HTTP caller waiting on it.
 */
export const ENQUEUE_TIMEOUT_MS = 5_000;

/** Thrown when Redis could not accept the job within ENQUEUE_TIMEOUT_MS. */
export class QueueUnavailableError extends Error {
  constructor(queueName: string, jobId: string) {
    super(
      `Could not enqueue job "${jobId}" on queue "${queueName}" within ${ENQUEUE_TIMEOUT_MS}ms — ` +
        `Redis is unreachable. The job was not scheduled.`,
    );
    this.name = 'QueueUnavailableError';
  }
}

/**
 * One budget for the whole enqueue, not one per Redis call: the dedupe lookup
 * and the add are both unreachable in exactly the same circumstance, so
 * charging each its own full timeout would make a caller wait 2x
 * ENQUEUE_TIMEOUT_MS to be told the same thing once.
 */
function deadlineIn(ms: number): () => number {
  const at = Date.now() + ms;
  return () => Math.max(0, at - Date.now());
}

// Promise.resolve() rather than work.then() directly: BullMQ's Queue is often
// stubbed in tests with plain jest.fn()s that return undefined, and a helper
// that only exists to add a timeout should not be the thing that breaks on a
// synchronous return.
function withTimeout<T>(work: PromiseLike<T> | T, budgetMs: number, onTimeout: () => Error): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeout()), budgetMs);
    Promise.resolve(work).then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

/**
 * Deduplicated enqueue — the single place every producer adds a job.
 *
 * WHY: no producer previously set a `jobId`, so BullMQ generated one per call and
 * there was no dedupe key at all. A double-clicked button, a client retry, or an
 * at-least-once redelivery enqueued genuinely duplicate work. That is harmless
 * where the consumer upserts (score-aggregation) and actively wrong where it
 * inserts — a duplicated `ocr` job writes a second OCRResult row for the same
 * region, and 24-OCR-HANDWRITING-ARCHITECTURE.md §6 makes OCRResult append-only
 * by design, so nothing downstream would ever collapse the duplicate.
 *
 * A caller-supplied `jobId` closes that: while a job for the same key is waiting,
 * delayed or active, a second `add` is ignored by BullMQ.
 *
 * THE TRAP THIS FUNCTION EXISTS FOR: BullMQ ignores an `add` whose jobId already
 * exists in *any* state, including `failed`. Since failed jobs are deliberately
 * retained (queue.module.ts) so they stay visible and inspectable, a job that
 * exhausted its retries would otherwise permanently block that key — an OCR
 * region that failed three times could never be re-extracted, and the second
 * enqueue would return success while doing nothing. Clearing a superseded failed
 * job by id before adding keeps retention and retryability compatible.
 *
 * Completed jobs need no such handling: `removeOnComplete: true` frees the key
 * the moment the job finishes.
 */
export async function enqueueDeduped<T>(
  queue: Queue,
  name: string,
  data: T,
  jobId: string,
  opts: JobsOptions,
  logger?: Logger,
): Promise<void> {
  const remaining = deadlineIn(ENQUEUE_TIMEOUT_MS);
  const expired = () => new QueueUnavailableError(queue.name, jobId);

  try {
    // Timed out as well as caught: with Redis down this does not reject, it
    // simply never settles (see ENQUEUE_TIMEOUT_MS), so a bare try/catch here
    // would hang rather than fall through.
    const existing = await withTimeout(queue.getJob(jobId), remaining(), expired);
    if (existing && (await withTimeout(existing.isFailed(), remaining(), expired))) {
      // Superseded by this new request — drop the dead-lettered attempt so the
      // key is free. Its diagnostic record already went to the log and Sentry
      // via reportDeadLetter when it exhausted its retries.
      await withTimeout(existing.remove(), remaining(), expired);
    }
  } catch (err) {
    // Redis unreachable, or the job vanished between getJob and remove (another
    // instance handled it). Fall through to add(): the worst case is BullMQ
    // ignoring a duplicate, which is the behaviour we want anyway. Never let
    // dedupe bookkeeping fail the caller's request.
    logger?.debug?.(`enqueueDeduped: could not clear prior job ${jobId}: ${(err as Error).message}`);
  }

  // NOT swallowed: unlike the dedupe bookkeeping above, a failed add means the
  // job genuinely was not scheduled. Callers decide what that means for them —
  // reports.service.ts marks the report FAILED rather than leaving it QUEUED
  // forever; side-effect producers let it surface as a 500 they can retry.
  await withTimeout(queue.add(name, data, { ...opts, jobId }), remaining(), expired);
}

/**
 * Builds a dedupe key that is stable for identical work and distinct for
 * different work. Order matters, so callers must sort any collection they pass
 * (see the mastery-recalc producer).
 *
 * Segments are joined with '-', NOT ':'. BullMQ rejects a custom job id
 * containing a colon outright — "Custom Id cannot contain :" — because Redis
 * key namespaces are colon-delimited and a colon in the id would corrupt the
 * key structure. The first version of this used ':' and every producer threw a
 * 500 the moment it met a real Redis; the unit tests never saw it because they
 * mock queue.add and so never run BullMQ's own validation. Hence
 * assertValidJobId below, which fails loudly and locally instead.
 */
export function jobKey(...segments: (string | number)[]): string {
  return assertValidJobId(segments.map((s) => String(s)).join('-'));
}

/** BullMQ's constraint, enforced where a developer will actually see it. */
export function assertValidJobId(id: string): string {
  if (id.includes(':')) {
    throw new Error(`Invalid BullMQ job id "${id}": custom ids cannot contain ':'.`);
  }
  return id;
}

/**
 * A short, order-independent digest of a topic set.
 *
 * Interpolating the ids directly would work but produce an unbounded job id — a
 * recalculation spanning fifty topics would carry all fifty cuids as its Redis
 * key. Sorted before hashing so the same set in a different order is recognised
 * as the same work; truncated because 12 hex characters is ample to separate the
 * handful of distinct topic sets in flight for one student at one time.
 */
export function topicSetDigest(topicIds: readonly string[]): string {
  return createHash('sha256').update([...topicIds].sort().join(',')).digest('hex').slice(0, 12);
}
