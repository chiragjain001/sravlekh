import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { InstituteStatus, UserRole } from '@prisma/client';
import axios from 'axios';
import { FounderService } from './founder.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FounderService', () => {
  let service: FounderService;
  let prisma: {
    institute: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
    $queryRaw: jest.Mock;
  };

  const founder: AuthenticatedUser = { id: 'founder-1', email: 'f@x.com', name: 'Founder', role: UserRole.FOUNDER, instituteId: 'inst-none' };

  beforeEach(async () => {
    prisma = {
      institute: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FounderService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
      ],
    }).compile();
    service = module.get(FounderService);
    mockedAxios.get.mockResolvedValue({ status: 200, data: { status: 'healthy' } });
  });

  describe('archiveInstitute (04-DATABASE-SCHEMA.md: never a hard delete)', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.archiveInstitute('inst-x', founder)).rejects.toThrow(NotFoundException);
    });

    it('sets status to ARCHIVED, not a delete, and audits the transition', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ACTIVE });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ARCHIVED });

      const result = await service.archiveInstitute('inst-1', founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { status: InstituteStatus.ARCHIVED } });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(InstituteStatus.ARCHIVED);
    });
  });

  describe('updateFeatureFlag', () => {
    it('merges the new flag into existing flags rather than overwriting them', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', featureFlags: { aiBlueprintAgent: true } });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', featureFlags: { aiBlueprintAgent: true, omrCapture: true } });

      await service.updateFeatureFlag({ instituteId: 'inst-1', flag: 'omrCapture', enabled: true }, founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { featureFlags: { aiBlueprintAgent: true, omrCapture: true } },
      });
    });
  });

  describe('getHealth', () => {
    it('reports postgres up when the query succeeds', async () => {
      const health = await service.getHealth();
      expect(health.postgres.status).toBe('up');
      expect(health.nestjs.status).toBe('up');
    });

    it('reports postgres down when the query throws, without crashing the whole check', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const health = await service.getHealth();
      expect(health.postgres.status).toBe('down');
      expect(health.postgres.latencyMs).toBeNull();
    });
  });
});
