import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('UsersService — tenant isolation and self/founder protection (13-TESTING-STRATEGY.md §7)', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock } };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const founderActor: AuthenticatedUser = { ...admin, id: 'founder-1', role: UserRole.FOUNDER };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() } };
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
  });
});
