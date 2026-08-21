import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.processor';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };
  let queue: { client: Promise<{ ping: jest.Mock }> };
  let pingMock: jest.Mock;

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    pingMock = jest.fn().mockResolvedValue('PONG');
    queue = { client: Promise.resolve({ ping: pingMock }) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(MASTERY_RECALC_QUEUE), useValue: queue },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  function mockResponse() {
    return { status: jest.fn() } as unknown as Response;
  }

  it('reports healthy when the DB and Redis both respond', async () => {
    prisma.$queryRaw.mockResolvedValueOnce(undefined);
    const res = mockResponse();

    const result = await controller.check(res);

    expect(result).toEqual({ status: 'ok', db: 'up', redis: 'up' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('reports 503 when the DB is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = mockResponse();

    const result = await controller.check(res);

    expect(result).toEqual({ status: 'error', db: 'down', redis: 'up' });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('reports Redis down without failing the overall health check (fail-open, 09-CACHING-STRATEGY.md)', async () => {
    prisma.$queryRaw.mockResolvedValueOnce(undefined);
    pingMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const res = mockResponse();

    const result = await controller.check(res);

    expect(result).toEqual({ status: 'ok', db: 'up', redis: 'down' });
    expect(res.status).not.toHaveBeenCalled();
  });
});
