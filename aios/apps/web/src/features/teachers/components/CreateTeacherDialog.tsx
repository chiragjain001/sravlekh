'use client';
// ─── Create / Edit Teacher Dialog ─────────────────────────────────────────────
// Single dialog handles both create and edit modes. Subjects are real
// (useSubjects hits the live curriculum API).

import React, { useState, useEffect } from 'react';
import { X, User, Mail, GraduationCap, Loader2, Layers, Check } from 'lucide-react';
import { useSubjects, useBatches } from '@/hooks/useApi';
import type { TeacherListItem, CreateTeacherInput, UpdateTeacherInput } from '../types/teacher.types';

interface FormState {
  name: string;
  email: string;
  qualification: string;
  subjectIds: string[];
  batchIds: string[];
}

const EMPTY_FORM: FormState = { name: '', email: '', qualification: '', subjectIds: [], batchIds: [] };

function toFormState(t: TeacherListItem): FormState {
  return {
    name: t.name,
    email: t.email,
    qualification: t.qualification ?? '',
    subjectIds: t.subjectIds ?? [],
    batchIds: (t.batchAssignments ?? []).map((b) => b.batchId),
  };
}

interface CreateTeacherDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: TeacherListItem | null;
  onSubmit: (data: CreateTeacherInput | UpdateTeacherInput) => Promise<void>;
}

function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  icon,
  error,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
        <span>
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      </label>
      <div className="relative">
        {icon && <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">{icon}</div>}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full ${icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-2.5 text-xs rounded-xl bg-slate-50/70 border text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-4 transition-all ${
            error
              ? 'border-rose-300 ring-4 ring-rose-500/10'
              : 'border-slate-200/90 focus:border-emerald-500 focus:ring-emerald-500/10 hover:border-slate-300'
          }`}
        />
      </div>
      {error && <p className="text-[10.5px] font-semibold text-rose-500 mt-1">{error}</p>}
    </div>
  );
}

export function CreateTeacherDialog({ isOpen, onClose, editTarget, onSubmit }: CreateTeacherDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const { data: subjectsData } = useSubjects();
  const { data: batchesData } = useBatches();
  const subjects: { id: string; name: string }[] = subjectsData?.data ?? subjectsData ?? [];
  const batches: { id: string; name: string; classYear?: string; section?: string }[] = batchesData?.data ?? batchesData ?? [];

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

  function toggleBatch(id: string) {
    setForm((f) => ({ ...f, batchIds: f.batchIds.includes(id) ? f.batchIds.filter((b) => b !== id) : [...f.batchIds, id] }));
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
      const payload = {
        name: form.name,
        email: form.email,
        qualification: form.qualification || undefined,
        subjectIds: form.subjectIds,
        batchIds: form.batchIds,
      };
      if (isEditMode && editTarget) await onSubmit({ id: editTarget.id, ...payload } as UpdateTeacherInput);
      else await onSubmit(payload as CreateTeacherInput);
      onClose();
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-100 max-h-[92vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Apple-style Dialog Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-200">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="dialog-title" className="text-sm font-bold text-slate-900 tracking-tight">
                {isEditMode ? 'Edit Teacher' : 'Add New Teacher'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditMode ? `Editing ${editTarget!.name}` : 'Fill in teacher details to add'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 overflow-hidden">
          <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Teacher Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <Field
                    label="Full Name"
                    id="t-name"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="e.g. Dr. Priya Mehta"
                    required
                    icon={<User className="w-3.5 h-3.5" />}
                    error={errors.name}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <Field
                    label="Email"
                    id="t-email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="teacher@aios.in"
                    required
                    icon={<Mail className="w-3.5 h-3.5" />}
                    error={errors.email}
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <Field
                    label="Qualification"
                    id="t-qual"
                    value={form.qualification}
                    onChange={set('qualification')}
                    placeholder="e.g. M.Sc Physics, IIT Bombay"
                    icon={<GraduationCap className="w-3.5 h-3.5" />}
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Assigned Subjects
                </p>
                <span className="text-[11px] text-slate-400 font-medium">
                  {form.subjectIds.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {subjects.length === 0 && (
                  <p className="text-[11px] text-slate-400">
                    No subjects configured yet for this institute.
                  </p>
                )}
                {subjects.map((s) => {
                  const isSelected = form.subjectIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleSubject(s.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/20'
                          : 'bg-white border-slate-200/90 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/30'
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Assigned Classes / Batches
                </p>
                <span className="text-[11px] text-slate-400 font-medium">
                  {form.batchIds.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto custom-scrollbar p-0.5">
                {batches.length === 0 && (
                  <p className="text-[11px] text-slate-400">
                    No classes or batches configured yet for this institute.
                  </p>
                )}
                {batches.map((b) => {
                  const isSelected = form.batchIds.includes(b.id);
                  const subLabel = [b.classYear, b.section].filter(Boolean).join(' · ');
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleBatch(b.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs ring-2 ring-indigo-600/20'
                          : 'bg-white border-slate-200/90 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                    >
                      <Layers className="w-3 h-3" />
                      <span>{b.name}</span>
                      {subLabel && subLabel !== b.name && (
                        <span className={`text-[10px] opacity-75 font-normal`}>
                          ({subLabel})
                        </span>
                      )}
                      {isSelected && <Check className="w-3 h-3 ml-0.5" />}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-2">
                Teachers automatically receive routine classroom powers (attendance, rosters, grading) for assigned classes.
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 py-4 border-t border-slate-100 bg-slate-50/80 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
              className="text-xs text-slate-500 font-bold hover:text-slate-700 transition-colors py-1 text-center cursor-pointer"
            >
              Reset Form
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-initial px-4 py-2.5 sm:py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-200 cursor-pointer"
              >
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
