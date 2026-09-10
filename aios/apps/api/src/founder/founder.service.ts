import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { DEFAULT_PLAN_DEFINITIONS } from '../entitlements/plan-definitions';
import { AuditAction, InstituteStatus, UserRole } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { UpdateInstitutePlanDto, UpdateFeatureFlagDto, QueryInstitutesDto, UpdatePlanDefinitionDto, UpdatePlatformSettingsDto } from './dto/founder.dto';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';
import { AI_EVALUATION_QUEUE } from '../ai-evaluation/ai-evaluation.constants';
import { SCORE_AGGREGATION_QUEUE } from '../evaluations/score-aggregation.constants';
import { NOTICE_DISPATCH_QUEUE } from '../notices/notice-dispatch.constants';
import { OCR_QUEUE } from '../ocr/ocr.constants';
import { REPORT_GENERATION_QUEUE } from '../reports/report-generation.constants';

// Moved to ../entitlements/plan-definitions so the numbers the Founder console
// *displays* and the numbers EntitlementsService *enforces* are physically the
// same constant. Two copies would drift, and the drift would be invisible until
// a customer hit a limit the dashboard said they hadn't reached.

// Same key as InstitutesService — Founder actions mutate the same Institute
// row that endpoint's cache serves (09-CACHING-STRATEGY.md §1.3: plan/flag
// changes must invalidate immediately, not wait for TTL).
const instituteProfileKey = (instituteId: string) => `institute-profile:${instituteId}`;

@Injectable()
export class FounderService {
  private readonly logger = new Logger(FounderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly storage: StorageService,
    private readonly entitlements: EntitlementsService,
    @InjectQueue(MASTERY_RECALC_QUEUE) private readonly masteryRecalcQueue: Queue,
    @InjectQueue(AI_EVALUATION_QUEUE) private readonly aiEvaluationQueue: Queue,
    @InjectQueue(SCORE_AGGREGATION_QUEUE) private readonly scoreAggregationQueue: Queue,
    @InjectQueue(NOTICE_DISPATCH_QUEUE) private readonly noticeDispatchQueue: Queue,
    @InjectQueue(OCR_QUEUE) private readonly ocrQueue: Queue,
    @InjectQueue(REPORT_GENERATION_QUEUE) private readonly reportGenerationQueue: Queue,
  ) {}

  // ── GET /founder/institutes ─────────────────────────────────────────────

  async listInstitutes(query: QueryInstitutesDto) {
    const where = query.search ? { name: { contains: query.search, mode: 'insensitive' as const } } : {};
    return this.prisma.institute.findMany({
      where,
      include: { _count: { select: { users: true, batches: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── PATCH /founder/institutes/:id/plan ──────────────────────────────────
  // Writes an InstitutePlanHistory row (queryable timeline) in addition to
  // the generic AuditLog entry every founder mutation writes, and sets/clears
  // trialEndsAt based on the plan definitions' trialDurationDays.

  async updatePlan(instituteId: string, dto: UpdateInstitutePlanDto, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');
    if (institute.plan === dto.plan) {
      throw new ConflictException(`Institute is already on the ${dto.plan} plan.`);
    }

    let trialEndsAt: Date | null = null;
    if (dto.plan === 'TRIAL') {
      const planDef = await this.prisma.planDefinition.findUnique({ where: { plan: 'TRIAL' } });
      const durationDays = planDef?.trialDurationDays ?? DEFAULT_PLAN_DEFINITIONS.TRIAL?.trialDurationDays ?? 14;
      trialEndsAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.institute.update({ where: { id: instituteId }, data: { plan: dto.plan, trialEndsAt } }),
      this.prisma.institutePlanHistory.create({
        data: {
          instituteId,
          fromPlan: institute.plan,
          toPlan: dto.plan,
          changedByUserId: actor.id,
          reason: dto.reason,
        },
      }),
    ]);
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'institutes', instituteId, { plan: institute.plan }, { plan: dto.plan, reason: dto.reason });
    await this.cache.del(instituteProfileKey(instituteId));
    return updated;
  }

  // ── GET /founder/plans, PATCH /founder/plans/:plan ──────────────────────

  async listPlanDefinitions() {
    await this.ensurePlanDefinitions();
    return this.prisma.planDefinition.findMany({ orderBy: { plan: 'asc' } });
  }

  async updatePlanDefinition(plan: string, dto: UpdatePlanDefinitionDto, actor: AuthenticatedUser) {
    await this.ensurePlanDefinitions();
    const existing = await this.prisma.planDefinition.findUnique({ where: { plan: plan as any } });
    if (!existing) throw new NotFoundException(`Unknown plan: ${plan}`);

    const updated = await this.prisma.planDefinition.update({ where: { plan: plan as any }, data: dto });
    await this.writeAudit(null, actor.id, AuditAction.UPDATE, 'plan_definitions', plan, existing, updated);
    return updated;
  }

  private async ensurePlanDefinitions() {
    // Delegates to the same idempotent seeder the enforcement path uses, so a
    // Founder read can never seed a different set of limits than a write-time
    // check would later apply.
    return this.entitlements.ensurePlanDefinitions();
  }

  // ── GET /founder/institutes/:id/plan-history ────────────────────────────

  async getPlanHistory(instituteId: string) {
    return this.prisma.institutePlanHistory.findMany({
      where: { instituteId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── GET /founder/institutes/:id/usage ───────────────────────────────────

  async getUsage(instituteId: string) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    await this.ensurePlanDefinitions();
    const [limits, userCount, studentCount, teacherCount] = await Promise.all([
      this.prisma.planDefinition.findUnique({ where: { plan: institute.plan } }),
      this.prisma.user.count({ where: { instituteId } }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.STUDENT } }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.TEACHER } }),
    ]);

    return {
      plan: institute.plan,
      trialEndsAt: institute.trialEndsAt,
      usage: { users: userCount, students: studentCount, teachers: teacherCount },
      limits: limits
        ? { maxUsers: limits.maxUsers, maxStudents: limits.maxStudents, maxTeachers: limits.maxTeachers, maxStorageGb: limits.maxStorageGb, maxAssessmentsPerMonth: limits.maxAssessmentsPerMonth }
        : null,
    };
  }

  // ── Archive (04-DATABASE-SCHEMA.md: never a hard delete, FOUNDER-only) ──
  // Not in 05-API-SPECIFICATION.md's endpoint list verbatim (that doc only
  // names the plan-patch endpoint) — added as its own explicit, audited action
  // rather than folding it into the plan DTO, since silently allowing an
  // arbitrary status write alongside a plan change is a bigger blast radius
  // than this one specific, well-defined transition.

  async archiveInstitute(instituteId: string, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    const updated = await this.prisma.institute.update({
      where: { id: instituteId },
      data: { status: InstituteStatus.ARCHIVED },
    });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'institutes', instituteId, { status: institute.status }, { status: InstituteStatus.ARCHIVED });
    await this.cache.del(instituteProfileKey(instituteId));
    return updated;
  }

  // ── GET /founder/institutes/:id ─────────────────────────────────────────

  async getInstituteDetail(instituteId: string) {
    const institute = await this.prisma.institute.findUnique({
      where: { id: instituteId },
      include: {
        branches: true,
        allowListEntries: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { users: true, batches: true } },
      },
    });
    if (!institute) throw new NotFoundException('Institute not found.');

    const [admins, studentCount, teacherCount] = await Promise.all([
      this.prisma.user.findMany({
        where: { instituteId, role: UserRole.ADMIN },
        select: { id: true, name: true, email: true, status: true, lastLoginAt: true },
      }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.STUDENT } }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.TEACHER } }),
    ]);

    return { ...institute, admins, studentCount, teacherCount };
  }

  // ── PATCH /founder/institutes/:id/suspend & /reactivate ────────────────
  // Suspension takes effect immediately, not just for new sessions: both
  // AuthService.loginWithGoogle and validateJwtPayload check institute.status
  // on every login and every subsequent authenticated request.

  async suspendInstitute(instituteId: string, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');
    if (institute.status === InstituteStatus.ARCHIVED) {
      throw new ConflictException('Cannot suspend an archived institute.');
    }

    const updated = await this.prisma.institute.update({
      where: { id: instituteId },
      data: { status: InstituteStatus.SUSPENDED },
    });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'institutes', instituteId, { status: institute.status }, { status: InstituteStatus.SUSPENDED });
    await this.cache.del(instituteProfileKey(instituteId));
    return updated;
  }

  async reactivateInstitute(instituteId: string, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');
    if (institute.status === InstituteStatus.ARCHIVED) {
      throw new ConflictException('An archived institute cannot be reactivated directly — contact platform support.');
    }
    if (institute.status !== InstituteStatus.SUSPENDED) {
      throw new ConflictException('Only a suspended institute can be reactivated.');
    }

    const updated = await this.prisma.institute.update({
      where: { id: instituteId },
      data: { status: InstituteStatus.ACTIVE },
    });
    await this.writeAudit(instituteId, actor.id, AuditAction.UPDATE, 'institutes', instituteId, { status: institute.status }, { status: InstituteStatus.ACTIVE });
    await this.cache.del(instituteProfileKey(instituteId));
    return updated;
  }

  // ── PATCH /founder/feature-flags ────────────────────────────────────────

  async updateFeatureFlag(dto: UpdateFeatureFlagDto, actor: AuthenticatedUser) {
    const institute = await this.prisma.institute.findUnique({ where: { id: dto.instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    const existingFlags = (institute.featureFlags as Record<string, boolean>) ?? {};
    const nextFlags = { ...existingFlags, [dto.flag]: dto.enabled };

    const updated = await this.prisma.institute.update({
      where: { id: dto.instituteId },
      data: { featureFlags: nextFlags },
    });
    await this.writeAudit(dto.instituteId, actor.id, AuditAction.UPDATE, 'institutes', dto.instituteId, { featureFlags: existingFlags }, { featureFlags: nextFlags });
    await this.cache.del(instituteProfileKey(dto.instituteId));
    await this.featureFlags.invalidate(dto.instituteId, dto.flag);
    return updated;
  }

  // ── GET /founder/analytics/overview ─────────────────────────────────────
  // Real Prisma aggregates only — no revenue/API-latency/timeline mock data.
  // AI-quality metrics (agreement rate, override rate, time-to-finalize) are
  // deliberately NOT duplicated here: they already exist, per-institute and
  // FOUNDER-cross-tenant-capable, at the Python service's GET
  // /analytics/evaluation-quality (apps/api-python/src/routers/analytics.py) —
  // the frontend calls that directly rather than this endpoint proxying it.

  async getAnalyticsOverview() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);

    const [
      institutesCreatedLast6Months,
      totalUsers,
      activeUsersLast30Days,
      totalExams,
      examsLast30Days,
      totalAssessments,
      assessmentsLast30Days,
      totalEvaluationVersions,
      evaluationVersionsLast30Days,
    ] = await Promise.all([
      this.prisma.institute.findMany({ where: { createdAt: { gte: sixMonthsAgo } }, select: { createdAt: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
      this.prisma.exam.count(),
      this.prisma.exam.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.assessment.count(),
      this.prisma.assessment.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.evaluationVersion.count(),
      this.prisma.evaluationVersion.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    ]);

    // Bucket institute creation by month in JS — the dataset size this
    // dashboard operates at doesn't warrant a raw date_trunc query, and this
    // keeps the query itself trivially correct across Postgres versions.
    const growthByMonth = new Map<string, number>();
    for (const { createdAt } of institutesCreatedLast6Months) {
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
      growthByMonth.set(key, (growthByMonth.get(key) ?? 0) + 1);
    }

    return {
      institutionGrowth: Array.from(growthByMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, count })),
      users: { total: totalUsers, activeLast30Days: activeUsersLast30Days },
      assessmentVolume: {
        exams: { total: totalExams, last30Days: examsLast30Days },
        assessments: { total: totalAssessments, last30Days: assessmentsLast30Days },
      },
      evaluationVolume: { total: totalEvaluationVersions, last30Days: evaluationVersionsLast30Days },
    };
  }

  // ── GET /founder/health ─────────────────────────────────────────────────

  async getHealth() {
    const nestStart = Date.now();
    const [db, python, redis] = await Promise.all([this.checkDb(), this.checkPython(), this.checkRedis()]);
    return {
      nestjs: { status: 'up', latencyMs: Date.now() - nestStart },
      postgres: db,
      fastapi: python,
      redis,
    };
  }

  private async checkDb(): Promise<{ status: 'up' | 'down'; latencyMs: number | null }> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  private async checkPython(): Promise<{ status: 'up' | 'down'; latencyMs: number | null }> {
    const start = Date.now();
    const baseUrl = this.config.get<string>('PYTHON_SERVICE_URL') ?? 'http://localhost:8000';
    try {
      await axios.get(`${baseUrl}/health`, { timeout: 3000 });
      return { status: 'up', latencyMs: Date.now() - start };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  // Founder Console Phase 6 — was missing entirely; HealthController already
  // has this exact ping-via-queue-client pattern for the public /health
  // endpoint, mirrored here for the Founder-only one.
  private async checkRedis(): Promise<{ status: 'up' | 'down'; latencyMs: number | null }> {
    const start = Date.now();
    try {
      // BullMQ's `Queue.client` getter only resolves once the connection is
      // "ready" — with QueueModule's infinite exponential-backoff retry, an
      // unreachable Redis means that promise never settles at all. Without a
      // race against a timeout here, this check (and the whole GET
      // /founder/health response, since it's Promise.all'd with postgres/
      // fastapi) would hang forever instead of degrading to "down" the way
      // every other check in this codebase does.
      const client = (await this.raceTimeout(this.masteryRecalcQueue.client, 2000)) as unknown as Redis;
      const pong = await this.raceTimeout(client.ping(), 2000);
      return pong === 'PONG' ? { status: 'up', latencyMs: Date.now() - start } : { status: 'down', latencyMs: null };
    } catch {
      return { status: 'down', latencyMs: null };
    }
  }

  private raceTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)),
    ]);
  }

  // ── GET /founder/health/queues ──────────────────────────────────────────
  // Real BullMQ getJobCounts() per queue — waiting/active/completed/failed/
  // delayed. Nothing in this codebase called this before; dead-lettered jobs
  // previously only reached Sentry, never a queryable API a Founder dashboard
  // could poll.

  async getQueueMetrics() {
    const queues: { name: string; queue: Queue }[] = [
      { name: 'mastery-recalc', queue: this.masteryRecalcQueue },
      { name: 'ai-evaluation', queue: this.aiEvaluationQueue },
      { name: 'score-aggregation', queue: this.scoreAggregationQueue },
      { name: 'notice-dispatch', queue: this.noticeDispatchQueue },
      { name: 'ocr', queue: this.ocrQueue },
      { name: 'report-generation', queue: this.reportGenerationQueue },
    ];

    const results = await Promise.all(
      queues.map(async ({ name, queue }) => {
        try {
          // Same rationale as checkRedis() — getJobCounts() needs the
          // connection ready too, and must not hang forever if Redis is down.
          const counts = await this.raceTimeout(
            queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed'),
            2000,
          );
          return { name, available: true as const, counts };
        } catch (err) {
          this.logger.warn(`Failed to read job counts for queue "${name}"`, err as Error);
          return { name, available: false as const, counts: null };
        }
      }),
    );

    return results;
  }

  // ── GET /founder/integrations ───────────────────────────────────────────
  // Read-only status per real integration point. Never returns a secret
  // value or a fabricated masked key — only whether the env var is present
  // and whether anything in this codebase actually reads it yet. Google
  // OAuth/S3/internal-service-token/Python AI service are real and wired;
  // SendGrid/WhatsApp/SMS report `configured` honestly but `wired: false` —
  // notice-dispatch.processor.ts fails every EMAIL/SMS/WHATSAPP delivery with
  // `provider_not_configured` regardless of whether the key is set, per
  // 17-THIRD-PARTY-INTEGRATIONS.md. No integrations beyond what already
  // exists in this codebase are invented here (Razorpay, Mixpanel, etc. —
  // the old mock screen's fabricated rows — are simply not listed).

  async getIntegrations() {
    const python = await this.checkPython();

    return [
      {
        key: 'googleOAuth',
        label: 'Google OAuth',
        configured: Boolean(this.config.get<string>('GOOGLE_CLIENT_ID') && this.config.get<string>('GOOGLE_CLIENT_SECRET')),
        wired: true,
        description: 'Verifies sign-in tokens server-side (auth.service.ts). Required — the app cannot start without it.',
      },
      {
        key: 's3Storage',
        label: 'S3 Storage',
        configured: this.storage.isConfigured(),
        wired: true,
        description: 'Document/answer-sheet uploads and signed download URLs (infrastructure/storage).',
      },
      {
        key: 'pythonAiService',
        label: 'Python AI Service',
        configured: true,
        wired: true,
        status: python.status,
        latencyMs: python.latencyMs,
        description: 'OMR/OCR, AI evaluation, blueprint generation, and analytics (apps/api-python).',
      },
      {
        key: 'internalServiceToken',
        label: 'Internal Service Token',
        configured: Boolean(this.config.get<string>('INTERNAL_SERVICE_TOKEN')),
        wired: true,
        description: 'Authenticates NestJS → FastAPI calls. Unset means those internal endpoints are unenforced (dev-only fallback).',
      },
      {
        key: 'sendgridEmail',
        label: 'SendGrid (Email)',
        configured: Boolean(this.config.get<string>('SENDGRID_API_KEY')),
        wired: false,
        description: 'Not wired into the notice-dispatch pipeline — email deliveries fail with "provider_not_configured" regardless of whether this key is set.',
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp Cloud API',
        configured: Boolean(this.config.get<string>('WHATSAPP_API_TOKEN')),
        wired: false,
        description: 'Not wired into the notice-dispatch pipeline — WhatsApp deliveries fail with "provider_not_configured" regardless of whether this token is set.',
      },
      {
        key: 'sms',
        label: 'SMS Gateway',
        configured: Boolean(this.config.get<string>('SMS_GATEWAY_KEY')),
        wired: false,
        description: 'Not wired into the notice-dispatch pipeline — SMS deliveries fail with "provider_not_configured" regardless of whether this key is set.',
      },
      {
        key: 'sentry',
        label: 'Sentry',
        configured: Boolean(this.config.get<string>('SENTRY_DSN')),
        wired: true,
        description: 'Dead-lettered queue jobs are reported here (shared/logging/dead-letter.ts).',
      },
    ];
  }

  // ── GET/PATCH /founder/settings ─────────────────────────────────────────
  // A single key ('toggles') holding the whole toggle set as one JSON blob —
  // deliberately generic rather than one row per field (see PlatformSetting's
  // schema comment). This exists to make the Founder Settings screen's "Save
  // Changes" button genuinely persist rather than fake success (audit-flagged
  // Critical trust gap) — it is NOT a claim that every toggle here gates real
  // behavior elsewhere. Only maintMode does today (see MaintenanceGuard).

  private static readonly PLATFORM_SETTINGS_KEY = 'toggles';

  async getPlatformSettings(): Promise<Record<string, boolean>> {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: FounderService.PLATFORM_SETTINGS_KEY },
    });
    return (row?.value as Record<string, boolean>) ?? {};
  }

  async updatePlatformSettings(dto: UpdatePlatformSettingsDto, actor: AuthenticatedUser): Promise<Record<string, boolean>> {
    const existing = await this.getPlatformSettings();
    const next = { ...existing, ...dto.patch };

    await this.prisma.platformSetting.upsert({
      where: { key: FounderService.PLATFORM_SETTINGS_KEY },
      create: { key: FounderService.PLATFORM_SETTINGS_KEY, value: next as any, updatedByUserId: actor.id },
      update: { value: next as any, updatedByUserId: actor.id },
    });
    await this.writeAudit(null, actor.id, AuditAction.UPDATE, 'platform_settings', FounderService.PLATFORM_SETTINGS_KEY, existing, next);

    return next;
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async writeAudit(instituteId: string | null, actorId: string, action: AuditAction, entity: string, entityId: string, oldValue: unknown, newValue: unknown) {
    try {
      await this.prisma.auditLog.create({
        data: { instituteId, actorId, action, entity, entityId, oldValue: oldValue as any, newValue: newValue as any },
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log for ${entity}:${entityId}`, err as Error);
    }
  }
}
