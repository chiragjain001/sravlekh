'use client';

// ─── useWizardDraft ────────────────────────────────────────────────────────────
// Persistent form state for multi-step wizards.
// Survives modal close, page refresh, and session expiry.
// Draft key is scoped by userId + instituteId + branchId + sessionId + wizardType
// to prevent cross-user / cross-tenant draft leakage.
//
// Usage:
//   const { state, updateState, clearDraft, hasDraft, draftAgeMinutes } =
//     useWizardDraft('assignment', defaultValues);

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/auth.context';
import { useCtx } from '@/contexts/academic-context';
import { eventBus } from '@/lib/event-bus';

const DRAFT_PREFIX = 'aios_draft_v2_';
const AUTO_SAVE_INTERVAL_MS = 20_000; // 20 seconds

interface DraftEnvelope<T> {
  data:    T;
  savedAt: number;
  userId:  string;
  meta: {
    instituteId: string;
    branchId:    string;
    sessionId:   string;
    wizardType:  string;
  };
}

export function useWizardDraft<T extends object>(
  wizardType: string,
  defaultValue: T
) {
  const { user } = useAuth();
  const ctx = useCtx();

  // Build a globally unique draft key
  const draftKey = user
    ? `${DRAFT_PREFIX}${user.id}_${ctx.instituteId}_${ctx.branchId}_${ctx.sessionId}_${wizardType}`
    : null;

  // Load saved draft or use default
  const loadSaved = useCallback((): T => {
    if (!draftKey) return defaultValue;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return defaultValue;
      const envelope: DraftEnvelope<T> = JSON.parse(raw);
      // Safety check: verify this draft belongs to this user+context
      if (
        envelope.userId !== user?.id ||
        envelope.meta.instituteId !== ctx.instituteId ||
        envelope.meta.branchId !== ctx.branchId ||
        envelope.meta.sessionId !== ctx.sessionId
      ) {
        localStorage.removeItem(draftKey);
        return defaultValue;
      }
      return envelope.data;
    } catch {
      return defaultValue;
    }
  }, [draftKey]);

  const [state, setState] = useState<T>(loadSaved);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Save to localStorage
  const persist = useCallback((data: T) => {
    if (!draftKey || !user) return;
    try {
      const envelope: DraftEnvelope<T> = {
        data,
        savedAt: Date.now(),
        userId: user.id,
        meta: {
          instituteId: ctx.instituteId,
          branchId:    ctx.branchId,
          sessionId:   ctx.sessionId,
          wizardType,
        },
      };
      localStorage.setItem(draftKey, JSON.stringify(envelope));
      eventBus.emit('DRAFT_SAVED', { draftKey, wizardType });
    } catch { /* storage full — silently ignore */ }
  }, [draftKey, user?.id, wizardType]);

  // Auto-save every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      persist(stateRef.current);
    }, AUTO_SAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [persist]);

  // Update state + immediately persist
  const updateState = useCallback((patch: Partial<T>) => {
    setState(prev => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, [persist]);

  // Clear draft and reset to defaults
  const clearDraft = useCallback(() => {
    if (draftKey) {
      localStorage.removeItem(draftKey);
      eventBus.emit('DRAFT_CLEARED', { draftKey, wizardType });
    }
    setState(defaultValue);
  }, [draftKey, defaultValue, wizardType]);

  // Check if a draft exists
  const hasDraft = draftKey ? localStorage.getItem(draftKey) !== null : false;

  // Age of the draft in minutes
  const draftAgeMinutes: number | null = (() => {
    if (!draftKey) return null;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return null;
      const { savedAt } = JSON.parse(raw) as DraftEnvelope<T>;
      return Math.round((Date.now() - savedAt) / 60000);
    } catch { return null; }
  })();

  return { state, updateState, clearDraft, hasDraft, draftAgeMinutes };
}
