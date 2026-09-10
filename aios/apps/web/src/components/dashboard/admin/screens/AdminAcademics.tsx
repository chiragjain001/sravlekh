'use client';
// ─── AdminAcademics — Academic Operations Console ──────────────────────────────
// Real data only. The Curriculum tab (CurriculumManager) was already real from
// a prior phase. This Operations tab is rebuilt around real counts from the
// curriculum tree, batch roster, question bank, and doubt queue — no invented
// syllabus trends, exam pipelines, teacher tasks, or AI insights, since none
// of those have a real, cheaply-available backend source today.

import React, { useState } from 'react';
import { BookOpen, Layers, HelpCircle, CheckSquare, Clock, AlertTriangle } from 'lucide-react';
import { useSubjects, useBatches, useQuestions, useDoubts } from '@/hooks/useApi';
import { CurriculumManager } from './curriculum/CurriculumManager';

type AcademicsTab = 'operations' | 'curriculum';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}><Icon className="w-4.5 h-4.5" /></div>
      <div>
        <h3 className="text-xs font-medium text-gray-500">{label}</h3>
        <span className="text-xl font-bold text-gray-900">{value}</span>
      </div>
    </div>
  );
}

export function AdminAcademics() {
  const [mainTab, setMainTab] = useState<AcademicsTab>('operations');

  const { data: subjects, isPending: subjectsPending } = useSubjects();
  const { data: batchesData } = useBatches();
  const { data: pendingQuestions } = useQuestions({ isApproved: false, limit: 1 });
  const { data: approvedQuestions } = useQuestions({ isApproved: true, limit: 1 });
  const { data: openDoubts } = useDoubts({ status: 'OPEN', limit: 1 });

  const subjectTree: any[] = subjects ?? [];
  const batches: any[] = batchesData?.data ?? batchesData ?? [];
  const chapterCount = subjectTree.reduce((sum, s) => sum + (s.chapters?.length ?? 0), 0);
  const topicCount = subjectTree.reduce((sum, s) => sum + (s.chapters ?? []).reduce((c: number, ch: any) => c + (ch.topics?.length ?? 0), 0), 0);

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Academic Operations</h1>
          <p className="text-xs text-gray-500 mt-0.5">Curriculum structure, question bank, and doubt resolution — real institute data</p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
          <button onClick={() => setMainTab('operations')} className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-colors ${mainTab === 'operations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Operations</button>
          <button onClick={() => setMainTab('curriculum')} className={`px-3 py-1.5 text-[12px] font-bold rounded-lg transition-colors ${mainTab === 'curriculum' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Curriculum</button>
        </div>
      </div>

      {mainTab === 'curriculum' && <CurriculumManager />}

      <div className={mainTab === 'operations' ? 'space-y-6' : 'hidden'}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Subjects" value={subjectsPending ? '—' : subjectTree.length} icon={BookOpen} color="bg-blue-50 text-blue-600" />
          <StatCard label="Chapters" value={subjectsPending ? '—' : chapterCount} icon={Layers} color="bg-indigo-50 text-indigo-600" />
          <StatCard label="Topics" value={subjectsPending ? '—' : topicCount} icon={Layers} color="bg-purple-50 text-purple-600" />
          <StatCard label="Batches" value={batches.length} icon={CheckSquare} color="bg-emerald-50 text-emerald-600" />
          <StatCard label="Questions Pending Approval" value={pendingQuestions?.meta?.total ?? '—'} icon={Clock} color="bg-amber-50 text-amber-600" />
          <StatCard label="Open Doubts" value={openDoubts?.meta?.total ?? '—'} icon={HelpCircle} color="bg-rose-50 text-rose-600" />
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-blue-500" /> Curriculum Coverage by Subject</h2>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full">{approvedQuestions?.meta?.total ?? 0} approved question(s)</span>
          </div>

          {subjectsPending ? (
            <div className="space-y-3 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}</div>
          ) : subjectTree.length === 0 ? (
            <div className="text-center py-10">
              <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No subjects created yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add subjects under the Curriculum tab to see coverage here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjectTree.map((s: any) => {
                const chapters = s.chapters ?? [];
                const topics = chapters.reduce((c: number, ch: any) => c + (ch.topics?.length ?? 0), 0);
                return (
                  <div key={s.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-900">{s.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{chapters.length} chapter{chapters.length === 1 ? '' : 's'} · {topics} topic{topics === 1 ? '' : 's'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
