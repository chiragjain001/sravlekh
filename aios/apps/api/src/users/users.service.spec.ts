import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('UsersService — tenant isolation and self/founder protection (13-TESTING-STRATEGY.md §7)', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock; count: jest.Mock }; auditLog: { create: jest.Mock } };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const founderActor: AuthenticatedUser = { ...admin, id: 'founder-1', role: UserRole.FOUNDER };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(UsersService);
  });

  describe('findById', () => {
    it("rejects reading a user from a different institute", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER' });
      await expect(service.findById('user-2', admin)).rejects.toThrow(ForbiddenException);
    });

    it('allows a founder to read a user in any institute', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER' });
      await expect(service.findById('user-2', founderActor)).resolves.toBeDefined();
    });

    it('404s for a nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.findById('missing', admin)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAllByInstitute', () => {
    it("rejects an admin listing a different institute's users", async () => {
      await expect(service.findAllByInstitute('inst-OTHER', admin)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus — self and founder protection', () => {
    it('rejects an admin suspending their own account', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'admin-1', instituteId: 'inst-1', role: UserRole.ADMIN });
      await expect(service.updateStatus('admin-1', UserStatus.SUSPENDED, admin)).rejects.toThrow(ForbiddenException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rejects an admin suspending a founder', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'founder-1', instituteId: 'inst-1', role: UserRole.FOUNDER });
      await expect(service.updateStatus('founder-1', UserStatus.SUSPENDED, admin)).rejects.toThrow(ForbiddenException);
    });

    it("rejects an admin suspending a user in a different institute", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER', role: UserRole.TEACHER });
      await expect(service.updateStatus('user-2', UserStatus.SUSPENDED, admin)).rejects.toThrow(ForbiddenException);
    });

    it('allows suspending a normal user in the same institute', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-1', role: UserRole.TEACHER });
      prisma.user.update.mockResolvedValueOnce({ id: 'user-2', status: UserStatus.SUSPENDED });
      await expect(service.updateStatus('user-2', UserStatus.SUSPENDED, admin)).resolves.toBeDefined();
    });

    it('allows a Founder to suspend a user in a different institute (Founder Console Phase 4)', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER', role: UserRole.TEACHER, status: UserStatus.ACTIVE });
      prisma.user.update.mockResolvedValueOnce({ id: 'user-2', status: UserStatus.SUSPENDED });
      await expect(service.updateStatus('user-2', UserStatus.SUSPENDED, founderActor)).resolves.toBeDefined();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ instituteId: 'inst-OTHER', actorId: 'founder-1', entity: 'users', entityId: 'user-2' }),
      });
    });
  });

  describe('forceLogout (Founder Console Phase 4)', () => {
    it('404s for a nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);
      await expect(service.forceLogout('missing', admin)).rejects.toThrow(NotFoundException);
    });

    it("rejects an admin force-logging-out a user in a different institute", async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER', role: UserRole.TEACHER });
      await expect(service.forceLogout('user-2', admin)).rejects.toThrow(ForbiddenException);
    });

    it('rejects force-logging-out a different Founder', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'founder-2', instituteId: 'inst-1', role: UserRole.FOUNDER });
      await expect(service.forceLogout('founder-2', founderActor)).rejects.toThrow(ForbiddenException);
    });

    it('allows a Founder to force-log-out any non-Founder user, bumping tokenVersion', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER', role: UserRole.TEACHER, email: 't@x.com' });
      prisma.user.update.mockResolvedValueOnce({ id: 'user-2', email: 't@x.com', tokenVersion: 1 });

      const result = await service.forceLogout('user-2', founderActor);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-2' },
        data: { tokenVersion: { increment: 1 } },
        select: { id: true, email: true, tokenVersion: true },
      });
      expect(result.id).toBe('user-2');
    });
  });

  describe('findAllGlobal (Founder Console Phase 4 — cross-tenant user search)', () => {
    it('paginates and filters by search/role/status/instituteId', async () => {
      prisma.user.count.mockResolvedValueOnce(1);
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'user-2', email: 't@x.com' }]);

      const result = await service.findAllGlobal({ search: 'teach', role: UserRole.TEACHER, status: UserStatus.ACTIVE, instituteId: 'inst-1', page: 2, pageSize: 10 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.meta).toEqual({ total: 1, page: 2, pageSize: 10, totalPages: 1 });
      expect(result.data).toHaveLength(1);
    });

    it('defaults to page 1 / pageSize 20 with no filters', async () => {
      prisma.user.count.mockResolvedValueOnce(0);
      prisma.user.findMany.mockResolvedValueOnce([]);

      const result = await service.findAllGlobal({});

      expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20, where: {} }));
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
    });
  });
});
