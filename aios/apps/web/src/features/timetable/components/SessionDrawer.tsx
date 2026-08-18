'use client';
// ─── Session Details Drawer ──────────────────────────────────────────────────
// Right slide-over drawer for class session inspection and faculty substitution

import React, { useState } from 'react';
import { X, Clock, MapPin, Users, BookOpen, User, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ClassSessionItem } from '../types/timetable.types';
import { useAssignSubstitute, useDeleteSession } from '../hooks/useTimetable';

interface SessionDrawerProps {
  session: ClassSessionItem | null;
  onClose: () => void;
  onEdit?: (session: ClassSessionItem) => void;
}

export function SessionDrawer({ session, onClose, onEdit }: SessionDrawerProps) {
  const isOpen = !!session;
  const [substituteName, setSubstituteName] = useState('');
  const [submitting, setSubmitting]         = useState(false);

  const assignSubMutation = useAssignSubstitute();
  const deleteMutation    = useDeleteSession();

  if (!isOpen || !session) return null;

  async function handleSubstitute() {
    if (!session || !substituteName.trim()) return;
    setSubmitting(true);
    try {
      await assignSubMutation.mutateAsync({ sessionId: session.id, substituteFaculty: substituteName });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!session) return;
    await deleteMutation.mutateAsync(session.id);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{session.subject} Period</h3>
              <p className="text-xs text-slate-500">{session.timeSlot} · {session.day}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Key Metadata Card */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Batch Cohort</span>
              <span className="font-bold text-blue-600">{session.batch}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Classroom / Venue</span>
              <span className="font-bold text-slate-900 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {session.room}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Assigned Faculty</span>
              <span className="font-bold text-slate-900 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-indigo-500" /> {session.facultyName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Status</span>
              <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] ${
                session.status === 'completed'   ? 'bg-emerald-50 text-emerald-700' :
                session.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                session.status === 'substituted' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-700'
              }`}>
                {session.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Faculty Substitute Section */}
          <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 space-y-3">
            <h4 className="font-bold text-amber-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-amber-600" /> Assign Substitute Faculty
            </h4>
            <p className="text-[11px] text-amber-700">If primary faculty is on leave, assign an available instructor:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={substituteName}
                onChange={(e) => setSubstituteName(e.target.value)}
                placeholder="e.g. Prof. Sunita Sharma"
                className="flex-1 px-3 py-1.5 bg-white border border-amber-200 rounded-lg text-xs"
              />
              <button
                onClick={handleSubstitute}
                disabled={submitting || !substituteName.trim()}
                className="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button onClick={handleDelete} className="px-3 py-1.5 bg-rose-50 text-rose-600 font-bold rounded-lg hover:bg-rose-100">
            Cancel Session
          </button>
          <div className="flex gap-2">
            {onEdit && (
              <button onClick={() => { onEdit(session); onClose(); }} className="px-3 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                Edit Details
              </button>
            )}
            <button onClick={onClose} className="px-3 py-1.5 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
