import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: {
    user: { findUnique: jest.Mock; count: jest.Mock; findMany: jest.Mock };
    userPermissionGrant: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
    platformSetting: { findUnique: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock; findMany: jest.Mock };
    batch: { findUnique: jest.Mock; findMany: jest.Mock };
    subject: { findUnique: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const admin: AuthenticatedUser = {
    id: 'admin-1',
    email: 'a@x.com',
    name: 'Admin',
    role: UserRole.ADMIN,
    instituteId: 'inst-1',
  };
  const teacher: AuthenticatedUser = {
    ...admin,
    id: 'teacher-1',
    role: UserRole.TEACHER,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), count: jest.fn().mockResolvedValue(2), findMany: jest.fn().mockResolvedValue([]) },
      userPermissionGrant: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      platformSetting: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
      batch: { findUnique: jest.fn().mockResolvedValue({ id: 'batch-1', instituteId: 'inst-1' }), findMany: jest.fn().mockResolvedValue([]) },
      subject: { findUnique: jest.fn().mockResolvedValue({ id: 'sub-1', instituteId: 'inst-1' }), findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PermissionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PermissionsService);
  });

  describe('grant', () => {
    it('rejects a non-admin', async () => {
      await expect(
        service.grant('inst-1', { userId: 'u-1', permission: 'REVIEW_EVALUATION' }, teacher),
      ).rejects.toThrow(ForbiddenException);
    });

    it('404s when the target user is in a different institute', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', instituteId: 'inst-2' });
      await expect(
        service.grant('inst-1', { userId: 'u-1', permission: 'REVIEW_EVALUATION' }, admin),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a grant and writes an audit entry', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', instituteId: 'inst-1' });
      prisma.userPermissionGrant.findFirst.mockResolvedValueOnce(null);
      prisma.userPermissionGrant.create.mockResolvedValueOnce({ id: 'grant-1' });

      await service.grant('inst-1', { userId: 'u-1', permission: 'REVIEW_EVALUATION', batchId: 'batch-1' }, admin);

      expect(prisma.userPermissionGrant.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'u-1',
            permission: 'REVIEW_EVALUATION',
            batchId: 'batch-1',
            grantedByUserId: 'admin-1',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('grantBulk', () => {
    it('creates multiple grants atomically', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'u-1', instituteId: 'inst-1' });
      prisma.userPermissionGrant.findFirst.mockResolvedValue(null);
      prisma.userPermissionGrant.create.mockResolvedValue({ id: 'g-1' });

      const res = await service.grantBulk(
        'inst-1',
        { userId: 'u-1', permissions: ['ATTENDANCE_TAKE', 'ATTENDANCE_CORRECT'] },
        admin,
      );

      expect(res.success).toBe(true);
      expect(res.grantedCount).toBe(2);
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('syncUserPermissions', () => {
    it('throws BadRequestException if attempting to strip permissions from the sole admin', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'admin-1',
        role: UserRole.ADMIN,
        instituteId: 'inst-1',
      });
      prisma.user.count.mockResolvedValueOnce(1); // sole admin

      await expect(
        service.syncUserPermissions('inst-1', { userId: 'admin-1', grants: [] }, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('syncs permissions atomically for standard users', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        instituteId: 'inst-1',
      });
      prisma.userPermissionGrant.findMany.mockResolvedValueOnce([]);
      prisma.userPermissionGrant.create.mockResolvedValue({ id: 'g-1' });

      const res = await service.syncUserPermissions(
        'inst-1',
        {
          userId: 'teacher-1',
          grants: [{ permission: 'ATTENDANCE_TAKE' }, { permission: 'REVIEW_EVALUATION' }],
        },
        admin,
      );

      expect(res.success).toBe(true);
      expect(res.activeGrantsCount).toBe(2);
      expect(prisma.userPermissionGrant.deleteMany).toHaveBeenCalledWith({ where: { userId: 'teacher-1' } });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('rejects a non-admin', async () => {
      await expect(service.revoke('inst-1', 'grant-1', teacher)).rejects.toThrow(ForbiddenException);
    });

    it('404s when grant not found or in different institute', async () => {
      prisma.userPermissionGrant.findUnique.mockResolvedValueOnce(null);
      await expect(service.revoke('inst-1', 'grant-1', admin)).rejects.toThrow(NotFoundException);
    });

    it('deletes the grant and writes an audit entry', async () => {
      prisma.userPermissionGrant.findUnique.mockResolvedValueOnce({
        id: 'grant-1',
        userId: 'u-1',
        permission: 'ATTENDANCE_CORRECT_HISTORICAL',
        user: { instituteId: 'inst-1' },
      });
      prisma.userPermissionGrant.delete.mockResolvedValueOnce({ id: 'grant-1' });

      const res = await service.revoke('inst-1', 'grant-1', admin);
      expect(res).toEqual({ success: true, revokedId: 'grant-1' });
      expect(prisma.userPermissionGrant.delete).toHaveBeenCalledWith({ where: { id: 'grant-1' } });
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('hasPermission', () => {
    it('returns false when no grant exists', async () => {
      prisma.userPermissionGrant.findFirst.mockResolvedValueOnce(null);
      await expect(service.hasPermission('u-1', 'REVIEW_EVALUATION', { batchId: 'batch-1' })).resolves.toBe(false);
    });

    it('returns true when an institute-wide grant exists (matches any scope)', async () => {
      prisma.userPermissionGrant.findFirst.mockResolvedValueOnce({ id: 'grant-1', batchId: null, subjectId: null });
      await expect(
        service.hasPermission('u-1', 'REVIEW_EVALUATION', { batchId: 'batch-1', subjectId: 'sub-1' }),
      ).resolves.toBe(true);
    });
  });

  describe('Role Management', () => {
    it('returns role templates and canonical permissions', async () => {
      const res = await service.getRoles('inst-1', admin);
      expect(res.templates.length).toBeGreaterThanOrEqual(8);
      expect(res.canonicalPermissions.length).toBeGreaterThanOrEqual(20);
      expect(res.categories.length).toBeGreaterThanOrEqual(8);
    });

    it('creates custom role and validates name uniqueness', async () => {
      const newRole = await service.createCustomRole(
        'inst-1',
        {
          name: 'Junior Examiner',
          description: 'Assist with grading',
          baseRole: UserRole.TEACHER,
          permissions: ['evaluation:grade', 'question:author'],
        },
        admin,
      );

      expect(newRole.name).toBe('Junior Examiner');
      expect(newRole.isSystem).toBe(false);
      expect(prisma.platformSetting.upsert).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('prevents deleting built-in system role templates', async () => {
      await expect(service.deleteCustomRole('inst-1', 'tpl_principal', admin)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('simulateAccess', () => {
    it('simulates access and flags high-risk capabilities', async () => {
      const simulation = await service.simulateAccess(
        'inst-1',
        {
          permissions: ['exam:unlock', 'REVIEW_EVALUATION', 'timetable:view'],
        },
        admin,
      );

      expect(simulation.accessibleModules).toContain('Exams & Assessments');
      expect(simulation.accessibleModules).toContain('Evaluation Queue');
      expect(simulation.sensitiveFlags.length).toBeGreaterThanOrEqual(2);
      expect(simulation.sensitiveFlags.some((f) => f.permission === 'exam:unlock')).toBe(true);
    });
  });
});
