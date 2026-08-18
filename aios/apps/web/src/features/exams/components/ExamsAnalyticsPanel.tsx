'use client';
// ─── Exams Analytics Panel Component ──────────────────────────────────────────

import React from 'react';
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Award, TrendingUp, AlertTriangle, ArrowUpRight, CheckCircle2, Clock } from 'lucide-react';
import { useExamsAnalytics } from '../hooks/useExams';

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 bg-slate-100 rounded-2xl" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    </div>
  );
}

interface ExamsAnalyticsPanelProps {
  onOpenPassRateReport?: () => void;
  onOpenMeritList?:      () => void;
  onOpenAlerts?:         () => void;
}

export function ExamsAnalyticsPanel({
  onOpenPassRateReport, onOpenMeritList, onOpenAlerts,
}: ExamsAnalyticsPanelProps) {
  const { data: analytics, isLoading } = useExamsAnalytics();

  if (isLoading) return <AnalyticsSkeleton />;

  const passPercentageTrend = analytics?.passPercentageTrend ?? [
    { month: 'Jan', passRate: 62 },
    { month: 'Feb', passRate: 65 },
    { month: 'Mar', passRate: 70 },
    { month: 'Apr', passRate: 74 },
    { month: 'May', passRate: 78 },
  ];

  const topPerformers = analytics?.topPerformers ?? [
    { rank: 1, name: 'Arjun Mehta',   score: '92.6%', avatar: 'AM' },
    { rank: 2, name: 'Riya Sharma',   score: '91.2%', avatar: 'RS' },
    { rank: 3, name: 'Karan Singh',   score: '89.8%', avatar: 'KS' },
    { rank: 4, name: 'Vanshita Jain', score: '88.4%', avatar: 'VJ' },
    { rank: 5, name: 'Devarsh Patel', score: '87.9%', avatar: 'DP' },
  ];

  const examOverviewData = analytics?.examOverview ?? [
    { name: 'Mock Test',   value: 18, color: '#3b82f6', percent: '40%' },
    { name: 'Part Test',   value: 12, color: '#10b981', percent: '27%' },
    { name: 'Subjective',  value: 8,  color: '#8b5cf6', percent: '18%' },
    { name: 'Weekly Test', value: 5,  color: '#f59e0b', percent: '11%' },
    { name: 'DPP Test',    value: 2,  color: '#ef4444', percent: '4%' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Pass Percentage Trend */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> Pass Percentage Trend
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Historical average pass rates across all cohorts</p>
              </div>
              {onOpenPassRateReport && (
                <button
                  onClick={onOpenPassRateReport}
                  className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                >
                  View Report <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="h-48 w-full -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={passPercentageTrend} margin={{ top: 10, right: 20, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[50, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="passRate" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Award className="w-4 h-4 text-emerald-500" /> Top Performing Students
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Rankings based on recent full-length tests</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                Leaderboard
              </span>
            </div>
            <div className="space-y-2.5">
              {topPerformers.map((student) => (
                <div key={student.rank} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full font-bold text-xs flex items-center justify-center text-white bg-amber-400">
                      {student.rank}
                    </span>
                    <span className="text-xs font-semibold text-gray-900">{student.name}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{student.score}</span>
                </div>
              ))}
            </div>
          </div>
          {onOpenMeritList && (
            <button
              onClick={onOpenMeritList}
              className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer"
            >
              View Full Student Merit List →
            </button>
          )}
        </div>

      </div>

      {/* Operational Alerts Card */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Exam Operational Alerts</h3>
          {onOpenAlerts && (
            <button onClick={onOpenAlerts} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              View All Operational Alerts →
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-800 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="font-semibold">18 evaluations pending grade publish</span>
          </div>
        </div>
      </div>
    </div>
  );
}
