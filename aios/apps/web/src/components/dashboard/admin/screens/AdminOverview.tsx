'use client';

import { useState } from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { adminData as d } from '@/lib/mock-data/admin';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, BookOpen, Bell, Activity, DollarSign
} from 'lucide-react';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

// ── Attendance Donut ──────────────────────────────────────────────────────────
function AttendanceDonut({ data }: { data: typeof d.attendance }) {
  const pieData = [
    { name: 'Present', value: data.present, fill: '#10b981' },
    { name: 'Absent',  value: data.absent,  fill: '#f43f5e' },
    { name: 'Leave',   value: data.leave,   fill: '#f59e0b' },
  ];
  return (
    <div className="card">
      <p className="section-title">Attendance Overview</p>
      <div className="flex items-center gap-4">
        <div className="relative w-28 h-28">
          <PieChart width={112} height={112}>
            <Pie data={pieData} cx={52} cy={52} innerRadius={36} outerRadius={52} dataKey="value" strokeWidth={0}>
              {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-bold text-slate-800">{data.average}</span>
            <span className="text-[9px] text-slate-500">Avg. Attendance</span>
          </div>
        </div>
        <div className="space-y-2">
          {pieData.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
              <span className="text-[12px] text-slate-600">{p.name}</span>
              <span className="text-[12px] font-bold text-slate-700 ml-auto pl-2">{p.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminOverview() {
  const [activeModal, setActiveModal] = useState<'topBatches' | 'alerts' | 'activities' | 'finance' | null>(null);

  return (
    <div className="p-5 space-y-4 animate-fadein">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {d.kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            change={kpi.change}
            changePositive
            color={kpi.color as any}
          />
        ))}
      </div>

      {/* Row 2: Performance Chart + Top Batches + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Institute Performance */}
        <div className="card lg:col-span-1">
          <p className="section-title">Institute Performance Overview</p>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /><span className="text-[11px] text-slate-500">Avg Score (%)</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /><span className="text-[11px] text-slate-500">Attendance (%)</span></div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={d.performanceData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[60, 100]} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
              <Line type="monotone" dataKey="avgScore" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
              <Line type="monotone" dataKey="attendance" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Batches */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Top Performing Batches</p>
            <button onClick={() => setActiveModal('topBatches')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">View All →</button>
          </div>
          <div className="space-y-3">
            {d.topBatches.map((b, i) => (
              <div key={b.name}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-slate-700 font-medium">{b.name}</span>
                  <span className="font-bold text-slate-700">{b.score}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-emerald-500' : i === 2 ? 'bg-sky-500' : 'bg-violet-500'}`}
                    style={{ width: `${b.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Alerts &amp; Notifications</p>
            <button onClick={() => setActiveModal('alerts')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">View All →</button>
          </div>
          <div className="space-y-2">
            {d.alerts.map((a, i) => {
              const Icon = a.type === 'error' ? AlertCircle : a.type === 'warning' ? AlertTriangle : Info;
              return (
                <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg text-[12px] ${
                  a.type === 'error'   ? 'bg-rose-50   text-rose-700'   :
                  a.type === 'warning' ? 'bg-amber-50  text-amber-700'  :
                  'bg-sky-50 text-sky-700'
                }`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{a.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 3: Recent Activities + Attendance + Fee */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activities */}
        <div className="card lg:col-span-1">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Recent Activities</p>
            <button onClick={() => setActiveModal('activities')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">View All →</button>
          </div>
          <div className="space-y-3">
            {d.recentActivities.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-[12.5px] font-medium text-slate-700">{a.event}</p>
                  <p className="text-[11px] text-slate-400">{a.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <AttendanceDonut data={d.attendance} />

        {/* Fee Collection */}
        <div className="card">
          <p className="section-title">Fee Collection</p>
          <div className="space-y-3">
            <div className="flex justify-between">
              <div>
                <p className="text-[11px] text-slate-500 mb-0.5">Collected</p>
                <p className="text-[20px] font-bold text-emerald-600">{d.feeCollection.collected}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-500 mb-0.5">Total Expected</p>
                <p className="text-[20px] font-bold text-slate-700">{d.feeCollection.expected}</p>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-3">
              <div
                className="h-3 rounded-full bg-emerald-500 flex items-center justify-end pr-2"
                style={{ width: `${d.feeCollection.percentage}%` }}
              >
                <span className="text-[9px] font-bold text-white">{d.feeCollection.percentage}%</span>
              </div>
            </div>
            <p className="text-[11.5px] text-slate-500">{d.feeCollection.percentage}% Collection Rate</p>
            <button onClick={() => setActiveModal('finance')} className="text-[12px] text-indigo-600 font-medium hover:underline cursor-pointer">View Financial Report →</button>
          </div>
        </div>
      </div>

      {/* ── OVERLAP MODAL CARDS ── */}

      {/* 1. Top Batches Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'topBatches'}
        onClose={() => setActiveModal(null)}
        title="Top Performing Batches Overview"
        subtitle="Ranked score performance across all active batches"
        icon={BookOpen}
        badgeText="4 Batches"
      >
        <div className="space-y-3">
          {d.topBatches.map((b, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{b.name}</h4>
                <p className="text-xs text-slate-500">Active Academic Cohort</p>
              </div>
              <span className="text-lg font-black text-emerald-600">{b.score}%</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 2. Alerts Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'alerts'}
        onClose={() => setActiveModal(null)}
        title="System Alerts & Notifications"
        subtitle="All pending critical system warnings and information logs"
        icon={Bell}
        badgeText="Active Alerts"
      >
        <div className="space-y-2.5">
          {d.alerts.map((a, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-800">{a.text}</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 3. Activities Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'activities'}
        onClose={() => setActiveModal(null)}
        title="Recent System Activities Audit"
        subtitle="Real-time timeline of operator actions"
        icon={Activity}
        badgeText="Real-time Feed"
      >
        <div className="space-y-2">
          {d.recentActivities.map((a, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{a.event}</p>
                <p className="text-[10px] text-slate-400">{a.time}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 4. Financial Report Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'finance'}
        onClose={() => setActiveModal(null)}
        title="Fee Collection & Dues Overview"
        subtitle="Summary of fee revenue targets and collection percentages"
        icon={DollarSign}
        badgeText={`${d.feeCollection.percentage}% Collected`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-xs text-emerald-600 font-bold block">Collected Amount</span>
              <span className="text-2xl font-bold text-emerald-900">{d.feeCollection.collected}</span>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <span className="text-xs text-blue-600 font-bold block">Target Expected</span>
              <span className="text-2xl font-bold text-blue-900">{d.feeCollection.expected}</span>
            </div>
          </div>
        </div>
      </AdminOverlapModal>

    </div>
  );
}
