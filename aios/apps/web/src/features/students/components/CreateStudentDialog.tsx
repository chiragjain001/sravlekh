'use client';
// ─── Create / Edit Student Dialog ─────────────────────────────────────────────
// Single dialog handles both create and edit modes.
// Validation via native HTML5 + inline state (no Zod dependency for now).
// When Zod + RHF is added, swap only this file.

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, GraduationCap, Users, ChevronDown, Loader2 } from 'lucide-react';
import type { StudentListItem, CreateStudentInput, UpdateStudentInput } from '../types/student.types';

// ── Available programs and batches (normally fetched from API)
const PROGRAMS  = ['JEE', 'NEET', '11th', '12th', 'Foundation'] as const;
const BATCHES   = [
  { id: 'b-001', label: 'JEE 2025 Star Batch',  class: 'Class 12' },
  { id: 'b-002', label: 'NEET 2025 Target',       class: 'Class 12' },
  { id: 'b-003', label: 'Foundation 11A',          class: 'Class 11' },
  { id: 'b-004', label: 'JEE 2026 Early',          class: 'Class 11' },
];

interface FormState {
  name:        string;
  email:       string;
  phone:       string;
  rollNo:      string;
  program:     string;
  batchId:     string;
  parentName:  string;
  parentPhone: string;
}

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', rollNo: '', program: '',
  batchId: '', parentName: '', parentPhone: '',
};

function toFormState(s: StudentListItem): FormState {
  return {
    name:        s.name,
    email:       s.email,
    phone:       s.phone,
    rollNo:      s.rollNo,
    program:     s.program,
    batchId:     s.batchId,
    parentName:  s.parentName ?? '',
    parentPhone: s.parentPhone ?? '',
  };
}

interface CreateStudentDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  editTarget?: StudentListItem | null;  // null → create mode
  onSubmit:   (data: CreateStudentInput | UpdateStudentInput) => Promise<void>;
}

interface FieldProps {
  label:       string;
  id:          string;
  type?:       string;
  value:       string;
  onChange:    (v: string) => void;
  placeholder?: string;
  required?:   boolean;
  icon?:       React.ReactNode;
}

function Field({ label, id, type = 'text', value, onChange, placeholder, required, icon }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`w-full ${icon ? 'pl-9' : 'pl-3'} pr-3 py-2 text-xs border border-slate-200 rounded-lg
            bg-white text-slate-800 placeholder-slate-400
            focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
            transition-shadow`}
        />
      </div>
    </div>
  );
}

function SelectField({
  label, id, value, onChange, options, placeholder, required,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full appearance-none pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg
            bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
            cursor-pointer"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}

export function CreateStudentDialog({ isOpen, onClose, editTarget, onSubmit }: CreateStudentDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]   = useState<Partial<FormState>>({});
  const [loading, setLoading] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (editTarget) {
      setForm(toFormState(editTarget));
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editTarget, isOpen]);

  // Trap focus when open
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function set(key: keyof FormState) {
    return (v: string) => {
      setForm((f) => ({ ...f, [key]: v }));
      setErrors((e) => ({ ...e, [key]: '' }));
    };
  }

  function validate(): boolean {
    const errs: Partial<FormState> = {};
    if (!form.name.trim())    errs.name    = 'Full name is required';
    if (!form.email.trim())   errs.email   = 'Email is required';
    if (!form.phone.trim())   errs.phone   = 'Phone is required';
    if (!form.program)        errs.program = 'Select a program';
    if (!form.batchId)        errs.batchId = 'Select a batch';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const selectedBatch = BATCHES.find((b) => b.id === form.batchId);
      if (isEditMode && editTarget) {
        await onSubmit({
          id:          editTarget.id,
          name:        form.name,
          email:       form.email,
          phone:       form.phone,
          rollNo:      form.rollNo || undefined,
          program:     form.program,
          batchId:     form.batchId,
          classId:     selectedBatch?.class ?? '',
          parentName:  form.parentName || undefined,
          parentPhone: form.parentPhone || undefined,
          enrolledExams: [],
        } as UpdateStudentInput);
      } else {
        await onSubmit({
          name:        form.name,
          email:       form.email,
          phone:       form.phone,
          rollNo:      form.rollNo || undefined,
          program:     form.program,
          batchId:     form.batchId,
          classId:     selectedBatch?.class ?? '',
          parentName:  form.parentName || undefined,
          parentPhone: form.parentPhone || undefined,
          enrolledExams: [],
        } as CreateStudentInput);
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
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
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
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Section: Student */}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Student Information</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Field
                  label="Full Name" id="s-name" value={form.name} onChange={set('name')}
                  placeholder="e.g. Aryan Sharma" required
                  icon={<User className="w-3.5 h-3.5" />}
                />
                {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
              </div>
              <div>
                <Field
                  label="Email" id="s-email" type="email" value={form.email} onChange={set('email')}
                  placeholder="student@aios.in" required
                  icon={<Mail className="w-3.5 h-3.5" />}
                />
                {errors.email && <p className="text-[10px] text-rose-500 mt-0.5">{errors.email}</p>}
              </div>
              <div>
                <Field
                  label="Phone" id="s-phone" value={form.phone} onChange={set('phone')}
                  placeholder="10-digit number" required
                  icon={<Phone className="w-3.5 h-3.5" />}
                />
                {errors.phone && <p className="text-[10px] text-rose-500 mt-0.5">{errors.phone}</p>}
              </div>
              <div>
                <Field
                  label="Roll Number" id="s-roll" value={form.rollNo} onChange={set('rollNo')}
                  placeholder="Auto-generated if blank"
                />
              </div>
            </div>

            {/* Section: Academic Placement */}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Academic Placement</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <SelectField
                  label="Program" id="s-program" value={form.program} onChange={set('program')}
                  options={PROGRAMS.map((p) => ({ value: p, label: p }))}
                  placeholder="Select program" required
                />
                {errors.program && <p className="text-[10px] text-rose-500 mt-0.5">{errors.program}</p>}
              </div>
              <div>
                <SelectField
                  label="Batch" id="s-batch" value={form.batchId} onChange={set('batchId')}
                  options={BATCHES.map((b) => ({ value: b.id, label: b.label }))}
                  placeholder="Select batch" required
                />
                {errors.batchId && <p className="text-[10px] text-rose-500 mt-0.5">{errors.batchId}</p>}
              </div>
            </div>

            {/* Section: Parent / Guardian */}
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">Parent / Guardian</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Field
                  label="Parent Name" id="s-parent-name" value={form.parentName} onChange={set('parentName')}
                  placeholder="Guardian's full name"
                  icon={<Users className="w-3.5 h-3.5" />}
                />
              </div>
              <div>
                <Field
                  label="Parent Phone" id="s-parent-phone" value={form.parentPhone} onChange={set('parentPhone')}
                  placeholder="10-digit number"
                  icon={<Phone className="w-3.5 h-3.5" />}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button
              type="button"
              onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
              className="text-xs text-slate-500 font-medium hover:text-slate-700"
            >
              Reset Form
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
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
