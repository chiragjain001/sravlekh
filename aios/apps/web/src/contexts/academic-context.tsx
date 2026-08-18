'use client';

// ─── Academic Context Provider ─────────────────────────────────────────────────
// Wraps all dashboard pages.
// Initializes AcademicContext from AuthenticatedUser on login.
// Syncs context changes to URL params.
// Clears cache on batch switch.
//
// Provider hierarchy:
//   <AuthProvider>
//     <AcademicContextProvider>   ← this file
//       <TeacherDashboard />
//     </AcademicContextProvider>
//   </AuthProvider>

import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth.context';
import { useAcademicContextStore } from '@/store/academic-context-store';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '@/lib/permissions/rbac';
import { DEMO_FEATURE_FLAGS, DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags';
import type { AcademicContext } from '@/types/academic-context.types';

// ── Context ───────────────────────────────────────────────────────────────────
interface AcademicContextValue {
  ctx:          AcademicContext;
  setCtx:       (patch: Partial<AcademicContext>) => void;
  resetCtx:     () => void;
  switchBatch:  (batchId: string, classId?: string) => void;
  hasContext:   (fields: (keyof AcademicContext)[]) => boolean;
}

const AcademicCtx = createContext<AcademicContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────
export function AcademicContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const store = useAcademicContextStore();

  // Initialize context from authenticated user on mount / user change
  useEffect(() => {
    if (!user) {
      store.resetCtx();
      return;
    }

    const isDemoMode = typeof window !== 'undefined' &&
      localStorage.getItem('aios_demo_mode') === 'true';

    store.replaceCtx({
      // ── Tenant (always from user — cannot be changed by UI)
      instituteId:  user.instituteId,
      branchId:     user.branchId,
      sessionId:    user.sessionId,

      // ── Role-specific IDs
      teacherId:    user.teacherId ?? null,
      studentId:    user.studentId ?? null,

      // ── Curriculum (null until user selects)
      examId:       null,
      courseId:     null,
      classId:      null,
      batchId:      null,
      subjectId:    null,
      assignmentId: null,
      testId:       null,
      doubtId:      null,
      paperId:      null,

      // ── Navigation
      batchTab: 'overview',
      role:     user.role,

      // ── Permissions
      permissions: user.permissions?.length
        ? user.permissions
        : DEFAULT_PERMISSIONS_BY_ROLE[user.role] ?? [],
    });
  }, [user?.id, user?.branchId, user?.sessionId]);

  // ── Cache invalidation on batch switch ──────────────────────────────────────
  // Subscribe to BATCH_SWITCHED event and remove stale cache entries
  useEffect(() => {
    const { eventBus } = require('@/lib/event-bus');
    const unsub = eventBus.on('BATCH_SWITCHED', ({
      fromBatchId,
    }: { fromBatchId: string | null; toBatchId: string }) => {
      if (!fromBatchId || !user) return;
      // Remove cache entries that were scoped to the OLD batch
      // This prevents stale 11A data from flashing when switching to 11B
      queryClient.removeQueries({
        predicate: (query) => {
          const key = query.queryKey as string[];
          return (
            key.includes('batch') &&
            key.includes(fromBatchId) &&
            !key.includes(store.ctx.batchId ?? '')
          );
        },
      });
    });
    return unsub;
  }, [user?.id, queryClient]);

  const value: AcademicContextValue = {
    ctx:         store.ctx,
    setCtx:      store.setCtx,
    resetCtx:    store.resetCtx,
    switchBatch: store.switchBatch,
    hasContext:  store.hasContext,
  };

  return <AcademicCtx.Provider value={value}>{children}</AcademicCtx.Provider>;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useAcademicContext(): AcademicContextValue {
  const ctx = useContext(AcademicCtx);
  if (!ctx) throw new Error('useAcademicContext must be used within AcademicContextProvider');
  return ctx;
}

/** Convenience hook — returns context object directly */
export function useCtx(): AcademicContext {
  return useAcademicContext().ctx;
}

/** Convenience hook — returns setCtx */
export function useSetCtx() {
  return useAcademicContext().setCtx;
}

/** Convenience hook — returns switchBatch (handles cache invalidation + event emit) */
export function useSwitchBatch() {
  return useAcademicContext().switchBatch;
}
