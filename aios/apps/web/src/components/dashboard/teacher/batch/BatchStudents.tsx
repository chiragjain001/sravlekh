'use client';

import { useState } from 'react';
import { Search, ChevronRight, Sparkles, Users, AlertTriangle, TrendingUp, Minus } from 'lucide-react';
import { useBatchPerformance } from '@/hooks/useApi';
import { ScreenLoadingState } from '@/components/ui/foundation';

interface Student {
  id: string; name: string; rollNumber: string | null;
  avgScore: number; lastTestScore: number | null; lastTestMax: number | null;
  status: string; rank: number;
}

const statusStyle = (s: string) => ({
  excellent: 'bg-emerald-100 text-emerald-700',
  average:   'bg-amber-100   text-amber-700',
  weak:      'bg-rose-100    text-rose-700',
  unscored:  'bg-slate-100   text-slate-500',
}[s] ?? 'bg-slate-100 text-slate-500');

type FilterKey = 'all' | 'ai' | 'weak' | 'average' | 'excellent';

const FILTER_CONFIG: { key: FilterKey; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  {
    key: 'all',
    label: 'All Students',
    icon: <Users className="w-3.5 h-3.5" />,
    desc: 'Complete class roster',
    color: 'bg-slate-700 text-white border-slate-700',
  },
  {
    key: 'ai',
    label: 'Needs Attention',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    desc: 'Weak, or average and slipping',
    color: 'bg-indigo-600 text-white border-indigo-600',
  },
  {
    key: 'weak',
    label: 'Weak',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    desc: 'Below 60% average',
    color: 'bg-rose-500 text-white border-rose-500',
  },
  {
    key: 'average',
    label: 'Average',
    icon: <Minus className="w-3.5 h-3.5" />,
    desc: '60–74% range',
    color: 'bg-amber-500 text-white border-amber-500',
  },
  {
    key: 'excellent',
    label: 'Excellent',
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    desc: '75%+ average',
    color: 'bg-emerald-500 text-white border-emerald-500',
  },
];

export function BatchStudents({ batchId, onSelectStudent }: {
  batchId: string;
  onSelectStudent: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterKey>('all');
  const { data: performance, isLoading } = useBatchPerformance(batchId);
  const students: Student[] = performance?.students ?? [];

  const weakCount      = students.filter(s => s.status === 'weak').length;
  const averageCount   = students.filter(s => s.status === 'average').length;
  const excellentCount = students.filter(s => s.status === 'excellent').length;
  const aiPriorityIds  = students.filter(s => s.status === 'weak' || (s.status === 'average' && s.avgScore < 65)).map(s => s.id);

  const filtered = [...students]
    .sort((a, b) => {
      const rankA = a.rank ?? 9999;
      const rankB = b.rank ?? 9999;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    })
    .filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || (s.rollNumber ?? '').includes(search);
      const matchFilter =
        filter === 'all'       ? true :
        filter === 'ai'        ? aiPriorityIds.includes(s.id) :
        filter === 'weak'      ? s.status === 'weak' :
        filter === 'average'   ? s.status === 'average' :
                                 s.status === 'excellent';
      return matchSearch && matchFilter;
    });

  if (isLoading) {
    return (
      <ScreenLoadingState
        title="Loading Students..."
        subtitle="Fetching student roster, rankings, and performance metrics..."
        layout="table"
      />
    );
  }

  const getCounts = (key: FilterKey) => ({
    all:       students.length,
    ai:        aiPriorityIds.length,
    weak:      weakCount,
    average:   averageCount,
    excellent: excellentCount,
  }[key]);

  return (
    <div className="space-y-4 sm:space-y-5 animate-fadein">

      {/* ── Filter Pills: iOS Horizontal Slider on Mobile, 5-Col Grid on Desktop ── */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth touch-pan-x pb-1 sm:pb-0 sm:grid sm:grid-cols-5 sm:gap-2.5 select-none">
        {FILTER_CONFIG.map(f => {
          const count = getCounts(f.key);
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-2 px-3 py-2 sm:py-2.5 rounded-xl border text-left transition-all flex-shrink-0 min-w-[135px] sm:min-w-0 active:scale-[0.98] ${
                isActive
                  ? f.color + ' shadow-xs ring-1 ring-black/[0.04]'
                  : 'bg-white border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span className={isActive ? 'opacity-90' : 'text-slate-400'}>{f.icon}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold leading-tight truncate">{f.label}</p>
                <p className={`text-[10px] leading-tight ${isActive ? 'opacity-85' : 'text-slate-400'}`}>{count} students</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* AI Priority Banner */}
      {filter === 'ai' && aiPriorityIds.length > 0 && (
        <div className="p-3.5 bg-indigo-50/90 border border-indigo-200/80 rounded-2xl flex items-start gap-3 shadow-2xs">
          <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-indigo-900">
              {aiPriorityIds.length} students need immediate attention
            </p>
            <p className="text-[11.5px] sm:text-[12px] text-indigo-700 mt-0.5">
              These students are consistently scoring below expectations. Consider scheduling a remedial class or assigning targeted practice sets.
            </p>
          </div>
        </div>
      )}

      {/* Search + count */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between">
        <p className="text-[12.5px] sm:text-[13px] text-slate-500">
          Showing <span className="font-bold text-slate-700">{filtered.length}</span> student{filtered.length !== 1 ? 's' : ''}
          {filter !== 'all' && <span> · <button onClick={() => setFilter('all')} className="text-indigo-600 font-semibold hover:underline">Clear filter</button></span>}
        </p>
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll..."
            className="w-full pl-9 pr-4 py-2 sm:py-2 text-[12.5px] sm:text-[13px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 transition-shadow"
          />
        </div>
      </div>

      {/* Student List Container */}
      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-2xs">
        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto no-scrollbar">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5 w-12">Rank</th>
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Student</th>
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Roll No</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Avg Score</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Status</th>
                <th className="py-3 px-5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/80">
              {filtered.map(s => (
                <tr
                  key={s.id}
                  onClick={() => onSelectStudent(s.id)}
                  className="hover:bg-indigo-50/30 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-5">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                      s.rank === 1 ? 'bg-amber-100 text-amber-700' :
                      s.rank === 2 ? 'bg-slate-200 text-slate-600' :
                      s.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                    }`}>{s.rank}</span>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${
                        s.status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                        s.status === 'weak'      ? 'bg-rose-100 text-rose-700'       :
                                                    'bg-indigo-100 text-indigo-700'
                      }`}>
                        {s.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{s.name}</span>
                        {aiPriorityIds.includes(s.id) && filter !== 'ai' && (
                          <span className="ml-2 text-[9px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Priority</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-slate-500">{s.rollNumber ?? '—'}</td>
                  <td className="py-3.5 px-3 text-center font-bold">
                    <span className={s.status === 'unscored' ? 'text-slate-500' : s.avgScore >= 75 ? 'text-emerald-600' : s.avgScore >= 60 ? 'text-amber-600' : 'text-rose-600'}>
                      {s.avgScore}%
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${statusStyle(s.status)}`}>{s.status}</span>
                  </td>
                  <td className="py-3.5 px-5">
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors mx-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Portrait iOS Native List */}
        <div className="block sm:hidden divide-y divide-slate-100">
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => onSelectStudent(s.id)}
              className="p-3.5 flex items-center justify-between gap-2.5 active:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-black flex-shrink-0 ${
                  s.rank === 1 ? 'bg-amber-100 text-amber-700' :
                  s.rank === 2 ? 'bg-slate-200 text-slate-600' :
                  s.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                }`}>{s.rank}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10.5px] font-black flex-shrink-0 ${
                  s.status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                  s.status === 'weak'      ? 'bg-rose-100 text-rose-700'       :
                                              'bg-indigo-100 text-indigo-700'
                }`}>
                  {s.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-[13px] font-bold text-slate-800 truncate">{s.name}</p>
                    {aiPriorityIds.includes(s.id) && filter !== 'ai' && (
                      <span className="text-[9px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Priority</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Roll: {s.rollNumber ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-right">
                  <p className={`text-[13.5px] font-black leading-tight ${
                    s.status === 'unscored' ? 'text-slate-500' : s.avgScore >= 75 ? 'text-emerald-600' : s.avgScore >= 60 ? 'text-amber-600' : 'text-rose-600'
                  }`}>{s.avgScore}%</p>
                  <span className={`inline-block text-[9.5px] font-bold px-1.5 py-0.5 rounded capitalize mt-0.5 ${statusStyle(s.status)}`}>
                    {s.status}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="py-12 text-center text-[13px] text-slate-400">No students match your filter.</p>
        )}
      </div>
    </div>
  );
}
