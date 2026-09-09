import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, aiClient } from '../lib/api-client';
import { useAuth } from '../contexts/auth.context';
import toast from 'react-hot-toast';
import axios from 'axios';

// ── Refresh policy ───────────────────────────────────────────────────────
//
// How fast one user's change must surface on another user's already-open
// screen. There is no push channel (no websockets/SSE), so shared data is
// polled — but only while the tab is actually visible: React Query pauses
// `refetchInterval` timers for hidden tabs, and `refetchOnWindowFocus` (set
// globally in app/providers.tsx) makes returning to the tab refetch at once.
// A dashboard therefore costs a handful of requests per minute while someone
// is looking at it, and nothing at all when they are not.
//
// Local mutations are unaffected: hooks still invalidate their own keys on
// success, so your own actions still update instantly rather than waiting for
// the next tick.

/** Shared worklists two people act on at the same time. */
export const REFRESH_LIVE = {
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
  staleTime: 15_000,
} as const;

/** Rosters, schedules and settings — change occasionally, matter when they do. */
export const REFRESH_STEADY = {
  refetchInterval: 60_000,
  refetchIntervalInBackground: false,
  staleTime: 30_000,
} as const;

/** Expensive derived data (analytics, mastery) — correctness over immediacy. */
export const REFRESH_SLOW = {
  refetchInterval: 5 * 60_000,
  refetchIntervalInBackground: false,
  staleTime: 2 * 60_000,
} as const;

// ── Students ─────────────────────────────────────────────────────────────

export function useStudents(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/students`, { params });
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useStudent(profileId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students', user?.instituteId, profileId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/students/${profileId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!profileId,
  });
}

export function useUpdateStudentTags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, tags }: { profileId: string; tags: string[] }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/students/${profileId}/tags`, { tags });
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Tags updated');
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId, variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update tags';
      toast.error(msg);
    },
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
      queryClient.invalidateQueries({ queryKey: ['students-stats', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to enrol student';
      toast.error(msg);
    },
  });
}

export function useStudentStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students-stats', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/students/stats`);
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useUpdateStudent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, ...data }: { profileId: string; [key: string]: any }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/students/${profileId}`, data);
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Student updated successfully');
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId, variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update student';
      toast.error(msg);
    },
  });
}

export function useArchiveStudent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/students/${profileId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Student archived');
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['students-stats', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to archive student';
      toast.error(msg);
    },
  });
}

export function useTransferStudentBatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, targetBatchId, reason }: { profileId: string; targetBatchId: string; reason?: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/students/${profileId}/transfer`, { targetBatchId, reason });
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Student transferred');
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId, variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ['students', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to transfer student';
      toast.error(msg);
    },
  });
}

// ── Teachers ─────────────────────────────────────────────────────────────

export function useMyTeacherProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teachers', user?.instituteId, 'me'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/teachers/me`);
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId && user?.role === 'TEACHER',
  });
}

export function useMyStudentProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['students', user?.instituteId, 'me'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/students/me`);
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId && user?.role === 'STUDENT',
  });
}

export function useUpdateMyTeacherProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; qualification?: string }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/teachers/me`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId, 'me'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update profile';
      toast.error(msg);
    },
  });
}

export function useTeachers(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teachers', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/teachers`, { params });
      return res.data;
    },
    ...REFRESH_STEADY,
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

export function useTeacher(profileId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teachers', user?.instituteId, profileId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/teachers/${profileId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!profileId,
  });
}

export function useTeacherStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['teachers-stats', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/teachers/stats`);
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useUpdateTeacher() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, ...data }: { profileId: string; [key: string]: any }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/teachers/${profileId}`, data);
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Teacher updated successfully');
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId, variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update teacher';
      toast.error(msg);
    },
  });
}

export function useArchiveTeacher() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/teachers/${profileId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Teacher archived');
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['teachers-stats', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to archive teacher';
      toast.error(msg);
    },
  });
}

export function useAssignTeacherToBatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, batchId, subjectId }: { profileId: string; batchId: string; subjectId?: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/teachers/${profileId}/batches`, { batchId, subjectId });
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Teacher assigned to batch');
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId, variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to assign teacher to batch';
      toast.error(msg);
    },
  });
}

export function useRemoveTeacherFromBatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ profileId, batchTeacherId }: { profileId: string; batchTeacherId: string }) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/teachers/${profileId}/batches/${batchTeacherId}`);
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Removed from batch');
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId, variables.profileId] });
      queryClient.invalidateQueries({ queryKey: ['teachers', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to remove from batch';
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
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useBatch(batchId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['batches', user?.instituteId, batchId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/batches/${batchId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!batchId,
  });
}

export function useBatchPerformance(batchId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['batches', user?.instituteId, batchId, 'performance'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/batches/${batchId}/performance`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!batchId,
  });
}

export function useWeakStudentsForTopic(batchId: string | null, topicId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['batches', user?.instituteId, batchId, 'topics', topicId, 'weak-students'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/batches/${batchId}/topics/${topicId}/weak-students`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!batchId && !!topicId,
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

export function useUpdateBatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ batchId, ...data }: { batchId: string; [key: string]: any }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/batches/${batchId}`, data);
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Batch updated successfully');
      queryClient.invalidateQueries({ queryKey: ['batches', user?.instituteId, variables.batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update batch';
      toast.error(msg);
    },
  });
}

export function useArchiveBatch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/batches/${batchId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Batch archived');
      queryClient.invalidateQueries({ queryKey: ['batches', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['batches-stats', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to archive batch';
      toast.error(msg);
    },
  });
}

export function useBatchStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['batches-stats', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/batches/stats`);
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
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

// ── Rubrics (26-RUBRIC-EVALUATION-SPECIFICATION.md, Phase 9) ────────────────

export function useRubric(questionId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['rubric', user?.instituteId, questionId],
    queryFn: async () => {
      try {
        const res = await apiClient.get(`/institutes/${user?.instituteId}/questions/${questionId}/rubric`);
        return res.data;
      } catch (error) {
        // A question with no rubric yet is the common case, not an error —
        // let the UI render "no rubric authored" instead of an error toast.
        if (axios.isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
    enabled: !!user?.instituteId && !!questionId,
  });
}

export function useCreateRubric() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ questionId, ...data }: { questionId: string } & Record<string, unknown>) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/questions/${questionId}/rubric`, data);
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Rubric attached');
      queryClient.invalidateQueries({ queryKey: ['rubric', user?.instituteId, variables.questionId] });
      queryClient.invalidateQueries({ queryKey: ['questions', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message : 'Failed to attach rubric';
      toast.error(msg ?? 'Failed to attach rubric');
    },
  });
}

export function useUpdateRubric() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rubricId, questionId, ...data }: { rubricId: string; questionId: string } & Record<string, unknown>) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/rubrics/${rubricId}`, data);
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Rubric updated — a new version was created');
      queryClient.invalidateQueries({ queryKey: ['rubric', user?.instituteId, variables.questionId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message : 'Failed to update rubric';
      toast.error(msg ?? 'Failed to update rubric');
    },
  });
}

// ── Evaluations (25-EVALUATION-ENGINE.md, Phase 12 — manual-only) ───────────

export function useEvaluationWorkItems(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['evaluation-work-items', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/evaluation-work-items`, { params });
      return res.data;
    },
    ...REFRESH_LIVE,
    enabled: !!user?.instituteId,
  });
}

export function useOverrideEvaluation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ responseId, ...data }: { responseId: string } & Record<string, unknown>) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/evaluations/${responseId}/override`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Evaluation overridden');
      queryClient.invalidateQueries({ queryKey: ['evaluation-work-items', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message : 'Failed to override evaluation';
      toast.error(
        axios.isAxiosError(error) && error.response?.status === 403
          ? "You don't have the REVIEW_EVALUATION permission for this batch/subject — ask an Admin to grant it."
          : msg ?? 'Failed to override evaluation',
      );
    },
  });
}

export function useDecideEvaluation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ responseId, ...data }: { responseId: string } & Record<string, unknown>) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/evaluations/${responseId}/decide`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Evaluation recorded');
      queryClient.invalidateQueries({ queryKey: ['evaluation-work-items', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message : 'Failed to record evaluation';
      toast.error(msg ?? 'Failed to record evaluation');
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
    ...REFRESH_STEADY,
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

export function usePapers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['papers', user?.instituteId, 'list'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/papers`);
      return res.data as { id: string; title: string; status: string; isPersonalized: boolean; createdAt: string }[];
    },
    enabled: !!user?.instituteId,
  });
}

export function usePaper(paperId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['papers', user?.instituteId, paperId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/papers/${paperId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!paperId,
  });
}

export function useCreateAnswerSheet() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ examId, studentProfileId }: { examId: string; studentProfileId: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/exams/${examId}/answer-sheets/${studentProfileId}`);
      return res.data as { id: string };
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to start grading for this student';
      toast.error(msg);
    },
  });
}

export function useGradeAnswerSheet() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ answerSheetId, responses }: { answerSheetId: string; responses: { questionId: string; marksAwarded: number; isCorrect?: boolean }[] }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/exams/answer-sheets/${answerSheetId}/grade`, { responses });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Grades saved');
      queryClient.invalidateQueries({ queryKey: ['exams', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to save grades';
      toast.error(msg);
    },
  });
}

export function useLinkPaperToExam() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ examId, paperId }: { examId: string; paperId: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/exams/${examId}/link-paper/${paperId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to link paper to exam';
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
    ...REFRESH_SLOW,
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
    ...REFRESH_SLOW,
    enabled: !!batchId,
  });
}

// 31-EVALUATION-AUDIT-VERSIONING.md §3 / 05-API-SPECIFICATION.md (V2 section) §9, Phase 14.
export function useEvaluationQuality(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['analytics', 'evaluation-quality', params],
    queryFn: async () => {
      const res = await aiClient.get('/analytics/evaluation-quality', { params });
      return res.data;
    },
    ...REFRESH_SLOW,
  });
}

// ── Attendance ───────────────────────────────────────────────────────────

export function useAttendanceRecords(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['attendance', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/attendance`, { params });
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useAttendanceSummary(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['attendance-summary', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/attendance/summary`, { params });
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useMarkAttendance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { batchId: string; date: string; entries: { studentProfileId: string; status: string }[] }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/attendance`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Attendance marked');
      queryClient.invalidateQueries({ queryKey: ['attendance', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to mark attendance';
      toast.error(msg);
    },
  });
}

export function useCorrectAttendance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recordId, status, reason }: { recordId: string; status: string; reason: string }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/attendance/${recordId}`, { status, reason });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Attendance record corrected');
      queryClient.invalidateQueries({ queryKey: ['attendance', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to correct attendance record';
      toast.error(msg);
    },
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
    ...REFRESH_LIVE,
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

export function useCreateDoubt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ studentProfileId, data }: { studentProfileId: string; data: { subjectId: string; topicId?: string; urgency?: number; content: string } }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/students/${studentProfileId}/doubts`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Your doubt was sent to your teacher');
      queryClient.invalidateQueries({ queryKey: ['doubts', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to submit doubt';
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
    ...REFRESH_LIVE,
    enabled: !!user?.instituteId,
  });
}

export function useCreateAssignment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/assignments`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Assignment created successfully');
      queryClient.invalidateQueries({ queryKey: ['assignments', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to create assignment';
      toast.error(msg);
    },
  });
}

export function useSubmitAssignment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, file }: { assignmentId: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      const res = await apiClient.post(`/institutes/${user?.instituteId}/assignments/${assignmentId}/submit`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Assignment submitted');
      queryClient.invalidateQueries({ queryKey: ['assignments', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to submit assignment';
      toast.error(msg);
    },
  });
}

export function useAssignmentSubmissionUrl(assignmentId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assignments', user?.instituteId, assignmentId, 'submission-url'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/assignments/${assignmentId}/submission-url`);
      return res.data as { url: string | null };
    },
    enabled: !!user?.instituteId && !!assignmentId,
  });
}

export function useGradeAssignment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ assignmentId, gradedMarks }: { assignmentId: string; gradedMarks: number }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/assignments/${assignmentId}/grade`, { gradedMarks });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Grade saved');
      queryClient.invalidateQueries({ queryKey: ['assignments', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to save grade';
      toast.error(msg);
    },
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
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId,
  });
}

export function useCreateTimetableSlot() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/timetable`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Slot scheduled successfully');
      queryClient.invalidateQueries({ queryKey: ['timetable', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to schedule slot';
      toast.error(msg);
    },
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
    ...REFRESH_LIVE,
    enabled: !!user?.instituteId,
  });
}

export function useExamResults(examId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['exams', user?.instituteId, examId, 'results'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/exams/${examId}/results`);
      return res.data;
    },
    ...REFRESH_STEADY,
    enabled: !!user?.instituteId && !!examId,
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

// ── Notices ──────────────────────────────────────────────────────────────

export function useNotices(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notices', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/notices`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useNoticeDeliveryReport(noticeId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notices', user?.instituteId, noticeId, 'delivery-report'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/notices/${noticeId}/delivery-report`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!noticeId,
  });
}

export function useCreateNotice() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/notices`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Notice broadcast queued');
      queryClient.invalidateQueries({ queryKey: ['notices', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to broadcast notice';
      toast.error(msg);
    },
  });
}

// ── Reports ──────────────────────────────────────────────────────────────

export function useReportsList(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reports', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/reports`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useReport(reportId: string | null, opts?: { poll?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reports', user?.instituteId, reportId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/reports/${reportId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!reportId,
    refetchInterval: (query) => {
      if (!opts?.poll) return false;
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status === 'QUEUED' || status === 'PROCESSING' ? 2000 : false;
    },
  });
}

export function useRequestReport() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/reports`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Report queued for generation');
      queryClient.invalidateQueries({ queryKey: ['reports', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to request report';
      toast.error(msg);
    },
  });
}

// ── Audit Logs ───────────────────────────────────────────────────────────

export function useAuditLogs(params?: Record<string, unknown>) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['audit-logs', user?.instituteId, params],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/audit-logs`, { params });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

// ── Institute Profile & Allow-list (Admin Settings) ─────────────────────────

export function useInstitute() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['institute', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useUpdateInstitute() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name?: string; address?: string; phone?: string; domainAllowlist?: string[] }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Institute profile updated');
      queryClient.invalidateQueries({ queryKey: ['institute', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update institute profile';
      toast.error(msg);
    },
  });
}

export function useAllowList() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['allow-list', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/allow-list`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useAddAllowListEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/allow-list`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Added to allow-list');
      queryClient.invalidateQueries({ queryKey: ['allow-list', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to add allow-list entry';
      toast.error(msg);
    },
  });
}

export function useRemoveAllowListEntry() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/allow-list/${entryId}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Removed from allow-list');
      queryClient.invalidateQueries({ queryKey: ['allow-list', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to remove allow-list entry';
      toast.error(msg);
    },
  });
}

// ── Digital Answer Sheets: v2 Assessments/Deliveries ───────────────────────
// (separate domain from Blueprints/Papers/Exams above — DocumentBundle
// attaches to an AssessmentDelivery, never a v1 Exam.)

export function useAssessments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assessments', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/assessments`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreateAssessment() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/assessments`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Assessment created');
      queryClient.invalidateQueries({ queryKey: ['assessments', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to create assessment';
      toast.error(msg);
    },
  });
}

export function useAssessment(assessmentId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assessments', user?.instituteId, assessmentId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/assessments/${assessmentId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!assessmentId,
  });
}

export function useAssessmentDelivery(deliveryId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['assessment-deliveries', user?.instituteId, deliveryId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/assessment-deliveries/${deliveryId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!deliveryId,
  });
}

export function useCreateAssessmentDelivery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assessmentId, ...data }: { assessmentId: string } & Record<string, unknown>) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/assessments/${assessmentId}/deliveries`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Delivery scheduled');
      queryClient.invalidateQueries({ queryKey: ['assessments', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to schedule delivery';
      toast.error(msg);
    },
  });
}

export function useUpdateAssessmentDeliveryStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deliveryId, status, version }: { deliveryId: string; status: string; version: number }) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/assessment-deliveries/${deliveryId}/status`, { status, version });
      return res.data;
    },
    onSuccess: (_result, variables) => {
      toast.success('Delivery moved to the next stage');
      queryClient.invalidateQueries({ queryKey: ['assessment-deliveries', user?.instituteId, variables.deliveryId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update delivery status';
      toast.error(msg);
    },
  });
}

export function useCreateAttempt() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      assessmentDeliveryId: string;
      studentProfileId: string;
      captureProviderId: string;
      responses: { questionId: string; marksAwarded: number; isCorrect?: boolean }[];
    }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/attempts`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Attempt recorded');
      queryClient.invalidateQueries({ queryKey: ['assessment-deliveries', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to record attempt';
      toast.error(msg);
    },
  });
}

export function useCaptureProviders() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['capture-providers', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/capture-providers`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useEvaluationPolicies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['evaluation-policies', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/evaluation-policies`);
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

// ── Digital Answer Sheets: Documents / Pages / Regions ─────────────────────

export function useCreateDocumentBundle() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { assessmentDeliveryId: string; expectedDocumentCount?: number }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/document-bundles`, data);
      return res.data;
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to create document bundle';
      toast.error(msg);
    },
  });
}

export function useUploadDocument() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ bundleId, files }: { bundleId: string; files: File[] }) => {
      const form = new FormData();
      files.forEach((f) => form.append('files', f));
      const res = await apiClient.post(`/institutes/${user?.instituteId}/document-bundles/${bundleId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': crypto.randomUUID() },
      });
      return res.data;
    },
    onSuccess: (_r, variables) => {
      toast.success('Booklet uploaded — processing pipeline queued');
      queryClient.invalidateQueries({ queryKey: ['identity-resolutions', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['document-bundles', user?.instituteId, variables.bundleId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to upload booklet pages';
      toast.error(msg);
    },
  });
}

export function useDocumentsForBundle(bundleId: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['document-bundles', user?.instituteId, bundleId, 'documents'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/document-bundles/${bundleId}/documents`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!bundleId,
    refetchInterval: 5000, // cheap poll — pipeline stages advance only from teacher actions, but a second tab might be doing them
  });
}

export function useDocument(documentId: string | null, opts?: { poll?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['documents', user?.instituteId, documentId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/documents/${documentId}`);
      return res.data;
    },
    enabled: !!user?.instituteId && !!documentId,
    refetchInterval: (query) => {
      if (!opts?.poll) return false;
      const status = (query.state.data as { status?: string } | undefined)?.status;
      return status && status !== 'READY_FOR_EVALUATION' && status !== 'FAILED' ? 3000 : false;
    },
  });
}

export function usePageImageUrl(documentId: string | null, pageId: string | null, raw?: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['documents', user?.instituteId, documentId, 'pages', pageId, 'image', raw ?? false],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/documents/${documentId}/pages/${pageId}/image`, { params: raw ? { raw: true } : undefined });
      return res.data;
    },
    enabled: !!user?.instituteId && !!documentId && !!pageId,
  });
}

export function useReprocessDocument() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId, fromStage }: { documentId: string; fromStage: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/documents/${documentId}/reprocess`, { fromStage });
      return res.data;
    },
    onSuccess: (_r, variables) => {
      toast.success('Reprocessing queued');
      queryClient.invalidateQueries({ queryKey: ['documents', user?.instituteId, variables.documentId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to queue reprocessing';
      toast.error(msg);
    },
  });
}

export function useCreatePageRegion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pageImageId, documentId, ...data }: { pageImageId: string; documentId: string } & Record<string, unknown>) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/page-images/${pageImageId}/regions`, data);
      return res.data;
    },
    onSuccess: (_r, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', user?.instituteId, variables.documentId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to save region';
      toast.error(msg);
    },
  });
}

export function useUpdatePageRegion() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ regionId, documentId, ...data }: { regionId: string; documentId: string } & Record<string, unknown>) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/page-regions/${regionId}`, data);
      return res.data;
    },
    onSuccess: (_r, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', user?.instituteId, variables.documentId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to update region';
      toast.error(msg);
    },
  });
}

// ── Digital Answer Sheets: Identity Resolution ──────────────────────────────

export function useIdentityResolutions(status?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['identity-resolutions', user?.instituteId, status],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/identity-resolutions`, { params: status ? { status } : undefined });
      return res.data;
    },
    enabled: !!user?.instituteId,
  });
}

export function useConfirmIdentity() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ resolutionId, studentProfileId }: { resolutionId: string; studentProfileId: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/identity-resolutions/${resolutionId}/confirm`, { studentProfileId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Identity confirmed');
      queryClient.invalidateQueries({ queryKey: ['identity-resolutions', user?.instituteId] });
      queryClient.invalidateQueries({ queryKey: ['documents', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to confirm identity';
      toast.error(msg);
    },
  });
}

// ── Digital Answer Sheets: OCR ───────────────────────────────────────────────

export function useTriggerOcr() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentId }: { documentId: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/documents/${documentId}/ocr`);
      return res.data;
    },
    onSuccess: (result: { enqueuedCount: number; totalRegions: number }, variables) => {
      toast.success(`OCR queued for ${result.enqueuedCount} of ${result.totalRegions} region(s)`);
      queryClient.invalidateQueries({ queryKey: ['documents', user?.instituteId, variables.documentId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.message : 'Failed to trigger OCR';
      toast.error(msg);
    },
  });
}

// ── Founder ──────────────────────────────────────────────────────────────

export function useMyPermissionGrants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['permission-grants', user?.instituteId, 'mine'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/permission-grants/mine`);
      return res.data as { bypassesAllGrants: boolean; grants: { permission: string; batchId: string | null; subjectId: string | null }[] };
    },
    enabled: !!user?.instituteId,
  });
}

/** Mirrors PermissionsService.hasPermission()'s scope-matching exactly — a
 * grant with a null batchId/subjectId covers every value for that field. */
export function hasScopedPermission(
  data: { bypassesAllGrants: boolean; grants: { permission: string; batchId: string | null; subjectId: string | null }[] } | undefined,
  permission: string,
  scope: { batchId?: string; subjectId?: string },
): boolean {
  if (!data) return false;
  if (data.bypassesAllGrants) return true;
  return data.grants.some((g) =>
    g.permission === permission &&
    (g.batchId === null || g.batchId === scope.batchId) &&
    (g.subjectId === null || g.subjectId === scope.subjectId),
  );
}

export function usePermissionGrants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['permission-grants', user?.instituteId],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/permission-grants`);
      return res.data as { id: string; userId: string; permission: string; batchId: string | null; subjectId: string | null; createdAt: string; user: { name: string; email: string } }[];
    },
    enabled: !!user?.instituteId,
  });
}

export function useCreatePermissionGrant() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; permission: string; batchId?: string; subjectId?: string }) => {
      const res = await apiClient.post(`/institutes/${user?.instituteId}/permission-grants`, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Permission granted');
      queryClient.invalidateQueries({ queryKey: ['permission-grants', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to grant permission';
      toast.error(msg);
    },
  });
}

export function useCreateInstitute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; domainAllowlist: string[]; plan?: string; address?: string }) => {
      const res = await apiClient.post('/institutes', data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Institute created');
      queryClient.invalidateQueries({ queryKey: ['founder', 'institutes'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to create institute';
      toast.error(msg);
    },
  });
}

export function useFounderInstitutes(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['founder', 'institutes', params],
    queryFn: async () => {
      const res = await apiClient.get('/founder/institutes', { params });
      return res.data;
    },
    throwOnError: false,
  });
}

export function useFounderHealth() {
  return useQuery({
    queryKey: ['founder', 'health'],
    queryFn: async () => {
      const res = await apiClient.get('/founder/health');
      return res.data;
    },
    refetchInterval: 30_000,
    throwOnError: false,
  });
}

export function useFounderSettings() {
  return useQuery({
    queryKey: ['founder', 'settings'],
    queryFn: async () => {
      const res = await apiClient.get('/founder/settings');
      return res.data as Record<string, boolean>;
    },
    throwOnError: false,
  });
}

export function useUpdateFounderSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Record<string, boolean>) => {
      const res = await apiClient.patch('/founder/settings', { patch });
      return res.data as Record<string, boolean>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['founder', 'settings'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to save settings';
      toast.error(msg);
    },
  });
}

// ── Notifications (recipient inbox) ─────────────────────────────────────────

export function useMyNotifications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['notices', user?.instituteId, 'mine'],
    queryFn: async () => {
      const res = await apiClient.get(`/institutes/${user?.instituteId}/notices/mine`);
      return res.data as {
        data: { id: string; readAt: string | null; sentAt: string | null; notice: { id: string; title: string; body: string; createdAt: string } }[];
        unreadCount: number;
      };
    },
    enabled: !!user?.instituteId,
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (deliveryId: string) => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/notices/mine/${deliveryId}/read`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices', user?.instituteId, 'mine'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch(`/institutes/${user?.instituteId}/notices/mine/read-all`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notices', user?.instituteId, 'mine'] });
    },
  });
}

export function useFounderQueueMetrics() {
  return useQuery({
    queryKey: ['founder', 'health', 'queues'],
    queryFn: async () => {
      const res = await apiClient.get('/founder/health/queues');
      return res.data;
    },
    refetchInterval: 30_000,
    throwOnError: false,
  });
}

export function useFounderTickets(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['founder', 'support-tickets', params],
    queryFn: async () => {
      const res = await apiClient.get('/founder/support-tickets', { params });
      return res.data;
    },
    throwOnError: false,
  });
}

export function useFounderTicketDetail(ticketId: string | null) {
  return useQuery({
    queryKey: ['founder', 'support-tickets', ticketId],
    queryFn: async () => {
      const res = await apiClient.get(`/founder/support-tickets/${ticketId}`);
      return res.data;
    },
    enabled: !!ticketId,
    throwOnError: false,
  });
}

export function useUpdateTicketStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiClient.patch(`/founder/support-tickets/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ticket status updated');
      queryClient.invalidateQueries({ queryKey: ['founder', 'support-tickets'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update status';
      toast.error(msg);
    },
  });
}

export function useUpdateTicketPriority() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, priority }: { id: string; priority: string }) => {
      const res = await apiClient.patch(`/founder/support-tickets/${id}/priority`, { priority });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Priority updated');
      queryClient.invalidateQueries({ queryKey: ['founder', 'support-tickets'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update priority';
      toast.error(msg);
    },
  });
}

export function useAssignTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignedToUserId }: { id: string; assignedToUserId: string }) => {
      const res = await apiClient.patch(`/founder/support-tickets/${id}/assign`, { assignedToUserId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Ticket assigned');
      queryClient.invalidateQueries({ queryKey: ['founder', 'support-tickets'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to assign ticket';
      toast.error(msg);
    },
  });
}

export function useReplyOnTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const res = await apiClient.post(`/founder/support-tickets/${id}/messages`, { body });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Reply sent');
      queryClient.invalidateQueries({ queryKey: ['founder', 'support-tickets'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to send reply';
      toast.error(msg);
    },
  });
}

export function useFounderIntegrations() {
  return useQuery({
    queryKey: ['founder', 'integrations'],
    queryFn: async () => {
      const res = await apiClient.get('/founder/integrations');
      return res.data;
    },
    throwOnError: false,
  });
}

export function useFounderAuditLogs(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['founder', 'audit-logs', params],
    queryFn: async () => {
      const res = await apiClient.get('/founder/audit-logs', { params });
      return res.data;
    },
    throwOnError: false,
  });
}

export function useUpdateInstitutePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ instituteId, plan }: { instituteId: string; plan: string }) => {
      const res = await apiClient.patch(`/founder/institutes/${instituteId}/plan`, { plan });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Plan updated');
      queryClient.invalidateQueries({ queryKey: ['founder', 'institutes'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update plan';
      toast.error(msg);
    },
  });
}

export function useArchiveInstitute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (instituteId: string) => {
      const res = await apiClient.post(`/founder/institutes/${instituteId}/archive`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Institute archived');
      queryClient.invalidateQueries({ queryKey: ['founder', 'institutes'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to archive institute';
      toast.error(msg);
    },
  });
}

export function useSuspendInstitute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (instituteId: string) => {
      const res = await apiClient.patch(`/founder/institutes/${instituteId}/suspend`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Institute suspended — access is blocked immediately');
      queryClient.invalidateQueries({ queryKey: ['founder', 'institutes'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to suspend institute';
      toast.error(msg);
    },
  });
}

export function useReactivateInstitute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (instituteId: string) => {
      const res = await apiClient.patch(`/founder/institutes/${instituteId}/reactivate`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Institute reactivated');
      queryClient.invalidateQueries({ queryKey: ['founder', 'institutes'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to reactivate institute';
      toast.error(msg);
    },
  });
}

export function useFounderUsers(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: ['founder', 'users', params],
    queryFn: async () => {
      const res = await apiClient.get('/founder/users', { params });
      return res.data;
    },
    throwOnError: false,
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const res = await apiClient.patch(`/users/${userId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['founder', 'users'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update user status';
      toast.error(msg);
    },
  });
}

export function useForceLogoutUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiClient.patch(`/users/${userId}/force-logout`);
      return res.data;
    },
    onSuccess: (data: { message: string }) => {
      toast.success(data.message ?? 'User signed out of every session');
      queryClient.invalidateQueries({ queryKey: ['founder', 'users'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to force logout';
      toast.error(msg);
    },
  });
}

export function useLogoutAllMyDevices() {
  const { logout } = useAuth();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.patch('/users/me/logout-all-devices');
      return res.data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Signed out of every device');
      // This request just invalidated the token used to make it — clear the
      // local session and redirect, same as a normal logout.
      logout();
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to sign out of other devices';
      toast.error(msg);
    },
  });
}

export function useFounderAnalyticsOverview() {
  return useQuery({
    queryKey: ['founder', 'analytics', 'overview'],
    queryFn: async () => {
      const res = await apiClient.get('/founder/analytics/overview');
      return res.data;
    },
    throwOnError: false,
  });
}

export function useFounderPlans() {
  return useQuery({
    queryKey: ['founder', 'plans'],
    queryFn: async () => {
      const res = await apiClient.get('/founder/plans');
      return res.data;
    },
    throwOnError: false,
  });
}

export function useUpdatePlanDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ plan, ...dto }: { plan: string; maxUsers?: number; maxStudents?: number; maxTeachers?: number; maxStorageGb?: number; maxAssessmentsPerMonth?: number; trialDurationDays?: number }) => {
      const res = await apiClient.patch(`/founder/plans/${plan}`, dto);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Plan limits updated');
      queryClient.invalidateQueries({ queryKey: ['founder', 'plans'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update plan limits';
      toast.error(msg);
    },
  });
}

export function useFounderPlanHistory(instituteId: string | null) {
  return useQuery({
    queryKey: ['founder', 'institutes', instituteId, 'plan-history'],
    queryFn: async () => {
      const res = await apiClient.get(`/founder/institutes/${instituteId}/plan-history`);
      return res.data;
    },
    enabled: !!instituteId,
    throwOnError: false,
  });
}

export function useFounderUsage(instituteId: string | null) {
  return useQuery({
    queryKey: ['founder', 'institutes', instituteId, 'usage'],
    queryFn: async () => {
      const res = await apiClient.get(`/founder/institutes/${instituteId}/usage`);
      return res.data;
    },
    enabled: !!instituteId,
    throwOnError: false,
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ instituteId, flag, enabled }: { instituteId: string; flag: string; enabled: boolean }) => {
      const res = await apiClient.patch('/founder/feature-flags', { instituteId, flag, enabled });
      return res.data;
    },
    onSuccess: (_data, variables) => {
      toast.success(`${variables.flag} ${variables.enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['founder', 'institutes'] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error) ? error.response?.data?.error?.message ?? error.response?.data?.message : 'Failed to update feature flag';
      toast.error(msg);
    },
  });
}

export function useFounderInstituteDetail(instituteId: string | null) {
  return useQuery({
    queryKey: ['founder', 'institutes', instituteId, 'detail'],
    queryFn: async () => {
      const res = await apiClient.get(`/founder/institutes/${instituteId}`);
      return res.data;
    },
    enabled: !!instituteId,
    throwOnError: false,
  });
}


