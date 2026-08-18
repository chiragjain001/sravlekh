'use client';

import { ChevronRight, TrendingUp, TrendingDown, Minus, AlertCircle, Users2 } from 'lucide-react';
import {
  teacherProfile, classes, subjects,
  getBatchesByClassSubject, getTestsByBatch, getAssignmentsByBatch,
  getExtraClassesByBatch, getStudentsByBatch,
  aiBriefings, batchWeakTopics, topicWeakStudents,
  evaluations, testQuestionAnalysis, students,
  studentTopicMastery, studentTestHistory, doubts,
  extraClasses, assignments, tests,
  getCoTeachersByBatch,
} from '@/lib/mock-data/teacher';
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

// ─── Trend icon ──────────────────────────────────────────────────────────────
function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'up')   return <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
  return                       <Minus         className="w-3.5 h-3.5 text-slate-400" />;
}

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
function Breadcrumb({ parts, onNavigate }: { parts: { label: string; onClick?: () => void }[]; onNavigate?: () => void }) {
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

// ─── BATCH_TABS ───────────────────────────────────────────────────────────────
const BATCH_TABS: { key: BatchTab; label: string }[] = [
  { key: 'overview',      label: 'Overview'      },
  { key: 'students',      label: 'Students'      },
  { key: 'tests',         label: 'Tests'         },
  { key: 'assignments',   label: 'Assignments'   },
  { key: 'weak-topics',   label: 'Weak Topics'   },
  { key: 'extra-classes', label: 'Extra Classes' },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────
export function TeacherClasses() {
  const { teacherCtx, setTeacherCtx } = useDashboardStore();
  const { classId, subjectId, batchId, batchTab, studentId } = teacherCtx;
  const switchBatch = useSwitchBatch();

  // When teacher selects a batch, set the AcademicContext (clears stale cache + emits event)
  const handleSelectBatch = (newBatchId: string, newSubjectId: string) => {
    switchBatch(newBatchId, classId ?? undefined);
    setTeacherCtx({
      subjectId: newSubjectId,
      batchId: newBatchId,
      batchTab: 'overview',
      studentId: null,
      testId: null,
    });
  };

  // Assigned classes filtered to this teacher
  const myClasses = classes.filter(c =>
    teacherProfile.assignments.some(a => a.classId === c.id)
  );
  const mySubjects = subjects.filter(s =>
    teacherProfile.assignments.some(a => a.subjectId === s.id)
  );

  // ── Level 1: Class list ──────────────────────────────────────────────────
  if (!classId) {
    return (
      <div className="p-6 animate-fadein">
        <h1 className="text-[22px] font-bold text-slate-800 mb-1">My Classes</h1>
        <p className="text-[13px] text-slate-500 mb-8">Select a class to view your batches and students.</p>
        <div className="space-y-3 max-w-xl">
          {myClasses.map(cls => {
            const batchCount = getBatchesByClassSubject(cls.id, 'physics').length;
            return (
              <button
                key={cls.id}
                onClick={() => setTeacherCtx({ classId: cls.id, batchId: null, studentId: null, testId: null, batchTab: 'overview' })}
                className="w-full flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/20 transition-all text-left group"
              >
                <div>
                  <p className="text-[16px] font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{cls.label}</p>
                  <p className="text-[12px] text-slate-500 mt-0.5">
                    {mySubjects.map(s => s.label).join(', ')} · {batchCount} Batches
                  </p>
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
    const selectedClass = classes.find(c => c.id === classId);
    return (
      <div className="p-6 animate-fadein">
        <Breadcrumb parts={[
          { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null }) },
          { label: selectedClass?.label ?? classId },
        ]} />

        {mySubjects.map(sub => {
          const batchList = getBatchesByClassSubject(classId, sub.id);
          return (
            <div key={sub.id} className="mb-8">
              <h2 className="text-[15px] font-bold text-slate-700 mb-4">{sub.label}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {batchList.map(b => (
                  <button
                    key={b.id}
                    onClick={() => handleSelectBatch(b.id, sub.id)}
                    className="text-left p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md hover:bg-indigo-50/10 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-[15px]">
                        {b.label}
                      </div>
                      {b.pendingActions > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> {b.pendingActions} actions
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-bold text-slate-800 mb-2">{b.strength} Students</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-slate-500">Avg Score</p>
                        <p className={`text-[16px] font-black leading-tight ${
                          b.avgScore >= 75 ? 'text-emerald-600' : b.avgScore >= 65 ? 'text-amber-600' : 'text-rose-600'
                        }`}>{b.avgScore}%</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendIcon trend={b.trend} />
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const batch  = getBatchesByClassSubject(classId, subjectId ?? 'physics').find(b => b.id === batchId);
  const cls    = classes.find(c => c.id === classId);
  const sub    = subjects.find(s => s.id === (subjectId ?? 'physics'));

  // ── Student Profile (deepest level) ─────────────────────────────────────
  if (studentId) {
    const student = students.find(s => s.id === studentId);
    const mastery = studentTopicMastery[studentId as keyof typeof studentTopicMastery] ?? [];
    const history = studentTestHistory[studentId as keyof typeof studentTestHistory] ?? [];
    const stdDoubts = doubts.filter(d => d.studentId === studentId);
    return (
      <div className="p-6 animate-fadein">
        <Breadcrumb parts={[
          { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null }) },
          { label: cls?.label ?? classId, onClick: () => setTeacherCtx({ batchId: null, studentId: null }) },
          { label: batch?.label ?? batchId, onClick: () => setTeacherCtx({ studentId: null, batchTab: 'students' }) },
          { label: student?.name ?? studentId },
        ]} />
        <StudentProfile
          student={student!}
          topicMastery={mastery}
          testHistory={history}
          doubts={stdDoubts}
        />
      </div>
    );
  }

  // ── Batch detail ─────────────────────────────────────────────────────────
  const batchStudents    = getStudentsByBatch(batchId);
  const batchTests       = getTestsByBatch(batchId);
  const batchAssignments = getAssignmentsByBatch(batchId);
  const batchExtra       = getExtraClassesByBatch(batchId);
  const batchWeak        = batchWeakTopics[batchId as keyof typeof batchWeakTopics] ?? [];
  const batchBriefing    = aiBriefings[batchId as keyof typeof aiBriefings];

  return (
    <div className="p-6 animate-fadein">
      <Breadcrumb parts={[
        { label: 'My Classes', onClick: () => setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null }) },
        { label: cls?.label ?? classId, onClick: () => setTeacherCtx({ batchId: null, studentId: null, testId: null }) },
        { label: `${batch?.label ?? batchId} ${sub?.label ?? ''}` },
      ]} />

      {/* Batch Tabs */}
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

      {/* Co-Teacher Awareness Panel */}
      {(() => {
        const coTeachers = getCoTeachersByBatch(batchId);
        return coTeachers.length > 0 ? (
          <div className="mb-4 p-4 bg-sky-50 border border-sky-200 rounded-2xl">
            <div className="flex items-center gap-2 mb-3">
              <Users2 className="w-4 h-4 text-sky-500" />
              <p className="text-[13px] font-bold text-sky-800">Other Teachers in This Batch</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {coTeachers.map(ct => (
                <div key={ct.id} className="flex items-center gap-2.5 bg-white border border-sky-100 rounded-xl px-3 py-2">
                  <div className="w-7 h-7 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] font-black">{ct.initials}</div>
                  <div>
                    <p className="text-[12.5px] font-bold text-slate-800">{ct.name}</p>
                    <p className="text-[11px] text-slate-500">{ct.subject} · Last taught {ct.lastTaught} · {ct.topicsCovered} topics</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null;
      })()}

      {/* Tab Content */}
      {batchTab === 'overview'      && <BatchOverview     batch={batch!} briefing={batchBriefing} students={batchStudents} tests={batchTests} />}
      {batchTab === 'students'      && <BatchStudents     students={batchStudents} onSelectStudent={(id) => setTeacherCtx({ studentId: id })} />}
      {batchTab === 'tests'         && <BatchTests        tests={batchTests} evaluations={evaluations} questionAnalysis={testQuestionAnalysis} batchId={batchId ?? undefined} />}
      {batchTab === 'assignments'   && <BatchAssignments  assignments={batchAssignments} batchStrength={batch?.strength ?? 0} batchId={batchId} />}
      {batchTab === 'weak-topics'   && <BatchWeakTopics   weakTopics={batchWeak} topicWeakStudents={topicWeakStudents} onSelectStudent={(id) => setTeacherCtx({ studentId: id, batchTab: 'students' })} />}
      {batchTab === 'extra-classes' && <BatchExtraClasses sessions={batchExtra} />}
    </div>
  );
}
