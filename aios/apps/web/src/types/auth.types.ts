import type { UserRole } from './db.types';
import type { Permission } from './permissions.types';
import type { FeatureFlags, InstituteConfig, BranchConfig, AcademicSession } from './academic-context.types';

export interface AuthenticatedUser {
  // ── Core Identity
  id:            string;
  email:         string;
  name:          string;
  role:          UserRole;
  avatarUrl?:    string;
  avatarInitials: string;

  // ── Tenant Isolation (NEVER null for authenticated users)
  instituteId:   string;
  branchId:      string;

  // ── Active Academic Period
  sessionId:     string;          // Current active session e.g. "2025-26"

  // ── Role-specific IDs
  teacherId?:    string;          // Populated when role = TEACHER
  studentId?:    string;          // Populated when role = STUDENT
  parentId?:     string;          // Populated when role = PARENT

  // ── Permissions & Feature Access
  permissions:   Permission[];
  featureFlags:  FeatureFlags;

  // ── Institute Configuration (for config-driven UI)
  instituteConfig: Pick<InstituteConfig, 'name' | 'type' | 'logo' | 'theme' | 'activeExams'>;
  branchConfig:    Pick<BranchConfig, 'name' | 'city' | 'timezone' | 'activeExams'>;
  activeSessions:  AcademicSession[];
}

export interface LoginResponse {
  accessToken: string;
  user:        AuthenticatedUser;
}

/**
 * The actual shape POST /auth/google returns today (apps/api/src/auth/auth.types.ts).
 * Deliberately narrower than the full local AuthenticatedUser — everything else
 * (permissions, feature flags, branch/session scoping) isn't modeled server-side yet.
 * See docs/33-GAP-ANALYSIS-AND-BUILD-PLAN.md.
 */
export interface GoogleLoginApiResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    instituteId: string;
    avatarUrl?: string | null;
  };
}

