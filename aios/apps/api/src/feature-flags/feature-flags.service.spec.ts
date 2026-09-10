import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let prisma: { institute: { findUnique: jest.Mock }; planDefinition: { findUnique: jest.Mock } };
  let cache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };

  beforeEach(async () => {
    prisma = { institute: { findUnique: jest.fn() }, planDefinition: { findUnique: jest.fn() } };
    cache = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: cache },
      ],
    }).compile();
    service = module.get(FeatureFlagsService);
  });

  it('returns the cached value without touching Prisma when present', async () => {
    cache.get.mockResolvedValueOnce(true);
    const result = await service.isEnabled('inst-1', 'omrCapture');
    expect(result).toBe(true);
    expect(prisma.institute.findUnique).not.toHaveBeenCalled();
  });

  it('returns false for a nonexistent institute, without crashing', async () => {
    cache.get.mockResolvedValueOnce(undefined);
    prisma.institute.findUnique.mockResolvedValueOnce(null);
    const result = await service.isEnabled('inst-x', 'omrCapture');
    expect(result).toBe(false);
  });

  it('prefers an explicit per-institute flag over the plan default', async () => {
    cache.get.mockResolvedValueOnce(undefined);
    prisma.institute.findUnique.mockResolvedValueOnce({ plan: 'BASIC', featureFlags: { omrCapture: true } });
    const result = await service.isEnabled('inst-1', 'omrCapture');
    expect(result).toBe(true);
    expect(prisma.planDefinition.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to the plan default when no explicit flag is set', async () => {
    cache.get.mockResolvedValueOnce(undefined);
    prisma.institute.findUnique.mockResolvedValueOnce({ plan: 'ENTERPRISE', featureFlags: {} });
    prisma.planDefinition.findUnique.mockResolvedValueOnce({ plan: 'ENTERPRISE', defaultFeatureFlags: { aiEvaluation: true } });
    const result = await service.isEnabled('inst-1', 'aiEvaluation');
    expect(result).toBe(true);
  });

  it('defaults to disabled when neither an explicit flag nor a plan default exists', async () => {
    cache.get.mockResolvedValueOnce(undefined);
    prisma.institute.findUnique.mockResolvedValueOnce({ plan: 'TRIAL', featureFlags: {} });
    prisma.planDefinition.findUnique.mockResolvedValueOnce(null);
    const result = await service.isEnabled('inst-1', 'documentProcessing');
    expect(result).toBe(false);
  });

  it('caches the resolved value', async () => {
    cache.get.mockResolvedValueOnce(undefined);
    prisma.institute.findUnique.mockResolvedValueOnce({ plan: 'BASIC', featureFlags: { omrCapture: false } });
    await service.isEnabled('inst-1', 'omrCapture');
    expect(cache.set).toHaveBeenCalledWith('feature-flag:inst-1:omrCapture', false, 30);
  });
});
