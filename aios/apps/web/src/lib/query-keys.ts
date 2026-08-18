// ─── Query Key Factory ────────────────────────────────────────────────────────
// RULE: NEVER write raw array query keys in components or hooks.
//       ALWAYS use this factory so keys are consistent and include full context.
//
// Key structure (institute → branch → session → ... → entity → params):
// ['institute', iId, 'branch', bId, 'session', sId, 'batch', batchId, 'entity', params]
//
// This prevents stale data when teacher switches batch/class/session.

import type { AcademicContext } from '@/types/academic-context.types';

type Params = Record<string, unknown> | undefined;

// Build the base context chain for any query key
function base(ctx: Pick<AcademicContext, 'instituteId' | 'branchId' | 'sessionId'>) {
  return ['institute', ctx.instituteId, 'branch', ctx.branchId, 'session', ctx.sessionId] as const;
}

// Extend base with batch context
function withBatch(ctx: Pick<AcademicContext, 'instituteId' | 'branchId' | 'sessionId' | 'batchId'>) {
  return [...base(ctx), 'batch', ctx.batchId] as const;
}

// Extend base with teacher context
function withTeacher(ctx: Pick<AcademicContext, 'instituteId' | 'branchId' | 'sessionId' | 'teacherId'>) {
  return [...base(ctx), 'teacher', ctx.teacherId] as const;
}

// Extend base with student context
function withStudent(ctx: Pick<AcademicContext, 'instituteId' | 'branchId' | 'sessionId' | 'batchId' | 'studentId'>) {
  return [...withBatch(ctx), 'student', ctx.studentId] as const;
}

// ── The Query Keys Factory ────────────────────────────────────────────────────
export const queryKeys = {

  // ── Assignments (scoped to batch + teacher)
  assignments: (ctx: AcademicContext, params?: Params) =>
    [...withBatch(ctx), 'teacher', ctx.teacherId, 'assignments', params] as const,

  assignment: (ctx: AcademicContext, assignmentId: string) =>
    [...withBatch(ctx), 'assignments', assignmentId] as const,

  // Student's own assignments (scoped to student)
  myAssignments: (ctx: AcademicContext, params?: Params) =>
    [...withStudent(ctx), 'assignments', params] as const,

  // Personalized assignment for a specific student
  personalizedAssignment: (ctx: AcademicContext, assignmentId: string, studentId: string) =>
    [...withBatch(ctx), 'assignments', assignmentId, 'personalized', studentId] as const,

  assignmentSubmissions: (ctx: AcademicContext, assignmentId: string) =>
    [...withBatch(ctx), 'assignments', assignmentId, 'submissions'] as const,

  // ── Tests & Exams
  tests: (ctx: AcademicContext, params?: Params) =>
    [...withBatch(ctx), 'teacher', ctx.teacherId, 'tests', params] as const,

  test: (ctx: AcademicContext, testId: string) =>
    [...withBatch(ctx), 'tests', testId] as const,

  // Student's own tests
  myTests: (ctx: AcademicContext, params?: Params) =>
    [...withStudent(ctx), 'tests', params] as const,

  // Personalized test for a specific student
  personalizedTest: (ctx: AcademicContext, testId: string, studentId: string) =>
    [...withBatch(ctx), 'tests', testId, 'personalized', studentId] as const,

  testEvaluations: (ctx: AcademicContext, testId: string) =>
    [...withBatch(ctx), 'tests', testId, 'evaluations'] as const,

  testAnalysis: (ctx: AcademicContext, testId: string) =>
    [...withBatch(ctx), 'tests', testId, 'analysis'] as const,

  // ── Students
  students: (ctx: AcademicContext, params?: Params) =>
    [...withBatch(ctx), 'students', params] as const,

  student: (ctx: AcademicContext, studentId: string) =>
    [...withBatch(ctx), 'students', studentId] as const,

  studentProfile: (ctx: AcademicContext, studentId: string) =>
    [...withBatch(ctx), 'students', studentId, 'profile'] as const,

  studentIntelligence: (ctx: AcademicContext, studentId: string) =>
    [...withBatch(ctx), 'students', studentId, 'intelligence'] as const,

  studentTestHistory: (ctx: AcademicContext, studentId: string) =>
    [...withBatch(ctx), 'students', studentId, 'test-history'] as const,

  // All students across institute (Admin view)
  allStudents: (ctx: AcademicContext, params?: Params) =>
    [...base(ctx), 'all-students', params] as const,

  // ── Batches
  batches: (ctx: AcademicContext, params?: Params) =>
    [...base(ctx), 'batches', params] as const,

  batch: (ctx: AcademicContext, batchId: string) =>
    [...base(ctx), 'batches', batchId] as const,

  batchOverview: (ctx: AcademicContext) =>
    [...withBatch(ctx), 'overview'] as const,

  batchWeakTopics: (ctx: AcademicContext) =>
    [...withBatch(ctx), 'weak-topics'] as const,

  batchStats: (ctx: AcademicContext) =>
    [...withBatch(ctx), 'stats'] as const,

  batchAIBriefing: (ctx: AcademicContext) =>
    [...withBatch(ctx), 'ai-briefing'] as const,

  // ── Teachers
  teachers: (ctx: AcademicContext, params?: Params) =>
    [...base(ctx), 'teachers', params] as const,

  teacher: (ctx: AcademicContext, teacherId: string) =>
    [...base(ctx), 'teachers', teacherId] as const,

  // Teacher's own batches
  myBatches: (ctx: AcademicContext) =>
    [...withTeacher(ctx), 'batches'] as const,

  // ── Doubts
  doubts: (ctx: AcademicContext, params?: Params) =>
    [...withBatch(ctx), 'teacher', ctx.teacherId, 'doubts', params] as const,

  doubt: (ctx: AcademicContext, doubtId: string) =>
    [...withBatch(ctx), 'doubts', doubtId] as const,

  // Student's own doubts
  myDoubts: (ctx: AcademicContext, params?: Params) =>
    [...withStudent(ctx), 'doubts', params] as const,

  // ── Papers & Question Bank
  papers: (ctx: AcademicContext, params?: Params) =>
    [...withTeacher(ctx), 'papers', params] as const,

  paper: (ctx: AcademicContext, paperId: string) =>
    [...withTeacher(ctx), 'papers', paperId] as const,

  blueprints: (ctx: AcademicContext) =>
    [...withTeacher(ctx), 'blueprints'] as const,

  questions: (ctx: AcademicContext, params?: Params) =>
    [...base(ctx), 'questions', params] as const,

  // ── Analytics
  analyticsOverview: (ctx: AcademicContext) =>
    [...base(ctx), 'analytics', 'overview'] as const,

  analyticsInstitute: (ctx: AcademicContext) =>
    [...base(ctx), 'analytics', 'institute'] as const,

  analyticsBatch: (ctx: AcademicContext) =>
    [...withBatch(ctx), 'analytics'] as const,

  analyticsStudent: (ctx: AcademicContext, studentId: string) =>
    [...withBatch(ctx), 'students', studentId, 'analytics'] as const,

  batchHeatmap: (ctx: AcademicContext) =>
    [...withBatch(ctx), 'heatmap'] as const,

  // ── Extra Classes
  extraClasses: (ctx: AcademicContext, params?: Params) =>
    [...withBatch(ctx), 'extra-classes', params] as const,

  // ── Timetable
  timetable: (ctx: AcademicContext, params?: Params) =>
    [...withTeacher(ctx), 'timetable', params] as const,

  todaySchedule: (ctx: AcademicContext) =>
    [...withTeacher(ctx), 'today-schedule'] as const,

  // ── Notifications
  notifications: (ctx: AcademicContext, params?: Params) =>
    [...base(ctx), 'user', ctx.role, 'notifications', params] as const,

  notificationCount: (ctx: AcademicContext) =>
    [...base(ctx), 'user', ctx.role, 'notification-count'] as const,

  // ── Reports
  reports: (ctx: AcademicContext, params?: Params) =>
    [...base(ctx), 'reports', params] as const,

  // ── Audit trail
  auditTrail: (ctx: AcademicContext, entityType: string, entityId: string) =>
    [...base(ctx), 'audit', entityType, entityId] as const,

  // ── Search
  globalSearch: (ctx: AcademicContext, query: string) =>
    [...base(ctx), 'search', query] as const,

} as const;
