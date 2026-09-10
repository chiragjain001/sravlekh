import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole, SupportTicketStatus, SupportTicketPriority } from '@prisma/client';
import { SupportTicketsService } from './support-tickets.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

describe('SupportTicketsService (Founder Console Phase 8)', () => {
  let service: SupportTicketsService;
  let prisma: {
    supportTicket: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; count: jest.Mock };
    supportTicketMessage: { create: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const admin: AuthenticatedUser = { id: 'admin-1', email: 'a@x.com', name: 'Admin', role: UserRole.ADMIN, instituteId: 'inst-1' };
  const founder: AuthenticatedUser = { id: 'founder-1', email: 'f@x.com', name: 'Founder', role: UserRole.FOUNDER, instituteId: 'inst-none' };

  beforeEach(async () => {
    prisma = {
      supportTicket: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
      supportTicketMessage: { create: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupportTicketsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(SupportTicketsService);
  });

  describe('create', () => {
    it('rejects an admin creating a ticket for a different institute', async () => {
      await expect(service.create('inst-OTHER', { subject: 's', description: 'd' }, admin)).rejects.toThrow(ForbiddenException);
      expect(prisma.supportTicket.create).not.toHaveBeenCalled();
    });

    it('allows a founder to create a ticket for any institute', async () => {
      prisma.supportTicket.create.mockResolvedValueOnce({ id: 't1', subject: 's' });
      await expect(service.create('inst-OTHER', { subject: 's', description: 'd' }, founder)).resolves.toBeDefined();
    });
  });

  describe('findAllForInstitute', () => {
    it("rejects an admin listing a different institute's tickets", async () => {
      await expect(service.findAllForInstitute('inst-OTHER', admin)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMessage', () => {
    it('404s for a ticket that does not belong to the institute', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce({ id: 't1', instituteId: 'inst-OTHER', status: SupportTicketStatus.OPEN });
      await expect(service.addMessage('inst-1', 't1', { body: 'hi' }, admin)).rejects.toThrow(NotFoundException);
    });

    it('reopens a resolved ticket when a new message arrives', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce({ id: 't1', instituteId: 'inst-1', status: SupportTicketStatus.RESOLVED });
      prisma.supportTicketMessage.create.mockResolvedValueOnce({ id: 'm1', body: 'hi' });

      await service.addMessage('inst-1', 't1', { body: 'hi' }, admin);

      expect(prisma.supportTicket.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { status: SupportTicketStatus.IN_PROGRESS } });
    });

    it('does not reopen an already-open ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce({ id: 't1', instituteId: 'inst-1', status: SupportTicketStatus.OPEN });
      prisma.supportTicketMessage.create.mockResolvedValueOnce({ id: 'm1', body: 'hi' });

      await service.addMessage('inst-1', 't1', { body: 'hi' }, admin);

      expect(prisma.supportTicket.update).not.toHaveBeenCalled();
    });
  });

  describe('addMessageGlobal (Founder console reply)', () => {
    it('404s for a nonexistent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce(null);
      await expect(service.addMessageGlobal('missing', { body: 'hi' }, founder)).rejects.toThrow(NotFoundException);
    });

    it('resolves the institute from the ticket itself, with no tenant check for a Founder', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce({ id: 't1', instituteId: 'inst-OTHER', status: SupportTicketStatus.OPEN });
      prisma.supportTicketMessage.create.mockResolvedValueOnce({ id: 'm1', body: 'reply' });

      await service.addMessageGlobal('t1', { body: 'reply' }, founder);

      expect(prisma.supportTicketMessage.create).toHaveBeenCalledWith({ data: { ticketId: 't1', authorUserId: 'founder-1', body: 'reply' } });
    });
  });

  describe('updateStatus', () => {
    it('404s for a nonexistent ticket', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce(null);
      await expect(service.updateStatus('missing', { status: SupportTicketStatus.RESOLVED }, founder)).rejects.toThrow(NotFoundException);
    });

    it('sets resolvedAt when moving to RESOLVED', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce({ id: 't1', instituteId: 'inst-1', status: SupportTicketStatus.IN_PROGRESS, resolvedAt: null });
      prisma.supportTicket.update.mockResolvedValueOnce({ id: 't1', status: SupportTicketStatus.RESOLVED });

      await service.updateStatus('t1', { status: SupportTicketStatus.RESOLVED }, founder);

      const call = prisma.supportTicket.update.mock.calls[0][0];
      expect(call.data.status).toBe(SupportTicketStatus.RESOLVED);
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });
  });

  describe('assign', () => {
    it('moves an OPEN ticket to IN_PROGRESS on assignment', async () => {
      prisma.supportTicket.findUnique.mockResolvedValueOnce({ id: 't1', instituteId: 'inst-1', status: SupportTicketStatus.OPEN, assignedToUserId: null });
      prisma.supportTicket.update.mockResolvedValueOnce({ id: 't1', assignedToUserId: 'founder-1' });

      await service.assign('t1', { assignedToUserId: 'founder-1' }, founder);

      expect(prisma.supportTicket.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { assignedToUserId: 'founder-1', status: SupportTicketStatus.IN_PROGRESS },
      });
    });
  });

  describe('findAllGlobal', () => {
    it('paginates and filters by search/status/priority/instituteId', async () => {
      prisma.supportTicket.count.mockResolvedValueOnce(1);
      prisma.supportTicket.findMany.mockResolvedValueOnce([{ id: 't1' }]);

      const result = await service.findAllGlobal({
        search: 'billing', status: SupportTicketStatus.OPEN, priority: SupportTicketPriority.HIGH, instituteId: 'inst-1', page: 1, pageSize: 20,
      });

      expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
      expect(result.data).toHaveLength(1);
    });
  });
});
