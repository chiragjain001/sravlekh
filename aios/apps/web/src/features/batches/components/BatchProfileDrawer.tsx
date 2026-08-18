'use client';
// ─── Batch Profile Drawer ──────────────────────────────────────────────────────
// Right slide-over profile drawer with 4 tabs:
// Overview | Enrolled Students | Syllabus & Schedule | History & Audit

import React, { useState } from 'react';
import {
  X, Layers, Users, Calendar, Award, CheckCircle, Clock, BookOpen,
  AlertTriangle, ChevronRight, User, GraduationCap, Building2,
} from 'lucide-react';
import type { BatchProfile } from '../types/batch.types';
import { useBatchProfile } from '../hooks/useBatches';

interface BatchProfileDrawerProps {
  batchId: string | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

type TabKey = 'overview' | 'students' | 'syllabus' | 'timeline';

function DrawerSkeleton() {
  return (
    <div className="flex flex-col h-full animate-pulse p-6 gap-4">
      <div className="h-24 bg-slate-100 rounded-2xl" />
      <div className="flex gap-2">
        {[1,2,3,4].map((i) => <div key={i} className="h-8 flex-1 bg-slate-100 rounded-lg" />)}
      </div>
      {[1,2,3,4,5].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
    </div>
  );
}

function OverviewTab({ profile }: { profile: BatchProfile }) {
  return (
    <div className="space-y-5">
      {/* Quick KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Enrolled Students',  value: `${profile.enrolledStudents} / ${profile.maxCapacity}`, icon: Users,      color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Avg Test Score',     value: `${profile.avgScore}%`,                                 icon: Award,      color: 'text-emerald-600',bg: 'bg-emerald-50' },
          { label: 'Attendance Rate',    value: `${profile.attendancePct}%`,                            icon: Calendar,   color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Syllabus Progress',  value: `${profile.syllabusProgress}%`,                         icon: BookOpen,   color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 flex items-center gap-3 border border-white`}>
            <div className={`${kpi.color} shrink-0`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-900 leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Cohort Meta */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 text-xs">
        <h4 className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <Building2 className="w-4 h-4 text-blue-500" /> Cohort Metadata
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Lead Mentor</span>
            <span className="font-bold text-slate-900">{profile.leadMentor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Branch & Room</span>
            <span className="font-medium text-slate-700">{profile.branchName} · {profile.roomNo}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Class Schedule</span>
            <span className="font-medium text-slate-700">{profile.scheduleSummary}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Session Dates</span>
            <span className="font-medium text-slate-700">{profile.startDate} to {profile.endDate}</span>
          </div>
        </div>
      </div>

      {/* Faculty Team */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Assigned Subject Faculty</h4>
        <div className="space-y-2">
          {profile.assignedFaculty.map((f) => (
            <div key={f.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                  {f.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{f.name}</p>
                  <p className="text-[10px] text-slate-400">{f.subject}</p>
                </div>
              </div>
              <span className="font-semibold text-slate-600">{f.weeklyHours} hrs/wk</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StudentsTab({ profile }: { profile: BatchProfile }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <h4 className="font-bold text-slate-700 uppercase tracking-wide">Student Roster ({profile.enrolledStudentsList.length})</h4>
        <span className="text-slate-400">{profile.maxCapacity - profile.enrolledStudents} seats remaining</span>
      </div>

      <div className="space-y-2">
        {profile.enrolledStudentsList.map((st) => (
          <div key={st.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                {st.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="font-bold text-slate-900">{st.name}</p>
                <p className="text-[10px] text-slate-400">{st.rollNo}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="font-bold text-emerald-600 block">{st.avgScore}% avg</span>
              <span className="text-[10px] text-slate-400">{st.attendancePct}% att.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyllabusTab({ profile }: { profile: BatchProfile }) {
  return (
    <div className="space-y-5">
      {/* Chapters list */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Syllabus Completion</h4>
        <div className="space-y-2.5">
          {profile.syllabusChapters.map((ch, i) => (
            <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900">{ch.chapterName}</span>
                  <span className="text-[10px] text-slate-400 ml-2">({ch.subject})</span>
                </div>
                <span className="font-bold text-indigo-600">{ch.completedPct}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-indigo-600 transition-all duration-700"
                  style={{ width: `${ch.completedPct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming tests */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Scheduled Tests</h4>
        <div className="space-y-2">
          {profile.upcomingTests.map((t) => (
            <div key={t.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900">{t.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Date: {t.date} · Max: {t.maxMarks} marks</p>
              </div>
              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 font-bold rounded-lg text-[10.5px]">
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ profile }: { profile: BatchProfile }) {
  return (
    <div className="space-y-3 relative">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100" />
      {profile.timeline.map((ev) => (
        <div key={ev.id} className="flex items-start gap-4 relative pl-4">
          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 z-10 text-xs font-bold">
            ✓
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold text-slate-900">{ev.title}</p>
              <span className="text-[10px] text-slate-400 shrink-0 ml-2">{ev.date}</span>
            </div>
            {ev.detail && <p className="text-[11px] text-slate-500 mt-0.5">{ev.detail}</p>}
            <p className="text-[10px] text-slate-400 mt-0.5">by {ev.actor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function BatchProfileDrawer({ batchId, onClose, onEdit }: BatchProfileDrawerProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const { data: profile, isLoading, isError } = useBatchProfile(batchId);

  const isOpen = !!batchId;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Batch Overview"
      >
        {isLoading && <DrawerSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load batch overview.</p>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">Close</button>
          </div>
        )}

        {!isLoading && !isError && profile && (
          <>
            {/* Header */}
            <div className="flex-shrink-0 p-5 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.code} · {profile.program} {profile.targetYear}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(profile.id)}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100"
                    >
                      Edit
                    </button>
                  )}
                  <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex-shrink-0 flex border-b border-slate-100 bg-white px-5">
              {(['overview', 'students', 'syllabus', 'timeline'] as TabKey[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${
                    tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t === 'students' ? 'Enrolled Roster' : t === 'syllabus' ? 'Syllabus & Tests' : t}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview' && <OverviewTab profile={profile} />}
              {tab === 'students' && <StudentsTab profile={profile} />}
              {tab === 'syllabus' && <SyllabusTab profile={profile} />}
              {tab === 'timeline' && <TimelineTab profile={profile} />}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Batch ID: {profile.id}</p>
              <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300">
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
