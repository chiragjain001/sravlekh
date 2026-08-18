'use client';
// ─── Timetable Analytics Panel Component ──────────────────────────────────────

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { Users, AlertTriangle } from 'lucide-react';
import { useTimetableAnalytics } from '../hooks/useTimetable';

interface TimetableAnalyticsPanelProps {
  onOpenSubstitutions?: () => void;
  onOpenConflicts?:     () => void;
}

export function TimetableAnalyticsPanel({
  onOpenSubstitutions, onOpenConflicts,
}: TimetableAnalyticsPanelProps) {
  const { data: analytics, isLoading } = useTimetableAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 animate-pulse">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const teacherAvailabilityData = analytics?.teacherAvailability ?? [];
  const subjectDistributionData = analytics?.subjectDistribution ?? [];
  const roomUtilizationData     = analytics?.roomUtilization ?? [];
  const alerts                   = analytics?.scheduleAlerts ?? [];

  return (
    <div className="space-y-6 pt-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Teacher Availability Rate */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <h3 className="text-sm font-bold text-gray-900 mb-3">Teacher Availability Rates</h3>
          <div className="h-44 w-full -ml-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teacherAvailabilityData}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Schedule Alerts */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Schedule Conflicts &amp; Alerts</h3>
              {onOpenConflicts && (
                <button onClick={onOpenConflicts} className="text-xs font-bold text-rose-600 hover:underline cursor-pointer">
                  Resolve Conflicts →
                </button>
              )}
            </div>
            <div className="space-y-2.5">
              {alerts.map((alt) => (
                <div key={alt.id} className="p-3 rounded-xl bg-rose-50/50 border border-rose-100 flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{alt.title}</h4>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
