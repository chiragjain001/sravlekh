'use client';

// ─── useContextUrlSync ────────────────────────────────────────────────────────
// Keeps URL search params in sync with AcademicContext and teacher navigation.
// On mount: reads URL → restores context (deep link support).
// On context/nav change: updates URL (browser back button support).
//
// Usage: call once at the top of TeacherDashboard (or per-role page)
//   useContextUrlSync('teacher');

import { useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useAcademicContext } from '@/contexts/academic-context';
import { useTeacherStore } from '@/store/teacher-store';
import { parseUrlToContextPatch, contextToUrlParams } from '@/lib/url-sync';
import type { TeacherTopNav } from '@/store/teacher-store';

export function useContextUrlSync(role: 'teacher' | 'student' | 'admin' | 'founder') {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();
  const { ctx, setCtx } = useAcademicContext();
  const teacherNav = useTeacherStore(s => s.teacherNav);
  const setTeacherNav = useTeacherStore(s => s.setTeacherNav);

  const isMounted = useRef(false);
  const syncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── On mount: restore context from URL ──────────────────────────────────────
  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;

    const patch = parseUrlToContextPatch(searchParams);
    if (Object.keys(patch).length > 0) {
      setCtx(patch);
    }

    // Restore nav from URL
    if (role === 'teacher') {
      const nav = searchParams.get('nav') as TeacherTopNav | null;
      if (nav) setTeacherNav(nav);
    }
  }, []);

  // ── On context change: update URL (debounced 200ms) ─────────────────────────
  const syncToUrl = useCallback(() => {
    if (!isMounted.current) return;

    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      const nav = role === 'teacher' ? teacherNav : undefined;
      const params = contextToUrlParams(ctx, nav);
      const newUrl = `${pathname}?${params.toString()}`;

      // Use replaceState to avoid polluting browser history on every keystroke
      router.replace(newUrl, { scroll: false });
    }, 200);
  }, [ctx, teacherNav, pathname, role]);

  useEffect(() => {
    syncToUrl();
    return () => {
      if (syncTimeout.current) clearTimeout(syncTimeout.current);
    };
  }, [syncToUrl]);
}

// ─── useNetworkStatus ─────────────────────────────────────────────────────────
// Monitors online/offline status and triggers queue sync on reconnect.

import { useState, useEffect as useEff } from 'react';
import { useUIStore } from '@/store/ui-stores';
import { offlineQueue } from '@/lib/offline-queue';
import { eventBus } from '@/lib/event-bus';

export function useNetworkStatus() {
  const setIsOnline = useUIStore(s => s.setIsOnline);
  const setQueueCount = useUIStore(s => s.setOfflineQueueCount);
  const [wasOffline, setWasOffline] = useState(false);

  useEff(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      eventBus.emit('WENT_OFFLINE', {});
    };

    const handleOnline = () => {
      setIsOnline(true);
      const count = offlineQueue.getCount();
      setQueueCount(count);
      if (count > 0) {
        eventBus.emit('CAME_ONLINE', { queuedMutations: count });
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return { wasOffline };
}

// ─── useAiosEvent ─────────────────────────────────────────────────────────────
// Convenience hook for subscribing to event bus events in components.
// Automatically unsubscribes on unmount.

import { useEffect as useEvtEffect } from 'react';
import type { AiosEvent, EventPayload } from '@/lib/event-bus';

export function useAiosEvent<E extends AiosEvent>(
  event: E,
  handler: (payload: EventPayload<E>) => void,
  deps: unknown[] = []
) {
  useEvtEffect(() => {
    const unsub = eventBus.on(event, handler);
    return unsub;
  }, deps);
}
