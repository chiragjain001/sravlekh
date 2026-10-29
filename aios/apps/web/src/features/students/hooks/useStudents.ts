'use client';
// ─── Students Module: Data Hooks ──────────────────────────────────────────────
// Thin view-model wrappers around the real, backend-wired hooks in
// apps/web/src/hooks/useApi.ts (apiClient → apps/api/src/students). No mock
// data, no invented fields — every value here traces back to a real endpoint.

import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  useStudents as useStudentsRaw,
  useStudent as useStudentRaw,
  useStudentStats as useStudentStatsRaw,
  useCreateStudent as useCreateStudentRaw,
  useUpdateStudent as useUpdateStudentRaw,
  useArchiveStudent as useArchiveStudentRaw,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import { apiClient } from '@/lib/api-client';
import type {
  GetStudentsParams,
  CreateStudentInput,
  UpdateStudentInput,
  StudentListItem,
  StudentProfile,
  StudentsStats,
} from '../types/student.types';

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

function toListItem(raw: any): StudentListItem {
  return {
    id: raw.id,
    userId: raw.user?.id ?? raw.userId,
    rollNumber: raw.rollNumber ?? null,
    name: raw.user?.name ?? '—',
    email: raw.user?.email ?? '—',
    avatarInitials: initials(raw.user?.name ?? '?'),
    batchId: raw.batch?.id ?? raw.batchId ?? null,
    batchLabel: raw.batch?.name ?? 'Unassigned',
    tags: raw.tags ?? [],
    status: raw.user?.status ?? 'ACTIVE',
    guardianName: raw.guardianName ?? null,
    guardianPhone: raw.guardianPhone ?? null,
    guardianEmail: raw.guardianEmail ?? null,
    address: raw.address ?? null,
    dateOfBirth: raw.dateOfBirth ?? null,
    admissionDate: raw.admissionDate,
  };
}

function toProfile(raw: any): StudentProfile {
  return {
    ...toListItem(raw),
    scoreRecords: (raw.scoreRecords ?? []).map((r: any) => ({
      id: r.id,
      score: r.score,
      maxScore: r.maxScore,
      pct: r.maxScore > 0 ? Math.round((r.score / r.maxScore) * 100) : 0,
      exam: r.exam ? { id: r.exam.id, title: r.exam.title, scheduledDate: r.exam.scheduledDate, type: r.exam.type } : null,
    })),
    masteryScores: (raw.masteryScores ?? []).map((m: any) => ({
      id: m.id,
      topicName: m.topic?.name ?? 'Unknown topic',
      subjectName: m.subject?.name ?? 'Unknown subject',
      score: m.score,
      lastUpdatedAt: m.lastUpdatedAt,
    })),
    profileHistory: (raw.profileHistory ?? []).map((h: any) => ({
      id: h.id,
      eventType: h.eventType,
      description: h.description,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedAt: h.changedAt,
      changedByUserId: h.changedByUserId,
    })),
  };
}

// ── Read hooks ──────────────────────────────────────────────────────────────

export function useStudentsList(params: GetStudentsParams) {
  const { page = 1, pageSize = 20, ...rest } = params;
  const query = useStudentsRaw({ ...rest, page, limit: pageSize });
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Prefetch next and previous pages for instantaneous page navigation
  useEffect(() => {
    if (!user?.instituteId || !query.data?.meta?.totalPages) return;

    if (page < query.data.meta.totalPages) {
      const nextPageParams = { ...rest, page: page + 1, limit: pageSize };
      queryClient.prefetchQuery({
        queryKey: ['students', user.instituteId, nextPageParams],
        queryFn: async () => {
          const res = await apiClient.get(`/institutes/${user.instituteId}/students`, { params: nextPageParams });
          return res.data;
        },
        staleTime: 30_000,
      });
    }

    if (page > 1) {
      const prevPageParams = { ...rest, page: page - 1, limit: pageSize };
      queryClient.prefetchQuery({
        queryKey: ['students', user.instituteId, prevPageParams],
        queryFn: async () => {
          const res = await apiClient.get(`/institutes/${user.instituteId}/students`, { params: prevPageParams });
          return res.data;
        },
        staleTime: 30_000,
      });
    }
  }, [page, pageSize, rest, query.data?.meta?.totalPages, user?.instituteId, queryClient]);

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

export function useStudentProfile(id: string | null) {
  const query = useStudentRaw(id);
  return { ...query, data: query.data ? toProfile(query.data) : undefined };
}

export function useStudentsStats() {
  const query = useStudentStatsRaw();
  return { ...query, data: query.data as StudentsStats | undefined };
}

// ── Mutation hooks ───────────────────────────────────────────────────────────

export function useCreateStudent() {
  const raw = useCreateStudentRaw();
  return {
    ...raw,
    mutateAsync: (input: CreateStudentInput) => raw.mutateAsync(input),
  };
}

export function useUpdateStudent() {
  const raw = useUpdateStudentRaw();
  return {
    ...raw,
    mutateAsync: (input: UpdateStudentInput) => {
      const { id, ...data } = input;
      return raw.mutateAsync({ profileId: id, ...data });
    },
  };
}

export function useDeleteStudent() {
  const raw = useArchiveStudentRaw();
  return { ...raw, mutateAsync: (id: string) => raw.mutateAsync(id) };
}

export function useBulkDeleteStudents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => apiClient.delete(`/institutes/${user?.instituteId}/students/${id}`)));
      return ids.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} student(s) archived`);
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['students-stats', user?.instituteId] });
    },
  });
}

export function useDownloadBulkStudentTemplate() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/students/bulk-template`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'AIOS_Student_Enrollment_Template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return true;
    },
    onSuccess: () => {
      toast.success('Official Excel template downloaded');
    },
    onError: () => {
      toast.error('Failed to download template. Please check connection.');
    },
  });
}

export function useValidateBulkStudents() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(
        `/institutes/${user?.instituteId}/students/bulk-validate`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      return res.data;
    },
  });
}

export function useCommitBulkStudents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (students: any[]) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/students/bulk-import`, {
        students,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully enrolled ${data.enrolledCount} student(s)!`);
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['students-stats', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['batches', user?.instituteId] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || 'Failed to complete bulk enrollment';
      toast.error(msg);
    },
  });
}

export function useDownloadBulkErrorReport() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (failedRows: any[]) => {
      const res = await apiClient.post(
        `/institutes/${user?.instituteId}/students/bulk-error-report`,
        { failedRows },
        { responseType: 'blob' },
      );
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'AIOS_Failed_Students_Remediation.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      return true;
    },
    onSuccess: () => {
      toast.success('Error remediation workbook downloaded');
    },
    onError: () => {
      toast.error('Failed to download error workbook');
    },
  });
}

