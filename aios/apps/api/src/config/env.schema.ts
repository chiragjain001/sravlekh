import { z } from 'zod';
import { checkPostgresTarget, checkRedisTarget } from './staging-targets';

/**
 * Zod schema for all required environment variables.
 * The app will throw at startup if any required variable is missing or wrong type.
 * This prevents silent misconfiguration in production.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'staging', 'production'])
      .default('development'),
    PORT: z.coerce.number().default(4000),

    // DEV-ONLY credential-less mock login (06-AUTH-AUTHORIZATION.md §1).
    //
    // This gate is deliberately an explicit opt-in rather than only a NODE_ENV
    // check, because a NODE_ENV check alone fails OPEN: an unset, misspelled, or
    // container-default NODE_ENV is !== 'production', which silently leaves
    // POST /auth/dev-login reachable — an endpoint that mints a real JWT for any
    // requested role with no credentials at all. Requiring this flag means the
    // failure mode of any misconfiguration is "dev login unavailable", never
    // "anyone can become FOUNDER". The superRefine below additionally refuses to
    // boot if this is ever true while NODE_ENV=production.
    //
    // Deliberately NOT z.coerce.boolean(): Boolean('false') === true in JS, so
    // coercion would read the reassuring ENABLE_DEV_LOGIN=false as ENABLED.
    ENABLE_DEV_LOGIN: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),

    // Database
    DATABASE_URL: z.string().url(),

    // Prisma MIGRATIONS resolve directUrl, not url (packages/db/schema.prisma).
    // Declared here so the staging guard below can see it: a staging process
    // whose DATABASE_URL was redirected while DIRECT_URL still points at the
    // shared instance is exactly the footgun infra/staging/migrate-staging.js
    // exists to catch, and any Prisma tooling run from inside this process would
    // inherit it. Optional, because the running app itself only reads url.
    DIRECT_URL: z.string().optional(),

    // Prisma connection-pool size per process. Unset means Prisma's default of
    // `num_cpus * 2 + 1`, derived from the container's CPU count — see
    // prisma.service.ts's poolLimitOptions for why that default becomes a
    // problem the first time the API is scaled horizontally. Size it against
    // replica count and the database's max_connections.
    DATABASE_POOL_LIMIT: z.coerce.number().int().positive().optional(),

    // Google OAuth
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),

    // JWT session signing
    JWT_SECRET: z.string().min(32),

    // Global throttle limits (07-SECURITY-SPECIFICATION.md §7). Configurable
    // rather than hardcoded for two reasons found while load-testing: the
    // numbers cannot be tuned in production without a redeploy, and a load test
    // measuring real capacity has no way to get past them — the first run of
    // read-path-baseline.js measured the throttler rather than the application,
    // with 90% of requests correctly rejected as 429.
    //
    // Defaults are the previously hardcoded values, so behaviour is unchanged
    // unless an operator opts in. Tracking is PER USER on authenticated routes
    // (UserThrottlerGuard) and per IP only on public ones, so these are a single
    // person's budget, not a whole institute's behind one NAT.
    THROTTLE_SHORT_LIMIT: z.coerce.number().int().positive().default(10),
    THROTTLE_SHORT_TTL_MS: z.coerce.number().int().positive().default(1000),
    THROTTLE_MEDIUM_LIMIT: z.coerce.number().int().positive().default(100),
    THROTTLE_MEDIUM_TTL_MS: z.coerce.number().int().positive().default(60_000),
    // The ACCESS token's lifetime. Shortened from 7d to 15m when refresh tokens
    // landed: a 7-day access token in localStorage is a credential an XSS can
    // steal and use for a week, and User.tokenVersion was the only revocation —
    // which logs the user out of every device at once and so never gets used.
    // Sessions are no longer shorter as a result; REFRESH_TOKEN_TTL_DAYS (30d)
    // now carries session length, and the client refreshes transparently.
    //
    // DEPLOYMENT COUPLING, stated plainly: an API on this default served to a
    // frontend that predates the refresh work will log users out every 15
    // minutes, because that client does not know to call /auth/refresh. Deploy
    // both together, or set JWT_EXPIRES_IN=7d until the frontend ships.
    JWT_EXPIRES_IN: z.string().default('15m'),

    // Frontend URL (for CORS)
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),

    // File storage
    S3_BUCKET: z.string().optional(),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_REGION: z.string().optional(),

    // Background jobs
    //
    // Optional by design: queue.module.ts and cache.service.ts fall back to
    // redis://localhost:6379 and degrade gracefully (09-CACHING-STRATEGY.md).
    // That default is right for development and WRONG for staging, where it
    // silently attaches a staging process to the developer's dev Redis behind a
    // log warning nobody reads — so the AIOS_ENV=staging guard below makes it
    // required there, and nowhere else.
    REDIS_URL: z.string().optional(),

    // AI
    OPENAI_API_KEY: z.string().optional(),

    // Internal NestJS -> FastAPI service contract (02-SYSTEM-ARCHITECTURE.md).
    // Optional here so local dev keeps working, but REQUIRED in production by the
    // superRefine below. Unset means the Python service accepts ANY caller: staging
    // verification found it unset in both services, so the guard had never once run.
    PYTHON_SERVICE_URL: z.string().url().default('http://localhost:8000'),
    INTERNAL_SERVICE_TOKEN: z.string().optional(),

    // ── Disposable local staging stack ────────────────────────────────────
    //
    // AIOS_ENV is NOT NODE_ENV. NODE_ENV=staging is a legitimate value for a
    // hosted staging deployment against a hosted database; AIOS_ENV=staging
    // means one specific thing in this repo — the loopback, RAM-backed
    // containers in infra/staging/docker-compose.yml — and is set only by that
    // stack's launcher. Keying the guard on it leaves every ordinary
    // development and production boot completely untouched.
    //
    // Typed as a plain string, not an enum: an unrecognised value must leave the
    // guard dormant rather than refuse to boot. Only exactly "staging" arms it.
    AIOS_ENV: z.string().optional(),
    STAGING_DB_ALLOWLIST: z.string().optional(),
    STAGING_REDIS_ALLOWLIST: z.string().optional(),

    // Monitoring
    SENTRY_DSN: z.string().url().optional(),

    // Notifications
    SENDGRID_API_KEY: z.string().optional(),
    WHATSAPP_API_TOKEN: z.string().optional(),
    SMS_GATEWAY_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // Refuse to boot rather than serve a credential-less login endpoint in
    // production. A crash-on-start is a far better outcome than a running
    // production API where POST /auth/dev-login {"role":"FOUNDER"} works.
    if (env.NODE_ENV === 'production' && env.ENABLE_DEV_LOGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ENABLE_DEV_LOGIN'],
        message:
          'ENABLE_DEV_LOGIN must not be true when NODE_ENV=production — it exposes a ' +
          'credential-less login endpoint that mints tokens for any role. Refusing to start.',
      });
    }

    // Fail closed on the service-to-service credential. Without it the Python
    // service's verify_internal_token is a no-op, so /evaluation/ai-evaluate and
    // /ocr/extract accept any caller that can reach the port — with no user JWT
    // involved, because these endpoints are internal-only by design.
    //
    // Length is bounded for the same reason as JWT_SECRET: a short token is a
    // guessable one, and this credential is the only thing standing between the
    // AI service and the open network.
    const MIN_INTERNAL_TOKEN_LENGTH = 32;
    if (env.NODE_ENV === 'production') {
      if (!env.INTERNAL_SERVICE_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['INTERNAL_SERVICE_TOKEN'],
          message:
            'INTERNAL_SERVICE_TOKEN is required when NODE_ENV=production — without it the ' +
            'Python AI service authenticates nobody and will serve any caller that can reach ' +
            'it. Refusing to start. Use a different value per environment.',
        });
      } else if (env.INTERNAL_SERVICE_TOKEN.length < MIN_INTERNAL_TOKEN_LENGTH) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['INTERNAL_SERVICE_TOKEN'],
          message:
            `INTERNAL_SERVICE_TOKEN must be at least ${MIN_INTERNAL_TOKEN_LENGTH} characters in ` +
            'production. Refusing to start.',
        });
      }
    }

    // ── Staging target guard: refuse to boot against an unnominated host ──
    //
    // WHY THIS EXISTS: staging isolation was a launch procedure you had to
    // remember. apps/api/.env points DATABASE_URL and DIRECT_URL at the shared
    // Supabase instance and REDIS_URL at the developer's dev Redis, and process
    // env is what overrides them — so a staging process launched without the
    // full set of overrides came up silently attached to shared infrastructure
    // and looked completely normal. The failure had no symptom.
    //
    // This turns that into a boot failure. A staging process that did not get
    // every target it was supposed to get does not run at all, so "did the
    // overrides take effect?" stops being a question anyone has to ask.
    //
    // Note it checks the RESOLVED config — the same object ConfigService hands
    // to PrismaService, CacheService and BullMQ — not an env file. Reading a
    // file would only prove what somebody intended.
    //
    // Inert unless AIOS_ENV is exactly "staging" (see the field above), so
    // development and production boots are unaffected. A hosted staging
    // deployment that wants this protection must nominate its own hosts in the
    // allowlists; that is deliberate, not an oversight.
    if (env.AIOS_ENV === 'staging') {
      const checks = {
        DATABASE_URL: checkPostgresTarget('DATABASE_URL', env.DATABASE_URL, env.STAGING_DB_ALLOWLIST),
        // Required in staging even though the running app never reads it: it is
        // the variable Prisma migrations resolve, and a process carrying a
        // shared-instance DIRECT_URL is one `prisma` invocation away from
        // migrating the shared database.
        DIRECT_URL: checkPostgresTarget('DIRECT_URL', env.DIRECT_URL, env.STAGING_DB_ALLOWLIST),
        REDIS_URL: checkRedisTarget('REDIS_URL', env.REDIS_URL, env.STAGING_REDIS_ALLOWLIST),
      };

      for (const [variable, result] of Object.entries(checks)) {
        if (result.ok) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [variable],
          // result.reason carries host:port only — never a connection URL, which
          // would put a password into whatever log catches a failed boot.
          message:
            `AIOS_ENV=staging: ${result.reason} Refusing to start — a staging process must not ` +
            'run against shared infrastructure.',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;
