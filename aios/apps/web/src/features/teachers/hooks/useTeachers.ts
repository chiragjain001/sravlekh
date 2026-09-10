'use client';
// ─── Teachers Module: Data Hooks ──────────────────────────────────────────────
// Thin view-model wrappers around the real, backend-wired hooks in
// apps/web/src/hooks/useApi.ts. No mock data, no invented fields.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useTeachers as useTeachersRaw,
  useTeacher as useTeacherRaw,
  useTeacherStats as useTeacherStatsRaw,
  useCreateTeacher as useCreateTeacherRaw,
  useUpdateTeacher as useUpdateTeacherRaw,
  useArchiveTeacher as useArchiveTeacherRaw,
  useAssignTeacherToBatch as useAssignTeacherToBatchRaw,
  useRemoveTeacherFromBatch as useRemoveTeacherFromBatchRaw,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import { apiClient } from '@/lib/api-client';
import type {
  GetTeachersParams,
  CreateTeacherInput,
  UpdateTeacherInput,
  TeacherListItem,
  TeacherProfile,
  TeachersStats,
} from '../types/teacher.types';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function toListItem(raw: any): TeacherListItem {
  return {
    id: raw.id,
    userId: raw.user?.id ?? raw.userId,
    name: raw.user?.name ?? '—',
    email: raw.user?.email ?? '—',
    avatarInitials: initials(raw.user?.name ?? '?'),
    qualification: raw.qualification ?? null,
    subjectIds: raw.subjectIds ?? [],
    status: raw.user?.status ?? 'ACTIVE',
    batchAssignments: (raw.batchAssignments ?? [])
      .filter((a: any) => !a.removedAt)
      .map((a: any) => ({ id: a.id, batchId: a.batch?.id ?? a.batchId, batchName: a.batch?.name ?? 'Unknown batch', subjectId: a.subjectId ?? null })),
    joinedOn: raw.user?.createdAt ?? raw.createdAt,
  };
}

function toProfile(raw: any): TeacherProfile {
  return {
    ...toListItem(raw),
    availability: raw.availability ?? null,
  };
}

// ── Read hooks ──────────────────────────────────────────────────────────────

export function useTeachersList(params: GetTeachersParams) {
  const { page, pageSize, ...rest } = params;
  const query = useTeachersRaw({ ...rest, page, limit: pageSize });
  const data = query.data
    ? {
        data: ((query.data.data ?? []) as any[]).map(toListItem),
        total: query.data.meta?.total ?? 0,
        page: query.data.meta?.page ?? 1,
        pageSize: query.data.meta?.limit ?? pageSize ?? 20,
        totalPages: query.data.meta?.totalPages ?? 1,
      }
    : undefined;
  return { ...query, data };
}

export function useTeacherProfile(id: string | null) {
  const query = useTeacherRaw(id);
  return { ...query, data: query.data ? toProfile(query.data) : undefined };
}

export function useTeachersStats() {
  const query = useTeacherStatsRaw();
  return { ...query, data: query.data as TeachersStats | undefined };
}

// ── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateTeacher() {
  const raw = useCreateTeacherRaw();
  return { ...raw, mutateAsync: (input: CreateTeacherInput) => raw.mutateAsync(input) };
}

export function useUpdateTeacher() {
  const raw = useUpdateTeacherRaw();
  return {
    ...raw,
    mutateAsync: (input: UpdateTeacherInput) => {
      const { id, ...data } = input;
      return raw.mutateAsync({ profileId: id, ...data });
    },
  };
}

export function useDeleteTeacher() {
  const raw = useArchiveTeacherRaw();
  return { ...raw, mutateAsync: (id: string) => raw.mutateAsync(id) };
}

export function useBulkDeleteTeachers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.delete(`/institutes/${user?.instituteId}/teachers/${id}`)));
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} teacher(s) archived`);
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['teachers-stats', user?.instituteId] });
    },
  });
}

export const useAssignTeacherToBatch = useAssignTeacherToBatchRaw;
export const useRemoveTeacherFromBatch = useRemoveTeacherFromBatchRaw;
