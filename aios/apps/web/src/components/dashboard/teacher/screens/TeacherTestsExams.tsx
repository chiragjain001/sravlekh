'use client';

import { useState } from 'react';
import { ClipboardList, Plus, Search, Calendar, ChevronRight } from 'lucide-react';
import { tests, batches } from '@/lib/mock-data/teacher';
import { useDashboardStore } from '@/store/dashboard-store';

export function TeacherTestsExams() {
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [searchTerm, setSearchTerm] = useState('');

  // enrich tests with batch info
  const enrichedTests = tests.map(t => ({
    ...t,
    batchLabel: batches.find(b => b.id === t.batchId)?.label || t.batchId
  })).filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleTestClick = (batchId: string, testId: string) => {
    setTeacherCtx({ batchId, testId, batchTab: 'tests' });
    setTeacherNav('classes');
  };

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Tests & Exams</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage all scheduled, active, and completed tests across your batches.</p>
        </div>
        <button
          onClick={() => setTeacherNav('paper-builder')}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Schedule New Test
        </button>
      </div>

      <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Search by test name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 text-[13px] outline-none placeholder:text-slate-400 bg-transparent"
        />
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-5 font-bold text-[11px] text-slate-500 uppercase tracking-wider">Test Name</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider">Batch</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider hidden sm:table-cell">Date</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-center hidden md:table-cell">Avg Score</th>
              <th className="py-3 px-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {enrichedTests.map(t => (
              <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-slate-800">{t.name}</span>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-slate-600">{t.batchLabel}</td>
                <td className="py-4 px-4 text-slate-500 hidden sm:table-cell">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {t.date}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    t.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    t.status === 'grading'   ? 'bg-amber-100 text-amber-700'     :
                    t.status === 'scheduled' ? 'bg-sky-100 text-sky-700'         :
                                               'bg-slate-100 text-slate-600'
                  }`}>
                    {t.status}
                  </span>
                </td>
                <td className="py-4 px-4 text-center hidden md:table-cell">
                  {t.avgScore > 0 ? <span className="font-bold text-slate-700">{t.avgScore}%</span> : <span className="text-slate-400">—</span>}
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={() => handleTestClick(t.batchId, t.id)}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {enrichedTests.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-[13px]">
                  No tests found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
