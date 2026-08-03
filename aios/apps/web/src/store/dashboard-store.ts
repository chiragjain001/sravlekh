import { create } from 'zustand';

// ─── Teacher hierarchical navigation context ────────────────────────────────
export type TeacherTopNav =
  | 'today'            // Overview
  | 'classes'          // My Classes
  | 'paper-builder'    // Paper Builder
  | 'question-bank'    // Question Bank
  | 'tests-exams'      // Tests & Exams
  | 'evaluation-queue' // Evaluation Queue
  | 'analytics'        // Analytics
  | 'assignments'      // Assignments
  | 'remedial-extra'   // Remedial & Extra Class
  | 'doubt-center'     // Doubt Center
  | 'timetable'        // Time Table
  | 'reports'          // Reports
  | 'settings';        // Settings

export type BatchTab =
  | 'overview'
  | 'students'
  | 'tests'
  | 'assignments'
  | 'weak-topics'
  | 'extra-classes';

export interface TeacherContext {
  classId:   string | null;   // e.g. "11", "12", "dropper"
  subjectId: string | null;   // e.g. "physics"
  batchId:   string | null;   // e.g. "11A", "11B"
  batchTab:  BatchTab;
  studentId: string | null;   // e.g. "STU-001"
  testId:    string | null;   // e.g. "T1"
}

interface DashboardStore {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;

  // ── Student ──────────────────────────────────────────────────────────────
  studentActiveNav: string;
  setStudentActiveNav: (nav: string) => void;

  // ── Teacher — hierarchical ────────────────────────────────────────────────
  teacherNav: TeacherTopNav;
  teacherCtx: TeacherContext;
  setTeacherNav:   (nav: TeacherTopNav) => void;
  setTeacherCtx:   (ctx: Partial<TeacherContext>) => void;
  resetTeacherCtx: () => void;

  // ── Admin / Founder ────────────────────────────────────────────────────────
  adminActiveNav:   string;
  founderActiveNav: string;
  setAdminActiveNav:   (nav: string) => void;
  setFounderActiveNav: (nav: string) => void;

  // Legacy alias — keeps student/admin pages working unchanged
  teacherActiveNav: string;
  setTeacherActiveNav: (nav: string) => void;
}

const DEFAULT_TEACHER_CTX: TeacherContext = {
  classId:   null,
  subjectId: null,
  batchId:   null,
  batchTab:  'overview',
  studentId: null,
  testId:    null,
};

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),

  studentActiveNav: 'Overview',
  setStudentActiveNav: (nav) => set({ studentActiveNav: nav }),

  teacherNav: 'today',
  teacherCtx: DEFAULT_TEACHER_CTX,
  setTeacherNav: (nav) => set({ teacherNav: nav, teacherCtx: DEFAULT_TEACHER_CTX }),
  setTeacherCtx: (ctx) => set((s) => ({ teacherCtx: { ...s.teacherCtx, ...ctx } })),
  resetTeacherCtx: () => set({ teacherCtx: DEFAULT_TEACHER_CTX }),

  adminActiveNav:   'Dashboard',
  founderActiveNav: 'Overview',
  setAdminActiveNav:   (nav) => set({ adminActiveNav: nav }),
  setFounderActiveNav: (nav) => set({ founderActiveNav: nav }),

  // Legacy alias — teacherActiveNav maps to teacherNav label
  get teacherActiveNav() { return get().teacherNav; },
  setTeacherActiveNav: (nav) => set({ teacherNav: nav as TeacherTopNav }),
}));

