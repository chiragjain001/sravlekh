import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, SupportTicketStatus, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateSupportTicketDto,
  AddTicketMessageDto,
  UpdateTicketStatusDto,
  UpdateTicketPriorityDto,
  AssignTicketDto,
  QueryTicketsDto,
} from './dto/support-ticket.dto';

const TICKET_DETAIL_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.SupportTicketInclude;

/**
 * Founder Console Phase 8 — a genuinely new subsystem (no prior backend
 * existed here, only a mock UI). ADMIN can create/view/reply within their
 * own institute; FOUNDER has cross-tenant read plus status/priority/
 * assignment control (07-SECURITY-SPECIFICATION.md's Founder-cross-tenant
 * pattern reused, same as InstitutesService.assertTenantAccess elsewhere).
 */
@Injectable()
export class SupportTicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(instituteId: string, dto: CreateSupportTicketDto, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        instituteId,
        subject: dto.subject,
        description: dto.description,
        priority: dto.priority,
        createdByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, ticket.id, null, { subject: ticket.subject });
    return ticket;
  }

  async findAllForInstitute(instituteId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);
    return this.prisma.supportTicket.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(instituteId: string, ticketId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: TICKET_DETAIL_INCLUDE,
    });
    if (!ticket || ticket.instituteId !== instituteId) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  async addMessage(instituteId: string, ticketId: string, dto: AddTicketMessageDto, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket || ticket.instituteId !== instituteId) throw new NotFoundException('Ticket not found.');
    return this.createMessage(ticket.instituteId, ticket.id, ticket.status, dto, actor);
  }

  /** Founder console reply — no instituteId in the URL, resolved from the ticket itself. */
  async addMessageGlobal(ticketId: string, dto: AddTicketMessageDto, actor: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return this.createMessage(ticket.instituteId, ticket.id, ticket.status, dto, actor);
  }

  private async createMessage(instituteId: string, ticketId: string, currentStatus: SupportTicketStatus, dto: AddTicketMessageDto, actor: AuthenticatedUser) {
    const message = await this.prisma.supportTicketMessage.create({
      data: { ticketId, authorUserId: actor.id, body: dto.body },
    });

    // A reply reopens a resolved/closed ticket rather than silently attaching
    // to a "done" record — matches the doubts module's status-transition
    // discipline elsewhere in this codebase.
    if (currentStatus === SupportTicketStatus.RESOLVED || currentStatus === SupportTicketStatus.CLOSED) {
      await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { status: SupportTicketStatus.IN_PROGRESS } });
    }

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, ticketId, null, { messageId: message.id });
    return message;
  }

  // ── Founder cross-tenant (delegated from FounderController) ────────────

  async findAllGlobal(query: QueryTicketsDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 20;

    const where: Prisma.SupportTicketWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.instituteId ? { instituteId: query.instituteId } : {}),
      ...(query.search
        ? { OR: [{ subject: { contains: query.search, mode: 'insensitive' } }, { description: { contains: query.search, mode: 'insensitive' } }] }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.supportTicket.count({ where }),
      this.prisma.supportTicket.findMany({
        where,
        include: { institute: { select: { id: true, name: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data: rows, meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  async findOneGlobal(ticketId: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { ...TICKET_DETAIL_INCLUDE, institute: { select: { id: true, name: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket not found.');
    return ticket;
  }

  async updateStatus(ticketId: string, dto: UpdateTicketStatusDto, actor: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: dto.status,
        resolvedAt: dto.status === SupportTicketStatus.RESOLVED ? new Date() : ticket.resolvedAt,
      },
    });
    await this.writeAudit(ticket.instituteId, actor.id, AuditAction.UPDATE, ticketId, { status: ticket.status }, { status: dto.status });
    return updated;
  }

  async updatePriority(ticketId: string, dto: UpdateTicketPriorityDto, actor: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');

    const updated = await this.prisma.supportTicket.update({ where: { id: ticketId }, data: { priority: dto.priority } });
    await this.writeAudit(ticket.instituteId, actor.id, AuditAction.UPDATE, ticketId, { priority: ticket.priority }, { priority: dto.priority });
    return updated;
  }

  async assign(ticketId: string, dto: AssignTicketDto, actor: AuthenticatedUser) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new NotFoundException('Ticket not found.');

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToUserId: dto.assignedToUserId, status: ticket.status === SupportTicketStatus.OPEN ? SupportTicketStatus.IN_PROGRESS : ticket.status },
    });
    await this.writeAudit(ticket.instituteId, actor.id, AuditAction.UPDATE, ticketId, { assignedToUserId: ticket.assignedToUserId }, { assignedToUserId: dto.assignedToUserId });
    return updated;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertTenantAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity: 'support_tickets', entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch {
      // audit failures never block the underlying mutation (08-ERROR-HANDLING.md)
    }
  }
}
