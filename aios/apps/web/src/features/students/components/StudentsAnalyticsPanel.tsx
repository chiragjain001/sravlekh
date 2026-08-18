'use client';
// ─── Students Analytics Panel ──────────────────────────────────────────────────
// Analytics tab within AdminStudents — charts, KPIs, distributions.
// Consumes useStudentsAnalytics() hook.

import React from 'react';
import {
  LineChart, Line, PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { TrendingUp, Users, AlertTriangle, UserPlus, BarChart2, PieChart as PieIcon } from 'lucide-react';
import { useStudentsAnalytics } from '../hooks/useStudents';

// ── Skeleton ───────────────────────────────────────────────────────────────────
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="h-64 bg-slate-100 rounded-2xl" />
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, gradient,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white ${gradient} shadow-lg`}>
      <div className="absolute top-3 right-3 opacity-20">
        <Icon className="w-16 h-16" />
      </div>
      <div className="relative z-10">
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="text-3xl font-black mt-1 leading-none">{value}</p>
        {sub && <p className="text-xs opacity-70 mt-1 font-medium">{sub}</p>}
      </div>
    </div>
  );
}

export function StudentsAnalyticsPanel() {
  const { data: analytics, isLoading, isError } = useStudentsAnalytics();

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !analytics) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        <span className="text-sm">Failed to load analytics</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Students"    value={analytics.totalStudents.toLocaleString()}
          sub="+7% this session"    icon={Users}
          gradient="bg-gradient-to-br from-indigo-600 to-indigo-800"
        />
        <KpiCard
          label="Active Students"   value={analytics.activeStudents.toLocaleString()}
          sub="of total enrolled"   icon={TrendingUp}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="At-Risk Students"  value={analytics.atRiskCount}
          sub="Need intervention"   icon={AlertTriangle}
          gradient="bg-gradient-to-br from-rose-500 to-rose-700"
        />
        <KpiCard
          label="New Admissions"    value={analytics.newAdmissions}
          sub="This month"          icon={UserPlus}
          gradient="bg-gradient-to-br from-violet-500 to-violet-700"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Enrollment Trend */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-900">Enrollment Trend</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.enrollmentTrend} margin={{ top: 5, right: 10, bottom: 5, left: -25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }}
                  formatter={(v: number) => [v.toLocaleString(), 'Students']}
                />
                <Line
                  type="monotone" dataKey="count" stroke="#6366f1"
                  strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fee Breakdown */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900">Fee Distribution</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.feeBreakdown}
                    innerRadius={42} outerRadius={64}
                    paddingAngle={3} dataKey="value" stroke="none"
                  >
                    {analytics.feeBreakdown.map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {analytics.feeBreakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium">{item.label}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">{item.value}</span>
                    <span className="text-slate-400 ml-1 text-[10px]">
                      ({Math.round(item.value / analytics.totalStudents * 100)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-bold text-slate-900">Risk Distribution</h3>
          </div>
          <div className="space-y-3">
            {analytics.riskDistribution.map((item, i) => {
              const pct = Math.round(item.count / analytics.totalStudents * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{item.level} Risk</span>
                    <span className="font-bold text-slate-900">{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Batch Performance */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900">Batch-wise Performance vs Attendance</h3>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={analytics.batchPerformance} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="batch" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
              <Bar dataKey="avg"        name="Avg Score %"    fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="attendance" name="Attendance %"   fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Teacher Gap Map */}
      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Teacher Performance Gap Analysis</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {analytics.subjectGapMap.map((s, i) => {
            const teacherMap: Record<string, string> = {
              'Physics': 'Rahul Verma (Physics)',
              'Chemistry': 'Pooja Sharma (Chem)',
              'Mathematics': 'Amit Singh (Maths)',
              'Biology': 'Meera Joshi (Bio)',
            };
            const label = teacherMap[s.subject] ?? s.subject;
            return (
              <div key={i} className="text-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div
                  className="text-3xl font-black"
                  style={{ color: s.color }}
                >
                  {s.gap}%
                </div>
                <p className="text-xs text-slate-600 font-bold mt-1">{label}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">avg gap from target</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
