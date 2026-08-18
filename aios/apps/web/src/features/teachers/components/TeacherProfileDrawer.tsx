'use client';
// ─── Teacher Profile Drawer ───────────────────────────────────────────────────
// Right slide-over profile drawer with 4 tabs:
// Overview | Batches & Schedule | Appraisals & Papers | History & Timeline

import React, { useState } from 'react';
import {
  X, User, BookOpen, Calendar, Clock, Award, Star,
  FileCheck, AlertTriangle, CheckCircle, Mail, Phone,
  GraduationCap, Briefcase, ChevronRight, Sparkles, Building2,
} from 'lucide-react';
import type { TeacherProfile } from '../types/teacher.types';
import { useTeacherProfile } from '../hooks/useTeachers';

interface TeacherProfileDrawerProps {
  teacherId: string | null;
  onClose:   () => void;
  onEdit?:   (id: string) => void;
}

type TabKey = 'overview' | 'schedule' | 'appraisals' | 'timeline';

function availabilityBadge(status: string) {
  if (status === 'available') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (status === 'busy')      return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-rose-100 text-rose-700 border-rose-200';
}

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

function OverviewTab({ profile }: { profile: TeacherProfile }) {
  return (
    <div className="space-y-5">
      {/* Quick KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Rating',               value: `${profile.rating} / 5`,       icon: Star,      color: 'text-amber-500',   bg: 'bg-amber-50' },
          { label: 'Weekly Hours',         value: `${profile.weeklyClasses} hrs`,icon: Clock,     color: 'text-indigo-600',  bg: 'bg-indigo-50' },
          { label: 'Assigned Batches',     value: profile.assignedBatches,       icon: BookOpen,  color: 'text-blue-600',    bg: 'bg-blue-50' },
          { label: 'Avg Student Perf.',    value: `${profile.avgStudentScore}%`, icon: Award,     color: 'text-emerald-600', bg: 'bg-emerald-50' },
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

      {/* Qualifications & Experience */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <GraduationCap className="w-4 h-4 text-indigo-500" /> Academic & Experience
        </h4>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Qualification</span>
            <span className="font-semibold text-slate-800">{profile.qualification}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Experience</span>
            <span className="font-semibold text-slate-800">{profile.experienceYears} Years</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Primary Subject</span>
            <span className="font-bold text-indigo-600">{profile.subject}</span>
          </div>
        </div>
        {profile.bio && (
          <p className="text-[11px] text-slate-600 pt-2 border-t border-slate-200/60 leading-relaxed italic">
            "{profile.bio}"
          </p>
        )}
      </div>

      {/* Subjects Tag List */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Specializations</h4>
        <div className="flex flex-wrap gap-1.5">
          {profile.subjects.map((sub) => (
            <span key={sub} className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-100">
              {sub}
            </span>
          ))}
        </div>
      </div>

      {/* Workload Progress */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">Workload Capacity</span>
          <span className={`font-bold ${profile.workloadPct > 85 ? 'text-rose-600' : 'text-emerald-600'}`}>
            {profile.workloadPct}%
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-700 ${
              profile.workloadPct > 85 ? 'bg-rose-500' : profile.workloadPct > 65 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${profile.workloadPct}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-400">
          {profile.workloadPct > 85 ? 'High workload. Consider assigning substitute for new batches.' : 'Workload within optimal range.'}
        </p>
      </div>
    </div>
  );
}

function ScheduleTab({ profile }: { profile: TeacherProfile }) {
  return (
    <div className="space-y-5">
      {/* Batch Overview */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Assigned Batches</h4>
        <div className="grid grid-cols-1 gap-2">
          {profile.batchDetails.map((b) => (
            <div key={b.batchId} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">{b.batchName}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{b.studentCount} Students enrolled</p>
              </div>
              <div className="text-right text-xs">
                <span className="font-bold text-indigo-600 block">{b.avgBatchScore}% avg score</span>
                <span className="text-[10px] text-emerald-600 font-medium">{b.attendanceRate}% attendance</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timetable Slots */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Weekly Timetable</h4>
        <div className="space-y-2">
          {profile.schedule.map((slot) => (
            <div key={slot.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <span className="w-10 text-center py-1 bg-indigo-600 text-white font-bold rounded-md text-[10px] shrink-0">
                  {slot.day}
                </span>
                <div>
                  <p className="font-bold text-slate-800">{slot.batchName}</p>
                  <p className="text-[10px] text-slate-400">{slot.roomNo} · {slot.subject}</p>
                </div>
              </div>
              <span className="font-semibold text-slate-600">{slot.timeSlot}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AppraisalsTab({ profile }: { profile: TeacherProfile }) {
  return (
    <div className="space-y-5">
      {/* Pending Papers */}
      {profile.pendingPapers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-purple-500" /> Pending Blueprints
          </h4>
          {profile.pendingPapers.map((paper) => (
            <div key={paper.id} className="p-3.5 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between text-xs">
              <div>
                <p className="font-bold text-slate-900">{paper.paperTitle}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{paper.batchName} · {paper.totalQuestions} Questions</p>
              </div>
              <button className="px-3 py-1.5 bg-purple-600 text-white font-bold text-[11px] rounded-lg hover:bg-purple-700">
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Appraisals List */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-500" /> Appraisal History
        </h4>
        {profile.appraisals.map((ap) => (
          <div key={ap.id} className="p-4 bg-white rounded-xl border border-slate-100 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">{ap.period}</span>
              <div className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{ap.rating} / 5</span>
              </div>
            </div>
            <p className="text-slate-600 italic text-[11px]">"{ap.feedback}"</p>
            <p className="text-[10px] text-slate-400 text-right">Evaluated by {ap.evaluatedBy} on {ap.date}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineTab({ profile }: { profile: TeacherProfile }) {
  return (
    <div className="space-y-3 relative">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100" />
      {profile.timeline.map((ev) => (
        <div key={ev.id} className="flex items-start gap-4 relative pl-4">
          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 z-10 text-xs font-bold">
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

export function TeacherProfileDrawer({ teacherId, onClose, onEdit }: TeacherProfileDrawerProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const { data: profile, isLoading, isError } = useTeacherProfile(teacherId);

  const isOpen = !!teacherId;

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
        aria-label="Teacher Profile"
      >
        {isLoading && <DrawerSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load teacher profile.</p>
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
                    {profile.avatarInitials}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.designation} · {profile.subject}</p>
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
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[10.5px] flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full border font-bold ${availabilityBadge(profile.availability)} capitalize`}>
                  {profile.availability}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Mail className="w-3 h-3" /> {profile.email}
                </span>
                <span className="flex items-center gap-1 text-slate-500">
                  <Phone className="w-3 h-3" /> {profile.phone}
                </span>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex-shrink-0 flex border-b border-slate-100 bg-white px-5">
              {(['overview', 'schedule', 'appraisals', 'timeline'] as TabKey[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${
                    tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t === 'schedule' ? 'Schedule & Batches' : t === 'appraisals' ? 'Appraisals' : t}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview'   && <OverviewTab   profile={profile} />}
              {tab === 'schedule'   && <ScheduleTab   profile={profile} />}
              {tab === 'appraisals' && <AppraisalsTab profile={profile} />}
              {tab === 'timeline'   && <TimelineTab   profile={profile} />}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Emp ID: {profile.empId}</p>
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
