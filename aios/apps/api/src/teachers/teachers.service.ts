import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EntitlementResource } from '../entitlements/plan-definitions';
import {
  CreateTeacherDto,
  UpdateTeacherDto,
  UpdateMyProfileDto,
  AssignBatchDto,
  QueryTeachersDto,
} from './dto/teacher.dto';

@Injectable()
export class TeachersService {
  private readonly logger = new Logger(TeachersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ── B-03: Create teacher ──────────────────────────────────────────────────

  async create(instituteId: string, dto: CreateTeacherDto, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);

    // Duplicate email check
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email, instituteId } });
    if (existing) {
      throw new ConflictException(`A user with email ${dto.email} already exists in this institute.`);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Inside the transaction, sharing `tx` with the insert — see the same
      // note in StudentsService.create: checking outside would let two
      // concurrent hires both pass the check at the plan boundary.
      await this.entitlements.assertCanCreate(instituteId, EntitlementResource.TEACHER, tx);

      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          googleSub: `local_${Date.now()}_${Math.random()}`,
          role: UserRole.TEACHER,
          instituteId,
        },
      });

      return tx.teacherProfile.create({
        data: {
          userId: user.id,
          qualification: dto.qualification,
          subjectIds: dto.subjectIds ?? [],
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'teacher_profiles', result.id, null, { email: dto.email, name: dto.name });

    return result;
  }

  // ── B-03: List teachers ───────────────────────────────────────────────────

  async findAll(instituteId: string, query: QueryTeachersDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // status ACTIVE excludes archived teachers — same defect and same reasoning
    // as students.findAll: archive() sets INACTIVE, the stats count already
    // filtered on ACTIVE, but this list did not.
    const where: Record<string, unknown> = { user: { instituteId, status: 'ACTIVE' } };

    if (query.search) {
      where['OR'] = [
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.subjectId) {
      where['subjectIds'] = { has: query.subjectId };
    }

    if (query.status) {
      where['user'] = { ...(where['user'] as object), status: query.status };
    }

    const sortDir = query.sortDir ?? 'asc';
    const orderBy =
      query.sortBy === 'qualification' ? { qualification: sortDir }
      : { user: { name: sortDir } };

    const [profiles, total] = await Promise.all([
      this.prisma.teacherProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
          batchAssignments: {
            where: { removedAt: null },
            include: { batch: { select: { id: true, name: true } } },
          },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.teacherProfile.count({ where }),
    ]);

    return {
      data: profiles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Roster stats — real aggregates for the Admin overview/analytics screens ─

  async getStats(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const [total, active, profiles, subjects] = await Promise.all([
      this.prisma.teacherProfile.count({ where: { user: { instituteId } } }),
      this.prisma.teacherProfile.count({ where: { user: { instituteId, status: 'ACTIVE' } } }),
      this.prisma.teacherProfile.findMany({
        where: { user: { instituteId } },
        select: {
          subjectIds: true,
          batchAssignments: { where: { removedAt: null }, select: { id: true } },
        },
      }),
      this.prisma.subject.findMany({ where: { instituteId, deletedAt: null }, select: { id: true, name: true } }),
    ]);

    const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
    const bySubject = new Map<string, number>();
    let unassigned = 0;
    for (const p of profiles) {
      if (p.subjectIds.length === 0) unassigned++;
      for (const subjectId of p.subjectIds) {
        const name = subjectNameById.get(subjectId) ?? 'Unknown subject';
        bySubject.set(name, (bySubject.get(name) ?? 0) + 1);
      }
    }

    const withBatchAssignment = profiles.filter((p) => p.batchAssignments.length > 0).length;

    return {
      total,
      active,
      inactive: total - active,
      unassignedToSubject: unassigned,
      withBatchAssignment,
      withoutBatchAssignment: total - withBatchAssignment,
      bySubject: Array.from(bySubject.entries()).map(([subject, count]) => ({ subject, count })),
    };
  }

  // ── Archive (soft-delete) ─────────────────────────────────────────────────

  async archive(instituteId: string, profileId: string, actor: AuthenticatedUser) {
    this.assertAdminAccess(actor, instituteId);

    const profile = await this.getProfileWithTenantCheck(profileId, instituteId);

    await this.prisma.user.update({ where: { id: profile.userId }, data: { status: 'INACTIVE' } });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'teacher_profiles', profileId, null, { archived: true });

    return { message: 'Teacher archived successfully.' };
  }

  // ── B-03: Get one teacher ─────────────────────────────────────────────────

  async findById(instituteId: string, profileId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const profile = await this.prisma.teacherProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true, createdAt: true } },
        batchAssignments: {
          where: { removedAt: null },
          include: {
            batch: { select: { id: true, name: true, classYear: true } },
          },
        },
      },
    });

    if (!profile) throw new NotFoundException('Teacher profile not found.');

    const userRecord = await this.prisma.user.findUnique({ where: { id: profile.userId } });
    if (!userRecord || userRecord.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return profile;
  }

  // ── Self-service: a teacher viewing/editing their own profile ─────────────
  // (no admin gate — scoped entirely by resolving the profile from actor.id,
  // never a profileId the caller supplies)

  async findMyProfile(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw new NotFoundException('Teacher profile not found.');
    return this.findById(instituteId, profile.id, actor);
  }

  async updateMyProfile(instituteId: string, dto: UpdateMyProfileDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId: actor.id } });
    if (!profile) throw new NotFoundException('Teacher profile not found.');

    await this.prisma.$transaction(async (tx) => {
      if (dto.name) {
        await tx.user.update({ where: { id: actor.id }, data: { name: dto.name } });
      }
      if (dto.qualification !== undefined) {
        await tx.teacherProfile.update({ where: { id: profile.id }, data: { qualification: dto.qualification } });
      }
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'teacher_profiles', profile.id, null, dto);

    return this.findById(instituteId, profile.id, actor);
  }

  // ── B-03: Update teacher ──────────────────────────────────────────────────

  async update(
    instituteId: string,
    profileId: string,
    dto: UpdateTeacherDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);

    const profile = await this.getProfileWithTenantCheck(profileId, instituteId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.name) {
        await tx.user.update({ where: { id: profile.userId }, data: { name: dto.name } });
      }
      await tx.teacherProfile.update({
        where: { id: profileId },
        data: {
          ...(dto.qualification !== undefined && { qualification: dto.qualification }),
          ...(dto.subjectIds !== undefined && { subjectIds: dto.subjectIds }),
        },
      });
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'teacher_profiles', profileId, null, dto);

    return this.findById(instituteId, profileId, actor);
  }

  // ── B-04: Assign teacher to batch ─────────────────────────────────────────

  async assignToBatch(
    instituteId: string,
    profileId: string,
    dto: AssignBatchDto,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);

    const profile = await this.getProfileWithTenantCheck(profileId, instituteId);
    const batch = await this.prisma.batch.findUnique({ where: { id: dto.batchId } });

    if (!batch || batch.instituteId !== instituteId) {
      throw new NotFoundException('Batch not found in this institute.');
    }

    const existing = await this.prisma.batchTeacher.findFirst({
      where: {
        batchId: dto.batchId,
        teacherProfileId: profileId,
        subjectId: dto.subjectId ?? null,
        removedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException('Teacher is already assigned to this batch for this subject.');
    }

    const assignment = await this.prisma.batchTeacher.create({
      data: {
        batchId: dto.batchId,
        teacherProfileId: profileId,
        subjectId: dto.subjectId,
      },
      include: { batch: { select: { id: true, name: true } } },
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'batch_teachers', assignment.id, null, { batchId: dto.batchId, teacherProfileId: profileId });

    return assignment;
  }

  // ── B-04: Remove teacher from batch ──────────────────────────────────────

  async removeFromBatch(
    instituteId: string,
    profileId: string,
    batchTeacherId: string,
    actor: AuthenticatedUser,
  ) {
    this.assertAdminAccess(actor, instituteId);

    await this.getProfileWithTenantCheck(profileId, instituteId);

    const assignment = await this.prisma.batchTeacher.findUnique({ where: { id: batchTeacherId } });
    if (!assignment || assignment.teacherProfileId !== profileId) {
      throw new NotFoundException('Batch assignment not found.');
    }

    // Soft-delete — preserve history
    await this.prisma.batchTeacher.update({
      where: { id: batchTeacherId },
      data: { removedAt: new Date() },
    });

    return { message: 'Teacher removed from batch.' };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertAdminAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.role !== UserRole.ADMIN || actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private async getProfileWithTenantCheck(profileId: string, instituteId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, instituteId: true } } },
    });
    if (!profile) throw new NotFoundException('Teacher profile not found.');
    if (profile.user.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
    return profile;
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
          oldValue: oldValue ? (oldValue as Prisma.InputJsonValue) : undefined,
          newValue: newValue ? (newValue as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Audit log write failed', err);
    }
  }
}
