'use client';
// ─── Communication Module: Custom Data Hooks ─────────────────────────────────

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAnnouncementsList,
  getCommunicationAnalytics,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  resendAnnouncement,
} from '../services/communication.service';
import type {
  GetAnnouncementsParams,
  CreateAnnouncementInput,
  UpdateAnnouncementInput,
} from '../types/communication.types';

export const communicationQueryKeys = {
  all:           ['communication'] as const,
  announcements: (params: GetAnnouncementsParams) => ['communication', 'announcements', params] as const,
  analytics:     ()                                => ['communication', 'analytics'] as const,
};

export function useAnnouncementsList(params: GetAnnouncementsParams) {
  return useQuery({
    queryKey:        communicationQueryKeys.announcements(params),
    queryFn:         () => getAnnouncementsList(params),
    placeholderData: (prev) => prev,
    staleTime:       30_000,
  });
}

export function useCommunicationAnalytics() {
  return useQuery({
    queryKey:  communicationQueryKeys.analytics(),
    queryFn:   getCommunicationAnalytics,
    staleTime: 120_000,
  });
}

export function useCreateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAnnouncementInput) => createAnnouncement(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communicationQueryKeys.all });
    },
  });
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAnnouncementInput) => updateAnnouncement(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communicationQueryKeys.all });
    },
  });
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communicationQueryKeys.all });
    },
  });
}

export function useResendAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => resendAnnouncement(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: communicationQueryKeys.all });
    },
  });
}
