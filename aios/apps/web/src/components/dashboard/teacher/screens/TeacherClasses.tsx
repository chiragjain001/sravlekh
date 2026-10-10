'use client';

import { useMemo, useRef, useEffect } from 'react';
import {
  ChevronRight, TrendingUp, TrendingDown, Minus, Users2,
  LayoutDashboard, Users, FileText, BookOpen, Target, Calendar,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useMyTeacherProfile, useSubjects, useBatch, useBatchPerformanceSummaries } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import type { BatchTab } from '@/store/dashboard-store';
import { useSwitchBatch } from '@/contexts/academic-context';

// ─── Sub-screens ─────────────────────────────────────────────────────────────
import { BatchOverview }    from '../batch/BatchOverview';
import { BatchStudents }    from '../batch/BatchStudents';
import { BatchTests }       from '../batch/BatchTests';
import { BatchAssignments } from '../batch/BatchAssignments';
import { BatchWeakTopics }  from '../batch/BatchWeakTopics';
import { BatchExtraClasses }from '../batch/BatchExtraClasses';
import { StudentProfile }   from '../batch/StudentProfile';
import { ScreenLoadingState } from '@/components/ui/foundation';

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
  return                       <Minus         className="w-3.5 h-3.5 text-slate-400" />;
}

function Breadcrumb({ parts }: { parts: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] sm:text-[12.5px] text-slate-500 mb-3.5 sm:mb-5 overflow-x-auto no-scrollbar whitespace-nowrap py-0.5 select-none">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5 flex-shrink-0">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
          {p.onClick ? (
            <button
              onClick={p.onClick}
              className="hover:text-indigo-600 font-medium transition-colors max-w-[130px] sm:max-w-none truncate text-left"
              title={p.label}
            >
              {p.label}
            </button>
          ) : (
            <span
              className="font-bold text-slate-800 bg-slate-100/80 px-2 py-0.5 rounded-lg max-w-[190px] xs:max-w-[260px] sm:max-w-none truncate"
              title={p.label}
            >
              {p.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

const BATCH_TABS: { key: BatchTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'overview',      label: 'Overview',      icon: LayoutDashboard },
  { key: 'students',      label: 'Students',      icon: Users           },
  { key: 'tests',         label: 'Tests',         icon: FileText        },
  { key: 'assignments',   label: 'Assignments',   icon: BookOpen        },
  { key: 'weak-topics',   label: 'Weak Topics',   icon: Target          },
  { key: 'extra-classes', label: 'Extra Classes', icon: Calendar        },
];

// KPIs come from the parent's single performance-summary read rather than a
// per-card fetch — a teacher with nine sections was otherwise firing nine
// requests just to render this row of cards.
type BatchCardStats = { studentCount: number; avgScore: number; trend: 'up' | 'down' | 'stable' } | undefined;

function BatchCard({ name, stats, onClick }: { name: string; stats: BatchCardStats; onClick: () => void }) {
  const performance = stats;
  return (
    <button
      onClick={onClick}
      className="text-left p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/10 transition-all group min-w-0 max-w-full overflow-hidden w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[13px] text-center leading-tight px-1 flex-shrink-0">
          {name.slice(0, 3).toUpperCase()}
        </div>
      </div>
      <p className="text-[14px] font-bold text-slate-800 mb-2 truncate" title={name}>{name}</p>
      <p className="text-[12px] text-slate-500 mb-2">{performance?.studentCount ?? 0} Students</p>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] text-slate-500">Avg Score</p>
          <p className={`text-[16px] font-black leading-tight ${
            (performance?.avgScore ?? 0) >= 75 ? 'text-emerald-600' : (performance?.avgScore ?? 0) >= 65 ? 'text-amber-600' : 'text-rose-600'
          }`}>{performance?.avgScore ?? 0}%</p>
        </div>
        <div className="flex items-center gap-1">
          <TrendIcon trend={performance?.trend ?? 'stable'} />
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}

export function TeacherClasses() {
  const { teacherCtx, setTeacherCtx } = useDashboardStore();
  const { user } = useAuth();
  const { classId, subjectId, batchId, batchTab, studentId } = teacherCtx;
  const switchBatch = useSwitchBatch();

  const { data: profile, isLoading: profileLoading } = useMyTeacherProfile();
  const { data: subjectsResp } = useSubjects();
  const subjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];
  const { data: batchDetail } = useBatch(batchId);
  const { data: batchSummaries } = useBatchPerformanceSummaries();
  const statsFor = (id: string): BatchCardStats => batchSummaries?.find((b) => b.id === id);

  const assignments = useMemo(
    () => (profile?.batchAssignments ?? []).filter((a: any) => !a.removedAt),
    [profile],
  );

  const classYears = useMemo(
    () => Array.from(new Set(assignments.map((a: any) => a.batch.classYear).filter(Boolean))) as string[],
    [assignments],
  );

  const subjectName = (id: string) => subjects.find((s: any) => s.id === id)?.name ?? 'Unknown Subject';

  const tabListRef = useRef<HTMLDivElement>(null);
  const activeTabBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeTabBtnRef.current) {
      activeTabBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [batchTab]);

  const handleSelectBatch = (newBatchId: string, newSubjectId: string) => {
    switchBatch(newBatchId, classId ?? undefined);
    setTeacherCtx({ subjectId: newSubjectId, batchId: newBatchId, batchTab: 'overview', studentId: null, testId: null });
  };

  if (profileLoading) {
    return (
      <ScreenLoadingState
        title="Loading My Classes..."
        subtitle="Fetching your assigned batches, sections, and subjects..."
        layout="cards"
      />
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="p-3.5 sm:p-5 lg:p-6 animate-fadein">
        <h1 className="text-[20px] sm:text-[22px] font-bold text-slate-800 mb-1">My Classes</h1>
        <p className="text-[12.5px] sm:text-[13px] text-slate-500">You aren't assigned to any batches yet. Ask your admin to assign you to a batch.</p>
      </div>
    );
  }

  // ── Level 1: Class list ──────────────────────────────────────────────────
  if (!classId) {
    return (
      <div className="p-3.5 sm:p-5 lg:p-6 animate-fadein">
        <h1 className="text-[20px] sm:text-[22px] font-bold text-slate-800 mb-1">My Classes</h1>
        <p className="text-[12.5px] sm:text-[13px] text-slate-500 mb-6 sm:mb-8">Select a class to view your batches and students.</p>
        <div className="space-y-3 max-w-xl">
          {classYears.map(cy => {
            const batchCount = new Set(assignments.filter((a: any) => a.batch.classYear === cy).map((a: any) => a.batchId)).size;
            const subjectLabels = (Array.from(new Set(assignments.filter((a: any) => a.batch.classYear === cy).map((a: any) => a.subjectId))) as string[]).map(subjectName);
            return (
              <button
                key={cy}
                onClick={() => setTeacherCtx({ classId: cy, batchId: null, studentId: null, testId: null, batchTab: 'overview' })}
                className="w-full flex items-center justify-between p-4 sm:p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/20 transition-all text-left group"
              >
                <div>
                  <p className="text-[15px] sm:text-[16px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{cy}</p>
                  <p className="text-[11.5px] sm:text-[12px] text-slate-500 mt-0.5">{subjectLabels.join(', ')} · {batchCount} Batch{batchCount !== 1 ? 'es' : ''}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Level 2: Subject → Batch cards ──────────────────────────────────────
  if (!batchId) {
    const classAssignments = assignments.filter((a: any) => a.batch.classYear === classId);
    const subjectIds = Array.from(new Set(classAssignments.map((a: any) => a.subjectId))) as string[];

    return (
      <div className="p-3.5 sm:p-5 lg:p-6 animate-fadein">
        <Breadcrumb parts={[
          { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null }) },
          { label: classId },
        ]} />

        {subjectIds.map(sid => {
          const batchesForSubject = classAssignments.filter((a: any) => a.subjectId === sid);
          return (
            <div key={sid} className="mb-6 sm:mb-8">
              <h2 className="text-[14px] sm:text-[15px] font-bold text-slate-700 mb-3 sm:mb-4">{subjectName(sid)}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {batchesForSubject.map((a: any) => (
                  <BatchCard key={a.batchId} name={a.batch.name} stats={statsFor(a.batchId)} onClick={() => handleSelectBatch(a.batchId, sid)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const currentAssignment = assignments.find((a: any) => a.batchId === batchId);
  const batchName = currentAssignment?.batch.name ?? batchDetail?.name ?? batchId;

  // ── Student Profile (deepest level) ─────────────────────────────────────
  if (studentId) {
    return (
      <div className="p-3.5 sm:p-5 lg:p-6 animate-fadein">
        <Breadcrumb parts={[
          { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null }) },
          { label: classId, onClick: () => setTeacherCtx({ batchId: null, studentId: null }) },
          { label: batchName, onClick: () => setTeacherCtx({ studentId: null, batchTab: 'students' }) },
          { label: 'Student' },
        ]} />
        <StudentProfile studentId={studentId} />
      </div>
    );
  }

  // ── Batch detail ─────────────────────────────────────────────────────────
  const coTeachers = (batchDetail?.teachers ?? []).filter((t: any) => t.teacherProfile?.user?.email !== user?.email);

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 animate-fadein">
      <Breadcrumb parts={[
        { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null }) },
        { label: classId, onClick: () => setTeacherCtx({ batchId: null, studentId: null, testId: null }) },
        { label: `${batchName} ${subjectId ? subjectName(subjectId) : ''}` },
      ]} />

      {/* ── iOS-Style Segmented Tab Slider ────────────────────────── */}
      <div className="relative mb-5 sm:mb-6">
        <div
          ref={tabListRef}
          className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto no-scrollbar scroll-smooth touch-pan-x select-none w-full border border-slate-200/50"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {BATCH_TABS.map(tab => {
            const isActive = batchTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                ref={isActive ? (el) => { activeTabBtnRef.current = el; } : null}
                onClick={() => setTeacherCtx({ batchTab: tab.key })}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl text-[12px] sm:text-[13px] whitespace-nowrap flex-shrink-0 transition-all duration-200 active:scale-[0.97] ${
                  isActive
                    ? 'bg-white text-indigo-700 font-bold shadow-xs ring-1 ring-black/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-medium'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400'
                }`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Other Teachers in This Batch ────────────────────────────── */}
      {batchTab === 'overview' && coTeachers.length > 0 && (
        <div className="mb-5 p-3.5 sm:p-4 bg-gradient-to-r from-sky-50/80 to-indigo-50/40 border border-sky-100/90 rounded-2xl">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                <Users2 className="w-3.5 h-3.5" />
              </div>
              <p className="text-[12.5px] sm:text-[13px] font-bold text-sky-900">Other Teachers in This Batch</p>
            </div>
            <span className="text-[10.5px] sm:text-[11px] font-semibold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-full flex-shrink-0">
              {coTeachers.length} Co-teacher{coTeachers.length > 1 ? 's' : ''}
            </span>
          </div>
          <div
            className={`flex flex-col gap-2 ${
              coTeachers.length > 3
                ? 'max-h-[176px] overflow-y-auto pr-1.5 custom-scrollbar overscroll-contain touch-pan-y'
                : ''
            }`}
          >
            {coTeachers.map((t: any) => {
              const name = t.teacherProfile?.user?.name ?? 'Teacher';
              const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-2.5 bg-white border border-sky-100/90 rounded-xl px-3 py-2 shadow-2xs hover:border-sky-200 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-700 flex items-center justify-center text-[10.5px] font-black flex-shrink-0">
                    {initials || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-bold text-slate-800 truncate" title={name}>{name}</p>
                    {t.subjectId && (
                      <p className="text-[11px] text-slate-500 truncate">{subjectName(t.subjectId)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {batchTab === 'overview'      && <BatchOverview     batchId={batchId} />}
      {batchTab === 'students'      && <BatchStudents     batchId={batchId} onSelectStudent={(id) => setTeacherCtx({ studentId: id })} />}
      {batchTab === 'tests'         && <BatchTests        batchId={batchId} />}
      {batchTab === 'assignments'   && <BatchAssignments  batchId={batchId} />}
      {batchTab === 'weak-topics'   && <BatchWeakTopics   batchId={batchId} onSelectStudent={(id) => setTeacherCtx({ studentId: id, batchTab: 'students' })} />}
      {batchTab === 'extra-classes' && <BatchExtraClasses batchId={batchId} />}
    </div>
  );
}
