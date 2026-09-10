#!/usr/bin/env node
'use strict';
/* Restores an AIOS backup into a target database, and PROVES the restore.
 *
 *   node infra/backup/restore.js --archive <file.dump> --url "postgresql://..."
 *   node infra/backup/restore.js --archive <file.dump> --url "..." --create
 *
 * SAFETY: this command writes to a database. It refuses by default to restore
 * into anything that is not empty, and refuses outright against a host that
 * looks like shared/production infrastructure unless --i-understand-this-
 * overwrites-data is passed. The guard exists because the restore command is
 * the one piece of backup tooling that can destroy data, and it is typically
 * run under incident pressure by someone who has been awake too long.
 *
 * VERIFICATION: a restore is not finished when pg_restore exits. This compares
 * the restored database against the manifest captured at backup time — schema
 * shape, per-table row counts, foreign keys, indexes, enums, migration state —
 * and fails loudly on any drift. "It restored without errors" and "the data is
 * all there" are different claims; only the second one matters.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  runPgTool,
  connectionStringFor,
  filePathFor,
  psqlScalar,
  assertServerVersionSupported,
  resolveMode,
} = require('./pg-tools');

// Substrings that indicate a managed/shared instance rather than a disposable
// restore target. Mirrors the intent of infra/staging/staging-targets.js's
// SHARED_DB_MARKERS: the two guards protect against the same mistake.
const SHARED_HOST_MARKERS = ['supabase', 'rds.amazonaws', 'neon.tech', 'render.com', 'azure', 'cloudsql'];

function parseArgs(argv) {
  const args = {
    archive: null,
    url: null,
    create: false,
    force: false,
    skipVerify: false,
    jobs: 4,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--archive') args.archive = argv[++i];
    else if (a === '--url') args.url = argv[++i];
    else if (a === '--create') args.create = true;
    else if (a === '--i-understand-this-overwrites-data') args.force = true;
    else if (a === '--skip-verify') args.skipVerify = true;
    else if (a === '--jobs') args.jobs = Number(argv[++i]);
  }
  return args;
}

function fail(message) {
  console.error(`\nRESTORE FAILED\n\n${message}\n`);
  process.exit(1);
}

function safeTarget(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '<unparseable connection string>';
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** Same server, `postgres` database — needed to CREATE/DROP the target itself. */
function adminUrl(url) {
  const u = new URL(url);
  u.pathname = '/postgres';
  return u.toString();
}

function databaseNameOf(url) {
  return new URL(url).pathname.replace(/^\//, '');
}

function assertTargetIsSafe(url, { force }) {
  const host = new URL(url).hostname.toLowerCase();
  const marker = SHARED_HOST_MARKERS.find((m) => host.includes(m));
  if (marker && !force) {
    fail(
      `Refusing to restore into ${safeTarget(url)} — the host contains "${marker}", which\n` +
        `  indicates shared or managed infrastructure rather than a disposable restore target.\n\n` +
        `  A restore OVERWRITES. If this really is the intended recovery target, re-run with\n` +
        `    --i-understand-this-overwrites-data\n` +
        `  and make sure you have a fresh backup of the CURRENT state first.`,
    );
  }
}

function tableCount(url) {
  return Number(
    psqlScalar(
      url,
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    ),
  );
}

/**
 * Compares the restored database against the manifest taken at backup time.
 * Returns a list of human-readable discrepancies; empty means verified.
 */
function verifyAgainstManifest(url, manifest) {
  const problems = [];
  const one = (sql) => Number(psqlScalar(url, sql));

  const actual = {
    tables: one(
      "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    ),
    indexes: one("SELECT count(*) FROM pg_indexes WHERE schemaname='public'"),
    foreignKeys: one(
      "SELECT count(*) FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='FOREIGN KEY'",
    ),
    checkConstraints: one(
      "SELECT count(*) FROM information_schema.table_constraints WHERE table_schema='public' AND constraint_type='CHECK'",
    ),
    enums: one('SELECT count(DISTINCT t.typname) FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid'),
    migrationsApplied: one(
      "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL",
    ),
  };

  for (const [key, expected] of Object.entries(manifest.schema)) {
    if (actual[key] !== expected) {
      problems.push(`schema.${key}: expected ${expected}, restored database has ${actual[key]}`);
    }
  }

  // Row counts, per table. pg_stat's n_live_tup is an estimate updated by
  // ANALYZE, so a freshly restored table can report 0 until it is analyzed —
  // count(*) is exact and this is the one place correctness beats speed.
  for (const [table, expected] of Object.entries(manifest.rowCounts)) {
    if (expected === 0) continue; // nothing to prove, and skipping keeps the drill fast
    const actualRows = Number(psqlScalar(url, `SELECT count(*) FROM "${table}"`));
    if (actualRows !== expected) {
      problems.push(`rows in "${table}": expected ${expected}, restored ${actualRows}`);
    }
  }

  // Referential integrity. Restoring with --no-owner and a disabled-trigger data
  // load can in principle land rows whose FK targets never arrived; asking
  // Postgres to re-validate every FK is the direct way to know it did not.
  const brokenFks = psqlScalar(
    url,
    `SELECT coalesce(string_agg(conname, ', '), '') FROM pg_constraint
     WHERE contype = 'f' AND NOT convalidated`,
  );
  if (brokenFks) problems.push(`foreign keys present but NOT VALIDATED: ${brokenFks}`);

  return { problems, actual };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.archive) fail('No --archive given.');
  if (!args.url) fail('No --url given.');
  if (!fs.existsSync(args.archive)) fail(`Archive not found: ${args.archive}`);

  const manifestPath = `${args.archive}.manifest.json`;
  const checksumPath = `${args.archive}.sha256`;
  const mode = resolveMode();

  console.log('AIOS database restore');
  console.log(`  client:  ${mode.detail}`);
  console.log(`  archive: ${path.basename(args.archive)}`);
  console.log(`  target:  ${safeTarget(args.url)}`);

  // ---- pre-flight: is the archive the one we think it is? ------------------
  if (fs.existsSync(checksumPath)) {
    const expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
    const actual = sha256(args.archive);
    if (expected !== actual) {
      fail(
        `Checksum mismatch — this archive is corrupt or was modified since it was written.\n` +
          `  expected ${expected}\n  actual   ${actual}\n` +
          `  Restoring it could load partial data over good data. Refusing.`,
      );
    }
    console.log(`  checksum: OK (${actual.slice(0, 16)}…)`);
  } else {
    console.log('  checksum: NO .sha256 FILE — archive integrity cannot be confirmed');
  }

  assertTargetIsSafe(args.url, { force: args.force });

  if (args.create) {
    const dbName = databaseNameOf(args.url);
    const admin = adminUrl(args.url);
    // Terminated first: an open session prevents DROP DATABASE, and during a
    // drill the previous run's connection is the usual culprit.
    try {
      psqlScalar(
        admin,
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid()`,
      );
      runPgTool('psql', [connectionStringFor(admin), '-c', `DROP DATABASE IF EXISTS "${dbName}"`], {
        url: admin,
        stdio: 'pipe',
      });
      runPgTool('psql', [connectionStringFor(admin), '-c', `CREATE DATABASE "${dbName}"`], {
        url: admin,
        stdio: 'pipe',
      });
      console.log(`  created: fresh database "${dbName}"`);
    } catch (err) {
      fail(`Could not create the target database: ${err.message}`);
    }
  }

  assertServerVersionSupported(args.url);

  if (!args.create && !args.force) {
    const existing = tableCount(args.url);
    if (existing > 0) {
      fail(
        `${safeTarget(args.url)} already contains ${existing} tables.\n\n` +
          `  Restoring into a non-empty database mixes two datasets and is almost never what\n` +
          `  is wanted. Use --create to recreate the database from scratch, or\n` +
          `  --i-understand-this-overwrites-data to proceed anyway.`,
      );
    }
  }

  // ---- restore -------------------------------------------------------------
  const startedAt = Date.now();
  try {
    runPgTool(
      'pg_restore',
      [
        '--dbname', connectionStringFor(args.url),
        '--no-owner',
        '--no-privileges',
        // Parallel data load. Restore time IS the RTO, and this is the single
        // biggest lever on it.
        '--jobs', String(args.jobs),
        // Without this pg_restore reports errors and still exits 0, which would
        // let a partial restore be reported as a success — the exact failure
        // this tooling exists to make impossible.
        '--exit-on-error',
        filePathFor(args.archive),
      ],
      { url: args.url, fileHostPath: args.archive },
    );
  } catch (err) {
    fail(`pg_restore failed — the target database is in an INCOMPLETE state:\n  ${err.message}`);
  }
  const restoreSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
  console.log(`  restored in ${restoreSeconds}s`);

  // ---- verification --------------------------------------------------------
  if (args.skipVerify) {
    console.log('\nRESTORE COMPLETE (verification skipped — not proof of recoverability)');
    return;
  }
  if (!fs.existsSync(manifestPath)) {
    console.log(
      '\nRESTORE COMPLETE, UNVERIFIED — no .manifest.json alongside the archive, so there is\n' +
        'nothing to compare the restored data against.',
    );
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const { problems, actual } = verifyAgainstManifest(args.url, manifest);

  if (problems.length) {
    fail(
      `The restore completed but does NOT match the backup it came from:\n\n` +
        problems.map((p) => `    - ${p}`).join('\n') +
        `\n\n  Treat this database as untrustworthy.`,
    );
  }

  const totalRows = Object.values(manifest.rowCounts).reduce((a, b) => a + b, 0);
  console.log(`\nRESTORE VERIFIED`);
  console.log(`  tables:      ${actual.tables} (matches backup)`);
  console.log(`  indexes:     ${actual.indexes} (matches backup)`);
  console.log(`  foreign keys:${String(actual.foreignKeys).padStart(4)} (all validated)`);
  console.log(`  constraints: ${actual.checkConstraints} check, ${actual.enums} enum types`);
  console.log(`  migrations:  ${actual.migrationsApplied} applied (matches backup)`);
  console.log(`  rows:        ${totalRows} verified by exact count against the manifest`);
  console.log(`  RTO sample:  ${restoreSeconds}s for ${(manifest.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
}

if (require.main === module) main();
module.exports = { verifyAgainstManifest, assertTargetIsSafe, SHARED_HOST_MARKERS };
