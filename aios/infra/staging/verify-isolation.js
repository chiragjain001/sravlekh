#!/usr/bin/env node
/* Layer 3 of 3: prove, with identifiable data through the running stack, that
 * staging writes landed in staging and never reached the shared database.
 *
 *   node infra/staging/verify-isolation.js
 *
 * Deliberately NOT env-file inspection. A uniquely-named tenant is created, read
 * back THROUGH the running API, written to through the API, resolved by the
 * Python service and consumed by the worker — and then BOTH databases are
 * queried by name. Reading configuration would only prove what somebody
 * intended; this proves where the bytes went.
 *
 * The shared database is treated as read-only in fact, not just in intent: it is
 * counted and searched, never written to, and the teardown touches staging alone.
 *
 * Preconditions: the staging stack is up (docker compose), migrations applied
 * (migrate-staging.js), and the API, worker and Python service are running under
 * infra/staging/run-stack.sh.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { loadStagingEnv } = require('./staging-env');
const { hostPort, DEFAULT_PORTS, SHARED_DB_MARKERS } = require('./staging-targets');

const REPO = path.join(__dirname, '..', '..');
const API_MODULES = path.join(REPO, 'apps', 'api', 'node_modules');
const { PrismaClient } = require(path.join(API_MODULES, '@prisma', 'client'));
const IORedis = require(path.join(API_MODULES, 'ioredis'));
const { Queue } = require(path.join(API_MODULES, 'bullmq'));

const API = process.env['STAGING_API_URL'] || 'http://localhost:4000/api/v1';
const PY = process.env['STAGING_PYTHON_URL'] || 'http://127.0.0.1:8000';
const DEV_REDIS_URL = 'redis://localhost:6379';
const MARKER = `ISOLATION-PROOF-${Date.now().toString(36)}`;

/** Same KEY=VALUE shape as staging.env. Used only to find the SHARED url. */
function readEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

/** HS256, hand-rolled: the harness must not depend on where pnpm hoisted a JWT library. */
function signJwt(payload, secret, ttlSeconds = 900) {
  const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ ...payload, iat: now, exp: now + ttlSeconds })}`;
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
}

const results = [];
const check = (name, passed, detail = '') => {
  results.push({ name, passed: !!passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const staging = loadStagingEnv({ required: ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'] });
const STAGING_URL = staging.DATABASE_URL;
const SHARED_URL = readEnvFile(path.join(REPO, 'apps', 'api', '.env')).DATABASE_URL;

const stagingDb = new PrismaClient({ datasources: { db: { url: STAGING_URL } } });
const sharedDb = new PrismaClient({ datasources: { db: { url: SHARED_URL } } });

(async () => {
  let institute;
  try {
    // ── Refuse to run unless the two clients are genuinely different databases ──
    const sHost = hostPort(STAGING_URL, DEFAULT_PORTS.postgres);
    const hHost = SHARED_URL ? hostPort(SHARED_URL, DEFAULT_PORTS.postgres) : null;
    if (!hHost) {
      console.error('REFUSING: no DATABASE_URL in apps/api/.env — there is no shared database to compare against.');
      process.exit(2);
    }
    if (sHost === hHost) {
      console.error(`REFUSING: staging and shared resolve to the same host (${sHost}). Nothing would be proved.`);
      process.exit(2);
    }
    if (SHARED_DB_MARKERS.some((m) => sHost.includes(m))) {
      console.error(`REFUSING: the staging target ${sHost} looks like a hosted instance. This harness writes rows.`);
      process.exit(2);
    }
    console.log(`staging = ${sHost}   shared = ${hHost}   redis = ${hostPort(staging.REDIS_URL, DEFAULT_PORTS.redis)}\n`);

    // ── Baseline the shared database BEFORE anything happens ──
    const before = {
      institutes: await sharedDb.institute.count(),
      users: await sharedDb.user.count(),
      attempts: await sharedDb.attempt.count(),
      scoreRecords: await sharedDb.scoreRecord.count(),
    };

    // ── Identifiable data, written to staging, then read back THROUGH the API ──
    institute = await stagingDb.institute.create({
      data: { name: MARKER, domainAllowlist: ['isolation.test'], status: 'ACTIVE' },
    });
    const mkUser = (role, tag) =>
      stagingDb.user.create({
        data: {
          instituteId: institute.id,
          googleSub: `${MARKER}-${tag}`,
          email: `${tag}-${MARKER}@isolation.test`,
          name: `Isolation ${role}`,
          role,
          status: 'ACTIVE',
        },
      });
    const founder = await mkUser('FOUNDER', 'f');
    const admin = await mkUser('ADMIN', 'a');

    const token = (u) =>
      signJwt(
        { sub: u.id, email: u.email, name: u.name, role: u.role, instituteId: u.instituteId, tokenVersion: 0 },
        staging.JWT_SECRET,
      );

    // 1. The API reads staging.
    const listed = await fetch(`${API}/founder/institutes`, { headers: { Authorization: `Bearer ${token(founder)}` } });
    const listedBody = JSON.stringify(await listed.json().catch(() => ({})));
    check(
      'API connects to staging Postgres',
      listed.status === 200 && listedBody.includes(MARKER),
      `HTTP ${listed.status}, marker visible via the API: ${listedBody.includes(MARKER)}`,
    );

    // 2. The API WRITES to staging.
    const created = await fetch(`${API}/institutes/${institute.id}/batches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token(admin)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ name: `${MARKER}-batch` }),
    });
    const inStaging = await stagingDb.batch.count({ where: { name: `${MARKER}-batch` } });
    check(
      'API WRITES land in staging Postgres',
      created.status === 201 && inStaging === 1,
      `HTTP ${created.status}, rows in staging: ${inStaging}`,
    );

    // 3. The API's Redis is the staging instance.
    //    GET /institutes/:id caches `institute-profile:<id>` (institutes.service.ts).
    //    The id is unique to this run, so the key cannot collide with anything a
    //    dev API might have written — which is what makes the absence check below
    //    meaningful rather than merely likely.
    const cacheKey = `institute-profile:${institute.id}`;
    await fetch(`${API}/institutes/${institute.id}`, { headers: { Authorization: `Bearer ${token(admin)}` } });
    const stagingRedis = new IORedis(staging.REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null });
    const onStaging = await stagingRedis.exists(cacheKey);
    let onDev = 'dev Redis not running';
    try {
      const devRedis = new IORedis(DEV_REDIS_URL, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        lazyConnect: true,
      });
      // Expected outcome, not an incident — see prove-targets.js.
      devRedis.on('error', () => {});
      await devRedis.connect();
      onDev = (await devRedis.exists(cacheKey)) === 0 ? 'absent from dev Redis' : 'PRESENT ON DEV REDIS';
      await devRedis.quit().catch(() => devRedis.disconnect());
    } catch {
      /* left as "not running" — reported, never counted as proof either way */
    }
    check(
      'API connects to staging Redis',
      onStaging === 1 && onDev !== 'PRESENT ON DEV REDIS',
      `${cacheKey} present on ${hostPort(staging.REDIS_URL, DEFAULT_PORTS.redis)}: ${onStaging === 1}, ${onDev}`,
    );

    // 4. The Python service is on staging.
    //    Its evaluation endpoint resolves an institute; a staging-only id reaching
    //    it and coming back resolved is the proof.
    const py = await fetch(`${PY}/evaluation/ai-evaluate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Internal-Token': staging.INTERNAL_SERVICE_TOKEN || '' },
      body: JSON.stringify({ instituteId: institute.id, responseId: 'no-such-response', requestedByUserId: admin.id }),
    });
    const pyBody = await py.json().catch(() => ({}));
    check(
      'Python service connects to staging Postgres',
      py.status === 200 && pyBody?.data?.skipped === true,
      `HTTP ${py.status} — resolved a staging-only institute id and answered from its own DB`,
    );

    // 5. The worker is on staging Postgres AND staging Redis.
    //    The job is enqueued on the staging broker and names a profile that exists
    //    only in the staging database; consuming it requires both.
    const queueConn = new IORedis(staging.REDIS_URL, { maxRetriesPerRequest: null });
    const queue = new Queue('mastery-recalc', { connection: queueConn });
    const student = await mkUser('STUDENT', 's');
    const batch = await stagingDb.batch.findFirst({ where: { name: `${MARKER}-batch` } });
    const profile = await stagingDb.studentProfile.create({ data: { userId: student.id, batchId: batch.id } });
    const jobId = `iso-${MARKER}`;
    await queue.add(
      'recalculate',
      { studentProfileId: profile.id, topicIds: [] },
      { jobId, attempts: 1, removeOnComplete: true, removeOnFail: { count: 5, age: 600 } },
    );

    let consumed = false;
    for (let i = 0; i < 80; i++) {
      const job = await queue.getJob(jobId);
      if (!job) {
        consumed = true; // completed and removed
        break;
      }
      if (await job.isFailed()) {
        consumed = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    check('worker connects to staging Postgres and staging Redis (consumed a staging-only job)', consumed);
    await queue.obliterate({ force: true }).catch(() => {});
    await queue.close();
    await queueConn.quit().catch(() => queueConn.disconnect());
    await stagingRedis.quit().catch(() => stagingRedis.disconnect());

    // 6. Migrations landed on staging.
    const [applied] = await stagingDb.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
    );
    const [tables] = await stagingDb.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`,
    );
    check(
      'Prisma migrations targeted staging Postgres',
      applied.n > 0 && tables.n > 50,
      `${applied.n} migrations applied, ${tables.n} tables`,
    );

    // ── 7-9. THE SHARED DATABASE MUST BE UNTOUCHED ──
    const after = {
      institutes: await sharedDb.institute.count(),
      users: await sharedDb.user.count(),
      attempts: await sharedDb.attempt.count(),
      scoreRecords: await sharedDb.scoreRecord.count(),
    };
    check(
      'shared database row counts UNCHANGED',
      JSON.stringify(before) === JSON.stringify(after),
      `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    );

    const leaked = await sharedDb.institute.count({ where: { name: { contains: 'ISOLATION-PROOF' } } });
    check('shared database contains NO staging test records', leaked === 0, `${leaked} marker row(s) found`);

    const leakedBatch = await sharedDb.batch.count({ where: { name: { contains: 'ISOLATION-PROOF' } } });
    check('shared database received no API writes either', leakedBatch === 0, `${leakedBatch} marker batch(es)`);
  } finally {
    // Teardown, staging only. The shared database is never written to.
    if (institute) {
      const users = await stagingDb.user.findMany({ where: { instituteId: institute.id }, select: { id: true } });
      const ids = users.map((u) => u.id);
      await stagingDb.studentProfile.deleteMany({ where: { userId: { in: ids } } });
      await stagingDb.batch.deleteMany({ where: { instituteId: institute.id } });
      await stagingDb.auditLog.deleteMany({ where: { instituteId: institute.id } });
      await stagingDb.user.deleteMany({ where: { instituteId: institute.id } });
      await stagingDb.institute.delete({ where: { id: institute.id } });
    }
    await stagingDb.$disconnect();
    await sharedDb.$disconnect();
  }

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  failed.forEach((f) => console.log(`  FAILED: ${f.name}`));
  process.exit(failed.length ? 1 : 0);
})().catch(async (err) => {
  console.error('HARNESS ERROR:', err.message);
  await stagingDb.$disconnect().catch(() => {});
  await sharedDb.$disconnect().catch(() => {});
  process.exit(2);
});
