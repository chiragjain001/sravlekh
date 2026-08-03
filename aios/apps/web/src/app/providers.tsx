'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AuthProvider } from '@/contexts/auth.context';

/**
 * Providers wraps the app in all necessary context providers.
 * Kept in a client component so it can use useState for QueryClient.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  // Create a stable QueryClient per session — not at module level
  // to avoid shared state between server renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
