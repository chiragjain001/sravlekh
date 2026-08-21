'use client';
// ─── AdminAcademics — Academic Operations Console ──────────────────────────────
// Enterprise service-backed screen keeping 100% design fidelity with current UI.

import React, { useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, FileText, Calendar, Bell, ChevronDown,
  Sparkles, BookOpen, Clock, AlertTriangle, HelpCircle, Layers, CheckSquare, TrendingUp,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';
import { useAcademicsAnalytics } from '@/features/academics/hooks/useAcademics';
import { CurriculumManager } from './curriculum/CurriculumManager';

type AcademicsTab = 'operations' | 'curriculum';

export function AdminAcademics() {
  const [mainTab, setMainTab] = useState<AcademicsTab>('operations');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [activeModal, setActiveModal] = useState<'syllabus' | 'pipeline' | 'doubts' | 'aiInsights' | null>(null);

  const { data: analytics, isLoading } = useAcademicsAnalytics({ search, subject: subjectFilter });

  // Fallback / default data from analytics or service defaults
  const syllabusTrendData = analytics?.syllabusTrend ?? [
    { month: 'Dec', value: 25 },
    { month: 'Jan', value: 35 },
    { month: 'Feb', value: 45 },
    { month: 'Mar', value: 55 },
    { month: 'Apr', value: 65 },
    { month: 'May', value: 68 },
  ];

  const subjectProgressList = analytics?.subjectProgress ?? [
    { id: '1', teacherName: 'Rahul Verma',  subject: 'Physics',     progress: 72, color: 'bg-blue-600',    chaptersDone: 18, totalChapters: 25 },
    { id: '2', teacherName: 'Pooja Sharma', subject: 'Chemistry',   progress: 68, color: 'bg-emerald-500', chaptersDone: 17, totalChapters: 25 },
    { id: '3', teacherName: 'Amit Singh',   subject: 'Mathematics', progress: 75, color: 'bg-indigo-600',  chaptersDone: 15, totalChapters: 20 },
    { id: '4', teacherName: 'Meera Joshi',  subject: 'Biology',     progress: 65, color: 'bg-purple-600',  chaptersDone: 13, totalChapters: 20 },
    { id: '5', teacherName: 'Sunil Kapoor', subject: 'English',     progress: 80, color: 'bg-amber-500',   chaptersDone: 16, totalChapters: 20 },
  ];

  const pipelineStages = analytics?.pipelineStages ?? [
    { id: '1', label: 'Draft',      count: 12 },
    { id: '2', label: 'Approval',   count: 7 },
    { id: '3', label: 'Published',  count: 15 },
    { id: '4', label: 'Conducted',  count: 9 },
    { id: '5', label: 'Evaluation', count: 6 },
    { id: '6', label: 'Locked',     count: 4 },
  ];

  const doubtQueue = analytics?.doubtQueue ?? [
    { id: '1', teacherName: 'Rahul Verma',  subject: 'Physics',     unresolvedCount: 12, status: 'unresolved' as const },
    { id: '2', teacherName: 'Pooja Sharma', subject: 'Chemistry',   unresolvedCount: 10, status: 'unresolved' as const },
    { id: '3', teacherName: 'Amit Singh',   subject: 'Mathematics', unresolvedCount: 6,  status: 'unresolved' as const },
    { id: '4', teacherName: 'Meera Joshi',  subject: 'Biology',     unresolvedCount: 3,  status: 'unresolved' as const },
  ];

  const teacherTasks = analytics?.teacherTasks ?? [
    { id: '1', task: 'Grade JEE Main Mock 07 Physics Section', teacherName: 'Rahul Verma', subject: 'Physics', dueDate: '2025-05-25', priority: 'high' as const },
    { id: '2', task: 'Upload NEET Unit Test 05 Blueprint', teacherName: 'Pooja Sharma', subject: 'Chemistry', dueDate: '2025-05-26', priority: 'medium' as const },
  ];

  const aiInsights = analytics?.aiInsights ?? [
    {
      id: '1',
      title: 'Reinforcement Recommendation',
      category: 'reinforcement' as const,
      description: '12 topics across Physics and Organic Chemistry show weak average scores (below 55%). Recommend scheduling 2 extra revision sessions.',
      recommendedAction: 'Schedule Revision Seminars for JEE 2025 Cohorts',
    },
  ];

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Academic Operations</h1>
          <p className="text-xs text-gray-500 mt-0.5">Curriculum tracking, syllabus progression, and assessment pipeline</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => setMainTab('operations')}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-colors ${
                mainTab === 'operations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Operations
            </button>
            <button
              onClick={() => setMainTab('curriculum')}
              className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-colors ${
                mainTab === 'curriculum' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Curriculum
            </button>
          </div>
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

      {mainTab === 'curriculum' && <CurriculumManager />}

      <div className={mainTab === 'operations' ? 'space-y-6' : 'hidden'}>
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Syllabus Completion', value: `${analytics?.overallCompletionPct ?? 68}%`, trend: '+5%', trendUp: true, color: 'text-emerald-500' },
            { label: 'Upcoming Exams',       value: analytics?.upcomingExamsCount ?? 15,          trend: '+2', trendUp: true, color: 'text-emerald-500' },
            { label: 'Pending Papers',       value: analytics?.pendingPapersCount ?? 7,           trend: '-1', trendUp: false, color: 'text-rose-500' },
            { label: 'Active Assignments',   value: analytics?.activeAssignmentsCount ?? 26,      trend: '+6', trendUp: true, color: 'text-emerald-500' },
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
            
            <div className="relative">
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none"
              >
                <option value="">Subject: All</option>
                {['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'].map((sub) => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {['Teacher', 'Academic Year 2024-25'].map((filter) => (
              <div key={filter} className="relative">
                <select className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none">
                  <option value="">{filter}</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>

        {/* ── TIER 1: CORE CURRICULUM INSIGHTS & CALENDAR ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Syllabus Progress */}
          <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-500" /> Syllabus Progression &amp; Trend
                  </h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Real-time teacher-wise curriculum completion rates</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  <span className="text-xs font-bold text-blue-700">{analytics?.overallCompletionPct ?? 68}% Overall Completion</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  {subjectProgressList.map((item, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-gray-700">{item.teacherName} ({item.subject})</span>
                        <span className="text-[11px] font-bold text-gray-900">{item.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

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
              <span className="text-gray-500 font-medium">Tracking {subjectProgressList.length} core departments across all cohorts</span>
              <button onClick={() => setActiveModal('syllabus')} className="text-blue-600 font-bold hover:underline cursor-pointer">View Detailed Syllabus Breakdown →</button>
            </div>
          </div>

          {/* Academic Calendar */}
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
                  return (
                    <div key={i} className={`py-1.5 flex flex-col items-center justify-center rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-gray-700 hover:bg-gray-50'
                    }`}>
                      <span>{date}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>

        {/* ── TIER 2: EXAM PIPELINE, ASSET QUEUES & TEACHER TASKS ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Exam Pipeline */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-500" /> Exam Pipeline
                </h3>
                <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">53 Active Papers</span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {pipelineStages.map((stage, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg border bg-slate-50 border-slate-100 text-center">
                    <p className="text-[9px] font-bold uppercase tracking-wider mb-0.5 opacity-80">{stage.label}</p>
                    <p className="text-base font-bold text-slate-800">{stage.count}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setActiveModal('pipeline')} className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              Manage Exam Pipeline →
            </button>
          </div>

          {/* Doubt Queue & Asset */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-500" /> Academic Assets &amp; Queue
              </h3>
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Doubt Queue</span>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    {analytics?.unresolvedDoubtsCount ?? 31} Unresolved
                  </span>
                </div>
                {doubtQueue.slice(0, 3).map((d) => (
                  <div key={d.id} className="text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-slate-800">{d.teacherName}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{d.subject}</p>
                    </div>
                    <span className="text-[10.5px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 shrink-0">
                      {d.unresolvedCount} Unresolved
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setActiveModal('doubts')} className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline cursor-pointer">
              Access Question Bank &amp; Doubts →
            </button>
          </div>

          {/* Teacher Tasks & AI Recommendations */}
          <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-500" /> Teacher Pending Tasks
                </h3>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{teacherTasks.length} Tasks</span>
              </div>
              <div className="space-y-2">
                {teacherTasks.map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
                    <p className="font-bold text-slate-800">{t.task}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{t.teacherName} · Due {t.dueDate}</p>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={() => setActiveModal('aiInsights')} className="w-full mt-4 text-center text-xs text-purple-600 font-bold hover:underline cursor-pointer">
              View AI Insights &amp; Reminders →
            </button>
          </div>

        </div>

      </div>

      {/* ── OVERLAP MODALS ── */}

      {/* 1. Syllabus Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'syllabus'}
        onClose={() => setActiveModal(null)}
        title="Detailed Faculty Syllabus Breakdown"
        subtitle="Granular view of topic completion across all faculty members"
        icon={BookOpen}
        badgeText={`${analytics?.overallCompletionPct ?? 68}% Completed`}
      >
        <div className="space-y-3">
          {subjectProgressList.map((item, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{item.teacherName} ({item.subject})</h4>
                <p className="text-[11px] text-slate-500">{item.chaptersDone} of {item.totalChapters} chapters completed</p>
              </div>
              <span className="text-sm font-bold text-blue-600">{item.progress}%</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 2. Pipeline Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'pipeline'}
        onClose={() => setActiveModal(null)}
        title="Comprehensive Exam Pipeline Console"
        subtitle="Manage status transitions from paper drafting to result lock"
        icon={Layers}
        badgeText="53 Active Papers"
      >
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-900">JEE Main Mock 08 (Draft State)</h4>
              <p className="text-[11px] text-slate-500">Author: Rahul Verma • Target Date: 26 May</p>
            </div>
            <button className="px-3 py-1 bg-purple-600 text-white font-bold text-xs rounded-lg">Submit for Approval</button>
          </div>
        </div>
      </AdminOverlapModal>

      {/* 3. Doubts Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'doubts'}
        onClose={() => setActiveModal(null)}
        title="Teacher-wise Unresolved Doubts Directory"
        subtitle="Track pending student doubt resolution by faculty member"
        icon={HelpCircle}
        badgeText={`${analytics?.unresolvedDoubtsCount ?? 31} Pending`}
      >
        <div className="space-y-3">
          {doubtQueue.map((d) => (
            <div key={d.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{d.teacherName}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">{d.subject} • <span className="font-semibold text-amber-600">{d.unresolvedCount} unresolved doubts</span> pending reply</p>
              </div>
              <button className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-lg hover:bg-indigo-700 transition-colors">
                Notify Teacher
              </button>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 4. AI Insights Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'aiInsights'}
        onClose={() => setActiveModal(null)}
        title="AI Curriculum Intelligence & Recommendations"
        subtitle="Automated suggestions to bridge learning gaps"
        icon={Sparkles}
        badgeText="AI Powered"
        badgeColor="bg-purple-50 text-purple-600 border-purple-100"
      >
        <div className="space-y-3">
          {aiInsights.map((insight) => (
            <div key={insight.id} className="p-4 bg-purple-50/50 rounded-xl border border-purple-100">
              <h4 className="text-xs font-bold text-purple-900">{insight.title}</h4>
              <p className="text-xs text-purple-700 mt-1">{insight.description}</p>
              <div className="mt-2 pt-2 border-t border-purple-100 flex justify-between items-center">
                <span className="text-[11px] font-bold text-purple-800">Action: {insight.recommendedAction}</span>
                <button className="px-2.5 py-1 bg-purple-600 text-white text-[10px] font-bold rounded-lg">Execute Action</button>
              </div>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

    </div>
  );
}
