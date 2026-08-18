'use client';
// ─── Audit Analytics Panel Component ─────────────────────────────────────────

import React from 'react';
import {
  FileText, Activity, Users, AlertTriangle, ShieldAlert, CheckCircle2, Lock,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { useAuditLogAnalytics } from '../hooks/useAuditLogs';

interface AuditAnalyticsPanelProps {
  onOpenSecurityLog: () => void;
}

export function AuditAnalyticsPanel({ onOpenSecurityLog }: AuditAnalyticsPanelProps) {
  const { data: analytics, isLoading } = useAuditLogAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 animate-pulse">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const activityBreakdownData = analytics?.activityBreakdown ?? [];
  const moduleActivityData    = analytics?.moduleActivity ?? [];
  const activeOperators       = analytics?.activeOperatorsList ?? [];

  return (
    <div className="space-y-6">
      {/* Row 1: Operational Summary & Activity Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Audit Metric Overview</h3>
            <p className="text-[11px] text-gray-400 mb-4">Summary of activity logs and user interactions</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50/60 rounded-xl p-3.5 border border-blue-100 space-y-1">
                <div className="flex items-center justify-between">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">All Time</span>
                </div>
                <span className="text-[11px] font-bold text-gray-500 block">Total Activities</span>
                <span className="text-2xl font-bold text-gray-900 block">{(analytics?.totalActivities ?? 2486).toLocaleString()}</span>
              </div>

              <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-100 space-y-1">
                <div className="flex items-center justify-between">
                  <Activity className="w-4 h-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">Today</span>
                </div>
                <span className="text-[11px] font-bold text-gray-500 block">Today's Activities</span>
                <span className="text-2xl font-bold text-gray-900 block">{analytics?.todaysActivities ?? 156}</span>
              </div>

              <div className="bg-indigo-50/60 rounded-xl p-3.5 border border-indigo-100 space-y-1">
                <div className="flex items-center justify-between">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">Online</span>
                </div>
                <span className="text-[11px] font-bold text-gray-500 block">Active Operators</span>
                <span className="text-2xl font-bold text-gray-900 block">{analytics?.activeOperators ?? 18}</span>
              </div>

              <div className="bg-rose-50/60 rounded-xl p-3.5 border border-rose-100 space-y-1">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded">Security</span>
                </div>
                <span className="text-[11px] font-bold text-gray-500 block">Failed Access</span>
                <span className="text-2xl font-bold text-rose-600 block">{analytics?.failedAccess ?? 12}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Action Type Distribution</h3>
            <p className="text-[11px] text-gray-400 mb-4">Breakdown of system events by action type</p>
            <div className="flex items-center gap-6 my-auto">
              <div className="w-36 h-36 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activityBreakdownData}
                      innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none"
                    >
                      {activityBreakdownData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-sm font-bold text-gray-900">2.4k</span>
                  <span className="text-[9px] text-gray-400">Events</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {activityBreakdownData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50/70 p-2 rounded border border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700 font-semibold">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-900">{item.percent}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Row 2: Top Operators, Module Activity Volume & Security Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">Most Active Operators</h3>
            <div className="space-y-2.5">
              {activeOperators.map((op, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-6 h-6 rounded-full ${op.bg} text-white font-bold text-[9px] flex items-center justify-center`}>
                      {op.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900 leading-tight">{op.name}</p>
                      <p className="text-[10px] text-gray-400 font-medium">{op.role}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">{op.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-4">Module Activity Volume</h3>
            <div className="h-44 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={moduleActivityData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900">Security &amp; Audit Alerts</h3>
              <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Monitored</span>
            </div>
            <div className="space-y-2.5">
              <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-800 text-xs flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="font-semibold">12 failed login attempts detected</span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-800 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="font-semibold">Automated DB backup completed at 08:15 AM</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100 text-rose-800 text-xs flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span className="font-semibold">Role permission modified for 2 users</span>
              </div>
            </div>
          </div>
          <button
            onClick={onOpenSecurityLog}
            className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer"
          >
            View Full Security Log →
          </button>
        </div>

      </div>
    </div>
  );
}
