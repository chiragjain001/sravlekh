import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';
import { beginShutdown, isShuttingDown, resetShutdownStateForTests } from '../shared/lifecycle';

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
    resetShutdownStateForTests();
  });

  afterEach(() => resetShutdownStateForTests());

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

  // ── Liveness vs readiness (14-DEPLOYMENT-ARCHITECTURE.md) ─────────────────
  //
  // The split exists because an orchestrator RESTARTS on a failed liveness probe
  // but only STOPS ROUTING on a failed readiness probe. A liveness probe that
  // touches the database turns a database outage into a cluster-wide crash loop:
  // every pod is killed, none can start, and a recoverable dependency failure
  // becomes a total outage that outlives it.

  describe('GET /health/live', () => {
    it('reports alive without touching any dependency', () => {
      const result = controller.live();

      expect(result.status).toBe('alive');
      // The assertion that matters: liveness must not consult the database or
      // Redis at all. If either is ever called from here, a dependency outage
      // starts killing healthy processes.
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(pingMock).not.toHaveBeenCalled();
    });

    it('still reports alive when the database is down', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

      expect(controller.live().status).toBe('alive');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('is ready when the DB responds', async () => {
      prisma.$queryRaw.mockResolvedValueOnce(undefined);
      const res = mockResponse();

      const result = await controller.ready(res);

      expect(result).toEqual({ status: 'ready', db: 'up', redis: 'up' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('is NOT ready (503) when the DB is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const res = mockResponse();

      const result = await controller.ready(res);

      expect(result.status).toBe('not_ready');
      expect(result.db).toBe('down');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });

    it('stays ready when only Redis is down, reporting it as degraded', async () => {
      // 09-CACHING-STRATEGY.md fail-open. Making Redis fatal would pull every
      // instance out of the load balancer during a Redis blip and take down an
      // API that could still serve almost every request.
      prisma.$queryRaw.mockResolvedValueOnce(undefined);
      pingMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const res = mockResponse();

      const result = await controller.ready(res);

      expect(result).toEqual({ status: 'ready', db: 'up', redis: 'degraded' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('reports 503 draining as soon as shutdown begins, before any dependency check', async () => {
      // The deploy-time behaviour this exists for: main.ts flips the flag on
      // SIGTERM and keeps serving, so the balancer sees 503 and stops sending new
      // work while in-flight requests finish. Asserting the DB is never queried
      // proves the drain answer does not depend on a dependency that may itself
      // be going away.
      beginShutdown();
      const res = mockResponse();

      const result = await controller.ready(res);

      expect(result.status).toBe('draining');
      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('liveness keeps succeeding while readiness drains', async () => {
      // Both halves of the contract at once: a draining process must stay ALIVE
      // (or the orchestrator kills it mid-drain and in-flight requests die) while
      // reporting NOT READY (or the balancer keeps sending it new work).
      beginShutdown();
      const res = mockResponse();

      expect(controller.live().status).toBe('alive');
      expect((await controller.ready(res)).status).toBe('draining');
    });
  });

  describe('shutdown flag', () => {
    it('is one-way — there is no cancel', () => {
      expect(isShuttingDown()).toBe(false);
      beginShutdown();
      expect(isShuttingDown()).toBe(true);
      beginShutdown();
      expect(isShuttingDown()).toBe(true);
    });
  });

  describe('raceTimeout timer cleanup', () => {
    it('leaves no pending timer behind after a successful check', async () => {
      // The leak this fixes: the timeout timer was never cleared, so every probe
      // left up to three pending 2s timers holding the event loop open. Harmless
      // in aggregate, but it delayed process exit on every deploy.
      prisma.$queryRaw.mockResolvedValueOnce(undefined);
      const before = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;

      await controller.ready(mockResponse());

      const after = process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
      expect(after).toBeLessThanOrEqual(before);
    });
  });
});
