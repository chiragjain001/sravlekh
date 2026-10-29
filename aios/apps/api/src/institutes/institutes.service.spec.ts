import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, InstituteStatus } from '@prisma/client';
import { InstitutesService } from './institutes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('InstitutesService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: InstitutesService;
  let prisma: {
    institute: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    allowListEntry: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; delete: jest.Mock; count: jest.Mock };
    captureProvider: { create: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
    evaluationPolicy: { create: jest.Mock; findFirst: jest.Mock; count: jest.Mock };
    user: { count: jest.Mock };
    teacherProfile: { count: jest.Mock };
    studentProfile: { count: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const adminInst1: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const founder: AuthenticatedUser = { ...adminInst1, id: 'founder-1', role: UserRole.FOUNDER };

  beforeEach(async () => {
    prisma = {
      institute: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      allowListEntry: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), delete: jest.fn(), count: jest.fn() },
      captureProvider: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      evaluationPolicy: { create: jest.fn(), findFirst: jest.fn(), count: jest.fn() },
      user: { count: jest.fn() },
      teacherProfile: { count: jest.fn() },
      studentProfile: { count: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstitutesService,
        { provide: PrismaService, useValue: prisma },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
      ],
    }).compile();
    service = module.get(InstitutesService);
  });

  describe('findById', () => {
    it("rejects an admin reading a different institute's record", async () => {
      await expect(service.findById('inst-OTHER', adminInst1)).rejects.toThrow(ForbiddenException);
      expect(prisma.institute.findUnique).not.toHaveBeenCalled();
    });

    it('allows a founder to read any institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-OTHER', name: 'Other' });
      await expect(service.findById('inst-OTHER', founder)).resolves.toBeDefined();
    });

    it('404s for a genuinely nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('inst-1', adminInst1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addAllowListEntry', () => {
    it("rejects an admin adding an allow-list entry to a different institute", async () => {
      await expect(
        service.addAllowListEntry('inst-OTHER', { email: 'x@y.com', role: 'STUDENT' }, adminInst1),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.allowListEntry.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate email within the same institute', async () => {
      prisma.allowListEntry.findUnique.mockResolvedValueOnce({ id: 'entry-1' });
      await expect(
        service.addAllowListEntry('inst-1', { email: 'x@y.com', role: 'STUDENT' }, adminInst1),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('removeAllowListEntry', () => {
    it("rejects removing an entry that belongs to a different institute, even if the entry ID is guessed correctly", async () => {
      prisma.allowListEntry.findUnique.mockResolvedValueOnce({ id: 'entry-1', instituteId: 'inst-OTHER', email: 'x@y.com' });
      await expect(service.removeAllowListEntry('inst-1', 'entry-1', adminInst1)).rejects.toThrow(NotFoundException);
      expect(prisma.allowListEntry.delete).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it("rejects an admin updating a different institute's settings", async () => {
      await expect(service.update('inst-OTHER', { name: 'Hacked' }, adminInst1)).rejects.toThrow(ForbiddenException);
      expect(prisma.institute.update).not.toHaveBeenCalled();
    });
  });

  describe('create (BUG-04 Onboarding Deadlock fix)', () => {
    it('creates institute and transactionally provisions default CaptureProvider and EvaluationPolicy', async () => {
      prisma.institute.create.mockResolvedValueOnce({
        id: 'inst-new',
        name: 'Springfield Academy',
      });
      prisma.captureProvider.create.mockResolvedValueOnce({ id: 'cp-1' });
      prisma.evaluationPolicy.create.mockResolvedValueOnce({ id: 'ep-1' });
      prisma.auditLog.create.mockResolvedValueOnce({ id: 'audit-1' });

      const result = await service.create(
        { name: 'Springfield Academy' } as any,
        founder,
      );

      expect(result).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.institute.create).toHaveBeenCalled();
      expect(prisma.captureProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId: 'inst-new',
          }),
        }),
      );
      expect(prisma.evaluationPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            instituteId: 'inst-new',
            requiresHumanReview: true,
          }),
        }),
      );
    });
  });

  describe('ensureDefaultConfigurations', () => {
    it('creates default provider and policy if missing', async () => {
      prisma.captureProvider.findFirst.mockResolvedValueOnce(null);
      prisma.evaluationPolicy.findFirst.mockResolvedValueOnce(null);

      await service.ensureDefaultConfigurations('inst-1');

      expect(prisma.captureProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ instituteId: 'inst-1' }),
        }),
      );
      expect(prisma.evaluationPolicy.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ instituteId: 'inst-1' }),
        }),
      );
    });

    it('is idempotent and does not recreate if already existing', async () => {
      prisma.captureProvider.findFirst.mockResolvedValueOnce({ id: 'cp-existing' });
      prisma.evaluationPolicy.findFirst.mockResolvedValueOnce({ id: 'ep-existing' });

      await service.ensureDefaultConfigurations('inst-1');

      expect(prisma.captureProvider.create).not.toHaveBeenCalled();
      expect(prisma.evaluationPolicy.create).not.toHaveBeenCalled();
    });
  });

  describe('getOnboardingStatus', () => {
    it('rejects an admin reading onboarding status for another institute', async () => {
      await expect(service.getOnboardingStatus('inst-OTHER', adminInst1)).rejects.toThrow(ForbiddenException);
    });

    it('404s when institute does not exist', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.getOnboardingStatus('inst-1', adminInst1)).rejects.toThrow(NotFoundException);
    });

    it('evaluates readiness and marks isReadyForPilot: true when all prerequisites are met', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1',
        name: 'Delhi Public School',
        shortCode: 'DPS',
        status: InstituteStatus.ONBOARDING,
        domainAllowlist: ['@dps.edu.in'],
        branches: [{ id: 'b-1', name: 'Main Campus' }],
        batches: [{ id: 'batch-1', name: 'Class 10A' }],
        subjects: [{ id: 'sub-1', name: 'Physics' }],
      });

      prisma.allowListEntry.count.mockResolvedValueOnce(1);
      prisma.user.count
        .mockResolvedValueOnce(2) // active teachers
        .mockResolvedValueOnce(30); // active students
      prisma.teacherProfile.count.mockResolvedValueOnce(2); // assigned teachers
      prisma.studentProfile.count.mockResolvedValueOnce(30); // guardian contacts
      prisma.captureProvider.count.mockResolvedValueOnce(1);
      prisma.evaluationPolicy.count.mockResolvedValueOnce(1);

      const status = await service.getOnboardingStatus('inst-1', adminInst1);

      expect(status.isReadyForPilot).toBe(true);
      expect(status.completionPercentage).toBe(100);
      expect(status.checklist).toHaveLength(7);
      expect(status.checklist.every((c: any) => c.status === 'COMPLETE')).toBe(true);
      expect(status.metrics.students).toBe(30);
    });

    it('marks isReadyForPilot: false when essential prerequisites are missing', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1',
        name: 'Incomplete Coaching',
        shortCode: null,
        status: InstituteStatus.ONBOARDING,
        domainAllowlist: [],
        branches: [],
        batches: [],
        subjects: [],
      });

      prisma.allowListEntry.count.mockResolvedValueOnce(0);
      prisma.user.count
        .mockResolvedValueOnce(0) // teachers
        .mockResolvedValueOnce(0); // students
      prisma.teacherProfile.count.mockResolvedValueOnce(0);
      prisma.studentProfile.count.mockResolvedValueOnce(0);
      prisma.captureProvider.count.mockResolvedValueOnce(0);
      prisma.evaluationPolicy.count.mockResolvedValueOnce(0);

      const status = await service.getOnboardingStatus('inst-1', adminInst1);

      expect(status.isReadyForPilot).toBe(false);
      expect(status.completionPercentage).toBeLessThan(50);
      expect(status.checklist.some((c: any) => c.status === 'INCOMPLETE')).toBe(true);
    });
  });

  describe('activateInstitute', () => {
    it('rejects activation if caller belongs to another institute', async () => {
      await expect(service.activateInstitute('inst-OTHER', adminInst1)).rejects.toThrow(ForbiddenException);
    });

    it('rejects activating a suspended institute via standard activate route', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1',
        status: InstituteStatus.SUSPENDED,
      });

      await expect(service.activateInstitute('inst-1', adminInst1)).rejects.toThrow(ConflictException);
    });

    it('activates an onboarding institute and writes audit log', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1',
        status: InstituteStatus.ONBOARDING,
      });
      prisma.institute.update.mockResolvedValueOnce({
        id: 'inst-1',
        status: InstituteStatus.ACTIVE,
      });

      const res = await service.activateInstitute('inst-1', adminInst1);

      expect(res.success).toBe(true);
      expect(prisma.institute.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { status: InstituteStatus.ACTIVE },
      });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
