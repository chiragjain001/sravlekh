'use client';

import { useState } from 'react';
import {
  ClipboardList, Plus, Search, Calendar, ChevronRight, ChevronLeft,
  BarChart2, AlertTriangle, CheckCircle2, Users, Target, Zap, BookOpen, FileText
} from 'lucide-react';
import { useExams, useExam, usePaper, useBatches, useExamResults } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { toDisplayExamStatus as toDisplayStatus } from '@/lib/exam-status';
import { ExamGradingPanel } from './ExamGradingPanel';

type View = 'list' | 'analysis';
type DetailTab = 'analysis' | 'students' | 'paper';

export function TeacherTestsExams() {
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view,         setView]         = useState<View>('list');
  const [detailTab,    setDetailTab]    = useState<DetailTab>('analysis');
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [showGrading,  setShowGrading]  = useState(false);
  // Which linked paper variant is on screen, for exams with more than one
  // (Paper Builder's "Paper Sets" can generate several — e.g. anti-cheating
  // Set A/B). Reset to null on every exam selection so it always defaults to
  // the first available variant rather than leaking a stale id across exams.
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

  const { data: examsResp, isLoading: examsLoading } = useExams();
  const { data: batchesResp } = useBatches();
  const exams: any[] = examsResp?.data ?? examsResp ?? [];
  const batches: any[] = batchesResp?.data ?? batchesResp ?? [];
  const { data: results, isLoading: resultsLoading } = useExamResults(view === 'analysis' ? selectedTest : null);
  // The list endpoint (useExams) never includes linked papers — only
  // GET /exams/:examId does — so the "Paper" tab needs its own fetch rather
  // than reading test.papers off the row the table already had.
  const { data: examDetail } = useExam(view === 'analysis' ? selectedTest : null);
  const papers: { id: string; title: string; status: string }[] = examDetail?.papers ?? [];
  const activePaperId = selectedPaperId ?? papers[0]?.id ?? null;
  // Fetched lazily (only once the Paper tab is actually opened), same pattern
  // as useExamResults above — no point pulling full question content for a
  // teacher who never asks to see it.
  const { data: paperDetail, isLoading: paperLoading } = usePaper(
    view === 'analysis' && detailTab === 'paper' ? activePaperId : null,
  );

  const enrichedTests = exams.map((e: any) => ({
    id: e.id,
    name: e.title,
    batchLabel: e.batch?.name ?? batches.find((b: any) => b.id === e.batchId)?.name ?? 'Unknown Batch',
    date: e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : 'Not scheduled',
    status: toDisplayStatus(e.status),
  })).filter((t: any) =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (statusFilter === 'all' || t.status === statusFilter)
  );

  const openAnalysis = (testId: string) => {
    setSelectedTest(testId);
    setView('analysis');
    setDetailTab('analysis');
    setSelectedPaperId(null); // don't carry a stale variant selection between exams
  };

  const test = exams.find((e: any) => e.id === selectedTest);

  if (view === 'analysis' && test) {
    const summary = results?.summary ?? { participated: 0, graded: 0, avgScore: 0, topScore: 0 };
    const students = results?.students ?? [];
    const qAnalysis = results?.questionAnalysis ?? [];
    const displayStatus = toDisplayStatus(test.status);
    const gradingPct = summary.participated > 0 ? Math.round((summary.graded / summary.participated) * 100) : 0;
    const batchLabel = test.batch?.name ?? batches.find((b: any) => b.id === test.batchId)?.name ?? 'Unknown Batch';

    return (
      <>
      <div className="p-6 animate-fadein space-y-6 max-w-5xl mx-auto">
        {/* Back */}
        <button onClick={() => setView('list')} className="flex items-center gap-2 text-[13px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to All Tests
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-slate-800">{test.title}</h1>
            <p className="text-[13px] text-slate-500 mt-0.5">Batch {batchLabel} · {test.scheduledDate ? `Conducted ${new Date(test.scheduledDate).toLocaleDateString()}` : 'Not scheduled'}</p>
          </div>
          <span className={`self-start sm:self-auto px-3 py-1.5 rounded-xl text-[12px] font-bold uppercase tracking-wider ${
            displayStatus === 'completed' ? 'bg-emerald-100 text-emerald-700' :
            displayStatus === 'grading'   ? 'bg-amber-100 text-amber-700'     :
                                             'bg-sky-100 text-sky-700'
          }`}>{displayStatus}</span>
        </div>

        {resultsLoading ? (
          <div className="p-8 text-center text-slate-400 text-[13px]">Loading results…</div>
        ) : (
        <>
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Students Appeared', value: summary.participated, icon: <Users className="w-4 h-4 text-sky-500" />,   bg: 'bg-sky-50',     color: 'text-slate-800' },
            { label: 'Average Score',     value: `${summary.avgScore}%`, icon: <Target className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-50', color: summary.avgScore >= 75 ? 'text-emerald-600' : summary.avgScore >= 60 ? 'text-amber-600' : 'text-rose-600' },
            { label: 'Top Score',         value: `${summary.topScore}%`, icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-50', color: 'text-emerald-700' },
            { label: 'Grading Progress',  value: `${gradingPct}%`, icon: <BarChart2 className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-50', color: gradingPct === 100 ? 'text-emerald-600' : 'text-amber-600' },
          ].map((k, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center mb-3`}>{k.icon}</div>
              <p className={`text-[24px] font-black leading-tight ${k.color}`}>{k.value}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Next Actions */}
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-indigo-500" />
            <p className="text-[14px] font-bold text-indigo-800">Next Actions After This Test</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {test.status !== 'LOCKED' && (
              <button
                onClick={() => setShowGrading(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-[12.5px] font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5" /> Grade Students ({summary.graded}/{summary.participated})
              </button>
            )}
            {summary.avgScore > 0 && summary.avgScore < 65 && (
              <button
                onClick={() => setTeacherNav('remedial-extra')}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-rose-700 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Schedule Remedial Class
              </button>
            )}
            <button
              onClick={() => setTeacherNav('assignments')}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 text-white text-[12.5px] font-bold rounded-xl hover:bg-amber-600 transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" /> Assign Practice on Weak Areas
            </button>
            <button
              onClick={() => setTeacherNav('paper-builder')}
              className="flex items-center gap-2 px-4 py-2.5 border border-indigo-300 bg-white text-indigo-700 text-[12.5px] font-bold rounded-xl hover:bg-indigo-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Schedule Re-Test
            </button>
          </div>
        </div>

        {/* Tabs for Paper / Analysis / Students */}
        <div role="tablist" aria-label="Test detail tabs" className="flex gap-1 p-2 bg-slate-100 rounded-2xl w-fit">
          {(['paper', 'analysis', 'students'] as const).map(tab => (
            <button
              key={tab}
              role="tab"
              aria-selected={detailTab === tab}
              onClick={() => setDetailTab(tab)}
              className={`px-5 py-2 text-[13px] font-bold rounded-xl capitalize transition-all ${
                detailTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'paper' ? 'Question Paper' : tab === 'analysis' ? 'Question Analysis' : 'Student Performances'}
            </button>
          ))}
        </div>

        {/* Tab Content — Paper (the questions actually published, reviewable
            after the fact — Paper Builder's own Preview step was previously
            the ONLY place a teacher could see this, and only once, before
            publishing) */}
        {detailTab === 'paper' && (
          papers.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">No paper is linked to this exam.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {papers.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {papers.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPaperId(p.id)}
                      className={`px-3.5 py-1.5 text-[12px] font-bold rounded-lg border transition-colors ${
                        activePaperId === p.id
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                      }`}
                    >
                      {p.title}
                    </button>
                  ))}
                </div>
              )}

              {paperLoading ? (
                <div className="p-8 text-center text-slate-400 text-[13px]">Loading paper…</div>
              ) : !paperDetail ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-[13px]">Couldn't load this paper's questions.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {paperDetail.items.map((item: any, i: number) => (
                    <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                                item.question.difficulty === 'HARD' ? 'bg-rose-100 text-rose-700' :
                                item.question.difficulty === 'MEDIUM' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>{item.question.difficulty}</span>
                              {item.question.topic?.name && (
                                <span className="text-[11px] font-semibold text-slate-500">{item.question.topic.name}</span>
                              )}
                            </div>
                            <p className="text-[13.5px] text-slate-800 leading-snug">{item.question.content}</p>
                          </div>
                        </div>
                        <span className="text-[12px] font-bold text-slate-600 whitespace-nowrap flex-shrink-0">{item.marks} Marks</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* Tab Content */}
        {detailTab === 'analysis' && (
          qAnalysis.length > 0 ? (
            <div className="flex flex-col gap-3">
              {[...qAnalysis].sort((a: any, b: any) => a.correctPct - b.correctPct).map((q: any) => (
                <div key={q.questionId} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm hover:border-indigo-200 transition-colors flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-[14px] font-bold text-slate-800 leading-tight">{q.topic}</p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded capitalize ${
                          q.difficulty==='HARD'?'bg-rose-100 text-rose-700':q.difficulty==='MEDIUM'?'bg-amber-100 text-amber-700':'bg-emerald-100 text-emerald-700'
                        }`}>{q.difficulty}</span>
                      </div>
                      <p className="text-[12px] text-slate-500 max-w-lg truncate">{q.content}</p>
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
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400">
              <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">Question analysis not available for this test yet.</p>
            </div>
          )
        )}

        {detailTab === 'students' && (
          students.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px]">No student marks recorded yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {students.map((ev: any) => (
                <div key={ev.studentProfileId} className={`bg-white border rounded-2xl p-4 shadow-sm transition-all flex items-center justify-between ${ev.isFinalized ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-[13px] font-black text-slate-600">
                      {ev.name.split(' ').map((n: string) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-800 leading-tight">{ev.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {ev.isFinalized ? (
                      <>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Marks</p>
                          <span className="text-[18px] font-black text-slate-800">
                            {ev.obtainedMarks}
                            <span className="text-slate-400 font-semibold text-[14px]">/{ev.totalMarks}</span>
                          </span>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                      </>
                    ) : (
                      <span className="text-[12px] font-bold text-slate-400 italic">Not graded yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        </>
        )}
      </div>
      {showGrading && (
        <ExamGradingPanel examId={test.id} batchId={test.batchId} onClose={() => setShowGrading(false)} />
      )}
      </>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Tests & Exams</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage all tests. Click a test to see detailed analysis.</p>
        </div>
        <button onClick={() => setTeacherNav('paper-builder')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Schedule New Test
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input type="text" placeholder="Search by test name..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 text-[13px] outline-none placeholder:text-slate-400 bg-transparent" />
        </div>
        <div role="tablist" aria-label="Test status filter tabs" className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {['all', 'completed', 'grading', 'scheduled'].map(s => (
            <button
              key={s}
              role="tab"
              aria-selected={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg capitalize transition-all ${
                statusFilter === s ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-5 font-bold text-[11px] text-slate-500 uppercase tracking-wider">Test Name</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider">Batch</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {examsLoading ? (
              <tr><td colSpan={5} className="py-12 text-center text-slate-400 text-[13px]">Loading tests…</td></tr>
            ) : (
              <>
                {enrichedTests.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
                          <ClipboardList className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-800">{t.name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-600">{t.batchLabel}</td>
                    <td className="py-4 px-4 text-slate-500 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {t.date}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        t.status === 'grading'   ? 'bg-amber-100 text-amber-700'     :
                                                    'bg-sky-100 text-sky-700'
                      }`}>{t.status}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button onClick={() => openAnalysis(t.id)}
                        className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors opacity-0 group-hover:opacity-100">
                        View <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
                {enrichedTests.length === 0 && (
                  <tr><td colSpan={5} className="py-12 text-center text-slate-500 text-[13px]">No tests found. Use "Schedule New Test" to build one.</td></tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
