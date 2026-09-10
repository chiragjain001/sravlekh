'use client';
// ─── Create / Edit Student Dialog ─────────────────────────────────────────────
// Single dialog handles both create and edit modes. Batches and tags are real
// (useBatches hits the live API; tags mirror the backend's validated enum).

import React, { useState, useEffect } from 'react';
import { X, User, Mail, GraduationCap, Users, Phone, ChevronDown, Loader2 } from 'lucide-react';
import { useBatches } from '@/hooks/useApi';
import { STUDENT_TAG_VALUES } from '../types/student.types';
import type { StudentListItem, CreateStudentInput, UpdateStudentInput } from '../types/student.types';

interface FormState {
  name: string;
  email: string;
  rollNumber: string;
  dateOfBirth: string;
  batchId: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  address: string;
  tags: string[];
}

const EMPTY_FORM: FormState = {
  name: '', email: '', rollNumber: '', dateOfBirth: '', batchId: '',
  guardianName: '', guardianPhone: '', guardianEmail: '', address: '', tags: [],
};

function toFormState(s: StudentListItem): FormState {
  return {
    name: s.name,
    email: s.email,
    rollNumber: s.rollNumber ?? '',
    dateOfBirth: s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : '',
    batchId: s.batchId ?? '',
    guardianName: s.guardianName ?? '',
    guardianPhone: s.guardianPhone ?? '',
    guardianEmail: s.guardianEmail ?? '',
    address: s.address ?? '',
    tags: s.tags,
  };
}

interface CreateStudentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editTarget?: StudentListItem | null;
  onSubmit: (data: CreateStudentInput | UpdateStudentInput) => Promise<void>;
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

function SelectField({ label, id, value, onChange, options, placeholder, required, disabled }: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select
          id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required} disabled={disabled}
          className="w-full appearance-none pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent cursor-pointer disabled:opacity-60"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

export function CreateStudentDialog({ isOpen, onClose, editTarget, onSubmit }: CreateStudentDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);
  const { data: batchesData } = useBatches();
  const batches: { id: string; name: string }[] = batchesData?.data ?? batchesData ?? [];

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
    return (v: FormState[K]) => {
      setForm((f) => ({ ...f, [key]: v }));
      setErrors((e) => ({ ...e, [key]: '' }));
    };
  }

  function toggleTag(tag: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = 'Full name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!isEditMode && !form.batchId) errs.batchId = 'Select a batch';
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
        rollNumber: form.rollNumber || undefined,
        dateOfBirth: form.dateOfBirth || undefined,
        batchId: form.batchId || undefined,
        guardianName: form.guardianName || undefined,
        guardianPhone: form.guardianPhone || undefined,
        guardianEmail: form.guardianEmail || undefined,
        address: form.address || undefined,
        tags: form.tags,
      };
      if (isEditMode && editTarget) {
        await onSubmit({ id: editTarget.id, ...payload } as UpdateStudentInput);
      } else {
        await onSubmit(payload as CreateStudentInput);
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-100" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="dialog-title" className="text-sm font-bold text-slate-900">
                {isEditMode ? 'Edit Student' : 'Enroll New Student'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditMode ? `Editing ${editTarget!.name}` : 'Fill in student details to enroll'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close dialog">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field label="Full Name" id="s-name" value={form.name} onChange={set('name')} placeholder="e.g. Aryan Sharma" required icon={<User className="w-3.5 h-3.5" />} />
                {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <Field label="Email" id="s-email" type="email" value={form.email} onChange={set('email')} placeholder="student@aios.in" required icon={<Mail className="w-3.5 h-3.5" />} />
                {errors.email && <p className="text-[10px] text-rose-500 mt-0.5">{errors.email}</p>}
              </div>
              <div>
                <Field label="Roll Number" id="s-roll" value={form.rollNumber} onChange={set('rollNumber')} placeholder="e.g. JEE2026-101" />
              </div>
              <div>
                <Field label="Date of Birth" id="s-dob" type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} />
              </div>
              <div>
                <SelectField
                  label="Batch" id="s-batch" value={form.batchId} onChange={set('batchId')}
                  options={batches.map((b) => ({ value: b.id, label: b.name }))}
                  placeholder={isEditMode ? 'Unassigned' : 'Select batch'} required={!isEditMode}
                  disabled={isEditMode}
                />
                {errors.batchId && <p className="text-[10px] text-rose-500 mt-0.5">{errors.batchId}</p>}
                {isEditMode && <p className="text-[10px] text-slate-400 mt-0.5">Use the batch transfer action to move a student.</p>}
              </div>
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Guardian</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Guardian Name" id="s-g-name" value={form.guardianName} onChange={set('guardianName')} icon={<Users className="w-3.5 h-3.5" />} />
              <Field label="Guardian Phone" id="s-g-phone" value={form.guardianPhone} onChange={set('guardianPhone')} icon={<Phone className="w-3.5 h-3.5" />} />
              <Field label="Guardian Email" id="s-g-email" type="email" value={form.guardianEmail} onChange={set('guardianEmail')} icon={<Mail className="w-3.5 h-3.5" />} />
              <Field label="Address" id="s-address" value={form.address} onChange={set('address')} />
            </div>

            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {STUDENT_TAG_VALUES.map((tag) => (
                <button
                  key={tag} type="button" onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-[10.5px] font-bold border transition-colors ${
                    form.tags.includes(tag) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={() => { setForm(EMPTY_FORM); setErrors({}); }} className="text-xs text-slate-500 font-medium hover:text-slate-700">
              Reset Form
            </button>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {loading ? 'Saving…' : isEditMode ? 'Save Changes' : 'Enroll Student'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
