// ─── RBAC — Role-Based Access Control ────────────────────────────────────────
// Central permission map. This is the ONLY place where role→permission
// relationships are defined on the frontend.
// The server ALWAYS re-validates. This is for UX-level access control only.

import type { UserRole } from '@/types/db.types';
import type { Permission } from '@/types/permissions.types';

// ── Permission → Allowed Roles map ───────────────────────────────────────────
export const PERMISSIONS: Record<Permission, readonly UserRole[]> = {

  // ── Assignments
  'assignment:create':           ['TEACHER', 'ADMIN', 'FOUNDER'],
  'assignment:read':             ['TEACHER', 'STUDENT', 'ADMIN', 'FOUNDER'],
  'assignment:update':           ['TEACHER', 'ADMIN'],
  'assignment:delete':           ['TEACHER', 'ADMIN'],
  'assignment:archive':          ['TEACHER', 'ADMIN'],
  'assignment:restore':          ['TEACHER', 'ADMIN'],
  'assignment:publish':          ['TEACHER', 'ADMIN'],
  'assignment:unpublish':        ['TEACHER', 'ADMIN'],
  'assignment:grade':            ['TEACHER', 'ADMIN'],
  'assignment:view-submissions': ['TEACHER', 'ADMIN'],

  // ── Tests & Exams
  'test:create':                 ['TEACHER', 'ADMIN'],
  'test:read':                   ['TEACHER', 'STUDENT', 'ADMIN'],
  'test:update':                 ['TEACHER', 'ADMIN'],
  'test:delete':                 ['TEACHER', 'ADMIN'],
  'test:publish':                ['TEACHER', 'ADMIN'],
  'test:unpublish':              ['TEACHER', 'ADMIN'],
  'test:grade':                  ['TEACHER', 'ADMIN'],
  'test:view-results':           ['TEACHER', 'STUDENT', 'ADMIN'],
  'test:view-analytics':         ['TEACHER', 'ADMIN'],
  'test:archive':                ['TEACHER', 'ADMIN'],

  // ── Papers & Question Bank
  'paper:create':                ['TEACHER', 'ADMIN'],
  'paper:read':                  ['TEACHER', 'ADMIN'],
  'paper:update':                ['TEACHER', 'ADMIN'],
  'paper:delete':                ['TEACHER', 'ADMIN'],
  'paper:publish':               ['TEACHER', 'ADMIN'],
  'question:create':             ['TEACHER', 'ADMIN'],
  'question:read':               ['TEACHER', 'STUDENT', 'ADMIN'],
  'question:update':             ['TEACHER', 'ADMIN'],
  'question:delete':             ['ADMIN'],

  // ── Students
  'student:view-all':            ['ADMIN', 'FOUNDER'],
  'student:view-batch':          ['TEACHER'],
  'student:view-own':            ['STUDENT'],
  'student:view-personal':       ['TEACHER', 'ADMIN'],  // personalized data
  'student:enroll':              ['ADMIN', 'FOUNDER'],
  'student:transfer-batch':      ['ADMIN', 'FOUNDER'],
  'student:archive':             ['ADMIN', 'FOUNDER'],

  // ── Teachers
  'teacher:view-all':            ['ADMIN', 'FOUNDER'],
  'teacher:create':              ['ADMIN', 'FOUNDER'],
  'teacher:update':              ['ADMIN', 'FOUNDER'],
  'teacher:archive':             ['ADMIN', 'FOUNDER'],
  'teacher:assign-batch':        ['ADMIN'],

  // ── Batches
  'batch:create':                ['ADMIN', 'FOUNDER'],
  'batch:update':                ['ADMIN'],
  'batch:archive':               ['ADMIN', 'FOUNDER'],
  'batch:view-all':              ['ADMIN', 'FOUNDER'],
  'batch:view-own':              ['TEACHER', 'STUDENT'],

  // ── Doubts
  'doubt:submit':                ['STUDENT'],
  'doubt:resolve':               ['TEACHER', 'ADMIN'],
  'doubt:assign':                ['ADMIN'],
  'doubt:view-batch':            ['TEACHER', 'ADMIN'],
  'doubt:view-own':              ['STUDENT'],
  'doubt:view-all':              ['ADMIN', 'FOUNDER'],

  // ── Analytics
  'analytics:institute':         ['ADMIN', 'FOUNDER'],
  'analytics:branch':            ['ADMIN', 'FOUNDER'],
  'analytics:batch':             ['TEACHER', 'ADMIN'],
  'analytics:own':               ['STUDENT'],
  'analytics:personalized':      ['TEACHER', 'ADMIN'],

  // ── Attendance
  'attendance:mark':             ['TEACHER', 'ADMIN'],
  'attendance:view-batch':       ['TEACHER', 'ADMIN'],
  'attendance:view-own':         ['STUDENT'],
  'attendance:edit':             ['ADMIN'],

  // ── Timetable
  'timetable:view':              ['TEACHER', 'STUDENT', 'ADMIN'],
  'timetable:manage':            ['ADMIN'],

  // ── Reports
  'report:generate':             ['TEACHER', 'ADMIN'],
  'report:view-batch':           ['TEACHER', 'ADMIN'],
  'report:view-own':             ['STUDENT'],
  'report:view-all':             ['ADMIN', 'FOUNDER'],
  'report:download':             ['TEACHER', 'ADMIN', 'STUDENT'],

  // ── Admin Operations
  'institute:manage':            ['FOUNDER'],
  'branch:manage':               ['ADMIN', 'FOUNDER'],
  'session:manage':              ['ADMIN', 'FOUNDER'],
  'fee:manage':                  ['ADMIN', 'FOUNDER'],
  'fee:view':                    ['ADMIN', 'FOUNDER'],

  // ── Audit & System
  'audit:view':                  ['ADMIN', 'FOUNDER'],
  'feature-flag:manage':         ['FOUNDER'],
  'soft-delete:permanent':       ['FOUNDER'],
  'notification:send-all':       ['ADMIN', 'FOUNDER'],
  'notification:send-batch':     ['TEACHER', 'ADMIN'],
  'notification:send-student':   ['TEACHER', 'ADMIN'],
} as const;

// ── Helper Functions ──────────────────────────────────────────────────────────

/**
 * Check if a role has a specific permission.
 * Primary client-side check — server always re-validates.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

/**
 * Get all permissions for a given role.
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter(
    perm => (PERMISSIONS[perm] as readonly string[]).includes(role)
  );
}

/**
 * Check if a role has ALL of the specified permissions.
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

// ── Default permissions per role (used to populate AuthenticatedUser.permissions)
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<UserRole, Permission[]> = {
  STUDENT: getPermissionsForRole('STUDENT'),
  TEACHER: getPermissionsForRole('TEACHER'),
  ADMIN:   getPermissionsForRole('ADMIN'),
  FOUNDER: getPermissionsForRole('FOUNDER'),
};
