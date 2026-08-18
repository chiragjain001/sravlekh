'use client';

import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus, Users, ClipboardList, Target, Zap, Plus } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useSwitchBatch } from '@/contexts/academic-context';


interface Batch    { id: string; label: string; strength: number; avgScore: number; trend: string; pendingActions: number }
interface Briefing { severity: string; headline: string; reasoning: string; actions: { label: string; type: string; topicHint?: string }[] }
interface Student  { id: string; name: string; avgScore: number; status: string }
interface Test     { id: string; name: string; date: string; avgScore: number; status: string }

interface Props {
  batch:    Batch;
  briefing: Briefing | undefined;
  students: Student[];
  tests:    Test[];
}

const sev = (s: string) => ({
  good:     { bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, text: 'text-emerald-800', btn: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200' },
  warning:  { bg: 'bg-amber-50  border-amber-200',   icon: <AlertTriangle className="w-5 h-5 text-amber-500"  />, text: 'text-amber-800',   btn: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200'     },
  critical: { bg: 'bg-rose-50   border-rose-200',    icon: <AlertTriangle className="w-5 h-5 text-rose-500"   />, text: 'text-rose-800',    btn: 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200'         },
}[s] ?? { bg: 'bg-slate-50 border-slate-200', icon: null, text: 'text-slate-700', btn: 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200' });

function TrendChip({ trend }: { trend: string }) {
  if (trend === 'up')   return <span className="flex items-center gap-0.5 text-emerald-600 font-bold text-[11px]"><TrendingUp className="w-3.5 h-3.5" /> Improving</span>;
  if (trend === 'down') return <span className="flex items-center gap-0.5 text-rose-600 font-bold text-[11px]"><TrendingDown className="w-3.5 h-3.5" /> Declining</span>;
  return                       <span className="flex items-center gap-0.5 text-slate-400 font-bold text-[11px]"><Minus className="w-3.5 h-3.5" /> Stable</span>;
}

export function BatchOverview({ batch, briefing, students, tests }: Props) {
  const { setTeacherNav } = useDashboardStore();
  const switchBatch = useSwitchBatch();
  const weak      = students.filter(s => s.status === 'weak').length;
  const excellent = students.filter(s => s.status === 'excellent').length;
  // Only show completed tests (not grading, not scheduled) — reduces clutter
  const completedTests = tests.filter(t => t.status === 'completed');
  const gradingTests   = tests.filter(t => t.status === 'grading');
  const style = briefing ? sev(briefing.severity) : null;

  return (
    <div className="space-y-6 animate-fadein">

      {/* AI Briefing */}
      {briefing && style && (
        <div className={`border rounded-2xl p-5 ${style.bg}`}>
          <div className="flex items-start gap-3 mb-3">
            {style.icon}
            <div>
              <p className={`text-[15px] font-bold leading-snug ${style.text}`}>{briefing.headline}</p>
              <p className="text-[12.5px] text-slate-600 mt-1 leading-relaxed">{briefing.reasoning}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pl-8">
            {briefing.actions.map((a, i) => (
              <button 
                key={i} 
                onClick={() => {
                  switchBatch(batch.id);
                  if (a.type === 'extra-class') {
                    setTeacherNav('remedial-extra');
                  } else if (a.type === 'assignment') {
                    setTeacherNav('assignments');
                  } else {
                    setTeacherNav('paper-builder');
                  }
                }}
                className={`px-4 py-1.5 border text-[12px] font-bold rounded-xl transition-all ${style.btn}`}
              >
                {a.label} →
              </button>
            ))}
            <button
              onClick={() => {
                switchBatch(batch.id);
                setTeacherNav('paper-builder');
              }}
              className="px-4 py-1.5 border border-indigo-300 bg-indigo-600 text-white text-[12px] font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Create Test for Batch {batch.label}
            </button>
          </div>
        </div>
      )}

      {/* KPIs — clean, actionable numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-indigo-500" /><p className="text-[11px] text-slate-500">Total Students</p></div>
          <p className="text-[24px] font-black text-slate-800 leading-tight">{batch.strength}</p>
          <TrendChip trend={batch.trend} />
        </div>
        <div className="card border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-emerald-500" /><p className="text-[11px] text-slate-500">Average Score</p></div>
          <p className={`text-[24px] font-black leading-tight ${batch.avgScore >= 75 ? 'text-emerald-600' : batch.avgScore >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>{batch.avgScore}%</p>
        </div>
        <div className="card border border-rose-50 rounded-2xl p-5 border">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-rose-500" /><p className="text-[11px] text-slate-500">Need Help</p></div>
          <p className={`text-[24px] font-black leading-tight ${weak > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{weak}</p>
          <p className="text-[10px] text-slate-400">students weak</p>
        </div>
        <div className="card border border-emerald-50 rounded-2xl p-5 border">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /><p className="text-[11px] text-slate-500">Excellent</p></div>
          <p className="text-[24px] font-black text-emerald-600 leading-tight">{excellent}</p>
          <p className="text-[10px] text-slate-400">students excelling</p>
        </div>
      </div>

      {/* Grading Alert — only if there's pending grading */}
      {gradingTests.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-amber-800">{gradingTests.length} test{gradingTests.length > 1 ? 's' : ''} pending grading</p>
              <p className="text-[11.5px] text-amber-600">{gradingTests.map(t => t.name).join(', ')}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap">Pending</span>
        </div>
      )}

      {/* Completed Tests summary — compact, no last test score repetition */}
      {completedTests.length > 0 && (
        <div className="card border border-slate-100 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-50">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <h3 className="text-[14px] font-bold text-slate-800">Test Performance Summary</h3>
            <span className="ml-auto text-[11px] text-slate-400">{completedTests.length} test{completedTests.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {completedTests.slice(0, 3).map(t => (
              <div key={t.id} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-[13px] font-semibold text-slate-700">{t.name}</p>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-slate-400">{t.date}</p>
                  <span className={`text-[13px] font-black ${t.avgScore >= 75 ? 'text-emerald-600' : t.avgScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{t.avgScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
