'use client';
// ─── Create / Edit Batch Dialog ───────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { X, Layers, Loader2 } from 'lucide-react';
import type { BatchListItem, CreateBatchInput, UpdateBatchInput } from '../types/batch.types';

interface FormState {
  name: string;
  classYear: string;
  section: string;
  academicYear: string;
}

const EMPTY_FORM: FormState = { name: '', classYear: '', section: '', academicYear: '' };

function toFormState(b: BatchListItem): FormState {
  return { name: b.name, classYear: b.classYear ?? '', section: b.section ?? '', academicYear: b.academicYear ?? '' };
}

interface CreateBatchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: BatchListItem | null;
  onSubmit: (data: CreateBatchInput | UpdateBatchInput) => Promise<void>;
}

function Field({ label, id, value, onChange, placeholder, required }: {
  label: string; id: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} required={required}
        className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

export function CreateBatchDialog({ isOpen, onClose, editTarget, onSubmit }: CreateBatchDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setForm(editTarget ? toFormState(editTarget) : EMPTY_FORM);
    setErrors({});
  }, [editTarget, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function set<K extends keyof FormState>(key: K) {
    return (v: FormState[K]) => { setForm((f) => ({ ...f, [key]: v })); setErrors((e) => ({ ...e, [key]: '' })); };
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Batch name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = {
        name: form.name,
        classYear: form.classYear || undefined,
        section: form.section || undefined,
        academicYear: form.academicYear || undefined,
      };
      if (isEditMode && editTarget) await onSubmit({ id: editTarget.id, ...payload } as UpdateBatchInput);
      else await onSubmit(payload as CreateBatchInput);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-100" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center"><Layers className="w-5 h-5 text-white" /></div>
            <div>
              <h3 id="dialog-title" className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Batch' : 'Create New Batch'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Editing ${editTarget!.name}` : 'Fill in batch details to create a cohort'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close dialog"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4">
            <div>
              <Field label="Batch Name" id="b-name" value={form.name} onChange={set('name')} placeholder="e.g. JEE Advanced 2026 — Batch A" required />
              {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Class / Year" id="b-classyear" value={form.classYear} onChange={set('classYear')} placeholder="e.g. Class 11" />
              <Field label="Section" id="b-section" value={form.section} onChange={set('section')} placeholder="e.g. A" />
            </div>
            <Field label="Academic Year" id="b-academicyear" value={form.academicYear} onChange={set('academicYear')} placeholder="e.g. 2025-2026" />
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200">
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
