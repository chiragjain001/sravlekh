'use client';
// ─── AdminAnalytics — Academic Intelligence ────────────────────────────────────
// Real data only: institute-wide enrollment trend (from StudentProfile.
// admissionDate) and a per-batch topic mastery heatmap computed by the
// existing Python analytics service (pandas aggregation over real
// MasteryScore rows — apps/api-python/src/routers/analytics.py). No revenue
// figures — no billing domain exists — and no invented percentages anywhere.

import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Users, Flame, AlertTriangle } from 'lucide-react';
import { useStudentsStats } from '@/features/students/hooks/useStudents';
import { useBatches, useBatchHeatmap } from '@/hooks/useApi';

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' :
    status === 'WARNING' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    'bg-emerald-50 text-emerald-700 border-emerald-200';
  return <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${cls}`}>{status}</span>;
}

function MasteryHeatmap() {
  const { data: batchesData } = useBatches();
  const batches: { id: string; name: string }[] = batchesData?.data ?? batchesData ?? [];
  const [batchId, setBatchId] = useState<string | undefined>(undefined);
  const { data, isPending, isError } = useBatchHeatmap(batchId);

  const rows: any[] = data?.data ?? [];

  return (
    <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-rose-500" /> Topic Mastery Heatmap</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Computed from real MasteryScore data — sorted weakest-first</p>
        </div>
        <select value={batchId ?? ''} onChange={(e) => setBatchId(e.target.value || undefined)} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[200px]">
          <option value="">Select a batch</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {!batchId ? (
        <div className="text-center py-14 text-sm text-slate-400">Select a batch to see its topic mastery breakdown.</div>
      ) : isPending ? (
        <div className="space-y-2 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}</div>
      ) : isError ? (
        <div className="text-center py-14 text-sm text-rose-500">Failed to load mastery data for this batch.</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-14">
          <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No mastery data recorded for this batch yet.</p>
          <p className="text-xs text-slate-400 mt-1">This fills in as students attempt assessments and topics get scored.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.topicId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-xs font-bold text-slate-900">{r.topicName}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{r.studentsStruggling} of {r.totalStudents} student(s) below 50% ({r.strugglePercentage}%)</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">{r.averageMastery}%</span>
                <StatusBadge status={r.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminAnalytics() {
  const { data: stats, isPending } = useStudentsStats();
  const enrollmentData = stats?.enrollmentByMonth ?? [];
  const totalNewInWindow = enrollmentData.reduce((s, e) => s + e.count, 0);

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      <div>
        <h2 className="text-[18px] font-bold text-slate-800">Analytics &amp; Intelligence</h2>
        <p className="text-[13px] text-slate-500">Real enrollment trends and topic-level mastery intelligence — no invented figures.</p>
      </div>

      <div className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-[13px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-500" /> New Enrollments (6 months)</p>
            <p className="text-[24px] font-black text-slate-800 mt-1">{isPending ? '—' : totalNewInWindow}</p>
            <p className="text-[12px] font-semibold text-slate-400 flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3" /> From StudentProfile.admissionDate — real, not projected
            </p>
          </div>
        </div>
        {isPending ? (
          <div className="h-60 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={enrollmentData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorStudents" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="count" name="New Students" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorStudents)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <MasteryHeatmap />
    </div>
  );
}
