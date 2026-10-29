import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { allowlistCheckKey } from '../shared/cache-keys';
import {
  AuditAction,
  UserRole,
  CaptureProviderType,
  EvaluationPolicyMode,
  InstituteStatus,
  UserStatus,
} from '@prisma/client';
import {
  CreateInstituteDto,
  UpdateInstituteDto,
  AddAllowListEntryDto,
} from './dto/institute.dto';
import { AuthenticatedUser } from '../auth/auth.types';

// 09-CACHING-STRATEGY.md §1.3 — invalidated immediately on write, not just
// TTL-expired, since plan/flag changes must take effect promptly.
const INSTITUTE_PROFILE_TTL_SECONDS = 10 * 60;
const instituteProfileKey = (instituteId: string) => `institute-profile:${instituteId}`;

@Injectable()
export class InstitutesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  // ── A-05: Institute CRUD ──────────────────────────────────────────────────

  /** Founder-only: create a new institute tenant and provision default assessment settings. */
  async create(dto: CreateInstituteDto, actor: AuthenticatedUser) {
    const rawShortCode = dto.shortCode?.trim().toUpperCase() || this.deriveShortCode(dto.name);
    let shortCode = rawShortCode;
    const existingCode = await this.prisma.institute.findUnique({ where: { shortCode: rawShortCode } });
    if (existingCode) {
      shortCode = `${rawShortCode}${Math.floor(100 + Math.random() * 900)}`;
    }

    const institute = await this.prisma.$transaction(async (tx) => {
      const inst = await tx.institute.create({
        data: {
          name: dto.name,
          shortCode,
          domainAllowlist: dto.domainAllowlist,
          plan: dto.plan,
          address: dto.address,
          phone: dto.phone,
        },
      });

      // Eliminate BUG-04 (Onboarding Deadlock):
      // AssessmentDelivery requires captureProviderId and evaluationPolicyId.
      // Provision safe default photo-capture provider and policy with mandatory human review.
      await tx.captureProvider.create({
        data: {
          instituteId: inst.id,
          type: CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE,
          config: { autoProcess: false },
        },
      });

      await tx.evaluationPolicy.create({
        data: {
          instituteId: inst.id,
          name: 'Default Policy — Mandatory Human Review',
          mode: EvaluationPolicyMode.AI_ASSIST_MANDATORY_REVIEW,
          requiresHumanReview: true,
        },
      });

      return inst;
    });

    await this.audit(institute.id, actor.id, AuditAction.CREATE, 'institutes', institute.id);

    return institute;
  }

  /** Idempotently ensures default capture provider and evaluation policy exist for an existing institute. */
  async ensureDefaultConfigurations(instituteId: string) {
    const existingProvider = await this.prisma.captureProvider.findFirst({
      where: { instituteId },
    });
    if (!existingProvider) {
      await this.prisma.captureProvider.create({
        data: {
          instituteId,
          type: CaptureProviderType.PHOTO_CAPTURE_SUBJECTIVE,
          config: { autoProcess: false },
        },
      });
    }

    const existingPolicy = await this.prisma.evaluationPolicy.findFirst({
      where: { instituteId },
    });
    if (!existingPolicy) {
      await this.prisma.evaluationPolicy.create({
        data: {
          instituteId,
          name: 'Default Policy — Mandatory Human Review',
          mode: EvaluationPolicyMode.AI_ASSIST_MANDATORY_REVIEW,
          requiresHumanReview: true,
        },
      });
    }
  }

  /** Get institute by ID — enforces tenant isolation. */
  async findById(instituteId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);

    const cacheKey = instituteProfileKey(instituteId);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      include: { branches: true },
    });

    if (!institute) throw new NotFoundException('Institute not found.');
    await this.cache.set(cacheKey, institute, INSTITUTE_PROFILE_TTL_SECONDS);
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
        ...(dto.shortCode && { shortCode: dto.shortCode.trim().toUpperCase() }),
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

    await this.cache.del(instituteProfileKey(instituteId));
    return updated;
  }

  // ── Operational Onboarding & Pilot Readiness ─────────────────────────────

  async getOnboardingStatus(instituteId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);

    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      include: {
        branches: { select: { id: true, name: true } },
        batches: { select: { id: true, name: true } },
        subjects: { select: { id: true, name: true } },
      },
    });

    if (!institute) throw new NotFoundException('Institute not found.');

    const [
      allowListCount,
      activeTeacherCount,
      assignedTeacherCount,
      studentCount,
      guardianContactCount,
      captureProviderCount,
      evaluationPolicyCount,
    ] = await Promise.all([
      this.prisma.allowListEntry.count({ where: { instituteId } }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.TEACHER, status: UserStatus.ACTIVE } }),
      this.prisma.teacherProfile.count({
        where: { user: { instituteId, status: UserStatus.ACTIVE }, batchAssignments: { some: { removedAt: null } } },
      }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.STUDENT, status: UserStatus.ACTIVE } }),
      this.prisma.studentProfile.count({
        where: {
          instituteId,
          user: { status: UserStatus.ACTIVE },
          OR: [{ guardianPhone: { not: null } }, { guardianEmail: { not: null } }],
        },
      }),
      this.prisma.captureProvider.count({ where: { instituteId } }),
      this.prisma.evaluationPolicy.count({ where: { instituteId } }),
    ]);

    const emailConfigured = Boolean(this.config?.get<string>('SENDGRID_API_KEY'));
    const waConfigured = Boolean(
      this.config?.get<string>('WHATSAPP_API_TOKEN') && this.config?.get<string>('WHATSAPP_PHONE_NUMBER_ID'),
    );
    const smsConfigured = Boolean(this.config?.get<string>('SMS_GATEWAY_KEY'));

    const checklist: Array<{
      step: string;
      title: string;
      status: 'COMPLETE' | 'WARNING' | 'INCOMPLETE';
      description: string;
      actionRequired?: string;
    }> = [
      {
        step: 'INSTITUTE_PROFILE',
        title: 'Institute Profile & Identity',
        status: institute.name && institute.shortCode ? 'COMPLETE' : 'INCOMPLETE',
        description: `Name: "${institute.name}", Short Code: "${institute.shortCode || 'UNSET'}"`,
        actionRequired: !institute.shortCode ? 'Configure shortCode for booklet roll code and QR support' : undefined,
      },
      {
        step: 'ACCESS_ALLOWLIST',
        title: 'Domain & Email Allowlist',
        status: institute.domainAllowlist.length > 0 || allowListCount > 0 ? 'COMPLETE' : 'INCOMPLETE',
        description: `${institute.domainAllowlist.length} domain patterns, ${allowListCount} allowlisted emails`,
        actionRequired:
          institute.domainAllowlist.length === 0 && allowListCount === 0
            ? 'Add at least one admin email or approved domain to the allowlist'
            : undefined,
      },
      {
        step: 'ACADEMIC_HIERARCHY',
        title: 'Academic Branches, Subjects & Batches',
        status:
          institute.branches.length > 0 && institute.subjects.length > 0 && institute.batches.length > 0
            ? 'COMPLETE'
            : institute.batches.length > 0
              ? 'WARNING'
              : 'INCOMPLETE',
        description: `${institute.branches.length} branches, ${institute.subjects.length} subjects, ${institute.batches.length} batches created`,
        actionRequired: institute.batches.length === 0 ? 'Create at least one class/batch before importing students' : undefined,
      },
      {
        step: 'TEACHER_ASSIGNMENTS',
        title: 'Teacher Profiles & Batch Assignments',
        status: assignedTeacherCount > 0 ? 'COMPLETE' : activeTeacherCount > 0 ? 'WARNING' : 'INCOMPLETE',
        description: `${activeTeacherCount} active teachers, ${assignedTeacherCount} assigned to active batches`,
        actionRequired: assignedTeacherCount === 0 ? 'Assign at least one teacher to a batch to enable exam grading & notices' : undefined,
      },
      {
        step: 'STUDENT_ROSTER',
        title: 'Student Roster & Guardian Contacts',
        status:
          studentCount > 0 && guardianContactCount >= studentCount
            ? 'COMPLETE'
            : studentCount > 0
              ? 'WARNING'
              : 'INCOMPLETE',
        description: `${studentCount} enrolled students (${guardianContactCount} with registered guardian contacts)`,
        actionRequired:
          studentCount === 0
            ? 'Import or add students to active batches'
            : guardianContactCount < studentCount
              ? 'Provide guardian phone/email for full SMS & WhatsApp notification reach'
              : undefined,
      },
      {
        step: 'ASSESSMENT_INFRASTRUCTURE',
        title: 'Capture Providers & Evaluation Policies',
        status: captureProviderCount > 0 && evaluationPolicyCount > 0 ? 'COMPLETE' : 'INCOMPLETE',
        description: `${captureProviderCount} capture providers, ${evaluationPolicyCount} evaluation policies`,
        actionRequired:
          captureProviderCount === 0 || evaluationPolicyCount === 0
            ? 'Run ensureDefaultConfigurations() to provision defaults'
            : undefined,
      },
      {
        step: 'NOTIFICATION_CHANNELS',
        title: 'Communication & Notice Dispatch Channels',
        status: 'COMPLETE',
        description: `In-App alerts: READY; Email: ${emailConfigured ? 'READY' : 'provider_not_configured'}; WhatsApp: ${waConfigured ? 'READY' : 'provider_not_configured'}; SMS: ${smsConfigured ? 'READY' : 'provider_not_configured'}`,
        actionRequired:
          !emailConfigured && !waConfigured && !smsConfigured
            ? 'External delivery providers unconfigured; notices will deliver via In-App alerts only'
            : undefined,
      },
    ];

    const completedCount = checklist.filter((s) => s.status === 'COMPLETE').length;
    const completionPercentage = Math.round((completedCount / checklist.length) * 100);

    const isReadyForPilot =
      Boolean(institute.name && institute.shortCode) &&
      (institute.domainAllowlist.length > 0 || allowListCount > 0) &&
      institute.batches.length > 0 &&
      assignedTeacherCount > 0 &&
      studentCount > 0 &&
      captureProviderCount > 0 &&
      evaluationPolicyCount > 0;

    return {
      instituteId,
      status: institute.status,
      isReadyForPilot,
      completionPercentage,
      checklist,
      metrics: {
        branches: institute.branches.length,
        subjects: institute.subjects.length,
        batches: institute.batches.length,
        teachers: activeTeacherCount,
        assignedTeachers: assignedTeacherCount,
        students: studentCount,
        guardianContacts: guardianContactCount,
        captureProviders: captureProviderCount,
        evaluationPolicies: evaluationPolicyCount,
      },
      notifications: {
        inApp: { ready: true },
        email: { configured: emailConfigured },
        whatsapp: { configured: waConfigured },
        sms: { configured: smsConfigured },
      },
    };
  }

  async activateInstitute(instituteId: string, actor: AuthenticatedUser) {
    this.assertTenantAccess(actor, instituteId);

    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    if (institute.status === InstituteStatus.ACTIVE) {
      return { success: true, message: 'Institute is already active.', institute };
    }

    if (institute.status === InstituteStatus.SUSPENDED || institute.status === InstituteStatus.ARCHIVED) {
      throw new ConflictException(
        `Institute has status ${institute.status}; must be reactivated through the founder console.`,
      );
    }

    const updated = await this.prisma.institute.update({
      where: { id: instituteId },
      data: { status: InstituteStatus.ACTIVE },
    });

    await this.audit(
      instituteId,
      actor.id,
      AuditAction.UPDATE,
      'institutes',
      instituteId,
      { status: institute.status },
      { status: InstituteStatus.ACTIVE },
    );

    await this.cache.del(instituteProfileKey(instituteId));
    return { success: true, message: 'Institute activated for live operations.', institute: updated };
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

    await this.cache.del(allowlistCheckKey(entry.email));
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

    await this.cache.del(allowlistCheckKey(entry.email));
    return { message: `${entry.email} removed from allow-list.` };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private deriveShortCode(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      const acronym = words.map((w) => w[0]).join('').toUpperCase();
      if (acronym.length >= 2 && acronym.length <= 6) return acronym;
    }
    const clean = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return clean.slice(0, 4) || 'INST';
  }

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
