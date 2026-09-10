// ─── Teacher UI Store ──────────────────────────────────────────────────────────
// Teacher-specific navigation and modal state.
// Pure UI state — no business data here.

import { create } from 'zustand';

export type TeacherTopNav =
  | 'today'
  | 'classes'
  | 'question-bank'
  | 'paper-builder'
  | 'tests-exams'
  | 'digital-copy'
  | 'evaluation-queue'
  | 'analytics'
  | 'assignments'
  | 'remedial-extra'
  | 'doubt-center'
  | 'timetable'
  | 'reports'
  | 'settings';

interface TeacherOpenModals {
  createAssignment: boolean;
  createTest:       boolean;
  studentProfile:   string | null;  // studentId or null
  assignmentDetail: string | null;  // assignmentId or null
  testDetail:       string | null;  // testId or null
  doubtDetail:      string | null;  // doubtId or null
}

interface TeacherUIStore {
  teacherNav:   TeacherTopNav;
  openModals:   TeacherOpenModals;

  setTeacherNav: (nav: TeacherTopNav) => void;

  openModal:  (modal: keyof TeacherOpenModals, value?: string) => void;
  closeModal: (modal: keyof TeacherOpenModals) => void;
  closeAllModals: () => void;
}

const DEFAULT_MODALS: TeacherOpenModals = {
  createAssignment: false,
  createTest:       false,
  studentProfile:   null,
  assignmentDetail: null,
  testDetail:       null,
  doubtDetail:      null,
};

export const useTeacherStore = create<TeacherUIStore>((set) => ({
  teacherNav: 'today',
  openModals: DEFAULT_MODALS,

  setTeacherNav: (nav) => set({ teacherNav: nav }),

  openModal: (modal, value) =>
    set((s) => ({
      openModals: {
        ...s.openModals,
        [modal]: value !== undefined ? value : true,
      },
    })),

  closeModal: (modal) =>
    set((s) => ({
      openModals: {
        ...s.openModals,
        [modal]: typeof s.openModals[modal] === 'boolean' ? false : null,
      },
    })),

  closeAllModals: () => set({ openModals: DEFAULT_MODALS }),
}));
