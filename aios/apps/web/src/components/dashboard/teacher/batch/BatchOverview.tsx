'use client';

import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus, Users, ClipboardList, Target, Plus } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useSwitchBatch } from '@/contexts/academic-context';
import { useBatchPerformance, useExams } from '@/hooks/useApi';
import { toDisplayExamStatus } from '@/lib/exam-status';

function TrendChip({ trend }: { trend: string }) {
  if (trend === 'up')   return <span className="flex items-center gap-0.5 text-emerald-600 font-bold text-[11px]"><TrendingUp className="w-3.5 h-3.5" /> Improving</span>;
  if (trend === 'down') return <span className="flex items-center gap-0.5 text-rose-600 font-bold text-[11px]"><TrendingDown className="w-3.5 h-3.5" /> Declining</span>;
  return                       <span className="flex items-center gap-0.5 text-slate-400 font-bold text-[11px]"><Minus className="w-3.5 h-3.5" /> Stable</span>;
}

export function BatchOverview({ batchId }: { batchId: string }) {
  const { setTeacherNav } = useDashboardStore();
  const switchBatch = useSwitchBatch();
  const { data: performance, isLoading } = useBatchPerformance(batchId);
  const { data: examsResp } = useExams({ batchId });
  const exams: any[] = examsResp?.data ?? examsResp ?? [];

  if (isLoading) {
    return <div className="py-16 text-center text-slate-400 text-[13px] animate-fadein">Loading batch overview…</div>;
  }

  const students = performance?.students ?? [];
  const weak      = students.filter((s: any) => s.status === 'weak').length;
  const excellent = students.filter((s: any) => s.status === 'excellent').length;
  const gradingExams = exams.filter((e: any) => toDisplayExamStatus(e.status) === 'grading');
  const completedExams = exams.filter((e: any) => toDisplayExamStatus(e.status) === 'completed');

  return (
    <div className="space-y-6 animate-fadein">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-indigo-500" /><p className="text-[11px] text-slate-500">Total Students</p></div>
          <p className="text-[24px] font-black text-slate-800 leading-tight">{performance?.batch.studentCount ?? 0}</p>
          <TrendChip trend={performance?.batch.trend ?? 'stable'} />
        </div>
        <div className="card border border-slate-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-emerald-500" /><p className="text-[11px] text-slate-500">Average Score</p></div>
          <p className={`text-[24px] font-black leading-tight ${(performance?.batch.avgScore ?? 0) >= 75 ? 'text-emerald-600' : (performance?.batch.avgScore ?? 0) >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>{performance?.batch.avgScore ?? 0}%</p>
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

      <div className="flex justify-end">
        <button
          onClick={() => { switchBatch(batchId); setTeacherNav('paper-builder'); }}
          className="px-4 py-1.5 border border-indigo-300 bg-indigo-600 text-white text-[12px] font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Create Test for This Batch
        </button>
      </div>

      {gradingExams.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-amber-800">{gradingExams.length} test{gradingExams.length > 1 ? 's' : ''} pending grading</p>
              <p className="text-[11.5px] text-amber-600">{gradingExams.map((e: any) => e.title).join(', ')}</p>
            </div>
          </div>
          <button
            onClick={() => setTeacherNav('evaluation-queue')}
            className="text-[11px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap hover:bg-amber-200 transition-colors"
          >
            Grade Now
          </button>
        </div>
      )}

      {completedExams.length > 0 && (
        <div className="card border border-slate-100 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 p-4 border-b border-slate-50">
            <ClipboardList className="w-4 h-4 text-slate-500" />
            <h3 className="text-[14px] font-bold text-slate-800">Recent Tests</h3>
            <span className="ml-auto text-[11px] text-slate-400">{completedExams.length} test{completedExams.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {completedExams.slice(0, 3).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3.5">
                <p className="text-[13px] font-semibold text-slate-700">{e.title}</p>
                <p className="text-[11px] text-slate-400">{e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
