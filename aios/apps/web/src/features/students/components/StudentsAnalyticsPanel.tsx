'use client';
// ─── Students Analytics Panel ──────────────────────────────────────────────────
// Real aggregates only, from StudentsService.getStats — no revenue/fee/risk
// figures, since no such domain exists in the backend.

import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, UserPlus, UserCheck, UserX, AlertTriangle } from 'lucide-react';
import { useStudentsStats } from '../hooks/useStudents';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[1, 2].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
      </div>
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

export function StudentsAnalyticsPanel() {
  const { data: stats, isPending, isError } = useStudentsStats();

  if (isPending) return <AnalyticsSkeleton />;
  if (isError || !stats) {
    return <div className="text-center py-16 text-sm text-slate-500">Failed to load roster stats.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Total Students" value={stats.total} icon={Users} gradient="bg-gradient-to-br from-indigo-500 to-indigo-700" />
        <KpiCard label="Active" value={stats.active} icon={UserCheck} gradient="bg-gradient-to-br from-emerald-500 to-emerald-700" />
        <KpiCard label="Inactive" value={stats.inactive} icon={UserX} gradient="bg-gradient-to-br from-slate-500 to-slate-700" />
        <KpiCard label="New (30 days)" value={stats.newLast30Days} icon={UserPlus} gradient="bg-gradient-to-br from-blue-500 to-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Students by Batch</h4>
          {(stats.byBatch?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No students enrolled yet.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byBatch ?? []} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="batchName" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Enrollment (last 6 months)</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.enrollmentByMonth ?? []} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {(stats.byTag?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Students by Tag
          </h4>
          <div className="flex flex-wrap gap-2">
            {(stats.byTag ?? []).map((t: any) => (
              <span key={t.tag} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-xs font-medium text-slate-600">
                {t.tag} <span className="font-bold text-slate-900 ml-1">{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
