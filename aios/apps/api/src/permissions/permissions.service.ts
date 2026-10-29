import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  CreatePermissionGrantDto,
  CreateBulkPermissionGrantsDto,
  SyncUserPermissionsDto,
  CreateCustomRoleDto,
  UpdateCustomRoleDto,
  AssignRoleDto,
  SimulateAccessDto,
  RevokeBulkGrantsDto,
} from './dto/permission.dto';
import {
  CANONICAL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  ROLE_TEMPLATES,
  RoleTemplate,
} from './permissions.constants';

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. Single Grant ───────────────────────────────────────────────────────
  async grant(instituteId: string, dto: CreatePermissionGrantDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || user.instituteId !== instituteId) {
      throw new NotFoundException('User not found in this institute');
    }

    await this.validateScopeReferences(instituteId, dto.batchId, dto.subjectId);

    const existing = await this.prisma.userPermissionGrant.findFirst({
      where: {
        userId: dto.userId,
        permission: dto.permission,
        batchId: dto.batchId ?? null,
        subjectId: dto.subjectId ?? null,
      },
    });

    if (existing) {
      return existing;
    }

    const grant = await this.prisma.userPermissionGrant.create({
      data: {
        userId: dto.userId,
        permission: dto.permission,
        batchId: dto.batchId ?? null,
        subjectId: dto.subjectId ?? null,
        grantedByUserId: actor.id,
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'user_permission_grants', grant.id, null, {
      userId: dto.userId,
      permission: dto.permission,
      batchId: dto.batchId,
      subjectId: dto.subjectId,
    });

    return grant;
  }

  // ── 2. Bulk Grants ────────────────────────────────────────────────────────
  async grantBulk(instituteId: string, dto: CreateBulkPermissionGrantsDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user || user.instituteId !== instituteId) {
      throw new NotFoundException('User not found in this institute');
    }

    await this.validateScopeReferences(instituteId, dto.batchId, dto.subjectId);

    const createdGrants = await this.prisma.$transaction(async (tx) => {
      const results = [];
      for (const permission of dto.permissions) {
        const existing = await tx.userPermissionGrant.findFirst({
          where: {
            userId: dto.userId,
            permission,
            batchId: dto.batchId ?? null,
            subjectId: dto.subjectId ?? null,
          },
        });

        if (!existing) {
          const g = await tx.userPermissionGrant.create({
            data: {
              userId: dto.userId,
              permission,
              batchId: dto.batchId ?? null,
              subjectId: dto.subjectId ?? null,
              grantedByUserId: actor.id,
            },
          });
          results.push(g);
        }
      }
      return results;
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.CREATE,
      'user_permission_grants',
      dto.userId,
      null,
      {
        userId: dto.userId,
        permissionsCount: createdGrants.length,
        permissions: dto.permissions,
        batchId: dto.batchId,
        subjectId: dto.subjectId,
      },
    );

    return {
      success: true,
      grantedCount: createdGrants.length,
      grants: createdGrants,
    };
  }

  // ── 3. Sync / Replace User Permissions ────────────────────────────────────
  async syncUserPermissions(instituteId: string, dto: SyncUserPermissionsDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const targetUser = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!targetUser || targetUser.instituteId !== instituteId) {
      throw new NotFoundException('Target user not found in this institute');
    }

    // Anti-lockout guard: Verify we are not removing the last administrator
    if (targetUser.role === UserRole.ADMIN && dto.grants.length === 0) {
      const activeAdminCount = await this.prisma.user.count({
        where: {
          instituteId,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });
      if (activeAdminCount <= 1) {
        throw new BadRequestException(
          'Cannot strip permissions from the sole active administrator of this institute.',
        );
      }
    }

    const currentGrants = await this.prisma.userPermissionGrant.findMany({
      where: { userId: dto.userId },
    });

    for (const g of dto.grants) {
      await this.validateScopeReferences(instituteId, g.batchId, g.subjectId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.userPermissionGrant.deleteMany({
        where: { userId: dto.userId },
      });

      const newRecords = [];
      for (const g of dto.grants) {
        const created = await tx.userPermissionGrant.create({
          data: {
            userId: dto.userId,
            permission: g.permission,
            batchId: g.batchId ?? null,
            subjectId: g.subjectId ?? null,
            grantedByUserId: actor.id,
          },
        });
        newRecords.push(created);
      }
      return newRecords;
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'user_permission_grants',
      dto.userId,
      { count: currentGrants.length, grants: currentGrants.map((g) => g.permission) },
      { count: updated.length, grants: updated.map((g) => g.permission) },
    );

    return {
      success: true,
      userId: dto.userId,
      activeGrantsCount: updated.length,
      grants: updated,
    };
  }

  // ── 4. Find All Institute Grants ──────────────────────────────────────────
  async findAll(instituteId: string, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const grants = await this.prisma.userPermissionGrant.findMany({
      where: { user: { instituteId } },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, avatarUrl: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const [batches, subjects] = await Promise.all([
      this.prisma.batch.findMany({
        where: { instituteId },
        select: { id: true, name: true },
      }),
      this.prisma.subject.findMany({
        where: { instituteId },
        select: { id: true, name: true },
      }),
    ]);

    const batchMap = new Map(batches.map((b) => [b.id, b.name]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    return grants.map((g) => ({
      ...g,
      batchName: g.batchId ? batchMap.get(g.batchId) ?? 'Unknown Batch' : null,
      subjectName: g.subjectId ? subjectMap.get(g.subjectId) ?? 'Unknown Subject' : null,
    }));
  }

  // ── 5. Revoke Single Grant ────────────────────────────────────────────────
  async revoke(instituteId: string, grantId: string, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const grant = await this.prisma.userPermissionGrant.findUnique({
      where: { id: grantId },
      include: { user: true },
    });
    if (!grant || grant.user.instituteId !== instituteId) {
      throw new NotFoundException('Permission grant not found.');
    }

    await this.prisma.userPermissionGrant.delete({
      where: { id: grantId },
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.DELETE,
      'user_permission_grants',
      grantId,
      {
        userId: grant.userId,
        permission: grant.permission,
        batchId: grant.batchId,
        subjectId: grant.subjectId,
      },
      null,
    );

    return { success: true, revokedId: grantId };
  }

  // ── 6. Revoke Bulk Grants ─────────────────────────────────────────────────
  async revokeBulk(instituteId: string, dto: RevokeBulkGrantsDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const grants = await this.prisma.userPermissionGrant.findMany({
      where: {
        id: { in: dto.grantIds },
        user: { instituteId },
      },
    });

    if (grants.length === 0) {
      return { success: true, revokedCount: 0 };
    }

    await this.prisma.userPermissionGrant.deleteMany({
      where: { id: { in: grants.map((g) => g.id) } },
    });

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.DELETE,
      'user_permission_grants',
      dto.grantIds.join(','),
      { revokedCount: grants.length, ids: grants.map((g) => g.id) },
      null,
    );

    return { success: true, revokedCount: grants.length };
  }

  // ── 7. Caller's Own Grants ────────────────────────────────────────────────
  async findMyGrants(instituteId: string, actor: AuthenticatedUser) {
    if (actor.role === UserRole.FOUNDER) {
      return { bypassesAllGrants: true, grants: [] };
    }
    const grants = await this.prisma.userPermissionGrant.findMany({
      where: { userId: actor.id, user: { instituteId } },
      select: { permission: true, batchId: true, subjectId: true },
    });
    return { bypassesAllGrants: false, grants };
  }

  // ── 8. Direct Permission Check ────────────────────────────────────────────
  async hasPermission(
    userId: string,
    permission: string,
    scope: { batchId?: string; subjectId?: string } = {},
  ): Promise<boolean> {
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

  // ── 9. Role Management (Built-in + Templates + Custom Roles) ──────────────
  async getRoles(instituteId: string, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const customRoles = await this.getCustomRolesFromStore(instituteId);

    // Compute user counts per role template or base role
    const users = await this.prisma.user.findMany({
      where: { instituteId },
      select: { id: true, role: true },
    });

    const grants = await this.prisma.userPermissionGrant.findMany({
      where: { user: { instituteId } },
      select: { userId: true, permission: true },
    });

    const userGrantsMap = new Map<string, Set<string>>();
    for (const g of grants) {
      if (!userGrantsMap.has(g.userId)) {
        userGrantsMap.set(g.userId, new Set());
      }
      userGrantsMap.get(g.userId)!.add(g.permission);
    }

    const allTemplates: RoleTemplate[] = [...ROLE_TEMPLATES, ...customRoles];

    const enrichedTemplates = allTemplates.map((tpl) => {
      let matchingUsers = 0;
      if (tpl.slug === 'institute_admin') {
        matchingUsers = users.filter((u) => u.role === UserRole.ADMIN).length;
      } else if (tpl.slug === 'class_teacher') {
        matchingUsers = users.filter((u) => u.role === UserRole.TEACHER).length;
      } else {
        // Users having all core permissions of this template
        const corePerms = tpl.permissions.slice(0, 3);
        matchingUsers = Array.from(userGrantsMap.entries()).filter(([_, permSet]) =>
          corePerms.every((p) => permSet.has(p)),
        ).length;
      }

      return {
        ...tpl,
        userCount: matchingUsers,
      };
    });

    return {
      templates: enrichedTemplates,
      canonicalPermissions: CANONICAL_PERMISSIONS,
      categories: PERMISSION_CATEGORIES,
    };
  }

  async createCustomRole(instituteId: string, dto: CreateCustomRoleDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const customRoles = await this.getCustomRolesFromStore(instituteId);
    const slug = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    if (
      ROLE_TEMPLATES.some((t) => t.slug === slug || t.name.toLowerCase() === dto.name.toLowerCase()) ||
      customRoles.some((c) => c.slug === slug || c.name.toLowerCase() === dto.name.toLowerCase())
    ) {
      throw new BadRequestException(`A role named "${dto.name}" already exists.`);
    }

    const newRole: RoleTemplate = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: dto.name.trim(),
      slug,
      description: dto.description?.trim() ?? '',
      baseRole: dto.baseRole as 'ADMIN' | 'TEACHER' | 'STUDENT',
      isSystem: false,
      permissions: dto.permissions,
      defaultScope: dto.defaultScope ?? 'INSTITUTE',
    };

    const updatedRoles = [...customRoles, newRole];
    await this.saveCustomRolesToStore(instituteId, updatedRoles, actor.id);

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.CREATE,
      'custom_roles',
      newRole.id,
      null,
      newRole,
    );

    return newRole;
  }

  async updateCustomRole(
    instituteId: string,
    roleId: string,
    dto: UpdateCustomRoleDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminOrFounder(actor, instituteId);

    if (ROLE_TEMPLATES.some((t) => t.id === roleId)) {
      throw new ForbiddenException('Built-in system roles and core templates cannot be edited.');
    }

    const customRoles = await this.getCustomRolesFromStore(instituteId);
    const idx = customRoles.findIndex((r) => r.id === roleId);
    if (idx === -1) {
      throw new NotFoundException('Custom role not found.');
    }

    const existingRole = customRoles[idx]!;
    const updatedRole: RoleTemplate = {
      ...existingRole,
      name: dto.name ? dto.name.trim() : existingRole.name,
      description: dto.description !== undefined ? dto.description.trim() : existingRole.description,
      permissions: dto.permissions ?? existingRole.permissions,
      defaultScope: dto.defaultScope ?? existingRole.defaultScope,
    };

    customRoles[idx] = updatedRole;
    await this.saveCustomRolesToStore(instituteId, customRoles, actor.id);

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'custom_roles',
      roleId,
      existingRole,
      updatedRole,
    );

    return updatedRole;
  }

  async deleteCustomRole(instituteId: string, roleId: string, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    if (ROLE_TEMPLATES.some((t) => t.id === roleId)) {
      throw new ForbiddenException('Built-in system roles cannot be deleted.');
    }

    const customRoles = await this.getCustomRolesFromStore(instituteId);
    const existing = customRoles.find((r) => r.id === roleId);
    if (!existing) {
      throw new NotFoundException('Custom role not found.');
    }

    const remainingRoles = customRoles.filter((r) => r.id !== roleId);
    await this.saveCustomRolesToStore(instituteId, remainingRoles, actor.id);

    await this.writeAudit(
      instituteId,
      actor.id,
      AuditAction.DELETE,
      'custom_roles',
      roleId,
      existing,
      null,
    );

    return { success: true, deletedId: roleId };
  }

  async duplicateRole(instituteId: string, roleId: string, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const allRoles = [...ROLE_TEMPLATES, ...(await this.getCustomRolesFromStore(instituteId))];
    const sourceRole = allRoles.find((r) => r.id === roleId);
    if (!sourceRole) {
      throw new NotFoundException('Source role not found.');
    }

    const duplicatedDto: CreateCustomRoleDto = {
      name: `${sourceRole.name} (Copy)`,
      description: `Customized duplicate of ${sourceRole.name}`,
      baseRole: sourceRole.baseRole as UserRole,
      permissions: [...sourceRole.permissions],
      defaultScope: sourceRole.defaultScope,
    };

    return this.createCustomRole(instituteId, duplicatedDto, actor);
  }

  async assignRoleToUser(instituteId: string, roleId: string, dto: AssignRoleDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const allRoles = [...ROLE_TEMPLATES, ...(await this.getCustomRolesFromStore(instituteId))];
    const role = allRoles.find((r) => r.id === roleId);
    if (!role) {
      throw new NotFoundException('Role template not found.');
    }

    return this.grantBulk(
      instituteId,
      {
        userId: dto.userId,
        permissions: role.permissions,
        batchId: dto.batchId,
        subjectId: dto.subjectId,
      },
      actor,
    );
  }

  // ── 10. Permission Simulation & Impact Analysis ───────────────────────────
  async simulateAccess(instituteId: string, dto: SimulateAccessDto, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const effectivePermissions = new Set<string>();
    let targetUser: any = null;

    if (dto.userId) {
      targetUser = await this.prisma.user.findUnique({
        where: { id: dto.userId },
        include: {
          permissionGrants: true,
          teacherProfile: { include: { batchAssignments: true } },
        },
      });
      if (targetUser) {
        targetUser.permissionGrants.forEach((g: any) => effectivePermissions.add(g.permission));
      }
    }

    if (dto.roleId) {
      const allRoles = [...ROLE_TEMPLATES, ...(await this.getCustomRolesFromStore(instituteId))];
      const role = allRoles.find((r) => r.id === dto.roleId);
      if (role) {
        role.permissions.forEach((p) => effectivePermissions.add(p));
      }
    }

    if (dto.permissions && dto.permissions.length > 0) {
      dto.permissions.forEach((p) => effectivePermissions.add(p));
    }

    const permKeys = Array.from(effectivePermissions);
    const activeDetails = CANONICAL_PERMISSIONS.filter((p) => permKeys.includes(p.key));

    const accessibleModules: string[] = [];
    if (permKeys.some((p) => p.startsWith('batch:') || p.startsWith('timetable:') || p.startsWith('curriculum:'))) {
      accessibleModules.push('Batches & Timetable');
    }
    if (permKeys.some((p) => p.startsWith('question:') || p.startsWith('paper:'))) {
      accessibleModules.push('Question Bank & Papers');
    }
    if (permKeys.some((p) => p.startsWith('exam:') || p.startsWith('assignment:'))) {
      accessibleModules.push('Exams & Assessments');
    }
    if (permKeys.some((p) => p.startsWith('evaluation:') || p === 'REVIEW_EVALUATION')) {
      accessibleModules.push('Evaluation Queue');
    }
    if (permKeys.some((p) => p.startsWith('ATTENDANCE_'))) {
      accessibleModules.push('Attendance Management');
    }
    if (permKeys.some((p) => p.startsWith('student:'))) {
      accessibleModules.push('Students & Admissions');
    }
    if (permKeys.some((p) => p.startsWith('teacher:') || p === 'staff:view_all')) {
      accessibleModules.push('Faculty & Staff Directory');
    }
    if (permKeys.some((p) => p.startsWith('report:') || p.startsWith('analytics:'))) {
      accessibleModules.push('Analytics & Reports Hub');
    }
    if (permKeys.some((p) => p.startsWith('access:') || p.startsWith('settings:') || p === 'audit:view')) {
      accessibleModules.push('System Settings & Governance');
    }

    const sensitiveFlags = activeDetails
      .filter((p) => p.risk === 'critical' || p.risk === 'sensitive')
      .map((p) => ({
        permission: p.key,
        label: p.label,
        risk: p.risk,
        warning:
          p.key === 'exam:unlock'
            ? 'Can bypass evaluation locks and reopen locked student deliveries'
            : p.key === 'REVIEW_EVALUATION'
            ? 'Can override teacher-evaluated marks and dispute scores'
            : p.key === 'ATTENDANCE_CORRECT_HISTORICAL'
            ? 'Can modify historical attendance records retroactively'
            : p.key === 'student:view_pii'
            ? 'Can view confidential student and guardian phone/email PII'
            : p.description,
      }));

    return {
      userId: dto.userId,
      roleId: dto.roleId,
      totalGrantedCount: permKeys.length,
      accessibleModules,
      activePermissions: activeDetails,
      sensitiveFlags,
      scope: {
        batchId: dto.batchId ?? 'INSTITUTE_WIDE',
        subjectId: dto.subjectId ?? 'ALL_SUBJECTS',
      },
    };
  }

  // ── 11. Permission Audit Trail ────────────────────────────────────────────
  async getAuditTrail(instituteId: string, actor: AuthenticatedUser) {
    this.assertAdminOrFounder(actor, instituteId);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        instituteId,
        entity: { in: ['user_permission_grants', 'custom_roles', 'allow_list_entries'] },
      },
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      actorName: log.actor.name,
      actorEmail: log.actor.email,
      oldValue: log.oldValue,
      newValue: log.newValue,
      createdAt: log.createdAt,
    }));
  }

  // ── Helper Utilities ──────────────────────────────────────────────────────
  private assertAdminOrFounder(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.role !== UserRole.ADMIN || actor.instituteId !== instituteId) {
      throw new ForbiddenException('Only institute administrators can manage permissions.');
    }
  }

  private async validateScopeReferences(instituteId: string, batchId?: string, subjectId?: string) {
    if (batchId) {
      const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
      if (!batch || batch.instituteId !== instituteId) {
        throw new NotFoundException('Target batch not found in this institute.');
      }
    }
    if (subjectId) {
      const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
      if (!subject || subject.instituteId !== instituteId) {
        throw new NotFoundException('Target subject not found in this institute.');
      }
    }
  }

  private async getCustomRolesFromStore(instituteId: string): Promise<RoleTemplate[]> {
    try {
      const setting = await this.prisma.platformSetting.findUnique({
        where: { key: `institute_roles:${instituteId}` },
      });
      if (setting && Array.isArray(setting.value)) {
        return setting.value as unknown as RoleTemplate[];
      }
    } catch (err) {
      this.logger.warn(`Failed to read custom roles for institute ${instituteId}`, err as Error);
    }
    return [];
  }

  private async saveCustomRolesToStore(
    instituteId: string,
    roles: RoleTemplate[],
    actorId: string,
  ): Promise<void> {
    await this.prisma.platformSetting.upsert({
      where: { key: `institute_roles:${instituteId}` },
      create: {
        key: `institute_roles:${instituteId}`,
        value: roles as any,
        updatedByUserId: actorId,
      },
      update: {
        value: roles as any,
        updatedByUserId: actorId,
      },
    });
  }

  private async writeAudit(
    instituteId: string,
    actorId: string,
    action: AuditAction,
    entity: string,
    entityId: string,
    oldValue: unknown,
    newValue: unknown,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          instituteId,
          actorId,
          action,
          entity,
          entityId,
          oldValue: oldValue as any,
          newValue: newValue as any,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
