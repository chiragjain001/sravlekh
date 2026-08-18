'use client';
// ─── Exams Module: Custom Data Hooks ──────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getExams,
  getExamById,
  getExamProfile,
  getExamsAnalytics,
  createExam,
  updateExam,
  deleteExam,
  bulkDeleteExams,
  exportExams,
} from '../services/exams.service';
import type {
  GetExamsParams,
  CreateExamInput,
  UpdateExamInput,
} from '../types/exam.types';

export const examQueryKeys = {
  all:       ['exams'] as const,
  list:      (params: GetExamsParams) => ['exams', 'list', params] as const,
  detail:    (id: string)             => ['exams', 'detail', id] as const,
  profile:   (id: string)             => ['exams', 'profile', id] as const,
  analytics: ()                       => ['exams', 'analytics'] as const,
};

export function useExamsList(params: GetExamsParams) {
  return useQuery({
    queryKey:        examQueryKeys.list(params),
    queryFn:         () => getExams(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useExamById(id: string | null) {
  return useQuery({
    queryKey:  examQueryKeys.detail(id ?? ''),
    queryFn:   () => getExamById(id!),
    enabled:   !!id,
    staleTime: 30_000,
  });
}

export function useExamProfile(id: string | null) {
  return useQuery({
    queryKey:  examQueryKeys.profile(id ?? ''),
    queryFn:   () => getExamProfile(id!),
    enabled:   !!id,
    staleTime: 60_000,
  });
}

export function useExamsAnalytics() {
  return useQuery({
    queryKey:  examQueryKeys.analytics(),
    queryFn:   getExamsAnalytics,
    staleTime: 120_000,
  });
}

export function useCreateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExamInput) => createExam(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: examQueryKeys.all });
    },
  });
}

export function useUpdateExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateExamInput) => updateExam(input),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: examQueryKeys.all });
      qc.setQueryData(examQueryKeys.detail(updated.id), updated);
    },
  });
}

export function useDeleteExam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteExam(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: examQueryKeys.all });
    },
  });
}

export function useBulkDeleteExams() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => bulkDeleteExams(ids),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: examQueryKeys.all });
    },
  });
}

export function useExportExams() {
  return useMutation({
    mutationFn: (ids?: string[]) => exportExams(ids),
  });
}
