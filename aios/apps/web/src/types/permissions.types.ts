// ─── AIOS Permission Types ────────────────────────────────────────────────────
// All permission strings are defined here as a union type.
// Source of truth for client-side RBAC checks and fine-grained permissions.
// The server ALWAYS re-validates — frontend is UX defense, not security defense.

export type Permission =
  // ── Evaluations & Moderation
  | 'REVIEW_EVALUATION'
  | 'evaluation:grade'
  | 'evaluation:analytics'

  // ── Attendance Capabilities
  | 'ATTENDANCE_TAKE'
  | 'ATTENDANCE_CORRECT'
  | 'ATTENDANCE_CORRECT_HISTORICAL'
  | 'ATTENDANCE_OVERRIDE'
  | 'ATTENDANCE_ADMIN'
  | 'attendance:mark'
  | 'attendance:view-batch'
  | 'attendance:view-own'
  | 'attendance:edit'

  // ── Assignments
  | 'assignment:manage'
  | 'assignment:create'
  | 'assignment:read'
  | 'assignment:update'
  | 'assignment:delete'
  | 'assignment:archive'
  | 'assignment:restore'
  | 'assignment:publish'
  | 'assignment:unpublish'
  | 'assignment:grade'
  | 'assignment:view-submissions'

  // ── Tests & Exams
  | 'exam:schedule'
  | 'exam:publish'
  | 'exam:unlock'
  | 'test:create'
  | 'test:read'
  | 'test:update'
  | 'test:delete'
  | 'test:publish'
  | 'test:unpublish'
  | 'test:grade'
  | 'test:view-results'
  | 'test:view-analytics'
  | 'test:archive'

  // ── Papers & Question Bank
  | 'paper:create'
  | 'paper:read'
  | 'paper:update'
  | 'paper:delete'
  | 'paper:publish'
  | 'question:author'
  | 'question:approve'
  | 'question:create'
  | 'question:read'
  | 'question:update'
  | 'question:delete'

  // ── Students
  | 'student:view-all'        // Admin, Academic Head, Coordinator
  | 'student:view-batch'      // Teacher (own batches only)
  | 'student:view-own'        // Student (own profile only)
  | 'student:view-personal'   // Teacher/Admin (personalized data)
  | 'student:view_pii'
  | 'student:enroll'
  | 'student:transfer'
  | 'student:transfer-batch'
  | 'student:archive'

  // ── Teachers & Staff
  | 'teacher:view-all'
  | 'teacher:create'
  | 'teacher:update'
  | 'teacher:archive'
  | 'teacher:manage'
  | 'teacher:assign-batch'
  | 'teacher:assign_batches'
  | 'staff:view_all'

  // ── Batches & Curriculum
  | 'batch:manage'
  | 'batch:assign'
  | 'batch:create'
  | 'batch:update'
  | 'batch:archive'
  | 'batch:view-all'
  | 'batch:view-own'
  | 'curriculum:manage'

  // ── Doubts
  | 'doubt:submit'
  | 'doubt:resolve'
  | 'doubt:assign'
  | 'doubt:view-batch'
  | 'doubt:view-own'
  | 'doubt:view-all'

  // ── Analytics
  | 'analytics:view_institute'
  | 'analytics:institute'
  | 'analytics:branch'
  | 'analytics:batch'
  | 'analytics:own'
  | 'analytics:personalized'

  // ── Timetable
  | 'timetable:view'
  | 'timetable:manage'

  // ── Reports
  | 'report:generate'
  | 'report:export'
  | 'report:view-batch'
  | 'report:view-own'
  | 'report:view-all'
  | 'report:download'

  // ── Admin & Governance Operations
  | 'access:manage_roles'
  | 'access:allowlist'
  | 'settings:institute'
  | 'institute:manage'
  | 'branch:manage'
  | 'session:manage'
  | 'fee:manage'
  | 'fee:view'

  // ── Audit & System
  | 'audit:view'
  | 'feature-flag:manage'
  | 'soft-delete:permanent'   // FOUNDER only
  | 'notification:send-all'
  | 'notification:send-batch'
  | 'notification:send-student';

export interface CanonicalPermissionItem {
  key: string;
  label: string;
  description: string;
  category: PermissionCategoryKey;
  risk: 'standard' | 'sensitive' | 'critical';
  supportedScopes: ('INSTITUTE' | 'BATCH' | 'SUBJECT')[];
  dependencies?: string[];
}

export type PermissionCategoryKey =
  | 'academics'
  | 'questions'
  | 'exams'
  | 'evaluations'
  | 'attendance'
  | 'students'
  | 'staff'
  | 'reports'
  | 'governance';

export interface PermissionCategoryDef {
  id: PermissionCategoryKey;
  label: string;
  description: string;
  icon: string;
}

export interface RoleTemplateDef {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  isSystem: boolean;
  permissions: string[];
  defaultScope: 'INSTITUTE' | 'BATCH' | 'SUBJECT';
  userCount?: number;
}

export interface PermissionGrantRecord {
  id: string;
  userId: string;
  permission: string;
  batchId: string | null;
  subjectId: string | null;
  batchName?: string | null;
  subjectName?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string | null;
  };
  grantedBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SimulationResult {
  userId?: string;
  roleId?: string;
  totalGrantedCount: number;
  accessibleModules: string[];
  activePermissions: CanonicalPermissionItem[];
  sensitiveFlags: {
    permission: string;
    label: string;
    risk: 'standard' | 'sensitive' | 'critical';
    warning: string;
  }[];
  scope: {
    batchId: string;
    subjectId: string;
  };
}

export interface PermissionAuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  actorName: string;
  actorEmail: string;
  oldValue: any;
  newValue: any;
  createdAt: string;
}
