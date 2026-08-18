'use client';
// ─── Exam Profile Drawer ──────────────────────────────────────────────────────
// Right slide-over profile drawer with 4 tabs:
// Overview | Candidates | Blueprint & Questions | Timeline & Audit

import React, { useState, useEffect, useRef } from 'react';
import {
  X, FileText, Users, Calendar, Award, CheckCircle, Clock, BookOpen,
  AlertTriangle, ChevronRight, User, GraduationCap, Building2, HelpCircle,
} from 'lucide-react';
import type { ExamProfile } from '../types/exam.types';
import { useExamProfile } from '../hooks/useExams';

interface ExamProfileDrawerProps {
  examId:  string | null;
  onClose: () => void;
  onEdit?: (id: string) => void;
}

type TabKey = 'overview' | 'candidates' | 'blueprint' | 'timeline';

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

function OverviewTab({ profile }: { profile: ExamProfile }) {
  return (
    <div className="space-y-5">
      {/* Quick KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Registered Candidates', value: `${profile.students} Students`, icon: Users,    color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Duration & Format',     value: `${profile.duration} · ${profile.type}`, icon: Clock, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Total Test Marks',      value: `${profile.maxMarks} Marks`,            icon: Award,  color: 'text-emerald-600',bg: 'bg-emerald-50' },
          { label: 'Historical Pass Rate',  value: `${profile.passRate}%`,                icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-4 flex items-center gap-3 border border-white`}>
            <div className={`${kpi.color} shrink-0`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">{kpi.label}</p>
              <p className="text-base font-bold text-slate-900 leading-tight">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Exam Meta */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3 text-xs">
        <h4 className="font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-blue-500" /> Assessment Blueprint
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">Target Batch</span>
            <span className="font-bold text-slate-900">{profile.batch}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Scheduled Date</span>
            <span className="font-medium text-slate-700">{profile.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Author &amp; Faculty Lead</span>
            <span className="font-medium text-slate-700">{profile.authorFaculty}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Current Status</span>
            <span className="font-bold text-blue-600">{profile.status}</span>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Candidate Instructions</h4>
        <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100 leading-relaxed">
          {profile.instructions}
        </p>
      </div>
    </div>
  );
}

function CandidatesTab({ profile }: { profile: ExamProfile }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs">
        <h4 className="font-bold text-slate-700 uppercase tracking-wide">Registered Candidates ({profile.registeredCandidates.length})</h4>
        <span className="text-slate-400">Total: {profile.students}</span>
      </div>

      <div className="space-y-2">
        {profile.registeredCandidates.map((c) => (
          <div key={c.id} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                {c.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div>
                <p className="font-bold text-slate-900">{c.name}</p>
                <p className="text-[10px] text-slate-400">{c.rollNo} · {c.batchName}</p>
              </div>
            </div>
            <div className="text-right">
              {c.scorePct != null ? (
                <span className="font-bold text-emerald-600 block">{c.scorePct}% score</span>
              ) : (
                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold text-[10px]">Registered</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlueprintTab({ profile }: { profile: ExamProfile }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Question Blueprint</h4>
      <div className="space-y-2">
        {profile.questionPaperBlueprint.map((q) => (
          <div key={q.qNo} className="p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-[11px]">
                Q{q.qNo}
              </span>
              <div>
                <p className="font-bold text-slate-900">{q.topic}</p>
                <p className="text-[10px] text-slate-400">{q.section} · {q.type}</p>
              </div>
            </div>
            <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              +{q.marks} Marks
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineTab({ profile }: { profile: ExamProfile }) {
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

export function ExamProfileDrawer({ examId, onClose, onEdit }: ExamProfileDrawerProps) {
  const [tab, setTab] = useState<TabKey>('overview');
  const { data: profile, isLoading, isError } = useExamProfile(examId);

  const isOpen = !!examId;
  const isClosingFromPopstate = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== 'undefined') {
      window.history.pushState(
        { ...window.history.state, aiosDrawer: 'ExamProfile' },
        '',
        window.location.href
      );
    }

    const handlePopState = () => {
      isClosingFromPopstate.current = true;
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
      if (typeof window !== 'undefined' && !isClosingFromPopstate.current && window.history.state?.aiosDrawer) {
        window.history.back();
      }
      isClosingFromPopstate.current = false;
    };
  }, [isOpen, onClose]);

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
        aria-label="Exam Overview"
      >
        {isLoading && <DrawerSkeleton />}

        {isError && (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <AlertTriangle className="w-12 h-12 text-rose-400" />
            <p className="text-sm font-bold text-slate-700">Failed to load exam details.</p>
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
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{profile.code} · {profile.batch}</p>
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
              {(['overview', 'candidates', 'blueprint', 'timeline'] as TabKey[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-3 text-xs font-bold capitalize transition-colors border-b-2 -mb-px ${
                    tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {t === 'candidates' ? 'Candidates' : t === 'blueprint' ? 'Paper Blueprint' : t}
                </button>
              ))}
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {tab === 'overview' && <OverviewTab profile={profile} />}
              {tab === 'candidates' && <CandidatesTab profile={profile} />}
              {tab === 'blueprint' && <BlueprintTab profile={profile} />}
              {tab === 'timeline' && <TimelineTab profile={profile} />}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <p className="text-[10px] text-slate-400">Exam ID: {profile.id}</p>
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
