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

export function useQuestion(questionId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['questions', user?.instituteId, questionId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/questions/${questionId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!questionId,
  });
}

export function useUpdateQuestion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/questions/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Question updated');
      queryClient.invalidateQueries({ queryKey: ['questions', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update question';
      toast.error(msg);
    },
  });
}

export function useApproveQuestion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/questions/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Question approved');
      queryClient.invalidateQueries({ queryKey: ['questions', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to approve question';
      toast.error(msg);
    },
  });
}

export function useArchiveQuestion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/questions/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Question archived');
      queryClient.invalidateQueries({ queryKey: ['questions', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to archive question';
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

export function useExam(examId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['exams', user?.instituteId, examId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/exams/${examId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!examId,
  });
}

export function useUpdateExamStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ examId, status, version }: { examId: string; status: string; version: number }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/exams/${examId}/status`, { status, version });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Exam moved to the next stage');
      queryClient.invalidateQueries({ queryKey: ['exams', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update exam status';
      toast.error(msg);
    },
  });
}

export function useUnlockExam() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ examId, reason, version }: { examId: string; reason: string; version: number }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/exams/${examId}/unlock`, { reason, version });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Exam unlocked for evaluation');
      queryClient.invalidateQueries({ queryKey: ['exams', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to unlock exam';
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

// ── Curriculum (Subjects → Chapters → Topics) ──────────────────────────────

export function useSubjects() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['subjects', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/subjects`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

function useCurriculumMutation<TVars>(
  mutationFn: (instituteId: string, vars: TVars) => Promise<unknown>,
  successMessage: string,
  failureMessage: string,
) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: TVars) => mutationFn(user!.instituteId, vars),
    onSuccess: () => {
      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['subjects', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error)
        ? (error.response?.data as { error?: { message?: string } })?.error?.message
        : undefined;
      toast.error(msg ?? failureMessage);
    },
  });
}

export function useCreateSubject() {
  return useCurriculumMutation<{ name: string; code?: string }>(
    (instituteId, dto) => apiClient.post(`/institutes/${instituteId}/subjects`, dto),
    'Subject created',
    'Failed to create subject',
  );
}

export function useUpdateSubject() {
  return useCurriculumMutation<{ id: string; name?: string; code?: string }>(
    (instituteId, { id, ...dto }) => apiClient.patch(`/institutes/${instituteId}/subjects/${id}`, dto),
    'Subject updated',
    'Failed to update subject',
  );
}

export function useArchiveSubject() {
  return useCurriculumMutation<{ id: string }>(
    (instituteId, { id }) => apiClient.delete(`/institutes/${instituteId}/subjects/${id}`),
    'Subject archived',
    'Failed to archive subject',
  );
}

export function useCreateChapter() {
  return useCurriculumMutation<{ subjectId: string; name: string; order?: number }>(
    (instituteId, { subjectId, ...dto }) =>
      apiClient.post(`/institutes/${instituteId}/subjects/${subjectId}/chapters`, dto),
    'Chapter added',
    'Failed to add chapter',
  );
}

export function useUpdateChapter() {
  return useCurriculumMutation<{ id: string; name?: string; order?: number }>(
    (instituteId, { id, ...dto }) => apiClient.patch(`/institutes/${instituteId}/chapters/${id}`, dto),
    'Chapter updated',
    'Failed to update chapter',
  );
}

export function useArchiveChapter() {
  return useCurriculumMutation<{ id: string }>(
    (instituteId, { id }) => apiClient.delete(`/institutes/${instituteId}/chapters/${id}`),
    'Chapter archived',
    'Failed to archive chapter',
  );
}

export function useCreateTopic() {
  return useCurriculumMutation<{ chapterId: string; name: string; order?: number }>(
    (instituteId, { chapterId, ...dto }) =>
      apiClient.post(`/institutes/${instituteId}/chapters/${chapterId}/topics`, dto),
    'Topic added',
    'Failed to add topic',
  );
}

export function useUpdateTopic() {
  return useCurriculumMutation<{ id: string; name?: string; order?: number }>(
    (instituteId, { id, ...dto }) => apiClient.patch(`/institutes/${instituteId}/topics/${id}`, dto),
    'Topic updated',
    'Failed to update topic',
  );
}

export function useArchiveTopic() {
  return useCurriculumMutation<{ id: string }>(
    (instituteId, { id }) => apiClient.delete(`/institutes/${instituteId}/topics/${id}`),
    'Topic archived',
    'Failed to archive topic',
  );
}


