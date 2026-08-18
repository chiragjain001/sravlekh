'use client';
// ─── Students Module: Data Hooks ──────────────────────────────────────────────
// All TanStack Query hooks for the Students Module.
// Components NEVER call service functions directly — they use these hooks.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStudents,
  getStudentById,
  getStudentProfile,
  getStudentsAnalytics,
  createStudent,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
  exportStudents,
} from '../services/students.service';
import type {
  GetStudentsParams,
  CreateStudentInput,
  UpdateStudentInput,
} from '../types/student.types';

// ── Query key factory (scoped, avoids raw string arrays in components)
export const studentQueryKeys = {
  all:        ['students'] as const,
  list:       (params: GetStudentsParams) => ['students', 'list', params] as const,
  detail:     (id: string)                => ['students', 'detail', id] as const,
  profile:    (id: string)                => ['students', 'profile', id] as const,
  analytics:  ()                          => ['students', 'analytics'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
//  READ hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useStudentsList(params: GetStudentsParams) {
  return useQuery({
    queryKey:     studentQueryKeys.list(params),
    queryFn:      () => getStudents(params),
    placeholderData: (prev) => prev,  // keeps stale data while re-fetching
    staleTime:    30_000,
  });
}

export function useStudentById(id: string | null) {
  return useQuery({
    queryKey:  studentQueryKeys.detail(id ?? ''),
    queryFn:   () => getStudentById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useStudentProfile(id: string | null) {
  return useQuery({
    queryKey:  studentQueryKeys.profile(id ?? ''),
    queryFn:   () => getStudentProfile(id!),
    enabled:   !!id,
    staleTime: 60_000,
  });
}

export function useStudentsAnalytics() {
  return useQuery({
    queryKey:  studentQueryKeys.analytics(),
    queryFn:   getStudentsAnalytics,
    staleTime: 120_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  MUTATION hooks
// ─────────────────────────────────────────────────────────────────────────────

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) => createStudent(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentQueryKeys.all });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStudentInput) => updateStudent(input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: studentQueryKeys.all });
      qc.setQueryData(studentQueryKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteStudent(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentQueryKeys.all });
    },
  });
}

export function useBulkDeleteStudents() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteStudents(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studentQueryKeys.all });
    },
  });
}

export function useExportStudents() {
  return useMutation({
    mutationFn: (ids?: string[]) => exportStudents(ids),
  });
}
