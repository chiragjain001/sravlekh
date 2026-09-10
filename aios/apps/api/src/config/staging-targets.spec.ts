/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import * as path from 'path';

import { checkPostgresTarget, checkRedisTarget, hostPort, parseAllowlist } from './staging-targets';

/**
 * The staging target guard, and the proof that its two Node implementations
 * cannot drift apart.
 *
 * There are two copies because there have to be: the Nest build has a rootDir,
 * so env.schema.ts cannot import infra/staging/staging-targets.js, and the infra
 * scripts must run before anything is compiled. The risk that creates is
 * specific and serious — if the boot guard and the migration guard disagreed
 * about which hosts are safe, one of them would fail open, and the failure would
 * look exactly like everything working. So the conformance block at the bottom
 * runs both over the same table and requires identical answers.
 */

// The infra copy, loaded as the scripts load it: plain CommonJS, no build step.
const infra = require(path.join(__dirname, '..', '..', '..', '..', 'infra', 'staging', 'staging-targets.js'));

const STAGING_DB = 'postgresql://aios_staging:staging_local_only@localhost:5433/aios_staging';
const SHARED_DB = 'postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
const STAGING_REDIS = 'redis://localhost:6380';
const DEV_REDIS = 'redis://localhost:6379';

describe('hostPort', () => {
  it('reduces a URL to host:port and discards the credentials', () => {
    expect(hostPort(STAGING_DB, 5432)).toBe('localhost:5433');
    expect(hostPort(SHARED_DB, 5432)).toBe('aws-0-ap-south-1.pooler.supabase.com:6543');
  });

  it('applies the scheme default when the URL omits a port', () => {
    expect(hostPort('postgresql://u:p@db.internal/aios', 5432)).toBe('db.internal:5432');
    expect(hostPort('redis://cache.internal', 6379)).toBe('cache.internal:6379');
  });

  it('lowercases the host, so an allowlist entry cannot be dodged by casing', () => {
    expect(hostPort('postgresql://u:p@LOCALHOST:5433/db', 5432)).toBe('localhost:5433');
  });

  it('returns null rather than throwing on something unparseable', () => {
    expect(hostPort('not a url', 5432)).toBeNull();
    expect(hostPort('', 5432)).toBeNull();
  });
});

describe('parseAllowlist', () => {
  it('is empty for undefined, empty and whitespace — never defaulted', () => {
    // This is the fail-closed property: an operator who did not nominate a host
    // must end up with nothing permitted, not with something permitted.
    expect(parseAllowlist(undefined).size).toBe(0);
    expect(parseAllowlist('').size).toBe(0);
    expect(parseAllowlist('  ,  , ').size).toBe(0);
  });

  it('trims and lowercases entries', () => {
    expect([...parseAllowlist(' LocalHost:5433 , 127.0.0.1:5433 ')]).toEqual(['localhost:5433', '127.0.0.1:5433']);
  });
});

describe('checkPostgresTarget', () => {
  it('accepts a nominated staging host', () => {
    const r = checkPostgresTarget('DATABASE_URL', STAGING_DB, 'localhost:5433');
    expect(r.ok).toBe(true);
    expect(r.target).toBe('localhost:5433');
  });

  it('REFUSES the shared Supabase instance even if somebody nominated it', () => {
    // The blocklist is deliberately redundant with the allowlist: it protects
    // against nominating the shared host on purpose, which the allowlist cannot.
    const r = checkPostgresTarget('DATABASE_URL', SHARED_DB, 'aws-0-ap-south-1.pooler.supabase.com:6543');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/supabase/);
  });

  it('refuses a host that was simply never nominated', () => {
    const r = checkPostgresTarget('DATABASE_URL', 'postgresql://u:p@localhost:5432/aios', 'localhost:5433');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('localhost:5432');
    expect(r.reason).toContain('STAGING_DB_ALLOWLIST');
  });

  it('refuses everything when the allowlist is empty', () => {
    expect(checkPostgresTarget('DATABASE_URL', STAGING_DB, '').ok).toBe(false);
    expect(checkPostgresTarget('DATABASE_URL', STAGING_DB, undefined).ok).toBe(false);
  });

  it('refuses an unset variable instead of falling back to a default', () => {
    const r = checkPostgresTarget('DIRECT_URL', undefined, 'localhost:5433');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/is not set/);
  });

  it('NEVER puts the connection string or its password in the reason', () => {
    // A rejected boot prints this into deploy logs, which are far more widely
    // readable than the secret store the password came from.
    for (const url of [SHARED_DB, STAGING_DB, 'postgresql://u:p@localhost:5432/aios', 'postgres://bad url']) {
      const r = checkPostgresTarget('DATABASE_URL', url, 'localhost:5433');
      if (r.ok) continue;
      expect(r.reason).not.toContain('hunter2');
      expect(r.reason).not.toContain('staging_local_only');
      expect(r.reason).not.toContain('postgresql://');
      expect(r.reason).not.toContain('postgres://');
    }
  });
});

describe('checkRedisTarget', () => {
  it('accepts the nominated staging broker', () => {
    expect(checkRedisTarget('REDIS_URL', STAGING_REDIS, 'localhost:6380').ok).toBe(true);
  });

  it('refuses the dev default — the exact accident this guard exists for', () => {
    // REDIS_URL is optional everywhere else and falls back to 6379, so a staging
    // process that simply never got the variable would silently attach to the
    // developer's dev Redis behind a log warning.
    const r = checkRedisTarget('REDIS_URL', DEV_REDIS, 'localhost:6380');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('localhost:6379');
  });

  it('refuses an unset REDIS_URL rather than letting the 6379 default apply', () => {
    expect(checkRedisTarget('REDIS_URL', undefined, 'localhost:6380').ok).toBe(false);
  });
});

describe('conformance with infra/staging/staging-targets.js', () => {
  // Every case both implementations must answer identically. A divergence here
  // means the boot guard and the migration guard have started disagreeing about
  // which hosts are safe.
  const CASES: ReadonlyArray<[string, string | undefined, string | undefined]> = [
    ['DATABASE_URL', STAGING_DB, 'localhost:5433'],
    ['DATABASE_URL', SHARED_DB, 'localhost:5433'],
    ['DATABASE_URL', SHARED_DB, 'aws-0-ap-south-1.pooler.supabase.com:6543'],
    ['DATABASE_URL', 'postgresql://u:p@localhost:5432/aios', 'localhost:5433'],
    ['DATABASE_URL', 'postgresql://u:p@db.internal/aios', 'db.internal:5432'],
    ['DATABASE_URL', 'postgresql://u:p@LOCALHOST:5433/db', 'localhost:5433'],
    ['DIRECT_URL', undefined, 'localhost:5433'],
    ['DIRECT_URL', '', 'localhost:5433'],
    ['DATABASE_URL', 'not a url', 'localhost:5433'],
    ['DATABASE_URL', STAGING_DB, ''],
    ['DATABASE_URL', STAGING_DB, undefined],
    ['DATABASE_URL', 'postgresql://u:p@my-rds.rds.amazonaws.com:5432/db', 'my-rds.rds.amazonaws.com:5432'],
    ['DATABASE_URL', 'postgresql://u:p@x.neon.tech:5432/db', 'x.neon.tech:5432'],
  ];

  it.each(CASES)('postgres: %s / %s / allowlist=%s agrees across both copies', (name, url, allowlist) => {
    expect(checkPostgresTarget(name, url, allowlist)).toEqual(infra.checkPostgresTarget(name, url, allowlist));
  });

  const REDIS_CASES: ReadonlyArray<[string, string | undefined, string | undefined]> = [
    ['REDIS_URL', STAGING_REDIS, 'localhost:6380'],
    ['REDIS_URL', DEV_REDIS, 'localhost:6380'],
    ['REDIS_URL', 'redis://cache.internal', 'cache.internal:6379'],
    ['REDIS_URL', undefined, 'localhost:6380'],
    ['REDIS_URL', STAGING_REDIS, ''],
  ];

  it.each(REDIS_CASES)('redis: %s / %s / allowlist=%s agrees across both copies', (name, url, allowlist) => {
    expect(checkRedisTarget(name, url, allowlist)).toEqual(infra.checkRedisTarget(name, url, allowlist));
  });

  it('shares the same shared-host marker list', () => {
    expect([...infra.SHARED_DB_MARKERS]).toEqual(['supabase', 'pooler', 'rds.amazonaws', 'neon.tech']);
  });

  it('shares the same scheme default ports', () => {
    expect(infra.DEFAULT_PORTS).toEqual({ postgres: 5432, redis: 6379 });
  });
});
