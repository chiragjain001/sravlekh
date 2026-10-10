'use client';

import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus, Users, ClipboardList, Target, Plus } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useSwitchBatch } from '@/contexts/academic-context';
import { useBatchPerformance, useExams } from '@/hooks/useApi';
import { toDisplayExamStatus } from '@/lib/exam-status';
import { ScreenLoadingState } from '@/components/ui/foundation';

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
    return (
      <ScreenLoadingState
        title="Loading Batch Overview..."
        subtitle="Computing batch performance, average scores, and student analytics..."
        layout="overview"
      />
    );
  }

  const students = performance?.students ?? [];
  const weak      = students.filter((s: any) => s.status === 'weak').length;
  const excellent = students.filter((s: any) => s.status === 'excellent').length;
  const gradingExams = exams.filter((e: any) => toDisplayExamStatus(e.status) === 'grading');
  const completedExams = exams.filter((e: any) => toDisplayExamStatus(e.status) === 'completed');
  const avgScore = performance?.batch.avgScore ?? 0;
  const hasCompletedExams = completedExams.length > 0;

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadein">
      {/* ── iOS-Grade 2x2 / 4-Col KPI Widget Grid ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Students */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 truncate">Total Students</p>
          </div>
          <p className="text-[22px] sm:text-[26px] font-black text-slate-800 leading-tight mb-1">
            {performance?.batch.studentCount ?? 0}
          </p>
          <div className="pt-0.5">
            <TrendChip trend={performance?.batch.trend ?? 'stable'} />
          </div>
        </div>

        {/* Average Score */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between min-w-0">
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
              <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 truncate">Average Score</p>
          </div>
          <p className={`text-[22px] sm:text-[26px] font-black leading-tight mb-1 ${
            !hasCompletedExams && avgScore === 0
              ? 'text-slate-700'
              : avgScore >= 75
              ? 'text-emerald-600'
              : avgScore >= 65
              ? 'text-amber-600'
              : 'text-rose-600'
          }`}>
            {avgScore}%
          </p>
          <p className="text-[10px] sm:text-[10.5px] text-slate-400 font-medium">
            {hasCompletedExams ? 'Class aggregate' : 'No tests graded yet'}
          </p>
        </div>

        {/* Need Help */}
        <div className={`rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between min-w-0 border ${
          weak > 0 ? 'bg-rose-50/20 border-rose-100' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 truncate">Need Help</p>
          </div>
          <p className={`text-[22px] sm:text-[26px] font-black leading-tight mb-1 ${weak > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
            {weak}
          </p>
          <p className="text-[10px] sm:text-[10.5px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${weak > 0 ? 'bg-rose-500 animate-pulse' : 'bg-slate-300'}`} />
            <span>{weak === 1 ? '1 student weak' : `${weak} students weak`}</span>
          </p>
        </div>

        {/* Excellent */}
        <div className={`rounded-2xl p-3.5 sm:p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between min-w-0 border ${
          excellent > 0 ? 'bg-emerald-50/20 border-emerald-100' : 'bg-white border-slate-100'
        }`}>
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            <p className="text-[11px] sm:text-[12px] font-bold text-slate-500 truncate">Excellent</p>
          </div>
          <p className="text-[22px] sm:text-[26px] font-black text-emerald-600 leading-tight mb-1">
            {excellent}
          </p>
          <p className="text-[10px] sm:text-[10.5px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${excellent > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            <span>{excellent === 1 ? '1 student excelling' : `${excellent} students excelling`}</span>
          </p>
        </div>
      </div>

      {/* ── Action Button ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 pt-1">
        <button
          onClick={() => { switchBatch(batchId); setTeacherNav('paper-builder'); }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-bold rounded-xl shadow-xs hover:shadow transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Test for This Batch</span>
        </button>
      </div>

      {/* ── Pending Grading Alert ─────────────────────────────────────────── */}
      {gradingExams.length > 0 && (
        <div className="p-3.5 sm:p-4 bg-amber-50/90 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[12.5px] sm:text-[13px] font-bold text-amber-900 truncate">
                {gradingExams.length} test{gradingExams.length > 1 ? 's' : ''} pending grading
              </p>
              <p className="text-[11px] sm:text-[11.5px] text-amber-700 truncate">
                {gradingExams.map((e: any) => e.title).join(', ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => setTeacherNav('evaluation-queue')}
            className="w-full sm:w-auto text-[12px] font-bold text-amber-800 bg-amber-200/80 hover:bg-amber-200 active:scale-[0.98] px-3.5 py-2 rounded-xl transition-all text-center flex-shrink-0"
          >
            Grade Now
          </button>
        </div>
      )}

      {/* ── Recent Tests List ─────────────────────────────────────────────── */}
      {completedExams.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
          <div className="flex items-center gap-2 px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100/80">
            <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800">Recent Tests</h3>
            <span className="ml-auto text-[10.5px] sm:text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {completedExams.length} test{completedExams.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="divide-y divide-slate-100/80">
            {completedExams.slice(0, 3).map((e: any) => (
              <div key={e.id} className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-3.5 hover:bg-slate-50/50 transition-colors">
                <p className="text-[12.5px] sm:text-[13px] font-semibold text-slate-800 truncate pr-3">{e.title}</p>
                <p className="text-[11px] text-slate-400 flex-shrink-0 font-medium">
                  {e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
