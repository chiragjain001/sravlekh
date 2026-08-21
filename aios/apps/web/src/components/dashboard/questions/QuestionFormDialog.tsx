'use client';
// ─── Create / Edit Question Dialog ─────────────────────────────────────────────
// Shared by Teacher and Admin dashboards. Single dialog handles both modes.

import { useEffect, useState } from 'react';
import { X, FileText, Plus, Trash2, Loader2 } from 'lucide-react';

export type QuestionType =
  | 'MCQ' | 'MULTI_CORRECT' | 'SHORT_ANSWER' | 'LONG_ANSWER'
  | 'NUMERICAL' | 'MATCH_THE_FOLLOWING' | 'PASSAGE_BASED';
export type DifficultyLevel = 'EASY' | 'MEDIUM' | 'HARD';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'MCQ', label: 'MCQ (single correct)' },
  { value: 'MULTI_CORRECT', label: 'MCQ (multiple correct)' },
  { value: 'SHORT_ANSWER', label: 'Short Answer' },
  { value: 'LONG_ANSWER', label: 'Long Answer' },
  { value: 'NUMERICAL', label: 'Numerical' },
  { value: 'MATCH_THE_FOLLOWING', label: 'Match the Following' },
  { value: 'PASSAGE_BASED', label: 'Passage Based' },
];
const DIFFICULTIES: { value: DifficultyLevel; label: string }[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];
const HAS_OPTIONS: QuestionType[] = ['MCQ', 'MULTI_CORRECT'];

export interface QuestionOption { label: string; text: string; isCorrect: boolean }

export interface QuestionFormValue {
  subjectId: string;
  chapterId: string;
  topicId: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  marks: number;
  negativeMarks: number;
  content: string;
  options?: QuestionOption[];
  solution?: string;
  sourceRef?: string;
}

interface SubjectItem { id: string; name: string; chapters: ChapterItem[] }
interface ChapterItem { id: string; name: string; topics: TopicItem[] }
interface TopicItem { id: string; name: string }

interface EditTarget {
  subjectId: string; chapterId: string; topicId: string;
  type: QuestionType; difficulty: DifficultyLevel; marks: number; negativeMarks: number;
  content: string; options?: QuestionOption[] | null; solution?: string | null; sourceRef?: string | null;
}

const EMPTY: QuestionFormValue = {
  subjectId: '', chapterId: '', topicId: '', type: 'MCQ', difficulty: 'MEDIUM',
  marks: 1, negativeMarks: 0, content: '', options: [
    { label: 'A', text: '', isCorrect: true },
    { label: 'B', text: '', isCorrect: false },
  ], solution: '', sourceRef: '',
};

function toFormValue(q: EditTarget): QuestionFormValue {
  return {
    subjectId: q.subjectId, chapterId: q.chapterId, topicId: q.topicId,
    type: q.type, difficulty: q.difficulty, marks: q.marks, negativeMarks: q.negativeMarks,
    content: q.content, options: (q.options as QuestionOption[] | undefined) ?? undefined,
    solution: q.solution ?? '', sourceRef: q.sourceRef ?? '',
  };
}

interface QuestionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: SubjectItem[];
  editTarget?: EditTarget | null;
  isPending: boolean;
  onSubmit: (value: QuestionFormValue) => void;
}

export function QuestionFormDialog({ isOpen, onClose, subjects, editTarget, isPending, onSubmit }: QuestionFormDialogProps) {
  const [form, setForm] = useState<QuestionFormValue>(EMPTY);
  const isEditMode = !!editTarget;

  useEffect(() => {
    if (isOpen) setForm(editTarget ? toFormValue(editTarget) : EMPTY);
  }, [isOpen, editTarget]);

  if (!isOpen) return null;

  const chapters = subjects.find((s) => s.id === form.subjectId)?.chapters ?? [];
  const topics = chapters.find((c) => c.id === form.chapterId)?.topics ?? [];
  const needsOptions = HAS_OPTIONS.includes(form.type);
  const canSubmit = form.subjectId && form.chapterId && form.topicId && form.content.trim() && form.marks > 0;

  function set<K extends keyof QuestionFormValue>(key: K, value: QuestionFormValue[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleSubjectChange(subjectId: string) {
    setForm((f) => ({ ...f, subjectId, chapterId: '', topicId: '' }));
  }
  function handleChapterChange(chapterId: string) {
    setForm((f) => ({ ...f, chapterId, topicId: '' }));
  }

  function updateOption(index: number, patch: Partial<QuestionOption>) {
    setForm((f) => ({
      ...f,
      options: (f.options ?? []).map((o, i) => (i === index ? { ...o, ...patch } : o)),
    }));
  }
  function addOption() {
    const next = form.options ?? [];
    const label = String.fromCharCode(65 + next.length); // A, B, C, ...
    setForm((f) => ({ ...f, options: [...next, { label, text: '', isCorrect: false }] }));
  }
  function removeOption(index: number) {
    setForm((f) => ({ ...f, options: (f.options ?? []).filter((_, i) => i !== index) }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      ...form,
      options: needsOptions ? form.options : undefined,
      solution: form.solution?.trim() || undefined,
      sourceRef: form.sourceRef?.trim() || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="question-dialog-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="question-dialog-title" className="text-sm font-bold text-slate-900">
                {isEditMode ? 'Edit Question' : 'Add Question'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditMode ? 'Editing creates a new version if content changes' : 'Add a question to the bank'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Curriculum linkage */}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Curriculum</p>
            <div className="grid grid-cols-3 gap-3">
              <SelectField label="Subject" required value={form.subjectId} onChange={handleSubjectChange}
                options={subjects.map((s) => ({ value: s.id, label: s.name }))} placeholder="Select subject" />
              <SelectField label="Chapter" required value={form.chapterId} onChange={handleChapterChange}
                options={chapters.map((c) => ({ value: c.id, label: c.name }))}
                placeholder={form.subjectId ? 'Select chapter' : 'Select subject first'} disabled={!form.subjectId} />
              <SelectField label="Topic" required value={form.topicId} onChange={(v) => set('topicId', v)}
                options={topics.map((t) => ({ value: t.id, label: t.name }))}
                placeholder={form.chapterId ? 'Select topic' : 'Select chapter first'} disabled={!form.chapterId} />
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-1">Question</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <SelectField label="Type" required value={form.type} onChange={(v) => set('type', v as QuestionType)}
                  options={QUESTION_TYPES} />
              </div>
              <SelectField label="Difficulty" required value={form.difficulty} onChange={(v) => set('difficulty', v as DifficultyLevel)}
                options={DIFFICULTIES} />
              <NumberField label="Marks" required value={form.marks} onChange={(v) => set('marks', v)} min={0} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <NumberField label="Negative Marks" value={form.negativeMarks} onChange={(v) => set('negativeMarks', v)} min={0} />
            </div>

            <TextAreaField label="Question Content" required value={form.content} onChange={(v) => set('content', v)}
              placeholder="Question text — Markdown/LaTeX supported" rows={3} />

            {needsOptions && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Options{form.type === 'MCQ' ? ' (mark the one correct answer)' : ' (mark all correct answers)'}
                  </label>
                  <button type="button" onClick={addOption}
                    className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700">
                    <Plus className="w-3 h-3" /> Add option
                  </button>
                </div>
                <div className="space-y-2">
                  {(form.options ?? []).map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type={form.type === 'MCQ' ? 'radio' : 'checkbox'}
                        name="correct-option"
                        checked={opt.isCorrect}
                        onChange={(e) => {
                          if (form.type === 'MCQ') {
                            setForm((f) => ({
                              ...f,
                              options: (f.options ?? []).map((o, j) => ({ ...o, isCorrect: j === i })),
                            }));
                          } else {
                            updateOption(i, { isCorrect: e.target.checked });
                          }
                        }}
                        className="w-4 h-4 accent-indigo-600"
                        aria-label={`Option ${opt.label} is correct`}
                      />
                      <span className="text-xs font-bold text-slate-400 w-4">{opt.label}</span>
                      <input
                        value={opt.text}
                        onChange={(e) => updateOption(i, { text: e.target.value })}
                        placeholder={`Option ${opt.label} text`}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button type="button" onClick={() => removeOption(i)}
                        className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove option">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <TextAreaField label="Solution / Explanation" value={form.solution ?? ''} onChange={(v) => set('solution', v)}
              placeholder="Optional — shown to teachers reviewing this question" rows={2} />

            <TextField label="Source Reference" value={form.sourceRef ?? ''} onChange={(v) => set('sourceRef', v)}
              placeholder="Optional — e.g. textbook chapter" />
          </div>

          <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit || isPending}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Add Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Field primitives (matches features/students/components/CreateStudentDialog.tsx) ──

function TextField({ label, value, onChange, placeholder, required }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

function NumberField({ label, value, onChange, min, required }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        type="number"
        value={value}
        min={min}
        step="0.5"
        onChange={(e) => onChange(Number(e.target.value))}
        required={required}
        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

function TextAreaField({ label, value, onChange, placeholder, required, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow resize-none"
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options, placeholder, required, disabled }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="w-full appearance-none px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="" disabled>{placeholder ?? `Select ${label.toLowerCase()}`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
