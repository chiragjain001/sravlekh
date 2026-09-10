import { Queue } from 'bullmq';
import { ENQUEUE_TIMEOUT_MS, QueueUnavailableError, enqueueDeduped, jobKey, topicSetDigest } from './enqueue';

/**
 * These pin the two behaviours the helper exists for. Both were absent before:
 * no producer set a jobId at all, so duplicate work was always enqueued.
 */
describe('enqueueDeduped', () => {
  let queue: { add: jest.Mock; getJob: jest.Mock };

  beforeEach(() => {
    queue = { add: jest.fn().mockResolvedValue(undefined), getJob: jest.fn().mockResolvedValue(null) };
  });

  const run = (jobId: string) =>
    enqueueDeduped(queue as unknown as Queue, 'extract', { regionId: 'r1' }, jobId, { attempts: 3 });

  it('passes the caller-supplied jobId through as the dedupe key', async () => {
    await run('ocr:r1:HANDWRITTEN_TEXT');

    expect(queue.add).toHaveBeenCalledWith(
      'extract',
      { regionId: 'r1' },
      expect.objectContaining({ jobId: 'ocr:r1:HANDWRITTEN_TEXT', attempts: 3 }),
    );
  });

  it('leaves a still-pending job alone so the duplicate is dropped by BullMQ', async () => {
    const pending = { isFailed: jest.fn().mockResolvedValue(false), remove: jest.fn() };
    queue.getJob.mockResolvedValue(pending);

    await run('ocr:r1:HANDWRITTEN_TEXT');

    expect(pending.remove).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalled(); // BullMQ itself ignores the duplicate id
  });

  it('clears a dead-lettered job with the same id so the key is re-enqueueable', async () => {
    // The trap this helper exists for: failed jobs are retained deliberately, and
    // BullMQ refuses an add whose jobId exists in ANY state — so without this a
    // region that failed three times could never be re-extracted, and the retry
    // would silently succeed while doing nothing.
    const failed = { isFailed: jest.fn().mockResolvedValue(true), remove: jest.fn().mockResolvedValue(undefined) };
    queue.getJob.mockResolvedValue(failed);

    await run('ocr:r1:HANDWRITTEN_TEXT');

    expect(failed.remove).toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalled();
  });

  it('still enqueues when the dedupe bookkeeping itself fails', async () => {
    // Redis blip, or another instance removed the job first. Never fail the
    // caller's request over dedupe housekeeping — a duplicate is recoverable,
    // a dropped evaluation is not.
    queue.getJob.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(run('ocr:r1:HANDWRITTEN_TEXT')).resolves.toBeUndefined();
    expect(queue.add).toHaveBeenCalled();
  });

  // ── Redis-unreachable behaviour ────────────────────────────────────────────
  // With Redis down, ioredis buffers commands instead of rejecting them (the
  // connection sets maxRetriesPerRequest: null, as BullMQ requires, and leaves
  // enableOfflineQueue at its default). The promise therefore never settles,
  // and an unbounded await left the HTTP caller with a dead socket rather than
  // an error — POST /reports reproduced exactly that.
  describe('when Redis never responds', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const never = () => new Promise<never>(() => {});

    it('gives up on add() instead of hanging the caller forever', async () => {
      queue.add.mockImplementation(never);

      const pending = run('report-1');
      const assertion = expect(pending).rejects.toBeInstanceOf(QueueUnavailableError);
      await jest.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS + 1);
      await assertion;
    });

    it('gives up on the dedupe lookup too, and still attempts the add', async () => {
      // getJob is inside a try/catch, but catching does not help a promise that
      // never settles — without a timeout the helper stalls before reaching add.
      queue.getJob.mockImplementation(never);

      const pending = run('report-1');
      await jest.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS + 1);
      await expect(pending).resolves.toBeUndefined();
      expect(queue.add).toHaveBeenCalled();
    });

    it('spends one timeout budget in total, not one per Redis round-trip', async () => {
      // Both calls are unreachable for the same reason, so charging each its
      // own full timeout would make the caller wait 2x to learn it once — the
      // first cut of this fix took 10.7 s to return a 503.
      queue.getJob.mockImplementation(never);
      queue.add.mockImplementation(never);

      const pending = run('report-1');
      const assertion = expect(pending).rejects.toBeInstanceOf(QueueUnavailableError);
      await jest.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS + 1);
      await assertion;
    });

    it('names the queue and job in the error so the log identifies the lost work', async () => {
      queue.add.mockImplementation(never);
      Object.assign(queue, { name: 'report-generation' });

      const pending = run('report-1');
      const assertion = expect(pending).rejects.toThrow(/report-generation.*not scheduled|report-1/s);
      await jest.advanceTimersByTimeAsync(ENQUEUE_TIMEOUT_MS + 1);
      await assertion;
    });
  });
});

describe('jobKey', () => {
  it('joins segments into a stable key', () => {
    expect(jobKey('mastery', 'sp-1', 'abc123')).toBe('mastery-sp-1-abc123');
  });

  it('distinguishes different work', () => {
    expect(jobKey('agg', 'attempt-1')).not.toBe(jobKey('agg', 'attempt-2'));
  });

  // THE REGRESSION THIS FILE MISSED FIRST TIME ROUND.
  //
  // jobKey originally joined with ':'. BullMQ rejects that outright — "Custom Id
  // cannot contain :" — so every producer returned a 500 the moment it met a
  // real Redis. These tests did not catch it because they mock queue.add, which
  // means BullMQ's own validation never runs. The constraint is therefore
  // asserted here directly, where it fails in milliseconds instead of in staging.
  it('never produces an id containing a colon, which BullMQ rejects', () => {
    expect(jobKey('agg', 'cmt123')).not.toContain(':');
    expect(jobKey('ocr', 'region-1', 'HANDWRITTEN_TEXT')).not.toContain(':');
  });

  it('rejects a colon supplied inside a segment', () => {
    expect(() => jobKey('agg', 'has:colon')).toThrow(/cannot contain/);
  });
});

describe('topicSetDigest', () => {
  it('is order-independent — the same set is the same work', () => {
    expect(topicSetDigest(['b', 'a', 'c'])).toBe(topicSetDigest(['a', 'b', 'c']));
  });

  it('separates genuinely different topic sets', () => {
    // Keying mastery on the student alone would silently drop a recalculation
    // for different topics as a "duplicate" — a semantics change, not a dedupe.
    expect(topicSetDigest(['a', 'b'])).not.toBe(topicSetDigest(['a', 'c']));
  });

  it('stays short regardless of how many topics are recalculated', () => {
    const many = Array.from({ length: 50 }, (_, i) => `topic-cuid-${i}`);
    expect(topicSetDigest(many)).toHaveLength(12);
  });
});
