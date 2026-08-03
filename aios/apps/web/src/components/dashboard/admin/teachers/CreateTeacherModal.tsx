'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateTeacher } from '@/hooks/useApi';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const createTeacherSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  qualification: z.string().optional(),
});

type CreateTeacherForm = z.infer<typeof createTeacherSchema>;

export function CreateTeacherModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { mutate: createTeacher, isPending } = useCreateTeacher();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTeacherForm>({
    resolver: zodResolver(createTeacherSchema),
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = (data: CreateTeacherForm) => {
    createTeacher(data, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-modal shadow-modal w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-navy-900">Add New Teacher</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div>
            <label className="label">Full Name <span className="text-error">*</span></label>
            <input
              {...register('name')}
              className={`input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Dr. Priya Mehta"
              disabled={isPending}
            />
            {errors.name && <p className="error-text">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Email Address <span className="text-error">*</span></label>
            <input
              {...register('email')}
              type="email"
              className={`input ${errors.email ? 'input-error' : ''}`}
              placeholder="teacher@institute.com"
              disabled={isPending}
            />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Qualification</label>
            <input
              {...register('qualification')}
              className="input"
              placeholder="e.g. M.Sc Physics, IIT Bombay"
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
              {isPending ? 'Adding...' : 'Add Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
