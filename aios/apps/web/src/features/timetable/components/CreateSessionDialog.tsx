'use client';
// ─── Create / Edit Class Session Dialog ────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { X, Clock, Calendar, MapPin, User, Loader2 } from 'lucide-react';
import type { ClassSessionItem, DayOfWeek, CreateSessionInput, UpdateSessionInput } from '../types/timetable.types';

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_SLOTS = [
  '08:00 - 09:30 AM',
  '09:30 - 11:00 AM',
  '11:15 - 12:45 PM',
  '01:30 - 03:00 PM',
  '03:15 - 04:45 PM',
];
const BATCHES = ['JEE 2025 Star', 'NEET 2025 Target', 'Foundation 11A', 'JEE 2026 Early', 'Foundation 11B'];
const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English', 'Physical Educ.'];
const ROOMS    = ['B-101', 'B-102', 'B-103', 'A-102', 'A-104', 'Hall A', 'Hall B'];

interface FormState {
  timeSlot:    string;
  day:         DayOfWeek;
  subject:     string;
  batch:       string;
  room:        string;
  facultyName: string;
}

const EMPTY_FORM: FormState = {
  timeSlot:    '08:00 - 09:30 AM',
  day:         'Mon',
  subject:     'Physics',
  batch:       'JEE 2025 Star',
  room:        'B-101',
  facultyName: '',
};

interface CreateSessionDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  editTarget?: ClassSessionItem | null;
  onSubmit:   (data: CreateSessionInput | UpdateSessionInput) => Promise<void>;
}

export function CreateSessionDialog({ isOpen, onClose, editTarget, onSubmit }: CreateSessionDialogProps) {
  const isEditMode = !!editTarget;
  const [form, setForm]       = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editTarget) {
      setForm({
        timeSlot:    editTarget.timeSlot,
        day:         editTarget.day,
        subject:     editTarget.subject,
        batch:       editTarget.batch,
        room:        editTarget.room,
        facultyName: editTarget.facultyName,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editTarget, isOpen]);

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.facultyName.trim()) errs.facultyName = 'Faculty name is required';
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
          timeSlot:    form.timeSlot,
          day:         form.day,
          subject:     form.subject,
          batch:       form.batch,
          room:        form.room,
          facultyName: form.facultyName,
        } as UpdateSessionInput);
      } else {
        await onSubmit({ ...form } as CreateSessionInput);
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
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{isEditMode ? 'Edit Class Session' : 'Add Class Session'}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{isEditMode ? `Updating ${editTarget!.subject}` : 'Schedule period slot, room & instructor'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Weekday *</label>
                <select
                  value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value as DayOfWeek })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Time Slot *</label>
                <select
                  value={form.timeSlot} onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {TIME_SLOTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Subject *</label>
                <select
                  value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Batch Cohort *</label>
                <select
                  value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {BATCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Classroom / Room *</label>
                <select
                  value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Faculty Name *</label>
                <input
                  type="text"
                  value={form.facultyName}
                  onChange={(e) => setForm({ ...form, facultyName: e.target.value })}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full pl-3 pr-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
                {errors.facultyName && <p className="text-[10px] text-rose-500 mt-0.5">{errors.facultyName}</p>}
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
              {loading ? 'Scheduling…' : isEditMode ? 'Save Changes' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
