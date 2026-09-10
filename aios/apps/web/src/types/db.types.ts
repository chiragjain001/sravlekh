// ─── Core DB Types ────────────────────────────────────────────────────────────
// Re-exported so the frontend never imports from @aios/db directly.

// Kept in lockstep with the real Prisma `UserRole` enum (packages/db/prisma/schema.prisma).
// Do not add a role here until it exists in the database enum and has real backend
// @Roles() support — a frontend-only role is unreachable dead code (audit finding SH1).
export type UserRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'ADMIN'
  | 'FOUNDER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED' | 'ON_LEAVE';

// Roles that can manage academic content
export const ACADEMIC_ROLES: UserRole[] = ['TEACHER', 'ADMIN', 'FOUNDER'];

// Roles that can view dashboards
export const DASHBOARD_ROLES: UserRole[] = ['STUDENT', 'TEACHER', 'ADMIN', 'FOUNDER'];

