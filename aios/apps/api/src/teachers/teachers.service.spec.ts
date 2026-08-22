import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('TeachersService — tenant isolation and role gating (13-TESTING-STRATEGY.md §7)', () => {
  let service: TeachersService;
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock };
    teacherProfile: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    batch: { findUnique: jest.Mock };
    batchTeacher: { findFirst: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn() },
      teacherProfile: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      batch: { findUnique: jest.fn() },
      batchTeacher: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn({
        user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }), update: jest.fn() },
        teacherProfile: { create: jest.fn().mockResolvedValue({ id: 'tp-1' }), update: jest.fn() },
      })),
      auditLog: { create: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [TeachersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(TeachersService);
  });

  describe('create — ADMIN only, not TEACHER', () => {
    it('rejects a teacher creating another teacher', async () => {
      await expect(service.create('inst-1', { name: 'B', email: 'b@x.com' }, teacher)).rejects.toThrow(ForbiddenException);
    });

    it("rejects an admin creating a teacher under a different institute's ID", async () => {
      await expect(service.create('inst-OTHER', { name: 'B', email: 'b@x.com' }, admin)).rejects.toThrow(ForbiddenException);
    });

    it('rejects a duplicate email within the institute', async () => {
      prisma.user.findFirst.mockResolvedValueOnce({ id: 'existing' });
      await expect(service.create('inst-1', { name: 'B', email: 'dup@x.com' }, admin)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it("rejects reading a teacher profile whose user belongs to a different institute", async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'user-1' });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', instituteId: 'inst-OTHER' });
      await expect(service.findById('inst-1', 'tp-1', admin)).rejects.toThrow(ForbiddenException);
    });

    it('404s for a nonexistent profile', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('inst-1', 'missing', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignToBatch', () => {
    it('rejects assigning a teacher to a batch from a different institute', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'user-1', user: { id: 'user-1', instituteId: 'inst-1' } });
      prisma.batch.findUnique.mockResolvedValueOnce({ id: 'batch-1', instituteId: 'inst-OTHER' });

      await expect(
        service.assignToBatch('inst-1', 'tp-1', { batchId: 'batch-1' }, admin),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.batchTeacher.create).not.toHaveBeenCalled();
    });

    it('rejects a teacher (non-admin) assigning batches', async () => {
      await expect(service.assignToBatch('inst-1', 'tp-1', { batchId: 'batch-1' }, teacher)).rejects.toThrow(ForbiddenException);
    });
  });
});
