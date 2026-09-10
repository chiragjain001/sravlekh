#!/usr/bin/env node
/* Layer 1 of 3: prove the staging targets BEFORE anything starts.
 *
 *   node infra/staging/prove-targets.js
 *
 * The three layers, and what each one is actually good for:
 *
 *   1. THIS SCRIPT — the nominated targets pass the guards, are live, and are
 *      the database and Redis they claim to be. Runs before any process starts,
 *      so a wrong target is caught before it can be written to.
 *   2. BOOT GUARD (apps/api/src/config/env.schema.ts, apps/api-python/src/config.py)
 *      — the RESOLVED config of each running process is a nominated target. This
 *      script checks the file; the boot guard checks what the process ended up
 *      with, which is the part that actually matters.
 *   3. verify-isolation.js — after the run, identifiable marker data proves the
 *      writes landed in staging and never reached the shared database.
 *
 * This script deliberately does NOT claim "staging is not the shared database".
 * It cannot: connecting to one database tells you nothing about another. That
 * claim belongs to layer 3, which queries both. What this proves is narrower and
 * still worth having — the targets are safe, reachable, and correctly named.
 *
 * The one exception is Redis, where distinctness IS cheaply provable: a marker
 * written to the staging instance must be absent from the dev instance.
 */
const path = require('path');

const { loadStagingEnv } = require('./staging-env');
const { checkPostgresTarget, checkRedisTarget, hostPort, DEFAULT_PORTS } = require('./staging-targets');

const API_MODULES = path.join(__dirname, '..', '..', 'apps', 'api', 'node_modules');
const { PrismaClient } = require(path.join(API_MODULES, '@prisma', 'client'));
const IORedis = require(path.join(API_MODULES, 'ioredis'));

const DEV_REDIS_URL = 'redis://localhost:6379'; // the default REDIS_URL falls back to

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed: !!passed });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}
function note(text) {
  console.log(`      note: ${text}`);
}

/** Database name from a Postgres URL. Never logs credentials. */
function dbName(url) {
  try {
    return new URL(url).pathname.replace(/^\//, '') || null;
  } catch {
    return null;
  }
}

(async () => {
  const env = loadStagingEnv({
    required: ['AIOS_ENV', 'DATABASE_URL', 'DIRECT_URL', 'REDIS_URL', 'STAGING_DB_ALLOWLIST', 'STAGING_REDIS_ALLOWLIST'],
  });

  console.log('Proving staging targets from infra/staging/staging.env\n');

  // ── Static guards — the same rules the boot guard and migrator apply ──
  check('AIOS_ENV is exactly "staging"', env.AIOS_ENV === 'staging', `AIOS_ENV=${env.AIOS_ENV}`);

  const statics = [
    ['DATABASE_URL', checkPostgresTarget('DATABASE_URL', env.DATABASE_URL, env.STAGING_DB_ALLOWLIST)],
    ['DIRECT_URL', checkPostgresTarget('DIRECT_URL', env.DIRECT_URL, env.STAGING_DB_ALLOWLIST)],
    ['REDIS_URL', checkRedisTarget('REDIS_URL', env.REDIS_URL, env.STAGING_REDIS_ALLOWLIST)],
  ];
  for (const [name, result] of statics) {
    check(`${name} is a nominated staging target`, result.ok, result.ok ? result.target : result.reason);
  }
  if (statics.some(([, r]) => !r.ok)) {
    console.log('\nStatic guards failed — not attempting any connection.');
    process.exit(2);
  }

  // ── Postgres: live, and the database it claims to be ──
  const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
  try {
    const [row] = await prisma.$queryRawUnsafe(
      `SELECT current_database()::text AS db,
              current_setting('server_version') AS version,
              (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public') AS tables`,
    );
    const expectedDb = dbName(env.DATABASE_URL);
    check(
      'staging Postgres is live and is the database it was told to be',
      row.db === expectedDb,
      `connected to "${row.db}" at ${hostPort(env.DATABASE_URL, DEFAULT_PORTS.postgres)}, expected "${expectedDb}" — ` +
        `server ${row.version}, ${row.tables} public tables`,
    );
    if (row.tables === 0) {
      note('0 tables — run `node infra/staging/migrate-staging.js` before using this database.');
    }
  } catch (err) {
    // err.message from Prisma can embed the connection string; report the target
    // we already parsed instead of whatever the driver decided to print.
    check(
      'staging Postgres is live and is the database it was told to be',
      false,
      `could not connect to ${hostPort(env.DATABASE_URL, DEFAULT_PORTS.postgres)} — is the compose stack up? ` +
        '(docker compose -f infra/staging/docker-compose.yml up -d)',
    );
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  // ── Redis: live, and a DIFFERENT instance from the dev default ──
  const marker = `aios:staging-proof:${Date.now().toString(36)}`;
  const stagingTarget = hostPort(env.REDIS_URL, DEFAULT_PORTS.redis);
  const redis = new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    lazyConnect: true,
  });
  let redisLive = false;
  try {
    await redis.connect();
    await redis.set(marker, '1', 'EX', 60);
    redisLive = (await redis.get(marker)) === '1';
    const size = await redis.dbsize();
    check('staging Redis is live and writable', redisLive, `${stagingTarget}, dbsize=${size}`);
  } catch (err) {
    check('staging Redis is live and writable', false, `could not connect to ${stagingTarget} — is the compose stack up?`);
  }

  if (redisLive && stagingTarget !== hostPort(DEV_REDIS_URL, DEFAULT_PORTS.redis)) {
    // Distinctness, proved rather than assumed: the marker just written to
    // staging must not be visible on the instance the default would have used.
    const dev = new IORedis(DEV_REDIS_URL, { maxRetriesPerRequest: 1, retryStrategy: () => null, lazyConnect: true });
    // A refused connection is an expected outcome here, not an incident: ioredis
    // prints "Unhandled error event" to stderr without a listener, which would
    // read as a failure in a script whose entire job is to be unambiguous.
    dev.on('error', () => {});
    try {
      await dev.connect();
      const leaked = await dev.get(marker);
      check(
        'staging Redis is a different instance from the dev default',
        leaked === null,
        `marker written to ${stagingTarget} is ${leaked === null ? 'absent from' : 'PRESENT ON'} ${hostPort(DEV_REDIS_URL, DEFAULT_PORTS.redis)}`,
      );
    } catch {
      note(
        `dev Redis at ${hostPort(DEV_REDIS_URL, DEFAULT_PORTS.redis)} is not running, so distinctness could not be ` +
          'demonstrated live. Not counted as a pass — nothing was proved either way.',
      );
    } finally {
      await dev.quit().catch(() => dev.disconnect());
    }
  }

  await redis.del(marker).catch(() => {});
  await redis.quit().catch(() => redis.disconnect());

  const failed = results.filter((r) => !r.passed);
  console.log(`\n${results.length - failed.length}/${results.length} target checks passed`);
  failed.forEach((f) => console.log(`  FAILED: ${f.name}`));
  process.exit(failed.length ? 2 : 0);
})().catch((err) => {
  console.error(`\nHARNESS ERROR: ${err.message}`);
  process.exit(3);
});
