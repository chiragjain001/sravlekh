'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGeneratePaper } from '@/hooks/useApi';
import { X, Bot } from 'lucide-react';
import { useEffect } from 'react';

const generatePaperSchema = z.object({
  title: z.string().min(2, 'Title is required'),
  targetBatchId: z.string().optional(),
  targetStudentId: z.string().optional(),
});

type GeneratePaperForm = z.infer<typeof generatePaperSchema>;

export function GeneratePaperModal({
  isOpen,
  onClose,
  blueprint,
}: {
  isOpen: boolean;
  onClose: () => void;
  blueprint: any;
}) {
  const { mutate: generatePaper, isPending } = useGeneratePaper();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GeneratePaperForm>({
    resolver: zodResolver(generatePaperSchema),
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = (data: GeneratePaperForm) => {
    generatePaper(
      { ...data, blueprintId: blueprint.id },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-modal shadow-modal w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-teal-50 to-white">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-semibold text-navy-900">Generate Paper</h2>
          </div>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6 p-3 bg-navy-50 rounded-lg border border-border text-sm">
            <span className="text-navy-500">Blueprint:</span> <span className="font-semibold text-navy-900">{blueprint.name}</span>
            <div className="mt-1 flex gap-4 text-navy-600 text-xs">
              <span>{blueprint.totalMarks} Marks</span>
              <span>{blueprint.duration} Mins</span>
            </div>
          </div>

          <form id="generate-paper-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Paper Title <span className="text-error">*</span></label>
              <input
                {...register('title')}
                className={`input ${errors.title ? 'input-error' : ''}`}
                placeholder="e.g. Weekly Test 1 - Set A"
                disabled={isPending}
              />
              {errors.title && <p className="error-text">{errors.title.message}</p>}
            </div>

            <div>
              <label className="label">Target Batch (Optional)</label>
              <input
                {...register('targetBatchId')}
                className="input"
                placeholder="Batch ID for analytics mapping"
                disabled={isPending}
              />
            </div>
            
            <div>
              <label className="label">Personalize for Student (Optional)</label>
              <input
                {...register('targetStudentId')}
                className="input"
                placeholder="Student ID for personalized weak-topic targeting"
                disabled={isPending}
              />
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-gray-50">
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
            form="generate-paper-form"
            className="btn-primary"
            disabled={isPending}
          >
            {isPending ? 'Engine Running...' : 'Start Generation'}
          </button>
        </div>
      </div>
    </div>
  );
}
