import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import {
  CreateInstituteDto,
  UpdateInstituteDto,
  AddAllowListEntryDto,
} from './dto/institute.dto';
import { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class InstitutesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── A-05: Institute CRUD ──────────────────────────────────────────────────

  /** Founder-only: create a new institute tenant. */
  async create(dto: CreateInstituteDto, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.create({
      data: {
        name: dto.name,
        domainAllowlist: dto.domainAllowlist,
        plan: dto.plan,
        address: dto.address,
        phone: dto.phone,
      },
    });

    await this.audit(institute.id, actor.id, AuditAction.CREATE, 'institutes', institute.id);

    return institute;
  }

  /** Get institute by ID — enforces tenant isolation. */
  async findById(instituteId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      include: { branches: true },
    });

    if (!institute) throw new NotFoundException('Institute not found.');
    return institute;
  }

  /** Admin/Founder: update institute settings. */
  async update(
    instituteId: string,
    dto: UpdateInstituteDto,
    actor: AuthenticatedUser,
  ) {
    this.assertTenantAccess(actor, instituteId);

    const existing = await this.prisma.institute.findUnique({
      where: { id: instituteId },
    });
    if (!existing) throw new NotFoundException('Institute not found.');

    const updated = await this.prisma.institute.update({
      where: { id: instituteId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.domainAllowlist && { domainAllowlist: dto.domainAllowlist }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
      },
    });

    await this.audit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'institutes',
      instituteId,
      existing,
      updated,
    );

    return updated;
  }

  // ── A-06: Allow-list management ───────────────────────────────────────────

  /** Admin: add a user to the institute allow-list. */
  async addAllowListEntry(
    instituteId: string,
    dto: AddAllowListEntryDto,
    actor: AuthenticatedUser,
  ) {
    this.assertTenantAccess(actor, instituteId);

    const existing = await this.prisma.allowListEntry.findUnique({
      where: { instituteId_email: { instituteId, email: dto.email.toLowerCase() } },
    });

    if (existing) {
      throw new ConflictException(
        `${dto.email} is already in the allow-list for this institute.`,
      );
    }

    const entry = await this.prisma.allowListEntry.create({
      data: {
        instituteId,
        email: dto.email.toLowerCase(),
        role: dto.role as UserRole,
        addedByUserId: actor.id,
      },
    });

    await this.audit(
      instituteId,
      actor.id,
      AuditAction.CREATE,
      'allow_list_entries',
      entry.id,
      null,
      { email: entry.email, role: entry.role },
    );

    return entry;
  }

  /** Admin: list all allow-list entries for an institute. */
  async getAllowList(instituteId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);

    return this.prisma.allowListEntry.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Admin: remove an allow-list entry. Does NOT delete the user if they exist. */
  async removeAllowListEntry(
    instituteId: string,
    entryId: string,
    actor: AuthenticatedUser,
  ) {
    this.assertTenantAccess(actor, instituteId);

    const entry = await this.prisma.allowListEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry || entry.instituteId !== instituteId) {
      throw new NotFoundException('Allow-list entry not found.');
    }

    await this.prisma.allowListEntry.delete({ where: { id: entryId } });

    await this.audit(
      instituteId,
      actor.id,
      AuditAction.DELETE,
      'allow_list_entries',
      entryId,
      { email: entry.email, role: entry.role },
      null,
    );

    return { message: `${entry.email} removed from allow-list.` };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Row-level tenant isolation guard.
   * Founders can access any institute; other roles only their own.
   */
  private assertTenantAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return; // Founder has cross-institute read
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private async audit(
    instituteId: string,
    actorId: string,
    action: AuditAction,
    entity: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) {
    await this.prisma.auditLog.create({
      data: {
        instituteId,
        actorId,
        action,
        entity,
        entityId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
      },
    });
  }
}
