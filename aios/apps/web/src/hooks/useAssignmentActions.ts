import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/auth.context';
import { apiClient } from '@/lib/api-client';

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

export function useDeleteAssignmentSubmission() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const res = await apiClient.delete(`/institutes/${user?.instituteId}/assignments/${assignmentId}/submission`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Submission retracted successfully');
      queryClient.invalidateQueries({ queryKey: ['assignments', user?.instituteId] });
    },
    onError: (error) => {
      const msg = axios.isAxiosError(error)
        ? error.response?.data?.error?.message ?? error.response?.data?.message
        : 'Failed to retract submission';
      toast.error(msg);
    },
  });
}

