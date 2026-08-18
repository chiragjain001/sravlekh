'use client';
// ─── Create / Edit Exam Dialog ─────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { X, FileText, Calendar, Clock, Loader2 } from 'lucide-react';
import type { ExamListItem, CreateExamInput, UpdateExamInput, ExamType } from '../types/exam.types';

const EXAM_TYPES: ExamType[] = ['Mock Test', 'Part Test', 'Subjective', 'Weekly Test', 'DPP Test'];
const BATCHES = ['JEE 2025 Star', 'NEET 2025 Target', 'Foundation 11A', 'JEE 2026 Early', 'Foundation 11B', 'JEE Droppers 2026'];

interface FormState {
  name:     string;
  code:     string;
  batch:    string;
  type:     ExamType;
  date:     string;
  duration: string;
  maxMarks: number;
  students: number;
}

const EMPTY_FORM: FormState = {
  name: '', code: '', batch: 'JEE 2025 Star',
  type: 'Mock Test', date: '', duration: '3 Hrs',
  maxMarks: 300, students: 100,
};

function toFormState(e: ExamListItem): FormState {
  return {
    name:     e.name,
    code:     e.code,
    batch:    e.batch,
    type:     e.type,
    date:     e.date,
    duration: e.duration,
    maxMarks: e.maxMarks,
    students: e.students,
  };
}

interface CreateExamDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  editTarget?: ExamListItem | null;
  onSubmit:   (data: CreateExamInput | UpdateExamInput) => Promise<void>;
}

export function CreateExamDialog({ isOpen, onClose, editTarget, onSubmit }: CreateExamDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editTarget) {
      setForm(toFormState(editTarget));
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editTarget, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const handlePopState = () => onClose();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isOpen, onClose]);

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name  = 'Exam title is required';
    if (!form.batch)       errs.batch = 'Batch selection is required';
    if (!form.type)        errs.type  = 'Exam type is required';
    if (!form.date)        errs.date  = 'Scheduled date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEditMode && editTarget) {
        await onSubmit({
          id:       editTarget.id,
          name:     form.name,
          batch:    form.batch,
          type:     form.type,
          date:     form.date,
          duration: form.duration,
        } as UpdateExamInput);
      } else {
        await onSubmit({
          name:     form.name,
          code:     form.code || undefined,
          batch:    form.batch,
          type:     form.type,
          date:     form.date,
          duration: form.duration,
          maxMarks: form.maxMarks,
          students: form.students,
        } as CreateExamInput);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Exam Details' : 'Schedule New Assessment'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Editing ${editTarget!.name}` : 'Setup assessment blueprint & date'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Title *</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. JEE Main Mock Test 09" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400"
                />
                {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Batch Cohort *</label>
                <select
                  value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {BATCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Format / Type *</label>
                <select
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExamType })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Scheduled Date *</label>
                <input
                  type="text" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  placeholder="e.g. 05 Jun 2025" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
                {errors.date && <p className="text-[10px] text-rose-500 mt-0.5">{errors.date}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Duration</label>
                <input
                  type="text" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  placeholder="e.g. 3 Hrs" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Marks</label>
                <input
                  type="number" value={form.maxMarks} onChange={(e) => setForm({ ...form, maxMarks: Number(e.target.value) })}
                  placeholder="300" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Exam Code</label>
                <input
                  type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Auto-generated if empty" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Scheduling…' : isEditMode ? 'Save Changes' : 'Schedule Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
