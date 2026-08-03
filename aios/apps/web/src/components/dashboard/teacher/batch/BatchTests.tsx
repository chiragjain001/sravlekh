'use client';

import { useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Edit3, Save, CheckCircle2 } from 'lucide-react';

interface Test {
  id: string; name: string; date: string;
  totalStudents: number; attempted: number; graded: number;
  avgScore: number; topScore: number; status: string;
}
interface Evaluation { studentId: string; name: string; rollNo: string; marksObtained: number; totalMarks: number; status: string }
interface QAnalysis  { q: string; topic: string; subtopic: string; correctPct: number; difficulty: string; avgTimeSec: number }

const statusStyle = (s: string) => ({
  scheduled: 'bg-purple-100 text-purple-700',
  draft:     'bg-slate-100  text-slate-500',
  grading:   'bg-amber-100  text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}[s] ?? 'bg-slate-100 text-slate-500');

export function BatchTests({ tests, evaluations, questionAnalysis }: {
  tests: Test[];
  evaluations: Record<string, Evaluation[]>;
  questionAnalysis: Record<string, QAnalysis[]>;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [gradingTab, setGradingTab] = useState<'analysis' | 'grading'>('analysis');
  const [marks, setMarks]     = useState<Record<string, string>>({});
  const [saved, setSaved]     = useState<string[]>([]);

  const upcoming  = tests.filter(t => t.status === 'scheduled' || t.status === 'draft');
  const completed = tests.filter(t => t.status === 'completed' || t.status === 'grading');

  const renderRow = (t: Test) => {
    const isOpen = expanded === t.id;
    const evals  = evaluations[t.id] ?? [];
    const qData  = questionAnalysis[t.id] ?? [];

    return (
      <div key={t.id} className="border border-slate-100 rounded-2xl overflow-hidden mb-3">
        {/* Header row */}
        <button
          onClick={() => setExpanded(isOpen ? null : t.id)}
          className="w-full flex items-center gap-4 p-5 hover:bg-slate-50/60 transition-colors text-left"
        >
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-slate-800 leading-tight">{t.name}</p>
            <p className="text-[12px] text-slate-500 mt-0.5">{t.date} · {t.totalStudents} students</p>
          </div>
          {t.status !== 'scheduled' && t.status !== 'draft' && (
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
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize flex-shrink-0 ${statusStyle(t.status)}`}>{t.status}</span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {/* Expanded detail */}
        {isOpen && (t.status === 'grading' || t.status === 'completed') && (
          <div className="border-t border-slate-100 animate-fadein">
            {/* Sub-tabs */}
            <div className="flex gap-1 p-3 bg-slate-50 border-b border-slate-100">
              {(['analysis', 'grading'] as const).map(tab => (
                <button key={tab} onClick={() => setGradingTab(tab)}
                  className={`px-4 py-1.5 text-[12px] font-bold rounded-xl capitalize transition-all ${
                    gradingTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>{tab === 'grading' ? `Grading (${t.graded}/${t.totalStudents})` : 'Question Analysis'}</button>
              ))}
            </div>

            {/* Question Analysis */}
            {gradingTab === 'analysis' && qData.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Q</th>
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Topic</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Correct %</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Difficulty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...qData].sort((a,b) => a.correctPct - b.correctPct).map(q => (
                      <tr key={q.q} className={q.correctPct < 50 ? 'bg-rose-50/30' : ''}>
                        <td className="py-3 px-5 font-bold text-slate-700">{q.q}</td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-800">{q.topic}</p>
                          <p className="text-[11px] text-slate-500">{q.subtopic}</p>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`font-black text-[14px] ${q.correctPct<50?'text-rose-600':q.correctPct<70?'text-amber-600':'text-emerald-600'}`}>{q.correctPct}%</span>
                          {q.correctPct < 50 && <p className="text-[9px] text-rose-500 font-bold">WEAK AREA</p>}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                            q.difficulty==='hard'?'bg-rose-100 text-rose-700':q.difficulty==='medium'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'
                          }`}>{q.difficulty}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {gradingTab === 'analysis' && qData.length === 0 && (
              <p className="py-8 text-center text-[13px] text-slate-400">Analysis not available yet.</p>
            )}

            {/* Grading */}
            {gradingTab === 'grading' && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-50">
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Student</th>
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Roll No</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Marks</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {evals.map(ev => {
                      const isGraded = ev.status === 'graded' || saved.includes(`${t.id}-${ev.studentId}`);
                      return (
                        <tr key={ev.studentId} className={isGraded ? 'bg-emerald-50/20' : ''}>
                          <td className="py-3.5 px-5 font-semibold text-slate-800">{ev.name}</td>
                          <td className="py-3.5 px-3 text-slate-500">{ev.rollNo}</td>
                          <td className="py-3.5 px-3 text-center">
                            {isGraded
                              ? <span className="font-bold text-slate-800">{saved.includes(`${t.id}-${ev.studentId}`) ? marks[`${t.id}-${ev.studentId}`] : ev.marksObtained}<span className="text-slate-400 font-normal">/{ev.totalMarks}</span></span>
                              : <input type="number" min={0} max={ev.totalMarks} placeholder="—"
                                  value={marks[`${t.id}-${ev.studentId}`] ?? ''}
                                  onChange={e => setMarks(p => ({...p, [`${t.id}-${ev.studentId}`]: e.target.value}))}
                                  className="w-20 text-center px-2 py-1 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                            }
                          </td>
                          <td className="py-3.5 px-5 text-center">
                            {isGraded
                              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                              : <button
                                  onClick={() => marks[`${t.id}-${ev.studentId}`] && setSaved(p => [...p, `${t.id}-${ev.studentId}`])}
                                  disabled={!marks[`${t.id}-${ev.studentId}`]}
                                  className="flex items-center gap-1 mx-auto px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all">
                                  <Save className="w-3 h-3" /> Save
                                </button>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fadein">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Tests for this batch</h3>
        <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
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
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
          <Edit3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-[13px] font-semibold">No tests yet. Create the first test for this batch.</p>
        </div>
      )}
    </div>
  );
}
