'use client';

import { useMemo } from 'react';
import { ChevronRight, TrendingUp, TrendingDown, Minus, Users2 } from 'lucide-react';
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

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
  return                       <Minus         className="w-3.5 h-3.5 text-slate-400" />;
}

function Breadcrumb({ parts }: { parts: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[12px] text-slate-500 mb-6 flex-wrap">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
          {p.onClick ? (
            <button onClick={p.onClick} className="hover:text-indigo-600 font-medium transition-colors">{p.label}</button>
          ) : (
            <span className="font-bold text-slate-800">{p.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

const BATCH_TABS: { key: BatchTab; label: string }[] = [
  { key: 'overview',      label: 'Overview'      },
  { key: 'students',      label: 'Students'      },
  { key: 'tests',         label: 'Tests'         },
  { key: 'assignments',   label: 'Assignments'   },
  { key: 'weak-topics',   label: 'Weak Topics'   },
  { key: 'extra-classes', label: 'Extra Classes' },
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
      className="text-left p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/10 transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[13px] text-center leading-tight px-1">
          {name.slice(0, 3).toUpperCase()}
        </div>
      </div>
      <p className="text-[14px] font-bold text-slate-800 mb-2 truncate">{name}</p>
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

  const handleSelectBatch = (newBatchId: string, newSubjectId: string) => {
    switchBatch(newBatchId, classId ?? undefined);
    setTeacherCtx({ subjectId: newSubjectId, batchId: newBatchId, batchTab: 'overview', studentId: null, testId: null });
  };

  if (profileLoading) {
    return <div className="p-6 text-center text-slate-400 text-[13px] animate-fadein">Loading your classes…</div>;
  }

  if (assignments.length === 0) {
    return (
      <div className="p-6 animate-fadein">
        <h1 className="text-[22px] font-bold text-slate-800 mb-1">My Classes</h1>
        <p className="text-[13px] text-slate-500">You aren't assigned to any batches yet. Ask your admin to assign you to a batch.</p>
      </div>
    );
  }

  // ── Level 1: Class list ──────────────────────────────────────────────────
  if (!classId) {
    return (
      <div className="p-6 animate-fadein">
        <h1 className="text-[22px] font-bold text-slate-800 mb-1">My Classes</h1>
        <p className="text-[13px] text-slate-500 mb-8">Select a class to view your batches and students.</p>
        <div className="space-y-3 max-w-xl">
          {classYears.map(cy => {
            const batchCount = new Set(assignments.filter((a: any) => a.batch.classYear === cy).map((a: any) => a.batchId)).size;
            const subjectLabels = (Array.from(new Set(assignments.filter((a: any) => a.batch.classYear === cy).map((a: any) => a.subjectId))) as string[]).map(subjectName);
            return (
              <button
                key={cy}
                onClick={() => setTeacherCtx({ classId: cy, batchId: null, studentId: null, testId: null, batchTab: 'overview' })}
                className="w-full flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/20 transition-all text-left group"
              >
                <div>
                  <p className="text-[16px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{cy}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">{subjectLabels.join(', ')} · {batchCount} Batch{batchCount !== 1 ? 'es' : ''}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500 transition-colors" />
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
      <div className="p-6 animate-fadein">
        <Breadcrumb parts={[
          { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null }) },
          { label: classId },
        ]} />

        {subjectIds.map(sid => {
          const batchesForSubject = classAssignments.filter((a: any) => a.subjectId === sid);
          return (
            <div key={sid} className="mb-8">
              <h2 className="text-[15px] font-bold text-slate-700 mb-4">{subjectName(sid)}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
      <div className="p-6 animate-fadein">
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
    <div className="p-6 animate-fadein">
      <Breadcrumb parts={[
        { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null }) },
        { label: classId, onClick: () => setTeacherCtx({ batchId: null, studentId: null, testId: null }) },
        { label: `${batchName} ${subjectId ? subjectName(subjectId) : ''}` },
      ]} />

      <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit mb-6 flex-wrap">
        {BATCH_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTeacherCtx({ batchTab: tab.key })}
            className={`px-4 py-2 text-[13px] font-bold rounded-xl transition-all ${
              batchTab === tab.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {coTeachers.length > 0 && (
        <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-2xl">
          <div className="flex items-center gap-2 mb-3">
            <Users2 className="w-4 h-4 text-sky-500" />
            <p className="text-[13px] font-bold text-sky-800">Other Teachers in This Batch</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {coTeachers.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2.5 bg-white border border-sky-100 rounded-xl px-3 py-2">
                <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">
                  {(t.teacherProfile?.user?.name ?? '?').split(' ').map((n: string) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-[12.5px] font-bold text-slate-800">{t.teacherProfile?.user?.name}</p>
                  {t.subjectId && <p className="text-[11px] text-slate-500">{subjectName(t.subjectId)}</p>}
                </div>
              </div>
            ))}
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
