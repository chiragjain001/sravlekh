import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, UserRole, UserStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { getTeacherBatchIds } from '../shared/teacher-scope';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { EntitlementResource } from '../entitlements/plan-definitions';
import {
  CreateStudentDto,
  UpdateStudentDto,
  TransferBatchDto,
  UpdateTagsDto,
  QueryStudentsDto,
  STUDENT_TAG_VALUES,
} from './dto/student.dto';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  // ── B-01: Create student ─────────────────────────────────────────────────

  async create(instituteId: string, dto: CreateStudentDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    this.validateTags(dto.tags);

    // Validate batch belongs to this institute
    if (dto.batchId) {
      await this.assertBatchBelongsToInstitute(dto.batchId, instituteId);
    }

    // Check for duplicate email within institute
    const existingUser = await this.prisma.user.findFirst({
      where: { email: dto.email, instituteId },
    });
    if (existingUser) {
      throw new ConflictException(
        `A student with email ${dto.email} already exists in this institute.`,
      );
    }

    // Create user + student profile in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Plan enforcement runs INSIDE the transaction, sharing `tx` with the
      // insert below, so the count and the create are one atomic decision.
      // Checking before the transaction would be a TOCTOU race: two concurrent
      // enrolments at the plan boundary would both read the same count, both
      // pass, and both write — silently overshooting the customer's plan.
      await this.entitlements.assertCanCreate(instituteId, EntitlementResource.STUDENT, tx);

      const user = await tx.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          googleSub: `local_${Date.now()}_${Math.random()}`, // placeholder until Google login
          role: UserRole.STUDENT,
          instituteId,
        },
      });

      const profile = await tx.studentProfile.create({
        data: {
          userId: user.id,
          rollNumber: dto.rollNumber,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          guardianEmail: dto.guardianEmail,
          address: dto.address,
          batchId: dto.batchId,
          tags: dto.tags ?? [],
        },
        include: { user: { select: { id: true, name: true, email: true, role: true } }, batch: true },
      });

      return profile;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.CREATE, 'student_profiles', result.id, null, { email: dto.email, name: dto.name });

    return result;
  }

  // ── B-01: List students with search/filter (B-02) ─────────────────────────

  async findAll(instituteId: string, query: QueryStudentsDto, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause.
    //
    // status ACTIVE excludes archived students. Without it, `archive()` (which
    // sets User.status = INACTIVE) left the student in this list forever, while
    // the stats endpoint below already counted only ACTIVE — so the dashboard
    // total and the list it links to disagreed, and a "deleted" student still
    // appeared on the roster.
    const where: Record<string, unknown> = {
      user: { instituteId, status: 'ACTIVE' },
    };

    // Teachers only see students in their own batches — ADMIN/FOUNDER keep
    // institute-wide visibility, unaffected by this branch.
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    if (teacherBatchIds !== null) {
      where['batchId'] = query.batchId
        ? { in: teacherBatchIds.includes(query.batchId) ? [query.batchId] : [] }
        : { in: teacherBatchIds };
    } else if (query.batchId) {
      where['batchId'] = query.batchId;
    }

    if (query.search) {
      where['OR'] = [
        { user: { name: { contains: query.search, mode: 'insensitive' } } },
        { user: { email: { contains: query.search, mode: 'insensitive' } } },
        { rollNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Tag filter — student must have ALL requested tags
    if (query.tags && query.tags.length > 0) {
      where['tags'] = { hasEvery: query.tags };
    }

    if (query.status) {
      where['user'] = { ...(where['user'] as object), status: query.status };
    }

    const sortDir = query.sortDir ?? 'asc';
    const orderBy =
      query.sortBy === 'rollNumber' ? { rollNumber: sortDir }
      : query.sortBy === 'admissionDate' ? { admissionDate: sortDir }
      : { user: { name: sortDir } };

    const [profiles, total] = await Promise.all([
      this.prisma.studentProfile.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
          batch: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.studentProfile.count({ where }),
    ]);

    return {
      data: profiles,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Roster stats — real aggregates for the Admin overview/analytics screens ─

  async getStats(instituteId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    const scopeWhere: Record<string, unknown> = { user: { instituteId } };
    if (teacherBatchIds !== null) {
      scopeWhere['batchId'] = { in: teacherBatchIds };
    }

    // The enrollment histogram below only plots the last 6 months, so bound the
    // query to that window instead of reading every admissionDate ever recorded.
    // Previously one findMany pulled { tags, admissionDate } for EVERY student in
    // the institute on each dashboard load and discarded all but 6 months of the
    // dates in application memory — invisible on a demo tenant, linear in student
    // count in production.
    // Exactly the earliest bucket the histogram builds below: 5 months back,
    // first of that month. Kept in step with that loop deliberately — a wider
    // window would refetch rows the loop discards, a narrower one would drop
    // rows it wants to count.
    const statsNow = new Date();
    const enrollmentWindowStart = new Date(statsNow.getFullYear(), statsNow.getMonth() - 5, 1);

    // Roster-facing aggregates count only ACTIVE students, matching findAll and
    // the dashboard cards. `total` stays unfiltered so `inactive: total - active`
    // below remains meaningful — it is the one figure that is *about* archived
    // students rather than a roster the admin can click through to.
    const activeScope = { ...scopeWhere, user: { instituteId, status: UserStatus.ACTIVE } };

    const [total, active, byBatch, recentlyAdmitted, tagRows, enrollmentRows] = await Promise.all([
      this.prisma.studentProfile.count({ where: scopeWhere }),
      this.prisma.studentProfile.count({ where: activeScope }),
      this.prisma.studentProfile.groupBy({
        by: ['batchId'],
        where: activeScope,
        _count: { _all: true },
      }),
      this.prisma.studentProfile.count({
        where: { ...activeScope, admissionDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
      // Tag frequency still needs every row — tags is a scalar array, so Postgres
      // can aggregate it only via unnest, which cannot express the teacher batch
      // scoping above without hand-written SQL. Narrowed to the single small
      // column; see the scalability note in the audit report for the raw-SQL
      // follow-up if institutes grow past a few thousand students.
      this.prisma.studentProfile.findMany({ where: activeScope, select: { tags: true } }),
      this.prisma.studentProfile.findMany({
        where: { ...activeScope, admissionDate: { gte: enrollmentWindowStart } },
        select: { admissionDate: true },
      }),
    ]);

    const batchIds = byBatch.map((b) => b.batchId).filter((id): id is string => !!id);
    const batches = batchIds.length
      ? await this.prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, name: true } })
      : [];
    const batchNameById = new Map(batches.map((b) => [b.id, b.name]));

    const tagCounts = new Map<string, number>();
    for (const p of tagRows) {
      for (const tag of p.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }

    const enrollmentByMonth = new Map<string, number>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      enrollmentByMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
    }
    for (const p of enrollmentRows) {
      const d = p.admissionDate;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (enrollmentByMonth.has(key)) enrollmentByMonth.set(key, (enrollmentByMonth.get(key) ?? 0) + 1);
    }

    return {
      total,
      active,
      inactive: total - active,
      newLast30Days: recentlyAdmitted,
      byBatch: byBatch.map((b) => ({
        batchId: b.batchId,
        batchName: b.batchId ? (batchNameById.get(b.batchId) ?? 'Unknown batch') : 'Unassigned',
        count: b._count._all,
      })),
      byTag: Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })),
      enrollmentByMonth: Array.from(enrollmentByMonth.entries()).map(([month, count]) => ({ month, count })),
    };
  }

  // ── B-01: Get single student ──────────────────────────────────────────────

  async findById(instituteId: string, profileId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.assertTeacherOwnsStudentIfTeacher(actor, profileId);
    await this.assertStudentOwnsProfileIfStudent(actor, profileId);

    // 32-AI-GOVERNANCE-POLICY.md §5: a student sees only finalized results — never a
    // provisional ScoreRecord. ScoreAggregationService recomputes on every evaluation
    // write, so a v2 attempt mid-review carries a real but incomplete percentage
    // (isFinalized=false until every subjective response is human-approved); showing
    // it to the student would present work-in-progress as their result. Staff keep
    // full visibility — reviewing in-progress scoring is their job. This method backs
    // both GET /students/me and GET /students/:profileId, so it is the one chokepoint.
    const scoreRecordsWhere = actor.role === UserRole.STUDENT ? { isFinalized: true } : undefined;

    const profile = await this.prisma.studentProfile.findUnique({
      where: { id: profileId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true } },
        batch: true,
        profileHistory: { orderBy: { changedAt: 'desc' }, take: 20 },
        masteryScores: {
          include: { topic: { select: { name: true } }, subject: { select: { name: true } } },
          orderBy: { lastUpdatedAt: 'desc' },
          take: 10,
        },
        scoreRecords: {
          where: scoreRecordsWhere,
          include: { exam: { select: { id: true, title: true, scheduledDate: true, type: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!profile) throw new NotFoundException('Student profile not found.');

    // Tenant isolation check
    const userRecord = await this.prisma.user.findUnique({ where: { id: profile.userId } });
    if (!userRecord || userRecord.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return profile;
  }

  // ── B-01: Update student profile (with history protection) ────────────────

  async update(
    instituteId: string,
    profileId: string,
    dto: UpdateStudentDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const existing = await this.getProfileWithTenantCheck(profileId, instituteId);

    // Capture old values for history
    const oldValues: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    const trackableFields: Array<keyof UpdateStudentDto> = [
      'name', 'rollNumber', 'dateOfBirth', 'guardianName',
      'guardianPhone', 'guardianEmail', 'address',
    ];

    for (const field of trackableFields) {
      if (dto[field] !== undefined && dto[field] !== (existing as Record<string, unknown>)[field]) {
        oldValues[field] = (existing as Record<string, unknown>)[field];
        changes[field] = dto[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      return existing; // No changes — return as-is, no history entry needed
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Update the user name if provided
      if (dto.name) {
        await tx.user.update({ where: { id: existing.userId }, data: { name: dto.name } });
      }

      const updatedProfile = await tx.studentProfile.update({
        where: { id: profileId },
        data: {
          ...(dto.rollNumber !== undefined && { rollNumber: dto.rollNumber }),
          ...(dto.dateOfBirth !== undefined && { dateOfBirth: new Date(dto.dateOfBirth) }),
          ...(dto.guardianName !== undefined && { guardianName: dto.guardianName }),
          ...(dto.guardianPhone !== undefined && { guardianPhone: dto.guardianPhone }),
          ...(dto.guardianEmail !== undefined && { guardianEmail: dto.guardianEmail }),
          ...(dto.address !== undefined && { address: dto.address }),
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          batch: true,
        },
      });

      // Write history record — this is the history protection mechanism
      await tx.studentHistory.create({
        data: {
          studentProfileId: profileId,
          eventType: 'PROFILE_UPDATE',
          description: `Profile updated by ${actor.name}`,
          oldValue: JSON.stringify(oldValues),
          newValue: JSON.stringify(changes),
          changedByUserId: actor.id,
        },
      });

      return updatedProfile;
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'student_profiles', profileId, oldValues, changes);

    return updated;
  }

  // ── B-01: Transfer student to another batch (with history protection) ─────

  async transferBatch(
    instituteId: string,
    profileId: string,
    dto: TransferBatchDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);

    const existing = await this.getProfileWithTenantCheck(profileId, instituteId);
    await this.assertBatchBelongsToInstitute(dto.targetBatchId, instituteId);

    if (existing.batchId === dto.targetBatchId) {
      throw new BadRequestException('Student is already in the target batch.');
    }

    const previousBatch = existing.batchId
      ? await this.prisma.batch.findUnique({ where: { id: existing.batchId } })
      : null;
    const targetBatch = await this.prisma.batch.findUnique({ where: { id: dto.targetBatchId } });

    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { id: profileId },
        data: { batchId: dto.targetBatchId },
      });

      // Immutable history entry for the transfer
      await tx.studentHistory.create({
        data: {
          studentProfileId: profileId,
          eventType: 'BATCH_TRANSFER',
          description: `Transferred from "${previousBatch?.name ?? 'no batch'}" to "${targetBatch?.name ?? 'unknown'}"${dto.reason ? ` — ${dto.reason}` : ''}`,
          oldValue: previousBatch?.id ?? null,
          newValue: dto.targetBatchId,
          changedByUserId: actor.id,
        },
      });
    });

    await this.writeAudit(
      instituteId, actor.id, AuditAction.UPDATE, 'student_profiles', profileId,
      { batchId: existing.batchId },
      { batchId: dto.targetBatchId, reason: dto.reason },
    );

    return { message: `Student transferred to "${targetBatch?.name}".` };
  }

  // ── B-02: Update student tags ─────────────────────────────────────────────

  async updateTags(
    instituteId: string,
    profileId: string,
    dto: UpdateTagsDto,
    actor: AuthenticatedUser,
  ) {
    this.assertInstituteAccess(actor, instituteId);
    await this.assertTeacherOwnsStudentIfTeacher(actor, profileId);
    this.validateTags(dto.tags);

    const existing = await this.getProfileWithTenantCheck(profileId, instituteId);
    const oldTags = existing.tags;

    await this.prisma.$transaction(async (tx) => {
      await tx.studentProfile.update({
        where: { id: profileId },
        data: { tags: dto.tags },
      });

      // Track tag changes in history
      await tx.studentHistory.create({
        data: {
          studentProfileId: profileId,
          eventType: 'TAG_UPDATE',
          description: `Tags updated by ${actor.name}`,
          oldValue: JSON.stringify(oldTags),
          newValue: JSON.stringify(dto.tags),
          changedByUserId: actor.id,
        },
      });
    });

    return { tags: dto.tags };
  }

  // ── Archive (soft-delete) ─────────────────────────────────────────────────

  async archive(instituteId: string, profileId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);

    const existing = await this.getProfileWithTenantCheck(profileId, instituteId);

    await this.prisma.$transaction(async (tx) => {
      // Deactivate the user account
      await tx.user.update({ where: { id: existing.userId }, data: { status: 'INACTIVE' } });

      // History record
      await tx.studentHistory.create({
        data: {
          studentProfileId: profileId,
          eventType: 'ARCHIVED',
          description: `Student archived by ${actor.name}`,
          changedByUserId: actor.id,
        },
      });
    });

    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'student_profiles', profileId, null, { archived: true });

    return { message: 'Student archived successfully.' };
  }

  // ── B-01: Get student history ─────────────────────────────────────────────

  async getHistory(instituteId: string, profileId: string, actor: AuthenticatedUser) {
    this.assertInstituteAccess(actor, instituteId);
    await this.getProfileWithTenantCheck(profileId, instituteId);

    return this.prisma.studentHistory.findMany({
      where: { studentProfileId: profileId },
      orderBy: { changedAt: 'desc' },
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private assertInstituteAccess(actor: AuthenticatedUser, instituteId: string) {
    if (actor.role === UserRole.FOUNDER) return;
    // Students can only access their own data — handled at controller level
    if (actor.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }
  }

  private async getProfileWithTenantCheck(profileId: string, instituteId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { id: profileId },
      include: { user: { select: { id: true, instituteId: true, name: true } } },
    });

    if (!profile) throw new NotFoundException('Student profile not found.');

    if (profile.user.instituteId !== instituteId) {
      throw new ForbiddenException("You don't have access to this.");
    }

    return profile;
  }

  private async assertTeacherOwnsStudentIfTeacher(actor: AuthenticatedUser, profileId: string) {
    if (actor.role !== UserRole.TEACHER) return;
    const teacherBatchIds = await getTeacherBatchIds(this.prisma, actor);
    const student = await this.prisma.studentProfile.findUnique({
      where: { id: profileId },
      select: { batchId: true },
    });
    if (!student?.batchId || !teacherBatchIds?.includes(student.batchId)) {
      throw new ForbiddenException('You can only access students in batches you are assigned to.');
    }
  }

  // Fixes a real pre-existing gap: GET :profileId had no @Roles() decorator
  // and no own-record check, so any authenticated STUDENT could view any
  // other student's profile/mastery/scores by profileId alone (audit-adjacent
  // finding — the code's own comment on assertInstituteAccess claimed this
  // was "handled at controller level," which it was not).
  private async assertStudentOwnsProfileIfStudent(actor: AuthenticatedUser, profileId: string) {
    if (actor.role !== UserRole.STUDENT) return;
    const own = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (own?.id !== profileId) {
      throw new ForbiddenException('You can only access your own profile.');
    }
  }

  // ── GET /students/me — a Student's own profile, same shape as findById ────

  async findMyProfile(instituteId: string, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.STUDENT) throw new ForbiddenException('Only students have a self-profile.');
    const own = await this.prisma.studentProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });
    if (!own) throw new NotFoundException('No student profile found for this account.');
    return this.findById(instituteId, own.id, actor);
  }

  private async assertBatchBelongsToInstitute(batchId: string, instituteId: string) {
    const batch = await this.prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch || batch.instituteId !== instituteId) {
      throw new BadRequestException('Batch does not belong to this institute.');
    }
  }

  private validateTags(tags?: string[]) {
    if (!tags || tags.length === 0) return;
    const invalid = tags.filter((t) => !(STUDENT_TAG_VALUES as readonly string[]).includes(t));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Invalid tag(s): ${invalid.join(', ')}. Allowed: ${STUDENT_TAG_VALUES.join(', ')}`,
      );
    }
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
          oldValue: oldValue ? (oldValue as object) : undefined,
          newValue: newValue ? (newValue as object) : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to write audit log', err);
    }
  }
}
