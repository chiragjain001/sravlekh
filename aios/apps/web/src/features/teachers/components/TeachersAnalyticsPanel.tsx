'use client';
// ─── Teachers Analytics Panel ──────────────────────────────────────────────────
// Real aggregates only, from TeachersService.getStats — no appraisal ratings,
// leave stats, or faculty rankings, since no such domain exists in the backend.

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserCheck, UserX, BookOpen } from 'lucide-react';
import { useTeachersStats } from '../hooks/useTeachers';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}</div>
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

export function TeachersAnalyticsPanel() {
  const { data: stats, isPending, isError } = useTeachersStats();

  if (isPending) return <AnalyticsSkeleton />;
  if (isError || !stats) return <div className="text-center py-16 text-sm text-slate-500">Failed to load faculty stats.</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Teachers" value={stats.total} icon={Users} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <KpiCard label="Active" value={stats.active} icon={UserCheck} gradient="bg-gradient-to-br from-teal-500 to-teal-700" />
        <KpiCard label="Inactive" value={stats.inactive} icon={UserX} gradient="bg-gradient-to-br from-slate-500 to-slate-700" />
        <KpiCard label="Unassigned to a Subject" value={stats.unassignedToSubject} icon={BookOpen} gradient="bg-gradient-to-br from-amber-500 to-amber-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Teachers by Subject</h4>
          {(stats.bySubject?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No subject assignments yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.bySubject ?? []} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="subject" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-center gap-4">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Batch Assignment Coverage</h4>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-black text-emerald-600">{stats.withBatchAssignment}</p>
              <p className="text-[11px] text-slate-500">Assigned to a batch</p>
            </div>
            <div>
              <p className="text-3xl font-black text-slate-400">{stats.withoutBatchAssignment}</p>
              <p className="text-[11px] text-slate-500">Not yet assigned</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
