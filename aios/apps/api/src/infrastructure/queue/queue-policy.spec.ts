import { QUEUE_POLICY, RUN_WORKERS, workerOptions } from './queue-policy';

const QUEUES = Object.entries(QUEUE_POLICY);

describe('QUEUE_POLICY', () => {
  it('covers all six queues', () => {
    expect(QUEUES.map(([name]) => name).sort()).toEqual([
      'aiEvaluation', 'masteryRecalc', 'noticeDispatch', 'ocr', 'reportGeneration', 'scoreAggregation',
    ]);
  });

  describe.each(QUEUES)('%s', (name, policy) => {
    it('never retains completed jobs', () => {
      // Uniform, but for a reason established per queue: each already writes a
      // durable Postgres record of its outcome, so Redis retention would
      // duplicate an audit trail that already exists — and job ids are dedupe
      // keys, so a retained completed job would silently block the legitimate
      // re-runs the product depends on.
      expect(policy.jobOptions.removeOnComplete).toBe(true);
    });

    it('bounds failed jobs by BOTH count and age', () => {
      // Count alone lets a low-volume queue hoard months-old jobs; age alone
      // lets a burst blow memory inside the window. "Forever" is not an option.
      const onFail = policy.jobOptions.removeOnFail as { count: number; age: number };
      expect(typeof onFail).toBe('object');
      expect(onFail.count).toBeGreaterThan(0);
      expect(onFail.age).toBeGreaterThan(0);
    });

    it('keeps concurrency conservative for a single pilot institute', () => {
      // The binding constraint is downstream — the Python service, the provider's
      // rate limit, the Prisma pool — not this process. A large value here
      // converts a slow queue into a queue of 429s and pool timeouts.
      expect(policy.concurrency).toBeGreaterThanOrEqual(1);
      expect(policy.concurrency).toBeLessThanOrEqual(10);
    });
  });

  it('gives external fan-out the lowest concurrency', () => {
    // One notice can expand to thousands of recipient deliveries, so parallelism
    // multiplies against a third party's limit rather than our own capacity.
    const others = QUEUES.filter(([n]) => n !== 'noticeDispatch').map(([, p]) => p.concurrency);
    expect(QUEUE_POLICY.noticeDispatch.concurrency).toBeLessThanOrEqual(Math.min(...others));
  });

  it('retains notice-dispatch failures longest', () => {
    // A dead-lettered dispatch means real people were not told something. That
    // is the queue whose failures someone still asks about a month later.
    const ages = QUEUES.map(([, p]) => (p.jobOptions.removeOnFail as { age: number }).age);
    expect((QUEUE_POLICY.noticeDispatch.jobOptions.removeOnFail as { age: number }).age).toBe(Math.max(...ages));
  });

  it('retains mastery-recalc failures least — it is self-healing', () => {
    // The next evaluation for that student re-enqueues a recalculation over the
    // same topics and overwrites the result.
    const counts = QUEUES.map(([, p]) => (p.jobOptions.removeOnFail as { count: number }).count);
    expect((QUEUE_POLICY.masteryRecalc.jobOptions.removeOnFail as { count: number }).count).toBe(Math.min(...counts));
  });
});

describe('workerOptions', () => {
  it('carries the queue concurrency and the autorun switch', () => {
    expect(workerOptions(QUEUE_POLICY.ocr)).toEqual({ concurrency: QUEUE_POLICY.ocr.concurrency, autorun: RUN_WORKERS });
  });

  it('defaults to consuming, so single-process and dev setups are unchanged', () => {
    expect(RUN_WORKERS).toBe(process.env['RUN_WORKERS'] !== 'false');
  });
});
