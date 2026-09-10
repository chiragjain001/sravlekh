import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';

/**
 * GET /health — 14-DEPLOYMENT-ARCHITECTURE.md: orchestrator withholds traffic until
 * this reports healthy. DB is required-healthy (503 if down); per 09-CACHING-STRATEGY.md
 * Redis is fail-open (its own unavailability doesn't take down the API), so a down Redis
 * is reported but doesn't flip the overall status to unhealthy.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(MASTERY_RECALC_QUEUE) private readonly masteryRecalcQueue: Queue,
  ) {}

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
      await this.prisma.$queryRaw`SELECT 1`;
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

  private raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
    ]);
  }
}
