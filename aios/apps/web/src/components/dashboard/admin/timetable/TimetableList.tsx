'use client';

import { useState } from 'react';
import { 
  Plus, Search, Download, Upload, ChevronDown, Calendar, Bell, 
  Clock, AlertTriangle, Users, Building, ChevronLeft, ChevronRight, CheckCircle2, SlidersHorizontal, Layers, CheckSquare
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';

// --- Mock Data ---
const timeSlots = [
  '08:00 - 09:30 AM',
  '09:30 - 11:00 AM',
  '11:15 - 12:45 PM',
  '01:30 - 03:00 PM',
  '03:15 - 04:45 PM',
];

const daysHeader = [
  { day: '19 May', name: 'Mon' },
  { day: '20 May', name: 'Tue' },
  { day: '21 May', name: 'Wed', active: true },
  { day: '22 May', name: 'Thu' },
  { day: '23 May', name: 'Fri' },
  { day: '24 May', name: 'Sat' },
  { day: '25 May', name: 'Sun' },
];

const timetableGrid = [
  {
    time: '08:00 - 09:30 AM',
    mon: { subject: 'Physics', batch: 'JEE 2025 Star', room: 'B-101', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    tue: { subject: 'Chemistry', batch: 'NEET 2025 Target', room: 'B-102', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    wed: { subject: 'Physics', batch: 'JEE 2025 Star', room: 'B-101', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    thu: { subject: 'Maths', batch: 'JEE 2026 Early', room: 'A-104', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    fri: { subject: 'Mathematics', batch: 'JEE 2025 Star', room: 'B-101', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    sat: { subject: 'Biology', batch: 'NEET 2025 Target', room: 'B-102', color: 'bg-purple-50 border-purple-200 text-purple-800' },
    sun: null,
  },
  {
    time: '09:30 - 11:00 AM',
    mon: { subject: 'Chemistry', batch: 'NEET 2025 Target', room: 'B-102', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    tue: { subject: 'Physics', batch: 'JEE 2025 Star', room: 'B-101', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    wed: { subject: 'Physics', batch: 'Foundation 11A', room: 'A-102', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    thu: { subject: 'Chemistry', batch: 'NEET 2025 Target', room: 'B-102', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    fri: { subject: 'Chemistry', batch: 'Foundation 11A', room: 'A-102', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    sat: { subject: 'Maths', batch: 'JEE 2026 Early', room: 'A-104', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    sun: null,
  },
  {
    time: '11:15 - 12:45 PM',
    mon: { subject: 'Biology', batch: 'NEET 2025 Target', room: 'B-103', color: 'bg-purple-50 border-purple-200 text-purple-800' },
    tue: { subject: 'Maths', batch: 'JEE 2026 Early', room: 'A-104', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    wed: { subject: 'Chemistry', batch: 'Foundation 11A', room: 'B-104', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    thu: { subject: 'Physics', batch: 'Foundation 11B', room: 'B-104', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    fri: { subject: 'Chemistry', batch: 'Foundation 11B', room: 'B-104', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    sat: { subject: 'Physics', batch: 'JEE 2025 Star', room: 'B-101', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    sun: null,
  },
  {
    time: '01:30 - 03:00 PM',
    mon: { subject: 'Biology', batch: 'NEET 2025 Target', room: 'B-103', color: 'bg-purple-50 border-purple-200 text-purple-800' },
    tue: { subject: 'Physics', batch: 'Foundation 11B', room: 'B-104', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    wed: { subject: 'English', batch: 'Foundation 11A', room: 'B-105', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    thu: { subject: 'Chemistry', batch: 'Foundation 11A', room: 'A-102', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    fri: { subject: 'Physics', batch: 'Foundation 11B', room: 'B-104', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    sat: { subject: 'English', batch: 'Foundation 11B', room: 'B-105', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    sun: null,
  },
  {
    time: '03:15 - 04:45 PM',
    mon: { subject: 'Physical Educ.', batch: 'Foundation 11B', room: 'B-106', color: 'bg-rose-50 border-rose-200 text-rose-800' },
    tue: { subject: 'English', batch: 'Foundation 11A', room: 'B-105', color: 'bg-amber-50 border-amber-200 text-amber-800' },
    wed: { subject: 'Maths', batch: 'Foundation 11B', room: 'B-105', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    thu: { subject: 'Physical Educ.', batch: 'Foundation 11B', room: 'Ground', color: 'bg-rose-50 border-rose-200 text-rose-800' },
    fri: { subject: 'Physical Educ.', batch: 'Foundation 11B', room: 'Ground', color: 'bg-rose-50 border-rose-200 text-rose-800' },
    sat: { subject: 'Maths', batch: 'Foundation 11B', room: 'B-105', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    sun: null,
  },
];

const teacherAvailabilityData = [
  { day: 'Mon', available: 92 },
  { day: 'Tue', available: 80 },
  { day: 'Wed', available: 95 },
  { day: 'Thu', available: 82 },
  { day: 'Fri', available: 90 },
  { day: 'Sat', available: 75 },
];

const subjectDistributionData = [
  { name: 'Physics', value: 164, color: '#3b82f6', percent: '27%' },
  { name: 'Chemistry', value: 148, color: '#10b981', percent: '24%' },
  { name: 'Mathematics', value: 132, color: '#6366f1', percent: '21%' },
  { name: 'Biology', value: 96, color: '#a855f7', percent: '16%' },
  { name: 'Others', value: 72, color: '#f59e0b', percent: '12%' },
];

const roomUtilizationData = [
  { name: 'Utilized', value: 78, color: '#3b82f6' },
  { name: 'Free', value: 12, color: '#10b981' },
  { name: 'Maintenance', value: 10, color: '#ef4444' },
];

export function TimetableList() {
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  return (
    <div className="bg-white min-h-screen text-[#1e293b] p-6 space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timetable & Schedule</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage class schedules, classroom allocations, and faculty assignments</p>
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
            { label: 'Total Classes', value: '48', trend: '+4%', trendUp: true, color: 'text-green-500' },
            { label: 'Total Classes / Week', value: '612', trend: '+8%', trendUp: true, color: 'text-green-500' },
            { label: 'Total Subjects', value: '36', trend: '+4%', trendUp: true, color: 'text-green-500' },
            { label: 'Free Rooms', value: '12', trend: '+3%', trendUp: true, color: 'text-blue-500' },
            { label: 'Substitutions Today', value: '4', trend: '-11%', trendUp: false, color: 'text-rose-500' },
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
          {/* Left Controls: Search + Dropdowns */}
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
            {['Batch', 'Subject', 'Teacher', 'Room', '19 May - 25 May 2025'].map((filter) => (
              <div key={filter} className="relative">
                <select className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none">
                  <option value="">{filter}</option>
                  <option value="1">Option 1</option>
                  <option value="2">Option 2</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}
          </div>
          
          {/* Right Controls: View Mode Toggle, Export, Create Timetable */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-0.5 bg-gray-100 rounded-lg border border-gray-200 text-xs">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                  viewMode === 'week' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week View
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                  viewMode === 'day' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Day View
              </button>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-gray-500" /> Export
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Create Timetable
            </button>
          </div>
        </div>

        {/* ── TIME / BATCH MATRIX SET TO FULL WIDTH CARD ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Weekly Class Schedule (Time / Batch Matrix)</h2>
                <p className="text-[11px] text-gray-500">Live timetable grid mapping daily time slots to batch cohorts and assigned classrooms</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              19 May - 25 May 2025
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-600">
                  <th className="py-3.5 px-4 border-r border-gray-100 w-44 text-left font-bold text-gray-800">Time / Batch</th>
                  {daysHeader.map((d, idx) => (
                    <th 
                      key={idx} 
                      className={`py-3 px-3 border-r border-gray-100 last:border-r-0 ${
                        d.active ? 'bg-blue-600 text-white font-bold' : 'text-gray-700'
                      }`}
                    >
                      <div className="text-[10px] opacity-80 uppercase font-semibold">{d.name}</div>
                      <div className="text-xs">{d.day}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {timetableGrid.map((row, i) => (
                  <tr key={i} className="hover:bg-blue-50/20 transition-colors">
                    <td className="py-4 px-4 border-r border-gray-100 font-bold text-gray-900 text-left whitespace-nowrap text-[11.5px] bg-gray-50/30">
                      {row.time}
                    </td>
                    {[row.mon, row.tue, row.wed, row.thu, row.fri, row.sat, row.sun].map((cell, cIdx) => (
                      <td key={cIdx} className="p-2 border-r border-gray-100 last:border-r-0 align-top min-w-[130px] h-20">
                        {cell ? (
                          <div className={`p-2.5 rounded-xl border text-left ${cell.color} space-y-1 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer`}>
                            <div className="font-bold text-xs">{cell.subject}</div>
                            <div className="text-[10.5px] font-medium opacity-90">{cell.batch}</div>
                            <div className="text-[9.5px] font-bold opacity-75 flex items-center justify-between">
                              <span>Room {cell.room}</span>
                              <span className="text-[8.5px] uppercase font-extrabold px-1 rounded bg-white/50">Active</span>
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
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── OTHER CARDS SET BELOW THE TIME / BATCH CARD WITH PROPER SPACING ── */}
        <div className="space-y-6 pt-2">

          {/* Row 1: Teacher Availability & Subject Distribution (2 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 1. Teacher Availability Chart */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-500" /> Faculty Availability Rates
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Average teacher availability percentage by weekday</p>
                  </div>
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">Weekly Stats</span>
                </div>
                <div className="h-48 w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teacherAvailabilityData} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="available" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 2. Subject Distribution Donut Chart */}
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
                          innerRadius={42}
                          outerRadius={62}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
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
                    <div className="text-xl font-bold text-gray-900 mt-1">82</div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <div className="text-[10px] text-emerald-600 font-semibold uppercase">Completed</div>
                    <div className="text-xl font-bold text-emerald-900 mt-1">48</div>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                    <div className="text-[10px] text-blue-600 font-semibold uppercase">Remaining</div>
                    <div className="text-xl font-bold text-blue-900 mt-1">30</div>
                  </div>
                  <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                    <div className="text-[10px] text-rose-600 font-semibold uppercase">Substitutions</div>
                    <div className="text-xl font-bold text-rose-900 mt-1">4</div>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View Daily Schedule Log →
              </button>
            </div>

            {/* 2. Room Utilization */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Classroom Room Utilization</h3>
                <p className="text-[11px] text-gray-400 mb-4">Space & Hall Allocation Efficiency</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={roomUtilizationData}
                          innerRadius={36}
                          outerRadius={54}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
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

            {/* 3. Timetable Operational Alerts */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Schedule Alerts & Swaps</h3>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Action Required</span>
                </div>
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100 text-rose-800 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span className="font-semibold">4 rooms double-booked in Afternoon slot</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-800 text-xs flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="font-semibold">2 classes unassigned due to teacher leave</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-800 text-xs flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold">3 batches missing break gap</span>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                Resolve Schedule Conflicts →
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
