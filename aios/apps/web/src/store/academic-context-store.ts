// ─── Academic Context Store ───────────────────────────────────────────────────
// The most important store in AIOS.
// Holds the unified AcademicContext — every query, mutation, and component derives scope from this.
// Replaces the old teacherCtx in dashboard-store.ts.
//
// Usage: const ctx = useAcademicContextStore(s => s.ctx);

import { create } from 'zustand';
import { DEFAULT_ACADEMIC_CONTEXT, type AcademicContext } from '@/types/academic-context.types';
import { eventBus } from '@/lib/event-bus';

interface AcademicContextStore {
  ctx: AcademicContext;
  previousCtx: AcademicContext | null;

  /** Merge a partial patch into the current context */
  setCtx: (patch: Partial<AcademicContext>) => void;

  /** Fully replace the context (used on login / role change) */
  replaceCtx: (ctx: AcademicContext) => void;

  /** Reset to defaults (used on logout) */
  resetCtx: () => void;

  /** Switch batch — saves previous context for cache invalidation, emits event */
  switchBatch: (batchId: string, classId?: string) => void;

  /** Check if a set of context fields are non-null */
  hasContext: (fields: (keyof AcademicContext)[]) => boolean;
}

export const useAcademicContextStore = create<AcademicContextStore>((set, get) => ({
  ctx:         DEFAULT_ACADEMIC_CONTEXT,
  previousCtx: null,

  setCtx: (patch) => {
    const prev = get().ctx;
    set({ ctx: { ...prev, ...patch } });

    // Emit context changed event for listeners (URL sync, analytics, etc.)
    Object.keys(patch).forEach(field => {
      eventBus.emit('CONTEXT_CHANGED', {
        field,
        oldValue: prev[field as keyof AcademicContext],
        newValue: patch[field as keyof AcademicContext],
      });
    });
  },

  replaceCtx: (ctx) => {
    set({ ctx, previousCtx: get().ctx });
  },

  resetCtx: () => {
    set({ ctx: DEFAULT_ACADEMIC_CONTEXT, previousCtx: null });
  },

  switchBatch: (batchId, classId) => {
    const prev = get().ctx;
    set({
      previousCtx: prev,
      ctx: {
        ...prev,
        batchId,
        classId:    classId ?? prev.classId,
        // Reset entity focus when switching batch
        studentId:    null,
        testId:       null,
        assignmentId: null,
        doubtId:      null,
        paperId:      null,
        batchTab:     'overview',
      },
    });

    eventBus.emit('BATCH_SWITCHED', {
      fromBatchId: prev.batchId,
      toBatchId:   batchId,
    });
  },

  hasContext: (fields) => {
    const ctx = get().ctx;
    return fields.every(f => {
      const val = ctx[f];
      return val !== null && val !== undefined && val !== '';
    });
  },
}));
