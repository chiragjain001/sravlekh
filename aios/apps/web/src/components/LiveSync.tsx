'use client';

import { useLiveSync } from '@/hooks/useApi';

/**
 * Renders nothing. Exists so the institute change feed runs exactly once for
 * the whole app, inside AuthProvider (it needs the signed-in user) and inside
 * QueryClientProvider (it invalidates caches).
 */
export function LiveSync() {
  useLiveSync();
  return null;
}
