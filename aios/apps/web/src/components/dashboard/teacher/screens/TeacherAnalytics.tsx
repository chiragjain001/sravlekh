'use client';

import { useState, useMemo } from 'react';
import { 
  BarChart2, TrendingUp, Users, Target, ArrowUpRight, ArrowDownRight, 
  ChevronRight, Sparkles, Filter, Award, ShieldAlert, BookOpen, Brain, 
  CheckCircle2, Zap, Layers 
} from 'lucide-react';
import { batches, batchWeakTopics, topicWeakStudents, students, classes, teacherProfile } from '@/lib/mock-data/teacher';
import { useDashboardStore } from '@/store/dashboard-store';
import { StudentListModal } from '../shared/StudentListModal';

type AnalyticsView = 'overview' | 'compare';

export function TeacherAnalytics() {
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [view, setView] = useState<AnalyticsView>('overview');

  // Filters for Overview
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedBatch, setSelectedBatch] = useState<string>('all');

  // Comparative selection
  const [compareBatchA, setCompareBatchA] = useState(batches[0]?.id ?? '11A');
  const [compareBatchB, setCompareBatchB] = useState(batches[1]?.id ?? '11B');

  // Modal
  const [modalTopic, setModalTopic] = useState<{
    topic: string;
    count: number;
    total: number;
    avg: number;
    title: string;
  } | null>(null);

  // Available batches for selected class filter
  const availableBatches = useMemo(() => {
    if (selectedClass === 'all') return batches;
    return batches.filter(b => b.classId === selectedClass);
  }, [selectedClass]);

  // Active batches for overview calculation
  const activeBatches = useMemo(() => {
    if (selectedBatch !== 'all') {
      return batches.filter(b => b.id === selectedBatch);
    }
    if (selectedClass !== 'all') {
      return batches.filter(b => b.classId === selectedClass);
    }
    return batches;
  }, [selectedClass, selectedBatch]);

  // Master level computations
  const totalStudentsCount = useMemo(() => {
    return activeBatches.reduce((acc, b) => acc + b.strength, 0);
  }, [activeBatches]);

  const avgOverallScore = useMemo(() => {
    if (activeBatches.length === 0) return 0;
    return Math.round(activeBatches.reduce((acc, b) => acc + b.avgScore, 0) / activeBatches.length);
  }, [activeBatches]);

  const topBatch = useMemo(() => {
    if (activeBatches.length === 0) return null;
    return [...activeBatches].sort((a, b) => b.avgScore - a.avgScore)[0];
  }, [activeBatches]);

  const weakBatch = useMemo(() => {
    if (activeBatches.length === 0) return null;
    return [...activeBatches].sort((a, b) => a.avgScore - b.avgScore)[0];
  }, [activeBatches]);

  // Global & filtered weak topics aggregation
  const aggregatedWeakTopics = useMemo(() => {
    const topicMap: Record<string, { count: number; total: number; avgSum: number; batchCount: number }> = {};
    activeBatches.forEach(b => {
      const bTopics = batchWeakTopics[b.id as keyof typeof batchWeakTopics] ?? [];
      bTopics.forEach(wt => {
        if (!topicMap[wt.topic]) {
          topicMap[wt.topic] = { count: 0, total: 0, avgSum: 0, batchCount: 0 };
        }
        const entry = topicMap[wt.topic]!;
        entry.count += wt.weakCount;
        entry.total += wt.totalStudents;
        entry.avgSum += wt.avgScore;
        entry.batchCount += 1;
      });
    });

    return Object.entries(topicMap).map(([topic, data]) => {
      const weakPct = Math.round((data.count / (data.total || 1)) * 100);
      const impact = weakPct > 30 ? 'High' : weakPct > 15 ? 'Medium' : 'Low';
      const avgScore = Math.round(data.avgSum / data.batchCount);
      return { topic, count: data.count, total: data.total, avgScore, impact, weakPct };
    }).sort((a, b) => b.count - a.count);
  }, [activeBatches]);

  // Comparative data
  const batchA = batches.find(b => b.id === compareBatchA) ?? batches[0];
  const batchB = batches.find(b => b.id === compareBatchB) ?? batches[1];
  const weakTopicsA = batchWeakTopics[compareBatchA as keyof typeof batchWeakTopics] ?? [];
  const weakTopicsB = batchWeakTopics[compareBatchB as keyof typeof batchWeakTopics] ?? [];

  const VIEW_TABS: { key: AnalyticsView; label: string }[] = [
    { key: 'overview', label: 'Class & Section Analytics' },
    { key: 'compare', label: 'Compare Classes & Batches' },
  ];

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-indigo-600" />
            Master Academic Analytics
          </h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Deep master-level insights, class-wise diagnostic intelligence, and dynamic section comparisons.
          </p>
        </div>

        {/* View Switcher Tabs */}
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

      {/* Modal Overlay */}
      {modalTopic && (
        <StudentListModal
          title={modalTopic.title}
          topic={modalTopic.topic}
          weakCount={modalTopic.count}
          totalStudents={modalTopic.total}
          avgScore={modalTopic.avg}
          students={(topicWeakStudents as Record<string, any>)[modalTopic.topic] || []}
          onClose={() => setModalTopic(null)}
          onSelectStudent={(id) => {
            const s = students.find(x => x.id === id);
            if (s) {
              setTeacherCtx({
                batchId: s.batchId,
                classId: s.batchId.startsWith('12') ? '12' : '11',
                subjectId: teacherCtx.subjectId || teacherProfile.assignments[0]?.subjectId || 'physics',
                studentId: s.id,
              });
              setTeacherNav('classes');
            }
          }}
        />
      )}

      {/* ── OVERVIEW / CLASS & SECTION ANALYTICS ────────────────────────────────── */}
      {view === 'overview' && (
        <div className="space-y-6">
          {/* Class & Section Filter Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
              <Filter className="w-4 h-4 text-indigo-600" />
              <span>Diagnostic Filter Scope:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3 flex-1 max-w-xl">
              {/* Class Dropdown */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Class
                </label>
                <select
                  value={selectedClass}
                  onChange={e => {
                    setSelectedClass(e.target.value);
                    setSelectedBatch('all');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                >
                  <option value="all">All Classes (Global)</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Section / Batch Dropdown */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Select Section / Batch
                </label>
                <select
                  value={selectedBatch}
                  onChange={e => setSelectedBatch(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                >
                  <option value="all">All Sections</option>
                  {availableBatches.map(b => (
                    <option key={b.id} value={b.id}>
                      Batch {b.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(selectedClass !== 'all' || selectedBatch !== 'all') && (
              <button
                onClick={() => {
                  setSelectedClass('all');
                  setSelectedBatch('all');
                }}
                className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors underline"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* AI Master Insight Summary Box */}
          <div className="p-5 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl text-white shadow-md relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 pointer-events-none">
              <Brain className="w-48 h-48 text-white" />
            </div>

            <div className="flex items-center gap-2 mb-2 text-indigo-300">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span className="text-[12px] font-bold uppercase tracking-wider">AI Master Diagnostics & Insights</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
              <div className="lg:col-span-2 space-y-2">
                <h3 className="text-[17px] font-bold text-white leading-snug">
                  {selectedBatch !== 'all'
                    ? `Batch ${selectedBatch} Diagnostic Performance Summary`
                    : selectedClass !== 'all'
                    ? `Class ${selectedClass} Academic Intelligence Overview`
                    : 'Global Institute Academic Intelligence Overview'}
                </h3>
                <p className="text-[13px] text-indigo-100 leading-relaxed">
                  Overall concept retention is calculated at{' '}
                  <strong className="text-amber-300 font-bold">{avgOverallScore}%</strong> across{' '}
                  <strong className="text-white font-bold">{totalStudentsCount} enrolled students</strong>.{' '}
                  {avgOverallScore >= 75
                    ? 'The section demonstrates high cognitive retention and strong topic mastery in core physics concepts.'
                    : avgOverallScore >= 65
                    ? 'Performance remains steady, but target interventions are required in numerical problem-solving areas.'
                    : 'Critical remediation is recommended to boost foundational conceptual understanding before upcoming exams.'}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 space-y-2">
                <div className="flex justify-between text-[12px]">
                  <span className="text-indigo-200">Cognitive Mastery Index</span>
                  <span className="font-bold text-amber-300">{avgOverallScore}%</span>
                </div>
                <div className="w-full bg-indigo-950/60 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-emerald-400"
                    style={{ width: `${avgOverallScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-indigo-200 pt-1">
                  <span>Target Benchmark: 75%</span>
                  <span className="font-semibold text-emerald-300">
                    {avgOverallScore >= 75 ? '+On Track' : `${75 - avgOverallScore}% Gap`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Master Level Diagnostic KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Target className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-slate-500">Average Performance</span>
              </div>
              <p className="text-[28px] font-black text-slate-800">{avgOverallScore}%</p>
              <p className="text-[11px] text-slate-400 mt-1">Across active selection scope</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-slate-500">Total Roster Strength</span>
              </div>
              <p className="text-[28px] font-black text-slate-800">{totalStudentsCount}</p>
              <p className="text-[11px] text-slate-400 mt-1">{activeBatches.length} active section(s)</p>
            </div>

            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <Award className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-emerald-800">Leading Section</span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-[28px] font-black text-emerald-700">{topBatch ? `Batch ${topBatch.label}` : 'N/A'}</p>
                <p className="text-[14px] font-bold text-emerald-600 mb-1.5">{topBatch?.avgScore || 0}% Avg</p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <span className="text-[13px] font-semibold text-rose-800">Priority Focus Section</span>
              </div>
              <div className="flex items-end gap-3">
                <p className="text-[28px] font-black text-rose-700">{weakBatch ? `Batch ${weakBatch.label}` : 'N/A'}</p>
                <p className="text-[14px] font-bold text-rose-600 mb-1.5">{weakBatch?.avgScore || 0}% Avg</p>
              </div>
            </div>
          </div>

          {/* Section Breakdown Grid & Concept Diagnostic */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Sections Comparison List */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    Section-wise Score Distribution
                  </h3>
                  <span className="text-[11px] font-bold text-slate-400 uppercase">
                    {activeBatches.length} Sections Active
                  </span>
                </div>

                <div className="space-y-4">
                  {activeBatches.map(b => (
                    <div key={b.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between text-[13px] font-semibold mb-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setCompareBatchA(b.id);
                              setView('compare');
                            }}
                            className="text-slate-800 hover:text-indigo-600 font-bold transition-colors"
                          >
                            Batch {b.label}
                          </button>
                          <span className="text-[11px] text-slate-400">Class {b.classId}</span>
                        </div>
                        <span className={`font-black ${
                          b.avgScore >= 75 ? 'text-emerald-600' : b.avgScore >= 65 ? 'text-amber-600' : 'text-rose-600'
                        }`}>
                          {b.avgScore}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            b.avgScore >= 75 ? 'bg-emerald-500' : b.avgScore >= 65 ? 'bg-amber-400' : 'bg-rose-500'
                          }`}
                          style={{ width: `${b.avgScore}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-slate-500 mt-2 pt-1 border-t border-slate-100">
                        <span>Students: {b.strength}</span>
                        <span className="capitalize font-semibold text-slate-600">Trend: {b.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <button
                  onClick={() => setView('compare')}
                  className="text-[12.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
                >
                  Open Detailed Head-to-Head Section Comparison <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Diagnostic Weak Topics Breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-600" />
                  Concept Weak Area Diagnostics
                </h3>
                <p className="text-[12.5px] text-slate-500 mb-4">
                  Aggregated weak topics based on selected class and section criteria.
                </p>

                <div className="space-y-3">
                  {aggregatedWeakTopics.length === 0 ? (
                    <div className="py-12 text-center text-emerald-600 font-semibold text-[13px] bg-emerald-50/50 border border-emerald-100 rounded-xl">
                      <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                      All students in the selected scope are performing above weak threshold!
                    </div>
                  ) : (
                    aggregatedWeakTopics.map(wt => (
                      <button
                        key={wt.topic}
                        onClick={() =>
                          setModalTopic({
                            topic: wt.topic,
                            count: wt.count,
                            total: wt.total,
                            avg: wt.avgScore,
                            title: `Students Weak in ${wt.topic}`,
                          })
                        }
                        className="w-full flex items-center justify-between p-3.5 border border-slate-100 rounded-xl bg-slate-50 hover:border-indigo-200 hover:shadow-sm transition-all text-left group"
                      >
                        <div>
                          <p className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                            {wt.topic}
                          </p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">
                            {wt.count} students struggling ({wt.weakPct}% of cohort)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                              wt.impact === 'High'
                                ? 'bg-rose-100 text-rose-700'
                                : wt.impact === 'Medium'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}
                          >
                            {wt.impact} Impact
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 text-center">
                <p className="text-[11px] text-slate-400">
                  Click any topic to open the 70% blurred backdrop student list overlay.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DYNAMIC CLASS & BATCH COMPARISON ────────────────────────────────────────── */}
      {view === 'compare' && (
        <div className="space-y-6">
          {/* Comparison Selector Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['A', 'B'] as const).map(side => {
              const val = side === 'A' ? compareBatchA : compareBatchB;
              const setter = side === 'A' ? setCompareBatchA : setCompareBatchB;
              const batch = batches.find(b => b.id === val);
              return (
                <div
                  key={side}
                  className={`p-5 border-2 rounded-2xl transition-all ${
                    side === 'A'
                      ? 'border-indigo-200 bg-indigo-50/40'
                      : 'border-violet-200 bg-violet-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {side === 'A' ? 'Primary Comparison (Target A)' : 'Secondary Comparison (Target B)'}
                    </label>
                    <span className="text-[11px] font-bold text-indigo-600">Select Section</span>
                  </div>

                  <select
                    value={val}
                    onChange={e => setter(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white shadow-sm mb-3"
                  >
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>
                        Batch {b.label} – Class {b.classId} (Avg {b.avgScore}%)
                      </option>
                    ))}
                  </select>

                  {batch && (
                    <div className="grid grid-cols-2 gap-2 text-[12px] bg-white p-3 rounded-xl border border-slate-100 shadow-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Roster Size</span>
                        <strong className="text-slate-800 text-[14px] font-black">{batch.strength} Students</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Avg Performance</span>
                        <strong
                          className={`text-[14px] font-black ${
                            batch.avgScore >= 75
                              ? 'text-emerald-600'
                              : batch.avgScore >= 65
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }`}
                        >
                          {batch.avgScore}%
                        </strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dynamic Head-to-Head Metric Comparison */}
          {batchA && batchB && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-[16px] font-bold">Dynamic Head-to-Head Section Analysis</h3>
                  <p className="text-[12px] text-slate-400">Comparing Batch {batchA.label} vs Batch {batchB.label}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-indigo-600 text-white text-[11px] font-bold rounded-lg uppercase">
                    Batch {batchA.label}
                  </span>
                  <span className="text-slate-400 font-bold text-[12px]">VS</span>
                  <span className="px-3 py-1 bg-violet-600 text-white text-[11px] font-bold rounded-lg uppercase">
                    Batch {batchB.label}
                  </span>
                </div>
              </div>

              {/* Master Metric Matrix */}
              <div className="divide-y divide-slate-100">
                {[
                  {
                    label: 'Overall Class Average',
                    valA: `${batchA.avgScore}%`,
                    valB: `${batchB.avgScore}%`,
                    better: batchA.avgScore > batchB.avgScore ? 'A' : batchA.avgScore < batchB.avgScore ? 'B' : null,
                  },
                  {
                    label: 'Enrolled Strength',
                    valA: `${batchA.strength} Students`,
                    valB: `${batchB.strength} Students`,
                    better: null,
                  },
                  {
                    label: 'Performance Velocity',
                    valA: batchA.trend.toUpperCase(),
                    valB: batchB.trend.toUpperCase(),
                    better: batchA.trend === 'up' ? 'A' : batchB.trend === 'up' ? 'B' : null,
                  },
                  {
                    label: 'Pending Academic Actions',
                    valA: batchA.pendingActions,
                    valB: batchB.pendingActions,
                    better: batchA.pendingActions < batchB.pendingActions ? 'A' : 'B',
                  },
                ].map(row => (
                  <div key={row.label} className="grid grid-cols-3 px-6 py-4 items-center hover:bg-slate-50/50 transition-colors">
                    <div
                      className={`text-center text-[15px] ${
                        row.better === 'A' ? 'text-indigo-600 font-black' : 'text-slate-700 font-bold'
                      }`}
                    >
                      {row.valA}
                    </div>
                    <div className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {row.label}
                    </div>
                    <div
                      className={`text-center text-[15px] ${
                        row.better === 'B' ? 'text-violet-600 font-black' : 'text-slate-700 font-bold'
                      }`}
                    >
                      {row.valB}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Side-by-Side Weak Topics Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: `Batch ${batchA?.label} Weak Topics`, topics: weakTopicsA, color: 'indigo', batchId: batchA?.id },
              { label: `Batch ${batchB?.label} Weak Topics`, topics: weakTopicsB, color: 'violet', batchId: batchB?.id },
            ].map(side => (
              <div key={side.label} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <h3 className="text-[14.5px] font-bold text-slate-800 mb-3 flex items-center justify-between">
                  <span>{side.label}</span>
                  <span className="text-[11px] text-slate-400 font-normal">Click topic for details</span>
                </h3>

                {side.topics.length === 0 ? (
                  <div className="py-8 text-center bg-emerald-50/50 border border-emerald-100 rounded-xl text-emerald-600 font-semibold text-[12.5px]">
                    No critical weak topics recorded for this batch.
                  </div>
                ) : (
                  side.topics.map(wt => (
                    <button
                      key={wt.topic}
                      onClick={() =>
                        setModalTopic({
                          topic: wt.topic,
                          count: wt.weakCount,
                          total: wt.totalStudents,
                          avg: wt.avgScore,
                          title: `${side.label} Breakdown`,
                        })
                      }
                      className="w-full text-left mb-3 p-3 border border-slate-100 rounded-xl bg-slate-50/70 hover:bg-slate-50 hover:border-indigo-200 transition-all group"
                    >
                      <div className="flex justify-between text-[13px] mb-1">
                        <span className="font-semibold text-slate-700 group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                          {wt.topic}
                          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="font-bold text-rose-600">{wt.weakCount} Students</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full bg-rose-500"
                          style={{ width: `${Math.round((wt.weakCount / wt.totalStudents) * 100)}%` }}
                        />
                      </div>
                    </button>
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
