'use client';
// ─── Audit Logs Module: Custom Hooks ─────────────────────────────────────────

import { useQuery, useMutation } from '@tanstack/react-query';
import {
  getAuditLogs,
  getAuditLogAnalytics,
  exportAuditLogs,
} from '../services/audit-log.service';
import type { GetAuditLogsParams } from '../types/audit-log.types';

export const auditLogsQueryKeys = {
  all:       ['auditLogs'] as const,
  list:      (params: GetAuditLogsParams) => ['auditLogs', 'list', params] as const,
  analytics: ()                           => ['auditLogs', 'analytics'] as const,
};

export function useAuditLogs(params: GetAuditLogsParams) {
  return useQuery({
    queryKey:        auditLogsQueryKeys.list(params),
    queryFn:         () => getAuditLogs(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useAuditLogAnalytics() {
  return useQuery({
    queryKey:  auditLogsQueryKeys.analytics(),
    queryFn:   getAuditLogAnalytics,
    staleTime: 120_000,
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: exportAuditLogs,
  });
}
