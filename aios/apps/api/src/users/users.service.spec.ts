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

    // ── Intra-tenant role scoping ──────────────────────────────────────────
    //
    // Regression for PRODUCTION-AUDIT-2026-09-10.md §4: GET /users/:id carries no
    // @Roles() decorator, and RolesGuard lets an undecorated route through for any
    // authenticated user. The service only ever compared instituteId, so a STUDENT
    // or PARENT could read any colleague's record in their own institute — email,
    // role, status, lastLoginAt. Tenant isolation was never the hole; role scoping
    // inside the tenant was.
    //
    // The matrix below is the authorization contract. It is asserted per role
    // rather than as one example, because the failure being prevented is
    // "somebody adds a role and nobody notices it can read everyone".

    const otherUserInSameInstitute = { id: 'user-2', instituteId: 'inst-1', email: 'someone@x.com' };

    describe.each([
      [UserRole.STUDENT, 'student-1'],
      [UserRole.TEACHER, 'teacher-1'],
    ])('a %s', (role, actorId) => {
      const actor: AuthenticatedUser = { ...admin, id: actorId, role };

      it("cannot read another user's record in their own institute", async () => {
        prisma.user.findUnique.mockResolvedValueOnce(otherUserInSameInstitute);
        await expect(service.findById('user-2', actor)).rejects.toThrow(ForbiddenException);
      });

      it('CAN read their own record', async () => {
        prisma.user.findUnique.mockResolvedValueOnce({ id: actorId, instituteId: 'inst-1', email: 'me@x.com' });
        await expect(service.findById(actorId, actor)).resolves.toMatchObject({ id: actorId });
      });

      it('cannot read their own record from a different institute row', async () => {
        // Defence in depth: even an id match must not bypass tenant isolation,
        // which is checked first.
        prisma.user.findUnique.mockResolvedValueOnce({ id: actorId, instituteId: 'inst-OTHER' });
        await expect(service.findById(actorId, actor)).rejects.toThrow(ForbiddenException);
      });
    });

    it('an ADMIN can read another user in their own institute', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(otherUserInSameInstitute);
      await expect(service.findById('user-2', admin)).resolves.toMatchObject({ id: 'user-2' });
    });

    it('an ADMIN still cannot read a user in a different institute', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER' });
      await expect(service.findById('user-2', admin)).rejects.toThrow(ForbiddenException);
    });

    it("a TEACHER is not granted the spec's batch-scoped read by this route", async () => {
      // 05-API-SPECIFICATION.md §3 permits teachers to read users "read-limited to
      // own batches". This endpoint implements no batch scoping, so granting
      // TEACHER here would be WIDER than the spec allows. Pinned so that a future
      // "teachers should see users too" change has to add the scoping rather than
      // just the role.
      const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };
      prisma.user.findUnique.mockResolvedValueOnce(otherUserInSameInstitute);
      await expect(service.findById('user-2', teacher)).rejects.toThrow(ForbiddenException);
    });

    it('does not reveal whether a cross-tenant id exists', async () => {
      // A different message or status for "exists elsewhere" vs "not allowed"
      // would confirm the existence of a user id to an attacker enumerating them.
      prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', instituteId: 'inst-OTHER' });
      const crossTenant = await service.findById('user-2', admin).catch((e: Error) => e);

      prisma.user.findUnique.mockResolvedValueOnce(otherUserInSameInstitute);
      const student: AuthenticatedUser = { ...admin, id: 'student-1', role: UserRole.STUDENT };
      const sameTenantForbidden = await service.findById('user-2', student).catch((e: Error) => e);

      expect((crossTenant as Error).message).toBe((sameTenantForbidden as Error).message);
      expect((crossTenant as Error).constructor).toBe((sameTenantForbidden as Error).constructor);
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
