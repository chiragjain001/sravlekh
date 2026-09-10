import { InstitutePlan } from '@prisma/client';

/**
 * Canonical per-plan limits.
 *
 * This was previously a private constant inside FounderService, where it could
 * only ever be *displayed* (usage-vs-limit on the Founder dashboard). It now
 * lives here because two different concerns need the same numbers and must never
 * drift apart: the Founder read-side display, and the write-side enforcement in
 * EntitlementsService. FounderService imports from here rather than keeping its
 * own copy.
 *
 * `null` means unlimited — the ENTERPRISE case, and the correct reading for any
 * limit an operator deliberately clears.
 */
export interface PlanLimits {
  maxUsers: number | null;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxStorageGb: number | null;
  maxAssessmentsPerMonth: number | null;
  trialDurationDays: number | null;
}

// Seeded lazily on first read (see EntitlementsService.ensurePlanDefinitions)
// rather than via a data migration — keeps the "these are adjustable defaults,
// not baked business decisions" framing in one place and makes the seed
// idempotent. Operators change the live values from the Founder console; these
// are only ever the starting point for a fresh database.
export const DEFAULT_PLAN_DEFINITIONS: Record<InstitutePlan, PlanLimits> = {
  TRIAL: { maxUsers: 20, maxStudents: 100, maxTeachers: 10, maxStorageGb: 1, maxAssessmentsPerMonth: 20, trialDurationDays: 14 },
  BASIC: { maxUsers: 100, maxStudents: 1000, maxTeachers: 50, maxStorageGb: 10, maxAssessmentsPerMonth: 200, trialDurationDays: null },
  PRO: { maxUsers: 500, maxStudents: 5000, maxTeachers: 200, maxStorageGb: 50, maxAssessmentsPerMonth: 1000, trialDurationDays: null },
  ENTERPRISE: { maxUsers: null, maxStudents: null, maxTeachers: null, maxStorageGb: null, maxAssessmentsPerMonth: null, trialDurationDays: null },
};

/** The countable resources a plan limit can apply to at write time. */
export enum EntitlementResource {
  STUDENT = 'STUDENT',
  TEACHER = 'TEACHER',
  USER = 'USER',
  ASSESSMENT = 'ASSESSMENT',
}
