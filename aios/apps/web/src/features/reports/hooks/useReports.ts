'use client';
// ─── Reports Module: Custom Data Hooks ──────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReportsCatalog,
  getReportsAnalytics,
  generateReport,
  downloadReport,
} from '../services/reports.service';
import type {
  GetReportsParams,
  GenerateReportInput,
} from '../types/reports.types';

export const reportsQueryKeys = {
  all:       ['reports'] as const,
  catalog:   (params: GetReportsParams) => ['reports', 'catalog', params] as const,
  analytics: ()                          => ['reports', 'analytics'] as const,
};

export function useReportsCatalog(params: GetReportsParams) {
  return useQuery({
    queryKey:        reportsQueryKeys.catalog(params),
    queryFn:         () => getReportsCatalog(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useReportsAnalytics() {
  return useQuery({
    queryKey:  reportsQueryKeys.analytics(),
    queryFn:   getReportsAnalytics,
    staleTime: 120_000,
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateReportInput) => generateReport(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportsQueryKeys.all });
    },
  });
}

export function useDownloadReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => downloadReport(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reportsQueryKeys.all });
    },
  });
}
