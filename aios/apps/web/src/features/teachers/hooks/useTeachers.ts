'use client';
// ─── Teachers Module: Custom Data Hooks ───────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTeachers,
  getTeacherById,
  getTeacherProfile,
  getTeachersAnalytics,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  bulkDeleteTeachers,
  exportTeachers,
} from '../services/teachers.service';
import type {
  GetTeachersParams,
  CreateTeacherInput,
  UpdateTeacherInput,
} from '../types/teacher.types';

export const teacherQueryKeys = {
  all:        ['teachers'] as const,
  list:       (params: GetTeachersParams) => ['teachers', 'list', params] as const,
  detail:     (id: string)                => ['teachers', 'detail', id] as const,
  profile:    (id: string)                => ['teachers', 'profile', id] as const,
  analytics:  ()                          => ['teachers', 'analytics'] as const,
};

export function useTeachersList(params: GetTeachersParams) {
  return useQuery({
    queryKey:        teacherQueryKeys.list(params),
    queryFn:         () => getTeachers(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useTeacherById(id: string | null) {
  return useQuery({
    queryKey:  teacherQueryKeys.detail(id ?? ''),
    queryFn:   () => getTeacherById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useTeacherProfile(id: string | null) {
  return useQuery({
    queryKey:  teacherQueryKeys.profile(id ?? ''),
    queryFn:   () => getTeacherProfile(id!),
    enabled:   !!id,
    staleTime: 60_000,
  });
}

export function useTeachersAnalytics() {
  return useQuery({
    queryKey:  teacherQueryKeys.analytics(),
    queryFn:   getTeachersAnalytics,
    staleTime: 120_000,
  });
}

export function useCreateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTeacherInput) => createTeacher(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherQueryKeys.all });
    },
  });
}

export function useUpdateTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTeacherInput) => updateTeacher(input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: teacherQueryKeys.all });
      qc.setQueryData(teacherQueryKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteTeacher() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTeacher(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherQueryKeys.all });
    },
  });
}

export function useBulkDeleteTeachers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteTeachers(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teacherQueryKeys.all });
    },
  });
}

export function useExportTeachers() {
  return useMutation({
    mutationFn: (ids?: string[]) => exportTeachers(ids),
  });
}
