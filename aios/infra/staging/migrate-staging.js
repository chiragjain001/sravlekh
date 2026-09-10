#!/usr/bin/env node
/* Applies Prisma migrations to the STAGING database, and proves the target
 * before touching it.
 *
 *   node infra/staging/migrate-staging.js
 *
 * This is the ONLY supported way to migrate staging. Do not run
 * `prisma migrate deploy` against staging by hand — see below for why the
 * obvious command is unsafe.
 *
 * WHY THIS EXISTS:
 *
 *   DATABASE_URL=postgresql://...localhost:5433/aios_staging prisma migrate deploy
 *
 * silently migrates the SHARED database. schema.prisma declares both
 * `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`, and Prisma
 * migrations use directUrl — which packages/db/.env points at Supabase. Process
 * env does win over .env (verified); the trap is the second variable, not
 * precedence, which is exactly what makes it silent.
 *
 * So this script does not trust intent. It asks Prisma which datasource it
 * ACTUALLY resolved, parses the answer, and refuses unless that is a nominated
 * staging host. The allowlist/blocklist rules live in staging-targets.js and are
 * the same ones the boot guard in apps/api/src/config/env.schema.ts applies, so
 * a host that cannot be migrated also cannot be served.
 */
const path = require('path');
const { execFileSync } = require('child_process');

const { loadStagingEnv, fail } = require('./staging-env');
const { checkPostgresTarget, hostPort, DEFAULT_PORTS, SHARED_DB_MARKERS } = require('./staging-targets');

const REPO = path.join(__dirname, '..', '..');
const DB_PKG = path.join(REPO, 'packages', 'db');

// Prisma's CLI entry, invoked directly with node.
//
// Not `pnpm exec prisma` and not shell:true. Passing args through a shell
// concatenates rather than escapes them, and these args carry values derived
// from a config file. Without a shell, Node 24 refuses to execute pnpm.cmd at
// all (EINVAL — hardening for CVE-2024-27980). Resolving the CLI and running it
// on process.execPath sidesteps both: no shell, no .cmd, and argv stays an array.
const PRISMA_CLI = require.resolve('prisma/build/index.js', { paths: [DB_PKG] });

function prisma(args, env) {
  return execFileSync(process.execPath, [PRISMA_CLI, ...args], {
    cwd: DB_PKG,
    env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const staging = loadStagingEnv({ required: ['DATABASE_URL', 'DIRECT_URL', 'STAGING_DB_ALLOWLIST'] });
const { DATABASE_URL, DIRECT_URL, STAGING_DB_ALLOWLIST } = staging;

// ── Guard the CONFIGURED values first, so an obviously-wrong file never
//    reaches Prisma at all. ──
for (const [name, url] of [
  ['DATABASE_URL', DATABASE_URL],
  ['DIRECT_URL', DIRECT_URL],
]) {
  const result = checkPostgresTarget(name, url, STAGING_DB_ALLOWLIST);
  if (!result.ok) fail(result.reason);
}

// The env Prisma will actually run with. Process env wins over packages/db/.env,
// and BOTH url variables are supplied so migrations cannot fall back to the
// shared instance through directUrl.
const childEnv = { ...process.env, DATABASE_URL, DIRECT_URL };

// ── The check that makes this provable: ask Prisma what it RESOLVED. ──
console.log('Asking Prisma which datasource it resolves...');
let status = '';
try {
  status = prisma(['migrate', 'status'], childEnv);
} catch (err) {
  // A pending-migrations exit code still prints the datasource line we need, so
  // a non-zero exit is expected here. A SPAWN failure is not — surface it rather
  // than letting it look like "Prisma reported no datasource", which would send
  // someone hunting a config problem that does not exist.
  if (err.code === 'ENOENT' || err.code === 'EINVAL') {
    fail(`could not run the Prisma CLI (${err.code}): ${String(err.message).split('\n')[0]}`);
  }
  status = `${err.stdout || ''}${err.stderr || ''}`;
}

const line = status.split('\n').find((l) => l.includes('Datasource'));
if (!line) fail('Prisma did not report a datasource — cannot confirm the target.');
console.log(`  ${line.trim()}`);

const reportedMarker = SHARED_DB_MARKERS.find((m) => line.toLowerCase().includes(m));
if (reportedMarker) {
  fail(`Prisma resolved a datasource containing "${reportedMarker}" — the SHARED database.\n  ${line.trim()}`);
}

const expected = hostPort(DIRECT_URL, DEFAULT_PORTS.postgres);
const [expectedHost, expectedPort] = expected.split(':');
if (!line.includes(expectedHost) || !line.includes(expectedPort)) {
  fail(
    `Prisma resolved a datasource that is not the nominated staging host.\n` +
      `  expected ${expected}\n  got      ${line.trim()}`,
  );
}
console.log(`  confirmed: ${expected} — proceeding.\n`);

console.log('Applying migrations...');
try {
  process.stdout.write(prisma(['migrate', 'deploy'], childEnv));
} catch (err) {
  process.stdout.write(`${err.stdout || ''}`);
  console.error(`${err.stderr || ''}`);
  process.exit(1);
}

console.log('\nRe-checking the target after apply...');
try {
  const after = prisma(['migrate', 'status'], childEnv);
  const afterLine = after.split('\n').find((l) => l.includes('Datasource'));
  console.log(`  ${afterLine ? afterLine.trim() : '(no datasource line)'}`);
  console.log(after.includes('up to date') ? '  schema is up to date.' : '  see status above.');
} catch (err) {
  process.stdout.write(`${err.stdout || ''}`);
}
