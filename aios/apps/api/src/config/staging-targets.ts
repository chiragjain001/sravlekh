/**
 * Target-safety logic for the disposable staging stack — TypeScript twin of
 * infra/staging/staging-targets.js.
 *
 * WHY TWO COPIES: the Nest build has a rootDir, so env.schema.ts cannot import a
 * plain CommonJS module living under infra/. Rather than pretend one module
 * spans that boundary, both exist and staging-targets.spec.ts loads BOTH and
 * asserts identical behaviour over a shared table of cases. Drift fails CI
 * instead of quietly letting the boot guard and the migration guard disagree
 * about which hosts are safe — which is the one way this could fail open.
 *
 * Two independent guards, deliberately redundant:
 *
 *   ALLOWLIST — the target must be nominated. No default: unset means nothing
 *     was nominated, so nothing is permitted.
 *   SHARED MARKERS — the target must not look like a hosted instance, even if
 *     somebody nominated it.
 *
 * A blocklist alone would fail open here: the shared database is a Supabase
 * pooler whose hostname contains neither "prod" nor "production".
 *
 * CREDENTIAL SAFETY: everything returned or embedded in a reason is host:port. A
 * connection URL is never echoed — a rejected boot prints this message into
 * deploy logs, which are far more widely readable than the secret store the
 * password came from.
 */

export const SHARED_DB_MARKERS: readonly string[] = ['supabase', 'pooler', 'rds.amazonaws', 'neon.tech'];

export const DEFAULT_PORTS = { postgres: 5432, redis: 6379 } as const;

export interface TargetCheck {
  ok: boolean;
  target: string | null;
  reason: string;
}

/** `host:port` from a connection URL, lowercased. Credentials are discarded. */
export function hostPort(url: string, defaultPort: number): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname) return null;
    return `${u.hostname.toLowerCase()}:${u.port || defaultPort}`;
  } catch {
    return null;
  }
}

/** Comma-separated `host:port` entries -> Set. Blanks are dropped, not defaulted. */
export function parseAllowlist(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function checkTarget(args: {
  name: string;
  url: string | undefined;
  allowlist: Set<string>;
  allowlistVar: string;
  defaultPort: number;
}): TargetCheck {
  const { name, url, allowlist, allowlistVar, defaultPort } = args;

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

export function checkPostgresTarget(
  name: string,
  url: string | undefined,
  allowlistRaw: string | undefined,
  allowlistVar = 'STAGING_DB_ALLOWLIST',
): TargetCheck {
  return checkTarget({
    name,
    url,
    allowlist: parseAllowlist(allowlistRaw),
    allowlistVar,
    defaultPort: DEFAULT_PORTS.postgres,
  });
}

export function checkRedisTarget(
  name: string,
  url: string | undefined,
  allowlistRaw: string | undefined,
  allowlistVar = 'STAGING_REDIS_ALLOWLIST',
): TargetCheck {
  return checkTarget({
    name,
    url,
    allowlist: parseAllowlist(allowlistRaw),
    allowlistVar,
    defaultPort: DEFAULT_PORTS.redis,
  });
}
