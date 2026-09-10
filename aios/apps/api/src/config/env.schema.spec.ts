import { envSchema } from './env.schema';

/**
 * These tests exist for one reason: POST /auth/dev-login mints a real JWT for
 * any requested role with no credentials. Its old gate (`NODE_ENV !==
 * 'production'`) failed OPEN on any misconfiguration. The schema is now the
 * outermost of two defences — it refuses to construct a valid production config
 * at all if the dev-login flag is on, so the process crashes at boot instead of
 * serving a credential-less login endpoint. (The second defence is the
 * default-deny check in AuthService.loginAsMockRole — see auth.service.spec.ts.)
 */

const baseEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/aios',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  JWT_SECRET: 'a'.repeat(32),
};

describe('envSchema — ENABLE_DEV_LOGIN safety gate', () => {
  it('defaults to disabled when the variable is absent entirely', () => {
    const parsed = envSchema.parse({ ...baseEnv });
    expect(parsed.ENABLE_DEV_LOGIN).toBe(false);
  });

  it("treats the string 'false' as disabled (NOT Boolean('false') === true)", () => {
    // The bug this prevents: z.coerce.boolean() would read ENABLE_DEV_LOGIN=false
    // as ENABLED, because Boolean('false') is true in JavaScript.
    const parsed = envSchema.parse({ ...baseEnv, ENABLE_DEV_LOGIN: 'false' });
    expect(parsed.ENABLE_DEV_LOGIN).toBe(false);
  });

  it("treats the string 'true' as enabled in a non-production environment", () => {
    const parsed = envSchema.parse({ ...baseEnv, NODE_ENV: 'development', ENABLE_DEV_LOGIN: 'true' });
    expect(parsed.ENABLE_DEV_LOGIN).toBe(true);
  });

  it('rejects any value that is not exactly "true" or "false"', () => {
    expect(() => envSchema.parse({ ...baseEnv, ENABLE_DEV_LOGIN: 'yes' })).toThrow();
    expect(() => envSchema.parse({ ...baseEnv, ENABLE_DEV_LOGIN: '1' })).toThrow();
  });

  it('REFUSES TO PARSE (i.e. the API refuses to boot) when enabled in production', () => {
    expect(() =>
      envSchema.parse({ ...baseEnv, NODE_ENV: 'production', ENABLE_DEV_LOGIN: 'true' }),
    ).toThrow(/ENABLE_DEV_LOGIN must not be true when NODE_ENV=production/);
  });

  it('allows production to boot normally when the flag is absent or false', () => {
    // A production boot now also requires INTERNAL_SERVICE_TOKEN (see the
    // fail-closed suite below), so a valid production env must supply it. This
    // test is about ENABLE_DEV_LOGIN, so it provides the token rather than
    // asserting a production env that would legitimately be rejected.
    const prod = { ...baseEnv, NODE_ENV: 'production', INTERNAL_SERVICE_TOKEN: 'i'.repeat(32) };
    expect(() => envSchema.parse({ ...prod })).not.toThrow();
    expect(() => envSchema.parse({ ...prod, ENABLE_DEV_LOGIN: 'false' })).not.toThrow();
  });

  it('allows staging to boot with the flag off, and blocks nothing else about staging', () => {
    const parsed = envSchema.parse({ ...baseEnv, NODE_ENV: 'staging' });
    expect(parsed.NODE_ENV).toBe('staging');
    expect(parsed.ENABLE_DEV_LOGIN).toBe(false);
  });
});

describe('envSchema — INTERNAL_SERVICE_TOKEN fail-closed gate', () => {
  // Found by staging verification: the token was unset in BOTH services, so
  // verify_internal_token never ran and the Python AI endpoints would have
  // served any caller that could reach the port. These endpoints take no user
  // JWT by design, so this credential is the only thing guarding them.
  const PROD = { ...baseEnv, NODE_ENV: 'production' };
  const VALID = 'i'.repeat(32);

  it('REFUSES to boot in production when the token is missing', () => {
    expect(() => envSchema.parse({ ...PROD })).toThrow(/INTERNAL_SERVICE_TOKEN is required/);
  });

  it('refuses an empty-string token in production', () => {
    expect(() => envSchema.parse({ ...PROD, INTERNAL_SERVICE_TOKEN: '' })).toThrow(/INTERNAL_SERVICE_TOKEN is required/);
  });

  it('refuses a token that is too short to be unguessable', () => {
    expect(() => envSchema.parse({ ...PROD, INTERNAL_SERVICE_TOKEN: 'short' }))
      .toThrow(/at least 32 characters/);
  });

  it('accepts a production boot once a long enough token is supplied', () => {
    const parsed = envSchema.parse({ ...PROD, INTERNAL_SERVICE_TOKEN: VALID });
    expect(parsed.INTERNAL_SERVICE_TOKEN).toBe(VALID);
  });

  it('leaves development unaffected — local setups keep working without it', () => {
    const parsed = envSchema.parse({ ...baseEnv, NODE_ENV: 'development' });
    expect(parsed.INTERNAL_SERVICE_TOKEN).toBeUndefined();
  });

  it('never echoes the token value in the failure message', () => {
    // The message is surfaced on a failed boot, which lands in deploy logs.
    const secret = 'super-secret-value-that-must-not-leak-anywhere';
    try {
      envSchema.parse({ ...PROD, INTERNAL_SERVICE_TOKEN: secret.slice(0, 10) });
      throw new Error('expected a validation failure');
    } catch (err) {
      expect(String((err as Error).message)).not.toContain(secret.slice(0, 10));
    }
  });
});

describe('envSchema — AIOS_ENV=staging target guard', () => {
  /**
   * Staging isolation used to be a launch procedure you had to remember.
   * apps/api/.env points DATABASE_URL and DIRECT_URL at the shared Supabase
   * instance and REDIS_URL at the dev broker; process env is what overrides
   * them. A staging process launched without the full set of overrides came up
   * attached to shared infrastructure and looked completely normal — the failure
   * had no symptom at all. These tests pin the behaviour that replaced it: a
   * staging process that did not get every target simply does not boot.
   *
   * The guard is armed by AIOS_ENV, deliberately NOT by NODE_ENV. NODE_ENV=staging
   * is a legitimate value for a hosted staging deployment against a hosted
   * database; AIOS_ENV=staging means the disposable containers in
   * infra/staging/docker-compose.yml.
   */
  const STAGING_DB = 'postgresql://aios_staging:staging_local_only@localhost:5433/aios_staging';
  const SHARED_DB = 'postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
  const SHARED_DIRECT = 'postgresql://postgres:hunter2@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
  const STAGING_REDIS = 'redis://localhost:6380';
  const DEV_REDIS = 'redis://localhost:6379';

  const STAGING = {
    ...baseEnv,
    NODE_ENV: 'staging',
    AIOS_ENV: 'staging',
    DATABASE_URL: STAGING_DB,
    DIRECT_URL: STAGING_DB,
    REDIS_URL: STAGING_REDIS,
    STAGING_DB_ALLOWLIST: 'localhost:5433',
    STAGING_REDIS_ALLOWLIST: 'localhost:6380',
  };

  it('boots when every target is a nominated staging host', () => {
    expect(() => envSchema.parse({ ...STAGING })).not.toThrow();
  });

  it('REFUSES to boot against the shared database', () => {
    expect(() => envSchema.parse({ ...STAGING, DATABASE_URL: SHARED_DB })).toThrow(/supabase/);
  });

  it('REFUSES to boot when only DATABASE_URL was redirected and DIRECT_URL still points at the shared instance', () => {
    // The exact footgun this whole pass exists for: Prisma migrations resolve
    // directUrl, so a process carrying this config is one prisma invocation away
    // from migrating the shared database.
    expect(() => envSchema.parse({ ...STAGING, DIRECT_URL: SHARED_DIRECT })).toThrow(/DIRECT_URL/);
  });

  it('REFUSES to boot against the dev Redis', () => {
    expect(() => envSchema.parse({ ...STAGING, REDIS_URL: DEV_REDIS })).toThrow(/localhost:6379/);
  });

  it('REFUSES to boot when REDIS_URL is simply absent, instead of falling back to 6379', () => {
    const { REDIS_URL: _omitted, ...withoutRedis } = STAGING;
    expect(() => envSchema.parse(withoutRedis)).toThrow(/REDIS_URL is not set/);
  });

  it('REFUSES to boot when DIRECT_URL is absent', () => {
    const { DIRECT_URL: _omitted, ...withoutDirect } = STAGING;
    expect(() => envSchema.parse(withoutDirect)).toThrow(/DIRECT_URL is not set/);
  });

  it('refuses everything when an allowlist is empty — no host nominated, nothing permitted', () => {
    expect(() => envSchema.parse({ ...STAGING, STAGING_DB_ALLOWLIST: '' })).toThrow(/no host has been nominated/);
    expect(() => envSchema.parse({ ...STAGING, STAGING_REDIS_ALLOWLIST: '' })).toThrow(/no host has been nominated/);
  });

  it('still refuses the shared database even when someone nominates it explicitly', () => {
    // Allowlist and blocklist are deliberately redundant. The allowlist catches
    // typos; this catches deciding to point staging at production on purpose.
    expect(() =>
      envSchema.parse({
        ...STAGING,
        DATABASE_URL: SHARED_DB,
        DIRECT_URL: SHARED_DB,
        STAGING_DB_ALLOWLIST: 'aws-0-ap-south-1.pooler.supabase.com:6543',
      }),
    ).toThrow(/supabase/);
  });

  it('NEVER puts a connection string or password in the failure message', () => {
    try {
      envSchema.parse({ ...STAGING, DATABASE_URL: SHARED_DB });
      throw new Error('expected a validation failure');
    } catch (err) {
      const message = String((err as Error).message);
      expect(message).not.toContain('hunter2');
      expect(message).not.toContain('postgresql://');
      // It must still say enough to diagnose: the host it refused.
      expect(message).toContain('aws-0-ap-south-1.pooler.supabase.com:6543');
    }
  });

  describe('is completely inert outside the disposable staging stack', () => {
    it('leaves ordinary development alone — Supabase URLs, dev Redis, no allowlists', () => {
      // This is the whole point of keying on AIOS_ENV: normal development must
      // not acquire a new configuration requirement.
      expect(() =>
        envSchema.parse({
          ...baseEnv,
          NODE_ENV: 'development',
          DATABASE_URL: SHARED_DB,
          DIRECT_URL: SHARED_DIRECT,
          REDIS_URL: DEV_REDIS,
        }),
      ).not.toThrow();
    });

    it('leaves development with no REDIS_URL at all alone', () => {
      expect(() => envSchema.parse({ ...baseEnv, NODE_ENV: 'development' })).not.toThrow();
    });

    it('leaves production alone — a hosted database is exactly what it should use', () => {
      expect(() =>
        envSchema.parse({
          ...baseEnv,
          NODE_ENV: 'production',
          INTERNAL_SERVICE_TOKEN: 'i'.repeat(32),
          DATABASE_URL: SHARED_DB,
          DIRECT_URL: SHARED_DIRECT,
          REDIS_URL: DEV_REDIS,
        }),
      ).not.toThrow();
    });

    it('stays dormant for NODE_ENV=staging without AIOS_ENV — a hosted staging deployment is not this stack', () => {
      expect(() =>
        envSchema.parse({ ...baseEnv, NODE_ENV: 'staging', DATABASE_URL: SHARED_DB, REDIS_URL: DEV_REDIS }),
      ).not.toThrow();
    });

    it('stays dormant for any AIOS_ENV value that is not exactly "staging"', () => {
      // An unrecognised value must leave the guard asleep rather than refuse to
      // boot, so a typo cannot take down a production deploy.
      for (const value of ['Staging', 'STAGING', 'stage', 'dev', '']) {
        expect(() => envSchema.parse({ ...baseEnv, AIOS_ENV: value, DATABASE_URL: SHARED_DB })).not.toThrow();
      }
    });
  });
});
