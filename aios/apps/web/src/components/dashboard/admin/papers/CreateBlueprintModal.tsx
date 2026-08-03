'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateBlueprint, useGenerateBlueprintAI } from '@/hooks/useApi';
import { X, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const ruleSchema = z.object({
  topicId: z.string().min(1, 'Required'),
  type: z.enum(['MCQ', 'MULTI_CORRECT', 'SHORT_ANSWER', 'LONG_ANSWER', 'NUMERICAL']),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  count: z.number().min(1),
  marksPerQuestion: z.number().min(1),
});

const createBlueprintSchema = z.object({
  subjectId: z.string().min(1, 'Subject is required'),
  name: z.string().min(2, 'Name is required'),
  totalMarks: z.number().min(1),
  duration: z.number().min(1),
  instructions: z.string().optional(),
  distribution: z.array(ruleSchema).min(1, 'At least one distribution rule is required'),
});

type CreateBlueprintForm = z.infer<typeof createBlueprintSchema>;

export function CreateBlueprintModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { mutate: createBlueprint, isPending } = useCreateBlueprint();
  const { mutate: generateAI, isPending: isAiPending } = useGenerateBlueprintAI();
  const [aiPrompt, setAiPrompt] = useState('');
  
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CreateBlueprintForm>({
    resolver: zodResolver(createBlueprintSchema),
    defaultValues: {
      distribution: [{ type: 'MCQ', difficulty: 'MEDIUM', count: 1, marksPerQuestion: 4 }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "distribution",
  });

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const handleAiGenerate = () => {
    if (!aiPrompt.trim()) return;
    generateAI({ prompt: aiPrompt }, {
      onSuccess: (res) => {
        const data = res.data;
        setValue('name', data.title);
        setValue('duration', data.duration);
        // Map rules, setting topicName as placeholder for topicId
        setValue('distribution', data.rules.map((rule: any) => ({
          topicId: rule.topicName, 
          type: rule.questionType,
          difficulty: rule.difficulty,
          count: rule.count,
          marksPerQuestion: 4 // default
        })));
      }
    });
  };

  const onSubmit = (data: CreateBlueprintForm) => {
    createBlueprint(data, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/40 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-modal shadow-modal w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-navy-900">Create Blueprint</h2>
          <button onClick={onClose} className="text-navy-400 hover:text-navy-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* AI Magic Textbox */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-2">
            <label className="flex items-center gap-2 text-indigo-900 font-semibold mb-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              AI Co-Pilot (Magic Textbox)
            </label>
            <p className="text-xs text-indigo-600/80 mb-3">
              Describe the exam you want to create. The AI will pre-fill the complex rules below.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Create a 30-mark hard physics test on Kinematics and Laws of Motion."
                className="input bg-white border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400/20"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAiGenerate())}
              />
              <button 
                onClick={handleAiGenerate}
                disabled={isAiPending || !aiPrompt.trim()}
                className="btn-primary bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
              >
                {isAiPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Auto-Fill'}
              </button>
            </div>
          </div>

          <form id="create-blueprint-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Blueprint Name <span className="text-error">*</span></label>
                <input
                  {...register('name')}
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="e.g. JEE Mains Mock 1"
                  disabled={isPending}
                />
                {errors.name && <p className="error-text">{errors.name.message}</p>}
              </div>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Total Marks <span className="text-error">*</span></label>
                <input
                  type="number"
                  {...register('totalMarks', { valueAsNumber: true })}
                  className={`input ${errors.totalMarks ? 'input-error' : ''}`}
                  disabled={isPending}
                />
                {errors.totalMarks && <p className="error-text">{errors.totalMarks.message}</p>}
              </div>
              <div>
                <label className="label">Duration (minutes) <span className="text-error">*</span></label>
                <input
                  type="number"
                  {...register('duration', { valueAsNumber: true })}
                  className={`input ${errors.duration ? 'input-error' : ''}`}
                  disabled={isPending}
                />
                {errors.duration && <p className="error-text">{errors.duration.message}</p>}
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-navy-900">Distribution Rules</h3>
                <button
                  type="button"
                  onClick={() => append({ topicId: '', type: 'MCQ', difficulty: 'MEDIUM', count: 1, marksPerQuestion: 4 })}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Rule
                </button>
              </div>

              {errors.distribution && !Array.isArray(errors.distribution) && (
                 <p className="error-text mb-4">{errors.distribution.message}</p>
              )}

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex gap-2 items-start bg-navy-50 p-3 rounded-lg border border-border">
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      <input
                        {...register(`distribution.${index}.topicId` as const)}
                        placeholder="Topic ID"
                        className={`input text-sm ${errors.distribution?.[index]?.topicId ? 'input-error' : ''}`}
                      />
                      <select {...register(`distribution.${index}.type` as const)} className="input text-sm">
                        <option value="MCQ">MCQ</option>
                        <option value="MULTI_CORRECT">Multi</option>
                        <option value="SHORT_ANSWER">Short Ans</option>
                      </select>
                      <select {...register(`distribution.${index}.difficulty` as const)} className="input text-sm">
                        <option value="EASY">Easy</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HARD">Hard</option>
                      </select>
                      <input
                        type="number"
                        {...register(`distribution.${index}.count` as const, { valueAsNumber: true })}
                        placeholder="Count"
                        className="input text-sm"
                        title="Number of questions"
                      />
                      <input
                        type="number"
                        {...register(`distribution.${index}.marksPerQuestion` as const, { valueAsNumber: true })}
                        placeholder="Marks"
                        className="input text-sm"
                        title="Marks per question"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2 text-error hover:bg-error-light rounded"
                      title="Remove rule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
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
            form="create-blueprint-form"
            className="btn-primary"
            disabled={isPending}
          >
            {isPending ? 'Saving...' : 'Save Blueprint'}
          </button>
        </div>
      </div>
    </div>
  );
}
