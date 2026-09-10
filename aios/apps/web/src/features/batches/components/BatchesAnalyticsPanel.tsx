'use client';
// ─── Batches Analytics Panel ───────────────────────────────────────────────────
// Real aggregates only, from BatchesService.getStats — no capacity/fee/
// syllabus-progress figures, since no such domain exists in the backend.

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Layers, CheckCircle2, Archive, Users } from 'lucide-react';
import { useBatchesStats } from '../hooks/useBatches';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}</div>
      <div className="h-64 bg-slate-100 rounded-2xl" />
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, gradient }: { label: string; value: string | number; icon: React.ElementType; gradient: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white ${gradient} shadow-lg`}>
      <div className="absolute top-3 right-3 opacity-20"><Icon className="w-16 h-16" /></div>
      <div className="relative z-10">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="text-3xl font-black mt-1 leading-none">{value}</p>
      </div>
    </div>
  );
}

export function BatchesAnalyticsPanel() {
  const { data: stats, isPending, isError } = useBatchesStats();

  if (isPending) return <AnalyticsSkeleton />;
  if (isError || !stats) return <div className="text-center py-16 text-sm text-slate-500">Failed to load batch stats.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Batches" value={stats.total} icon={Layers} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" />
        <KpiCard label="Active" value={stats.active} icon={CheckCircle2} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <KpiCard label="Archived" value={stats.inactive} icon={Archive} gradient="bg-gradient-to-br from-slate-500 to-slate-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Batches by Class Year</h4>
          {(stats.byClassYear?.length ?? 0) === 0 ? <p className="text-xs text-slate-400 py-8 text-center">No batches yet.</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byClassYear ?? []} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="classYear" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-blue-500" /> Top Batches by Enrollment</h4>
          {(stats.byEnrollment?.length ?? 0) === 0 ? <p className="text-xs text-slate-400 py-8 text-center">No students enrolled yet.</p> : (
            <div className="space-y-2">
              {(stats.byEnrollment ?? []).map((b: any) => (
                <div key={b.batchId} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-xs">
                  <span className="font-medium text-slate-700">{b.batchName}</span>
                  <span className="font-bold text-slate-900">{b.studentCount} students</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
