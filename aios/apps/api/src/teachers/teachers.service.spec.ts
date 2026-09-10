import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EntitlementResource } from '../entitlements/plan-definitions';

describe('TeachersService — tenant isolation and role gating (13-TESTING-STRATEGY.md §7)', () => {
  let service: TeachersService;
  let entitlements: { assertCanCreate: jest.Mock; ensurePlanDefinitions: jest.Mock; getSnapshot: jest.Mock };
  let prisma: {
    user: { findFirst: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    teacherProfile: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    batch: { findUnique: jest.Mock };
    batchTeacher: { findFirst: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    subject: { findMany: jest.Mock };
    $transaction: jest.Mock;
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      user: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      teacherProfile: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      batch: { findUnique: jest.fn() },
      batchTeacher: { findFirst: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      subject: { findMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn({
        user: { create: jest.fn().mockResolvedValue({ id: 'user-1' }), update: jest.fn() },
        teacherProfile: { create: jest.fn().mockResolvedValue({ id: 'tp-1' }), update: jest.fn() },
      })),
      auditLog: { create: jest.fn() },
    };
    entitlements = {
      assertCanCreate: jest.fn().mockResolvedValue(undefined),
      ensurePlanDefinitions: jest.fn().mockResolvedValue(undefined),
      getSnapshot: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeachersService,
        { provide: PrismaService, useValue: prisma },
        // Permissive by default — plan-limit behaviour itself lives in
        // entitlements.service.spec.ts; its enforcement at this call site is
        // asserted in the dedicated block at the bottom of this file.
        { provide: EntitlementsService, useValue: entitlements },
      ],
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

  describe('findMyProfile / updateMyProfile — self-service, not admin-gated', () => {
    it('findMyProfile resolves the profile from the caller\'s own userId, not a supplied profileId', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'teacher-1' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'teacher-1' });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'teacher-1', instituteId: 'inst-1' });

      await service.findMyProfile('inst-1', teacher);

      expect(prisma.teacherProfile.findUnique.mock.calls[0]![0]).toEqual({ where: { userId: 'teacher-1' } });
    });

    it('findMyProfile 404s when the caller has no teacher profile yet', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce(null);
      await expect(service.findMyProfile('inst-1', teacher)).rejects.toThrow(NotFoundException);
    });

    it('updateMyProfile updates name/qualification without requiring admin access', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'teacher-1' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'teacher-1' });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'teacher-1', instituteId: 'inst-1' });

      await expect(
        service.updateMyProfile('inst-1', { name: 'New Name', qualification: 'PhD' }, teacher),
      ).resolves.toBeDefined();
    });

    it('updateMyProfile cannot be used to edit another teacher\'s profile — it never accepts a profileId', async () => {
      // updateMyProfile's signature has no profileId param at all; it always
      // resolves via teacherProfile.findUnique({ where: { userId: actor.id } }).
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-own', userId: 'teacher-1' });
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-own', userId: 'teacher-1' });
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'teacher-1', instituteId: 'inst-1' });

      await service.updateMyProfile('inst-1', { name: 'X' }, teacher);

      expect(prisma.teacherProfile.findUnique.mock.calls[0]![0]).toEqual({ where: { userId: 'teacher-1' } });
    });
  });

  describe('findAll — status filter and sort', () => {
    it('filters by account status', async () => {
      prisma.teacherProfile.findMany.mockResolvedValueOnce([]);
      prisma.teacherProfile.count.mockResolvedValueOnce(0);

      await service.findAll('inst-1', { status: 'INACTIVE' } as any, admin);

      const call = prisma.teacherProfile.findMany.mock.calls[0]![0];
      expect(call.where.user).toEqual({ instituteId: 'inst-1', status: 'INACTIVE' });
    });

    it('sorts by qualification when requested, defaults to name otherwise', async () => {
      prisma.teacherProfile.findMany.mockResolvedValueOnce([]);
      prisma.teacherProfile.count.mockResolvedValueOnce(0);
      await service.findAll('inst-1', { sortBy: 'qualification', sortDir: 'desc' } as any, admin);
      expect(prisma.teacherProfile.findMany.mock.calls[0]![0].orderBy).toEqual({ qualification: 'desc' });

      prisma.teacherProfile.findMany.mockResolvedValueOnce([]);
      prisma.teacherProfile.count.mockResolvedValueOnce(0);
      await service.findAll('inst-1', {} as any, admin);
      expect(prisma.teacherProfile.findMany.mock.calls[1]![0].orderBy).toEqual({ user: { name: 'asc' } });
    });
  });

  describe('archive', () => {
    it('rejects a TEACHER (non-admin) archiving a colleague', async () => {
      await expect(service.archive('inst-1', 'tp-1', teacher)).rejects.toThrow(ForbiddenException);
    });

    it('deactivates the underlying user account and writes an audit entry', async () => {
      prisma.teacherProfile.findUnique.mockResolvedValueOnce({ id: 'tp-1', userId: 'user-1', user: { id: 'user-1', instituteId: 'inst-1' } });

      const result = await service.archive('inst-1', 'tp-1', admin);

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { status: 'INACTIVE' } });
      expect(prisma.auditLog.create).toHaveBeenCalled();
      expect(result.message).toContain('archived');
    });
  });

  describe('getStats', () => {
    it('rejects a caller from a different institute', async () => {
      await expect(service.getStats('inst-OTHER', admin)).rejects.toThrow(ForbiddenException);
    });

    it('aggregates real counts by subject and batch-assignment, not invented values', async () => {
      prisma.teacherProfile.count.mockResolvedValueOnce(3); // total
      prisma.teacherProfile.count.mockResolvedValueOnce(2); // active
      prisma.teacherProfile.findMany.mockResolvedValueOnce([
        { subjectIds: ['subj-1'], batchAssignments: [{ id: 'bt-1' }] },
        { subjectIds: ['subj-1', 'subj-2'], batchAssignments: [] },
        { subjectIds: [], batchAssignments: [] },
      ]);
      prisma.subject.findMany.mockResolvedValueOnce([
        { id: 'subj-1', name: 'Physics' },
        { id: 'subj-2', name: 'Chemistry' },
      ]);

      const stats = await service.getStats('inst-1', admin);

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.inactive).toBe(1);
      expect(stats.unassignedToSubject).toBe(1);
      expect(stats.withBatchAssignment).toBe(1);
      expect(stats.withoutBatchAssignment).toBe(2);
      expect(stats.bySubject).toEqual(
        expect.arrayContaining([{ subject: 'Physics', count: 2 }, { subject: 'Chemistry', count: 1 }]),
      );
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
  // ── Plan-limit enforcement at the create call site ─────────────────────────
  // Mirrors StudentsService: the gate must be consulted, and consulted inside
  // the transaction so concurrent hires at the plan boundary cannot both pass.
  describe('create — plan limit enforcement', () => {
    const validDto = { email: 'new@x.com', name: 'New Teacher', qualification: 'M.Sc' } as any;

    it('consults the entitlement gate for a TEACHER, inside the transaction', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await service.create('inst-1', validDto, admin);

      expect(entitlements.assertCanCreate).toHaveBeenCalledWith(
        'inst-1',
        EntitlementResource.TEACHER,
        expect.anything(),
      );
      const [, , txArg] = entitlements.assertCanCreate.mock.calls[0];
      expect(txArg).toHaveProperty('user');
    });

    it('propagates the refusal when the teacher limit is reached', async () => {
      prisma.user.findFirst.mockResolvedValueOnce(null);
      entitlements.assertCanCreate.mockRejectedValueOnce(
        new ForbiddenException({ code: 'PLAN_LIMIT_EXCEEDED', message: 'limit' }),
      );
      await expect(service.create('inst-1', validDto, admin)).rejects.toThrow(ForbiddenException);
    });
  });
});
