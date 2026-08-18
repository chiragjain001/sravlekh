// ─── RBAC — Role-Based Access Control ────────────────────────────────────────
// Central permission map. This is the ONLY place where role→permission
// relationships are defined on the frontend.
// The server ALWAYS re-validates. This is for UX-level access control only.

import type { UserRole } from '@/types/db.types';
import type { Permission } from '@/types/permissions.types';

// ── Permission → Allowed Roles map ───────────────────────────────────────────
export const PERMISSIONS: Record<Permission, readonly UserRole[]> = {

  // ── Assignments
  'assignment:create':           ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:read':             ['TEACHER', 'STUDENT', 'ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],
  'assignment:update':           ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:delete':           ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:archive':          ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:restore':          ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:publish':          ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:unpublish':        ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'assignment:grade':            ['TEACHER', 'ADMIN'],
  'assignment:view-submissions': ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],

  // ── Tests & Exams
  'test:create':                 ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'test:read':                   ['TEACHER', 'STUDENT', 'ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],
  'test:update':                 ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'test:delete':                 ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'test:publish':                ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'test:unpublish':              ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'test:grade':                  ['TEACHER', 'ADMIN'],
  'test:view-results':           ['TEACHER', 'STUDENT', 'ADMIN', 'ACADEMIC_HEAD', 'PARENT'],
  'test:view-analytics':         ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'test:archive':                ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],

  // ── Papers & Question Bank
  'paper:create':                ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'paper:read':                  ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'paper:update':                ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'paper:delete':                ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'paper:publish':               ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'question:create':             ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'question:read':               ['TEACHER', 'STUDENT', 'ADMIN', 'ACADEMIC_HEAD'],
  'question:update':             ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'question:delete':             ['ADMIN', 'ACADEMIC_HEAD'],

  // ── Students
  'student:view-all':            ['ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR', 'FOUNDER'],
  'student:view-batch':          ['TEACHER', 'COORDINATOR'],
  'student:view-own':            ['STUDENT'],
  'student:view-personal':       ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],  // personalized data
  'student:enroll':              ['ADMIN', 'RECEPTIONIST', 'COORDINATOR'],
  'student:transfer-batch':      ['ADMIN', 'COORDINATOR'],
  'student:archive':             ['ADMIN', 'FOUNDER'],

  // ── Teachers
  'teacher:view-all':            ['ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR', 'FOUNDER'],
  'teacher:create':              ['ADMIN', 'FOUNDER'],
  'teacher:update':              ['ADMIN', 'FOUNDER'],
  'teacher:archive':             ['ADMIN', 'FOUNDER'],
  'teacher:assign-batch':        ['ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],

  // ── Batches
  'batch:create':                ['ADMIN', 'ACADEMIC_HEAD', 'FOUNDER'],
  'batch:update':                ['ADMIN', 'ACADEMIC_HEAD'],
  'batch:archive':               ['ADMIN', 'FOUNDER'],
  'batch:view-all':              ['ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR', 'FOUNDER'],
  'batch:view-own':              ['TEACHER', 'STUDENT'],

  // ── Doubts
  'doubt:submit':                ['STUDENT'],
  'doubt:resolve':               ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'doubt:assign':                ['ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],
  'doubt:view-batch':            ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],
  'doubt:view-own':              ['STUDENT'],
  'doubt:view-all':              ['ADMIN', 'ACADEMIC_HEAD', 'FOUNDER'],

  // ── Analytics
  'analytics:institute':         ['ADMIN', 'ACADEMIC_HEAD', 'FOUNDER'],
  'analytics:branch':            ['ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR', 'FOUNDER'],
  'analytics:batch':             ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],
  'analytics:own':               ['STUDENT'],
  'analytics:personalized':      ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],

  // ── Attendance
  'attendance:mark':             ['TEACHER', 'ADMIN', 'COORDINATOR'],
  'attendance:view-batch':       ['TEACHER', 'ADMIN', 'COORDINATOR', 'ACADEMIC_HEAD'],
  'attendance:view-own':         ['STUDENT', 'PARENT'],
  'attendance:edit':             ['ADMIN', 'COORDINATOR'],

  // ── Timetable
  'timetable:view':              ['TEACHER', 'STUDENT', 'ADMIN', 'COORDINATOR', 'PARENT'],
  'timetable:manage':            ['ADMIN', 'COORDINATOR', 'ACADEMIC_HEAD'],

  // ── Reports
  'report:generate':             ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD'],
  'report:view-batch':           ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD', 'COORDINATOR'],
  'report:view-own':             ['STUDENT', 'PARENT'],
  'report:view-all':             ['ADMIN', 'ACADEMIC_HEAD', 'FOUNDER'],
  'report:download':             ['TEACHER', 'ADMIN', 'ACADEMIC_HEAD', 'STUDENT', 'PARENT'],

  // ── Admin Operations
  'institute:manage':            ['FOUNDER'],
  'branch:manage':               ['ADMIN', 'FOUNDER'],
  'session:manage':              ['ADMIN', 'FOUNDER'],
  'fee:manage':                  ['ADMIN', 'ACCOUNTANT', 'FOUNDER'],
  'fee:view':                    ['ADMIN', 'ACCOUNTANT', 'FOUNDER', 'PARENT'],

  // ── Audit & System
  'audit:view':                  ['ADMIN', 'ACADEMIC_HEAD', 'FOUNDER'],
  'feature-flag:manage':         ['FOUNDER'],
  'soft-delete:permanent':       ['FOUNDER'],
  'notification:send-all':       ['ADMIN', 'FOUNDER', 'ACADEMIC_HEAD'],
  'notification:send-batch':     ['TEACHER', 'ADMIN', 'COORDINATOR'],
  'notification:send-student':   ['TEACHER', 'ADMIN', 'COORDINATOR'],
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
  STUDENT:       getPermissionsForRole('STUDENT'),
  TEACHER:       getPermissionsForRole('TEACHER'),
  ACADEMIC_HEAD: getPermissionsForRole('ACADEMIC_HEAD'),
  COORDINATOR:   getPermissionsForRole('COORDINATOR'),
  ADMIN:         getPermissionsForRole('ADMIN'),
  RECEPTIONIST:  getPermissionsForRole('RECEPTIONIST'),
  ACCOUNTANT:    getPermissionsForRole('ACCOUNTANT'),
  PARENT:        getPermissionsForRole('PARENT'),
  FOUNDER:       getPermissionsForRole('FOUNDER'),
};
