'use client';

import { useState } from 'react';
import { 
  Plus, Search, Download, Upload, ChevronDown, Calendar, Bell, 
  AlertTriangle, CheckCircle2, Clock, FileText, Users, Award, SlidersHorizontal, ArrowUpRight, Copy, Layers, TrendingUp
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// --- Mock Data ---
const examList = [
  { id: 1, name: 'JEE Main Mock Test 08', code: 'JEE-M08', batch: 'JEE 2025 Star', type: 'Mock Test', date: '26 May 2025', duration: '3 Hrs', students: 126, status: 'Upcoming' },
  { id: 2, name: 'NEET Part Test 05', code: 'NEET-PT05', batch: 'NEET 2025 Target', type: 'Part Test', date: '28 May 2025', duration: '3 Hrs', students: 98, status: 'Upcoming' },
  { id: 3, name: 'Class 11 Physics Test', code: 'PHY-11T02', batch: 'Foundation 11A', type: 'Subjective', date: '30 May 2025', duration: '2 Hrs', students: 54, status: 'Upcoming' },
  { id: 4, name: 'Chemistry Weekly Test', code: 'CHEM-W06', batch: 'JEE 2026 Early', type: 'Weekly Test', date: '31 May 2025', duration: '1.5 Hrs', students: 112, status: 'Upcoming' },
  { id: 5, name: 'Maths DPP Test 12', code: 'MATH-D12', batch: 'Foundation 11B', type: 'DPP Test', date: '01 Jun 2025', duration: '1 Hr', students: 61, status: 'Upcoming' },
  { id: 6, name: 'JEE Droppers Full Length Test 01', code: 'JEE-FLT01', batch: 'JEE Droppers 2026', type: 'Mock Test', date: '02 Jun 2025', duration: '3 Hrs', students: 140, status: 'Upcoming' },
];

const passPercentageTrend = [
  { month: 'Jan', passRate: 62 },
  { month: 'Feb', passRate: 65 },
  { month: 'Mar', passRate: 70 },
  { month: 'Apr', passRate: 74 },
  { month: 'May', passRate: 78 },
];

const topPerformers = [
  { rank: 1, name: 'Arjun Mehta', score: '92.6%', avatar: 'AM' },
  { rank: 2, name: 'Riya Sharma', score: '91.2%', avatar: 'RS' },
  { rank: 3, name: 'Karan Singh', score: '89.8%', avatar: 'KS' },
  { rank: 4, name: 'Vanshita Jain', score: '88.4%', avatar: 'VJ' },
  { rank: 5, name: 'Devarsh Patel', score: '87.9%', avatar: 'DP' },
];

const examOverviewData = [
  { name: 'Mock Test', value: 18, color: '#3b82f6', percent: '40%' },
  { name: 'Part Test', value: 12, color: '#10b981', percent: '27%' },
  { name: 'Subjective', value: 8, color: '#8b5cf6', percent: '18%' },
  { name: 'Weekly Test', value: 5, color: '#f59e0b', percent: '11%' },
  { name: 'DPP Test', value: 2, color: '#ef4444', percent: '4%' },
];

const evaluationStatusData = [
  { name: 'Pending', value: 18, color: '#f59e0b' },
  { name: 'In-Progress', value: 12, color: '#3b82f6' },
  { name: 'Completed', value: 15, color: '#10b981' },
];

export function ExamsList() {
  const [search, setSearch] = useState('');

  return (
    <div className="bg-white min-h-screen text-[#1e293b] p-6 space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exams & Assessments</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage schedules, test distribution, and grading status across cohorts</p>
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
            { label: 'Total Exams', value: '45', trend: '+8%', trendUp: true, color: 'text-green-500' },
            { label: 'Upcoming Exams', value: '12', trend: '-20%', trendUp: false, color: 'text-rose-500' },
            { label: 'Completed Exams', value: '28', trend: '+5%', trendUp: true, color: 'text-green-500' },
            { label: 'Evaluation Pending', value: '18', trend: '+12%', trendUp: true, color: 'text-amber-500' },
            { label: 'Avg Pass Percentage', value: '78%', trend: '+6%', trendUp: true, color: 'text-blue-500' },
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
                placeholder="Search exams by name or code..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {['Exam Type', 'Program', 'Batch', 'Status', 'Date Range'].map((filter) => (
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
          
          {/* Right Controls: Export, Create Exam */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-gray-500" /> Export
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Schedule Exam
            </button>
          </div>
        </div>

        {/* ── UPCOMING EXAMS SET TO FULL WIDTH CARD ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Upcoming & Active Exams</h2>
                <p className="text-[11px] text-gray-500">Scheduled assessment timeline and candidate registrations</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              12 Upcoming Exams
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Exam Name</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Code</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Batch Cohort</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Exam Type</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Scheduled Date</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Duration</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Registered Candidates</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {examList.map((exam) => (
                  <tr key={exam.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <span className="font-bold text-gray-900 text-[12.5px] block">{exam.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-gray-500 text-[11px] bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{exam.code}</span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-blue-600">{exam.batch}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full border ${
                        exam.type === 'Mock Test' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                        exam.type === 'Part Test' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        exam.type === 'Subjective' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                        'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {exam.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-medium text-gray-700">{exam.date}</td>
                    <td className="px-5 py-3.5 text-gray-500 font-medium">{exam.duration}</td>
                    <td className="px-5 py-3.5 font-bold text-gray-900">{exam.students} Students</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition-colors" title="Copy Code">
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

        {/* ── OTHER CARDS SET BELOW THE UPCOMING EXAMS CARD WITH PROPER SPACING ── */}
        <div className="space-y-6 pt-2">

          {/* Row 1: Pass Percentage Trend & Top Performers (2 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* 1. Pass Percentage Trend */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" /> Pass Percentage Trend
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">Historical average pass rates across all cohorts</p>
                  </div>
                  <button className="text-xs text-blue-600 hover:underline font-bold flex items-center gap-0.5">
                    View Report <ArrowUpRight className="w-3 h-3" />
                  </button>
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

            {/* 2. Top Performing Students */}
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
                        <span className={`w-5 h-5 rounded-full font-bold text-xs flex items-center justify-center text-white ${
                          student.rank === 1 ? 'bg-amber-400' : student.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'
                        }`}>
                          {student.rank}
                        </span>
                        <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                          {student.avatar}
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{student.name}</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{student.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View Full Student Merit List →
              </button>
            </div>

          </div>

          {/* Row 2: Exam Overview, Evaluation Status & Operational Alerts (3 Equal Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 1. Exam Overview Donut Chart */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Exam Type Breakdown</h3>
                <p className="text-[11px] text-gray-400 mb-4">Distribution across test formats</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={examOverviewData}
                          innerRadius={36}
                          outerRadius={54}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {examOverviewData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-bold text-gray-900">45</span>
                      <span className="text-[9px] text-gray-400">Exams</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {examOverviewData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-600 font-medium truncate max-w-[80px]">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Evaluation Status */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Evaluation Status</h3>
                <p className="text-[11px] text-gray-400 mb-4">Grading & Result Processing Progress</p>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 relative shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={evaluationStatusData}
                          innerRadius={36}
                          outerRadius={54}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          {evaluationStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-sm font-bold text-amber-600">18</span>
                      <span className="text-[9px] text-gray-400">Pending</span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {evaluationStatusData.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50/70 p-2 rounded border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-700 font-semibold">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Operational Exam Alerts */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900">Exam Operational Alerts</h3>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Action Needed</span>
                </div>
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-100 text-amber-800 text-xs flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="font-semibold">18 evaluations pending grade publish</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-800 text-xs flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="font-semibold">3 upcoming exams need invigilator assignment</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100 text-rose-800 text-xs flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span className="font-semibold">5 exams missing uploaded answer key</span>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View All Operational Alerts →
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
