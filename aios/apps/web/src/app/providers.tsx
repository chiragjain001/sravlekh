'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/auth.context';
import { AcademicContextProvider } from '@/contexts/academic-context';

/**
 * Providers wraps the app in all necessary context providers.
 *
 * Provider hierarchy (order matters):
 *   QueryClientProvider          ← server state (TanStack Query)
 *     AuthProvider               ← authentication + user identity
 *       AcademicContextProvider  ← unified academic context (requires auth)
 *         children               ← the actual dashboard components
 *
 * Kept in a client component so it can use useState for QueryClient.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // AIOS is multi-user by nature: a teacher publishes a test while the
            // student's dashboard is already open, an admin renames a class while
            // a teacher is looking at it. The old defaults (2-minute staleTime,
            // focus refetch disabled) meant those changes only ever appeared on a
            // manual F5. Freshness is now opt-in per query via the REFRESH tiers
            // in hooks/useApi.ts; these defaults just stop the app from serving
            // stale data to someone who has come back to the tab.
            staleTime:    30 * 1000,
            retry:        1,
            refetchOnWindowFocus: true,
            refetchOnReconnect:   true,
          },
          mutations: {
            retry: 0, // mutations should NOT auto-retry (idempotency risk)
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AcademicContextProvider>
          {children}
          {/* Global toast notifications — positioned top-right */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f8fafc',
                borderRadius: '12px',
                fontSize: '13px',
                fontWeight: 600,
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' }, duration: 6000 },
            }}
          />
        </AcademicContextProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

