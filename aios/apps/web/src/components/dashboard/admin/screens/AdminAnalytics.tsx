'use client';
// ─── AdminAnalytics — Academic Intelligence & Multi-Batch Diagnostics ───────────
// Enterprise academic intelligence powered strictly by real database aggregates:
// - Institute Overview KPIs: GET /institutes/:id/analytics/overview (real active counts)
// - 6-Month Enrollment Trajectory: StudentProfile.admissionDate monthly counts
// - Topic Mastery Heatmap: Raw PostgreSQL GROUP BY over mastery_scores via FastAPI
// - Multi-Batch Comparison: GET /analytics/batches/heatmap (side-by-side diagnostics)
// - Common Learning Pitfalls: GET /institutes/:id/analytics/batch/:id/mistake-summary
// No invented figures, no simulated projections, no fake revenue graphs.

import React, { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';
import {
  TrendingUp, Users, Flame, AlertTriangle, Layers, BarChart2,
  RefreshCw, CheckCircle2, ChevronRight, X, Sparkles, BookOpen,
  Filter, HelpCircle, ArrowUpDown, FileText
} from 'lucide-react';
import { useStudentsStats } from '@/features/students/hooks/useStudents';
import {
  useBatches,
  useBatchHeatmap,
  useBatchesHeatmap,
  useBatchMistakeSummary,
  useAnalyticsOverview,
} from '@/hooks/useApi';

// ── Status Badges & Colors ──────────────────────────────────────────────────

function MasteryBadge({ status }: { status: string }) {
  const cls =
    status === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
    status === 'WARNING'  ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-emerald-50 text-emerald-700 border-emerald-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

// ── Topic Drill-Down Modal ──────────────────────────────────────────────────

interface TopicDetail {
  topicId: string;
  topicName: string;
  averageMastery: number;
  studentsStruggling: number;
  totalStudents: number;
  strugglePercentage: number;
  status: string;
  batchName?: string;
}

function TopicDetailModal({
  topic,
  batchName,
  onClose,
  onGenerateReport,
}: {
  topic: TopicDetail | null;
  batchName: string;
  onClose: () => void;
  onGenerateReport?: () => void;
}) {
  if (!topic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadein" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Topic Diagnostic</span>
            <h3 className="text-[16px] font-extrabold text-slate-900">{topic.topicName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Cohort: <span className="font-semibold text-slate-700">{batchName}</span></p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Average Mastery</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-slate-900">{topic.averageMastery}%</span>
                <MasteryBadge status={topic.status} />
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Struggling Learners</span>
              <div className="mt-1">
                <span className="text-2xl font-black text-rose-600">{topic.studentsStruggling}</span>
                <span className="text-xs text-slate-500 ml-1.5">of {topic.totalStudents} ({topic.strugglePercentage}%)</span>
              </div>
            </div>
          </div>

          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4 text-[12.5px] text-indigo-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 text-xs uppercase tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Pedagogical Recommendation
            </div>
            <p className="text-slate-700 text-xs leading-relaxed">
              {topic.status === 'CRITICAL'
                ? 'High cognitive challenge: Over 50% of the cohort demonstrates severe misconception in this topic. Recommend scheduling a dedicated concept review session and issuing targeted auto-generated practice assignments.'
                : topic.status === 'WARNING'
                ? 'Moderate learning friction: Core fundamentals are present but inconsistent. Consider remedial worksheet distribution and targeted doubt-resolution sessions.'
                : 'Healthy concept retention: The batch demonstrates solid topic mastery. Recommended for advancement or enrichment problems.'}
            </p>
          </div>

          <div className="text-[11px] text-slate-400">
            Data lineage: Derived from PostgreSQL MasteryScore aggregated across recent assessments.
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50">
              Dismiss
            </button>
            {onGenerateReport && (
              <button
                onClick={() => { onClose(); onGenerateReport(); }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <FileText className="w-3.5 h-3.5" /> Generate Batch Report
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Multi-Batch Comparison Table ────────────────────────────────────────────

function MultiBatchComparisonView({
  batches,
  selectedBatchIds,
  onToggleBatch,
}: {
  batches: { id: string; name: string }[];
  selectedBatchIds: string[];
  onToggleBatch: (id: string) => void;
}) {
  const { data: heatmapData, isPending, isError } = useBatchesHeatmap(selectedBatchIds);

  // Group topics across selected batches
  const comparisonRows = useMemo(() => {
    if (!heatmapData) return [];
    const topicMap = new Map<string, { topicName: string; scores: Record<string, number | null> }>();

    for (const bId of selectedBatchIds) {
      const rows = (heatmapData[bId] ?? []) as any[];
      for (const r of rows) {
        if (!topicMap.has(r.topicId)) {
          topicMap.set(r.topicId, { topicName: r.topicName, scores: {} });
        }
        topicMap.get(r.topicId)!.scores[bId] = r.averageMastery;
      }
    }

    return Array.from(topicMap.entries()).map(([topicId, item]) => {
      const vals = Object.values(item.scores).filter((v): v is number => v !== null);
      const avg = vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      const min = vals.length ? Math.min(...vals) : null;
      const max = vals.length ? Math.max(...vals) : null;
      const variance = min !== null && max !== null ? max - min : 0;
      return { topicId, topicName: item.topicName, scores: item.scores, overallAvg: avg, variance };
    }).sort((a, b) => (a.overallAvg ?? 100) - (b.overallAvg ?? 100)); // Weakest overall first
  }, [heatmapData, selectedBatchIds]);

  return (
    <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Multi-Batch Comparative Intelligence</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Select up to 4 batches to compare topic mastery across cohorts</p>
        </div>

        {/* Batch Pills Picker */}
        <div className="flex flex-wrap items-center gap-1.5">
          {batches.map((b) => {
            const isSelected = selectedBatchIds.includes(b.id);
            return (
              <button
                key={b.id}
                onClick={() => onToggleBatch(b.id)}
                className={`text-[11.5px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {isSelected ? '✓ ' : '+ '} {b.name}
              </button>
            );
          })}
        </div>
      </div>

      {selectedBatchIds.length < 2 ? (
        <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
          Select at least two batches above to activate side-by-side comparative diagnostics.
        </div>
      ) : isPending ? (
        <div className="space-y-2 animate-pulse py-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-xl" />)}
        </div>
      ) : isError ? (
        <div className="text-center py-10 text-sm text-rose-500">Failed to load multi-batch comparison.</div>
      ) : comparisonRows.length === 0 ? (
        <div className="text-center py-10 text-sm text-slate-400">No comparative topic mastery records available for the selected batches.</div>
      ) : (
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Topic</th>
                {selectedBatchIds.map((bId) => {
                  const bName = batches.find((b) => b.id === bId)?.name ?? bId;
                  return <th key={bId} className="px-3 py-3 text-center">{bName}</th>;
                })}
                <th className="px-3 py-3 text-center">Combined Avg</th>
                <th className="px-3 py-3 text-right">Variance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonRows.map((row) => (
                <tr key={row.topicId} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.topicName}</td>
                  {selectedBatchIds.map((bId) => {
                    const val = row.scores[bId];
                    return (
                      <td key={bId} className="px-3 py-3 text-center">
                        {val != null ? (
                          <span className={`inline-block font-bold px-2 py-0.5 rounded-md ${
                            val < 50 ? 'bg-rose-50 text-rose-700' : val < 70 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                          }`}>
                            {val}%
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center font-bold text-slate-800">
                    {row.overallAvg != null ? `${row.overallAvg}%` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    {row.variance > 15 ? (
                      <span className="inline-flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md">
                        <AlertTriangle className="w-3 h-3" /> Δ{Math.round(row.variance)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">Δ{Math.round(row.variance)}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Common Learning Pitfalls (Mistake Analysis) ─────────────────────────────

function LearningPitfallsCard({ batchId }: { batchId: string | undefined }) {
  const { data: mistakeData, isPending } = useBatchMistakeSummary(batchId);

  if (!batchId) {
    return (
      <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm text-center py-10 text-xs text-slate-400">
        Select a batch to inspect systematic cognitive error patterns.
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm space-y-3 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-48" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-slate-100 rounded-xl" />
          <div className="h-16 bg-slate-100 rounded-xl" />
        </div>
      </div>
    );
  }

  const tagBreakdown: Record<string, number> = mistakeData?.byTag ?? {};
  const totalMistakes: number = mistakeData?.totalMistakes ?? 0;
  const entries = Object.entries(tagBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Common Learning Pitfalls</h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Recurring mistake tags across graded responses</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-slate-400">Total Flagged Errors</span>
          <p className="text-lg font-black text-slate-800 leading-none mt-0.5">{totalMistakes}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400">
          No mistake tags recorded for this batch yet. Populates automatically during response evaluation.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map(([tag, count]) => {
            const pct = totalMistakes > 0 ? Math.round((count / totalMistakes) * 100) : 0;
            const label = tag.replace(/_/g, ' ');
            return (
              <div key={tag} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-bold text-slate-800 capitalize">{label.toLowerCase()}</span>
                  <span className="font-bold text-slate-600">{count} ({pct}%)</span>
                </div>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-slate-400 italic">
        * Indicates cognitive error trends observed during grading — use to target instructional emphasis.
      </p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function AdminAnalytics({
  onGenerateBatchReport,
}: {
  onGenerateBatchReport?: (batchId: string) => void;
}) {
  const { data: overview, isPending: overviewPending, refetch: refetchOverview } = useAnalyticsOverview();
  const { data: stats, isPending: statsPending, refetch: refetchStats } = useStudentsStats();
  const { data: batchesData } = useBatches();

  const batches: { id: string; name: string }[] = useMemo(() => {
    return batchesData?.data ?? batchesData ?? [];
  }, [batchesData]);

  const [selectedBatchId, setSelectedBatchId] = useState<string | undefined>(undefined);
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [inspectedTopic, setInspectedTopic] = useState<TopicDetail | null>(null);

  // Set initial selected batch if available and unset
  React.useEffect(() => {
    if (!selectedBatchId && batches.length > 0 && batches[0]) {
      setSelectedBatchId(batches[0].id);
      setSelectedCompareIds(batches.slice(0, 2).map((b) => b.id));
    }
  }, [batches, selectedBatchId]);

  const { data: heatmapData, isPending: heatmapPending, isError: heatmapError, refetch: refetchHeatmap } = useBatchHeatmap(selectedBatchId);
  const heatmapRows: any[] = heatmapData?.data ?? [];

  const enrollmentData = stats?.enrollmentByMonth ?? [];
  const totalNewInWindow = enrollmentData.reduce((s, e) => s + e.count, 0);

  const activeBatchName = batches.find((b) => b.id === selectedBatchId)?.name ?? 'Selected Batch';

  const handleToggleCompareBatch = (id: string) => {
    setSelectedCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((b) => b !== id);
      }
      if (prev.length >= 4) return prev; // max 4 batches
      return [...prev, id];
    });
  };

  const handleRefreshAll = () => {
    refetchOverview();
    refetchStats();
    refetchHeatmap();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto w-full animate-fadein">
      {/* ── Header Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight">Academic Intelligence &amp; Analytics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Institutional aggregates, enrollment dynamics, topic mastery, and comparative diagnostics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
              compareMode
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {compareMode ? 'Exit Batch Comparison' : 'Compare Batches'}
          </button>

          <button
            onClick={handleRefreshAll}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Refresh analytics data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Section 3.1: Institutional Overview KPIs ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4.5 border border-slate-200/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wide">Total Active Students</span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg"><Users className="w-4 h-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overviewPending ? '—' : (overview?.totalStudents ?? stats?.total ?? 0)}</span>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active Registry</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Verified institute enrolled learners</p>
        </div>

        <div className="bg-white p-4.5 border border-slate-200/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wide">Teaching Faculty</span>
            <span className="p-1.5 bg-violet-50 text-violet-600 rounded-lg"><BookOpen className="w-4 h-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overviewPending ? '—' : (overview?.totalTeachers ?? '—')}</span>
            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">All Departments</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Active instructors across assigned batches</p>
        </div>

        <div className="bg-white p-4.5 border border-slate-200/80 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-bold text-slate-500 uppercase tracking-wide">Active Examinations</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{overviewPending ? '—' : (overview?.activeExams ?? 0)}</span>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Published / Live</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Exams currently in progress or awaiting evaluation</p>
        </div>
      </div>

      {/* ── Section 3.2: 6-Month Enrollment Trajectory ─────────────────────── */}
      <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">New Student Intake Trajectory</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Real admission records from StudentProfile.admissionDate (last 6 months)</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-slate-400">Intake in Window</span>
            <span className="text-xl font-black text-slate-900 ml-2">{statsPending ? '—' : totalNewInWindow}</span>
          </div>
        </div>

        {statsPending ? (
          <div className="h-56 bg-slate-100 rounded-xl animate-pulse" />
        ) : enrollmentData.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400">No enrollment records logged in the past 6 months.</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={enrollmentData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="enrollmentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RechartsTooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', fontSize: '12px' }} />
              <Area type="monotone" dataKey="count" name="New Learners" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#enrollmentGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Section 3.4: Multi-Batch Comparison (if active) ───────────────── */}
      {compareMode && (
        <MultiBatchComparisonView
          batches={batches}
          selectedBatchIds={selectedCompareIds}
          onToggleBatch={handleToggleCompareBatch}
        />
      )}

      {/* ── Single Batch Diagnostic Section ──────────────────────────────── */}
      {!compareMode && (
        <div className="space-y-6">
          {/* Batch Selector Bar */}
          <div className="bg-white p-4 border border-slate-200/80 rounded-2xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Target Cohort:</span>
              <select
                value={selectedBatchId ?? ''}
                onChange={(e) => setSelectedBatchId(e.target.value || undefined)}
                className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50/50 hover:bg-white text-slate-800 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            {selectedBatchId && onGenerateBatchReport && (
              <button
                onClick={() => onGenerateBatchReport(selectedBatchId)}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 px-3 py-1.5 rounded-xl bg-indigo-50/60 hover:bg-indigo-100/60 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" /> Generate Report for this Batch
              </button>
            )}
          </div>

          {/* Section 3.3: Topic Mastery Heatmap */}
          <div className="bg-white p-5 border border-slate-200/80 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-rose-500" />
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Topic Mastery Breakdown</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Computed from real MasteryScore rows — ordered weakest-first to isolate learning gaps</p>
              </div>

              {/* Threshold legend */}
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" /> &lt;50% Critical</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 50–70% Warning</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> &ge;70% Healthy</span>
              </div>
            </div>

            {!selectedBatchId ? (
              <div className="text-center py-14 text-xs text-slate-400">Select a batch above to inspect topic mastery intelligence.</div>
            ) : heatmapPending ? (
              <div className="space-y-2 animate-pulse py-4">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}
              </div>
            ) : heatmapError ? (
              <div className="text-center py-12 text-xs text-rose-500">Failed to load topic mastery data for this batch.</div>
            ) : heatmapRows.length === 0 ? (
              <div className="text-center py-14">
                <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-500">No mastery records logged for this batch yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">This will populate as students complete assessments and questions get scored.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {heatmapRows.map((r) => (
                  <div
                    key={r.topicId}
                    onClick={() => setInspectedTopic({ ...r, batchName: activeBatchName })}
                    className="flex items-center justify-between p-3.5 bg-slate-50/75 hover:bg-slate-100/75 border border-slate-100 rounded-xl transition-all cursor-pointer group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{r.topicName}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-rose-600">{r.studentsStruggling}</span> of {r.totalStudents} student(s) below threshold ({r.strugglePercentage}%)
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-slate-800">{r.averageMastery}%</span>
                      <MasteryBadge status={r.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3.5: Common Learning Pitfalls */}
          <LearningPitfallsCard batchId={selectedBatchId} />
        </div>
      )}

      {/* ── Topic Diagnostic Modal ────────────────────────────────────────── */}
      <TopicDetailModal
        topic={inspectedTopic}
        batchName={activeBatchName}
        onClose={() => setInspectedTopic(null)}
        onGenerateReport={selectedBatchId && onGenerateBatchReport ? () => onGenerateBatchReport(selectedBatchId) : undefined}
      />
    </div>
  );
}
