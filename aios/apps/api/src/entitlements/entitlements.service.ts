import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InstitutePlan, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PLAN_DEFINITIONS,
  EntitlementResource,
  PlanLimits,
} from './plan-definitions';

/**
 * Write-time enforcement of per-plan limits.
 *
 * Before this service, `PlanDefinition`'s limits were advisory only — the
 * schema comment said so explicitly ("Write-time enforcement ... is a
 * deliberately separate, not-yet-built concern"). The commercial consequence
 * was that a TRIAL institute could create unlimited students, teachers and
 * assessments, so the paid tiers gated nothing and there was nothing to sell.
 *
 * Design rules this service follows:
 *
 * 1. **Centralised.** Plan checks live here, never scattered as inline
 *    `if (plan === 'TRIAL')` conditionals through the domain services. Callers
 *    only ever say *what they are about to create*.
 * 2. **`null` means unlimited**, never zero. An ENTERPRISE plan, or any limit an
 *    operator clears from the Founder console, must not accidentally block
 *    everything.
 * 3. **Transaction-aware.** Callers already creating inside a `$transaction`
 *    pass their `tx` client so the count and the insert see one consistent
 *    snapshot. Without this the check is a TOCTOU race: two concurrent creates
 *    at the limit boundary both read `n`, both pass, and both write.
 * 4. **Actionable refusal.** Exceeding a limit is a 403 carrying a machine
 *    -readable `PLAN_LIMIT_EXCEEDED` code plus the plan, the limit and the
 *    current count, so the UI can say "You're on TRIAL (100 students). Upgrade
 *    to add more." rather than a bare "Forbidden".
 */
@Injectable()
export class EntitlementsService {
  private readonly logger = new Logger(EntitlementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seeds `PlanDefinition` on first use. Idempotent: a non-empty table is left
   * exactly as the operator has tuned it — this never overwrites live limits.
   */
  async ensurePlanDefinitions(): Promise<void> {
    const count = await this.prisma.planDefinition.count();
    if (count > 0) return;
    await this.prisma.planDefinition.createMany({
      data: Object.entries(DEFAULT_PLAN_DEFINITIONS).map(([plan, limits]) => ({
        plan: plan as InstitutePlan,
        ...limits,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * The live limits for a plan. Falls back to the compiled-in defaults if the
   * row is somehow absent, so enforcement can never be silently disabled by a
   * missing seed — a missing row must not read as "unlimited".
   */
  async getLimits(plan: InstitutePlan): Promise<PlanLimits> {
    await this.ensurePlanDefinitions();
    const row = await this.prisma.planDefinition.findUnique({ where: { plan } });
    if (!row) {
      this.logger.warn(`No PlanDefinition row for plan ${plan}; falling back to compiled defaults.`);
      return DEFAULT_PLAN_DEFINITIONS[plan];
    }
    return {
      maxUsers: row.maxUsers,
      maxStudents: row.maxStudents,
      maxTeachers: row.maxTeachers,
      maxStorageGb: row.maxStorageGb,
      maxAssessmentsPerMonth: row.maxAssessmentsPerMonth,
      trialDurationDays: row.trialDurationDays,
    };
  }

  /**
   * Current usage vs. limits for one institute. Shared by the Founder console
   * and (later) the customer-facing billing screen, so both always report the
   * same numbers the enforcement path actually uses.
   */
  async getSnapshot(instituteId: string) {
    const institute = await this.prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) throw new NotFoundException('Institute not found.');

    const [limits, users, students, teachers, assessmentsThisMonth] = await Promise.all([
      this.getLimits(institute.plan),
      this.prisma.user.count({ where: { instituteId } }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.STUDENT } }),
      this.prisma.user.count({ where: { instituteId, role: UserRole.TEACHER } }),
      this.countAssessmentsThisMonth(instituteId),
    ]);

    const usage = { users, students, teachers, assessmentsThisMonth };

    return {
      plan: institute.plan,
      trialEndsAt: institute.trialEndsAt,
      trialExpired: this.isTrialExpired(institute.plan, institute.trialEndsAt),
      limits,
      usage,
      remaining: {
        users: remaining(limits.maxUsers, users),
        students: remaining(limits.maxStudents, students),
        teachers: remaining(limits.maxTeachers, teachers),
        assessmentsThisMonth: remaining(limits.maxAssessmentsPerMonth, assessmentsThisMonth),
      },
    };
  }

  /**
   * Throws if creating one more `resource` would exceed the institute's plan.
   *
   * @param tx Pass the caller's transaction client when the create happens in a
   *           transaction, so the count and the insert are atomic together.
   */
  async assertCanCreate(
    instituteId: string,
    resource: EntitlementResource,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;

    const institute = await client.institute.findUnique({
      where: { id: instituteId },
      select: { plan: true, trialEndsAt: true },
    });
    if (!institute) throw new NotFoundException('Institute not found.');

    // An expired trial blocks *new* data but never reads or edits of existing
    // data — locking an institute out of its own records over an expired trial
    // would be a hostile failure mode, and would also block the very work a
    // renewal conversation depends on.
    if (this.isTrialExpired(institute.plan, institute.trialEndsAt)) {
      throw new ForbiddenException({
        code: 'TRIAL_EXPIRED',
        message:
          'Your trial has ended. Existing data stays available — upgrade your plan to add new records.',
        details: { plan: institute.plan, trialEndsAt: institute.trialEndsAt },
      });
    }

    const limits = await this.getLimits(institute.plan);
    const limit = limitFor(limits, resource);

    // null = unlimited. Checked before counting so ENTERPRISE never pays for a
    // count query it cannot fail.
    if (limit === null) return;

    const current = await this.countResource(client, instituteId, resource);
    if (current >= limit) {
      throw new ForbiddenException({
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `Your ${institute.plan} plan allows ${limit} ${humanResource(resource)}. Upgrade your plan to add more.`,
        details: { plan: institute.plan, resource, limit, current },
      });
    }
  }

  // ── internals ────────────────────────────────────────────────────────────

  private isTrialExpired(plan: InstitutePlan, trialEndsAt: Date | null): boolean {
    if (plan !== InstitutePlan.TRIAL) return false;
    // A TRIAL with no end date set is treated as still running — an operator
    // provisioning a trial without a date must not accidentally create an
    // instantly-locked institute.
    if (!trialEndsAt) return false;
    return trialEndsAt.getTime() < Date.now();
  }

  private async countResource(
    client: Prisma.TransactionClient | PrismaService,
    instituteId: string,
    resource: EntitlementResource,
  ): Promise<number> {
    switch (resource) {
      case EntitlementResource.STUDENT:
        return client.user.count({ where: { instituteId, role: UserRole.STUDENT } });
      case EntitlementResource.TEACHER:
        return client.user.count({ where: { instituteId, role: UserRole.TEACHER } });
      case EntitlementResource.USER:
        return client.user.count({ where: { instituteId } });
      case EntitlementResource.ASSESSMENT:
        return this.countAssessmentsThisMonth(instituteId, client);
    }
  }

  /**
   * `maxAssessmentsPerMonth` is a *rate*, not a total, so this counts from the
   * start of the current calendar month rather than all time.
   */
  private async countAssessmentsThisMonth(
    instituteId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    return client.assessment.count({
      where: { instituteId, createdAt: { gte: monthStart } },
    });
  }
}

function limitFor(limits: PlanLimits, resource: EntitlementResource): number | null {
  switch (resource) {
    case EntitlementResource.STUDENT:
      return limits.maxStudents;
    case EntitlementResource.TEACHER:
      return limits.maxTeachers;
    case EntitlementResource.USER:
      return limits.maxUsers;
    case EntitlementResource.ASSESSMENT:
      return limits.maxAssessmentsPerMonth;
  }
}

function remaining(limit: number | null, used: number): number | null {
  return limit === null ? null : Math.max(0, limit - used);
}

function humanResource(resource: EntitlementResource): string {
  switch (resource) {
    case EntitlementResource.STUDENT:
      return 'students';
    case EntitlementResource.TEACHER:
      return 'teachers';
    case EntitlementResource.USER:
      return 'users';
    case EntitlementResource.ASSESSMENT:
      return 'assessments per month';
  }
}
