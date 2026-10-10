'use client';

import { useState } from 'react';
import { FileText, BookOpen } from 'lucide-react';
import { TeacherTestsExams } from './TeacherTestsExams';
import { TeacherAssignments } from './TeacherAssignments';

type HubTab = 'tests-exams' | 'assignments';

const TABS = [
  { key: 'tests-exams' as HubTab, label: 'Tests & Exams' },
  { key: 'assignments' as HubTab, label: 'Take-Home Assignments' },
];

export function TeacherAssessmentsHub() {
  const [tab, setTab] = useState<HubTab>('tests-exams');

  return (
    <div className="flex flex-col min-h-full animate-fadein">
      <div className="px-4 pt-4 sm:px-8 sm:pt-8 pb-0 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[20px] sm:text-[22px] font-bold text-slate-800 tracking-tight">Assessments</h2>
              <p className="text-[12.5px] sm:text-[13px] text-slate-500 font-medium mt-0.5">Manage all student evaluations</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 mt-3.5 sm:mt-6 shrink-0">
        <div className="w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5">
          <div className="inline-flex w-full sm:w-auto p-1 bg-slate-100/90 rounded-2xl border border-slate-200/70 shadow-inner">
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-1 w-full sm:w-auto min-w-[280px] sm:min-w-0">
              {TABS.map((t) => {
                const isActive = tab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`flex items-center justify-center px-3 sm:px-5 py-2.5 sm:py-2 rounded-xl text-[12px] sm:text-[13px] font-bold transition-all duration-200 text-center select-none cursor-pointer ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 active:bg-slate-200'
                    }`}
                  >
                    <span className="truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 mt-2 pb-16 sm:pb-8">
        <div>
          {tab === 'tests-exams' && <TeacherTestsExams />}
          {tab === 'assignments' && <TeacherAssignments />}
        </div>
      </div>
    </div>
  );
}
