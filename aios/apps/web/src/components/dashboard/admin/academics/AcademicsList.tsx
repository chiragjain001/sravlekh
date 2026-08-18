'use client';

import { useState } from 'react';
import { Search, ChevronLeft, ChevronRight, CheckCircle2, FileText, UploadCloud, Calendar, Bell, ChevronDown, Sparkles, BookOpen, Clock, AlertTriangle, HelpCircle, Layers, CheckSquare, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- Mock Data ---
const syllabusTrendData = [
  { month: 'Dec', value: 25 },
  { month: 'Jan', value: 35 },
  { month: 'Feb', value: 45 },
  { month: 'Mar', value: 55 },
  { month: 'Apr', value: 65 },
  { month: 'May', value: 68 },
];

export function AcademicsList() {
  const [search, setSearch] = useState('');

  return (
    <div className="bg-white min-h-screen text-[#1e293b] p-6 space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Academics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Curriculum tracking, syllabus progression, and assessment pipeline</p>
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
            { label: 'Syllabus Completion', value: '68%', trend: '+5%', trendUp: true, color: 'text-emerald-500' },
            { label: 'Upcoming Exams', value: '15', trend: '+2', trendUp: true, color: 'text-emerald-500' },
            { label: 'Pending Papers', value: '7', trend: '-1', trendUp: false, color: 'text-rose-500' },
            { label: 'Active Assignments', value: '26', trend: '+6', trendUp: true, color: 'text-emerald-500' },
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

        {/* Filters & Control Bar */}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white rounded-xl p-3 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search subjects, topics, or assignments..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {['Subject', 'Teacher', 'Academic Year 2024-25'].map((filter) => (
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
        </div>

        {/* ── TIER 1: CORE CURRICULUM INSIGHTS & CALENDAR (2 Columns) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Syllabus Progress & Trend (Spans 2 Cols) */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Syllabus Progression & Trend
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Real-time subject-wise curriculum completion rates</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  <span className="text-xs font-bold text-blue-700">68% Overall Completion</span>
                </div>
              </div>

              {/* Grid with Progress Bars & Line Chart */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Subject Bars */}
                <div className="space-y-4">
                  {[
                    { subject: 'Physics', progress: 72, color: 'bg-blue-600' },
                    { subject: 'Chemistry', progress: 68, color: 'bg-emerald-500' },
                    { subject: 'Mathematics', progress: 75, color: 'bg-indigo-600' },
                    { subject: 'Biology', progress: 65, color: 'bg-purple-600' },
                    { subject: 'English', progress: 80, color: 'bg-amber-500' },
                  ].map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-700">{item.subject}</span>
                        <span className="text-[11px] font-bold text-gray-900">{item.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Line Chart */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-800">Monthly Progress Trend</span>
                    <span className="text-[10px] font-semibold text-gray-400">Dec - May</span>
                  </div>
                  <div className="h-40 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={syllabusTrendData} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                        <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium">Tracking 5 core departments across all cohorts</span>
              <button className="text-blue-600 font-bold hover:underline">View Detailed Syllabus Breakdown →</button>
            </div>
          </div>

          {/* Academic Calendar (Spans 1 Col) */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900">Academic Calendar</h3>
                <div className="flex items-center gap-2">
                  <button className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <span className="text-xs font-bold text-gray-900">May 2025</span>
                  <button className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-50 rounded"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-gray-400 uppercase mb-2">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, idx) => <div key={idx}>{day}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium">
                {[...Array(31)].map((_, i) => {
                  const date = i + 1;
                  const isSelected = date === 23;
                  const hasEvent = [15, 18, 23, 28].includes(date);
                  return (
                    <div key={i} className={`py-1.5 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                      <span>{date}</span>
                      {hasEvent && !isSelected && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-wide">Today's Schedule (23 May)</span>
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded">2 Events</span>
              </div>
              <div className="p-2.5 rounded-lg border border-gray-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-900">JEE Main Mock 07</p>
                  <p className="text-[10px] text-gray-500">Hall A • 10:00 AM</p>
                </div>
                <span className="text-[10px] font-bold text-blue-600">Exam</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── TIER 2: EXAM PIPELINE, ASSET QUEUES & TEACHER TASKS (3 Equal Columns) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* 1. Exam Pipeline & Assessment Status */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-500" /> Exam Pipeline
                </h3>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">53 Active Papers</span>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: 'Draft', count: 12, bg: 'bg-slate-50 border-slate-100 text-slate-700' },
                  { label: 'Approval', count: 7, bg: 'bg-purple-50 border-purple-100 text-purple-700' },
                  { label: 'Published', count: 15, bg: 'bg-blue-50 border-blue-100 text-blue-700' },
                  { label: 'Conducted', count: 9, bg: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                  { label: 'Evaluation', count: 6, bg: 'bg-amber-50 border-amber-100 text-amber-700' },
                  { label: 'Locked', count: 4, bg: 'bg-rose-50 border-rose-100 text-rose-700' },
                ].map((stage, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg border text-center ${stage.bg}`}>
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-80">{stage.label}</p>
                    <p className="text-base font-bold">{stage.count}</p>
                  </div>
                ))}
              </div>

              {/* Assignment Summary */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Active Assignments</span>
                  <span className="font-bold text-blue-600">26</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500 font-medium">Pending Submissions</span>
                  <span className="font-bold text-amber-600">112</span>
                </div>
              </div>
            </div>

            <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
              Manage Exam Pipeline →
            </button>
          </div>

          {/* 2. Doubt Queue & Question Bank Summary */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-500" /> Academic Assets & Queue
              </h3>

              <div className="space-y-4">
                {/* Doubt Queue Box */}
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Doubt Queue</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">31 Unresolved</span>
                  </div>
                  <div className="space-y-2">
                    {[
                      { teacherName: 'Rahul Verma', subject: 'Physics', count: 12 },
                      { teacherName: 'Pooja Sharma', subject: 'Chemistry', count: 10 },
                      { teacherName: 'Amit Singh', subject: 'Mathematics', count: 9 },
                    ].map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11.5px] bg-white p-2 rounded-lg border border-slate-100">
                        <div>
                          <span className="font-bold text-gray-900 block leading-tight">{item.teacherName}</span>
                          <span className="text-[10px] text-gray-400 font-medium">{item.subject}</span>
                        </div>
                        <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[10.5px] border border-amber-100">{item.count} Unresolved</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Question Bank Summary Box */}
                <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Question Bank</span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">4,620 Total</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold">Used This Month</p>
                      <p className="font-bold text-gray-900 mt-0.5">280</p>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-semibold">AI-Generated</p>
                      <p className="font-bold text-purple-600 mt-0.5">540</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
              Access Question Bank & Doubts →
            </button>
          </div>

          {/* 3. Teacher Tasks & AI Recommendations */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" /> Teacher Pending Tasks
                </h3>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">3 Tasks</span>
              </div>

              <div className="space-y-2.5 mb-5">
                {[
                  { name: 'Rahul Verma', task: 'Upload Test Paper', color: 'bg-red-50 text-red-600 border-red-100' },
                  { name: 'Pooja Sharma', task: 'Evaluate Assignments', color: 'bg-amber-50 text-amber-600 border-amber-100' },
                  { name: 'Amit Singh', task: 'Complete Syllabus', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                ].map((teacher, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg border border-gray-100 bg-slate-50/50">
                    <span className="text-xs font-bold text-gray-800">{teacher.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${teacher.color}`}>{teacher.task}</span>
                  </div>
                ))}
              </div>

              {/* AI Recommendations Box */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                <h4 className="text-xs font-bold text-purple-900 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" /> AI Academic Recommendations
                </h4>
                <div className="space-y-1.5">
                  {[
                    '12 topics need curriculum reinforcement',
                    '5 batches falling behind schedule',
                    'Suggest scheduling extra revision classes',
                  ].map((rec, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px] font-medium text-purple-800">
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                      <span className="truncate">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button className="w-full mt-4 text-center text-xs text-purple-600 font-bold hover:underline">
              View AI Insights & Reminders →
            </button>
          </div>

        </div>

        {/* ── TIER 3: RECENT ACTIVITIES & CURRICULUM TIMELINE (2 Equal Columns) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Recent Academic Activities */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Recent Academic Activities
              </h3>
              <div className="space-y-3">
                {[
                  { title: 'Physics syllabus updated for JEE 2025 Star', author: 'Rahul Verma', time: '2 hours ago', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
                  { title: 'Chemistry Assignment 04 published', author: 'Pooja Sharma', time: '3 hours ago', icon: <FileText className="w-4 h-4 text-blue-500" /> },
                  { title: 'JEE Main Mock 07 published', author: 'Neha Malhotra', time: '6 hours ago', icon: <UploadCloud className="w-4 h-4 text-purple-500" /> },
                ].map((activity, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-slate-50/50">
                    <div className="mt-0.5">{activity.icon}</div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-900 leading-snug">{activity.title}</p>
                      <p className="text-[10px] font-medium text-gray-500 mt-0.5">By {activity.author} • {activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
              View Complete Activity Log →
            </button>
          </div>

          {/* Monthly Curriculum Timeline & Pending Topics */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Monthly Curriculum Milestones</h3>
              
              {/* Timeline Indicator */}
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 mb-4">
                <div className="flex justify-between items-center text-[10px] font-bold text-gray-600 uppercase tracking-wide">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mb-1" />
                    <span>Unit Test</span>
                  </div>
                  <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mb-1" />
                    <span>Assignment</span>
                  </div>
                  <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full border-2 border-blue-500 bg-white mb-1" />
                    <span className="text-blue-600">Mock Test</span>
                  </div>
                  <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-2" />
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white mb-1" />
                    <span>PTM</span>
                  </div>
                </div>
              </div>

              {/* Topics Pending Completion */}
              <h4 className="text-xs font-bold text-gray-900 mb-2">Priority Topics Pending Completion</h4>
              <div className="space-y-2">
                {[
                  { num: 1, name: 'Rotational Dynamics', subject: 'Physics', status: 'High Priority' },
                  { num: 2, name: 'Aldehydes & Ketones', subject: 'Chemistry', status: 'In Progress' },
                  { num: 3, name: 'Definite Integrals', subject: 'Maths', status: 'Scheduled' },
                ].map((topic) => (
                  <div key={topic.num} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">{topic.num}</span>
                      <div>
                        <span className="font-bold text-gray-900">{topic.name}</span>
                        <span className="text-[10px] text-gray-500 ml-2">({topic.subject})</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600">{topic.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
              View Full Academic Calendar →
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
