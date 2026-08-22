import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreatePermissionGrantDto } from './dto/permission.dto';

/**
 * 21-DOMAIN-MODEL-V2.md §4.10 — see the schema-level comment on
 * UserPermissionGrant for why this is a minimal, additive mechanism rather
 * than the full generic Role/Permission/Scope framework the doc sketches
 * (whose concrete schema is deferred to a 06B doc that doesn't exist yet).
 * The 4-role enum stays authoritative for baseline access; this layers a
 * named, optionally-scoped grant on top for capabilities a base role
 * doesn't automatically carry — e.g. REVIEW_EVALUATION (25 §4.3: "not
 * necessarily a new hardcoded role, could be an ADMIN or a delegated
 * senior TEACHER granted this permission").
 */
@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async grant(instituteId: string, dto: CreatePermissionGrantDto, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can grant permissions.');
    }
    this.assertInstituteAccess(actor, instituteId);

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || user.instituteId !== instituteId) throw new NotFoundException('User not found');

    const grant = await this.prisma.userPermissionGrant.create({
      data: {
        userId: dto.userId,
        permission: dto.permission,
        batchId: dto.batchId,
        subjectId: dto.subjectId,
        grantedByUserId: actor.id,
      },
    });

    await this.writeAudit(instituteId, actor.id, grant.id, { userId: dto.userId, permission: dto.permission, batchId: dto.batchId, subjectId: dto.subjectId });

    return grant;
  }

  async findAll(instituteId: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.FOUNDER) {
      throw new ForbiddenException('Only admins can view permission grants.');
    }
    this.assertInstituteAccess(actor, instituteId);

    return this.prisma.userPermissionGrant.findMany({
      where: { user: { instituteId } },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Institute-wide grant (batchId=null, subjectId=null) covers everything; a scoped grant only covers a matching scope. FOUNDER/ADMIN role alone never implies a permission — callers check role bypass separately if intended. */
  async hasPermission(userId: string, permission: string, scope: { batchId?: string; subjectId?: string } = {}): Promise<boolean> {
    const grant = await this.prisma.userPermissionGrant.findFirst({
      where: {
        userId,
        permission,
        AND: [
          { OR: [{ batchId: null }, { batchId: scope.batchId }] },
          { OR: [{ subjectId: null }, { subjectId: scope.subjectId }] },
        ],
      },
    });
    return !!grant;
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) throw new ForbiddenException("You don't have access to this.");
  }

  private async writeAudit(instituteId: string, actorId: string, entityId: string, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action: AuditAction.CREATE, entity: 'user_permission_grants', entityId, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for user_permission_grants:${entityId}`, err as Error);
    }
  }
}
