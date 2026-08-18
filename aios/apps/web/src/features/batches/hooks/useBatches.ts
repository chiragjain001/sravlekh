'use client';
// ─── Batches Module: Custom Data Hooks ────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBatches,
  getBatchById,
  getBatchProfile,
  getBatchesAnalytics,
  createBatch,
  updateBatch,
  deleteBatch,
  bulkDeleteBatches,
  exportBatches,
} from '../services/batches.service';
import type {
  GetBatchesParams,
  CreateBatchInput,
  UpdateBatchInput,
} from '../types/batch.types';

export const batchQueryKeys = {
  all:       ['batches'] as const,
  list:      (params: GetBatchesParams) => ['batches', 'list', params] as const,
  detail:    (id: string)               => ['batches', 'detail', id] as const,
  profile:   (id: string)               => ['batches', 'profile', id] as const,
  analytics: ()                         => ['batches', 'analytics'] as const,
};

export function useBatchesList(params: GetBatchesParams) {
  return useQuery({
    queryKey:        batchQueryKeys.list(params),
    queryFn:         () => getBatches(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useBatchById(id: string | null) {
  return useQuery({
    queryKey:  batchQueryKeys.detail(id ?? ''),
    queryFn:   () => getBatchById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useBatchProfile(id: string | null) {
  return useQuery({
    queryKey:  batchQueryKeys.profile(id ?? ''),
    queryFn:   () => getBatchProfile(id!),
    enabled:   !!id,
    staleTime: 60_000,
  });
}

export function useBatchesAnalytics() {
  return useQuery({
    queryKey:  batchQueryKeys.analytics(),
    queryFn:   getBatchesAnalytics,
    staleTime: 120_000,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => createBatch(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
    },
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBatchInput) => updateBatch(input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
      qc.setQueryData(batchQueryKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
    },
  });
}

export function useBulkDeleteBatches() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteBatches(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: batchQueryKeys.all });
    },
  });
}

export function useExportBatches() {
  return useMutation({
    mutationFn: (ids?: string[]) => exportBatches(ids),
  });
}
