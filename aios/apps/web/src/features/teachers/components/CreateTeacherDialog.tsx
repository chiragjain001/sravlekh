'use client';
// ─── Create / Edit Teacher Dialog ─────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, BookOpen, Briefcase, ChevronDown, Loader2 } from 'lucide-react';
import type { TeacherListItem, CreateTeacherInput, UpdateTeacherInput, TeacherRole } from '../types/teacher.types';

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Physical Edu.'] as const;
const ROLES: { value: TeacherRole; label: string }[] = [
  { value: 'teacher',          label: 'Faculty Teacher' },
  { value: 'head_of_dept',     label: 'Head of Department (HOD)' },
  { value: 'adjunct_faculty', label: 'Adjunct / Visiting Faculty' },
];

interface FormState {
  name:          string;
  email:         string;
  phone:         string;
  empId:         string;
  subject:       string;
  designation:   string;
  role:          TeacherRole;
  qualification: string;
  experienceYears: number;
}

const EMPTY_FORM: FormState = {
  name: '', email: '', phone: '', empId: '',
  subject: '', designation: 'Faculty', role: 'teacher',
  qualification: '', experienceYears: 5,
};

function toFormState(t: TeacherListItem): FormState {
  return {
    name:            t.name,
    email:           t.email,
    phone:           t.phone,
    empId:           t.empId,
    subject:         t.subject,
    designation:     t.designation,
    role:            t.role,
    qualification:   'M.Sc / M.Tech',
    experienceYears: 5,
  };
}

interface CreateTeacherDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  editTarget?: TeacherListItem | null;
  onSubmit:   (data: CreateTeacherInput | UpdateTeacherInput) => Promise<void>;
}

export function CreateTeacherDialog({ isOpen, onClose, editTarget, onSubmit }: CreateTeacherDialogProps) {
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
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim())    errs.name    = 'Full name is required';
    if (!form.email.trim())   errs.email   = 'Email is required';
    if (!form.phone.trim())   errs.phone   = 'Phone is required';
    if (!form.subject)        errs.subject = 'Select primary subject';
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
          id:              editTarget.id,
          name:            form.name,
          email:           form.email,
          phone:           form.phone,
          subject:         form.subject,
          designation:     form.designation,
          role:            form.role,
          qualification:   form.qualification,
          experienceYears: form.experienceYears,
        } as UpdateTeacherInput);
      } else {
        await onSubmit({
          name:            form.name,
          email:           form.email,
          phone:           form.phone,
          empId:           form.empId || undefined,
          subject:         form.subject,
          designation:     form.designation,
          role:            form.role,
          qualification:   form.qualification,
          experienceYears: form.experienceYears,
        } as CreateTeacherInput);
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
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Faculty Details' : 'Add New Faculty Member'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Editing ${editTarget!.name}` : 'Fill in teacher credentials'}</p>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Dr. Ramesh Kumar" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400"
                />
                {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Email *</label>
                <input
                  type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="teacher@aios.in" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400"
                />
                {errors.email && <p className="text-[10px] text-rose-500 mt-0.5">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Phone *</label>
                <input
                  type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="10-digit number" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400"
                />
                {errors.phone && <p className="text-[10px] text-rose-500 mt-0.5">{errors.phone}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Employee ID</label>
                <input
                  type="text" value={form.empId} onChange={(e) => setForm({ ...form, empId: e.target.value })}
                  placeholder="Auto-generated if empty" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Primary Subject *</label>
                <select
                  value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400 bg-white"
                >
                  <option value="">Select subject</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.subject && <p className="text-[10px] text-rose-500 mt-0.5">{errors.subject}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Role / Hierarchy</label>
                <select
                  value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as TeacherRole })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Designation</label>
                <input
                  type="text" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  placeholder="e.g. Senior Faculty" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
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
              {loading ? 'Saving…' : isEditMode ? 'Save Changes' : 'Add Teacher'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
