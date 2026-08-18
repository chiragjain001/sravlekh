'use client';
// ─── AdminTimetable — Enterprise Timetable & Schedule Console ────────────────
// Full-width schedule matrix with interactive Week View / Day View switching.

import React, { useState, useCallback } from 'react';
import {
  Calendar, Bell, Plus, Clock, Search, Upload, ChevronDown, RefreshCw,
  AlertTriangle, Users, BookOpen, Layers, CheckCircle2, ChevronRight, MapPin,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

import { AdminOverlapModal } from '../shared/AdminOverlapModal';
import {
  useTimetableMatrix,
  useCreateSession,
  useUpdateSession,
  useDeleteSession,
  useTimetableAnalytics,
} from '@/features/timetable/hooks/useTimetable';
import { SessionDrawer }       from '@/features/timetable/components/SessionDrawer';
import { CreateSessionDialog } from '@/features/timetable/components/CreateSessionDialog';
import { DeleteSessionDialog } from '@/features/timetable/components/DeleteSessionDialog';

import type {
  ClassSessionItem,
  DayOfWeek,
  GetTimetableParams,
  CreateSessionInput,
  UpdateSessionInput,
} from '@/features/timetable/types/timetable.types';

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-bold transition-all
      ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
      {type === 'success' ? '✓' : '✗'} {msg}
    </div>
  );
}

export function AdminTimetable() {
  const [search, setSearch]             = useState('');
  const [viewMode, setViewMode]         = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay]   = useState<DayOfWeek>('Wed');

  const [batchFilter, setBatchFilter]   = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [roomFilter, setRoomFilter]     = useState('');

  // Modals & Drawers
  const [activeModal, setActiveModal]       = useState<'scheduleLog' | 'conflicts' | 'substitutions' | null>(null);
  const [selectedSession, setSelectedSession] = useState<ClassSessionItem | null>(null);
  const [createOpen, setCreateOpen]         = useState(false);
  const [editTarget, setEditTarget]         = useState<ClassSessionItem | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<ClassSessionItem | null>(null);

  const { toast, show: showToast } = useToast();

  const params: GetTimetableParams = {
    search,
    batch:   batchFilter   || undefined,
    subject: subjectFilter || undefined,
    teacher: teacherFilter || undefined,
    room:    roomFilter    || undefined,
  };

  const { data: matrixData, isLoading: matrixLoading, refetch } = useTimetableMatrix(params);
  const { data: analytics }                                     = useTimetableAnalytics();

  const createMutation = useCreateSession();
  const updateMutation = useUpdateSession();
  const deleteMutation = useDeleteSession();

  async function handleCreateSession(input: CreateSessionInput | UpdateSessionInput) {
    await createMutation.mutateAsync(input as CreateSessionInput);
    showToast('Class session scheduled successfully');
  }

  async function handleEditSession(input: CreateSessionInput | UpdateSessionInput) {
    await updateMutation.mutateAsync(input as UpdateSessionInput);
    showToast('Class session updated');
    setEditTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedSession(null);
    showToast('Session cancelled');
  }

  const allDaysHeader = matrixData?.days ?? [];
  const rows          = matrixData?.rows ?? [];

  // Filter headers for Day View vs Week View
  const visibleDaysHeader = viewMode === 'week'
    ? allDaysHeader
    : allDaysHeader.filter((d) => d.name === selectedDay);

  const teacherAvailabilityData = analytics?.teacherAvailability ?? [];
  const subjectDistributionData = analytics?.subjectDistribution ?? [];
  const roomUtilizationData     = analytics?.roomUtilization ?? [];
  const upcomingSubstitutions   = analytics?.upcomingSubstitutions ?? [];
  const todaysHighlights        = analytics?.todaysHighlights ?? { totalClasses: 82, completed: 46, remaining: 36, substitutions: 2 };
  const scheduleAlerts          = analytics?.scheduleAlerts ?? [];

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timetable &amp; Schedule Matrix</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage daily class schedules, faculty availability, and room allocations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              4
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Metric Cards (5 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Batches', value: analytics?.totalBatches ?? '48', trend: '+4%', trendUp: true, color: 'text-green-500' },
            { label: 'Total Classes / Week', value: analytics?.totalClassesPerWeek ?? '612', trend: '+8%', trendUp: true, color: 'text-green-500' },
            { label: 'Total Subjects', value: analytics?.totalSubjects ?? '36', trend: '+4%', trendUp: true, color: 'text-green-500' },
            { label: 'Free Rooms', value: analytics?.freeRoomsCount ?? '12', trend: '+3%', trendUp: true, color: 'text-blue-500' },
            { label: 'Substitutions Today', value: analytics?.substitutionsToday ?? '4', trend: '-11%', trendUp: false, color: 'text-rose-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
              <h3 className="text-xs font-medium text-gray-500">{stat.label}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                <span className={`text-[10px] font-bold ${stat.color} flex items-center`}>
                  {stat.trendUp ? '↑' : '↓'} {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Full-Width Controls Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2.5 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search batches or subjects..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {[
              { label: 'Batch', val: batchFilter, set: setBatchFilter, options: ['JEE 2025 Star', 'NEET 2025 Target', 'Foundation 11A'] },
              { label: 'Subject', val: subjectFilter, set: setSubjectFilter, options: ['Physics', 'Chemistry', 'Mathematics', 'Biology'] },
              { label: 'Teacher', val: teacherFilter, set: setTeacherFilter, options: ['Rahul Verma', 'Pooja Sharma', 'Amitabh Sen'] },
              { label: 'Room', val: roomFilter, set: setRoomFilter, options: ['B-101', 'B-102', 'A-102'] },
            ].map((f) => (
              <div key={f.label} className="relative">
                <select
                  value={f.val} onChange={(e) => f.set(e.target.value)}
                  className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none"
                >
                  <option value="">{f.label}</option>
                  {f.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}
            <div className="relative">
              <select className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none">
                <option>19 May - 25 May 2025</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-gray-500" /> Export
            </button>
            <button
              onClick={() => { setEditTarget(null); setCreateOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Create Timetable
            </button>
          </div>
        </div>

        {/* ── FULL WIDTH TIMETABLE MATRIX CARD ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">
                  {viewMode === 'week' ? 'Weekly Class Schedule (Time / Batch Matrix)' : `Daily Schedule — ${selectedDay} (21 May)`}
                </h2>
                <p className="text-[11px] text-gray-500">Live timetable grid mapping daily time slots to batch cohorts and assigned classrooms</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Interactive View Toggle */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200/60">
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'week'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/50'
                  }`}
                >
                  Week View
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    viewMode === 'day'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-slate-200/50'
                  }`}
                >
                  Day View
                </button>
              </div>

              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                19 May - 25 May 2025
              </span>
            </div>
          </div>

          {/* Day Selector Pills (Active when viewMode === 'day') */}
          {viewMode === 'day' && (
            <div className="px-6 py-2.5 bg-blue-50/40 border-b border-blue-100 flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-bold text-blue-800 mr-2">Select Day:</span>
              {allDaysHeader.map((d) => (
                <button
                  key={d.name}
                  onClick={() => setSelectedDay(d.name)}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                    selectedDay === d.name
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {d.name} ({d.day})
                </button>
              ))}
            </div>
          )}

          <div className="overflow-x-auto w-full">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-600">
                  <th className="py-3.5 px-4 border-r border-gray-100 w-44 text-left font-bold text-gray-800">Time / Batch</th>
                  {visibleDaysHeader.map((d, idx) => (
                    <th
                      key={idx}
                      className={`py-3 px-3 border-r border-gray-100 last:border-r-0 ${
                        d.name === selectedDay || d.active ? 'bg-blue-600 text-white font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="text-[10px] opacity-80 uppercase font-semibold">{d.day}</div>
                      <div className="text-xs">{d.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {rows.map((row, i) => {
                  const dayCellsMap: Record<DayOfWeek, ClassSessionItem | null> = {
                    Mon: row.mon, Tue: row.tue, Wed: row.wed, Thu: row.thu,
                    Fri: row.fri, Sat: row.sat, Sun: row.sun,
                  };

                  const activeCells = viewMode === 'week'
                    ? [row.mon, row.tue, row.wed, row.thu, row.fri, row.sat, row.sun]
                    : [dayCellsMap[selectedDay]];

                  return (
                    <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-4 px-4 border-r border-gray-100 font-bold text-gray-900 text-left whitespace-nowrap text-[11.5px] bg-gray-50/30">
                        {row.time}
                      </td>
                      {activeCells.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 border-r border-gray-100 last:border-r-0 align-top min-w-[140px] h-20">
                          {cell ? (
                            <div
                              onClick={() => setSelectedSession(cell)}
                              className={`p-2.5 rounded-xl border text-left ${cell.color} space-y-1 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer`}
                            >
                              <div className="font-bold text-xs">{cell.subject}</div>
                              <div className="text-[10.5px] font-medium opacity-90">{cell.batch}</div>
                              <div className="text-[9.5px] font-bold opacity-75 flex items-center justify-between">
                                <span>Room {cell.room}</span>
                                <span className="text-[8.5px] uppercase font-extrabold px-1 rounded bg-white/50">
                                  {cell.status.replace('_', ' ')}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="h-full flex items-center justify-center text-gray-300 text-[11px] font-medium">
                              —
                            </div>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECONDARY ANALYTICS & OPERATIONAL WIDGETS ── */}
        <div className="space-y-6 pt-2">

          {/* Row 1: Teacher Availability & Subject Distribution (2 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 1. Teacher Availability Bar Chart */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" /> Teacher Availability Rates
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Average faculty presence percentage across weekdays</p>
                  </div>
                  <button
                    onClick={() => setActiveModal('substitutions')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Manage Substitutions →
                  </button>
                </div>
                <div className="h-48 w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teacherAvailabilityData} margin={{ top: 15, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 2. Subject Class Distribution Donut Chart */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Weekly Subject Class Distribution</h3>
                <p className="text-[11px] text-gray-400 mb-4">Total weekly sessions allocated across departments</p>
                <div className="flex items-center gap-6 my-auto">
                  <div className="w-36 h-36 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subjectDistributionData}
                          innerRadius={42} outerRadius={62} paddingAngle={2} dataKey="value" stroke="none"
                        >
                          {subjectDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-bold text-gray-900">612</span>
                      <span className="text-[9px] text-gray-400">Total Classes</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {subjectDistributionData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50/70 p-2 rounded border border-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-700 font-semibold">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value} <span className="text-gray-400 font-normal">({item.percent})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: Operational Highlights, Room Utilization & Timetable Alerts (3 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 1. Today's Highlights */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-4">Today's Operational Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] text-gray-500 font-semibold uppercase">Total Classes</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">{todaysHighlights.totalClasses}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <div className="text-[10px] text-emerald-600 font-semibold uppercase">Completed</div>
                    <div className="text-xl font-bold text-emerald-900 mt-1">{todaysHighlights.completed}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                    <div className="text-[10px] text-blue-600 font-semibold uppercase">Remaining</div>
                    <div className="text-xl font-bold text-blue-900 mt-1">{todaysHighlights.remaining}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                    <div className="text-[10px] text-rose-600 font-semibold uppercase">Substitutions</div>
                    <div className="text-xl font-bold text-rose-900 mt-1">{todaysHighlights.substitutions}</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setActiveModal('scheduleLog')}
                className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                View Daily Schedule Log →
              </button>
            </div>

            {/* 2. Room Utilization */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Classroom Room Utilization</h3>
                <p className="text-[11px] text-gray-400 mb-4">Space &amp; Hall Allocation Efficiency</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roomUtilizationData}
                          innerRadius={36} outerRadius={54} paddingAngle={2} dataKey="value" stroke="none"
                        >
                          {roomUtilizationData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-bold text-blue-600">78%</span>
                      <span className="text-[9px] text-gray-400">Utilized</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {roomUtilizationData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50/70 p-2 rounded border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-700 font-semibold">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Upcoming Substitutions & Timetable Alerts */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Upcoming Substitutions</h3>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">Staff Queue</span>
                </div>
                <div className="space-y-2.5">
                  {upcomingSubstitutions.map((sub) => (
                    <div key={sub.id} className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-50/60 border border-slate-100 text-xs">
                      <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 truncate">{sub.subject} by {sub.teacherName}</p>
                        <p className="text-[10px] text-slate-400">{sub.time} • {sub.batch}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setActiveModal('substitutions')}
                className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer"
              >
                Resolve Schedule Conflicts →
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Drawer */}
      <SessionDrawer
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
        onEdit={(s) => { setEditTarget(s); setCreateOpen(true); setSelectedSession(null); }}
      />

      {/* Create / Edit Dialog */}
      <CreateSessionDialog
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        editTarget={editTarget}
        onSubmit={editTarget ? handleEditSession : handleCreateSession}
      />

      {/* Delete Dialog */}
      <DeleteSessionDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        session={deleteTarget}
        loading={deleteMutation.isPending}
      />

      {/* ── OVERLAP MODAL CARDS ── */}

      {/* 1. Daily Schedule Log Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'scheduleLog'}
        onClose={() => setActiveModal(null)}
        title="Full Daily Class Schedule Log"
        subtitle="Complete log of all 82 periods scheduled across all batches today"
        icon={Clock}
        badgeText="Today, 23 May 2025"
      >
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Time Slot</th>
                  <th className="p-3">Batch</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3">Faculty</th>
                  <th className="p-3">Room / Venue</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { time: '08:00 - 09:00 AM', batch: 'JEE 2025 Star',    subject: 'Physics - Mechanics', teacher: 'Rahul Verma',    room: 'B-101', status: 'Completed' },
                  { time: '09:00 - 10:00 AM', batch: 'NEET 2025 Target', subject: 'Organic Chemistry',  teacher: 'Pooja Sharma',   room: 'A-102', status: 'In Progress' },
                  { time: '10:15 - 11:15 AM', batch: 'Foundation 11A',  subject: 'Chemistry',          teacher: 'Pooja Sharma',   room: 'B-102', status: 'Scheduled' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/20">
                    <td className="p-3 font-bold text-slate-900">{row.time}</td>
                    <td className="p-3 font-semibold text-blue-600">{row.batch}</td>
                    <td className="p-3 text-slate-800">{row.subject}</td>
                    <td className="p-3 font-medium text-slate-700">{row.teacher}</td>
                    <td className="p-3 text-slate-600">{row.room}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold ${
                        row.status === 'Completed' ? 'bg-emerald-50 text-emerald-600' :
                        row.status === 'In Progress' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminOverlapModal>

      {/* 2. Resolve Schedule Conflicts Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'conflicts'}
        onClose={() => setActiveModal(null)}
        title="Schedule Conflict Resolution Console"
        subtitle="Detect and auto-resolve room double-bookings and faculty overlapping periods"
        icon={AlertTriangle}
        badgeText={`${scheduleAlerts.length} Active Conflicts`}
        badgeColor="bg-rose-50 text-rose-600 border-rose-100"
      >
        <div className="space-y-4">
          {scheduleAlerts.map((alt) => (
            <div key={alt.id} className="p-4 rounded-xl bg-white border border-rose-100 shadow-2xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                  {alt.type}
                </span>
                <button className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700">
                  Auto-Reassign Room
                </button>
              </div>
              <h4 className="text-sm font-bold text-slate-900">{alt.title}</h4>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 3. Manage Substitutions Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'substitutions'}
        onClose={() => setActiveModal(null)}
        title="Faculty Substitution Allocation"
        subtitle="Assign available teachers to periods affected by staff leave"
        icon={Users}
        badgeText="2 Pending Substitutes"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-slate-900">Dr. Ramesh Kumar (Physics) - On Leave Today</h4>
              <p className="text-[11px] text-slate-500">Period 3 (11:15 AM) • JEE 2025 Star Batch in B-101</p>
            </div>
            <button
              onClick={() => { showToast('Substitute assigned'); setActiveModal(null); }}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              Assign Amitabh Sen
            </button>
          </div>
        </div>
      </AdminOverlapModal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
