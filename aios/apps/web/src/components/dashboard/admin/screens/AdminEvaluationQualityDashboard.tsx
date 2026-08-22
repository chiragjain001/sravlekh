'use client';
// ─── AdminEvaluationQualityDashboard — 31-EVALUATION-AUDIT-VERSIONING.md §3, Phase 14 ──
// Backs GET /analytics/evaluation-quality (FastAPI, real from day one — no
// mock predecessor existed for this screen). Governed by 32-AI-GOVERNANCE-
// POLICY.md §4: sustained disagreement is a monitoring signal here, never an
// automatic model correction.

import { Sparkles, GitCompareArrows, Timer } from 'lucide-react';
import { useEvaluationQuality } from '@/hooks/useApi';
import { SkeletonCardGrid, EmptyState } from '@/components/ui/foundation';

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

export function AdminEvaluationQualityDashboard() {
  const { data, isPending, isError } = useEvaluationQuality();
  const quality = data?.data;

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Evaluation Quality</h2>
        <p className="text-xs text-slate-500 mt-0.5">AI-teacher agreement, reviewer override rate, and time-to-finalize — computed from the evaluation version chain.</p>
      </div>

      {isPending && <SkeletonCardGrid count={3} />}

      {isError && (
        <EmptyState icon={<Sparkles className="w-6 h-6" />} title="Couldn't load evaluation quality data" description="Something went wrong reaching the analytics service." />
      )}

      {!isPending && !isError && quality && (
        <>
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

          {quality.aiTeacherAgreementRate === null && quality.reviewerOverrideRate === null && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[12px] text-slate-500">
              No AI-assisted or reviewer-overridden evaluations yet — these metrics populate once teachers start reviewing AI suggestions.
            </div>
          )}
        </>
      )}
    </div>
  );
}
