'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateQuestion } from '@/hooks/useApi';
import { X } from 'lucide-react';
import { useEffect } from 'react';

const createQuestionSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  chapterId: z.string().min(1, 'Chapter is required'),
  topicId: z.string().min(1, 'Topic is required'),
  type: z.enum(['MCQ', 'MULTI_CORRECT', 'SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  marks: z.number().min(0),
  negativeMarks: z.number().min(0).optional(),
  content: z.string().min(10, 'Question content must be at least 10 characters'),
  solution: z.string().optional(),
});

type CreateQuestionForm = z.infer<typeof createQuestionSchema>;

export function CreateQuestionModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { mutate: createQuestion, isPending } = useCreateQuestion();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateQuestionForm>({
    resolver: zodResolver(createQuestionSchema),
    defaultValues: {
      type: 'MCQ',
      difficulty: 'MEDIUM',
      marks: 4,
      negativeMarks: 1,
    }
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onSubmit = (data: CreateQuestionForm) => {
    createQuestion(data, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-modal shadow-modal w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-navy-900">Add Question</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-question-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label">Subject ID <span className="text-error">*</span></label>
                <input
                  {...register('subjectId')}
                  className={`input ${errors.subjectId ? 'input-error' : ''}`}
                  placeholder="Subject ID"
                  disabled={isPending}
                />
                {errors.subjectId && <p className="error-text">{errors.subjectId.message}</p>}
              </div>
              <div>
                <label className="label">Chapter ID <span className="text-error">*</span></label>
                <input
                  {...register('chapterId')}
                  className={`input ${errors.chapterId ? 'input-error' : ''}`}
                  placeholder="Chapter ID"
                  disabled={isPending}
                />
                {errors.chapterId && <p className="error-text">{errors.chapterId.message}</p>}
              </div>
              <div>
                <label className="label">Topic ID <span className="text-error">*</span></label>
                <input
                  {...register('topicId')}
                  className={`input ${errors.topicId ? 'input-error' : ''}`}
                  placeholder="Topic ID"
                  disabled={isPending}
                />
                {errors.topicId && <p className="error-text">{errors.topicId.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="label">Type</label>
                <select {...register('type')} className="input" disabled={isPending}>
                  <option value="MCQ">MCQ</option>
                  <option value="MULTI_CORRECT">Multi-Correct</option>
                  <option value="SHORT_ANSWER">Short Answer</option>
                  <option value="LONG_ANSWER">Long Answer</option>
                  <option value="NUMERICAL">Numerical</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Difficulty</label>
                <select {...register('difficulty')} className="input" disabled={isPending}>
                  <option value="EASY">Easy</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
              <div>
                <label className="label">Marks</label>
                <input
                  type="number"
                  {...register('marks', { valueAsNumber: true })}
                  className="input"
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="label">- Marks</label>
                <input
                  type="number"
                  {...register('negativeMarks', { valueAsNumber: true })}
                  className="input"
                  disabled={isPending}
                />
              </div>
            </div>

            <div>
              <label className="label">Question Content (Markdown) <span className="text-error">*</span></label>
              <textarea
                {...register('content')}
                className={`input min-h-[120px] resize-y ${errors.content ? 'input-error' : ''}`}
                placeholder="Enter question text here..."
                disabled={isPending}
              />
              {errors.content && <p className="error-text">{errors.content.message}</p>}
            </div>

            <div>
              <label className="label">Solution / Explanation</label>
              <textarea
                {...register('solution')}
                className="input min-h-[80px] resize-y"
                placeholder="Optional explanation for the answer..."
                disabled={isPending}
              />
            </div>
            
          </form>
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3 bg-navy-50">
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
            form="create-question-form"
            className="btn-primary"
            disabled={isPending}
          >
            {isPending ? 'Adding...' : 'Add Question'}
          </button>
        </div>
      </div>
    </div>
  );
}
