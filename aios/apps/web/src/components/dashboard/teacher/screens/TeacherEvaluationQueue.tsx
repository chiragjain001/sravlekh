'use client';

import { PenTool, CheckCircle2, ChevronRight, AlertCircle } from 'lucide-react';
import { tests, batches } from '@/lib/mock-data/teacher';
import { useDashboardStore } from '@/store/dashboard-store';

export function TeacherEvaluationQueue() {
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();

  const gradingTests = tests.filter(t => t.status === 'grading');

  const getProgress = (graded: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((graded / total) * 100);
  };

  const handleStartGrading = (batchId: string, testId: string) => {
    setTeacherCtx({ batchId, testId, batchTab: 'tests' });
    setTeacherNav('classes');
  };

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Evaluation Queue</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Track and manage pending copy evaluations across all your batches.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-[13px] font-semibold text-slate-500 mb-1">Total Pending Copies</p>
          <p className="text-[28px] font-black text-rose-600">39</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="text-[13px] font-semibold text-slate-500 mb-1">Tests in Queue</p>
          <p className="text-[28px] font-black text-amber-600">{gradingTests.length}</p>
        </div>
        <div className="bg-indigo-600 border border-indigo-700 rounded-2xl p-5 shadow-sm text-white">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-indigo-200" />
            <p className="text-[13px] font-semibold text-indigo-200">Next Deadline</p>
          </div>
          <p className="text-[22px] font-bold">Tomorrow, 10:00 AM</p>
          <p className="text-[12px] text-indigo-300 mt-0.5">JEE Main Mock Test 07</p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-[15px] font-bold text-slate-800">Active Queue</h2>
        {gradingTests.map(t => {
          const batch = batches.find(b => b.id === t.batchId);
          const pct = getProgress(t.graded, t.attempted);
          const remaining = t.attempted - t.graded;

          return (
            <div key={t.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
                    <PenTool className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-slate-800">{t.name}</h3>
                    <p className="text-[13px] text-slate-500 mt-0.5">Batch {batch?.label || t.batchId} • Conducted {t.date}</p>
                    
                    <div className="flex items-center gap-4 mt-3">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                        <span className="w-2 h-2 rounded-full bg-slate-400" /> {t.attempted} Total Copies
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {t.graded} Graded
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md">
                        <AlertCircle className="w-3.5 h-3.5" /> {remaining} Pending
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-3 min-w-[200px]">
                  <div className="w-full">
                    <div className="flex justify-between text-[11px] font-bold mb-1.5">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-indigo-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartGrading(t.batchId, t.id)}
                    className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white text-[12.5px] font-bold rounded-xl hover:bg-slate-800 transition-colors w-full justify-center md:w-auto"
                  >
                    Start Grading <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {gradingTests.length === 0 && (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-800">All Caught Up!</h3>
            <p className="text-[13px] text-slate-500 mt-1">There are no pending copies to evaluate across your batches.</p>
          </div>
        )}
      </div>
    </div>
  );
}
