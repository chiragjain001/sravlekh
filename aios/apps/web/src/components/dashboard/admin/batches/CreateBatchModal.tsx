'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateBatch } from '@/hooks/useApi';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const createBatchSchema = z.object({
  name: z.string().min(2, 'Batch name must be at least 2 characters').max(100),
  classYear: z.string().optional(),
  section: z.string().optional(),
  academicYear: z.string().optional(),
});

type CreateBatchForm = z.infer<typeof createBatchSchema>;

export function CreateBatchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { mutate: createBatch, isPending } = useCreateBatch();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBatchForm>({
    resolver: zodResolver(createBatchSchema),
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = (data: CreateBatchForm) => {
    createBatch(data, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-modal shadow-modal w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-navy-900">Create New Batch</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="label">Batch Name <span className="text-error">*</span></label>
            <input
              {...register('name')}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. JEE Advanced 2026 - Batch A"
              disabled={isPending}
            />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Class / Year</label>
              <input
                {...register('classYear')}
                className="input"
                placeholder="e.g. Class 11"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="label">Section</label>
              <input
                {...register('section')}
                className="input"
                placeholder="e.g. A"
                disabled={isPending}
              />
            </div>
          </div>

          <div>
            <label className="label">Academic Year</label>
            <input
              {...register('academicYear')}
              className="input"
              placeholder="e.g. 2025-2026"
              disabled={isPending}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border mt-6">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isPending}
            >
              {isPending ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
