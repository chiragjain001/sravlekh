'use client';
// ─── FounderAnalytics — real backend ───────────────────────────────────────
// GET /founder/analytics/overview (real Prisma aggregates: institution
// growth, active users, assessment/evaluation volume) + the Python service's
// existing GET /analytics/evaluation-quality for AI-quality metrics, scoped
// to a picked institute (that endpoint doesn't support a true cross-tenant
// sum, only "any one institute a Founder chooses"). No revenue/API-latency/
// fake-timeline sections — those had no real data source.

import { useState } from 'react';
import { TrendingUp, Users as UsersIcon, FileText, Sparkles, GitCompareArrows, Timer, BarChart3 } from 'lucide-react';
import { useFounderAnalyticsOverview, useFounderInstitutes, useEvaluationQuality } from '@/hooks/useApi';
import { SkeletonCardGrid, EmptyState } from '@/components/ui/foundation';

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

interface Overview {
  institutionGrowth: { month: string; count: number }[];
  users: { total: number; activeLast30Days: number };
  assessmentVolume: { exams: { total: number; last30Days: number }; assessments: { total: number; last30Days: number } };
  evaluationVolume: { total: number; last30Days: number };
}

export function FounderAnalytics() {
  const { data, isPending, isError } = useFounderAnalyticsOverview();
  const overview = data as Overview | undefined;

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Platform Analytics</h2>
        <p className="text-xs text-slate-500 mt-0.5">Real aggregates from the platform database — no revenue or synthetic timelines.</p>
      </div>

      {isPending && <SkeletonCardGrid count={4} />}
      {isError && <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="Couldn't load analytics" />}

      {overview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard icon={<UsersIcon className="w-4 h-4 text-indigo-500" />} label="Active users (30d)" value={overview.users.activeLast30Days} sub={`of ${overview.users.total} total`} />
            <StatCard icon={<FileText className="w-4 h-4 text-emerald-500" />} label="Exams (30d)" value={overview.assessmentVolume.exams.last30Days} sub={`of ${overview.assessmentVolume.exams.total} total`} />
            <StatCard icon={<FileText className="w-4 h-4 text-sky-500" />} label="Assessments (30d)" value={overview.assessmentVolume.assessments.last30Days} sub={`of ${overview.assessmentVolume.assessments.total} total`} />
            <StatCard icon={<Sparkles className="w-4 h-4 text-violet-500" />} label="Evaluations (30d)" value={overview.evaluationVolume.last30Days} sub={`of ${overview.evaluationVolume.total} total`} />
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h3 className="text-[12.5px] font-bold text-slate-800">Institution growth (last 6 months)</h3>
            </div>
            {overview.institutionGrowth.length === 0 ? (
              <p className="text-[11.5px] text-slate-400">No institutes created in this window.</p>
            ) : (
              <div className="flex items-end gap-3 h-32">
                {overview.institutionGrowth.map((g) => {
                  const max = Math.max(...overview.institutionGrowth.map((x) => x.count), 1);
                  return (
                    <div key={g.month} className="flex flex-col items-center gap-1.5 flex-1">
                      <span className="text-[11px] font-bold text-slate-700">{g.count}</span>
                      <div className="w-full bg-indigo-500 rounded-t" style={{ height: `${(g.count / max) * 80 + 8}px` }} />
                      <span className="text-[10px] text-slate-400">{g.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <EvaluationQualitySection />
    </div>
  );
}

function EvaluationQualitySection() {
  const [instituteId, setInstituteId] = useState<string>('');
  const { data: institutesData } = useFounderInstitutes();
  const institutes: { id: string; name: string }[] = institutesData ?? [];
  const activeInstituteId = instituteId || institutes[0]?.id || '';

  const { data, isPending, isError } = useEvaluationQuality(activeInstituteId ? { instituteId: activeInstituteId } : undefined);
  const quality = data?.data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[13px] font-bold text-slate-900">AI Evaluation Quality</h3>
          <p className="text-[11.5px] text-slate-500">AI-teacher agreement, override rate, and time-to-finalize — one institute at a time (the Python service doesn't sum across tenants).</p>
        </div>
        <select value={activeInstituteId} onChange={(e) => setInstituteId(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600">
          {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>

      {isPending && <SkeletonCardGrid count={3} />}
      {isError && <EmptyState icon={<Sparkles className="w-6 h-6" />} title="Couldn't load evaluation quality data" />}

      {quality && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 mb-2">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-[13px] font-bold">AI–Teacher Agreement</span>
            </div>
            <p className="text-[26px] font-black text-slate-800">{formatPercent(quality.aiTeacherAgreementRate)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{quality.sampleCounts?.aiTeacherPairs ?? 0} AI-suggested responses reviewed</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 mb-2">
              <GitCompareArrows className="w-4 h-4 text-amber-500" />
              <span className="text-[13px] font-bold">Reviewer Override Rate</span>
            </div>
            <p className="text-[26px] font-black text-slate-800">{formatPercent(quality.reviewerOverrideRate)}</p>
            <p className="text-[11px] text-slate-400 mt-1">{quality.sampleCounts?.teacherReviewerPairs ?? 0} teacher decisions reviewed</p>
          </div>
          <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-2 text-slate-600 mb-2">
              <Timer className="w-4 h-4 text-indigo-500" />
              <span className="text-[13px] font-bold">Time to Finalize</span>
            </div>
            <p className="text-[26px] font-black text-slate-800">{formatDuration(quality.timeToFinalize?.meanSeconds)}</p>
            <p className="text-[11px] text-slate-400 mt-1">Median {formatDuration(quality.timeToFinalize?.medianSeconds)} · {quality.timeToFinalize?.sampleCount ?? 0} responses</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-center gap-2 text-slate-500 mb-1.5">{icon}<span className="text-[11px] font-bold uppercase tracking-wide">{label}</span></div>
      <p className="text-[22px] font-black text-slate-800">{value}</p>
      <p className="text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}
