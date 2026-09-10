import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { InstituteStatus, UserRole } from '@prisma/client';
import axios from 'axios';
import { FounderService } from './founder.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../infrastructure/cache/cache.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { StorageService } from '../infrastructure/storage/storage.service';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { MASTERY_RECALC_QUEUE } from '../analytics/mastery-recalc.constants';
import { AI_EVALUATION_QUEUE } from '../ai-evaluation/ai-evaluation.constants';
import { SCORE_AGGREGATION_QUEUE } from '../evaluations/score-aggregation.constants';
import { NOTICE_DISPATCH_QUEUE } from '../notices/notice-dispatch.constants';
import { OCR_QUEUE } from '../ocr/ocr.constants';
import { REPORT_GENERATION_QUEUE } from '../reports/report-generation.constants';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('FounderService', () => {
  let service: FounderService;
  let prisma: {
    institute: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    user: { findMany: jest.Mock; count: jest.Mock };
    auditLog: { create: jest.Mock };
    planDefinition: { findUnique: jest.Mock; findMany: jest.Mock; count: jest.Mock; createMany: jest.Mock; update: jest.Mock };
    institutePlanHistory: { create: jest.Mock; findMany: jest.Mock };
    exam: { count: jest.Mock };
    assessment: { count: jest.Mock };
    evaluationVersion: { count: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };

  const founder: AuthenticatedUser = { id: 'founder-1', email: 'f@x.com', name: 'Founder', role: UserRole.FOUNDER, instituteId: 'inst-none' };
  let configValues: Record<string, string | undefined>;
  let storage: { isConfigured: jest.Mock };
  let entitlements: { ensurePlanDefinitions: jest.Mock; assertCanCreate: jest.Mock; getSnapshot: jest.Mock };

  beforeEach(async () => {
    prisma = {
      institute: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn() },
      planDefinition: {
        findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(4), createMany: jest.fn(), update: jest.fn(),
      },
      institutePlanHistory: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      exam: { count: jest.fn().mockResolvedValue(0) },
      assessment: { count: jest.fn().mockResolvedValue(0) },
      evaluationVersion: { count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    const makeMockQueue = (withClient: boolean) => ({
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 }),
      ...(withClient ? { client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }) } : {}),
    });
    configValues = {};
    storage = { isConfigured: jest.fn().mockReturnValue(false) };
    entitlements = {
      ensurePlanDefinitions: jest.fn().mockResolvedValue(undefined),
      assertCanCreate: jest.fn().mockResolvedValue(undefined),
      getSnapshot: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FounderService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: (key: string) => configValues[key] } },
        { provide: CacheService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn(), delByPrefix: jest.fn() } },
        { provide: FeatureFlagsService, useValue: { isEnabled: jest.fn(), invalidate: jest.fn() } },
        { provide: StorageService, useValue: storage },
        // FounderService now delegates plan-definition seeding to the same
        // service that enforces the limits, so display and enforcement cannot
        // drift. Seeding is a no-op here; these tests supply planDefinition
        // rows directly through the Prisma mock.
        { provide: EntitlementsService, useValue: entitlements },
        { provide: getQueueToken(MASTERY_RECALC_QUEUE), useValue: makeMockQueue(true) },
        { provide: getQueueToken(AI_EVALUATION_QUEUE), useValue: makeMockQueue(false) },
        { provide: getQueueToken(SCORE_AGGREGATION_QUEUE), useValue: makeMockQueue(false) },
        { provide: getQueueToken(NOTICE_DISPATCH_QUEUE), useValue: makeMockQueue(false) },
        { provide: getQueueToken(OCR_QUEUE), useValue: makeMockQueue(false) },
        { provide: getQueueToken(REPORT_GENERATION_QUEUE), useValue: makeMockQueue(false) },
      ],
    }).compile();
    service = module.get(FounderService);
    mockedAxios.get.mockResolvedValue({ status: 200, data: { status: 'healthy' } });
  });

  describe('archiveInstitute (04-DATABASE-SCHEMA.md: never a hard delete)', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.archiveInstitute('inst-x', founder)).rejects.toThrow(NotFoundException);
    });

    it('sets status to ARCHIVED, not a delete, and audits the transition', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ACTIVE });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ARCHIVED });

      const result = await service.archiveInstitute('inst-1', founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { status: InstituteStatus.ARCHIVED } });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(InstituteStatus.ARCHIVED);
    });
  });

  describe('suspendInstitute', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.suspendInstitute('inst-x', founder)).rejects.toThrow(NotFoundException);
    });

    it('refuses to suspend an already-archived institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ARCHIVED });
      await expect(service.suspendInstitute('inst-1', founder)).rejects.toThrow(ConflictException);
    });

    it('sets status to SUSPENDED and audits the transition', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ACTIVE });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.SUSPENDED });

      const result = await service.suspendInstitute('inst-1', founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { status: InstituteStatus.SUSPENDED } });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(InstituteStatus.SUSPENDED);
    });
  });

  describe('reactivateInstitute', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.reactivateInstitute('inst-x', founder)).rejects.toThrow(NotFoundException);
    });

    it('refuses to reactivate an archived institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ARCHIVED });
      await expect(service.reactivateInstitute('inst-1', founder)).rejects.toThrow(ConflictException);
    });

    it('refuses to reactivate an institute that is not suspended', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ACTIVE });
      await expect(service.reactivateInstitute('inst-1', founder)).rejects.toThrow(ConflictException);
    });

    it('sets status to ACTIVE and audits the transition', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.SUSPENDED });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', status: InstituteStatus.ACTIVE });

      const result = await service.reactivateInstitute('inst-1', founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { status: InstituteStatus.ACTIVE } });
      expect(result.status).toBe(InstituteStatus.ACTIVE);
    });
  });

  describe('getInstituteDetail', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.getInstituteDetail('inst-x')).rejects.toThrow(NotFoundException);
    });

    it('composes institute + admins + student/teacher counts', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({
        id: 'inst-1', name: 'Acme', branches: [], allowListEntries: [], _count: { users: 5, batches: 2 },
      });
      prisma.user.findMany.mockResolvedValueOnce([{ id: 'u1', name: 'Admin One', email: 'a@x.com', status: 'ACTIVE', lastLoginAt: null }]);
      prisma.user.count.mockResolvedValueOnce(10).mockResolvedValueOnce(3);

      const result = await service.getInstituteDetail('inst-1');

      expect(result.admins).toHaveLength(1);
      expect(result.studentCount).toBe(10);
      expect(result.teacherCount).toBe(3);
    });
  });

  describe('updatePlan (Founder Console Phase 2 — subscription/plan management)', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.updatePlan('inst-x', { plan: 'PRO' as any }, founder)).rejects.toThrow(NotFoundException);
    });

    it('rejects a no-op change to the same plan', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', plan: 'PRO' });
      await expect(service.updatePlan('inst-1', { plan: 'PRO' as any }, founder)).rejects.toThrow(ConflictException);
    });

    it('updates plan, writes plan history, and audits — without setting trialEndsAt for a non-trial plan', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', plan: 'BASIC' });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', plan: 'PRO', trialEndsAt: null });
      prisma.institutePlanHistory.create.mockResolvedValueOnce({ id: 'hist-1' });

      const result = await service.updatePlan('inst-1', { plan: 'PRO' as any, reason: 'Upgraded' }, founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { plan: 'PRO', trialEndsAt: null } });
      expect(prisma.institutePlanHistory.create).toHaveBeenCalledWith({
        data: { instituteId: 'inst-1', fromPlan: 'BASIC', toPlan: 'PRO', changedByUserId: founder.id, reason: 'Upgraded' },
      });
      expect(result.plan).toBe('PRO');
    });

    it('sets trialEndsAt using the TRIAL plan definition duration when moving to TRIAL', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', plan: 'BASIC' });
      prisma.planDefinition.findUnique.mockResolvedValueOnce({ plan: 'TRIAL', trialDurationDays: 30 });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', plan: 'TRIAL', trialEndsAt: new Date() });
      prisma.institutePlanHistory.create.mockResolvedValueOnce({ id: 'hist-1' });

      await service.updatePlan('inst-1', { plan: 'TRIAL' as any }, founder);

      const call = prisma.institute.update.mock.calls[0][0];
      expect(call.data.trialEndsAt).toBeInstanceOf(Date);
    });
  });

  describe('listPlanDefinitions / updatePlanDefinition', () => {
    // The seeding itself moved to EntitlementsService so the limits the Founder
    // console displays are seeded by the same code path that enforces them at
    // write time. The seeding behaviour (seeds when empty / never reseeds over
    // an operator's tuned values) is therefore asserted directly in
    // entitlements.service.spec.ts. What matters *here* is that this read path
    // still triggers it rather than silently returning an unseeded empty table.
    it('delegates plan-definition seeding to the shared entitlements service', async () => {
      await service.listPlanDefinitions();
      expect(entitlements.ensurePlanDefinitions).toHaveBeenCalledTimes(1);
    });

    it('404s updating an unknown plan', async () => {
      prisma.planDefinition.findUnique.mockResolvedValueOnce(null);
      await expect(service.updatePlanDefinition('NOT_A_PLAN', {}, founder)).rejects.toThrow(NotFoundException);
    });

    it('updates an existing plan definition and audits it (institute-less, platform-wide)', async () => {
      prisma.planDefinition.findUnique.mockResolvedValueOnce({ plan: 'PRO', maxUsers: 500 });
      prisma.planDefinition.update.mockResolvedValueOnce({ plan: 'PRO', maxUsers: 750 });

      const result = await service.updatePlanDefinition('PRO', { maxUsers: 750 }, founder);

      expect(result.maxUsers).toBe(750);
      expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ instituteId: null, entity: 'plan_definitions', entityId: 'PRO' }) });
    });
  });

  describe('getUsage', () => {
    it('404s for a nonexistent institute', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce(null);
      await expect(service.getUsage('inst-x')).rejects.toThrow(NotFoundException);
    });

    it('returns real usage counts against the institute plan limits', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', plan: 'BASIC', trialEndsAt: null });
      prisma.planDefinition.findUnique.mockResolvedValueOnce({ plan: 'BASIC', maxUsers: 100, maxStudents: 1000, maxTeachers: 50, maxStorageGb: 10, maxAssessmentsPerMonth: 200 });
      prisma.user.count.mockResolvedValueOnce(42).mockResolvedValueOnce(30).mockResolvedValueOnce(8);

      const result = await service.getUsage('inst-1');

      expect(result.usage).toEqual({ users: 42, students: 30, teachers: 8 });
      expect(result.limits?.maxUsers).toBe(100);
    });
  });

  describe('getAnalyticsOverview (Founder Console Phase 5)', () => {
    it('buckets institute creation by month and returns real aggregate counts', async () => {
      prisma.institute.findMany.mockResolvedValueOnce([
        { createdAt: new Date('2026-06-15') },
        { createdAt: new Date('2026-06-20') },
        { createdAt: new Date('2026-07-01') },
      ]);
      prisma.user.count.mockResolvedValueOnce(50).mockResolvedValueOnce(10);
      prisma.exam.count.mockResolvedValueOnce(20).mockResolvedValueOnce(3);
      prisma.assessment.count.mockResolvedValueOnce(15).mockResolvedValueOnce(2);
      prisma.evaluationVersion.count.mockResolvedValueOnce(100).mockResolvedValueOnce(12);

      const result = await service.getAnalyticsOverview();

      expect(result.institutionGrowth).toEqual([
        { month: '2026-06', count: 2 },
        { month: '2026-07', count: 1 },
      ]);
      expect(result.users).toEqual({ total: 50, activeLast30Days: 10 });
      expect(result.assessmentVolume.exams).toEqual({ total: 20, last30Days: 3 });
      expect(result.assessmentVolume.assessments).toEqual({ total: 15, last30Days: 2 });
      expect(result.evaluationVolume).toEqual({ total: 100, last30Days: 12 });
    });
  });

  describe('updateFeatureFlag', () => {
    it('merges the new flag into existing flags rather than overwriting them', async () => {
      prisma.institute.findUnique.mockResolvedValueOnce({ id: 'inst-1', featureFlags: { aiBlueprintAgent: true } });
      prisma.institute.update.mockResolvedValueOnce({ id: 'inst-1', featureFlags: { aiBlueprintAgent: true, omrCapture: true } });

      await service.updateFeatureFlag({ instituteId: 'inst-1', flag: 'omrCapture', enabled: true }, founder);

      expect(prisma.institute.update).toHaveBeenCalledWith({
        where: { id: 'inst-1' },
        data: { featureFlags: { aiBlueprintAgent: true, omrCapture: true } },
      });
    });
  });

  describe('getHealth', () => {
    it('reports postgres up when the query succeeds', async () => {
      const health = await service.getHealth();
      expect(health.postgres.status).toBe('up');
      expect(health.nestjs.status).toBe('up');
    });

    it('reports postgres down when the query throws, without crashing the whole check', async () => {
      prisma.$queryRaw.mockRejectedValueOnce(new Error('connection refused'));
      const health = await service.getHealth();
      expect(health.postgres.status).toBe('down');
      expect(health.postgres.latencyMs).toBeNull();
    });

    it('reports redis up when the queue client pings successfully (Founder Console Phase 6)', async () => {
      const health = await service.getHealth();
      expect(health.redis.status).toBe('up');
    });

    it('reports redis down without crashing the whole check when the ping throws', async () => {
      const brokenClient = { ping: jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')) };
      (service as any).masteryRecalcQueue.client = Promise.resolve(brokenClient);
      const health = await service.getHealth();
      expect(health.redis.status).toBe('down');
      expect(health.redis.latencyMs).toBeNull();
    });
  });

  describe('getQueueMetrics (Founder Console Phase 6)', () => {
    it('returns job counts for all six queues', async () => {
      const result = await service.getQueueMetrics();
      expect(result).toHaveLength(6);
      expect(result.map((r) => r.name)).toEqual([
        'mastery-recalc', 'ai-evaluation', 'score-aggregation', 'notice-dispatch', 'ocr', 'report-generation',
      ]);
      expect(result.every((r) => r.available)).toBe(true);
    });

    it('marks a queue unavailable rather than crashing the whole response when getJobCounts throws', async () => {
      (service as any).aiEvaluationQueue.getJobCounts = jest.fn().mockRejectedValueOnce(new Error('down'));
      const result = await service.getQueueMetrics();
      const aiEval = result.find((r) => r.name === 'ai-evaluation');
      expect(aiEval?.available).toBe(false);
      expect(aiEval?.counts).toBeNull();
      expect(result.filter((r) => r.available)).toHaveLength(5);
    });
  });

  describe('getIntegrations (Founder Console Phase 7)', () => {
    it('never includes a secret value, only booleans and a status/description', async () => {
      configValues.GOOGLE_CLIENT_ID = 'client-id';
      configValues.GOOGLE_CLIENT_SECRET = 'super-secret-value';
      configValues.SENDGRID_API_KEY = 'sg-secret-key';
      storage.isConfigured.mockReturnValue(true);

      const result = await service.getIntegrations();
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('super-secret-value');
      expect(serialized).not.toContain('sg-secret-key');

      const google = result.find((r) => r.key === 'googleOAuth');
      expect(google?.configured).toBe(true);

      const s3 = result.find((r) => r.key === 's3Storage');
      expect(s3?.configured).toBe(true);
    });

    it('reports email/SMS/WhatsApp as configured-but-not-wired, matching the real notice-dispatch stub behavior', async () => {
      configValues.SENDGRID_API_KEY = 'sg-key';
      configValues.WHATSAPP_API_TOKEN = 'wa-token';
      configValues.SMS_GATEWAY_KEY = 'sms-key';

      const result = await service.getIntegrations();

      for (const key of ['sendgridEmail', 'whatsapp', 'sms']) {
        const entry = result.find((r) => r.key === key);
        expect(entry?.configured).toBe(true);
        expect(entry?.wired).toBe(false);
      }
    });

    it('reflects live Python service status via the real health check', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await service.getIntegrations();
      const python = result.find((r) => r.key === 'pythonAiService');
      expect(python?.status).toBe('down');
    });
  });
});
