'use client';

import { useState } from 'react';
import { Plus, Search, Download, Calendar, Copy, LayoutGrid, ChevronDown, Bell, SlidersHorizontal, Layers, Award, AlertTriangle, CalendarDays, TrendingUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// --- Mock Data ---
const batchesData = [
  {
    id: 1, name: 'JEE 2025 Star Batch', program: 'JEE', year: '2025',
    students: '24/40', mentor: 'Rahul Verma', attendance: '92%', avgScore: '84%',
    progress: 72, nextTest: 'JEE Main Mock 08', nextTestDate: '24 May 2025'
  },
  {
    id: 2, name: 'NEET 2025 Target Batch', program: 'NEET', year: '2025',
    students: '35/40', mentor: 'Pooja Sharma', attendance: '88%', avgScore: '82%',
    progress: 60, nextTest: 'NEET Unit Test 05', nextTestDate: '26 May 2025'
  },
  {
    id: 3, name: 'Foundation 11A', program: 'Class 11', year: '2024-25',
    students: '30/35', mentor: 'Amit Singh', attendance: '81%', avgScore: '70%',
    progress: 45, nextTest: 'Maths Chapter Test', nextTestDate: '27 May 2025'
  },
  {
    id: 4, name: 'JEE 2026 Early Batch', program: 'JEE', year: '2026',
    students: '28/40', mentor: 'Devendra Pal', attendance: '90%', avgScore: '79%',
    progress: 56, nextTest: 'Physics Test 03', nextTestDate: '30 May 2025'
  },
  {
    id: 5, name: 'Foundation 11B', program: 'Class 11', year: '2024-25',
    students: '25/35', mentor: 'Sunidhi Mehta', attendance: '76%', avgScore: '62%',
    progress: 38, nextTest: 'Chemistry Quiz 02', nextTestDate: '28 May 2025'
  },
  {
    id: 6, name: 'JEE Droppers 2026', program: 'JEE', year: '2026',
    students: '38/40', mentor: 'Vikram Rao', attendance: '79%', avgScore: '65%',
    progress: 42, nextTest: 'Full Length Test 01', nextTestDate: '02 Jun 2025'
  },
];

const comparisonData = [
  { name: 'JEE 2025 Star', score: 84 },
  { name: 'NEET 2025 Target', score: 82 },
  { name: 'JEE 2026 Early', score: 79 },
  { name: 'Foundation 11A', score: 70 },
  { name: 'JEE Droppers', score: 65 },
  { name: 'Foundation 11B', score: 62 },
];

const capacityData = [
  { name: 'Used Seats', value: 1300, color: '#3b82f6' },
  { name: 'Available Seats', value: 372, color: '#10b981' },
];

export function BatchesList() {
  const [search, setSearch] = useState('');

  return (
    <div className="bg-white min-h-screen text-[#1e293b] p-6 space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Batches</h1>
          <p className="text-xs text-gray-500 mt-0.5">Cohort allocation, mentor tracking, and syllabus progress</p>
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
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Batches', value: '48', trend: '+6%', trendUp: true, color: 'text-green-500' },
            { label: 'Active Cohorts', value: '42', trend: '87.5%', trendUp: true, color: 'text-green-500' },
            { label: 'Avg Batch Capacity', value: '88%', trend: '+3%', trendUp: true, color: 'text-blue-500' },
            { label: 'Upcoming Batches', value: '6', trend: 'Next 30 days', trendUp: true, color: 'text-purple-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
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
                placeholder="Search batches by name or mentor..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {['Program', 'Year', 'Branch', 'Status'].map((filter) => (
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
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Download className="w-3.5 h-3.5 text-gray-500" /> Export
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Create Batch
            </button>
          </div>
        </div>

        {/* ── ALL BATCHES SET IN ONE FULL-WIDTH CARD ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">All Active Batches & Cohorts</h2>
                <p className="text-[11px] text-gray-500">Comprehensive overview of enrolled cohorts and academic milestones</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              48 Batches Total
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Batch Name</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Program</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Target Year</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Students / Seats</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Lead Mentor</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Attendance</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Avg Score</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700 w-40">Syllabus Progress</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Next Scheduled Test</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {batchesData.map((batch) => (
                  <tr key={batch.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-gray-900 text-[12.5px] block">{batch.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full border ${
                        batch.program === 'JEE' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        batch.program === 'NEET' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        'bg-purple-50 text-purple-700 border-purple-100'
                      }`}>
                        {batch.program}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 font-medium">{batch.year}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{batch.students}</td>
                    <td className="px-5 py-3.5 text-gray-700 font-semibold">{batch.mentor}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{batch.attendance}</td>
                    <td className="px-5 py-3.5 font-bold text-emerald-600">{batch.avgScore}</td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-bold text-gray-700">
                          <span>Progress</span>
                          <span>{batch.progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${batch.progress > 70 ? 'bg-blue-600' : batch.progress > 50 ? 'bg-indigo-500' : 'bg-amber-500'}`} 
                            style={{ width: `${batch.progress}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="font-bold text-gray-900 text-[11.5px]">{batch.nextTest}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{batch.nextTestDate}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors" title="Copy ID">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors">
                          Manage
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── OTHER CARDS SET BELOW THE BATCHES CARD WITH PROPER SIZE AND SPACING ── */}
        <div className="space-y-6 pt-2">

          {/* Row 1: Batch Comparison & Capacity Utilization (2 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 1. Batch Performance Comparison */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" /> Batch Performance Comparison
                </h3>
                <p className="text-[11px] text-gray-400 mb-4">Average Test Score Across Cohorts (%)</p>

                <div className="h-48 w-full -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9.5, fill: '#64748b' }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                      <Bar dataKey="score" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={26}>
                        {comparisonData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={
                            entry.name.includes('Star') ? '#3b82f6' : 
                            entry.name.includes('Target') ? '#10b981' : 
                            entry.name.includes('Early') ? '#6366f1' : 
                            entry.name.includes('11A') ? '#8b5cf6' : '#f59e0b'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 2. Capacity Utilization */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-500" /> Institute Seat Capacity Utilization
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-4">Total Available vs Allocated Student Seats</p>
              </div>

              <div className="flex items-center gap-6 my-auto">
                <div className="w-36 h-36 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={capacityData}
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {capacityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[14px] font-bold text-gray-800">1,672</span>
                    <span className="text-[9px] text-gray-400 uppercase font-semibold">Total Seats</span>
                  </div>
                </div>

                <div className="flex-1 space-y-3">
                  {capacityData.map((item, idx) => (
                    <div key={idx} className="bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-xs text-gray-600 font-semibold">{item.name}</span>
                        </div>
                        <span className="text-xs font-bold text-gray-900">{item.value} Seats</span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-medium text-right">
                        {(item.value / 1672 * 100).toFixed(0)}% of Total Capacity
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: Top Performing, Low Performing & Upcoming Activities (3 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 1. Top Performing Batches */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-500" /> Top Performing Batches
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">Leaderboard</span>
                </div>
                <div className="space-y-3">
                  {[
                    { rank: 1, name: 'JEE 2025 Star', score: '84%', mentor: 'Rahul Verma' },
                    { rank: 2, name: 'NEET 2025 Target', score: '82%', mentor: 'Pooja Sharma' },
                    { rank: 3, name: 'JEE 2026 Early', score: '79%', mentor: 'Devendra Pal' },
                  ].map((batch) => (
                    <div key={batch.rank} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center text-white ${
                          batch.rank === 1 ? 'bg-amber-400' : batch.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'
                        }`}>{batch.rank}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{batch.name}</p>
                          <p className="text-[10px] text-gray-500">Mentor: {batch.mentor}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{batch.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View Full Ranking →
              </button>
            </div>

            {/* 2. Low Performing Batches */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" /> Needing Academic Attention
                  </h3>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">Review Required</span>
                </div>
                <div className="space-y-3">
                  {[
                    { rank: 1, name: 'Foundation 11B', score: '62%', mentor: 'Sunidhi Mehta' },
                    { rank: 2, name: 'JEE Droppers 2026', score: '65%', mentor: 'Vikram Rao' },
                  ].map((batch) => (
                    <div key={batch.rank} className="flex items-center justify-between p-3 rounded-xl border border-rose-100 bg-rose-50/30">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center">{batch.rank}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{batch.name}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">Mentor: {batch.mentor}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2.5 py-0.5 rounded-full">{batch.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                Schedule Mentor Sync →
              </button>
            </div>

            {/* 3. Upcoming Activities */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-purple-500" /> Upcoming Assessments
                  </h3>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Schedule</span>
                </div>
                <div className="space-y-3">
                  {[
                    { title: 'JEE Main Mock 08', date: '24 May 2025', color: 'bg-blue-500' },
                    { title: 'NEET Unit Test 05', date: '26 May 2025', color: 'bg-emerald-500' },
                    { title: 'Physics Test 03', date: '30 May 2025', color: 'bg-purple-500' },
                  ].map((activity, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${activity.color}`} />
                        <div>
                          <p className="text-xs font-bold text-gray-900">{activity.title}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{activity.date}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-blue-600">View</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View Full Calendar →
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
