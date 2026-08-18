'use client';
// ─── Batches Analytics Panel Component ───────────────────────────────────────

import React from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Layers, Users, Award, AlertTriangle, CalendarDays, TrendingUp } from 'lucide-react';
import { useBatchesAnalytics } from '../hooks/useBatches';

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

export function BatchesAnalyticsPanel() {
  const { data: analytics, isLoading, isError } = useBatchesAnalytics();

  if (isLoading) return <AnalyticsSkeleton />;

  if (isError || !analytics) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        <AlertTriangle className="w-6 h-6 mr-2" />
        <span className="text-sm">Failed to load batch analytics</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Batches"       value={analytics.totalBatches}
          sub="+6% this year"         icon={Layers}
          gradient="bg-gradient-to-br from-blue-600 to-indigo-800"
        />
        <KpiCard
          label="Active Cohorts"      value={analytics.activeCohorts}
          sub="87.5% operational"     icon={Users}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
        />
        <KpiCard
          label="Avg Batch Capacity"  value={`${analytics.avgCapacityPct}%`}
          sub="+3% seat fill rate"    icon={TrendingUp}
          gradient="bg-gradient-to-br from-purple-600 to-indigo-800"
        />
        <KpiCard
          label="Upcoming Batches"   value={analytics.upcomingBatches}
          sub="Launching in 30 days"  icon={CalendarDays}
          gradient="bg-gradient-to-br from-amber-500 to-orange-600"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cohort Score Comparison */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-2">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Cohort Performance &amp; Attendance Comparison</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.cohortComparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="avgScore" name="Avg Score %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="attendance" name="Attendance %" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Seat Utilization Pie */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm col-span-1 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-4">Institute Capacity Utilization</h3>
            <div className="h-44 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.capacityUtilization}
                    innerRadius={45} outerRadius={68}
                    paddingAngle={3} dataKey="value" stroke="none"
                  >
                    {analytics.capacityUtilization.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {analytics.capacityUtilization.map((u, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: u.color }} />
                    <span className="text-slate-600 font-medium">{u.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{u.value} seats</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
