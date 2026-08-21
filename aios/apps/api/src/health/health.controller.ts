import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

/**
 * GET /health — 14-DEPLOYMENT-ARCHITECTURE.md: orchestrator withholds traffic
 * until this reports healthy; checks DB connectivity (Redis will be added once
 * a Redis client exists in this service — see docs/33 gap analysis).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'up' };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error', db: 'down' };
    }
  }
}
