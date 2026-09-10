'use client';

import { useState, useMemo } from 'react';
import {
  BarChart2, Users, Target, ChevronRight, Filter, Award, ShieldAlert, BookOpen,
  CheckCircle2, Layers
} from 'lucide-react';
import { useMyTeacherProfile, useSubjects, useWeakStudentsForTopic, useBatchPerformanceSummaries, useBatchesHeatmap } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { StudentListModal } from '../shared/StudentListModal';

type AnalyticsView = 'overview' | 'compare';

interface BatchWithStats {
  id: string;
  name: string;
  classYear: string;
  subjectId: string;
  avgScore: number;
  trend: string;
  studentCount: number;
}

export function TeacherAnalytics() {
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [view, setView] = useState<AnalyticsView>('overview');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [compareBatchA, setCompareBatchA] = useState<string>('');
  const [compareBatchB, setCompareBatchB] = useState<string>('');
  const [modalTopic, setModalTopic] = useState<{ topic: string; topicId: string; count: number; total: number; avg: number; title: string; batchId: string } | null>(null);

  const { data: profile } = useMyTeacherProfile();
  const { data: subjectsResp } = useSubjects();
  const subjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];
  const subjectName = (id: string) => subjects.find((s: any) => s.id === id)?.name ?? 'Unknown Subject';

  const myAssignments = useMemo(
    () => (profile?.batchAssignments ?? []).filter((a: any) => !a.removedAt),
    [profile],
  );
  const myBatchIds = useMemo(
    () => Array.from(new Set(myAssignments.map((a: any) => a.batchId))) as string[],
    [myAssignments],
  );

  // Two requests for the whole screen regardless of how many classes the
  // teacher has — this used to be one performance call and one heatmap call
  // per batch, so a nine-section teacher paid eighteen round trips to render
  // a handful of numbers per card.
  const { data: summaries, isLoading: perfLoading } = useBatchPerformanceSummaries();
  const { data: heatmaps, isLoading: heatLoading } = useBatchesHeatmap(myBatchIds);

  const isLoading = perfLoading || heatLoading;

  const heatmapFor = (batchId: string): any[] => (heatmaps?.[batchId] ?? []) as any[];

  const batches: BatchWithStats[] = useMemo(() => myBatchIds.map((batchId) => {
    const assignment = myAssignments.find((a: any) => a.batchId === batchId);
    const perf = (summaries ?? []).find((p) => p.id === batchId);
    return {
      id: batchId,
      name: assignment?.batch.name ?? batchId,
      classYear: assignment?.batch.classYear ?? 'Unknown',
      subjectId: assignment?.subjectId ?? '',
      avgScore: perf?.avgScore ?? 0,
      trend: perf?.trend ?? 'stable',
      studentCount: perf?.studentCount ?? 0,
    };
  }), [myBatchIds, myAssignments, summaries]);

  const classYears = Array.from(new Set(batches.map(b => b.classYear)));

  const availableBatches = useMemo(
    () => (selectedClass === 'all' ? batches : batches.filter(b => b.classYear === selectedClass)),
    [batches, selectedClass],
  );
  const activeBatches = useMemo(() => {
    if (selectedBatch !== 'all') return batches.filter(b => b.id === selectedBatch);
    if (selectedClass !== 'all') return batches.filter(b => b.classYear === selectedClass);
    return batches;
  }, [batches, selectedClass, selectedBatch]);

  const totalStudentsCount = activeBatches.reduce((acc, b) => acc + b.studentCount, 0);
  const avgOverallScore = activeBatches.length > 0 ? Math.round(activeBatches.reduce((acc, b) => acc + b.avgScore, 0) / activeBatches.length) : 0;
  const topBatch = activeBatches.length > 0 ? [...activeBatches].sort((a, b) => b.avgScore - a.avgScore)[0] : null;
  const weakBatch = activeBatches.length > 0 ? [...activeBatches].sort((a, b) => a.avgScore - b.avgScore)[0] : null;

  // Aggregate weak topics (from the live heatmap) across the active batch scope.
  const aggregatedWeakTopics = useMemo(() => {
    const topicMap = new Map<string, { topicId: string; count: number; total: number; avgSum: number; batchCount: number; batchId: string }>();
    activeBatches.forEach((b) => {
      const heatmap = heatmapFor(b.id);
      heatmap.filter((t: any) => t.studentsStruggling > 0).forEach((t: any) => {
        const entry = topicMap.get(t.topicName) ?? { topicId: t.topicId, count: 0, total: 0, avgSum: 0, batchCount: 0, batchId: b.id };
        entry.count += t.studentsStruggling;
        entry.total += t.totalStudents;
        entry.avgSum += t.averageMastery;
        entry.batchCount += 1;
        topicMap.set(t.topicName, entry);
      });
    });
    return Array.from(topicMap.entries()).map(([topic, data]) => {
      const weakPct = Math.round((data.count / (data.total || 1)) * 100);
      const impact = weakPct > 30 ? 'High' : weakPct > 15 ? 'Medium' : 'Low';
      return { topic, ...data, avgScore: Math.round(data.avgSum / data.batchCount), impact, weakPct };
    }).sort((a, b) => b.count - a.count);
  }, [activeBatches, heatmaps]);

  const batchA = batches.find(b => b.id === compareBatchA) ?? batches[0];
  const batchB = batches.find(b => b.id === compareBatchB) ?? batches[1];
  const weakTopicsFor = (batchId: string | undefined) => {
    if (!batchId) return [];
    return heatmapFor(batchId).filter((t: any) => t.studentsStruggling > 0);
  };
  const weakTopicsA = weakTopicsFor(batchA?.id);
  const weakTopicsB = weakTopicsFor(batchB?.id);

  const VIEW_TABS: { key: AnalyticsView; label: string }[] = [
    { key: 'overview', label: 'Class & Section Analytics' },
    { key: 'compare', label: 'Compare Classes & Batches' },
  ];

  if (isLoading && batches.length === 0) {
    return <div className="p-6 text-center text-slate-400 text-[13px] animate-fadein">Loading analytics…</div>;
  }

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-600" />
            Academic Analytics
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Real-time performance and mastery data for your classes and sections.
          </p>
        </div>

        <div role="tablist" aria-label="Analytics view switcher" className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl">
          {VIEW_TABS.map(t => (
            <button
              key={t.key}
              role="tab"
              aria-selected={view === t.key}
              onClick={() => setView(t.key)}
              className={`px-5 py-2 text-[13px] font-bold rounded-xl transition-all ${
                view === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {modalTopic && (
        <TopicWeakStudentsModal
          modalTopic={modalTopic}
          onClose={() => setModalTopic(null)}
          onSelectStudent={(id) => {
            setTeacherCtx({ batchId: modalTopic.batchId, studentId: id, batchTab: 'students' });
            setTeacherNav('classes');
          }}
        />
      )}

      {batches.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
          You aren't assigned to any batches yet.
        </div>
      ) : view === 'overview' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>Diagnostic Filter Scope:</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Class</label>
                <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedBatch('all'); }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
                  <option value="all">All Classes</option>
                  {classYears.map(cy => <option key={cy} value={cy}>{cy}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Section / Batch</label>
                <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
                  <option value="all">All Sections</option>
                  {availableBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
            </div>
            {(selectedClass !== 'all' || selectedBatch !== 'all') && (
              <button onClick={() => { setSelectedClass('all'); setSelectedBatch('all'); }}
                className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors underline">
                Reset Filters
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><Target className="w-4 h-4" /></div>
                <span className="text-[13px] font-semibold text-slate-500">Average Performance</span>
              </div>
              <p className="text-[28px] font-black text-slate-800">{avgOverallScore}%</p>
              <p className="text-[11px] text-slate-400 mt-1">Across active selection scope</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600"><Users className="w-4 h-4" /></div>
                <span className="text-[13px] font-semibold text-slate-500">Total Roster Strength</span>
              </div>
              <p className="text-[28px] font-black text-slate-800">{totalStudentsCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">{activeBatches.length} active section(s)</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600"><Award className="w-4 h-4" /></div>
                <span className="text-[13px] font-semibold text-emerald-800">Leading Section</span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-[22px] font-black text-emerald-700 truncate">{topBatch ? topBatch.name : 'N/A'}</p>
                <p className="text-[14px] font-bold text-emerald-600 mb-1.5">{topBatch?.avgScore || 0}%</p>
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600"><ShieldAlert className="w-4 h-4" /></div>
                <span className="text-[13px] font-semibold text-rose-800">Priority Focus Section</span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-[22px] font-black text-rose-700 truncate">{weakBatch ? weakBatch.name : 'N/A'}</p>
                <p className="text-[14px] font-bold text-rose-600 mb-1.5">{weakBatch?.avgScore || 0}%</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2"><Layers className="w-4 h-4 text-indigo-600" /> Section-wise Score Distribution</h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">{activeBatches.length} Sections</span>
                </div>
                <div className="space-y-4">
                  {activeBatches.map(b => (
                    <div key={b.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between text-[13px] font-semibold mb-1">
                        <div className="flex items-center gap-2">
                          <button onClick={() => { setCompareBatchA(b.id); setView('compare'); }} className="text-slate-800 hover:text-indigo-600 font-bold transition-colors">{b.name}</button>
                          <span className="text-[11px] text-slate-400">{b.classYear}</span>
                        </div>
                        <span className={`font-black ${b.avgScore >= 75 ? 'text-emerald-600' : b.avgScore >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>{b.avgScore}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${b.avgScore >= 75 ? 'bg-emerald-500' : b.avgScore >= 65 ? 'bg-amber-400' : 'bg-rose-500'}`} style={{ width: `${b.avgScore}%` }} />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-100">
                        <span>Students: {b.studentCount}</span>
                        <span className="capitalize font-semibold text-slate-600">Trend: {b.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <button onClick={() => setView('compare')} className="text-[12.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1">
                  Open Head-to-Head Section Comparison <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 mb-1 flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-600" /> Concept Weak Area Diagnostics</h3>
                <p className="text-[12.5px] text-slate-500 mb-4">Live weak topics aggregated for the selected class and section.</p>
                <div className="space-y-3">
                  {aggregatedWeakTopics.length === 0 ? (
                    <div className="py-12 text-center text-emerald-600 font-semibold text-[13px] bg-emerald-50/50 border border-emerald-100 rounded-xl">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                      All students in the selected scope are performing above the weak threshold!
                    </div>
                  ) : (
                    aggregatedWeakTopics.map(wt => (
                      <button key={wt.topic} onClick={() => setModalTopic({ topic: wt.topic, topicId: wt.topicId, count: wt.count, total: wt.total, avg: wt.avgScore, title: `Students Weak in ${wt.topic}`, batchId: wt.batchId })}
                        className="w-full flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50 hover:border-indigo-200 hover:shadow-sm transition-all text-left group">
                        <div>
                          <p className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{wt.topic}</p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">{wt.count} {wt.count === 1 ? 'student' : 'students'} struggling ({wt.weakPct}% of cohort)</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${wt.impact === 'High' ? 'bg-rose-100 text-rose-700' : wt.impact === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{wt.impact} Impact</span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {batches.length > 0 && view === 'compare' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['A', 'B'] as const).map(side => {
              const val = side === 'A' ? (compareBatchA || batches[0]?.id) : (compareBatchB || (batches[1]?.id ?? batches[0]?.id));
              const setter = side === 'A' ? setCompareBatchA : setCompareBatchB;
              const batch = batches.find(b => b.id === val);
              return (
                <div key={side} className={`p-5 border-2 rounded-2xl transition-all ${side === 'A' ? 'border-indigo-200 bg-indigo-50/40' : 'border-violet-200 bg-violet-50/40'}`}>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    {side === 'A' ? 'Primary Comparison (Target A)' : 'Secondary Comparison (Target B)'}
                  </label>
                  <select value={val} onChange={e => setter(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white shadow-sm mb-3">
                    {batches.map(b => <option key={b.id} value={b.id}>{b.name} — {b.classYear} (Avg {b.avgScore}%)</option>)}
                  </select>
                  {batch && (
                    <div className="grid grid-cols-2 gap-2 text-[12px] bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                      <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Roster Size</span><strong className="text-slate-800 text-[14px] font-black">{batch.studentCount} Students</strong></div>
                      <div><span className="text-slate-400 block text-[10px] uppercase font-bold">Avg Performance</span><strong className={`text-[14px] font-black ${batch.avgScore >= 75 ? 'text-emerald-600' : batch.avgScore >= 65 ? 'text-amber-600' : 'text-rose-600'}`}>{batch.avgScore}%</strong></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {batchA && batchB && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-bold">Head-to-Head Section Analysis</h3>
                  <p className="text-[12px] text-slate-400">Comparing {batchA.name} vs {batchB.name}</p>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {[
                  { label: 'Overall Class Average', valA: `${batchA.avgScore}%`, valB: `${batchB.avgScore}%`, better: batchA.avgScore > batchB.avgScore ? 'A' : batchA.avgScore < batchB.avgScore ? 'B' : null },
                  { label: 'Enrolled Strength', valA: `${batchA.studentCount} Students`, valB: `${batchB.studentCount} Students`, better: null },
                  { label: 'Trend', valA: batchA.trend.toUpperCase(), valB: batchB.trend.toUpperCase(), better: batchA.trend === 'up' ? 'A' : batchB.trend === 'up' ? 'B' : null },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-3 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors">
                    <div className={`text-center text-[15px] ${row.better === 'A' ? 'text-indigo-600 font-black' : 'text-slate-700 font-bold'}`}>{row.valA}</div>
                    <div className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">{row.label}</div>
                    <div className={`text-center text-[15px] ${row.better === 'B' ? 'text-violet-600 font-black' : 'text-slate-700 font-bold'}`}>{row.valB}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[{ label: `${batchA?.name} Weak Topics`, topics: weakTopicsA }, { label: `${batchB?.name} Weak Topics`, topics: weakTopicsB }].map(side => (
              <div key={side.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-[14.5px] font-bold text-slate-800 mb-3">{side.label}</h3>
                {side.topics.length === 0 ? (
                  <div className="py-8 text-center bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-600 font-semibold text-[12.5px]">No critical weak topics recorded for this batch.</div>
                ) : (
                  side.topics.map((wt: any) => (
                    <div key={wt.topicId} className="w-full text-left mb-3 p-3 border border-slate-100 rounded-xl bg-slate-50/70">
                      <div className="flex justify-between text-[13px] mb-1">
                        <span className="font-semibold text-slate-700">{wt.topicName}</span>
                        <span className="font-bold text-rose-600">{wt.studentsStruggling} Students</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${Math.round((wt.studentsStruggling / wt.totalStudents) * 100)}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Split out so useWeakStudentsForTopic only runs while the modal is actually
// open (it's mounted/unmounted by the parent's `{modalTopic && (...)}`
// guard) — was previously passed a hardcoded empty array and a no-op select
// handler regardless of the real (non-empty) underlying data.
function TopicWeakStudentsModal({
  modalTopic,
  onClose,
  onSelectStudent,
}: {
  modalTopic: { topic: string; topicId: string; count: number; total: number; avg: number; title: string; batchId: string };
  onClose: () => void;
  onSelectStudent: (id: string) => void;
}) {
  const { data: weakStudents = [] } = useWeakStudentsForTopic(modalTopic.batchId, modalTopic.topicId);
  return (
    <StudentListModal
      title={modalTopic.title}
      topic={modalTopic.topic}
      weakCount={modalTopic.count}
      totalStudents={modalTopic.total}
      avgScore={modalTopic.avg}
      students={weakStudents}
      onClose={onClose}
      onSelectStudent={onSelectStudent}
    />
  );
}
