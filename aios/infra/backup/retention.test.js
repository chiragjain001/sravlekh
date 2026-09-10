'use strict';
/* Tests for the ONE piece of the backup tooling that deletes files.
 *
 *   node --test infra/backup/retention.test.js
 *
 * Node's built-in runner, deliberately: this must be runnable before
 * `pnpm install` and without pulling Jest into infra/, for the same reason
 * infra/staging/staging-env.js avoids dotenv. A backup tool whose tests need
 * the app's toolchain is a backup tool that stops being tested.
 *
 * Everything else in infra/backup is verified by executing it against a real
 * database (see docs/37-BACKUP-AND-RESTORE.md's drill log) — that is stronger
 * evidence than a mock would be. Retention is the exception: its failure mode
 * is deleting a backup someone needs, which is precisely the thing you cannot
 * afford to discover by running it.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { applyRetention } = require('./backup');

const DAY = 24 * 60 * 60 * 1000;

function makeDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aios-retention-'));
}

/** Writes the three files a real backup produces, dated `ageDays` ago. */
function seedBackup(dir, name, ageDays) {
  const createdAt = new Date(Date.now() - ageDays * DAY).toISOString();
  fs.writeFileSync(path.join(dir, `${name}.dump`), 'archive');
  fs.writeFileSync(path.join(dir, `${name}.dump.sha256`), 'deadbeef  ' + name);
  fs.writeFileSync(
    path.join(dir, `${name}.dump.manifest.json`),
    JSON.stringify({ archive: `${name}.dump`, createdAt }),
  );
}

const exists = (dir, name) => fs.existsSync(path.join(dir, `${name}.dump`));

test('keeps every backup inside the daily window', () => {
  const dir = makeDir();
  seedBackup(dir, 'today', 0);
  seedBackup(dir, 'yesterday', 1);
  seedBackup(dir, 'six-days', 6);

  applyRetention(dir, 7, 4);

  assert.ok(exists(dir, 'today'));
  assert.ok(exists(dir, 'yesterday'));
  assert.ok(exists(dir, 'six-days'));
});

test('deletes a backup older than both windows, and all three of its files', () => {
  const dir = makeDir();
  seedBackup(dir, 'ancient', 400);

  applyRetention(dir, 7, 4);

  assert.ok(!exists(dir, 'ancient'), 'archive should be gone');
  assert.ok(!fs.existsSync(path.join(dir, 'ancient.dump.sha256')), 'checksum should be gone');
  assert.ok(!fs.existsSync(path.join(dir, 'ancient.dump.manifest.json')), 'manifest should be gone');
});

test('keeps one weekly survivor per week beyond the daily window', () => {
  const dir = makeDir();
  // Three backups in the same week, all past the 7-day daily window.
  seedBackup(dir, 'wk-a', 10);
  seedBackup(dir, 'wk-b', 11);
  seedBackup(dir, 'wk-c', 12);

  applyRetention(dir, 7, 4);

  const survivors = ['wk-a', 'wk-b', 'wk-c'].filter((n) => exists(dir, n));
  assert.strictEqual(
    survivors.length,
    1,
    `exactly one weekly survivor expected, got ${survivors.length}: ${survivors.join(', ')}`,
  );
  // The newest of the week, since manifests are processed newest-first.
  assert.strictEqual(survivors[0], 'wk-a');
});

test('a backup with an unreadable manifest is KEPT, never deleted', () => {
  // The conservative branch. If retention cannot classify a file it must not
  // guess — deleting a backup you failed to parse is the worst outcome here.
  const dir = makeDir();
  fs.writeFileSync(path.join(dir, 'broken.dump'), 'archive');
  fs.writeFileSync(path.join(dir, 'broken.dump.manifest.json'), '{ this is not json');

  applyRetention(dir, 7, 4);

  assert.ok(exists(dir, 'broken'), 'unparseable manifest must not cause deletion');
});

test('a manifest with an invalid createdAt is KEPT', () => {
  const dir = makeDir();
  fs.writeFileSync(path.join(dir, 'nodate.dump'), 'archive');
  fs.writeFileSync(
    path.join(dir, 'nodate.dump.manifest.json'),
    JSON.stringify({ archive: 'nodate.dump', createdAt: 'not-a-date' }),
  );

  applyRetention(dir, 7, 4);

  assert.ok(exists(dir, 'nodate'), 'undateable backup must not cause deletion');
});

test('an archive with no manifest at all is untouched', () => {
  // Retention is manifest-driven. A stray .dump someone copied in by hand is
  // not ours to delete.
  const dir = makeDir();
  fs.writeFileSync(path.join(dir, 'orphan.dump'), 'archive');

  applyRetention(dir, 7, 4);

  assert.ok(exists(dir, 'orphan'));
});

test('never empties the directory — the newest backup always survives', () => {
  // The property that matters most: whatever the dates say, retention must not
  // leave you with nothing.
  const dir = makeDir();
  seedBackup(dir, 'newest', 0);
  seedBackup(dir, 'old-1', 500);
  seedBackup(dir, 'old-2', 600);

  applyRetention(dir, 7, 4);

  assert.ok(exists(dir, 'newest'));
  assert.ok(fs.readdirSync(dir).some((f) => f.endsWith('.dump')), 'directory must not be emptied');
});
