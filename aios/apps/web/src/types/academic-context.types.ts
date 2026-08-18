// ─── AIOS Academic Context Types ─────────────────────────────────────────────
// This is the single most important type in the entire system.
// Every query, mutation, component, and permission check derives from this object.
// NEVER pass individual IDs around — always use AcademicContext.

import type { UserRole } from './db.types';
import type { Permission } from './permissions.types';

// ── Entity Lifecycle ─────────────────────────────────────────────────────────
// Every entity in AIOS follows this standard lifecycle.
// No ad-hoc statuses anywhere in the codebase.
export type EntityLifecycleStatus =
  | 'draft'             // Being edited, not visible to others
  | 'pending_approval'  // Submitted for Academic Head / Admin review
  | 'published'         // Visible to the target audience
  | 'active'            // Currently in progress (e.g., test is running)
  | 'expired'           // Past due date / end time
  | 'archived'          // Soft deleted — restorable
  | 'deleted';          // Permanently removed (FOUNDER only)

// ── Entity Ownership ─────────────────────────────────────────────────────────
// Every entity must carry this metadata for audit and permission purposes.
export interface EntityOwnership {
  createdBy:   string;           // userId of creator
  updatedBy:   string | null;    // userId of last editor
  ownerId:     string;           // userId of owner (usually same as createdBy)
  assignedTo:  string[];         // userIds of assigned parties
  visibility:  EntityVisibility;
  deletedAt:   string | null;    // ISO string if soft-deleted
  deletedBy:   string | null;    // userId who soft-deleted
  version:     number;           // For conflict resolution (optimistic locking)
}

export type EntityVisibility =
  | 'private'    // Only owner can see
  | 'batch'      // All students in the batch can see
  | 'institute'  // All institute members
  | 'public';    // No restriction

// ── Audit Entry ───────────────────────────────────────────────────────────────
// Immutable audit log entry. Every state change creates one of these.
export interface AuditEntry {
  id:          string;
  entityId:    string;
  entityType:  AuditableEntityType;
  field:       string;
  oldValue:    unknown;
  newValue:    unknown;
  changedBy:   string;   // userId
  changedAt:   string;   // ISO string
  reason:      string | null;
  ipAddress:   string | null;
}

export type AuditableEntityType =
  | 'assignment' | 'test' | 'paper' | 'student' | 'teacher'
  | 'batch' | 'doubt' | 'evaluation' | 'attendance' | 'fee';

// ── Feature Flags ──────────────────────────────────────────────────────────────
// Per-institute feature toggles. Frontend reads config — never hardcodes.
export interface FeatureFlags {
  aiAssignments:        boolean;
  aiPaperBuilder:       boolean;
  personalizedTests:    boolean;
  parentPortal:         boolean;
  offlineMode:          boolean;
  globalSearch:         boolean;
  auditTrail:           boolean;
  advancedAnalytics:    boolean;
  doubleSubmitPrevention: boolean;
  undoActions:          boolean;
  offlineQueue:         boolean;
}

// ── Institute & Exam Config ───────────────────────────────────────────────────
// Config-driven system: exam type, marking scheme, etc. read from config.
export interface ExamConfig {
  id:              string;
  label:           string;           // e.g. "JEE Main", "NEET UG"
  markingScheme:   MarkingScheme;
  subjects:        string[];
  totalMarks:      number;
  duration:        number;           // minutes
  questionTypes:   QuestionType[];
}

export interface MarkingScheme {
  correct:   number;
  incorrect: number;
  unattempted: number;
}

export type QuestionType = 'MCQ' | 'Numerical' | 'Assertion-Reason' | 'Matrix-Match' | 'Subjective';

export interface BranchConfig {
  id:           string;
  name:         string;
  address:      string;
  city:         string;
  timezone:     string;
  activeExams:  string[];     // examIds active in this branch
}

export interface InstituteConfig {
  id:           string;
  name:         string;
  type:         'COACHING' | 'SCHOOL' | 'COLLEGE';
  featureFlags: FeatureFlags;
  activeExams:  ExamConfig[];
  branches:     BranchConfig[];
  sessions:     AcademicSession[];
  logo:         string | null;
  theme:        InstituteTheme;
}

export interface AcademicSession {
  id:        string;        // e.g. "2025-26"
  label:     string;        // e.g. "Academic Year 2025-26"
  startDate: string;
  endDate:   string;
  isActive:  boolean;
}

export interface InstituteTheme {
  primaryColor:   string;
  secondaryColor: string;
  logoUrl:        string | null;
}

// ── Batch Navigation Tabs ────────────────────────────────────────────────────
export type BatchTab =
  | 'overview'
  | 'students'
  | 'tests'
  | 'assignments'
  | 'weak-topics'
  | 'extra-classes';

// ── THE UNIFIED ACADEMIC CONTEXT ──────────────────────────────────────────────
// This is the single object every component, hook, query, and mutation reads from.
// It defines WHO is acting (role, ids) and WHERE (institute→branch→session→...→batch→subject).
// RULE: Never pass individual IDs as props. Pass context or read from this object.
export interface AcademicContext {
  // ── Tenant Isolation (NEVER null for authenticated users)
  instituteId:  string;
  branchId:     string;

  // ── Academic Period
  sessionId:    string;        // e.g., "2025-26"

  // ── Exam & Curriculum
  examId:       string | null; // e.g., "jee-main", "neet-ug"
  courseId:     string | null;
  classId:      string | null; // e.g., "11", "12", "dropper"
  batchId:      string | null; // e.g., "11A", "11B"
  subjectId:    string | null; // e.g., "physics", "chemistry"

  // ── Actor (who is currently acting in this context)
  teacherId:    string | null; // populated when role = TEACHER
  studentId:    string | null; // populated when drilling into a specific student

  // ── Current Entity Focus (which entity is currently "open")
  testId:       string | null;
  assignmentId: string | null;
  doubtId:      string | null;
  paperId:      string | null;

  // ── UI State
  batchTab:     BatchTab;

  // ── User role in this context
  role:         UserRole;

  // ── Permissions for quick client-side checks (source of truth is server)
  permissions:  Permission[];
}

// ── Default context — used when no context is set (unauthenticated state)
export const DEFAULT_ACADEMIC_CONTEXT: AcademicContext = {
  instituteId:  '',
  branchId:     '',
  sessionId:    '',
  examId:       null,
  courseId:     null,
  classId:      null,
  batchId:      null,
  subjectId:    null,
  teacherId:    null,
  studentId:    null,
  testId:       null,
  assignmentId: null,
  doubtId:      null,
  paperId:      null,
  batchTab:     'overview',
  role:         'STUDENT',
  permissions:  [],
};

// ── Context Validation — use to check if a context has minimum required fields
export function hasMinimumContext(
  ctx: Partial<AcademicContext>,
  required: (keyof AcademicContext)[]
): ctx is AcademicContext {
  return required.every(field => {
    const val = ctx[field];
    return val !== null && val !== undefined && val !== '';
  });
}
