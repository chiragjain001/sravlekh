/* REAL-REDIS REGRESSION — a dead-lettered job must carry a useful failedReason.
 *
 *   docker compose -f infra/staging/docker-compose.yml up -d
 *   node infra/staging/verify-dead-letter.js
 *
 * Causes a CONTROLLED, REALISTIC worker failure — the worker is started with
 * PYTHON_SERVICE_URL pointing at a closed port, so mastery-recalc gets a refused
 * connection — and asserts on what Redis actually stores. The failure is caused
 * by the test, never by whether some other service happens to be running.
 *
 * The defect this guards: `localhost` resolves to both ::1 and 127.0.0.1, so a
 * refusal arrives as an AggregateError whose `.message` is "" by design. BullMQ
 * stores `err.message` verbatim, so `failedReason` was an EMPTY STRING on
 * exactly the failures it exists to explain. Proven before the fix with
 * HEXISTS=1 / HSTRLEN=0 — the field was present and genuinely blank.
 *
 * Asserts on the RAW Redis value, not the parsed Job object, so a future change
 * that only makes the JS getter look right cannot pass this.
 */
const path = require('path');
const { spawn, execSync } = require('child_process');
const API = path.join(__dirname, '..', '..', 'apps', 'api');
const IORedis = require(path.join(API, 'node_modules', 'ioredis'));
const { Queue } = require(path.join(API, 'node_modules', 'bullmq'));

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const JOB_ID = `dl-regression-${Date.now().toString(36)}`;
const KEY = `bull:mastery-recalc:${JOB_ID}`;
const results = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, passed, detail = '') {
  results.push({ name, passed: !!passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function killTree(p) {
  if (!p) return;
  try {
    if (process.platform === 'win32') execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: 'ignore' });
    else p.kill('SIGKILL');
  } catch { /* already gone */ }
}

(async () => {
  const probe = new IORedis(REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null, lazyConnect: true });
  probe.on('error', () => {});
  try { await probe.connect(); await probe.ping(); await probe.quit(); }
  catch (err) {
    probe.disconnect();
    console.error(`Cannot reach Redis at ${REDIS_URL}: ${err.message}`);
    console.error('Start it with: docker compose -f infra/staging/docker-compose.yml up -d');
    process.exit(2);
  }

  const conn = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
  const queue = new Queue('mastery-recalc', { connection: conn });
  let worker;

  try {
    worker = spawn('node', ['dist/worker.js'], {
      cwd: API,
      // Point THIS worker at a closed port so the failure is deterministic.
      // The test previously relied on the Python service happening to be down,
      // so it started passing/failing depending on what else was running — the
      // failure it asserts on must be caused by the test, not by the weather.
      // A refused connection is still the real production scenario, and still
      // goes through the real axios -> rethrow -> BullMQ path.
      env: { ...process.env, REDIS_URL, RUN_WORKERS: 'true', PYTHON_SERVICE_URL: 'http://localhost:9', },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    worker.stdout.on('data', (d) => { log += d.toString(); });
    worker.stderr.on('data', (d) => { log += d.toString(); });
    for (let i = 0; i < 160 && !log.includes('AIOS worker started'); i++) await sleep(500);
    check('worker process is consuming', log.includes('AIOS worker started'));

    // Two attempts so retry behaviour is exercised as well as the final failure.
    await queue.add(
      'recalculate',
      { studentProfileId: 'sp-dl-regression', topicIds: ['topic-1'] },
      { jobId: JOB_ID, attempts: 2, backoff: { type: 'fixed', delay: 300 },
        removeOnComplete: true, removeOnFail: { count: 50, age: 3600 } },
    );

    let job = null;
    for (let i = 0; i < 160; i++) {
      job = await queue.getJob(JOB_ID);
      if (job && (await job.isFailed())) break;
      await sleep(500);
    }
    check('the job reaches a terminal failed state', !!job && (await job.isFailed()));

    // ---- THE REGRESSION ----
    const rawLen = await conn.hstrlen(KEY, 'failedReason');
    const raw = await conn.hget(KEY, 'failedReason');
    check('failedReason is stored NON-EMPTY in Redis',
      rawLen > 0, `HSTRLEN=${rawLen} (was 0 before the fix)`);
    check('failedReason names the actual failure, not a placeholder',
      typeof raw === 'string' && /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/.test(raw),
      raw ? raw.slice(0, 110) : 'null');
    check('failedReason identifies WHICH dependency was unreachable',
      typeof raw === 'string' && (raw.includes('localhost:9') || raw.includes(':9/')),
      'the unreachable dependency URL appears in the reason');

    // ---- unchanged behaviour ----
    check('retry policy unchanged — both attempts were made',
      job?.attemptsMade === 2, `attemptsMade=${job?.attemptsMade}`);
    check('retention unchanged — the failed job is still inspectable',
      (await conn.exists(KEY)) === 1);
    check('jobId semantics unchanged — the dedupe key is intact',
      job?.id === JOB_ID, `id=${job?.id}`);
    check('the original stack is preserved (exception not replaced)',
      Array.isArray(job?.stacktrace) && job.stacktrace.length > 0 && /Axios|Aggregate|axios/i.test(String(job.stacktrace[0])),
      'stack still points at the axios call');

    // ---- structured logging still carries context, now with a reason ----
    const clean = log.replace(/\x1b\[[0-9;]*m/g, '');
    check('reportDeadLetter still logs its structured context',
      /exhausted all retries/.test(clean) && /studentProfileId/.test(clean));
    check('the retry log line is no longer blank after "will retry:"',
      /will retry: \S/.test(clean),
      (clean.split('\n').find((l) => l.includes('will retry:')) || '').trim().slice(0, 120));

  } finally {
    killTree(worker);
    await sleep(1000);
    const j = await queue.getJob(JOB_ID);
    if (j) await j.remove().catch(() => {});
    await queue.close().catch(() => {});
    await conn.quit().catch(() => {});
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  failed.forEach((f) => console.log(`  FAILED: ${f.name}`));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
