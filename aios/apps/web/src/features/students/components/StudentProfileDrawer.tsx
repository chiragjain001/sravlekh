'use client';
// ─── Student Profile Drawer ───────────────────────────────────────────────────
// Right-side drawer. Opens without navigation. Full student profile view.
// Tabs: Overview | Academic | Attendance | Timeline

import React, { useState } from 'react';
import {
  X, User, BookOpen, CalendarCheck, Clock, TrendingUp, TrendingDown,
  Minus, AlertTriangle, CheckCircle, Info, Phone, Mail, GraduationCap,
  Award, FileText, Activity, BarChart2, ChevronRight, Sparkles,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from 'recharts';
import type { StudentProfile } from '../types/student.types';
import { useStudentProfile } from '../hooks/useStudents';

// ── Helpers ────────────────────────────────────────────────────────────────────
function riskColor(risk: string) {
  if (risk === 'low')      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (risk === 'medium')   return 'bg-amber-100 text-amber-700 border-amber-200';
  if (risk === 'high')     return 'bg-rose-100 text-rose-700 border-rose-200';
  return 'bg-red-200 text-red-800 border-red-300';
}

function feeColor(fee: string) {
  if (fee === 'paid')   return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (fee === 'partial') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all duration-700"
        style={{ width: `${Math.min(score, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function DrawerSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse p-6 gap-4">
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="flex gap-2">
        {[1,2,3,4].map((i) => <div key={i} className="h-8 flex-1 bg-slate-100 rounded-lg" />)}
      </div>
      {[1,2,3,4,5].map((i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

// ── Tab: Overview ──────────────────────────────────────────────────────────────
function OverviewTab({ profile }: { profile: StudentProfile }) {
  const radarData = profile.subjectScores.map((s) => ({
    subject: s.subject, score: s.score, fullMark: 100,
  }));

  return (
    <div className="space-y-5">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Avg Score',   value: `${profile.avgScore}%`,        icon: Award,         color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Attendance',  value: `${profile.attendancePct}%`,   icon: CalendarCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Batch Rank',  value: profile.rank ?? '—',           icon: TrendingUp,    color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Weak Topics', value: profile.weakTopicsCount,       icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 flex items-center gap-3 border border-white`}>
            <div className={`${kpi.color} shrink-0`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-900 leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      {profile.aiInsights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-violet-500" /> AI Insights
          </h4>
          {profile.aiInsights.map((ins, idx) => (
            <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
              ins.type === 'warning' ? 'bg-rose-50 border-rose-100 text-rose-800'
              : ins.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-blue-50 border-blue-100 text-blue-800'
            }`}>
              {ins.type === 'warning' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
               : ins.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
               : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
              <span className="flex-1 font-medium">{ins.message}</span>
              {ins.action && (
                <button className="ml-2 shrink-0 font-bold underline underline-offset-2">{ins.action}</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Subject Scores */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Subject Performance</h4>
        <div className="space-y-3">
          {profile.subjectScores.map((s) => (
            <div key={s.subject}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">{s.subject}</span>
                <span className="font-bold text-slate-900">{s.score}%</span>
              </div>
              <ScoreBar score={s.score} color={s.color} />
            </div>
          ))}
        </div>
      </div>

      {/* Radar Chart */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Subject Radar</h4>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#64748b' }} />
              <Radar name="Score" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assignments */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Assignments</h4>
        <div className="grid grid-cols-4 gap-3 text-center">
          {[
            { label: 'Total',     value: profile.assignmentStats.total,     color: 'text-slate-900' },
            { label: 'Submitted', value: profile.assignmentStats.submitted,  color: 'text-emerald-600' },
            { label: 'Graded',    value: profile.assignmentStats.graded,     color: 'text-indigo-600' },
            { label: 'Overdue',   value: profile.assignmentStats.overdue,    color: 'text-rose-600' },
          ].map((item) => (
            <div key={item.label}>
              <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Academic ──────────────────────────────────────────────────────────────
function AcademicTab({ profile }: { profile: StudentProfile }) {
  const chartData = profile.testHistory.map((t) => ({
    name: t.testName.replace('JEE Main ', '').replace('Mock Test ', 'MT'),
    score: t.pct,
  })).reverse();

  return (
    <div className="space-y-5">
      {/* Score Trend */}
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

      {/* Test History */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Test History</h4>
        {profile.testHistory.map((test) => (
          <div key={test.testId} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 hover:border-indigo-200 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                test.pct >= 75 ? 'bg-emerald-100' : test.pct >= 55 ? 'bg-amber-100' : 'bg-rose-100'
              }`}>
                <FileText className={`w-4 h-4 ${test.pct >= 75 ? 'text-emerald-600' : test.pct >= 55 ? 'text-amber-600' : 'text-rose-600'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">{test.testName}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{test.date}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${test.pct >= 75 ? 'text-emerald-600' : test.pct >= 55 ? 'text-amber-600' : 'text-rose-600'}`}>
                {test.pct}%
              </p>
              {test.batchRank && <p className="text-[10px] text-slate-400">Rank #{test.batchRank}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Weak Topics */}
      {profile.weakTopics.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Weak Topics
          </h4>
          {profile.weakTopics.map((wt, idx) => (
            <div key={idx} className="p-3 bg-rose-50 rounded-xl border border-rose-100">
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-xs font-bold text-slate-900">{wt.topic}</span>
                  <span className="text-[10px] text-slate-500 ml-2">{wt.subject}</span>
                </div>
                <div className="flex items-center gap-1">
                  {wt.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                   : wt.trend === 'down' ? <TrendingDown className="w-3 h-3 text-rose-500" />
                   : <Minus className="w-3 h-3 text-slate-400" />}
                  <span className={`text-[10px] font-bold ${wt.mastery >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                    {wt.mastery}% mastery
                  </span>
                </div>
              </div>
              <ScoreBar score={wt.mastery} color={wt.mastery >= 60 ? '#f59e0b' : '#ef4444'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tab: Attendance ────────────────────────────────────────────────────────────
function AttendanceTab({ profile }: { profile: StudentProfile }) {
  return (
    <div className="space-y-5">
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
        <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Monthly Attendance</h4>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={profile.attendanceHistory} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
              <Bar dataKey="pct" fill="#10b981" radius={[4, 4, 0, 0]} name="Attendance %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="space-y-2">
        {profile.attendanceHistory.map((row) => (
          <div key={row.month} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100">
            <span className="text-xs font-bold text-slate-700 w-8">{row.month}</span>
            <div className="flex-1 mx-3">
              <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                <div className="bg-emerald-500 h-full" style={{ width: `${row.pct}%` }} />
              </div>
            </div>
            <div className="text-right text-[10px] font-medium text-slate-500 w-28">
              <span className="text-emerald-600 font-bold">{row.present}P</span>
              {' / '}
              <span className="text-rose-500 font-bold">{row.absent}A</span>
              {' / '}
              <span className="font-bold text-slate-700">{row.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Timeline ──────────────────────────────────────────────────────────────
function TimelineTab({ profile }: { profile: StudentProfile }) {
  const typeIcon: Record<string, React.ReactNode> = {
    enrolled:     <User className="w-3.5 h-3.5" />,
    test:         <FileText className="w-3.5 h-3.5" />,
    fee:          <Award className="w-3.5 h-3.5" />,
    attendance:   <CalendarCheck className="w-3.5 h-3.5" />,
    intervention: <AlertTriangle className="w-3.5 h-3.5" />,
    note:         <Info className="w-3.5 h-3.5" />,
  };

  const typeColor: Record<string, string> = {
    enrolled:     'bg-indigo-100 text-indigo-600',
    test:         'bg-blue-100 text-blue-600',
    fee:          'bg-emerald-100 text-emerald-600',
    attendance:   'bg-amber-100 text-amber-600',
    intervention: 'bg-rose-100 text-rose-600',
    note:         'bg-slate-100 text-slate-600',
  };

  return (
    <div className="space-y-3 relative">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100" />
      {profile.timeline.map((ev) => (
        <div key={ev.id} className="flex items-start gap-4 relative pl-4">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 z-10 ${typeColor[ev.type] ?? 'bg-slate-100 text-slate-600'}`}>
            {typeIcon[ev.type]}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-slate-900">{ev.title}</p>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{ev.date}</span>
            </div>
            {ev.detail && <p className="text-[11px] text-slate-500 mt-0.5">{ev.detail}</p>}
            <p className="text-[10px] text-slate-400 mt-0.5">by {ev.actor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Drawer ────────────────────────────────────────────────────────────────
interface StudentProfileDrawerProps {
  studentId: string | null;
  onClose:   () => void;
  onEdit?:   (id: string) => void;
}

type DrawerTab = 'overview' | 'academic' | 'attendance' | 'timeline';

export function StudentProfileDrawer({ studentId, onClose, onEdit }: StudentProfileDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('overview');
  const { data: profile, isLoading, isError } = useStudentProfile(studentId);

  const isOpen = !!studentId;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Student Profile"
      >
        {isLoading && <DrawerSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load student profile.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        )}

        {!isLoading && !isError && profile && (
          <>
            {/* Header */}
            <div className="flex-shrink-0 p-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                    {profile.avatarInitials}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.rollNo} · {profile.batchLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(profile.id)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
                    aria-label="Close drawer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick info row */}
              <div className="flex items-center gap-4 text-[10.5px] flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full border font-bold ${riskColor(profile.riskLevel)}`}>
                  {profile.riskLevel.charAt(0).toUpperCase() + profile.riskLevel.slice(1)} Risk
                </span>
                <span className={`px-2.5 py-0.5 rounded-full border font-bold ${feeColor(profile.feeStatus)}`}>
                  Fee {profile.feeStatus.charAt(0).toUpperCase() + profile.feeStatus.slice(1)}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Mail className="w-3 h-3" /> {profile.email}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Phone className="w-3 h-3" /> {profile.phone}
                </span>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex-shrink-0 flex border-b border-slate-100 bg-white px-5">
              {(['overview', 'academic', 'attendance', 'timeline'] as DrawerTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${
                    tab === t
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview'    && <OverviewTab    profile={profile} />}
              {tab === 'academic'    && <AcademicTab    profile={profile} />}
              {tab === 'attendance'  && <AttendanceTab  profile={profile} />}
              {tab === 'timeline'    && <TimelineTab    profile={profile} />}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-[10px] text-slate-400">
                Last active {new Date(profile.lastActiveAt).toLocaleDateString()}
              </p>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors">
                  Send Alert
                </button>
                <button className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
