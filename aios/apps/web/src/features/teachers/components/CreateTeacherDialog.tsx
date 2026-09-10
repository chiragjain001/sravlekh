'use client';
// ─── Create / Edit Teacher Dialog ─────────────────────────────────────────────
// Single dialog handles both create and edit modes. Subjects are real
// (useSubjects hits the live curriculum API).

import React, { useState, useEffect } from 'react';
import { X, User, Mail, GraduationCap, Loader2 } from 'lucide-react';
import { useSubjects } from '@/hooks/useApi';
import type { TeacherListItem, CreateTeacherInput, UpdateTeacherInput } from '../types/teacher.types';

interface FormState {
  name: string;
  email: string;
  qualification: string;
  subjectIds: string[];
}

const EMPTY_FORM: FormState = { name: '', email: '', qualification: '', subjectIds: [] };

function toFormState(t: TeacherListItem): FormState {
  return { name: t.name, email: t.email, qualification: t.qualification ?? '', subjectIds: t.subjectIds };
}

interface CreateTeacherDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: TeacherListItem | null;
  onSubmit: (data: CreateTeacherInput | UpdateTeacherInput) => Promise<void>;
}

function Field({ label, id, type = 'text', value, onChange, placeholder, required, icon }: {
  label: string; id: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow`}
        />
      </div>
    </div>
  );
}

export function CreateTeacherDialog({ isOpen, onClose, editTarget, onSubmit }: CreateTeacherDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const { data: subjectsData } = useSubjects();
  const subjects: { id: string; name: string }[] = subjectsData?.data ?? subjectsData ?? [];

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

  function toggleSubject(id: string) {
    setForm((f) => ({ ...f, subjectIds: f.subjectIds.includes(id) ? f.subjectIds.filter((s) => s !== id) : [...f.subjectIds, id] }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const payload = { name: form.name, email: form.email, qualification: form.qualification || undefined, subjectIds: form.subjectIds };
      if (isEditMode && editTarget) await onSubmit({ id: editTarget.id, ...payload } as UpdateTeacherInput);
      else await onSubmit(payload as CreateTeacherInput);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-100" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center"><User className="w-5 h-5 text-white" /></div>
            <div>
              <h3 id="dialog-title" className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Teacher' : 'Add New Teacher'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Editing ${editTarget!.name}` : 'Fill in teacher details to add'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close dialog"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teacher Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Full Name" id="t-name" value={form.name} onChange={set('name')} placeholder="e.g. Dr. Priya Mehta" required icon={<User className="w-3.5 h-3.5" />} />
                {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
              </div>
              <div className="col-span-2">
                <Field label="Email" id="t-email" type="email" value={form.email} onChange={set('email')} placeholder="teacher@aios.in" required icon={<Mail className="w-3.5 h-3.5" />} />
                {errors.email && <p className="text-[10px] text-rose-500 mt-0.5">{errors.email}</p>}
              </div>
              <div className="col-span-2">
                <Field label="Qualification" id="t-qual" value={form.qualification} onChange={set('qualification')} placeholder="e.g. M.Sc Physics, IIT Bombay" icon={<GraduationCap className="w-3.5 h-3.5" />} />
              </div>
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Subjects</p>
            <div className="flex flex-wrap gap-1.5">
              {subjects.length === 0 && <p className="text-[11px] text-slate-400">No subjects created yet — add subjects under Academics first.</p>}
              {subjects.map((s) => (
                <button
                  key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-colors ${form.subjectIds.includes(s.id) ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={() => { setForm(EMPTY_FORM); setErrors({}); }} className="text-xs text-slate-500 font-medium hover:text-slate-700">Reset Form</button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
              <button type="submit" disabled={loading} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-emerald-200">
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Teacher'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
