# 37 — BACKUP AND RESTORE

Status: **implemented and drilled**. Created 2026-09-10, closing the P0 recorded
in `PRODUCTION-READINESS-AUDIT.md` §1.3 ("Backup & restore — **H** — no backup
script, no restore procedure, no documentation") and re-confirmed open in
`PRODUCTION-AUDIT-2026-09-10.md` §4.

The governing principle, and the reason this document exists at all:

> An untested backup is not a backup. A backup command exiting 0 is not evidence
> of anything. The only thing that counts is a restore you have actually
> performed and verified.

---

## 1. What exists

| File | Purpose |
| :--- | :--- |
| `infra/backup/pg-tools.js` | Runs `pg_dump`/`pg_restore`/`psql`, pinning the client to the server's major version. Uses local binaries if present, Docker (`postgres:16-alpine`) otherwise. |
| `infra/backup/backup.js` | Creates an archive, checksums it, **reads it back**, and writes a manifest describing what was in the source. Applies retention. |
| `infra/backup/restore.js` | Restores an archive and **verifies the result against the manifest**. Refuses corrupt archives and non-empty/shared targets. |
| `packages/db/src/verify-restore.ts` | Proves the *application* can use a restored database — Prisma connects, relations resolve, constraints enforce. |
| `infra/backup/drill.js` | The whole loop, automated: backup → fresh DB → restore → verify → app check → tear down. |
| `infra/backup/retention.test.js` | Tests for the only code path that deletes files. |

Commands:

```bash
pnpm backup --url "postgresql://..."          # create a verified backup
pnpm backup:restore --archive <f> --url "..." # restore + verify
pnpm backup:drill --url "postgresql://..."    # the full drill
pnpm backup:test                              # retention unit tests
```

---

## 2. Design decisions, and why

| Decision | Reasoning |
| :--- | :--- |
| Custom format (`-Fc`), not plain SQL | `pg_restore --list` can inspect it **without a database**, which is what makes backup-time integrity verification possible at all. Also enables selective and parallel restore. |
| Archive is **read back** before success is reported | `pg_dump` can exit 0 having written a truncated file — disk full, killed mid-write, network drop against a remote server. That is the ordinary way backups turn out worthless, and it is indistinguishable from a good backup until you need it. |
| SHA-256 written alongside | Detects bitrot and tampering between backup and restore. `restore.js` refuses on mismatch rather than loading partial data over good data. |
| Manifest records **exact** row counts | Not `pg_stat.n_live_tup`. That is an estimate refreshed by ANALYZE and is routinely 0 on a freshly migrated or restored database — and `restore.js` skips tables the manifest reports as empty, so the estimate would have silently disabled verification for exactly the tables most likely to have been missed. This was found and fixed while building the tooling. |
| `--serializable-deferrable` | A dump that starts mid-migration is a dump of a schema that never existed. A serializable snapshot makes the archive a single point in time even under concurrent DDL. |
| `--no-owner --no-privileges` | Restores land in a database owned by a different role on managed Postgres. Recording ownership makes every restore emit errors that mask the real ones. |
| `--exit-on-error` on restore | Without it `pg_restore` reports errors and still exits 0, letting a partial restore be reported as success. |
| `--compress=6`, not 9 | On this schema the extra ~4% costs disproportionate CPU on the database host, which during a backup window competes with live traffic. |
| Retention fails **safe** | Anything it cannot confidently classify is kept. An over-full backup directory is an annoyance; a deletion bug in backup tooling destroys the thing it exists to protect. |
| Artifacts are git- and docker-ignored | Archives contain every row of a real database, including user emails. `infra/backup/artifacts/` is in both ignore files. |

---

## 3. RPO and RTO

**These are commitments derived from a measured drill, not aspirations.**

| | Value | Basis |
| :--- | :--- | :--- |
| **RPO** (max data loss) | **24 hours** with daily backups alone | Determined entirely by backup *frequency*. Nothing in this tooling reduces it; see §6. |
| **RTO** (time to restore) | **~4 s** for a 0.17 MB database | Measured, 2026-09-10 (§4). Restore time scales with data volume — **this number is not a commitment at production scale.** |

**The RPO is the honest weak point.** Daily `pg_dump` means up to a day of
graded work can be lost. Reducing it requires continuous archiving (WAL shipping
/ PITR), which is a property of the *hosting* — on managed Postgres it is a
provider setting, not something this repo can implement. See §6.

**Re-measure the RTO whenever the database grows by an order of magnitude.** An
RTO measured on 80 rows is not a commitment you can keep on 80 million.

---

## 4. Drill log

Executed 2026-09-10 against `postgres:16.15` (`infra/staging/docker-compose.yml`),
schema from all 7 Prisma migrations, data from `packages/db/src/seed.ts`.

```
[1] Backup            416 restorable objects, 0.17 MB, sha256 verified
[2] Restore           into a fresh database, 3.3s
    tables            66   (matches backup)
    indexes           130  (matches backup)
    foreign keys      110  (all validated)
    constraints       408 check, 44 enum types
    migrations        7 applied (matches backup)
    rows              80 verified by EXACT count, per table, against the manifest
[3] Application       PASS prisma connects
                      PASS institute -> subject -> chapter -> topic
                           (Apex Academy (Demo) / Physics / Kinematics / Motion in a Straight Line)
                      PASS tenant members restored — 4 users, 1 batch
                      PASS 50 questions reachable through the topic hierarchy
                      PASS foreign keys enforce on write (orphan row rejected)
                      PASS unique constraints enforce on write (duplicate email rejected)
[4] Teardown          restore target dropped

DRILL PASSED
```

Note on timings: `restore.js` reports the `pg_restore` call itself (3.3 s).
`drill.js` reports the whole child process (43 s here), which on this machine is
dominated by Docker container startup for the pinned client image. **The 3.3 s
figure is the one that reflects restore cost**; the drill total is an artifact of
running the client in a container on a developer laptop.

### Negative controls — proving the verification is not vacuous

A verifier that always passes is worse than none, so both failure paths were
deliberately triggered:

| Injected fault | Result |
| :--- | :--- |
| 100 bytes flipped at offset 5000 in the archive | `RESTORE FAILED — Checksum mismatch … Refusing.` exit code **1** |
| Manifest claiming `questions=999` against a database restored with 50 | `RESTORE FAILED — rows in "questions": expected 999, restored 50` exit code **1** |

Retention (the only deleting code path) has 7 unit tests, including that an
unparseable manifest is **kept**, and that retention never empties a directory.
`pnpm backup:test` → 7 passed.

---

## 5. Procedure

### Routine backup
```bash
pnpm backup --url "$DATABASE_URL"
```
Writes `aios-<timestamp>.dump`, `.sha256` and `.manifest.json` to
`infra/backup/artifacts/`, then prunes per retention (7 daily + 4 weekly by
default; `--keep-daily` / `--keep-weekly` to change).

### Recovery
1. **Take a backup of the current broken state first.** It is evidence, and a
   restore overwrites it.
2. Identify the archive: `ls -t infra/backup/artifacts/*.manifest.json` — each
   manifest records `createdAt`, source `host:port/db`, and row counts, so you
   can choose by content rather than by filename.
3. Restore:
   ```bash
   pnpm backup:restore --archive <archive> --url "<target>" --create
   ```
   `--create` recreates the target from scratch. Without it, a non-empty target
   is refused (mixing two datasets is almost never intended).
4. The command verifies against the manifest and **fails loudly on any drift**.
   If it fails, treat the database as untrustworthy.
5. Prove the application can use it:
   ```bash
   DATABASE_URL="<target>" npx tsx packages/db/src/verify-restore.ts
   ```

### Guards you will meet
- Restoring into a host matching `supabase`, `rds.amazonaws`, `neon.tech`,
  `render.com`, `azure`, `cloudsql` is refused without
  `--i-understand-this-overwrites-data`.
- A checksum mismatch is refused outright, with no override.
- A client/server major-version mismatch is refused **before** dumping, rather
  than producing an archive that fails late during restore.

---

## 6. Out of scope — state this plainly when asked "are we covered?"

These are **not** covered by this tooling and must not be assumed:

- **Point-in-time recovery.** Daily dumps give a 24 h RPO. PITR needs continuous
  WAL archiving, which is a hosting capability (a provider setting on managed
  Postgres), not application code. **This is the single highest-value remaining
  improvement to durability.**
- **Object storage (S3).** Uploaded booklets, page images and generated reports
  live in S3 and are not in these archives. S3 needs its own versioning +
  lifecycle policy. A restored database will reference S3 keys that must still
  exist.
- **Redis.** Queue state only, deliberately excluded — it is reconstructible.
- **Cross-host recovery.** The drill restores onto the *same server* as the
  source. It proves the archive is complete and usable; it does **not** prove
  recovery onto fresh infrastructure, which additionally exercises networking,
  credentials and provisioning. Worth a separate, scheduled drill.
- **Off-site storage.** Archives are written to a local directory. Shipping them
  somewhere that survives the loss of the machine is a deployment concern and is
  not implemented here. **A backup stored only on the host it backs up is not a
  disaster-recovery plan.**

## 7. Scheduling

The drill must run on a schedule, not once — a backup pipeline breaks silently
over time through schema changes, Postgres upgrades and credential rotation.
`drill.js` exits non-zero on any failure, so it works directly as a cron job or
CI scheduled workflow. It is **not** currently wired into CI; doing so is the
recommended next step.
