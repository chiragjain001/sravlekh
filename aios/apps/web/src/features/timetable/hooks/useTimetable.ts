'use client';
// ─── Timetable Module: Custom Data Hooks ──────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTimetableMatrix,
  getFlatSessionList,
  getTimetableAnalytics,
  createSession,
  updateSession,
  deleteSession,
  assignSubstitute,
  resolveConflict,
} from '../services/timetable.service';
import type {
  GetTimetableParams,
  CreateSessionInput,
  UpdateSessionInput,
} from '../types/timetable.types';

export const timetableQueryKeys = {
  all:       ['timetable'] as const,
  matrix:    (params: GetTimetableParams) => ['timetable', 'matrix', params] as const,
  list:      ()                           => ['timetable', 'list'] as const,
  analytics: ()                           => ['timetable', 'analytics'] as const,
};

export function useTimetableMatrix(params: GetTimetableParams) {
  return useQuery({
    queryKey:        timetableQueryKeys.matrix(params),
    queryFn:         () => getTimetableMatrix(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useFlatSessionList() {
  return useQuery({
    queryKey:  timetableQueryKeys.list(),
    queryFn:   getFlatSessionList,
    staleTime: 30_000,
  });
}

export function useTimetableAnalytics() {
  return useQuery({
    queryKey:  timetableQueryKeys.analytics(),
    queryFn:   getTimetableAnalytics,
    staleTime: 120_000,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSessionInput) => createSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timetableQueryKeys.all });
    },
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSessionInput) => updateSession(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timetableQueryKeys.all });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timetableQueryKeys.all });
    },
  });
}

export function useAssignSubstitute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, substituteFaculty }: { sessionId: string; substituteFaculty: string }) =>
      assignSubstitute(sessionId, substituteFaculty),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timetableQueryKeys.all });
    },
  });
}

export function useResolveConflict() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertId: string) => resolveConflict(alertId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timetableQueryKeys.analytics() });
    },
  });
}
