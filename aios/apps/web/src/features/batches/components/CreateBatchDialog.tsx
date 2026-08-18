'use client';
// ─── Create / Edit Batch Dialog ───────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { X, Layers, User, Calendar, Loader2 } from 'lucide-react';
import type { BatchListItem, CreateBatchInput, UpdateBatchInput, BatchProgram } from '../types/batch.types';

const PROGRAMS: BatchProgram[] = ['JEE', 'NEET', 'Class 11', 'Class 12', 'Foundation'];
const TARGET_YEARS = ['2025', '2026', '2027', '2024-25', '2025-26'];
const MENTORS = ['Rahul Verma', 'Pooja Sharma', 'Amit Singh', 'Devendra Pal', 'Sunidhi Mehta', 'Vikram Rao'];

interface FormState {
  name:        string;
  code:        string;
  program:     BatchProgram;
  targetYear:  string;
  maxCapacity: number;
  leadMentor:  string;
  roomNo:      string;
  startDate:   string;
  endDate:     string;
}

const EMPTY_FORM: FormState = {
  name: '', code: '', program: 'JEE', targetYear: '2025',
  maxCapacity: 40, leadMentor: 'Rahul Verma', roomNo: 'Hall A',
  startDate: '', endDate: '',
};

function toFormState(b: BatchListItem): FormState {
  return {
    name:        b.name,
    code:        b.code,
    program:     b.program,
    targetYear:  b.targetYear,
    maxCapacity: b.maxCapacity,
    leadMentor:  b.leadMentor,
    roomNo:      'Hall A',
    startDate:   b.startDate,
    endDate:     b.endDate,
  };
}

interface CreateBatchDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  editTarget?: BatchListItem | null;
  onSubmit:   (data: CreateBatchInput | UpdateBatchInput) => Promise<void>;
}

export function CreateBatchDialog({ isOpen, onClose, editTarget, onSubmit }: CreateBatchDialogProps) {
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
    if (!form.name.trim())       errs.name       = 'Batch name is required';
    if (!form.program)           errs.program    = 'Program is required';
    if (!form.targetYear)        errs.targetYear = 'Target year is required';
    if (form.maxCapacity <= 0)  errs.maxCapacity= 'Capacity must be > 0';
    if (!form.leadMentor)        errs.leadMentor = 'Lead mentor is required';
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
          id:          editTarget.id,
          name:        form.name,
          program:     form.program,
          targetYear:  form.targetYear,
          maxCapacity: form.maxCapacity,
          leadMentor:  form.leadMentor,
        } as UpdateBatchInput);
      } else {
        await onSubmit({
          name:        form.name,
          code:        form.code || undefined,
          program:     form.program,
          targetYear:  form.targetYear,
          maxCapacity: form.maxCapacity,
          leadMentor:  form.leadMentor,
          roomNo:      form.roomNo,
          startDate:   form.startDate || undefined,
          endDate:     form.endDate || undefined,
        } as CreateBatchInput);
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
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Cohort / Batch' : 'Create New Cohort / Batch'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Editing ${editTarget!.name}` : 'Setup batch details & capacity'}</p>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Name *</label>
                <input
                  type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. JEE 2025 Star Batch" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-400"
                />
                {errors.name && <p className="text-[10px] text-rose-500 mt-0.5">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Program *</label>
                <select
                  value={form.program} onChange={(e) => setForm({ ...form, program: e.target.value as BatchProgram })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Target Year *</label>
                <select
                  value={form.targetYear} onChange={(e) => setForm({ ...form, targetYear: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {TARGET_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Student Capacity *</label>
                <input
                  type="number" value={form.maxCapacity} onChange={(e) => setForm({ ...form, maxCapacity: Number(e.target.value) })}
                  placeholder="40" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
                {errors.maxCapacity && <p className="text-[10px] text-rose-500 mt-0.5">{errors.maxCapacity}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Lead Faculty Mentor *</label>
                <select
                  value={form.leadMentor} onChange={(e) => setForm({ ...form, leadMentor: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {MENTORS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Code</label>
                <input
                  type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="Auto-generated if empty" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Assigned Room</label>
                <input
                  type="text" value={form.roomNo} onChange={(e) => setForm({ ...form, roomNo: e.target.value })}
                  placeholder="e.g. Hall A" className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
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
              {loading ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
