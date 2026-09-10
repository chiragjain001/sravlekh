import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UserRole, CaptureProviderType } from '@prisma/client';
import { CaptureProvidersService } from './capture-providers.service';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('CaptureProvidersService', () => {
  let service: CaptureProvidersService;
  let prisma: {
    captureProvider: { create: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let featureFlags: { isEnabled: jest.Mock };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const otherAdmin: AuthenticatedUser = { ...admin, id: 'admin-2', instituteId: 'inst-2' };

  beforeEach(async () => {
    prisma = {
      captureProvider: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    featureFlags = { isEnabled: jest.fn().mockResolvedValue(true) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptureProvidersService,
        { provide: PrismaService, useValue: prisma },
        { provide: FeatureFlagsService, useValue: featureFlags },
      ],
    }).compile();
    service = module.get(CaptureProvidersService);
  });

  it('rejects a cross-tenant create', async () => {
    await expect(
      service.create('inst-1', { type: CaptureProviderType.MANUAL_GRID, config: {} }, otherAdmin),
    ).rejects.toThrow(ForbiddenException);
  });

  describe('config validation (29-CAPTURE-PROVIDER-ARCHITECTURE.md §6)', () => {
    it('MANUAL_GRID requires nothing', async () => {
      prisma.captureProvider.create.mockResolvedValueOnce({ id: 'p1' });
      await expect(
        service.create('inst-1', { type: CaptureProviderType.MANUAL_GRID, config: {} }, admin),
      ).resolves.toBeDefined();
    });

    it('OMR rejects missing answerKeyReference/bubbleSheetTemplateId', async () => {
      await expect(
        service.create('inst-1', { type: CaptureProviderType.OMR, config: {} }, admin),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.captureProvider.create).not.toHaveBeenCalled();
    });

    it('OMR accepts a complete config', async () => {
      prisma.captureProvider.create.mockResolvedValueOnce({ id: 'p1' });
      await expect(
        service.create(
          'inst-1',
          { type: CaptureProviderType.OMR, config: { answerKeyReference: 'ref-1', bubbleSheetTemplateId: 'tpl-1' } },
          admin,
        ),
      ).resolves.toBeDefined();
    });

    it('OMR rejects when the omrCapture feature flag is disabled for the institute (Founder Console Phase 3)', async () => {
      featureFlags.isEnabled.mockResolvedValueOnce(false);
      await expect(
        service.create(
          'inst-1',
          { type: CaptureProviderType.OMR, config: { answerKeyReference: 'ref-1', bubbleSheetTemplateId: 'tpl-1' } },
          admin,
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.captureProvider.create).not.toHaveBeenCalled();
    });

    it('CSV_IMPORT requires expectedColumnMapping', async () => {
      await expect(
        service.create('inst-1', { type: CaptureProviderType.CSV_IMPORT, config: {} }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('PHOTO_CAPTURE_OBJECTIVE requires bubbleSheetTemplateId and expectedOptionCount', async () => {
      await expect(
        service.create('inst-1', { type: CaptureProviderType.PHOTO_CAPTURE_OBJECTIVE, config: { bubbleSheetTemplateId: 'tpl-1' } }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  it('scopes findAll by instituteId', async () => {
    prisma.captureProvider.findMany.mockResolvedValueOnce([]);
    await service.findAll('inst-1', admin);
    expect(prisma.captureProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { instituteId: 'inst-1' } }),
    );
  });
});
