'use client';
// ─── AdminEvaluationQualityDashboard — AI Governance & Accuracy Audit ──────────
// Governed by:
// - 31-EVALUATION-AUDIT-VERSIONING.md §3 (EvaluationVersion immutable audit chain)
// - 32-AI-GOVERNANCE-POLICY.md §4 (Monitoring signal only — never auto-correction)
// - 05-API-SPECIFICATION.md V2 §9 (GET /analytics/evaluation-quality)
// Computes AI-human alignment directly from EvaluationVersion tuples.

import React, { useState, useMemo } from 'react';
import {
  Sparkles, GitCompareArrows, Timer, ShieldCheck,
  Filter, RotateCcw, AlertTriangle, Info, CheckCircle2
} from 'lucide-react';
import { useEvaluationQuality } from '@/hooks/useApi';
import { SkeletonCardGrid, EmptyState } from '@/components/ui/foundation';
import { DatePicker } from '@/components/ui/DatePicker';

function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} hr`;
}

export function AdminEvaluationQualityDashboard() {
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [modelVersion, setModelVersion] = useState<string>('');

  const queryParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (dateFrom) params.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) params.dateTo = new Date(dateTo).toISOString();
    if (modelVersion.trim()) params.modelVersion = modelVersion.trim();
    return Object.keys(params).length > 0 ? params : undefined;
  }, [dateFrom, dateTo, modelVersion]);

  const { data, isPending, isError, refetch } = useEvaluationQuality(queryParams);
  const quality = data?.data;

  const hasActiveFilters = Boolean(dateFrom || dateTo || modelVersion);

  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setModelVersion('');
  };

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto w-full animate-fadein">
      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight">AI Evaluation Quality &amp; Governance</h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
              <ShieldCheck className="w-3 h-3" /> Audit Certified
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Model alignment, human review override rate, and completion turnaround derived from immutable evaluation versioning.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="self-start sm:self-center px-3.5 py-2 text-xs font-bold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors bg-white shadow-xs"
        >
          Refresh Audit Metrics
        </button>
      </div>

      {/* ── Governance Policy Notice ──────────────────────────────────────── */}
      <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            Institutional AI Governance Policy (Policy §4 Compliance)
          </p>
          <p className="text-[11.5px] text-slate-500 leading-relaxed">
            All metrics are calculated directly from structured <code>EvaluationVersion</code> records. Sustained AI-human disagreement is an auditing and monitoring signal for academic review — it is never utilized for automated, unverified model weight retraining.
          </p>
        </div>
      </div>

      {/* ── Filters Toolbar ───────────────────────────────────────────────── */}
      <div className="bg-white p-4 border border-slate-200/80 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Audit Window:</span>
            <div className="flex items-center gap-1.5">
              <div className="w-36">
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="Start date" quickPresets={false} />
              </div>
              <span className="text-xs text-slate-400">to</span>
              <div className="w-36">
                <DatePicker value={dateTo} onChange={setDateTo} minDate={dateFrom || undefined} placeholder="End date" quickPresets={false} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">Model Version:</span>
            <select
              value={modelVersion}
              onChange={(e) => setModelVersion(e.target.value)}
              className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700"
            >
              <option value="">All Active Models</option>
              <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors self-start md:self-center"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </button>
        )}
      </div>

      {/* ── Content States ────────────────────────────────────────────────── */}
      {isPending && <SkeletonCardGrid count={3} />}

      {isError && (
        <EmptyState
          icon={<Sparkles className="w-6 h-6" />}
          title="Couldn't load evaluation quality data"
          description="Failed to reach the analytics audit service. Check system health and retry."
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      )}

      {!isPending && !isError && quality && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Metric 1: Agreement Rate */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-violet-50 text-violet-600"><Sparkles className="w-4 h-4" /></span>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">AI–Teacher Agreement</h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Tolerance &plusmn;0.01</span>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">{formatPercent(quality.aiTeacherAgreementRate)}</p>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Based on <strong>{quality.sampleCounts?.aiTeacherPairs ?? 0}</strong> verified AI-suggested responses reviewed by teachers.
                </p>
              </div>
              <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                Measures the percentage of evaluations where the human teacher confirmed the AI recommendation without score modifications.
              </p>
            </div>

            {/* Metric 2: Override Rate */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><GitCompareArrows className="w-4 h-4" /></span>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Reviewer Override Rate</h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Tier-2 Review</span>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">{formatPercent(quality.reviewerOverrideRate)}</p>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Across <strong>{quality.sampleCounts?.teacherReviewerPairs ?? 0}</strong> teacher decisions audited by senior reviewers.
                </p>
              </div>
              <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                Tracks quality escalation where senior academic supervisors overruled or adjusted grades awarded by evaluating instructors.
              </p>
            </div>

            {/* Metric 3: Time to Finalize */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600"><Timer className="w-4 h-4" /></span>
                  <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Evaluation Turnaround</h3>
                </div>
                <span className="text-[11px] font-semibold text-slate-400">Mean Duration</span>
              </div>
              <div>
                <p className="text-3xl font-black text-slate-900">{formatDuration(quality.timeToFinalize?.meanSeconds)}</p>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Median: <strong>{formatDuration(quality.timeToFinalize?.medianSeconds)}</strong> across {quality.timeToFinalize?.sampleCount ?? 0} finalized responses.
                </p>
              </div>
              <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2.5">
                Duration measured from student submission to terminal evaluation publication.
              </p>
            </div>
          </div>

          {/* Empty Evaluation Banner */}
          {quality.aiTeacherAgreementRate === null && quality.reviewerOverrideRate === null && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-center space-y-2">
              <AlertTriangle className="w-6 h-6 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700">No Auditable AI–Teacher Evaluation Pairs Recorded</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                These quality indicators populate as teachers review AI scoring suggestions in the digital copy evaluation workspace.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
