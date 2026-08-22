import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PermissionsService } from './permissions.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    userPermissionGrant: { create: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      userPermissionGrant: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
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
      prisma.userPermissionGrant.create.mockResolvedValueOnce({ id: 'grant-1' });

      await service.grant('inst-1', { userId: 'u-1', permission: 'REVIEW_EVALUATION', batchId: 'batch-1' }, admin);

      expect(prisma.userPermissionGrant.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'u-1', permission: 'REVIEW_EVALUATION', batchId: 'batch-1', grantedByUserId: 'admin-1' }) }),
      );
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
      await expect(service.hasPermission('u-1', 'REVIEW_EVALUATION', { batchId: 'batch-1', subjectId: 'sub-1' })).resolves.toBe(true);
    });

    it('queries with the OR-null-or-matching-scope shape for both batchId and subjectId', async () => {
      prisma.userPermissionGrant.findFirst.mockResolvedValueOnce(null);
      await service.hasPermission('u-1', 'REVIEW_EVALUATION', { batchId: 'batch-1', subjectId: 'sub-1' });
      expect(prisma.userPermissionGrant.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'u-1',
          permission: 'REVIEW_EVALUATION',
          AND: [
            { OR: [{ batchId: null }, { batchId: 'batch-1' }] },
            { OR: [{ subjectId: null }, { subjectId: 'sub-1' }] },
          ],
        },
      });
    });
  });
});
