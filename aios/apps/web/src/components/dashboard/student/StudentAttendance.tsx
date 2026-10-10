'use client';

import React, { useState } from 'react';
import {
  CalendarDays, CheckCircle2, XCircle, Clock, ShieldAlert,
  BarChart2, BookOpen, Layers, Filter, RefreshCw,
} from 'lucide-react';
import { useStudentAttendance } from '@/hooks/useApi';
import { AppleDropdown } from '@/components/ui/AppleDropdown';

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; pill: string }> = {
  PRESENT: { label: 'Present', icon: CheckCircle2, pill: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ABSENT:  { label: 'Absent',  icon: XCircle,      pill: 'bg-rose-50 text-rose-700 border-rose-200' },
  LATE:    { label: 'Late',    icon: Clock,        pill: 'bg-amber-50 text-amber-700 border-amber-200' },
  EXCUSED: { label: 'Excused', icon: ShieldAlert,  pill: 'bg-sky-50 text-sky-700 border-sky-200' },
};

export function StudentAttendance() {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useStudentAttendance({
    subjectId: selectedSubjectId,
    page,
    limit: 25,
  });

  const overall = data?.overall ?? { percentage: null, attended: 0, total: 0, breakdown: { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 } };
  const subjects = data?.subjects ?? [];
  const history = data?.history ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 25, totalPages: 1 };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fadein">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">My Attendance</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Official published attendance records for your enrolled classes.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Percentage Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Overall Attendance</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-extrabold text-slate-900">
                {overall.percentage !== null ? `${overall.percentage}%` : '—'}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ({overall.attended} / {overall.total} sessions)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              {overall.percentage !== null && overall.percentage >= 75
                ? '✅ Excellent attendance rate'
                : overall.percentage !== null
                ? '⚠️ Below recommended 75% threshold'
                : 'No evaluated sessions yet'}
            </p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <BarChart2 className="w-7 h-7" />
          </div>
        </div>

        {/* Status Breakdown Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm md:col-span-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Attendance Breakdown</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[10px] font-bold text-emerald-700 uppercase">Present</span>
              <p className="text-xl font-extrabold text-emerald-800 mt-0.5">{overall.breakdown?.PRESENT ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
              <span className="text-[10px] font-bold text-rose-700 uppercase">Absent</span>
              <p className="text-xl font-extrabold text-rose-800 mt-0.5">{overall.breakdown?.ABSENT ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
              <span className="text-[10px] font-bold text-amber-700 uppercase">Late</span>
              <p className="text-xl font-extrabold text-amber-800 mt-0.5">{overall.breakdown?.LATE ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100">
              <span className="text-[10px] font-bold text-sky-700 uppercase">Excused</span>
              <p className="text-xl font-extrabold text-sky-800 mt-0.5">{overall.breakdown?.EXCUSED ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Subject-Wise Performance Cards */}
      {subjects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">Subject Breakdown</h2>
            {selectedSubjectId && (
              <button
                onClick={() => setSelectedSubjectId(undefined)}
                className="text-xs text-indigo-600 font-semibold hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {subjects.map((sub: any) => {
              const isSelected = selectedSubjectId === sub.subjectId;
              return (
                <div
                  key={sub.subjectId ?? 'gen'}
                  onClick={() => setSelectedSubjectId(isSelected ? undefined : sub.subjectId)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50/30 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 truncate">{sub.subjectName}</span>
                    <span className="text-xs font-extrabold text-slate-900">
                      {sub.percentage !== null ? `${sub.percentage}%` : '—'}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        sub.percentage !== null && sub.percentage >= 75
                          ? 'bg-emerald-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(sub.percentage ?? 0, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium">
                    {sub.attended} / {sub.total} attended
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History Log */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden space-y-4">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Attendance Log</h2>
            <p className="text-[11px] text-slate-500">Official chronological record of your classes</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {subjects.length > 0 && (
              <div className="w-full sm:w-60">
                <AppleDropdown
                  value={selectedSubjectId || ''}
                  onChange={(val) => {
                    setSelectedSubjectId(val ? val : undefined);
                    setPage(1);
                  }}
                  options={[
                    { value: '', label: 'All Subjects' },
                    ...subjects.map((sub: any) => ({
                      value: sub.subjectId ?? '',
                      label: `${sub.subjectName} (${sub.percentage !== null ? `${sub.percentage}%` : '—'})`,
                    })),
                  ]}
                  placeholder="All Subjects"
                  size="sm"
                  align="right"
                />
              </div>
            )}
            <span className="text-xs text-slate-400 font-medium shrink-0 hidden sm:inline">
              {meta.total} records
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            No finalized attendance records found for this period.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((record: any, idx: number) => {
              const statusCfg = STATUS_MAP[record.status] ?? STATUS_MAP['PRESENT']!;
              const Icon = statusCfg.icon;

              return (
                <div key={record.recordId ?? record.id ?? `rec-${idx}`} className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-xs flex-shrink-0">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {record.subjectName}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {record.date} {record.startTime ? `· ${new Date(record.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''} · {record.batchName}
                      </p>
                    </div>
                  </div>

                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusCfg.pill}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{statusCfg.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination if multiple pages */}
        {meta.totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Previous
            </button>
            <span>Page {page} of {meta.totalPages}</span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
