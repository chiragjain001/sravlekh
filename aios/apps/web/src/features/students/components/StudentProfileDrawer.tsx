'use client';
// ─── Student Profile Drawer ───────────────────────────────────────────────────
// Right-side drawer. Tabs: Overview | Academic | History — all sourced from
// StudentsService.findById (scoreRecords, masteryScores, profileHistory).

import React, { useState } from 'react';
import {
  X, User, TrendingUp, TrendingDown, AlertTriangle, Phone, Mail,
  Award, FileText, Clock, ChevronRight,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { StudentProfile } from '../types/student.types';
import { useStudentProfile } from '../hooks/useStudents';

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }} />
    </div>
  );
}

function DrawerSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse p-6 gap-4">
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="flex gap-2">
        {[1, 2, 3].map((i) => <div key={i} className="h-8 flex-1 bg-slate-100 rounded-lg" />)}
      </div>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  );
}

function avgScorePct(profile: StudentProfile) {
  if (profile.scoreRecords.length === 0) return null;
  const sum = profile.scoreRecords.reduce((a, r) => a + r.pct, 0);
  return Math.round(sum / profile.scoreRecords.length);
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────
function OverviewTab({ profile }: { profile: StudentProfile }) {
  const avg = avgScorePct(profile);
  const weakTopics = profile.masteryScores.filter((m) => m.score < 0.5);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Avg Score', value: avg !== null ? `${avg}%` : '—', icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Recent Tests', value: profile.scoreRecords.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Tracked Topics', value: profile.masteryScores.length, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Weak Topics (<50%)', value: weakTopics.length, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 flex items-center gap-3 border border-white`}>
            <div className={`${kpi.color} shrink-0`}><kpi.icon className="w-5 h-5" /></div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-900 leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {weakTopics.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Weak Topics
          </h4>
          {weakTopics.map((wt) => (
            <div key={wt.id} className="p-3 bg-rose-50 rounded-xl border border-rose-100">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-xs font-bold text-slate-900">{wt.topicName}</span>
                  <span className="text-[10px] text-slate-500 ml-2">{wt.subjectName}</span>
                </div>
                <span className="text-[10px] font-bold text-rose-600">{Math.round(wt.score * 100)}% mastery</span>
              </div>
              <ScoreBar score={wt.score * 100} color="#ef4444" />
            </div>
          ))}
        </div>
      )}

      {profile.masteryScores.length === 0 && profile.scoreRecords.length === 0 && (
        <div className="text-center py-10 text-xs text-slate-400">
          No test or mastery data recorded for this student yet.
        </div>
      )}
    </div>
  );
}

// ── Tab: Academic ──────────────────────────────────────────────────────────────
function AcademicTab({ profile }: { profile: StudentProfile }) {
  const chartData = [...profile.scoreRecords]
    .filter((r) => r.exam?.scheduledDate)
    .sort((a, b) => new Date(a.exam!.scheduledDate!).getTime() - new Date(b.exam!.scheduledDate!).getTime())
    .map((r) => ({ name: r.exam?.title.slice(0, 14) ?? 'Exam', score: r.pct }));

  return (
    <div className="space-y-5">
      {chartData.length > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Score Trend
          </h4>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Test History</h4>
        {profile.scoreRecords.length === 0 && <p className="text-xs text-slate-400">No test results yet.</p>}
        {profile.scoreRecords.map((test) => (
          <div key={test.id} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${test.pct >= 75 ? 'bg-emerald-100' : test.pct >= 55 ? 'bg-amber-100' : 'bg-rose-100'}`}>
                <FileText className={`w-4 h-4 ${test.pct >= 75 ? 'text-emerald-600' : test.pct >= 55 ? 'text-amber-600' : 'text-rose-600'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{test.exam?.title ?? 'Exam'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{test.exam?.scheduledDate ? new Date(test.exam.scheduledDate).toLocaleDateString() : '—'}</p>
              </div>
            </div>
            <p className={`text-sm font-bold ${test.pct >= 75 ? 'text-emerald-600' : test.pct >= 55 ? 'text-amber-600' : 'text-rose-600'}`}>
              {test.score}/{test.maxScore} ({test.pct}%)
            </p>
          </div>
        ))}
      </div>

      {profile.masteryScores.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Topic Mastery</h4>
          {profile.masteryScores.map((m) => (
            <div key={m.id}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">{m.topicName} <span className="text-slate-400">· {m.subjectName}</span></span>
                <span className="font-bold text-slate-900">{Math.round(m.score * 100)}%</span>
              </div>
              <ScoreBar score={m.score * 100} color={m.score >= 0.6 ? '#10b981' : m.score >= 0.4 ? '#f59e0b' : '#ef4444'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: History ──────────────────────────────────────────────────────────────
function HistoryTab({ profile }: { profile: StudentProfile }) {
  if (profile.profileHistory.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-10">No history recorded yet.</p>;
  }
  return (
    <div className="space-y-3 relative">
      <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-100" />
      {profile.profileHistory.map((ev) => (
        <div key={ev.id} className="flex items-start gap-4 relative pl-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 bg-indigo-100 text-indigo-600">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-slate-900">{ev.eventType.replace(/_/g, ' ')}</p>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{new Date(ev.changedAt).toLocaleString()}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">{ev.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

interface StudentProfileDrawerProps {
  studentId: string | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

type DrawerTab = 'overview' | 'academic' | 'history';

export function StudentProfileDrawer({ studentId, onClose, onEdit }: StudentProfileDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const { data: profile, isPending, isError } = useStudentProfile(studentId);

  const isOpen = !!studentId;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity" onClick={onClose} aria-hidden="true" />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog" aria-modal="true" aria-label="Student Profile"
      >
        {isOpen && isPending && <DrawerSkeleton />}

        {isOpen && isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load student profile.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200">Close</button>
          </div>
        )}

        {isOpen && !isPending && !isError && profile && (
          <>
            <div className="flex-shrink-0 p-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                    {profile.avatarInitials}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.rollNumber ?? 'No roll no.'} · {profile.batchLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button onClick={() => onEdit(profile.id)} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                      Edit
                    </button>
                  )}
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close drawer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10.5px] flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full border font-bold ${profile.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                  {profile.status}
                </span>
                <span className="flex items-center gap-1 text-slate-500"><Mail className="w-3 h-3" /> {profile.email}</span>
                {profile.guardianPhone && <span className="flex items-center gap-1 text-slate-500"><Phone className="w-3 h-3" /> {profile.guardianPhone} (guardian)</span>}
              </div>
            </div>

            <div className="flex-shrink-0 flex border-b border-slate-100 bg-white px-5">
              {(['overview', 'academic', 'history'] as DrawerTab[]).map((t) => (
                <button
                  key={t} onClick={() => setTab(t)}
                  className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview' && <OverviewTab profile={profile} />}
              {tab === 'academic' && <AcademicTab profile={profile} />}
              {tab === 'history' && <HistoryTab profile={profile} />}
            </div>

            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
