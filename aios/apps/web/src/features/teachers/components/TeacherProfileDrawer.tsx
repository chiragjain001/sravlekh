'use client';
// ─── Teacher Profile Drawer ───────────────────────────────────────────────────
// Tabs: Overview | Batches — sourced from TeachersService.findById. Batch
// assignment/removal calls the real assign/remove-from-batch endpoints.

import React, { useState } from 'react';
import { X, User, Mail, GraduationCap, BookOpen, AlertTriangle, Trash2, Plus, Loader2 } from 'lucide-react';
import { useBatches, useSubjects } from '@/hooks/useApi';
import type { TeacherProfile } from '../types/teacher.types';
import { useTeacherProfile, useAssignTeacherToBatch, useRemoveTeacherFromBatch } from '../hooks/useTeachers';

function DrawerSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse p-6 gap-4">
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="flex gap-2">{[1, 2].map((i) => <div key={i} className="h-8 flex-1 bg-slate-100 rounded-lg" />)}</div>
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  );
}

function OverviewTab({ profile }: { profile: TeacherProfile }) {
  const { data: subjectsData } = useSubjects();
  const subjects: { id: string; name: string }[] = subjectsData?.data ?? subjectsData ?? [];
  const subjectNames = profile.subjectIds.map((id) => subjects.find((s) => s.id === id)?.name ?? id);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-white">
          <GraduationCap className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">Qualification</p>
            <p className="text-sm font-bold text-slate-900 leading-tight">{profile.qualification ?? '—'}</p>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3 border border-white">
          <BookOpen className="w-5 h-5 text-blue-600 shrink-0" />
          <div>
            <p className="text-[11px] font-medium text-slate-500">Batch Assignments</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">{profile.batchAssignments.length}</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Subjects</h4>
        {subjectNames.length === 0 ? (
          <p className="text-xs text-slate-400">No subjects assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {subjectNames.map((n) => <span key={n} className="px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-full text-xs font-medium text-slate-600">{n}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}

function BatchesTab({ profile }: { profile: TeacherProfile }) {
  const [showAssign, setShowAssign] = useState(false);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const { data: batchesData } = useBatches();
  const { data: subjectsData } = useSubjects();
  const batches: { id: string; name: string }[] = batchesData?.data ?? batchesData ?? [];
  const subjects: { id: string; name: string }[] = subjectsData?.data ?? subjectsData ?? [];
  const assignMutation = useAssignTeacherToBatch();
  const removeMutation = useRemoveTeacherFromBatch();

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!batchId) return;
    await assignMutation.mutateAsync({ profileId: profile.id, batchId, subjectId: subjectId || undefined });
    setShowAssign(false);
    setBatchId('');
    setSubjectId('');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Assigned Batches</h4>
        <button onClick={() => setShowAssign((v) => !v)} className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg hover:bg-emerald-100">
          <Plus className="w-3 h-3" /> Assign
        </button>
      </div>

      {showAssign && (
        <form onSubmit={handleAssign} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} required className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">Select batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">No specific subject</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" disabled={assignMutation.isPending} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-emerald-600 rounded-lg py-1.5 hover:bg-emerald-700 disabled:opacity-60">
            {assignMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />} Confirm Assignment
          </button>
        </form>
      )}

      {profile.batchAssignments.length === 0 ? (
        <p className="text-xs text-slate-400">Not assigned to any batch yet.</p>
      ) : (
        <div className="space-y-2">
          {profile.batchAssignments.map((a) => (
            <div key={a.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-900">{a.batchName}</p>
                {a.subjectId && <p className="text-[10px] text-slate-400">{subjects.find((s) => s.id === a.subjectId)?.name ?? a.subjectId}</p>}
              </div>
              <button
                onClick={() => removeMutation.mutate({ profileId: profile.id, batchTeacherId: a.id })}
                disabled={removeMutation.isPending}
                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                aria-label="Remove from batch"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface TeacherProfileDrawerProps {
  teacherId: string | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

type DrawerTab = 'overview' | 'batches';

export function TeacherProfileDrawer({ teacherId, onClose, onEdit }: TeacherProfileDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const { data: profile, isPending, isError } = useTeacherProfile(teacherId);
  const isOpen = !!teacherId;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity" onClick={onClose} aria-hidden="true" />}

      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} role="dialog" aria-modal="true" aria-label="Teacher Profile">
        {isOpen && isPending && <DrawerSkeleton />}

        {isOpen && isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load teacher profile.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200">Close</button>
          </div>
        )}

        {isOpen && !isPending && !isError && profile && (
          <>
            <div className="flex-shrink-0 p-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-200">{profile.avatarInitials}</div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.qualification ?? 'No qualification on file'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && <button onClick={() => onEdit(profile.id)} className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 transition-colors">Edit</button>}
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close drawer"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[10.5px] flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full border font-bold ${profile.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{profile.status}</span>
                <span className="flex items-center gap-1 text-slate-500"><Mail className="w-3 h-3" /> {profile.email}</span>
              </div>
            </div>

            <div className="flex-shrink-0 flex border-b border-slate-100 bg-white px-5">
              {(['overview', 'batches'] as DrawerTab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>{t}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview' && <OverviewTab profile={profile} />}
              {tab === 'batches' && <BatchesTab profile={profile} />}
            </div>

            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
