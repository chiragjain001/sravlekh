'use client';
// ─── Academics Module: Custom Data Hooks ──────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAcademicsAnalytics, updateSyllabusProgress } from '../services/academics.service';
import type { GetAcademicsParams } from '../types/academic.types';

export const academicQueryKeys = {
  all:       ['academics'] as const,
  analytics: (params: GetAcademicsParams) => ['academics', 'analytics', params] as const,
};

export function useAcademicsAnalytics(params: GetAcademicsParams = {}) {
  return useQuery({
    queryKey:  academicQueryKeys.analytics(params),
    queryFn:   () => getAcademicsAnalytics(params),
    staleTime: 60_000,
  });
}

export function useUpdateSyllabusProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subjectId, newProgress }: { subjectId: string; newProgress: number }) =>
      updateSyllabusProgress(subjectId, newProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: academicQueryKeys.all });
    },
  });
}
