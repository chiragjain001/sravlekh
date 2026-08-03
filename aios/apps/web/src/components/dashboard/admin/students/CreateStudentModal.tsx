'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateStudent } from '@/hooks/useApi';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const createStudentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  rollNumber: z.string().optional(),
  batchId: z.string().optional(),
});

type CreateStudentForm = z.infer<typeof createStudentSchema>;

export function CreateStudentModal({
  isOpen,
  onClose,
  batches,
}: {
  isOpen: boolean;
  onClose: () => void;
  batches: any[];
}) {
  const { mutate: createStudent, isPending } = useCreateStudent();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStudentForm>({
    resolver: zodResolver(createStudentSchema),
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = (data: CreateStudentForm) => {
    // Convert empty strings to undefined to match API expectations
    const payload = {
      ...data,
      rollNumber: data.rollNumber || undefined,
      batchId: data.batchId || undefined,
    };
    
    createStudent(payload, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-modal shadow-modal w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-navy-900">Enrol New Student</h2>
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
              placeholder="e.g. Aditya Sharma"
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
              placeholder="student@institute.com"
              disabled={isPending}
            />
            {errors.email && <p className="error-text">{errors.email.message}</p>}
            <p className="helper-text">They will use this email to sign in via Google.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Roll Number</label>
              <input
                {...register('rollNumber')}
                className="input"
                placeholder="Optional"
                disabled={isPending}
              />
            </div>
            <div>
              <label className="label">Assign Batch</label>
              <select {...register('batchId')} className="input" disabled={isPending}>
                <option value="">Unassigned</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
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
              {isPending ? 'Enrolling...' : 'Enrol Student'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
