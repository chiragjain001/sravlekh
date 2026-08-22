import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { StudentsService } from './students.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('StudentsService — tenant isolation (13-TESTING-STRATEGY.md §7)', () => {
  let service: StudentsService;
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    studentProfile: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    batch: { findUnique: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      studentProfile: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      batch: { findUnique: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn({
        user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }), update: jest.fn() },
        studentProfile: { create: jest.fn().mockResolvedValue({ id: 'sp-1' }), update: jest.fn() },
        studentHistory: { create: jest.fn() },
      })),
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [StudentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(StudentsService);
  });

  describe('create', () => {
    it("rejects a batchId belonging to a different institute", async () => {
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-OTHER' });
      await expect(
        service.create('inst-1', { name: 'A', email: 'a@b.com', batchId: 'batch-1' }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects an admin creating a student under a different institute's ID", async () => {
      await expect(
        service.create('inst-OTHER', { name: 'A', email: 'a@b.com' }, admin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a duplicate email within the same institute', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(
        service.create('inst-1', { name: 'A', email: 'dup@b.com' }, admin),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects an invalid tag not in the allowed set', async () => {
      await expect(
        service.create('inst-1', { name: 'A', email: 'a@b.com', tags: ['not-a-real-tag'] }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it("rejects reading a student profile whose user belongs to a different institute", async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({ id: 'sp-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', instituteId: 'inst-OTHER' });
      await expect(service.findById('inst-1', 'sp-1', admin)).rejects.toThrow(ForbiddenException);
    });

    it('404s for a nonexistent profile', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('inst-1', 'missing', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('transferBatch', () => {
    it('rejects transferring into a batch from a different institute', async () => {
      prisma.studentProfile.findUnique.mockResolvedValueOnce({
        id: 'sp-1', userId: 'user-1', batchId: 'batch-old', user: { id: 'user-1', instituteId: 'inst-1' },
      });
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-new', instituteId: 'inst-OTHER' });

      await expect(
        service.transferBatch('inst-1', 'sp-1', { targetBatchId: 'batch-new' }, admin),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
