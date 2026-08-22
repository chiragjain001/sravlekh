import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { InstitutesService } from './institutes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('InstitutesService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: InstitutesService;
  let prisma: {
    institute: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    allowListEntry: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const adminInst1: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const founder: AuthenticatedUser = { ...adminInst1, id: 'founder-1', role: UserRole.FOUNDER };

  beforeEach(async () => {
    prisma = {
      institute: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      allowListEntry: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
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
});
