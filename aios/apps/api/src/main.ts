import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyHelmet from '@fastify/helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { RUN_WORKERS } from './infrastructure/queue/queue-policy';
import { beginShutdown } from './shared/lifecycle';
import { resolveTrustProxy } from './config/proxy-trust';

/**
 * How long to keep serving after SIGTERM before closing, so the load balancer
 * can observe /health/ready returning 503 and take this instance out of
 * rotation. Must exceed the readiness probe interval; 5s suits a typical 2-3s
 * probe. Set SHUTDOWN_DRAIN_MS=0 in local dev for an instant exit.
 *
 * The platform's own termination grace period must be LONGER than this plus the
 * time in-flight requests need, or the orchestrator SIGKILLs mid-drain and the
 * draining accomplishes nothing.
 */
const SHUTDOWN_DRAIN_MS = Number(process.env['SHUTDOWN_DRAIN_MS'] ?? 5000);

// 12-LOGGING-MONITORING.md §1: Sentry for error tracking. Same "optional, warn,
// degrade" pattern as Redis/S3/INTERNAL_SERVICE_TOKEN elsewhere — SENTRY_DSN is
// optional in env.schema.ts, and without it this is a silent no-op rather than
// a startup failure. Initialized before NestFactory.create() so it can capture
// errors during module bootstrap itself, not just request-handling.
if (process.env['SENTRY_DSN']) {
  Sentry.init({
    dsn: process.env['SENTRY_DSN'],
    environment: process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.1,
  });
}

async function bootstrap() {
  const trustProxy = resolveTrustProxy(
    process.env['TRUST_PROXY'],
    process.env['NODE_ENV'],
  );

  const adapter = new FastifyAdapter({
    bodyLimit: 35 * 1024 * 1024,
    trustProxy,
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  Logger.log(
    `Fastify reverse proxy trust initialized: ${JSON.stringify(trustProxy)}`,
    'Bootstrap',
  );

  // Security headers via @fastify/helmet
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
  });

  // Cookies via @fastify/cookie
  await app.register(fastifyCookie as any);

  // Multipart uploads via @fastify/multipart
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: 30 * 1024 * 1024,
    },
  });

  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const port = configService.get<number>('PORT', 4000);

  // CORS — restrict to frontend origin in production
  app.enableCors({
    origin:
      nodeEnv === 'production'
        ? configService.get<string>('FRONTEND_URL', 'https://aios.app')
        : ['http://localhost:3000'],
    credentials: true,
  });

  // Global validation pipe — strips unknown fields, whitelist-validates DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Field-level details per 08-ERROR-HANDLING.md's validation-error contract.
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'One or more fields are invalid.',
          fields: errors.map((e) => ({
            field: e.property,
            reason: Object.values(e.constraints ?? {}).join(', '),
          })),
        }),
    }),
  );

  // API prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Swagger (only in non-production)
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('AIOS API')
      .setDescription('Academic Intelligence Operating System — REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown.
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  const shutdown = async (signal: string) => {
    // Flip readiness to 503 FIRST, then wait, then close.
    console.log(`${signal} received — failing readiness, draining, then exiting.`);
    beginShutdown();
    await new Promise((resolve) => setTimeout(resolve, SHUTDOWN_DRAIN_MS));

    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  const mode = RUN_WORKERS
    ? 'API + workers (single process — set RUN_WORKERS=false when a dedicated worker runs)'
    : 'API only (RUN_WORKERS=false — jobs are consumed by the worker process)';
  console.log(`AIOS Fastify API running on port ${port} [${nodeEnv}] — ${mode}`);
}

void bootstrap();
