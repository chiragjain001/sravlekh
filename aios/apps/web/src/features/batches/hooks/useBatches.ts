'use client';
// ─── Batches Module: Data Hooks ───────────────────────────────────────────────
// Thin view-model wrappers around the real, backend-wired hooks in
// apps/web/src/hooks/useApi.ts. The list endpoint has no server-side
// pagination/search (institute batch counts are small), so this layer applies
// search/filter/sort/pagination client-side over the real fetched list —
// no mock data, no invented fields.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useBatches as useBatchesRaw,
  useBatch as useBatchRaw,
  useBatchStats as useBatchStatsRaw,
  useCreateBatch as useCreateBatchRaw,
  useUpdateBatch as useUpdateBatchRaw,
  useArchiveBatch as useArchiveBatchRaw,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import { apiClient } from '@/lib/api-client';
import type {
  GetBatchesParams,
  CreateBatchInput,
  UpdateBatchInput,
  BatchListItem,
  BatchProfile,
  BatchesStats,
} from '../types/batch.types';

function toListItem(raw: any): BatchListItem {
  return {
    id: raw.id,
    name: raw.name,
    classYear: raw.classYear ?? null,
    section: raw.section ?? null,
    academicYear: raw.academicYear ?? null,
    branchId: raw.branch?.id ?? raw.branchId ?? null,
    branchName: raw.branch?.name ?? null,
    isActive: raw.isActive ?? true,
    studentCount: raw._count?.students ?? 0,
    teacherCount: raw._count?.teachers ?? 0,
  };
}

function toProfile(raw: any): BatchProfile {
  const students = (raw.students ?? []).map((s: any) => ({ id: s.id, name: s.user?.name ?? '—', email: s.user?.email ?? '—' }));
  const teachers = (raw.teachers ?? [])
    .filter((t: any) => !t.removedAt)
    .map((t: any) => ({ id: t.teacherProfile?.id ?? t.id, name: t.teacherProfile?.user?.name ?? '—', email: t.teacherProfile?.user?.email ?? '—', subjectId: t.subjectId ?? null }));
  return {
    ...toListItem(raw),
    // findBatchById returns the full students/teachers arrays but no _count —
    // derive the real counts from them instead of falling back to 0.
    studentCount: raw._count?.students ?? students.length,
    teacherCount: raw._count?.teachers ?? teachers.length,
    students,
    teachers,
  };
}

// ── Read hooks ──────────────────────────────────────────────────────────────

export function useBatchesList(params: GetBatchesParams) {
  const query = useBatchesRaw();
  const all: BatchListItem[] = ((query.data?.data ?? query.data ?? []) as any[]).map(toListItem);

  let filtered = all;
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter((b) => b.name.toLowerCase().includes(q) || (b.section ?? '').toLowerCase().includes(q));
  }
  if (params.classYear) filtered = filtered.filter((b) => b.classYear === params.classYear);
  if (params.isActive !== undefined) filtered = filtered.filter((b) => b.isActive === params.isActive);

  const sortBy = params.sortBy ?? 'name';
  const sortDir = params.sortDir ?? 'asc';
  filtered = [...filtered].sort((a, b) => {
    const av = (a[sortBy] ?? '') as string;
    const bv = (b[sortBy] ?? '') as string;
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 10;
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const pageData = filtered.slice(start, start + pageSize);

  return {
    ...query,
    data: {
      data: pageData,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export function useBatchProfile(id: string | null) {
  const query = useBatchRaw(id);
  return { ...query, data: query.data ? toProfile(query.data) : undefined };
}

export function useBatchesStats() {
  const query = useBatchStatsRaw();
  return { ...query, data: query.data as BatchesStats | undefined };
}

// ── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateBatch() {
  const raw = useCreateBatchRaw();
  return { ...raw, mutateAsync: (input: CreateBatchInput) => raw.mutateAsync(input) };
}

export function useUpdateBatch() {
  const raw = useUpdateBatchRaw();
  return {
    ...raw,
    mutateAsync: (input: UpdateBatchInput) => {
      const { id, ...data } = input;
      return raw.mutateAsync({ batchId: id, ...data });
    },
  };
}

export function useDeleteBatch() {
  const raw = useArchiveBatchRaw();
  return { ...raw, mutateAsync: (id: string) => raw.mutateAsync(id) };
}

export function useBulkDeleteBatches() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.delete(`/institutes/${user?.instituteId}/batches/${id}`)));
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} batch(es) archived`);
      queryClient.invalidateQueries({ queryKey: ['batches', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['batches-stats', user?.instituteId] });
    },
  });
}
