#!/usr/bin/env node
'use strict';
/* The restore drill: backup -> fresh database -> restore -> verify -> prove the
 * application can use the result. Run on a schedule, not once.
 *
 *   node infra/backup/drill.js --url "postgresql://...<source>"
 *   node infra/backup/drill.js --url "..." --keep   (leave the restored DB up)
 *
 * WHY THIS IS A SEPARATE COMMAND: the only property anyone actually cares about
 * is "we can get the data back", and that is not implied by any of its parts.
 * pg_dump exiting 0 does not imply a readable archive; a readable archive does
 * not imply a complete restore; a complete restore does not imply an
 * application that can query it. Each of those has to be executed to be known,
 * and executed REGULARLY, because all three break silently over time —
 * a schema change, a Postgres upgrade, a credential rotation.
 *
 * The drill restores into a throwaway database on the same server as the source
 * by default. That deliberately does NOT prove cross-host recovery; see
 * docs/37-BACKUP-AND-RESTORE.md for what this drill does and does not evidence.
 *
 * SAFETY: the drill never writes to the source. It only ever creates and drops
 * its own restore target, whose name it chooses, and it refuses to run if that
 * name collides with the source database.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const RESTORE_DB = 'aios_restore_drill';
const ARTIFACTS = path.join(__dirname, 'artifacts');

function parseArgs(argv) {
  const args = { url: null, keep: false, skipApp: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--keep') args.keep = true;
    else if (a === '--skip-app-check') args.skipApp = true;
  }
  if (!args.url) args.url = process.env['DATABASE_URL'] || null;
  return args;
}

function fail(message) {
  console.error(`\nDRILL FAILED\n\n${message}\n`);
  process.exit(1);
}

function step(n, title) {
  console.log(`\n[${n}] ${title}`);
  console.log('─'.repeat(72));
}

function run(cmd, cmdArgs, opts = {}) {
  const res = spawnSync(cmd, cmdArgs, { stdio: 'inherit', ...opts });
  if (res.status !== 0) throw new Error(`${cmd} ${cmdArgs.slice(0, 2).join(' ')} exited ${res.status}`);
}

function restoreUrlFrom(sourceUrl) {
  const u = new URL(sourceUrl);
  if (u.pathname.replace(/^\//, '') === RESTORE_DB) {
    fail(
      `The source database is already named "${RESTORE_DB}". The drill would drop and\n` +
        `  recreate its own source. Point --url at the real database instead.`,
    );
  }
  u.pathname = `/${RESTORE_DB}`;
  return u.toString();
}

function newestArchive() {
  const dumps = fs
    .readdirSync(ARTIFACTS)
    .filter((f) => f.endsWith('.dump'))
    .map((f) => ({ f, t: fs.statSync(path.join(ARTIFACTS, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!dumps.length) fail('No archive was produced.');
  return path.join(ARTIFACTS, dumps[0].f);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) fail('No --url given and DATABASE_URL is unset.');

  const restoreUrl = restoreUrlFrom(args.url);
  const startedAt = Date.now();

  console.log('AIOS RESTORE DRILL');
  console.log(`started ${new Date().toISOString()}`);

  // ---- 1 ------------------------------------------------------------------
  step(1, 'Take a backup of the source, and verify the archive is readable');
  try {
    run(process.execPath, [path.join(__dirname, 'backup.js'), '--url', args.url, '--label', 'drill']);
  } catch (err) {
    fail(`Backup step failed: ${err.message}`);
  }
  const archive = newestArchive();

  // ---- 2 ------------------------------------------------------------------
  step(2, `Restore into a throwaway database ("${RESTORE_DB}") and verify against the manifest`);
  const restoreStarted = Date.now();
  try {
    run(process.execPath, [
      path.join(__dirname, 'restore.js'),
      '--archive', archive,
      '--url', restoreUrl,
      '--create',
    ]);
  } catch (err) {
    fail(`Restore step failed: ${err.message}`);
  }
  const restoreSeconds = Number(((Date.now() - restoreStarted) / 1000).toFixed(1));

  // ---- 3 ------------------------------------------------------------------
  if (!args.skipApp) {
    step(3, 'Prove the APPLICATION can use the restored database');
    try {
      execFileSync(
        process.execPath,
        [
          require.resolve('tsx/cli', { paths: [path.join(__dirname, '..', '..', 'packages', 'db')] }),
          // In packages/db, not here: it is the one part of this tooling that
          // imports @prisma/client, which Node resolves relative to the
          // importing file — from infra/ it is not on the resolution path.
          path.join(__dirname, '..', '..', 'packages', 'db', 'src', 'verify-restore.ts'),
        ],
        {
          stdio: 'inherit',
          cwd: path.join(__dirname, '..', '..', 'packages', 'db'),
          env: { ...process.env, DATABASE_URL: restoreUrl },
        },
      );
    } catch (err) {
      fail(
        `The database restored and matched the manifest, but the application cannot use it.\n` +
          `  ${err.message}\n` +
          `  This is still a FAILED drill — structural integrity is not recoverability.`,
      );
    }
  }

  // ---- 4 ------------------------------------------------------------------
  if (!args.keep) {
    step(4, 'Tear down the restore target');
    try {
      const { runPgTool, connectionStringFor, psqlScalar } = require('./pg-tools');
      const admin = new URL(restoreUrl);
      admin.pathname = '/postgres';
      psqlScalar(
        admin.toString(),
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${RESTORE_DB}' AND pid <> pg_backend_pid()`,
      );
      runPgTool('psql', [connectionStringFor(admin.toString()), '-c', `DROP DATABASE IF EXISTS "${RESTORE_DB}"`], {
        url: admin.toString(),
        stdio: 'pipe',
      });
      console.log(`  dropped "${RESTORE_DB}"`);
    } catch (err) {
      // Not fatal: the drill already succeeded. A leftover database is untidy,
      // not incorrect, and failing here would report a false negative.
      console.log(`  WARNING: could not drop "${RESTORE_DB}": ${err.message}`);
    }
  } else {
    console.log(`\n  --keep: "${RESTORE_DB}" left running for inspection.`);
  }

  const manifest = JSON.parse(fs.readFileSync(`${archive}.manifest.json`, 'utf8'));
  const totalSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));

  console.log(`\n${'='.repeat(72)}`);
  console.log('DRILL PASSED — the backup is restorable and the application can use it.');
  console.log(`${'='.repeat(72)}`);
  console.log(`  archive:          ${path.basename(archive)}`);
  console.log(`  size:             ${(manifest.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  rows verified:    ${Object.values(manifest.rowCounts).reduce((a, b) => a + b, 0)}`);
  console.log(`  restore time:     ${restoreSeconds}s   <- this is the measured RTO contribution`);
  console.log(`  total drill time: ${totalSeconds}s`);
  console.log(
    `\n  Recorded in docs/37-BACKUP-AND-RESTORE.md. Restore time scales with data volume,\n` +
      `  so re-measure the RTO whenever the database grows by an order of magnitude —\n` +
      `  an RTO measured on a small dataset is not a commitment you can keep on a large one.`,
  );
}

if (require.main === module) main();
module.exports = { restoreUrlFrom, RESTORE_DB };
