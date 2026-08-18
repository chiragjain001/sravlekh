'use client';

import { useState } from 'react';
import { Plus, Edit3, Save, CheckCircle2, ChevronRight, X, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDashboardStore } from '@/store/dashboard-store';
import { useSwitchBatch } from '@/contexts/academic-context';
import { EmptyState } from '@/components/ui/foundation';
import { useGradingStore } from '@/store/grading-store';

interface Test {
  id: string; name: string; date: string;
  totalStudents: number; attempted: number; graded: number;
  avgScore: number; topScore: number; status: string;
}
interface Evaluation { studentId: string; name: string; rollNo: string; marksObtained: number; totalMarks: number; status: string }
interface QAnalysis  { q: string; topic: string; subtopic: string; correctPct: number; difficulty: string; avgTimeSec: number }

const statusStyle = (s: string) => ({
  scheduled: 'bg-purple-100 text-purple-700',
  grading:   'bg-amber-100  text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}[s] ?? 'bg-slate-100 text-slate-500');

// ─── Test Detail Modal ────────────────────────────────────────────────────────
// P0-2: marks now live in useGradingStore (session-persistent) instead of local
// useState, so they survive modal close/reopen within the same browser session.
function TestDetailModal({
  test, evals, qData, onClose
}: {
  test: Test;
  evals: Evaluation[];
  qData: QAnalysis[];
  onClose: () => void;
}) {
  const [gradingTab, setGradingTab] = useState<'analysis' | 'grading'>('analysis');
  const { getMark, setMark, saveMark, isSaved } = useGradingStore();

  // Sort students alphabetically for grading view
  const sortedEvals = [...evals].sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = (studentId: string, totalMarks: number) => {
    const val = getMark(test.id, studentId);
    if (!val || Number(val) < 0 || Number(val) > totalMarks) {
      toast.error(`Enter a valid mark between 0 and ${totalMarks}.`);
      return;
    }
    saveMark(test.id, studentId);
    toast.success('Mark saved.');
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadein"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[90vh] sm:h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${statusStyle(test.status)}`}>{test.status}</span>
              <h2 className="text-[18px] font-black text-slate-800 leading-tight">{test.name}</h2>
            </div>
            <p className="text-[13px] text-slate-500 font-medium">
              {test.date} · {test.totalStudents} students · Avg: <span className="font-bold text-slate-700">{test.avgScore}%</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Test detail modal tabs" className="flex gap-1 p-3 bg-white border-b border-slate-100">
          {(['analysis', 'grading'] as const).map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={gradingTab === tab}
              onClick={() => setGradingTab(tab)}
              className={`px-5 py-2 text-[13px] font-bold rounded-xl capitalize transition-all ${
                gradingTab === tab ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab === 'grading' ? `Grading (${test.graded}/${test.totalStudents})` : 'Question Analysis'}
            </button>
          ))}
        </div>

        {/* Scrollable Content Area */}
        <div className="overflow-y-auto flex-1 bg-slate-50 p-5">
          
          {/* Question Analysis Tab */}
          {gradingTab === 'analysis' && (
            qData.length > 0 ? (
              <div className="flex flex-col gap-3">
                {[...qData].sort((a,b) => a.correctPct - b.correctPct).map(q => (
                  <div key={q.q} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-indigo-200 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[13px] font-black text-slate-700">
                        {q.q}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[14px] font-bold text-slate-800 leading-tight">{q.topic}</p>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                            q.difficulty==='hard'?'bg-rose-100 text-rose-700':q.difficulty==='medium'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'
                          }`}>{q.difficulty}</span>
                        </div>
                        <p className="text-[12px] text-slate-500">{q.subtopic}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      {q.correctPct < 50 && <span className="text-[10px] bg-rose-100 text-rose-700 px-2.5 py-1 rounded-md font-bold tracking-wide">WEAK AREA</span>}
                      <div className="text-right w-16">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Correct</p>
                        <span className={`font-black text-[18px] ${q.correctPct<50?'text-rose-600':q.correctPct<70?'text-amber-600':'text-emerald-600'}`}>{q.correctPct}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 flex flex-col items-center text-center text-slate-400">
                <AlertTriangle className="w-8 h-8 opacity-20 mb-3" />
                <p className="text-[13px] font-semibold">Analysis not available yet.</p>
              </div>
            )
          )}

          {/* Grading Tab */}
          {gradingTab === 'grading' && (
            <div className="flex flex-col gap-3">
              {sortedEvals.map(ev => {
                const isGraded = ev.status === 'graded' || isSaved(test.id, ev.studentId);
                const currentMark = getMark(test.id, ev.studentId);
                return (
                  <div key={ev.studentId} className={`bg-white border rounded-2xl p-4 shadow-sm transition-all flex items-center justify-between ${isGraded ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200 hover:border-indigo-200'}`}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-black text-slate-600">
                        {ev.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-[14px] font-bold text-slate-800 leading-tight">{ev.name}</p>
                        <p className="text-[12px] text-slate-500 mt-0.5">Roll: {ev.rollNo}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {isGraded ? (
                        <>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Marks</p>
                            <span className="text-[18px] font-black text-slate-800">
                              {isSaved(test.id, ev.studentId) ? currentMark : ev.marksObtained}
                              <span className="text-slate-400 font-semibold text-[14px]">/{ev.totalMarks}</span>
                            </span>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1 mr-1">Enter Marks</p>
                            <div className="flex items-center gap-1.5 text-slate-400 text-[14px] font-bold">
                              <input 
                                type="number" min={0} max={ev.totalMarks} placeholder="—"
                                value={currentMark}
                                onChange={e => setMark(test.id, ev.studentId, e.target.value)}
                                className="w-16 text-center px-2 py-1.5 border border-slate-200 rounded-lg text-[14px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400/30 text-slate-800" 
                              />
                              <span className="mt-1">/{ev.totalMarks}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSave(ev.studentId, ev.totalMarks)}
                            disabled={!currentMark}
                            className="px-5 py-2.5 mt-4 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-all flex items-center gap-1.5">
                            <Save className="w-3.5 h-3.5" /> Save
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Batch Tests Component ───────────────────────────────────────────────
export function BatchTests({ tests, evaluations, questionAnalysis, batchId }: {
  tests: Test[];
  evaluations: Record<string, Evaluation[]>;
  questionAnalysis: Record<string, QAnalysis[]>;
  batchId?: string;
}) {
  const { setTeacherNav } = useDashboardStore();
  const switchBatch = useSwitchBatch();
  const [activeTestId, setActiveTestId] = useState<string | null>(null);

  const upcoming  = tests.filter(t => t.status === 'scheduled');
  const completed = tests.filter(t => t.status === 'completed' || t.status === 'grading');
  
  const activeTest = activeTestId ? tests.find(t => t.id === activeTestId) : null;

  const renderRow = (t: Test) => {
    const isInteractive = t.status === 'grading' || t.status === 'completed';

    return (
      <button
        key={t.id}
        onClick={() => isInteractive && setActiveTestId(t.id)}
        disabled={!isInteractive}
        className={`w-full flex items-center gap-4 p-5 border border-slate-100 rounded-2xl mb-3 text-left transition-all ${
          isInteractive ? 'hover:border-indigo-200 hover:shadow-sm group cursor-pointer bg-white' : 'bg-slate-50/50 cursor-default'
        }`}
      >
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] font-bold leading-tight transition-colors ${isInteractive ? 'text-slate-800 group-hover:text-indigo-700' : 'text-slate-600'}`}>{t.name}</p>
          <p className="text-[12px] text-slate-500 mt-0.5">{t.date} · {t.totalStudents} students</p>
        </div>
        
        {t.status !== 'scheduled' && (
          <div className="flex gap-6 text-center flex-shrink-0">
            <div>
              <p className="text-[10px] text-slate-500">Avg</p>
              <p className={`text-[15px] font-black ${t.avgScore>=75?'text-emerald-600':t.avgScore>=60?'text-amber-600':'text-rose-600'}`}>{t.avgScore}%</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Top</p>
              <p className="text-[15px] font-black text-slate-800">{t.topScore}%</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500">Graded</p>
              <p className="text-[15px] font-black text-slate-800">{t.graded}/{t.totalStudents}</p>
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-3 flex-shrink-0 ml-2">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize ${statusStyle(t.status)}`}>{t.status}</span>
          {isInteractive && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fadein">
      
      {/* Modal Overlay for Test Detail */}
      {activeTest && (
        <TestDetailModal
          test={activeTest}
          evals={evaluations[activeTest.id] ?? []}
          qData={questionAnalysis[activeTest.id] ?? []}
          onClose={() => setActiveTestId(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Tests for this batch</h3>
        <button
          onClick={() => {
            // Set batch context BEFORE navigating to ensure Paper Builder pre-fills correctly
            if (batchId) switchBatch(batchId);
            setTeacherNav('paper-builder');
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" /> Create Test
        </button>
      </div>

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

      {tests.length === 0 && (
        <EmptyState
          icon={<Edit3 className="w-7 h-7" />}
          title="No tests yet"
          description="Create the first test for this batch."
          action={{
            label: '+ Create Test',
            onClick: () => {
              if (batchId) switchBatch(batchId);
              setTeacherNav('paper-builder');
            },
          }}
        />
      )}
    </div>
  );
}
