// ─── AIOS Permission Types ────────────────────────────────────────────────────
// All permission strings are defined here as a union type.
// Source of truth for client-side RBAC checks.
// The server ALWAYS re-validates — frontend is UX defense, not security defense.

export type Permission =
  // ── Assignments
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
  | 'question:create'
  | 'question:read'
  | 'question:update'
  | 'question:delete'

  // ── Students
  | 'student:view-all'        // Admin, Academic Head, Coordinator
  | 'student:view-batch'      // Teacher (own batches only)
  | 'student:view-own'        // Student (own profile only)
  | 'student:view-personal'   // Teacher/Admin (personalized data)
  | 'student:enroll'
  | 'student:transfer-batch'
  | 'student:archive'

  // ── Teachers
  | 'teacher:view-all'
  | 'teacher:create'
  | 'teacher:update'
  | 'teacher:archive'
  | 'teacher:assign-batch'

  // ── Batches
  | 'batch:create'
  | 'batch:update'
  | 'batch:archive'
  | 'batch:view-all'
  | 'batch:view-own'

  // ── Doubts
  | 'doubt:submit'
  | 'doubt:resolve'
  | 'doubt:assign'
  | 'doubt:view-batch'
  | 'doubt:view-own'
  | 'doubt:view-all'

  // ── Analytics
  | 'analytics:institute'
  | 'analytics:branch'
  | 'analytics:batch'
  | 'analytics:own'
  | 'analytics:personalized'  // View per-student personalized analytics

  // ── Attendance
  | 'attendance:mark'
  | 'attendance:view-batch'
  | 'attendance:view-own'
  | 'attendance:edit'

  // ── Timetable
  | 'timetable:view'
  | 'timetable:manage'

  // ── Reports
  | 'report:generate'
  | 'report:view-batch'
  | 'report:view-own'
  | 'report:view-all'
  | 'report:download'

  // ── Admin Operations
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
