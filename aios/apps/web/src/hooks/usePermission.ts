'use client';

// ─── usePermission Hooks ──────────────────────────────────────────────────────
// RBAC permission checks derived from the authenticated user's role.
// Always use these hooks for conditional rendering — never hardcode role strings.
//
// Usage:
//   const canCreate = usePermission('assignment:create');
//   const { canGrade, canView } = usePermissions(['test:grade', 'test:read']);

import { useAuth } from '@/contexts/auth.context';
import { hasPermission, hasAllPermissions, hasAnyPermission } from '@/lib/permissions/rbac';
import type { Permission } from '@/types/permissions.types';
import type { UserRole } from '@/types/db.types';

/** Check a single permission for the current user's role */
export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasPermission(user.role, permission);
}

/** Check multiple permissions — returns a map of permission → boolean */
export function usePermissions<T extends Permission>(
  permissions: T[]
): Record<T, boolean> {
  const { user } = useAuth();
  const result = {} as Record<T, boolean>;
  if (!user) {
    permissions.forEach(p => { result[p] = false; });
    return result;
  }
  permissions.forEach(p => {
    result[p] = hasPermission(user.role, p);
  });
  return result;
}

/** Returns true if user has ALL listed permissions */
export function useAllPermissions(permissions: Permission[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasAllPermissions(user.role, permissions);
}

/** Returns true if user has ANY of the listed permissions */
export function useAnyPermission(permissions: Permission[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return hasAnyPermission(user.role, permissions);
}

/** Returns true if user's role meets the minimum required role level */
export function useMinRole(minRole: UserRole): boolean {
  const { user } = useAuth();
  if (!user) return false;
  const ROLE_LEVEL: Record<UserRole, number> = {
    STUDENT: 1, TEACHER: 3, ADMIN: 5, FOUNDER: 10,
  };
  return (ROLE_LEVEL[user.role] ?? 0) >= (ROLE_LEVEL[minRole] ?? 99);
}

/** Returns the current user's role */
export function useRole(): UserRole | null {
  const { user } = useAuth();
  return user?.role ?? null;
}
