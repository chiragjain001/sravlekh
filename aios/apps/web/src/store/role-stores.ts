// ─── Student UI Store ─────────────────────────────────────────────────────────
import { create } from 'zustand';

export type StudentNav =
  | 'Overview'
  | 'My Tests'
  | 'Assignments'
  | 'Study Plan'
  | 'Weak Topics'
  | 'Doubt Center'
  | 'Time Table'
  | 'Extra Classes'
  | 'Progress'
  | 'Leaderboard'
  | 'Resources'
  | 'Settings';


interface StudentUIStore {
  studentNav: StudentNav;
  setStudentNav: (nav: StudentNav) => void;
}

export const useStudentStore = create<StudentUIStore>((set) => ({
  studentNav: 'Overview',
  setStudentNav: (nav) => set({ studentNav: nav }),
}));

// ─── Admin UI Store ───────────────────────────────────────────────────────────
export type AdminNav =
  | 'Dashboard'
  | 'Students'
  | 'Teachers'
  | 'Batches'
  | 'Assignments'
  | 'Tests'
  | 'Analytics'
  | 'Doubts'
  | 'Timetable'
  | 'Fee Management'
  | 'Reports'
  | 'Settings'
  | 'Academics'
  | 'Exams'
  | 'Attendance'
  | 'Communication'
  | 'System Settings'
  | 'Audit Logs';

interface AdminUIStore {
  adminNav: AdminNav;
  setAdminNav: (nav: AdminNav) => void;
}

export const useAdminStore = create<AdminUIStore>((set) => ({
  adminNav: 'Dashboard',
  setAdminNav: (nav) => set({ adminNav: nav }),
}));

// ─── Founder UI Store ─────────────────────────────────────────────────────────
export type FounderNav =
  | 'Overview'
  | 'Institutes'
  | 'Users'
  | 'Analytics'
  | 'Subscriptions'
  | 'System Health'
  | 'Audit Logs'
  | 'Support Tickets'
  | 'Settings'
  | 'Feature Management'
  | 'Integrations';

interface FounderUIStore {
  founderNav: FounderNav;
  setFounderNav: (nav: FounderNav) => void;
}

export const useFounderStore = create<FounderUIStore>((set) => ({
  founderNav: 'Overview',
  setFounderNav: (nav) => set({ founderNav: nav }),
}));
