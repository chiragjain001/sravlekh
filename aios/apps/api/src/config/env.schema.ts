import { z } from 'zod';

/**
 * Zod schema for all required environment variables.
 * The app will throw at startup if any required variable is missing or wrong type.
 * This prevents silent misconfiguration in production.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(4000),

  // Database
  DATABASE_URL: z.string().url(),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  // JWT session signing
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Frontend URL (for CORS)
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),

  // File storage
  S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),

  // Background jobs
  REDIS_URL: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),

  // Internal NestJS -> FastAPI service contract (02-SYSTEM-ARCHITECTURE.md).
  // INTERNAL_SERVICE_TOKEN unset means unenforced on the Python side too — dev-only
  // fallback, same "optional, warn, degrade" pattern as REDIS_URL/S3_* above.
  PYTHON_SERVICE_URL: z.string().url().default('http://localhost:8000'),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),

  // Monitoring
  SENTRY_DSN: z.string().url().optional(),

  // Notifications
  SENDGRID_API_KEY: z.string().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  SMS_GATEWAY_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
