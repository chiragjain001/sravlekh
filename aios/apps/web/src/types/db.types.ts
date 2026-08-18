// ─── Core DB Types ────────────────────────────────────────────────────────────
// Re-exported so the frontend never imports from @aios/db directly.

export type UserRole =
  | 'STUDENT'
  | 'TEACHER'
  | 'ACADEMIC_HEAD'
  | 'COORDINATOR'
  | 'ADMIN'
  | 'RECEPTIONIST'
  | 'ACCOUNTANT'
  | 'PARENT'
  | 'FOUNDER';

export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'SUSPENDED' | 'ON_LEAVE';

// Roles that can manage academic content
export const ACADEMIC_ROLES: UserRole[] = ['TEACHER', 'ACADEMIC_HEAD', 'ADMIN', 'FOUNDER'];

// Roles that can view dashboards
export const DASHBOARD_ROLES: UserRole[] = [
  'STUDENT', 'TEACHER', 'ACADEMIC_HEAD', 'COORDINATOR',
  'ADMIN', 'RECEPTIONIST', 'ACCOUNTANT', 'PARENT', 'FOUNDER',
];

