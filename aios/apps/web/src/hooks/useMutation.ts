'use client';

// ─── useBeforeUnload ──────────────────────────────────────────────────────────
// Warns users before leaving a page/closing a tab with unsaved changes.
// Used in all multi-step wizards (Assignment Creator, Paper Builder).
//
// Usage:
//   useBeforeUnload(isDirty); // isDirty = any unsaved changes exist

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useBeforeUnload(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Modern browsers show a generic message; custom message is ignored
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

// ─── useOptimisticMutation ─────────────────────────────────────────────────────
// Standard optimistic update wrapper with rollback on error.
// Emits events on success. Shows toast notifications.
//
// Usage:
//   const { mutate, isPending } = useOptimisticMutation({
//     queryKey: queryKeys.assignments(ctx),
//     mutationFn: (data) => api.post('/assignments', data),
//     optimisticItem: (data) => ({ ...data, id: `temp-${Date.now()}`, status: 'creating' }),
//     onSuccessEvent: 'ASSIGNMENT_CREATED',
//     onSuccessPayload: (result) => ({ assignmentId: result.id, batchId: ctx.batchId! }),
//     successMessage: 'Assignment created successfully',
//   });

import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { eventBus } from '@/lib/event-bus';
import type { AiosEvent, EventPayload } from '@/lib/event-bus';

interface OptimisticMutationConfig<TData, TInput, TEvent extends AiosEvent = AiosEvent> {
  mutationFn:          (input: TInput) => Promise<TData>;
  queryKey:            readonly unknown[];
  invalidateKeys?:     readonly unknown[][];   // Additional keys to invalidate on success
  optimisticItem?:     (input: TInput) => Partial<TData>;
  onSuccessEvent?:     TEvent;
  onSuccessPayload?:   (result: TData, input: TInput) => EventPayload<TEvent>;
  successMessage?:     string;
  errorMessage?:       string;
  onSuccess?:          (result: TData, input: TInput) => void;
  onError?:            (error: unknown) => void;
}

export function useOptimisticMutation<TData, TInput, TEvent extends AiosEvent = AiosEvent>({
  mutationFn,
  queryKey,
  invalidateKeys = [],
  optimisticItem,
  onSuccessEvent,
  onSuccessPayload,
  successMessage,
  errorMessage,
  onSuccess,
  onError,
}: OptimisticMutationConfig<TData, TInput, TEvent>) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TInput, { previous: TData[] | undefined }>({
    mutationFn,

    onMutate: async (input) => {
      if (!optimisticItem) return { previous: undefined };

      // Cancel in-flight queries to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<TData[]>(queryKey);

      // Apply optimistic update
      queryClient.setQueryData<TData[]>(queryKey, (old = []) => [
        optimisticItem(input) as TData,
        ...old,
      ]);

      return { previous };
    },

    onSuccess: (result, input) => {
      // Invalidate primary + additional query keys
      queryClient.invalidateQueries({ queryKey });
      invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

      // Emit event for dashboards, analytics, notifications to update
      if (onSuccessEvent && onSuccessPayload) {
        eventBus.emit(onSuccessEvent, onSuccessPayload(result, input));
      }

      if (successMessage) {
        toast.success(successMessage);
      }

      onSuccess?.(result, input);
    },

    onError: (error, _, context) => {
      // Rollback optimistic update
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }

      const message = errorMessage ?? 'Something went wrong. Please try again.';
      toast.error(message);
      onError?.(error);
    },
  });
}

// ─── useDebounce ──────────────────────────────────────────────────────────────
import { useState, useEffect as useEff } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEff(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
