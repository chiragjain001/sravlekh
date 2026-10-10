/**
 * AIOS Canonical Permissions & Educational Role Templates
 *
 * Source of truth for backend validation, permission resolution,
 * and educational access control policies.
 */

export interface CanonicalPermission {
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

export interface PermissionCategory {
  id: PermissionCategoryKey;
  label: string;
  description: string;
  icon: string;
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: 'academics',
    label: 'Academics & Batches',
    description: 'Class batches, sections, timetables, and curriculum structures',
    icon: 'Layers',
  },
  {
    id: 'questions',
    label: 'Question Bank & Papers',
    description: 'Authoring, reviewing, approving questions, and paper blueprints',
    icon: 'FileText',
  },
  {
    id: 'exams',
    label: 'Examinations & Assessments',
    description: 'Scheduling exams, result publications, and emergency unlocks',
    icon: 'ClipboardList',
  },
  {
    id: 'evaluations',
    label: 'Evaluations & Grading',
    description: 'Grading answer sheets, AI review, and score dispute overrides',
    icon: 'Star',
  },
  {
    id: 'attendance',
    label: 'Attendance & Timings',
    description: 'Daily attendance taking, timing windows, corrections, and audit',
    icon: 'Clock',
  },
  {
    id: 'students',
    label: 'Students & Admissions',
    description: 'Enrollment, batch transfers, profile management, and PII access',
    icon: 'Users',
  },
  {
    id: 'staff',
    label: 'Faculty & Staff',
    description: 'Teacher profiles, subject assignments, and workload oversight',
    icon: 'Briefcase',
  },
  {
    id: 'reports',
    label: 'Analytics & Reports',
    description: 'Academic performance dashboards, exports, and report cards',
    icon: 'BarChart2',
  },
  {
    id: 'governance',
    label: 'Access & Governance',
    description: 'Role management, Google allow-list, audit logs, and settings',
    icon: 'Shield',
  },
];

export const CANONICAL_PERMISSIONS: CanonicalPermission[] = [
  // ── Academics & Batches ──────────────────────────────────────────────────
  {
    key: 'batch:manage',
    label: 'Manage Batches & Sections',
    description: 'Create, update, and archive academic batches, classes, and sections',
    category: 'academics',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'batch:assign',
    label: 'Assign Batch Members',
    description: 'Assign or reassign teachers and students to specific batches',
    category: 'academics',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH'],
    dependencies: ['batch:manage'],
  },
  {
    key: 'curriculum:manage',
    label: 'Curriculum & Subjects',
    description: 'Define and organize subjects, chapters, and academic syllabus',
    category: 'academics',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'SUBJECT'],
  },
  {
    key: 'timetable:manage',
    label: 'Manage Timetable',
    description: 'Create, modify, and publish weekly period timetable schedules',
    category: 'academics',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'timetable:view',
    label: 'View Timetable Schedules',
    description: 'View master timetable allocations and period schedules',
    category: 'academics',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },

  // ── Question Bank & Papers ───────────────────────────────────────────────
  {
    key: 'question:author',
    label: 'Author Questions',
    description: 'Draft and submit new questions into the question bank',
    category: 'questions',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'SUBJECT'],
  },
  {
    key: 'question:approve',
    label: 'Approve & Publish Questions',
    description: 'Peer-review and approve submitted questions into verified institute bank',
    category: 'questions',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'SUBJECT'],
    dependencies: ['question:author'],
  },
  {
    key: 'question:delete',
    label: 'Delete Questions',
    description: 'Permanently remove questions from the verified question bank',
    category: 'questions',
    risk: 'critical',
    supportedScopes: ['INSTITUTE', 'SUBJECT'],
  },
  {
    key: 'paper:create',
    label: 'Generate Test Papers',
    description: 'Assemble test blueprints and generate question papers',
    category: 'questions',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'SUBJECT'],
  },
  {
    key: 'paper:publish',
    label: 'Publish Test Papers',
    description: 'Publish finalized test papers for examination use',
    category: 'questions',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'SUBJECT'],
    dependencies: ['paper:create'],
  },

  // ── Examinations & Assessments ───────────────────────────────────────────
  {
    key: 'exam:schedule',
    label: 'Schedule Examinations',
    description: 'Create, schedule, and assign assessment deliveries to batches',
    category: 'exams',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'exam:publish',
    label: 'Publish Examination Results',
    description: 'Release finalized marks and diagnostic reports to students',
    category: 'exams',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'exam:unlock',
    label: 'Emergency Unlock Exam',
    description: 'Unlock completed/locked exam delivery with mandatory audit reason',
    category: 'exams',
    risk: 'critical',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'assignment:manage',
    label: 'Manage Assignments',
    description: 'Create, assign, grade, and review student homework assignments',
    category: 'exams',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH', 'SUBJECT'],
  },

  // ── Evaluations & Grading ────────────────────────────────────────────────
  {
    key: 'evaluation:grade',
    label: 'Grade Answer Sheets',
    description: 'Evaluate student responses and assign criteria rubric scores',
    category: 'evaluations',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH', 'SUBJECT'],
  },
  {
    key: 'REVIEW_EVALUATION',
    label: 'Review & Override Evaluation',
    description: 'Senior reviewer authority to override decided scores with dispute reason',
    category: 'evaluations',
    risk: 'critical',
    supportedScopes: ['INSTITUTE', 'BATCH', 'SUBJECT'],
  },
  {
    key: 'evaluation:analytics',
    label: 'Evaluation Quality Oversight',
    description: 'Inspect grading quality, AI agreement rates, and moderator metrics',
    category: 'evaluations',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },

  // ── Attendance Operations ────────────────────────────────────────────────
  {
    key: 'ATTENDANCE_TAKE',
    label: 'Take Classroom Attendance',
    description: 'Record daily attendance sessions and student present/absent states',
    category: 'attendance',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'ATTENDANCE_CORRECT',
    label: 'Same-Day Attendance Correction',
    description: 'Correct finalized records within same-day cutoff window',
    category: 'attendance',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH'],
    dependencies: ['ATTENDANCE_TAKE'],
  },
  {
    key: 'ATTENDANCE_CORRECT_HISTORICAL',
    label: 'Modify Past / Historical Attendance',
    description: 'Make retroactive corrections to attendance sessions past daily cutoff',
    category: 'attendance',
    risk: 'critical',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'ATTENDANCE_OVERRIDE',
    label: 'Override Timing Cutoff Window',
    description: 'Open locked attendance sessions outside standard daily hours',
    category: 'attendance',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'ATTENDANCE_ADMIN',
    label: 'Full Attendance Administration',
    description: 'Full institute-wide attendance policy configuration and oversight',
    category: 'attendance',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },

  // ── Students & Admissions ────────────────────────────────────────────────
  {
    key: 'student:enroll',
    label: 'Admissions & Enrollment',
    description: 'Enroll new students and manage student academic profiles',
    category: 'students',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'student:transfer',
    label: 'Transfer Students Between Batches',
    description: 'Move students across batches, sections, or academic streams',
    category: 'students',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'student:archive',
    label: 'Archive or Deactivate Students',
    description: 'Archive alumni or suspend student records',
    category: 'students',
    risk: 'critical',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'student:view_pii',
    label: 'View Sensitive Student & Guardian PII',
    description: 'View phone numbers, home addresses, guardian contacts, and DOB',
    category: 'students',
    risk: 'critical',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },

  // ── Faculty & Staff ──────────────────────────────────────────────────────
  {
    key: 'teacher:manage',
    label: 'Manage Faculty Profiles',
    description: 'Onboard, edit qualifications, and manage teacher profiles',
    category: 'staff',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'teacher:assign_batches',
    label: 'Assign Faculty Batches & Subjects',
    description: 'Allocate teachers to specific class batches and subjects',
    category: 'staff',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'BATCH', 'SUBJECT'],
  },
  {
    key: 'staff:view_all',
    label: 'View Staff Directory & Workload',
    description: 'Inspect institute faculty schedule, workload, and availability',
    category: 'staff',
    risk: 'standard',
    supportedScopes: ['INSTITUTE'],
  },

  // ── Analytics, Reports & Exports ─────────────────────────────────────────
  {
    key: 'report:generate',
    label: 'Generate Academic Report Cards',
    description: 'Generate comprehensive student and batch progress reports',
    category: 'reports',
    risk: 'standard',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'report:export',
    label: 'Export Analytics & Grade Data',
    description: 'Download CSV/Excel data exports of institute academic results',
    category: 'reports',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE', 'BATCH'],
  },
  {
    key: 'analytics:view_institute',
    label: 'Institute Executive Analytics',
    description: 'View aggregate institute-wide performance KPIs and trends',
    category: 'reports',
    risk: 'standard',
    supportedScopes: ['INSTITUTE'],
  },

  // ── Access & Governance ──────────────────────────────────────────────────
  {
    key: 'access:manage_roles',
    label: 'Manage Roles & Permissions',
    description: 'Configure custom roles, grant capabilities, and adjust policy scopes',
    category: 'governance',
    risk: 'critical',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'access:allowlist',
    label: 'Manage Sign-In Allow-List',
    description: 'Authorize Google OAuth user emails and baseline sign-in roles',
    category: 'governance',
    risk: 'critical',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'audit:view',
    label: 'Inspect Institute Audit Logs',
    description: 'View immutable security audit trail for all sensitive operations',
    category: 'governance',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },
  {
    key: 'settings:institute',
    label: 'Configure Institute Profile',
    description: 'Update institute legal name, address, contact, and branding',
    category: 'governance',
    risk: 'sensitive',
    supportedScopes: ['INSTITUTE'],
  },
];

export interface RoleTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseRole: 'ADMIN' | 'TEACHER' | 'STUDENT';
  isSystem: boolean;
  permissions: string[];
  defaultScope: 'INSTITUTE' | 'BATCH' | 'SUBJECT';
}

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'tpl_institute_admin',
    name: 'Institute Administrator',
    slug: 'institute_admin',
    description: 'Full administrative authority across all modules (excluding evaluation override)',
    baseRole: 'ADMIN',
    isSystem: true,
    permissions: [
      'batch:manage',
      'batch:assign',
      'curriculum:manage',
      'timetable:manage',
      'timetable:view',
      'question:author',
      'question:approve',
      'question:delete',
      'paper:create',
      'paper:publish',
      'exam:schedule',
      'exam:publish',
      'exam:unlock',
      'assignment:manage',
      'evaluation:grade',
      'evaluation:analytics',
      'ATTENDANCE_TAKE',
      'ATTENDANCE_CORRECT',
      'ATTENDANCE_CORRECT_HISTORICAL',
      'ATTENDANCE_OVERRIDE',
      'ATTENDANCE_ADMIN',
      'student:enroll',
      'student:transfer',
      'student:archive',
      'student:view_pii',
      'teacher:manage',
      'teacher:assign_batches',
      'staff:view_all',
      'report:generate',
      'report:export',
      'analytics:view_institute',
      'access:manage_roles',
      'access:allowlist',
      'audit:view',
      'settings:institute',
    ],
    defaultScope: 'INSTITUTE',
  },
  {
    id: 'tpl_principal',
    name: 'Principal / Head of Institute',
    slug: 'principal',
    description: 'Executive oversight over academic quality, admissions, analytics, and staff',
    baseRole: 'ADMIN',
    isSystem: true,
    permissions: [
      'timetable:view',
      'question:approve',
      'paper:publish',
      'exam:schedule',
      'exam:publish',
      'evaluation:analytics',
      'ATTENDANCE_ADMIN',
      'student:enroll',
      'student:transfer',
      'student:view_pii',
      'staff:view_all',
      'teacher:assign_batches',
      'report:generate',
      'report:export',
      'analytics:view_institute',
      'audit:view',
      'settings:institute',
    ],
    defaultScope: 'INSTITUTE',
  },
  {
    id: 'tpl_academic_coordinator',
    name: 'Academic Coordinator',
    slug: 'academic_coordinator',
    description: 'Coordinates batch schedules, curriculum progress, exam delivery, and attendance',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: [
      'batch:assign',
      'timetable:manage',
      'timetable:view',
      'curriculum:manage',
      'paper:create',
      'exam:schedule',
      'assignment:manage',
      'ATTENDANCE_TAKE',
      'ATTENDANCE_CORRECT',
      'ATTENDANCE_OVERRIDE',
      'student:transfer',
      'teacher:assign_batches',
      'report:generate',
      'analytics:view_institute',
    ],
    defaultScope: 'INSTITUTE',
  },
  {
    id: 'tpl_hod',
    name: 'Head of Department (HOD)',
    slug: 'hod',
    description: 'Subject leadership: question bank review, curriculum authoring, and faculty allocations',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: [
      'curriculum:manage',
      'question:author',
      'question:approve',
      'paper:create',
      'paper:publish',
      'evaluation:grade',
      'REVIEW_EVALUATION',
      'evaluation:analytics',
      'teacher:assign_batches',
      'report:generate',
    ],
    defaultScope: 'SUBJECT',
  },
  {
    id: 'tpl_senior_evaluator',
    name: 'Senior Teacher / Reviewer',
    slug: 'senior_evaluator',
    description: 'Authorized to review AI evaluations and override disputed examination marks',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: [
      'question:author',
      'question:approve',
      'paper:create',
      'assignment:manage',
      'evaluation:grade',
      'REVIEW_EVALUATION',
      'evaluation:analytics',
      'ATTENDANCE_TAKE',
      'ATTENDANCE_CORRECT',
      'report:generate',
    ],
    defaultScope: 'BATCH',
  },
  {
    id: 'tpl_class_teacher',
    name: 'Class / Subject Teacher',
    slug: 'class_teacher',
    description: 'Standard classroom teacher: attendance, authoring, homework, and grading',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: [
      'timetable:view',
      'question:author',
      'paper:create',
      'assignment:manage',
      'evaluation:grade',
      'ATTENDANCE_TAKE',
      'ATTENDANCE_CORRECT',
      'report:generate',
    ],
    defaultScope: 'BATCH',
  },
  {
    id: 'tpl_exam_controller',
    name: 'Examination Controller',
    slug: 'exam_controller',
    description: 'Oversees exam blueprints, scheduling, result publication, and emergency unlocks',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: [
      'paper:create',
      'paper:publish',
      'exam:schedule',
      'exam:publish',
      'exam:unlock',
      'evaluation:analytics',
      'report:generate',
      'report:export',
    ],
    defaultScope: 'INSTITUTE',
  },
  {
    id: 'tpl_attendance_officer',
    name: 'Attendance Officer',
    slug: 'attendance_officer',
    description: 'Dedicated attendance authority with historical modification and timing window overrides',
    baseRole: 'TEACHER',
    isSystem: true,
    permissions: [
      'ATTENDANCE_TAKE',
      'ATTENDANCE_CORRECT',
      'ATTENDANCE_CORRECT_HISTORICAL',
      'ATTENDANCE_OVERRIDE',
      'ATTENDANCE_ADMIN',
      'report:generate',
    ],
    defaultScope: 'INSTITUTE',
  },
  {
    id: 'tpl_auditor',
    name: 'Read-only Auditor',
    slug: 'auditor',
    description: 'Compliance auditor with read-only inspection access across logs and records',
    baseRole: 'ADMIN',
    isSystem: true,
    permissions: [
      'timetable:view',
      'evaluation:analytics',
      'staff:view_all',
      'analytics:view_institute',
      'audit:view',
    ],
    defaultScope: 'INSTITUTE',
  },
];
