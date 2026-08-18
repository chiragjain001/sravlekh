'use client';
// ─── Reports Analytics Panel Component ───────────────────────────────────────

import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, FileText } from 'lucide-react';
import { useReportsAnalytics } from '../hooks/useReports';
import type { ReportItem } from '../types/reports.types';

interface ReportsAnalyticsPanelProps {
  selectedCategory:  string;
  programFilter?:    string;
  batchFilter?:      string;
  downloadedReports: ReportItem[];
  onOpenReportsList: () => void;
  onOpenBatchesList: () => void;
  onOpenFinancials:  () => void;
  onSelectReport:    (report: ReportItem) => void;
}

export function ReportsAnalyticsPanel({
  selectedCategory, programFilter, batchFilter, downloadedReports, onOpenReportsList, onOpenBatchesList, onOpenFinancials, onSelectReport,
}: ReportsAnalyticsPanelProps) {
  const { data: analytics, isLoading } = useReportsAnalytics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 animate-pulse">
        <div className="h-48 bg-slate-100 rounded-xl" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const performanceTrendData = analytics?.performanceTrend ?? [];
  const attendanceSummaryData = analytics?.attendanceSummary ?? [];
  const topBatches            = analytics?.topBatches ?? [];
  const financialSummary      = analytics?.financialSummary ?? {
    totalCollected: '₹24,80,000',
    totalExpected:  '₹28,50,000',
    pendingAmount:  '₹3,70,000',
    collectionRate: 87,
  };

  // Category specific metric adjustments
  const getCategoryMetrics = () => {
    switch (selectedCategory) {
      case 'Student Reports':
        return [
          { label: 'Total Enrolled', value: '2,864', trend: '+12%', color: 'text-cyan-600' },
          { label: 'Avg Attendance', value: '92%', trend: '+4%', color: 'text-emerald-600' },
          { label: 'Retention Rate', value: '96%', trend: '+2%', color: 'text-blue-600' },
          { label: 'Active Batches', value: '48', trend: '+8%', color: 'text-purple-600' },
        ];
      case 'Financial Reports':
        return [
          { label: 'Total Revenue', value: '₹24.8L', trend: '+15%', color: 'text-emerald-600' },
          { label: 'Collection Rate', value: '87%', trend: '+7%', color: 'text-blue-600' },
          { label: 'Pending Dues', value: '₹3.7L', trend: '-5%', color: 'text-rose-600' },
          { label: 'Avg Fee / Student', value: '₹42,500', trend: '+3%', color: 'text-amber-600' },
        ];
      case 'Faculty Reports':
        return [
          { label: 'Active Faculty', value: '64', trend: '+5%', color: 'text-emerald-600' },
          { label: 'Avg Teaching Hours', value: '28h/wk', trend: '+2%', color: 'text-blue-600' },
          { label: 'Satisfaction Score', value: '4.8/5', trend: '+4%', color: 'text-amber-600' },
          { label: 'Syllabus Progress', value: '84%', trend: '+6%', color: 'text-purple-600' },
        ];
      case 'Operational Reports':
        return [
          { label: 'System Uptime', value: '99.9%', trend: '+0.1%', color: 'text-emerald-600' },
          { label: 'Dispatched Push', value: '14,250', trend: '+18%', color: 'text-blue-600' },
          { label: 'Room Utilization', value: '78%', trend: '+5%', color: 'text-purple-600' },
          { label: 'Support Tickets', value: '12 Open', trend: '-8%', color: 'text-amber-600' },
        ];
      case 'Academic Reports':
      default:
        return [
          { label: 'Avg Attendance',  value: `${analytics?.avgAttendance ?? 92}%`,  trend: '4%', color: 'text-emerald-600' },
          { label: 'Avg Performance', value: `${analytics?.avgPerformance ?? 78}%`, trend: '6%', color: 'text-blue-600' },
          { label: 'Pass Percentage', value: `${analytics?.passPercentage ?? 88}%`, trend: '5%', color: 'text-purple-600' },
          { label: 'Fee Collection',  value: `${analytics?.feeCollectionRate ?? 87}%`, trend: '7%', color: 'text-emerald-600' },
        ];
    }
  };

  const kpis = getCategoryMetrics();

  return (
    <div className="space-y-6">
      {/* Category Scope Header Banner */}
      <div className="bg-gradient-to-r from-blue-50/80 via-white to-slate-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">{selectedCategory} Dashboard</h2>
            <p className="text-[11px] text-gray-500">Filtered view displaying analytics, metrics, and downloads for {selectedCategory}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {programFilter && (
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              Program: {programFilter}
            </span>
          )}
          {batchFilter && (
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
              Batch: {batchFilter}
            </span>
          )}
          <span className="text-xs font-bold text-gray-700 bg-white px-3 py-1 rounded-lg border border-gray-200 shadow-2xs">
            {downloadedReports.length} Reports Found
          </span>
        </div>
      </div>

      {/* KPI Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-xl p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
            <span className="text-xs font-medium text-gray-500">{kpi.label}</span>
            <div className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</div>
            <div className={`text-[10.5px] font-bold ${kpi.color} flex items-center gap-1 mt-1`}>
              <TrendingUp className="w-3 h-3" /> {kpi.trend} vs last month
            </div>
          </div>
        ))}
      </div>

      {/* Middle Row: Performance Trend (8 Cols) & Category Reports List (4 Cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">

        {/* Institute Performance Trend */}
        <div className="xl:col-span-8 bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">
                {selectedCategory === 'Financial Reports' ? 'Revenue & Collection Trend' :
                 selectedCategory === 'Student Reports' ? 'Student Attendance & Enrollment Trend' :
                 selectedCategory === 'Faculty Reports' ? 'Faculty Evaluation & Workload Trend' :
                 'Institute Performance Trend'}
              </h3>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Attendance (%)
                </span>
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /> Performance (%)
                </span>
                <span className="flex items-center gap-1.5 text-purple-600">
                  <span className="w-2 h-2 rounded-full bg-purple-600 inline-block" /> Pass (%)
                </span>
              </div>
            </div>

            <div className="h-56 -ml-4 -mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceTrendData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="Attendance" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
                  <Line type="monotone" dataKey="Performance" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} />
                  <Line type="monotone" dataKey="PassPercentage" stroke="#9333ea" strokeWidth={2.5} dot={{ fill: '#9333ea', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Reports Catalog for Selected Category */}
        <div className="xl:col-span-4 bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Downloaded Reports</h3>
            <p className="text-[11px] text-gray-400 mb-3">Filtered by {selectedCategory}</p>
            <div className="space-y-2.5">
              {downloadedReports.length > 0 ? (
                downloadedReports.slice(0, 5).map((rep) => (
                  <div
                    key={rep.id}
                    onClick={() => onSelectReport(rep)}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border border-slate-50"
                  >
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600 flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate flex-1">
                      <h4 className="text-xs font-bold text-gray-900 truncate">{rep.title}</h4>
                      <div className="flex justify-between items-center text-[10px] text-gray-400 mt-0.5">
                        <span>{rep.category}</span>
                        <span className="font-semibold text-blue-600">{rep.downloadsText}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  No reports found matching your filters.
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={onOpenReportsList}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View All Reports Catalog →
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Set Cards: Attendance Overview, Top Batches & Fee Collection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* 1. Attendance Overview */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Attendance Overview</h3>
            <p className="text-[11px] text-gray-400 mb-4">Overall student attendance distribution</p>
            <div className="flex items-center gap-4">
              <div className="w-32 h-32 relative shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={attendanceSummaryData}
                      innerRadius={36} outerRadius={54} paddingAngle={2} dataKey="value" stroke="none"
                    >
                      {attendanceSummaryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-base font-bold text-gray-900 leading-tight">92%</span>
                  <span className="text-[8.5px] text-gray-400 font-medium">Overall</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {attendanceSummaryData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-slate-50/70 p-2 rounded border border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-700 font-semibold text-[11px]">{item.name}</span>
                    </div>
                    <span className="font-bold text-gray-900 text-[11px]">{item.value.toLocaleString()} <span className="text-gray-400 font-normal text-[9px]">({item.percent})</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Top Performing Batches */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Top Performing Batches</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Average academic test score ranking</p>
              </div>
              <button
                onClick={onOpenBatchesList}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                View All →
              </button>
            </div>
            <div className="space-y-3">
              {topBatches.slice(0, 4).map((batch) => (
                <div key={batch.id} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-900">{batch.name}</span>
                    <span className="font-bold text-emerald-600">{batch.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${batch.color} rounded-full`} style={{ width: `${batch.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Fee Collection Summary */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Fee Collection Summary</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">Term fee collection against expected target</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3 text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">Total Collected</span>
                <span className="text-base font-bold text-emerald-600">{financialSummary.totalCollected}</span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">Total Expected</span>
                <span className="text-base font-bold text-gray-900">{financialSummary.totalExpected}</span>
              </div>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative mb-3">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${financialSummary.collectionRate}%` }} />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="text-gray-500 font-semibold">Pending Collection Amount</span>
              <span className="font-bold text-rose-600">{financialSummary.pendingAmount}</span>
            </div>
          </div>
          <button
            onClick={onOpenFinancials}
            className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer"
          >
            View Financial Report →
          </button>
        </div>

      </div>
    </div>
  );
}
