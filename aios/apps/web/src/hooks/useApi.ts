import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, aiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth.context';
import toast from 'react-hot-toast';
import axios from 'axios';

// ── Students ─────────────────────────────────────────────────────────────

export function useStudents(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/students`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreateStudent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/students`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Student enrolled successfully');
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to enrol student';
      toast.error(msg);
    },
  });
}

// ── Teachers ─────────────────────────────────────────────────────────────

export function useTeachers(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teachers', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/teachers`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreateTeacher() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/teachers`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Teacher added successfully');
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to add teacher';
      toast.error(msg);
    },
  });
}

// ── Batches ──────────────────────────────────────────────────────────────

export function useBatches() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['batches', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/batches`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreateBatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/batches`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Batch created successfully');
      queryClient.invalidateQueries({ queryKey: ['batches', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to create batch';
      toast.error(msg);
    },
  });
}

// ── Questions ────────────────────────────────────────────────────────────

export function useQuestions(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['questions', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/questions`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreateQuestion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/questions`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Question added successfully');
      queryClient.invalidateQueries({ queryKey: ['questions', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to add question';
      toast.error(msg);
    },
  });
}

// ── Papers & Blueprints ──────────────────────────────────────────────────

export function useBlueprints() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['blueprints', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/blueprints`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreateBlueprint() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/blueprints`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Blueprint created successfully');
      queryClient.invalidateQueries({ queryKey: ['blueprints', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to create blueprint';
      toast.error(msg);
    },
  });
}

export function useGenerateBlueprintAI() {
  return useMutation({
    mutationFn: async (data: { prompt: string }) => {
      const res = await aiClient.post(`/ai/generate-blueprint`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('AI Blueprint generated!');
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.detail : 'Failed to generate with AI';
      toast.error(msg);
    },
  });
}

export function useGeneratePaper() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/papers/generate`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Paper generated successfully');
      queryClient.invalidateQueries({ queryKey: ['papers', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to generate paper';
      toast.error(msg);
    },
  });
}

// ── Exams ────────────────────────────────────────────────────────────────

export function useCreateExam() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/exams`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Exam created successfully');
      queryClient.invalidateQueries({ queryKey: ['exams', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to create exam';
      toast.error(msg);
    },
  });
}

// ── Analytics ────────────────────────────────────────────────────────────

export function useAnalyticsOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['analytics', 'overview', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/analytics/overview`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useBatchHeatmap(batchId: string | undefined) {
  return useQuery({
    queryKey: ['analytics', 'heatmap', batchId],
    queryFn: async () => {
      const res = await aiClient.get(`/analytics/batch/${batchId}/heatmap`);
      return res.data;
    },
    enabled: !!batchId,
  });
}

// ── Doubts ───────────────────────────────────────────────────────────────

export function useDoubts(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['doubts', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/doubts`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useAssignDoubt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ doubtId, data }: { doubtId: string; data: any }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/doubts/${doubtId}/assign`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Doubt assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['doubts', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to assign doubt';
      toast.error(msg);
    },
  });
}

export function useResolveDoubt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ doubtId, data }: { doubtId: string; data: any }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/doubts/${doubtId}/resolve`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Doubt resolved successfully');
      queryClient.invalidateQueries({ queryKey: ['doubts', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to resolve doubt';
      toast.error(msg);
    },
  });
}

// ── Assignments ──────────────────────────────────────────────────────────

export function useAssignments(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assignments', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/assignments`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

// ── Timetable ────────────────────────────────────────────────────────────

export function useTimetable(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['timetable', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/timetable`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

// ── Exams ───────────────────────────────────────────────────────────────

export function useExams(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['exams', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/exams`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}


