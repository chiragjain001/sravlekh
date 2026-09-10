import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';
import { isShuttingDown } from '../shared/lifecycle';

/**
 * Health endpoints, split by the question each one actually answers.
 *
 *   GET /health/live    "Is this process alive?"            — no dependencies
 *   GET /health/ready   "Should traffic be sent here?"      — dependencies
 *   GET /health         legacy combined check               — unchanged
 *
 * WHY THE SPLIT MATTERS (14-DEPLOYMENT-ARCHITECTURE.md): an orchestrator
 * RESTARTS a container that fails liveness and merely STOPS ROUTING to one that
 * fails readiness. Pointing a liveness probe at a check that touches the
 * database turns a database outage into a cluster-wide crash loop — every pod
 * gets killed, none can start, and the recoverable dependency failure becomes a
 * total outage that outlives it. Liveness therefore deliberately checks
 * NOTHING external.
 *
 * `/health` is kept exactly as it was. Nothing in this repo consumes it (the
 * Founder console uses `/founder/health`), but an existing deployment's probe
 * may, and silently changing what a probe returns is how a green deploy starts
 * failing at 3am.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MASTERY_RECALC_QUEUE) private readonly masteryRecalcQueue: Queue,
  ) {}

  /**
   * Liveness. Answers only "is this process running and able to respond".
   *
   * Intentionally has no dependency checks and does no I/O: if this handler
   * returns at all, the event loop is turning and the process is worth keeping.
   * The only thing that should make it fail is the process being wedged, which
   * manifests as a probe timeout rather than a 503.
   */
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness — process is running. Checks no dependencies by design.' })
  live() {
    return { status: 'alive', uptimeSeconds: Math.round(process.uptime()) };
  }

  /**
   * Readiness. Answers "can this instance serve a request right now".
   *
   * Returns 503 in two cases:
   *  - the database is unreachable — nothing meaningful can be served without it;
   *  - the process is shutting down — see below, this is the important one.
   *
   * SHUTDOWN DRAINING: on SIGTERM, main.ts flips the shared lifecycle flag
   * BEFORE it begins closing the app. This endpoint then reports 503 while the
   * server is still accepting and completing requests, so the load balancer
   * removes this instance and stops sending new work while in-flight work
   * finishes. Without it, a rolling deploy keeps routing to a process that is
   * actively tearing down, and those requests fail — the exact class of
   * deploy-time error the graceful-shutdown work exists to remove.
   *
   * REDIS IS NOT FATAL HERE, matching `/health` and 09-CACHING-STRATEGY.md's
   * fail-open rule: caching degrades gracefully, and enqueue paths fail fast
   * rather than hanging. Making Redis fatal would pull every instance out of the
   * load balancer during a Redis blip and take down an API that could still
   * serve almost every request. It is reported so the condition is visible.
   */
  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness — safe to route traffic here. 503 while draining or if the DB is down.' })
  async ready(@Res({ passthrough: true }) res: Response) {
    if (isShuttingDown()) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'draining', db: 'unknown', redis: 'unknown' };
    }

    const [dbUp, redisUp] = await Promise.all([this.checkDb(), this.checkRedis()]);

    if (!dbUp) res.status(HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: dbUp ? 'ready' : 'not_ready',
      db: dbUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'degraded',
    };
  }

  /**
   * Legacy combined check. Unchanged behaviour and unchanged response shape —
   * see this class's header for why it is kept rather than redirected.
   */
  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const [dbUp, redisUp] = await Promise.all([this.checkDb(), this.checkRedis()]);

    if (!dbUp) res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return {
      status: dbUp ? 'ok' : 'error',
      db: dbUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'down',
    };
  }

  private async checkDb(): Promise<boolean> {
    try {
      // Bounded like the Redis check below. An unresponsive database can accept
      // a connection and never answer, which would otherwise hang the probe
      // until the orchestrator's own timeout — reported as a timeout rather than
      // as "db: down", with no diagnostic.
      await this.raceTimeout(this.prisma.$queryRaw`SELECT 1`, 2000);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      // Queue.client is typed as a narrower IRedisClient by bullmq, but the underlying
      // connection is always the ioredis instance QueueModule constructed.
      //
      // Queue.client only resolves once the connection is "ready" — with
      // QueueModule's infinite exponential-backoff retry, an unreachable
      // Redis means it never settles. Without racing a timeout here this
      // whole health check (and every caller polling it for liveness) would
      // hang instead of correctly reporting redis: 'down'.
      const client = (await this.raceTimeout(this.masteryRecalcQueue.client, 2000)) as unknown as Redis;
      const pong = await this.raceTimeout(client.ping(), 2000);
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Races a promise against a timeout, and ALWAYS clears the timer.
   *
   * The previous version never cleared it. Each probe left up to three pending
   * 2-second timers behind — harmless in aggregate, since they expire on their
   * own, but they also keep the event loop alive: during shutdown the process
   * could not exit until the last one fired. With a readiness probe every few
   * seconds that is a small, permanent tax and an avoidable delay on every
   * deploy. `finally` runs on both paths, so the timer is cleared whether the
   * work wins or the timeout does.
   */
  private raceTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    }) as Promise<T>;
  }
}
