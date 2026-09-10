'use strict';
/* Runs the PostgreSQL client binaries (pg_dump / pg_restore / psql) for the
 * backup tooling, from wherever they are actually available.
 *
 * WHY THIS EXISTS RATHER THAN JUST CALLING pg_dump:
 *
 * 1. VERSION SKEW IS A SILENT CORRUPTION RISK. pg_dump refuses to dump a server
 *    newer than itself, but the reverse — an older *server* dumped by a newer
 *    client, or a dump restored by an older pg_restore — produces archives that
 *    fail late, during restore, which is the worst possible moment to discover
 *    it. This module pins the client major version to the server's and says so
 *    out loud.
 *
 * 2. THE DEVELOPER MACHINE MAY NOT HAVE THEM AT ALL. This repo is developed on
 *    Windows where a Postgres client install is not a given, and a backup
 *    procedure nobody can run locally is a backup procedure nobody tests. The
 *    Docker path makes the drill runnable on any machine that can run the app.
 *
 * Resolution order: a local binary of the right major version if present
 * (fastest), otherwise the pinned postgres image via Docker. Both produce
 * byte-identical archives — the format is defined by the client version, not by
 * how it was launched.
 */
const { execFileSync, spawnSync } = require('child_process');
const path = require('path');

// The server major this tooling targets. Bump together with the image in
// infra/staging/docker-compose.yml and whatever runs in production — a mismatch
// here is exactly the failure mode described above.
const PG_MAJOR = 16;
const PG_IMAGE = `postgres:${PG_MAJOR}-alpine`;

/** Inside a container, "localhost" is the container. Rewrite to the host gateway. */
function containerReachableUrl(url) {
  return url.replace(/@(localhost|127\.0\.0\.1):/, '@host.docker.internal:');
}

function localBinaryMajor(bin) {
  const probe = spawnSync(bin, ['--version'], { encoding: 'utf8' });
  if (probe.status !== 0 || !probe.stdout) return null;
  const m = /(\d+)\.\d+/.exec(probe.stdout);
  return m ? Number(m[1]) : null;
}

let cachedMode = null;

/**
 * Decides once whether to use local binaries or Docker, and explains the choice.
 * Cached: the answer cannot change within a run, and re-probing per invocation
 * would make a parallel restore noticeably slower.
 */
function resolveMode() {
  if (cachedMode) return cachedMode;

  const localMajor = localBinaryMajor('pg_dump');
  if (localMajor === PG_MAJOR) {
    cachedMode = { kind: 'local', detail: `local pg_dump ${localMajor}.x` };
    return cachedMode;
  }

  const docker = spawnSync('docker', ['--version'], { encoding: 'utf8' });
  if (docker.status === 0) {
    cachedMode = {
      kind: 'docker',
      detail:
        localMajor === null
          ? `${PG_IMAGE} (no local pg_dump found)`
          : `${PG_IMAGE} (local pg_dump is ${localMajor}.x, need ${PG_MAJOR}.x)`,
    };
    return cachedMode;
  }

  const because =
    localMajor === null
      ? 'no pg_dump on PATH'
      : `local pg_dump is ${localMajor}.x but this tooling targets ${PG_MAJOR}.x`;
  throw new Error(
    `Cannot run PostgreSQL client tools: ${because}, and Docker is not available either.\n` +
      `  Install PostgreSQL ${PG_MAJOR} client tools, or install Docker so ${PG_IMAGE} can be used.`,
  );
}

/**
 * Runs one client binary.
 *
 * `fileArg` names a host path the command reads or writes. It is bind-mounted
 * rather than passed through a shell, so a path containing spaces (routine on
 * Windows) cannot break the invocation, and nothing is ever interpolated into a
 * command string.
 */
function runPgTool(bin, args, { url, fileHostPath = null, fileContainerPath = null, stdio = 'inherit' } = {}) {
  const mode = resolveMode();

  if (mode.kind === 'local') {
    return execFileSync(bin, args, {
      env: { ...process.env, PGPASSWORD: undefined, ...urlAsEnv(url) },
      stdio,
      encoding: stdio === 'pipe' ? 'utf8' : undefined,
      maxBuffer: 64 * 1024 * 1024,
    });
  }

  const dockerArgs = ['run', '--rm', '--add-host', 'host.docker.internal:host-gateway'];
  if (fileHostPath) {
    // Mount the DIRECTORY, not the file: pg_dump writes a file that does not yet
    // exist, and Docker would create a directory in its place if the target of a
    // file bind-mount is missing.
    dockerArgs.push('-v', `${path.resolve(path.dirname(fileHostPath))}:/backup`);
  }
  dockerArgs.push('-e', `PGPASSWORD=${passwordOf(url)}`);
  dockerArgs.push(PG_IMAGE, bin, ...args);

  return execFileSync('docker', dockerArgs, {
    stdio,
    encoding: stdio === 'pipe' ? 'utf8' : undefined,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function passwordOf(url) {
  try {
    return decodeURIComponent(new URL(url).password || '');
  } catch {
    return '';
  }
}

function urlAsEnv(url) {
  return { PGPASSWORD: passwordOf(url) };
}

/**
 * The connection string as the tool will actually see it — rewritten for the
 * container when running under Docker, untouched otherwise. Callers pass the
 * RESULT of this to pg_dump/-restore/psql, never the raw url, or a Docker run
 * would quietly try to reach a database inside its own container.
 */
function connectionStringFor(url) {
  return resolveMode().kind === 'docker' ? containerReachableUrl(url) : url;
}

/** Path as the tool will see it: inside /backup when containerised. */
function filePathFor(hostPath) {
  return resolveMode().kind === 'docker'
    ? `/backup/${path.basename(hostPath)}`
    : path.resolve(hostPath);
}

/** Runs a single SQL statement and returns trimmed stdout. */
function psqlScalar(url, sql) {
  const out = runPgTool('psql', [connectionStringFor(url), '-t', '-A', '-c', sql], {
    url,
    stdio: 'pipe',
  });
  return String(out).trim();
}

function serverMajor(url) {
  const raw = psqlScalar(url, 'SHOW server_version;');
  return Number(/(\d+)/.exec(raw)[1]);
}

/**
 * Refuses to proceed on a major-version mismatch instead of producing an archive
 * that only fails at restore time. See this module's header.
 */
function assertServerVersionSupported(url) {
  const major = serverMajor(url);
  if (major !== PG_MAJOR) {
    throw new Error(
      `Server is PostgreSQL ${major}.x but this tooling is pinned to ${PG_MAJOR}.x.\n` +
        `  A version-skewed dump typically restores *partially* and fails late, so this refuses up front.\n` +
        `  Update PG_MAJOR in infra/backup/pg-tools.js together with the server, and re-run the drill.`,
    );
  }
  return major;
}

module.exports = {
  PG_MAJOR,
  PG_IMAGE,
  runPgTool,
  connectionStringFor,
  filePathFor,
  psqlScalar,
  serverMajor,
  assertServerVersionSupported,
  resolveMode,
};
