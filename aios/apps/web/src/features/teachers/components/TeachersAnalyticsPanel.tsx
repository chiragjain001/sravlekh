'use client';
// ─── Teachers Analytics Panel Component ───────────────────────────────────────

import React from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Users, Clock, Award, AlertTriangle, UserCheck, FileCheck } from 'lucide-react';
import { useTeachersAnalytics } from '../hooks/useTeachers';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[1,2,3].map((i) => <div key={i} className="h-64 bg-slate-100 rounded-2xl" />)}
      </div>
    </div>
  );
}

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

export function TeachersAnalyticsPanel() {
  const { data: analytics, isLoading, isError } = useTeachersAnalytics();

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !analytics) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        <span className="text-sm">Failed to load faculty analytics</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Faculty"       value={analytics.totalTeachers}
          sub="+4% this term"         icon={Users}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-800"
        />
        <KpiCard
          label="Active Today"        value={analytics.activeToday}
          sub="91% on campus"          icon={UserCheck}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="Avg Weekly Workload"  value={`${analytics.avgWorkloadHours} h`}
          sub="Optimal 18.0 h target"  icon={Clock}
          gradient="bg-gradient-to-br from-violet-600 to-purple-800"
        />
        <KpiCard
          label="Pending Appraisals"   value={analytics.pendingAppraisals}
          sub="Requires HR review"    icon={Award}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Subject Coverage Pie */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Subject Faculty Ratio</h3>
          <div className="flex items-center gap-4">
            <div className="w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.subjectCoverage}
                    innerRadius={40} outerRadius={62}
                    paddingAngle={3} dataKey="teacherCount" stroke="none"
                  >
                    {analytics.subjectCoverage.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2">
              {analytics.subjectCoverage.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 font-medium">{item.subject}</span>
                  </div>
                  <span className="font-bold text-slate-900">{item.teacherCount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workload Distribution */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Workload Distribution</h3>
          <div className="space-y-3">
            {analytics.workloadDistribution.map((w, i) => {
              const pct = Math.round((w.count / analytics.totalTeachers) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700">{w.range}</span>
                    <span className="font-bold text-slate-900">{w.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: w.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Stars */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>Top Star Faculty</span>
              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Top 5</span>
            </h3>
            <div className="space-y-2.5">
              {analytics.topPerformers.map((fp) => (
                <div key={fp.rank} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-white font-bold text-[10px] flex items-center justify-center">
                      #{fp.rank}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{fp.name}</p>
                      <p className="text-[10px] text-slate-400">{fp.subject}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    {fp.score}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
