#!/usr/bin/env node
'use strict';
/* Creates a verified, restorable backup of an AIOS database.
 *
 *   node infra/backup/backup.js --url "postgresql://..." --out infra/backup/artifacts
 *   node infra/backup/backup.js --env staging
 *
 * WHAT "VERIFIED" MEANS HERE: the archive is written, checksummed, and then
 * READ BACK through pg_restore --list before this command reports success. A
 * pg_dump that exits 0 having written a truncated file (disk full, killed
 * mid-write, network drop against a remote server) is the ordinary way backups
 * turn out to be worthless, and it is indistinguishable from a good backup
 * until the day you need it. Exit code alone is not evidence.
 *
 * FORMAT: custom (-Fc), not plain SQL. Three reasons, all of which matter
 * during an actual incident:
 *   - `pg_restore --list` can inspect it WITHOUT a database, which is what makes
 *     the integrity check above possible at all;
 *   - selective restore (one table, one schema) is possible, so a single
 *     dropped table does not require a full-cluster rollback;
 *   - it is compressed in-format, so there is no separate gzip step whose
 *     failure could be missed.
 *
 * WHAT IS NOT BACKED UP HERE: object storage (S3) and Redis. Redis holds queue
 * state, which is reconstructible and deliberately not part of RPO. S3 needs its
 * own lifecycle/versioning policy — see docs/37-BACKUP-AND-RESTORE.md §"Out of
 * scope". Saying so explicitly, because a "database backup" is routinely
 * mistaken for a complete one.
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
  PG_MAJOR,
} = require('./pg-tools');

const DEFAULT_OUT = path.join(__dirname, 'artifacts');

function parseArgs(argv) {
  const args = { url: null, out: DEFAULT_OUT, label: null, keepDaily: 7, keepWeekly: 4 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--label') args.label = argv[++i];
    else if (a === '--keep-daily') args.keepDaily = Number(argv[++i]);
    else if (a === '--keep-weekly') args.keepWeekly = Number(argv[++i]);
  }
  if (!args.url) args.url = process.env['DATABASE_URL'] || null;
  return args;
}

function fail(message) {
  console.error(`\nBACKUP FAILED\n\n${message}\n`);
  process.exit(1);
}

function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(file));
  return hash.digest('hex');
}

/** host:port/database — never the full URL, which carries the password. */
function safeTarget(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '<unparseable connection string>';
  }
}

/**
 * Row counts for every table, captured at backup time.
 *
 * This is the manifest's most important field. Without it a restore can only be
 * verified against itself ("it restored without error"), which cannot detect a
 * dump taken from the wrong database, or taken while a migration was halfway
 * applied. With it, restore verification is a comparison against what was
 * actually there.
 */
function captureRowCounts(url) {
  // EXACT counts, not pg_stat's n_live_tup. n_live_tup is an estimate refreshed
  // by ANALYZE, and on a freshly migrated or freshly restored database it is
  // routinely 0 for tables that hold rows. Using it here would have made the
  // manifest under-report, and restore.js skips any table the manifest says has
  // 0 rows — so the estimate would have silently disabled verification for
  // exactly the tables most likely to have been missed. A backup already reads
  // every row; counting them is not the expensive part.
  const sql = `
    SELECT string_agg(format('%s=%s', relname, cnt), ',') FROM (
      SELECT c.relname,
             (xpath('/row/c/text()',
                    query_to_xml(format('SELECT count(*) AS c FROM %I.%I', n.nspname, c.relname),
                                 false, true, '')))[1]::text::bigint AS cnt
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
      ORDER BY c.relname
    ) t;`;
  const raw = psqlScalar(url, sql.replace(/\s+/g, ' '));
  const counts = {};
  if (raw) {
    for (const pair of raw.split(',')) {
      const [name, n] = pair.split('=');
      if (name) counts[name] = Number(n || 0);
    }
  }
  return counts;
}

function captureSchemaShape(url) {
  const one = (sql) => Number(psqlScalar(url, sql));
  return {
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
}

/**
 * Deletes backups outside the retention window.
 *
 * Daily backups are kept for --keep-daily days. One backup per ISO week is
 * additionally kept for --keep-weekly weeks, so a corruption discovered late —
 * the case where dailies have already rolled off — still has something to
 * restore from. Deliberately conservative: anything it cannot confidently
 * classify is KEPT. An over-full backup directory is an operational annoyance;
 * a deletion bug in the backup tooling is the thing it exists to prevent.
 */
function applyRetention(dir, keepDaily, keepWeekly) {
  const manifests = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.manifest.json'))
    .map((f) => {
      try {
        const m = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        return { manifest: f, createdAt: new Date(m.createdAt), archive: m.archive };
      } catch {
        return null; // unreadable manifest: leave it and its archive alone
      }
    })
    .filter((m) => m && !Number.isNaN(m.createdAt.getTime()))
    .sort((a, b) => b.createdAt - a.createdAt);

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const keptWeeks = new Set();
  const removed = [];

  for (const entry of manifests) {
    const ageDays = (now - entry.createdAt.getTime()) / DAY;
    if (ageDays <= keepDaily) continue;

    const week = `${entry.createdAt.getUTCFullYear()}-W${Math.floor(entry.createdAt.getTime() / (7 * DAY))}`;
    if (ageDays <= keepDaily + keepWeekly * 7 && !keptWeeks.has(week)) {
      keptWeeks.add(week); // the weekly survivor for this week
      continue;
    }

    for (const file of [entry.manifest, entry.archive, `${entry.archive}.sha256`]) {
      const p = path.join(dir, file);
      if (file && fs.existsSync(p)) {
        fs.unlinkSync(p);
        removed.push(file);
      }
    }
  }
  return removed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    fail(
      'No database URL. Pass --url "postgresql://..." or set DATABASE_URL.\n' +
        '  The URL is never logged or written to the manifest — only host:port/database is.',
    );
  }

  const mode = resolveMode();
  console.log(`AIOS database backup`);
  console.log(`  client:  ${mode.detail}`);
  console.log(`  target:  ${safeTarget(args.url)}`);

  assertServerVersionSupported(args.url);

  fs.mkdirSync(args.out, { recursive: true });

  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const name = `aios-${args.label ? `${args.label}-` : ''}${stamp}.dump`;
  const archivePath = path.join(args.out, name);

  // Captured BEFORE the dump so the manifest describes the state the dump is
  // taken from. Taken after, a concurrent write would make the manifest disagree
  // with the archive and every restore verification would look like a failure.
  const shape = captureSchemaShape(args.url);
  const rowCounts = captureRowCounts(args.url);

  console.log(`  writing: ${path.relative(process.cwd(), archivePath)}`);

  try {
    runPgTool(
      'pg_dump',
      [
        connectionStringFor(args.url),
        '--format=custom',
        // Level 6 rather than the default 9: on this schema the extra ~4% saving
        // costs disproportionate CPU on the database host, which during a backup
        // window is competing with live traffic.
        '--compress=6',
        // Restores go into a database owned by a possibly different role
        // (managed Postgres rarely gives you the original owner). Recording
        // ownership would make every restore emit errors that mask real ones.
        '--no-owner',
        '--no-privileges',
        // A dump that starts mid-migration is a dump of a schema that never
        // existed. A serializable snapshot makes the archive a single point in
        // time even under concurrent DDL.
        '--serializable-deferrable',
        `--file=${filePathFor(archivePath)}`,
      ],
      { url: args.url, fileHostPath: archivePath },
    );
  } catch (err) {
    fail(`pg_dump failed: ${err.message}`);
  }

  if (!fs.existsSync(archivePath) || fs.statSync(archivePath).size === 0) {
    fail('pg_dump exited successfully but produced no archive. Nothing was backed up.');
  }

  // ---- integrity: read the archive back, do not trust the exit code ---------
  let tocEntries = 0;
  try {
    const toc = runPgTool('pg_restore', ['--list', filePathFor(archivePath)], {
      url: args.url,
      fileHostPath: archivePath,
      stdio: 'pipe',
    });
    tocEntries = String(toc).split('\n').filter((l) => l && !l.startsWith(';')).length;
  } catch (err) {
    fail(
      `The archive was written but pg_restore could not read it back — it is NOT a usable backup.\n` +
        `  ${err.message}`,
    );
  }
  if (tocEntries === 0) {
    fail('The archive contains no restorable objects. Refusing to report a successful backup.');
  }

  const checksum = sha256(archivePath);
  fs.writeFileSync(`${archivePath}.sha256`, `${checksum}  ${name}\n`);

  const sizeBytes = fs.statSync(archivePath).size;
  const manifest = {
    archive: name,
    createdAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    durationSeconds: Number(((Date.now() - startedAt.getTime()) / 1000).toFixed(1)),
    source: safeTarget(args.url), // never the credentials
    pgMajor: PG_MAJOR,
    format: 'custom',
    sizeBytes,
    sha256: checksum,
    tocEntries,
    schema: shape,
    rowCounts,
  };
  fs.writeFileSync(`${archivePath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  const removed = applyRetention(args.out, args.keepDaily, args.keepWeekly);

  console.log(`\nBACKUP VERIFIED`);
  console.log(`  size:      ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  sha256:    ${checksum.slice(0, 16)}…`);
  console.log(`  toc:       ${tocEntries} restorable objects`);
  console.log(`  schema:    ${shape.tables} tables, ${shape.indexes} indexes, ${shape.foreignKeys} FKs`);
  console.log(`  rows:      ${Object.values(rowCounts).reduce((a, b) => a + b, 0)} across ${Object.keys(rowCounts).length} tables`);
  console.log(`  duration:  ${manifest.durationSeconds}s`);
  if (removed.length) console.log(`  retention: removed ${removed.length / 3} expired backup(s)`);
  console.log(
    `\nNOTE: a verified archive is not a verified RESTORE. Run infra/backup/drill.js\n` +
      `on a schedule — docs/37-BACKUP-AND-RESTORE.md explains why that is the only\n` +
      `check that actually proves recoverability.`,
  );
}

if (require.main === module) main();
module.exports = { applyRetention, sha256, safeTarget };
