'use client';
// ─── Create / Edit Student Dialog ─────────────────────────────────────────────
// Single dialog handles both create and edit modes. Batches and tags are real
// (useBatches hits the live API; tags mirror the backend's validated enum).

import React, { useState, useEffect } from 'react';
import { X, User, Mail, GraduationCap, Users, Phone, MapPin, Loader2 } from 'lucide-react';
import { useBatches } from '@/hooks/useApi';
import { DatePicker } from '@/components/ui/DatePicker';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
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
              : 'border-slate-200/90 focus:border-indigo-500 focus:ring-indigo-500/10 hover:border-slate-300'
          }`}
        />
      </div>
      {error && <p className="text-[10.5px] font-semibold text-rose-500 mt-1">{error}</p>}
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
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-white to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-sm shadow-indigo-200">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="dialog-title" className="text-sm font-bold text-slate-900 tracking-tight">
                {isEditMode ? 'Edit Student' : 'Enroll New Student'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditMode ? `Editing ${editTarget!.name}` : 'Fill in student details to enroll'}
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
            {/* Section 1: Student Information */}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Student Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="col-span-1 sm:col-span-2">
                  <Field
                    label="Full Name"
                    id="s-name"
                    value={form.name}
                    onChange={set('name')}
                    placeholder="e.g. Aryan Sharma"
                    required
                    icon={<User className="w-3.5 h-3.5" />}
                    error={errors.name}
                  />
                </div>
                <div>
                  <Field
                    label="Email"
                    id="s-email"
                    type="email"
                    value={form.email}
                    onChange={set('email')}
                    placeholder="student@aios.in"
                    required
                    icon={<Mail className="w-3.5 h-3.5" />}
                    error={errors.email}
                  />
                </div>
                <div>
                  <Field
                    label="Roll Number"
                    id="s-roll"
                    value={form.rollNumber}
                    onChange={set('rollNumber')}
                    placeholder="e.g. JEE2026-101"
                    icon={<GraduationCap className="w-3.5 h-3.5" />}
                  />
                </div>
                <div>
                  <DatePicker
                    label="Date of Birth"
                    value={form.dateOfBirth}
                    onChange={set('dateOfBirth')}
                    maxDate={new Date().toISOString().split('T')[0]}
                    placeholder="Select birth date…"
                    quickPresets={false}
                  />
                </div>
                <div>
                  <AppleDropdown
                    label="Batch"
                    value={form.batchId}
                    onChange={set('batchId')}
                    options={batches.map((b) => ({ value: b.id, label: b.name }))}
                    placeholder={isEditMode ? 'Unassigned' : 'Select batch'}
                    required={!isEditMode}
                    disabled={isEditMode}
                    searchable
                    icon={<GraduationCap className="w-3.5 h-3.5" />}
                    error={errors.batchId}
                  />
                  {isEditMode && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Use the batch transfer action to move a student.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section 2: Guardian Details */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Guardian Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Field
                  label="Guardian Name"
                  id="s-g-name"
                  value={form.guardianName}
                  onChange={set('guardianName')}
                  icon={<Users className="w-3.5 h-3.5" />}
                  placeholder="e.g. Rajesh Sharma"
                />
                <Field
                  label="Guardian Phone"
                  id="s-g-phone"
                  value={form.guardianPhone}
                  onChange={set('guardianPhone')}
                  icon={<Phone className="w-3.5 h-3.5" />}
                  placeholder="e.g. +91 98765 43210"
                />
                <Field
                  label="Guardian Email"
                  id="s-g-email"
                  type="email"
                  value={form.guardianEmail}
                  onChange={set('guardianEmail')}
                  icon={<Mail className="w-3.5 h-3.5" />}
                  placeholder="e.g. guardian@gmail.com"
                />
                <Field
                  label="Address"
                  id="s-address"
                  value={form.address}
                  onChange={set('address')}
                  icon={<MapPin className="w-3.5 h-3.5" />}
                  placeholder="e.g. Sector 14, Gurugram"
                />
              </div>
            </div>

            {/* Section 3: Tags */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">
                Tags & Categories
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STUDENT_TAG_VALUES.map((tag) => {
                  const isSelected = form.tags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer active:scale-95 ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs ring-2 ring-indigo-600/20'
                          : 'bg-white border-slate-200/90 text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/30'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Apple-style Footer */}
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
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm shadow-indigo-200 cursor-pointer"
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
