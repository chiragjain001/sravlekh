'use client';

import { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';

interface Student {
  id: string; name: string; rollNo: string;
  avgScore: number; lastTestScore: number; lastTestMax: number;
  status: string; rank: number;
}

const statusStyle = (s: string) => ({
  excellent: 'bg-emerald-100 text-emerald-700',
  good:      'bg-sky-100     text-sky-700',
  average:   'bg-amber-100   text-amber-700',
  weak:      'bg-rose-100    text-rose-700',
}[s] ?? 'bg-slate-100 text-slate-500');

export function BatchStudents({ students, onSelectStudent }: {
  students: Student[];
  onSelectStudent: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'weak' | 'excellent'>('all');

  const filtered = students.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.rollNo.includes(search);
    const matchFilter =
      filter === 'all'       ? true :
      filter === 'weak'      ? (s.status === 'weak' || s.status === 'average') :
                               s.status === 'excellent';
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {(['all', 'weak', 'excellent'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 text-[12px] font-bold rounded-xl capitalize transition-all ${
                filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{f === 'all' ? `All (${students.length})` : f === 'weak' ? `Need Help (${students.filter(s=>s.status==='weak'||s.status==='average').length})` : `Excellent (${students.filter(s=>s.status==='excellent').length})`}</button>
          ))}
        </div>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or roll..."
            className="pl-9 pr-4 py-2 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 w-52" />
        </div>
      </div>

      <div className="card border border-slate-100 rounded-2xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5 w-10">Rank</th>
              <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Student</th>
              <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden sm:table-cell">Roll No</th>
              <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Avg Score</th>
              <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden md:table-cell">Last Test</th>
              <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Status</th>
              <th className="py-3 px-5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(s => (
              <tr key={s.id} onClick={() => onSelectStudent(s.id)}
                className="hover:bg-indigo-50/30 cursor-pointer transition-colors">
                <td className="py-3.5 px-5">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${
                    s.rank === 1 ? 'bg-amber-100 text-amber-700' :
                    s.rank === 2 ? 'bg-slate-200 text-slate-600' :
                    s.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                  }`}>{s.rank}</span>
                </td>
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">
                      {s.name.split(' ').map(n=>n[0]).join('')}
                    </div>
                    <span className="font-semibold text-slate-800">{s.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-3 text-slate-500 hidden sm:table-cell">{s.rollNo}</td>
                <td className="py-3.5 px-3 text-center font-bold">
                  <span className={s.avgScore>=75?'text-emerald-600':s.avgScore>=60?'text-amber-600':'text-rose-600'}>{s.avgScore}%</span>
                </td>
                <td className="py-3.5 px-3 text-center text-slate-600 hidden md:table-cell">
                  {s.lastTestScore}/{s.lastTestMax}
                </td>
                <td className="py-3.5 px-3 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${statusStyle(s.status)}`}>{s.status}</span>
                </td>
                <td className="py-3.5 px-5">
                  <ChevronRight className="w-4 h-4 text-slate-300 mx-auto" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="py-10 text-center text-[13px] text-slate-400">No students match your filter.</p>
        )}
      </div>
    </div>
  );
}
