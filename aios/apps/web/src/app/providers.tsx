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
            staleTime:    2 * 60 * 1000, // 2 minutes — reduces redundant fetches
            retry:        1,
            refetchOnWindowFocus: false,  // prevents unexpected refetches in dashboard
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

