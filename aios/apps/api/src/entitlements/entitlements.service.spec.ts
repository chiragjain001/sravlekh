import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { InstitutePlan, UserRole } from '@prisma/client';
import { EntitlementsService } from './entitlements.service';
import { EntitlementResource, DEFAULT_PLAN_DEFINITIONS } from './plan-definitions';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Before this service existed, PlanDefinition limits were advisory only — the
 * schema comment said so explicitly. A TRIAL institute could create unlimited
 * students, teachers and assessments, which meant the paid tiers gated nothing.
 * These tests are the contract for the write-time enforcement that closes that.
 */
describe('EntitlementsService', () => {
  let service: EntitlementsService;
  let prisma: {
    planDefinition: { count: jest.Mock; findUnique: jest.Mock; createMany: jest.Mock };
    institute: { findUnique: jest.Mock };
    user: { count: jest.Mock };
    assessment: { count: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      planDefinition: { count: jest.fn().mockResolvedValue(4), findUnique: jest.fn(), createMany: jest.fn() },
      institute: { findUnique: jest.fn() },
      user: { count: jest.fn() },
      assessment: { count: jest.fn() },
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntitlementsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(EntitlementsService);
  });

  const onPlan = (plan: InstitutePlan, trialEndsAt: Date | null = null) => {
    prisma.institute.findUnique.mockResolvedValue({ plan, trialEndsAt });
    prisma.planDefinition.findUnique.mockResolvedValue({
      plan,
      ...DEFAULT_PLAN_DEFINITIONS[plan],
    });
  };

  // ── seeding (moved here from FounderService) ─────────────────────────────

  describe('ensurePlanDefinitions', () => {
    it('seeds the default definitions once when the table is empty', async () => {
      prisma.planDefinition.count.mockResolvedValueOnce(0);
      await service.ensurePlanDefinitions();
      expect(prisma.planDefinition.createMany).toHaveBeenCalledTimes(1);
    });

    it('never reseeds over limits an operator has already tuned', async () => {
      prisma.planDefinition.count.mockResolvedValueOnce(4);
      await service.ensurePlanDefinitions();
      expect(prisma.planDefinition.createMany).not.toHaveBeenCalled();
    });
  });

  // ── the core enforcement rules ───────────────────────────────────────────

  describe('assertCanCreate', () => {
    it('allows a create when the institute is below its plan limit', async () => {
      onPlan(InstitutePlan.TRIAL);       // maxStudents: 100
      prisma.user.count.mockResolvedValue(99);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).resolves.toBeUndefined();
    });

    it('blocks the create that would cross the limit, with an actionable code and details', async () => {
      onPlan(InstitutePlan.TRIAL);       // maxStudents: 100
      prisma.user.count.mockResolvedValue(100);

      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).rejects.toMatchObject({
        response: {
          code: 'PLAN_LIMIT_EXCEEDED',
          details: { plan: InstitutePlan.TRIAL, resource: EntitlementResource.STUDENT, limit: 100, current: 100 },
        },
      });
    });

    it('blocks at the boundary, not one past it (>= not >)', async () => {
      onPlan(InstitutePlan.BASIC);       // maxTeachers: 50
      prisma.user.count.mockResolvedValue(50);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.TEACHER)).rejects.toThrow(ForbiddenException);

      prisma.user.count.mockResolvedValue(49);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.TEACHER)).resolves.toBeUndefined();
    });

    it('treats a null limit as UNLIMITED, not as zero (the ENTERPRISE case)', async () => {
      onPlan(InstitutePlan.ENTERPRISE);  // every limit null
      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).resolves.toBeUndefined();
      // And it must not even pay for the count query it could never fail.
      expect(prisma.user.count).not.toHaveBeenCalled();
    });

    it('counts the right resource for each limit (a student create is not gated by the teacher limit)', async () => {
      onPlan(InstitutePlan.TRIAL);
      prisma.user.count.mockResolvedValue(0);

      await service.assertCanCreate('inst-1', EntitlementResource.STUDENT);
      expect(prisma.user.count).toHaveBeenCalledWith({ where: { instituteId: 'inst-1', role: UserRole.STUDENT } });

      await service.assertCanCreate('inst-1', EntitlementResource.TEACHER);
      expect(prisma.user.count).toHaveBeenCalledWith({ where: { instituteId: 'inst-1', role: UserRole.TEACHER } });
    });

    it('counts assessments as a MONTHLY rate, from the start of the current month', async () => {
      onPlan(InstitutePlan.TRIAL);       // maxAssessmentsPerMonth: 20
      prisma.assessment.count.mockResolvedValue(5);

      await service.assertCanCreate('inst-1', EntitlementResource.ASSESSMENT);

      const where = prisma.assessment.count.mock.calls[0][0].where;
      expect(where.instituteId).toBe('inst-1');
      // A total-since-forever count would be wrong: the limit is per month.
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.gte.getUTCDate()).toBe(1);
    });

    it('404s for an institute that does not exist rather than silently allowing', async () => {
      prisma.institute.findUnique.mockResolvedValue(null);
      await expect(service.assertCanCreate('nope', EntitlementResource.STUDENT)).rejects.toThrow(NotFoundException);
    });

    it('falls back to compiled defaults when the PlanDefinition row is missing — a missing seed must never read as unlimited', async () => {
      prisma.institute.findUnique.mockResolvedValue({ plan: InstitutePlan.TRIAL, trialEndsAt: null });
      prisma.planDefinition.findUnique.mockResolvedValue(null);
      prisma.user.count.mockResolvedValue(100); // at TRIAL's compiled-in maxStudents

      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).rejects.toThrow(ForbiddenException);
    });

    it('uses the caller-supplied transaction client so the count and insert are atomic', async () => {
      onPlan(InstitutePlan.TRIAL);
      const tx = {
        institute: { findUnique: jest.fn().mockResolvedValue({ plan: InstitutePlan.TRIAL, trialEndsAt: null }) },
        user: { count: jest.fn().mockResolvedValue(0) },
        assessment: { count: jest.fn() },
      } as any;

      await service.assertCanCreate('inst-1', EntitlementResource.STUDENT, tx);

      // Reading through `tx` is what makes this not a TOCTOU race: two
      // concurrent enrolments at the boundary must not both see the same count.
      expect(tx.user.count).toHaveBeenCalled();
      expect(prisma.user.count).not.toHaveBeenCalled();
    });
  });

  // ── trial expiry ─────────────────────────────────────────────────────────

  describe('trial expiry', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    it('blocks new records once a trial has ended', async () => {
      onPlan(InstitutePlan.TRIAL, yesterday);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).rejects.toMatchObject({
        response: { code: 'TRIAL_EXPIRED' },
      });
    });

    it('still allows creates while the trial is running', async () => {
      onPlan(InstitutePlan.TRIAL, tomorrow);
      prisma.user.count.mockResolvedValue(0);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).resolves.toBeUndefined();
    });

    it('treats a TRIAL with no end date as still running, not instantly locked', async () => {
      // An operator provisioning a trial without setting a date must not
      // accidentally create an institute that can never add a single student.
      onPlan(InstitutePlan.TRIAL, null);
      prisma.user.count.mockResolvedValue(0);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).resolves.toBeUndefined();
    });

    it('never applies trial expiry to a paid plan carrying a stale trialEndsAt', async () => {
      onPlan(InstitutePlan.PRO, yesterday);
      prisma.user.count.mockResolvedValue(0);
      await expect(service.assertCanCreate('inst-1', EntitlementResource.STUDENT)).resolves.toBeUndefined();
    });
  });

  // ── snapshot ─────────────────────────────────────────────────────────────

  describe('getSnapshot', () => {
    it('reports usage, limits and remaining headroom from the same source enforcement uses', async () => {
      onPlan(InstitutePlan.BASIC);       // students 1000, teachers 50
      prisma.user.count
        .mockResolvedValueOnce(120)      // users
        .mockResolvedValueOnce(100)      // students
        .mockResolvedValueOnce(8);       // teachers
      prisma.assessment.count.mockResolvedValue(3);

      const snap = await service.getSnapshot('inst-1');

      expect(snap.plan).toBe(InstitutePlan.BASIC);
      expect(snap.usage).toEqual({ users: 120, students: 100, teachers: 8, assessmentsThisMonth: 3 });
      expect(snap.remaining.students).toBe(900);
      expect(snap.remaining.teachers).toBe(42);
    });

    it('reports unlimited headroom as null rather than a misleading number', async () => {
      onPlan(InstitutePlan.ENTERPRISE);
      prisma.user.count.mockResolvedValue(9999);
      prisma.assessment.count.mockResolvedValue(500);

      const snap = await service.getSnapshot('inst-1');
      expect(snap.remaining.students).toBeNull();
      expect(snap.limits.maxStudents).toBeNull();
    });

    it('never reports negative headroom for an institute already over its limit', async () => {
      // Possible for an institute downgraded to a smaller plan while holding
      // more records than the new plan allows. Enforcement blocks *new* records;
      // the display must not show "-40 remaining".
      onPlan(InstitutePlan.BASIC);
      prisma.user.count
        .mockResolvedValueOnce(2000)
        .mockResolvedValueOnce(1040)
        .mockResolvedValueOnce(10);
      prisma.assessment.count.mockResolvedValue(0);

      const snap = await service.getSnapshot('inst-1');
      expect(snap.remaining.students).toBe(0);
    });
  });
});
