import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    controller = module.get(HealthController);
  });

  function mockResponse() {
    return { status: jest.fn() } as unknown as Response;
  }

  it('reports healthy when the DB responds', async () => {
    prisma.$queryRaw.mockResolvedValueOnce(undefined);
    const res = mockResponse();

    const result = await controller.check(res);

    expect(result).toEqual({ status: 'ok', db: 'up' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('reports 503 when the DB is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
    const res = mockResponse();

    const result = await controller.check(res);

    expect(result).toEqual({ status: 'error', db: 'down' });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
