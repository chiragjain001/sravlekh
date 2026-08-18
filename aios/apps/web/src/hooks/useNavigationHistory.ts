'use client';

// ─── useNavigationHistory ───────────────────────────────────────────────────────
// Universal browser history & deep-link synchronization hook for AIOS.
// Supports:
// 1. Browser Back / Forward buttons (popstate events)
// 2. Mouse Back / Forward hardware buttons
// 3. Alt + Left Arrow keyboard navigation
// 4. Header UI Back button with previous screen name preview
// 5. Automatic modal close on Back button press before navigating away

import { useEffect, useRef, useState, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  useAdminStore,
  useStudentStore,
  useFounderStore,
  AdminNav,
  StudentNav,
  FounderNav,
} from '@/store/role-stores';
import { useTeacherStore, TeacherTopNav } from '@/store/teacher-store';

export type RoleType = 'admin' | 'teacher' | 'student' | 'founder';

interface HistoryEntry {
  nav: string;
  modal?: string | null;
  timestamp: number;
}

export function useNavigationHistory(role: RoleType) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Stores
  const { adminNav, setAdminNav } = useAdminStore();
  const { teacherNav, setTeacherNav } = useTeacherStore();
  const { studentNav, setStudentNav } = useStudentStore();
  const { founderNav, setFounderNav } = useFounderStore();

  // Active Nav based on role
  const activeNav =
    role === 'admin'
      ? adminNav
      : role === 'teacher'
      ? teacherNav
      : role === 'student'
      ? studentNav
      : founderNav;

  // Set active nav function based on role
  const setActiveNav = useCallback(
    (nav: string) => {
      if (role === 'admin') setAdminNav(nav as AdminNav);
      else if (role === 'teacher') setTeacherNav(nav as TeacherTopNav);
      else if (role === 'student') setStudentNav(nav as StudentNav);
      else if (role === 'founder') setFounderNav(nav as FounderNav);
    },
    [role, setAdminNav, setTeacherNav, setStudentNav, setFounderNav]
  );

  // Stack of navigated screens for UI preview & fallback
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const isPopstateEvent = useRef(false);
  const isInitialMount = useRef(true);

  // Default nav tab per role
  const defaultNav =
    role === 'admin'
      ? 'Dashboard'
      : role === 'teacher'
      ? 'today'
      : 'Overview';

  // Restore state from URL on initial load
  useEffect(() => {
    if (!isInitialMount.current) return;

    const urlNav = searchParams.get('nav');
    if (urlNav && urlNav !== activeNav) {
      setActiveNav(urlNav);
      setHistoryStack([defaultNav, urlNav]);
    } else {
      setHistoryStack([activeNav]);
    }

    // Set initial window history state if missing
    if (typeof window !== 'undefined' && !window.history.state?.aiosNav) {
      const initialNav = urlNav || activeNav;
      window.history.replaceState(
        { aiosNav: initialNav, role, timestamp: Date.now() },
        '',
        `${pathname}?nav=${encodeURIComponent(initialNav)}`
      );
    }

    isInitialMount.current = false;
  }, []);

  // When activeNav changes (user clicks sidebar or tab link)
  useEffect(() => {
    if (isInitialMount.current) return;

    // If change was triggered by popstate (browser back/forward button), skip pushState
    if (isPopstateEvent.current) {
      isPopstateEvent.current = false;
      return;
    }

    // Update URL & push to browser history
    if (typeof window !== 'undefined') {
      const currentStateNav = window.history.state?.aiosNav;
      if (currentStateNav !== activeNav) {
        const newUrl = `${pathname}?nav=${encodeURIComponent(activeNav)}`;
        window.history.pushState(
          { aiosNav: activeNav, role, timestamp: Date.now() },
          '',
          newUrl
        );

        setHistoryStack((prev) => {
          if (prev[prev.length - 1] === activeNav) return prev;
          return [...prev, activeNav];
        });
      }
    }
  }, [activeNav, pathname, role]);

  // Handle popstate (Browser Back / Forward click)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (event: PopStateEvent) => {
      const stateNav = event.state?.aiosNav;
      const urlNav = new URLSearchParams(window.location.search).get('nav');
      const targetNav = stateNav || urlNav;

      if (targetNav) {
        isPopstateEvent.current = true;
        setActiveNav(targetNav);

        setHistoryStack((prev) => {
          if (prev.length > 1) {
            return prev.slice(0, prev.length - 1);
          }
          return prev;
        });
      } else if (activeNav !== defaultNav) {
        // Fallback to default view
        isPopstateEvent.current = true;
        setActiveNav(defaultNav);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeNav, defaultNav, setActiveNav]);

  // Go Back trigger (used by UI Back Button or keyboard shortcut)
  const goBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1 && historyStack.length > 1) {
      window.history.back();
    } else if (activeNav !== defaultNav) {
      isPopstateEvent.current = true;
      setActiveNav(defaultNav);
      setHistoryStack([defaultNav]);
    }
  }, [activeNav, defaultNav, historyStack, setActiveNav]);

  // Determine previous nav label for back button tooltip/badge
  const previousNav =
    historyStack.length > 1
      ? historyStack[historyStack.length - 2]
      : activeNav !== defaultNav
      ? defaultNav
      : null;

  const canGoBack = Boolean(previousNav || historyStack.length > 1 || activeNav !== defaultNav);

  return {
    activeNav,
    previousNav,
    canGoBack,
    goBack,
  };
}
