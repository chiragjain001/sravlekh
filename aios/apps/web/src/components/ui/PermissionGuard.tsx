'use client';

// ─── PermissionGuard ──────────────────────────────────────────────────────────
// Conditional render based on RBAC permissions.
// Shows fallback (or null) if user doesn't have the required permission.
// NEVER rely on this alone for security — server always re-validates.
//
// Usage:
//   <PermissionGuard permission="assignment:create">
//     <CreateAssignmentButton />
//   </PermissionGuard>
//
//   <PermissionGuard permission="test:grade" fallback={<ViewOnlyBadge />}>
//     <GradeButton />
//   </PermissionGuard>

import { type ReactNode } from 'react';
import { usePermission, useAnyPermission } from '@/hooks/usePermission';
import { useFeatureFlag } from '@/hooks/useUndo';
import type { Permission } from '@/types/permissions.types';
import type { FeatureFlags } from '@/types/academic-context.types';

// ── Single permission guard
interface PermissionGuardProps {
  permission:  Permission;
  fallback?:   ReactNode;
  children:    ReactNode;
}

export function PermissionGuard({ permission, fallback = null, children }: PermissionGuardProps) {
  const allowed = usePermission(permission);
  return <>{allowed ? children : fallback}</>;
}

// ── Multiple permissions — require ANY
interface AnyPermissionGuardProps {
  permissions: Permission[];
  fallback?:   ReactNode;
  children:    ReactNode;
}

export function AnyPermissionGuard({ permissions, fallback = null, children }: AnyPermissionGuardProps) {
  const allowed = useAnyPermission(permissions);
  return <>{allowed ? children : fallback}</>;
}

// ── Feature flag guard — hides content when feature is disabled for this institute
interface FeatureGuardProps {
  flag:      keyof FeatureFlags;
  fallback?: ReactNode;
  children:  ReactNode;
}

export function FeatureGuard({ flag, fallback = null, children }: FeatureGuardProps) {
  const enabled = useFeatureFlag(flag);
  return <>{enabled ? children : fallback}</>;
}
