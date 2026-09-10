/* Real-Redis queue verification.
 *
 * "Job accepted" is not proof. Every check below asserts that a worker actually
 * executed and that state changed as a result — never that an enqueue returned.
 *
 *   docker compose -f infra/staging/docker-compose.yml up -d
 *   REDIS_URL=redis://localhost:6380 node infra/staging/verify-queues.js
 *
 * Uses the project's real BullMQ + ioredis, but its OWN throwaway queue name, so
 * it never consumes a job a real worker should have handled.
 */
const path = require('path');
const API = path.join(__dirname, '..', '..', 'apps', 'api');
const { Queue, Worker } = require(path.join(API, 'node_modules', 'bullmq'));
const IORedis = require(path.join(API, 'node_modules', 'ioredis'));

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const QUEUE = `verify-${Date.now().toString(36)}`;
const results = [];

function check(name, passed, detail = '') {
  results.push({ name, passed: !!passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await sleep(100);
  }
  return false;
}

(async () => {
  // Probe on a short-lived client that fails fast, so a missing Redis produces
  // the actionable message below instead of ioredis retry noise.
  const probe = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  probe.on('error', () => {});
  try {
    await probe.connect();
    await probe.ping();
    await probe.quit();
  } catch (err) {
    probe.disconnect();
    console.error(`Cannot reach Redis at ${REDIS_URL}: ${err.message}`);
    console.error('Start it with: docker compose -f infra/staging/docker-compose.yml up -d');
    process.exit(2);
  }
  console.log(`Redis reachable at ${REDIS_URL}. Using throwaway queue "${QUEUE}".\n`);

  // The long-lived connection the queue and workers share, created only after
  // the probe above has confirmed Redis is actually reachable.
  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

  const queue = new Queue(QUEUE, {
    connection,
    defaultJobOptions: { removeOnComplete: true, removeOnFail: { count: 100 } },
  });

  // Mirrors the app's own worker settings: same retention, same dedupe contract.
  const executed = [];
  let failuresRequested = 0;
  const worker = new Worker(
    QUEUE,
    async (job) => {
      executed.push({ id: job.id, data: job.data, attempt: job.attemptsMade });
      if (job.data.mode === 'fail-twice' && job.attemptsMade < 2) {
        failuresRequested += 1;
        throw new Error('deliberate transient failure');
      }
      if (job.data.mode === 'always-fail') throw new Error('deliberate permanent failure');
      if (job.data.mode === 'slow') await sleep(400);
      return 'ok';
    },
    { connection, concurrency: 4 },
  );
  await worker.waitUntilReady();

  try {
    // ---- 1. enqueue + pickup + completion --------------------------------
    await queue.add('t', { mode: 'ok', n: 1 }, { jobId: 'j-basic' });
    check('1. enqueue -> worker pickup -> completion',
      await until(() => executed.some((e) => e.id === 'j-basic')),
      `${executed.length} job(s) executed`);

    // ---- 2. retry ---------------------------------------------------------
    executed.length = 0;
    await queue.add('t', { mode: 'fail-twice' }, { jobId: 'j-retry', attempts: 3, backoff: { type: 'fixed', delay: 100 } });
    const retried = await until(() => executed.filter((e) => e.id === 'j-retry').length >= 3, 20000);
    check('2. a failing job is retried up to its attempts limit',
      retried, `${executed.filter((e) => e.id === 'j-retry').length} execution(s), ${failuresRequested} transient failure(s)`);

    // ---- 3. failure is terminal and inspectable ---------------------------
    await queue.add('t', { mode: 'always-fail' }, { jobId: 'j-dead', attempts: 2, backoff: { type: 'fixed', delay: 100 } });
    const dead = await until(async () => {
      const job = await queue.getJob('j-dead');
      return job ? await job.isFailed() : false;
    }, 20000);
    check('3. an exhausted job lands in the failed set (diagnosable, not lost)', dead);

    // ---- 4. the dedupe contract ------------------------------------------
    // A second add with a live jobId must NOT create a second job.
    await queue.add('t', { mode: 'slow' }, { jobId: 'j-dupe' });
    await queue.add('t', { mode: 'slow' }, { jobId: 'j-dupe' });
    await queue.add('t', { mode: 'slow' }, { jobId: 'j-dupe' });
    await until(() => executed.filter((e) => e.id === 'j-dupe').length >= 1);
    await sleep(1200);
    check('4. duplicate jobIds collapse to a single execution',
      executed.filter((e) => e.id === 'j-dupe').length === 1,
      `${executed.filter((e) => e.id === 'j-dupe').length} execution(s) from 3 enqueues`);

    // ---- 5. THE TRAP enqueueDeduped exists for ----------------------------
    // A failed job keeps its id, so a plain re-add is silently ignored.
    const before = executed.filter((e) => e.id === 'j-dead').length;
    await queue.add('t', { mode: 'ok' }, { jobId: 'j-dead' });
    await sleep(800);
    const naiveBlocked = executed.filter((e) => e.id === 'j-dead').length === before;
    check('5. re-adding a FAILED jobId is silently ignored (the trap)', naiveBlocked,
      naiveBlocked ? 'confirmed — enqueueDeduped must clear it first' : 'BullMQ semantics differ from expected');

    const stale = await queue.getJob('j-dead');
    if (stale) await stale.remove();
    await queue.add('t', { mode: 'ok' }, { jobId: 'j-dead' });
    check('5b. clearing the failed job first makes the key re-enqueueable',
      await until(() => executed.filter((e) => e.id === 'j-dead').length > before));

    // ---- 6. concurrency ---------------------------------------------------
    executed.length = 0;
    const started = Date.now();
    await Promise.all([1, 2, 3, 4].map((n) => queue.add('t', { mode: 'slow', n }, { jobId: `j-conc-${n}` })));
    await until(() => executed.filter((e) => String(e.id).startsWith('j-conc-')).length === 4, 20000);
    const elapsed = Date.now() - started;
    check('6. concurrency > 1 — four 400ms jobs do not serialise',
      elapsed < 1400, `${elapsed}ms for 4x400ms jobs (serial would be >=1600ms)`);

    // ---- 7. persistence across a broker reconnect -------------------------
    await worker.close();
    const paused = new Queue(QUEUE, { connection });
    await paused.add('t', { mode: 'ok' }, { jobId: 'j-persist' });
    const second = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
    const revived = new Worker(QUEUE, async (job) => { executed.push({ id: job.id, data: job.data }); }, { connection: second });
    await revived.waitUntilReady();
    check('7. a job enqueued while no worker was running is picked up later',
      await until(() => executed.some((e) => e.id === 'j-persist'), 20000));
    await revived.close();
    await second.quit();
    await paused.close();

  } finally {
    await worker.close().catch(() => {});
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.close().catch(() => {});
    await connection.quit().catch(() => {});
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) failed.forEach((f) => console.log(`  FAILED: ${f.name}`));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
