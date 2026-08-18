// ─── dashboard-store.ts ───────────────────────────────────────────────────────
// MIGRATED: This file now re-exports from the new role-specific stores.
// All new code should import directly from the source stores.
// This file exists ONLY for backward compatibility during gradual migration.
//
// Migration guide:
//   OLD: useDashboardStore(s => s.teacherNav)
//   NEW: useTeacherStore(s => s.teacherNav)
//
//   OLD: useDashboardStore(s => s.teacherCtx)
//   NEW: useAcademicContextStore(s => s.ctx)
//
//   OLD: useDashboardStore(s => s.sidebarCollapsed)
//   NEW: useUIStore(s => s.sidebarCollapsed)

// ── Re-exports for backward compatibility ─────────────────────────────────────
export { useTeacherStore } from './teacher-store';
export type { TeacherTopNav } from './teacher-store';
export { useAcademicContextStore } from './academic-context-store';
export { useUIStore, useNotificationStore, useDraftStore, useFilterStore } from './ui-stores';
export { useStudentStore, useAdminStore, useFounderStore } from './role-stores';

// ── Legacy types (kept for any code still importing from here)
export type BatchTab =
  | 'overview'
  | 'students'
  | 'tests'
  | 'assignments'
  | 'weak-topics'
  | 'extra-classes';

export interface TeacherContext {
  classId:   string | null;
  subjectId: string | null;
  batchId:   string | null;
  batchTab:  BatchTab;
  studentId: string | null;
  testId:    string | null;
}

// ── Legacy useDashboardStore hook ─────────────────────────────────────────────
// Provides the OLD interface by composing from new stores.
// Remove usages one component at a time and delete this when done.
import { useTeacherStore } from './teacher-store';
import { useAcademicContextStore } from './academic-context-store';
import { useUIStore } from './ui-stores';
import { useStudentStore, useAdminStore, useFounderStore } from './role-stores';
import type { TeacherTopNav } from './teacher-store';

export function useDashboardStore() {
  const teacherNav    = useTeacherStore(s => s.teacherNav);
  const setTeacherNav = useTeacherStore(s => s.setTeacherNav);
  const ctx           = useAcademicContextStore(s => s.ctx);
  const setCtx        = useAcademicContextStore(s => s.setCtx);
  const resetCtx      = useAcademicContextStore(s => s.resetCtx);
  const sidebar       = useUIStore(s => s.sidebarCollapsed);
  const toggleSidebar = useUIStore(s => s.toggleSidebar);
  const setSidebarCollapsed = useUIStore(s => s.setSidebarCollapsed);
  const studentNav    = useStudentStore(s => s.studentNav);
  const setStudentNav = useStudentStore(s => s.setStudentNav);
  const adminNav      = useAdminStore(s => s.adminNav);
  const setAdminNav   = useAdminStore(s => s.setAdminNav);
  const founderNav    = useFounderStore(s => s.founderNav);
  const setFounderNav = useFounderStore(s => s.setFounderNav);

  return {
    // ── Sidebar
    sidebarCollapsed: sidebar,
    toggleSidebar,
    setSidebarCollapsed,

    // ── Teacher (maps new store to old interface)
    teacherNav,
    setTeacherNav: (nav: TeacherTopNav) => setTeacherNav(nav),
    teacherActiveNav: teacherNav,
    setTeacherActiveNav: (nav: string) => setTeacherNav(nav as TeacherTopNav),

    // teacherCtx maps to new AcademicContext (partial compatibility)
    teacherCtx: {
      classId:   ctx.classId,
      subjectId: ctx.subjectId,
      batchId:   ctx.batchId,
      batchTab:  ctx.batchTab,
      studentId: ctx.studentId,
      testId:    ctx.testId,
    } as TeacherContext,
    setTeacherCtx: (patch: Partial<TeacherContext>) => setCtx(patch),
    resetTeacherCtx: () => resetCtx(),

    // ── Student
    studentActiveNav: studentNav,
    setStudentActiveNav: (nav: string) => setStudentNav(nav as any),

    // ── Admin / Founder
    adminActiveNav:   adminNav,
    founderActiveNav: founderNav,
    setAdminActiveNav:   (nav: string) => setAdminNav(nav as any),
    setFounderActiveNav: (nav: string) => setFounderNav(nav as any),
  };
}
