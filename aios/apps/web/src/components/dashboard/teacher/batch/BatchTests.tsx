'use client';

import { useState } from 'react';
import { Plus, Edit3, ChevronRight, X, AlertTriangle, ClipboardList } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { useSwitchBatch } from '@/contexts/academic-context';
import { useExams, useExamResults } from '@/hooks/useApi';
import { toDisplayExamStatus } from '@/lib/exam-status';
import { EmptyState } from '@/components/ui/foundation';

const statusStyle = (s: string) => ({
  scheduled: 'bg-purple-100 text-purple-700',
  grading:   'bg-amber-100  text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}[s] ?? 'bg-slate-100 text-slate-500');

function TestDetailModal({ exam, onClose }: { exam: any; onClose: () => void }) {
  const { setTeacherNav } = useDashboardStore();
  const { data: results, isLoading } = useExamResults(exam.id);
  const displayStatus = toDisplayExamStatus(exam.status);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadein"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] sm:h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${statusStyle(displayStatus)}`}>{exam.status}</span>
              <h2 className="text-[18px] font-black text-slate-800 leading-tight">{exam.title}</h2>
            </div>
            {results && (
              <p className="text-[13px] text-slate-500 font-medium">
                {results.summary.participated} students · Avg: <span className="font-bold text-slate-700">{results.summary.avgScore}%</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 bg-slate-50 p-5 space-y-4">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-[13px]">Loading results…</div>
          ) : (
            <>
              {displayStatus === 'grading' && (
                <button
                  onClick={() => setTeacherNav('evaluation-queue')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white text-[13px] font-bold rounded-xl hover:bg-slate-800 transition-all"
                >
                  <ClipboardList className="w-4 h-4" /> Continue Grading in Evaluation Queue ({results?.summary.graded ?? 0}/{results?.summary.participated ?? 0})
                </button>
              )}

              {(results?.questionAnalysis.length ?? 0) > 0 ? (
                <div className="flex flex-col gap-3">
                  {[...results!.questionAnalysis].sort((a: any, b: any) => a.correctPct - b.correctPct).map((q: any) => (
                    <div key={q.questionId} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-indigo-200 transition-colors flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[14px] font-bold text-slate-800 leading-tight">{q.topic}</p>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${q.difficulty === 'HARD' ? 'bg-rose-100 text-rose-700' : q.difficulty === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{q.difficulty}</span>
                        </div>
                        <p className="text-[12px] text-slate-500 max-w-md truncate">{q.content}</p>
                      </div>
                      <span className={`font-black text-[18px] ${q.correctPct < 50 ? 'text-rose-600' : q.correctPct < 70 ? 'text-amber-600' : 'text-emerald-600'}`}>{q.correctPct}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center text-center text-slate-400">
                  <AlertTriangle className="w-8 h-8 opacity-20 mb-3" />
                  <p className="text-[13px] font-semibold">Analysis not available yet.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function BatchTests({ batchId }: { batchId: string }) {
  const { setTeacherNav } = useDashboardStore();
  const switchBatch = useSwitchBatch();
  const [activeExamId, setActiveExamId] = useState<string | null>(null);

  const { data: examsResp, isLoading } = useExams({ batchId });
  const exams: any[] = examsResp?.data ?? examsResp ?? [];
  const activeExam = activeExamId ? exams.find((e: any) => e.id === activeExamId) : null;

  const upcoming = exams.filter((e: any) => toDisplayExamStatus(e.status) === 'scheduled');
  const completed = exams.filter((e: any) => toDisplayExamStatus(e.status) !== 'scheduled');

  const renderRow = (e: any) => {
    const displayStatus = toDisplayExamStatus(e.status);
    const isInteractive = displayStatus !== 'scheduled';

    return (
      <button
        key={e.id}
        onClick={() => isInteractive && setActiveExamId(e.id)}
        disabled={!isInteractive}
        className={`w-full flex items-center gap-4 p-5 border border-slate-100 rounded-2xl mb-3 text-left transition-all ${
          isInteractive ? 'hover:border-indigo-200 hover:shadow-sm group cursor-pointer bg-white' : 'bg-slate-50/50 cursor-default'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-bold leading-tight transition-colors ${isInteractive ? 'text-slate-800 group-hover:text-indigo-700' : 'text-slate-600'}`}>{e.title}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : 'Not scheduled'}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize ${statusStyle(displayStatus)}`}>{e.status}</span>
          {isInteractive && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fadein">
      {activeExam && <TestDetailModal exam={activeExam} onClose={() => setActiveExamId(null)} />}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Tests for this batch</h3>
        <button
          onClick={() => { switchBatch(batchId); setTeacherNav('paper-builder'); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Create Test
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-[13px]">Loading tests…</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">Upcoming</h4>
              {upcoming.map(renderRow)}
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">Completed / In Grading</h4>
              {completed.map(renderRow)}
            </div>
          )}

          {exams.length === 0 && (
            <EmptyState
              icon={<Edit3 className="w-7 h-7" />}
              title="No tests yet"
              description="Create the first test for this batch."
              action={{ label: '+ Create Test', onClick: () => { switchBatch(batchId); setTeacherNav('paper-builder'); } }}
            />
          )}
        </>
      )}
    </div>
  );
}
