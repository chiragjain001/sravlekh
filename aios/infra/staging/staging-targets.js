'use strict';
/* Target-safety logic shared by every staging entrypoint.
 *
 * One implementation, used by migrate-staging.js, prove-targets.js and
 * verify-isolation.js. apps/api/src/config/staging-targets.ts is its TypeScript
 * twin — the Nest schema cannot reach across the build boundary into infra/ —
 * and apps/api/src/config/staging-targets.spec.ts loads BOTH and asserts they
 * agree on a shared table of cases, so the two cannot drift silently.
 *
 * Two independent guards, deliberately redundant:
 *
 *   ALLOWLIST — the target must be nominated. There is no default: unset means
 *     nothing was nominated, so nothing is permitted. Protects against typos and
 *     against forgetting to set a variable at all.
 *   SHARED MARKERS — the target must not look like a hosted instance, even if
 *     somebody nominated it. Protects against nominating the wrong thing on
 *     purpose.
 *
 * A blocklist alone would fail open here: the shared database is a Supabase
 * pooler whose hostname contains neither "prod" nor "production", so a
 * name-based blocklist would wave it through. An allowlist only has to be told
 * the one host that is safe.
 *
 * CREDENTIAL SAFETY: every value returned or embedded in a reason is host:port.
 * A connection URL is never echoed — these messages land in terminal scrollback,
 * CI logs and deploy logs, all of which are far more widely readable than the
 * place the password came from.
 */

const SHARED_DB_MARKERS = Object.freeze(['supabase', 'pooler', 'rds.amazonaws', 'neon.tech']);

const DEFAULT_PORTS = Object.freeze({ postgres: 5432, redis: 6379 });

/** `host:port` from a connection URL, lowercased. Credentials are discarded. */
function hostPort(url, defaultPort) {
  try {
    const u = new URL(url);
    if (!u.hostname) return null;
    return `${u.hostname.toLowerCase()}:${u.port || defaultPort}`;
  } catch {
    return null;
  }
}

/** Comma-separated `host:port` entries -> Set. Blanks are dropped, not defaulted. */
function parseAllowlist(raw) {
  return new Set(
    String(raw || '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Decide whether one target is safe to use.
 *
 * Returns `{ ok, target, reason }` rather than throwing so the same logic can
 * back a zod ctx.addIssue, a pydantic RuntimeError and a script's exit(2)
 * without any of them having to catch.
 */
function checkTarget({ name, url, allowlist, allowlistVar, defaultPort }) {
  if (!url) {
    return {
      ok: false,
      target: null,
      reason: `${name} is not set. A staging process must be told its target explicitly — falling back to a default is how a staging run reaches the shared instance.`,
    };
  }

  const target = hostPort(url, defaultPort);
  if (!target) {
    // Deliberately does not echo the value: a malformed URL is still a URL that
    // may carry a password.
    return { ok: false, target: null, reason: `${name} is not a URL this guard can parse a host:port out of.` };
  }

  const marker = SHARED_DB_MARKERS.find((m) => target.includes(m));
  if (marker) {
    return {
      ok: false,
      target,
      reason: `${name} points at ${target}, which contains "${marker}" — that is a shared/hosted instance, not disposable staging.`,
    };
  }

  if (allowlist.size === 0) {
    return {
      ok: false,
      target,
      reason: `${allowlistVar} is empty — no host has been nominated as safe, so nothing is permitted.`,
    };
  }

  if (!allowlist.has(target)) {
    return {
      ok: false,
      target,
      reason: `${name} points at ${target}, which is not in ${allowlistVar} (${[...allowlist].join(', ')}).`,
    };
  }

  return { ok: true, target, reason: '' };
}

/** Convenience wrappers so call sites cannot mix up the default ports. */
function checkPostgresTarget(name, url, allowlistRaw, allowlistVar = 'STAGING_DB_ALLOWLIST') {
  return checkTarget({
    name,
    url,
    allowlist: parseAllowlist(allowlistRaw),
    allowlistVar,
    defaultPort: DEFAULT_PORTS.postgres,
  });
}

function checkRedisTarget(name, url, allowlistRaw, allowlistVar = 'STAGING_REDIS_ALLOWLIST') {
  return checkTarget({
    name,
    url,
    allowlist: parseAllowlist(allowlistRaw),
    allowlistVar,
    defaultPort: DEFAULT_PORTS.redis,
  });
}

module.exports = {
  SHARED_DB_MARKERS,
  DEFAULT_PORTS,
  hostPort,
  parseAllowlist,
  checkTarget,
  checkPostgresTarget,
  checkRedisTarget,
};
