// ─── Grading Store ─────────────────────────────────────────────────────────────
// Holds teacher-entered marks across the session.
// Scoped as: marks[`${testId}-${studentId}`] = marksObtained
// Also tracks which studentId+testId pairs have been "saved" (graded) so the
// EvaluationQueue progress bars stay in sync without a full page reload.
//
// Phase 2: This will be replaced by an optimistic mutation to the API.

import { create } from 'zustand';

interface GradingStore {
  /** Raw marks entered by teacher: key = `${testId}-${studentId}` */
  marks: Record<string, string>;

  /** Set of `${testId}-${studentId}` keys that have been saved/confirmed */
  savedKeys: Set<string>;

  setMark:   (testId: string, studentId: string, value: string) => void;
  saveMark:  (testId: string, studentId: string) => void;
  getMark:   (testId: string, studentId: string) => string;
  isSaved:   (testId: string, studentId: string) => boolean;

  /** How many students have been graded for a given test (session-local) */
  getLocalGradedCount: (testId: string, studentIds: string[]) => number;
}

const key = (testId: string, studentId: string) => `${testId}-${studentId}`;

export const useGradingStore = create<GradingStore>((set, get) => ({
  marks:     {},
  savedKeys: new Set(),

  setMark: (testId, studentId, value) =>
    set(s => ({ marks: { ...s.marks, [key(testId, studentId)]: value } })),

  saveMark: (testId, studentId) =>
    set(s => {
      const next = new Set(s.savedKeys);
      next.add(key(testId, studentId));
      return { savedKeys: next };
    }),

  getMark: (testId, studentId) =>
    get().marks[key(testId, studentId)] ?? '',

  isSaved: (testId, studentId) =>
    get().savedKeys.has(key(testId, studentId)),

  getLocalGradedCount: (testId, studentIds) =>
    studentIds.filter(sid => get().savedKeys.has(key(testId, sid))).length,
}));
