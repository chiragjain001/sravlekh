'use client';

// ─── useUndo ──────────────────────────────────────────────────────────────────
// 10-second undo system for destructive actions.
// Shows a countdown toast. Clicking Undo calls the inverse mutation.
// After 10 seconds, commits the action permanently.
//
// Usage:
//   const { triggerUndo } = useUndo();
//   triggerUndo({ label: 'Assignment deleted', onUndo: () => restoreAssignment(id) });

import { useCallback, useRef } from 'react';
import toast from 'react-hot-toast';

interface UndoConfig {
  label:    string;
  onUndo:   () => void | Promise<void>;
  duration?: number;  // ms, default 10000
}

export function useUndo() {
  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoCalledRef = useRef(false);

  const triggerUndo = useCallback(({ label, onUndo, duration = 10000 }: UndoConfig) => {
    undoCalledRef.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);

    // Show a toast with a plain Undo button (no JSX — pure DOM via string toast)
    const toastId = toast(
      `${label} — `,
      {
        duration,
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        },
      }
    );

    // For the Undo button we use a custom toast with createElement
    // This is done imperatively to avoid JSX in a .ts file
    toast.dismiss(toastId);

    const undoToastId = `undo-${Date.now()}`;
    const undoHandler = () => {
      undoCalledRef.current = true;
      toast.dismiss(undoToastId);
      if (timerRef.current) clearTimeout(timerRef.current);
      try {
        const res = onUndo();
        if (res instanceof Promise) res.catch(() => toast.error('Undo failed'));
      } catch {
        toast.error('Undo failed');
      }
    };

    // Re-show as a custom toast using the toast() function with a render prop
    // which accepts a function (not JSX) and returns an element
    // Since we can't use JSX here, we use the string form + a separate click handler approach
    toast(
      (t) => {
        // Build DOM imperatively
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;align-items:center;gap:12px;';

        const span = document.createElement('span');
        span.textContent = label;
        span.style.cssText = 'font-size:13px;';

        const btn = document.createElement('button');
        btn.textContent = 'Undo';
        btn.style.cssText = 'padding:4px 12px;background:#4f46e5;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;';
        btn.onclick = undoHandler;

        wrapper.appendChild(span);
        wrapper.appendChild(btn);
        return wrapper as unknown as React.ReactElement;
      },
      {
        id: undoToastId,
        duration,
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          borderRadius: '12px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        },
      }
    );

    timerRef.current = setTimeout(() => {
      if (!undoCalledRef.current) toast.dismiss(undoToastId);
    }, duration);
  }, []);

  return { triggerUndo };
}

// ─── useFeatureFlag ───────────────────────────────────────────────────────────
import { useAuth } from '@/contexts/auth.context';
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags';
import type { FeatureFlags } from '@/types/academic-context.types';

export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return user.featureFlags?.[flag] ?? DEFAULT_FEATURE_FLAGS[flag] ?? false;
}

export function useFeatureFlags(): FeatureFlags {
  const { user } = useAuth();
  return user?.featureFlags ?? DEFAULT_FEATURE_FLAGS;
}

// react import for the toast render function type (no actual JSX)
import type React from 'react';
