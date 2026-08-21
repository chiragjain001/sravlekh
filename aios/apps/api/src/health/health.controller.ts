import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ApiTags } from '@nestjs/swagger';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.processor';

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
      const client = (await this.masteryRecalcQueue.client) as unknown as Redis;
      const pong = await client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
