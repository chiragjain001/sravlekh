'use client';
// ─── Batch Profile Drawer ─────────────────────────────────────────────────────
// Tabs: Overview | Performance — sourced from BatchesService.findBatchById and
// the real per-student aggregation in BatchesService.getBatchPerformance
// (avgScore/rank/status are computed from ScoreRecord, never fabricated).

import React, { useState } from 'react';
import { X, Users, GraduationCap, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useBatchPerformance } from '@/hooks/useApi';
import type { BatchProfile } from '../types/batch.types';
import { useBatchProfile } from '../hooks/useBatches';

function DrawerSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse p-6 gap-4">
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="flex gap-2">{[1, 2].map((i) => <div key={i} className="h-8 flex-1 bg-slate-100 rounded-lg" />)}</div>
      {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  );
}

function OverviewTab({ profile }: { profile: BatchProfile }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-xl p-4 flex items-center gap-3 border border-white">
          <Users className="w-5 h-5 text-blue-600 shrink-0" />
          <div><p className="text-[11px] font-medium text-slate-500">Students</p><p className="text-lg font-bold text-slate-900 leading-tight">{profile.studentCount}</p></div>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3 border border-white">
          <GraduationCap className="w-5 h-5 text-emerald-600 shrink-0" />
          <div><p className="text-[11px] font-medium text-slate-500">Teachers</p><p className="text-lg font-bold text-slate-900 leading-tight">{profile.teacherCount}</p></div>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Assigned Teachers</h4>
        {profile.teachers.length === 0 ? <p className="text-xs text-slate-400">No teachers assigned yet.</p> : (
          <div className="space-y-2">
            {profile.teachers.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
                <p className="text-xs font-bold text-slate-900">{t.name}</p>
                <p className="text-[10px] text-slate-400">{t.email}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Students (first 50)</h4>
        {profile.students.length === 0 ? <p className="text-xs text-slate-400">No students enrolled yet.</p> : (
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {profile.students.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-3 py-1.5 bg-slate-50 rounded-lg text-xs">
                <span className="font-medium text-slate-700">{s.name}</span>
                <span className="text-slate-400">{s.email}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PerformanceTab({ batchId }: { batchId: string }) {
  const { data, isPending, isError } = useBatchPerformance(batchId);

  if (isPending) return <div className="space-y-2 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}</div>;
  if (isError || !data) return <p className="text-xs text-slate-400 text-center py-10">Failed to load performance data.</p>;

  const trendIcon = data.batch.trend === 'up' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : data.batch.trend === 'down' ? <TrendingDown className="w-4 h-4 text-rose-500" /> : <Minus className="w-4 h-4 text-slate-400" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
        <div>
          <p className="text-[11px] text-slate-500">Batch Average Score</p>
          <p className="text-2xl font-black text-slate-900">{data.batch.avgScore}%</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold">{trendIcon} {data.batch.trend}</div>
      </div>

      {data.students.length === 0 ? <p className="text-xs text-slate-400">No students to rank yet.</p> : (
        <div className="space-y-1.5">
          {data.students.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-100 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-5 text-center font-bold text-slate-400">#{s.rank}</span>
                <span className="font-bold text-slate-900">{s.name}</span>
              </div>
              <span className={`font-bold ${s.status === 'excellent' ? 'text-emerald-600' : s.status === 'weak' ? 'text-rose-600' : s.status === 'average' ? 'text-amber-600' : 'text-slate-400'}`}>
                {s.status === 'unscored' ? 'No scores yet' : `${s.avgScore}%`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface BatchProfileDrawerProps {
  batchId: string | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

type DrawerTab = 'overview' | 'performance';

export function BatchProfileDrawer({ batchId, onClose, onEdit }: BatchProfileDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const { data: profile, isPending, isError } = useBatchProfile(batchId);
  const isOpen = !!batchId;

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity" onClick={onClose} aria-hidden="true" />}

      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`} role="dialog" aria-modal="true" aria-label="Batch Profile">
        {isOpen && isPending && <DrawerSkeleton />}

        {isOpen && isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load batch details.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200">Close</button>
          </div>
        )}

        {isOpen && !isPending && !isError && profile && (
          <>
            <div className="flex-shrink-0 p-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{[profile.classYear, profile.section, profile.academicYear].filter(Boolean).join(' · ') || 'No details set'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && <button onClick={() => onEdit(profile.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">Edit</button>}
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close drawer"><X className="w-4 h-4" /></button>
                </div>
              </div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10.5px] font-bold ${profile.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{profile.isActive ? 'Active' : 'Archived'}</span>
            </div>

            <div className="flex-shrink-0 flex border-b border-slate-100 bg-white px-5">
              {(['overview', 'performance'] as DrawerTab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>{t}</button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview' && <OverviewTab profile={profile} />}
              {tab === 'performance' && <PerformanceTab batchId={profile.id} />}
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
