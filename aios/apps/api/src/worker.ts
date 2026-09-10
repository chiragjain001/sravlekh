import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';

/**
 * Worker entrypoint — the same application, without the HTTP listener.
 *
 * WHY THIS EXISTS: all six BullMQ processors were registered inside the API
 * process, which had the only entrypoint. Background work and user-facing
 * requests therefore shared one event loop and one deployable: an OCR batch
 * competing with a teacher loading a page, with no way to scale, restart or
 * observe either independently. A queue backlog looked like a slow API, and
 * adding API capacity added queue consumers whether you wanted them or not.
 *
 * `createApplicationContext` instantiates every module — so every @Processor is
 * constructed and starts consuming — but never binds a port. Same image, same
 * AppModule, different start command:
 *
 *     node dist/main.js      → API only when WORKER_MODE=off (see main.ts)
 *     node dist/worker.js    → workers only
 *
 * Deliberately NOT a separate NestJS application or a second copy of the queue
 * definitions. Producers and consumers must share one source of job names and
 * payload types; two codebases would let them drift, and a drifted payload
 * fails at run time inside a worker where nobody is watching.
 */
async function bootstrapWorker() {
  if (process.env['SENTRY_DSN']) {
    Sentry.init({
      dsn: process.env['SENTRY_DSN'],
      environment: process.env['NODE_ENV'] ?? 'development',
      tracesSampleRate: 0.1,
    });
  }

  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule, {
    // Workers have no request cycle to attach logs to, so the default logger is
    // the whole observability surface here — keep it verbose enough to diagnose.
    logger: ['error', 'warn', 'log'],
  });

  // Without this a SIGTERM from the platform kills the process mid-job. Closing
  // the context lets BullMQ finish in-flight jobs and release its locks, so a
  // deploy does not leave jobs stalled until their lock expires.
  app.enableShutdownHooks();

  logger.log(
    `AIOS worker started [${process.env['NODE_ENV'] ?? 'development'}] — ` +
      'consuming: ai-evaluation, ocr, score-aggregation, mastery-recalc, notice-dispatch, report-generation',
  );

  const shutdown = async (signal: string) => {
    logger.log(`${signal} received — draining in-flight jobs before exit.`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void bootstrapWorker();
