import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, UserStatus, AuditAction, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { QueryGlobalUsersDto } from './dto/query-global-users.dto';

const USER_LIST_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  role: true,
  status: true,
  instituteId: true,
  lastLoginAt: true,
  createdAt: true,
  institute: { select: { id: true, name: true } },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Get a user by ID — enforces tenant isolation. */
  async findById(userId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        instituteId: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found.');

    // Tenant isolation — users can only see users within their own institute,
    // except Founders who have cross-institute read (logged separately).
    if (
      actor.role !== UserRole.FOUNDER &&
      user.instituteId !== actor.instituteId
    ) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return user;
  }

  /** Admin/Founder: list all users in an institute. */
  async findAllByInstitute(instituteId: string, actor: AuthenticatedUser) {
    if (
      actor.role !== UserRole.FOUNDER &&
      actor.instituteId !== instituteId
    ) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return this.prisma.user.findMany({
      where: { instituteId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── GET /founder/users — Founder Console Phase 4 ────────────────────────
  // The one place a Founder can see users across every institute at once,
  // rather than looping findAllByInstitute per tenant.

  async findAllGlobal(query: QueryGlobalUsersDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 && query.pageSize <= 100 ? query.pageSize : 20;

    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.instituteId ? { instituteId: query.instituteId } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: USER_LIST_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data: rows, meta: { total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
  }

  /** Admin: suspend or reactivate a user within the same institute. Founder: any institute. */
  async updateStatus(
    userId: string,
    status: UserStatus,
    actor: AuthenticatedUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== user.instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }

    // Admins/Founders cannot change their own status or a Founder's status
    if (user.id === actor.id || user.role === UserRole.FOUNDER) {
      throw new ForbiddenException('This action is not permitted.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });

    await this.writeAudit(user.instituteId, actor.id, AuditAction.UPDATE, userId, { status: user.status }, { status });
    return updated;
  }

  // ── PATCH /users/:id/force-logout — Founder Console Phase 4 ─────────────
  // Bumps User.tokenVersion so every JWT already issued for this user fails
  // AuthService.validateJwtPayload on its very next use (06-AUTH-
  // AUTHORIZATION.md: "Founder force logout invalidates via a server-side
  // tokenVersion bump"). No server-side token blocklist required.

  async forceLogout(userId: string, actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    if (actor.role !== UserRole.FOUNDER && actor.instituteId !== user.instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
    if (user.role === UserRole.FOUNDER && user.id !== actor.id) {
      throw new ForbiddenException('This action is not permitted.');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, email: true, tokenVersion: true },
    });

    await this.writeAudit(user.instituteId, actor.id, AuditAction.UPDATE, userId, undefined, { action: 'force_logout' });
    return { message: `${user.email} has been signed out of every active session.`, id: updated.id };
  }

  // Self-service variant of the above — any role, no institute/ownership
  // check needed since it only ever bumps the caller's own tokenVersion.
  // This also invalidates the JWT used to make this very request; the
  // frontend is expected to clear its local session and redirect to /login
  // immediately after this resolves.
  async logoutAllMyDevices(actor: AuthenticatedUser) {
    const updated = await this.prisma.user.update({
      where: { id: actor.id },
      data: { tokenVersion: { increment: 1 } },
      select: { id: true, email: true, tokenVersion: true },
    });
    await this.writeAudit(actor.instituteId, actor.id, AuditAction.UPDATE, actor.id, undefined, { action: 'self_logout_all_devices' });
    return { message: 'You have been signed out of every device.', id: updated.id };
  }

  private async writeAudit(instituteId: string, actorId: string, action: AuditAction, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity: 'users', entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch {
      // audit failures never block the underlying mutation (08-ERROR-HANDLING.md)
    }
  }
}
