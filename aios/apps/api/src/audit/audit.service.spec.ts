import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AuditAction, UserRole } from '@prisma/client';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: { findMany: jest.Mock; count: jest.Mock } };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const founder: AuthenticatedUser = { ...admin, id: 'founder-1', role: UserRole.FOUNDER };
  const teacher: AuthenticatedUser = { ...admin, id: 'teacher-1', role: UserRole.TEACHER };

  beforeEach(async () => {
    prisma = { auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AuditService);
  });

  describe('findAll (institute-scoped)', () => {
    it('rejects a teacher outright', async () => {
      await expect(service.findAll('inst-1', {}, teacher)).rejects.toThrow(ForbiddenException);
    });

    it("rejects an admin reading a different institute's logs", async () => {
      await expect(service.findAll('inst-2', {}, admin)).rejects.toThrow(ForbiddenException);
    });

    it('allows an admin to read their own institute', async () => {
      await expect(service.findAll('inst-1', {}, admin)).resolves.toBeDefined();
    });

    it('allows a founder to read any institute', async () => {
      await expect(service.findAll('inst-anything', {}, founder)).resolves.toBeDefined();
    });
  });

  describe('findAllGlobal', () => {
    it('rejects a non-founder', async () => {
      await expect(service.findAllGlobal({}, admin)).rejects.toThrow(ForbiddenException);
    });

    it('allows a founder, optionally filtered to one institute', async () => {
      await service.findAllGlobal({ instituteId: 'inst-3' }, founder);
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ instituteId: 'inst-3' }) }),
      );
    });
  });

  describe('PII redaction (07-SECURITY-SPECIFICATION.md)', () => {
    it('redacts email/phone-shaped keys in oldValue/newValue while keeping the rest', async () => {
      prisma.auditLog.findMany.mockResolvedValueOnce([
        {
          id: 'log-1', instituteId: 'inst-1', actorId: 'admin-1', action: AuditAction.UPDATE,
          entity: 'students', entityId: 's-1', createdAt: new Date(),
          oldValue: { guardianPhone: '9999999999', status: 'ACTIVE' },
          newValue: { guardianPhone: '8888888888', status: 'ARCHIVED' },
        },
      ]);

      const result = await service.findAll('inst-1', {}, admin);
      const [entry] = result.data;

      expect(entry?.oldValue).toEqual({ guardianPhone: '[REDACTED]', status: 'ACTIVE' });
      expect(entry?.newValue).toEqual({ guardianPhone: '[REDACTED]', status: 'ARCHIVED' });
    });
  });
});
