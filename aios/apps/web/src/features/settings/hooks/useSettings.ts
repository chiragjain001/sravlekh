'use client';
// ─── Settings Module: Custom Hooks ──────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSystemSettings, updateSystemSettings } from '../services/settings.service';
import type { SystemSettings } from '../types/settings.types';

export const settingsQueryKeys = {
  all: ['systemSettings'] as const,
};

export function useSystemSettings() {
  return useQuery({
    queryKey:  settingsQueryKeys.all,
    queryFn:   getSystemSettings,
    staleTime: 300_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partial: Partial<SystemSettings>) => updateSystemSettings(partial),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsQueryKeys.all });
    },
  });
}
