'use client';

import { useState } from 'react';
import { Search, Eye, Plus, BookOpen } from 'lucide-react';
import { questions, getQuestionsByChapter } from '@/lib/mock-data/teacher';

const CHAPTERS  = ['Rotational Motion', 'Work, Power, Energy', 'Thermodynamics', 'Modern Physics', 'Electrostatics'];
const DIFFS     = ['All', 'easy', 'medium', 'hard'] as const;
const TYPES     = ['All', 'mcq', 'numerical'] as const;

type Diff = typeof DIFFS[number];
type QType = typeof TYPES[number];

export function TeacherQuestionBank() {
  const [chapter, setChapter] = useState('');
  const [diff,    setDiff]    = useState<Diff>('All');
  const [qtype,   setQtype]   = useState<QType>('All');
  const [search,  setSearch]  = useState('');

  const filtered = (chapter ? getQuestionsByChapter('physics', chapter) : [])
    .filter(q =>
      (diff  === 'All' || q.difficulty === diff)  &&
      (qtype === 'All' || q.type       === qtype) &&
      (search === '' || q.topic.toLowerCase().includes(search.toLowerCase()) || q.id.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <div className="p-6 animate-fadein space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Question Bank</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Browse and manage questions by chapter and topic. Select a chapter to begin.</p>
      </div>

      {/* Chapter selector — mandatory first step */}
      <div>
        <p className="text-[12px] font-bold text-slate-600 mb-3">Select Chapter *</p>
        <div className="flex flex-wrap gap-2">
          {CHAPTERS.map(ch => (
            <button key={ch} onClick={() => setChapter(ch === chapter ? '' : ch)}
              className={`px-4 py-2 rounded-xl text-[12.5px] font-bold border transition-all ${
                chapter === ch ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
              }`}>{ch}</button>
          ))}
        </div>
      </div>

      {/* Empty state — no chapter selected */}
      {!chapter && (
        <div className="py-20 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-[14px] font-semibold text-slate-500">Select a chapter to browse questions</p>
          <p className="text-[12px] mt-1">Questions are organised by Physics chapters.</p>
        </div>
      )}

      {/* Filters — only show after chapter selected */}
      {chapter && (
        <>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {DIFFS.map(d => (
                  <button key={d} onClick={() => setDiff(d)}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-lg capitalize transition-all ${
                      diff === d ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>{d}</button>
                ))}
              </div>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                {TYPES.map(t => (
                  <button key={t} onClick={() => setQtype(t)}
                    className={`px-3 py-1.5 text-[12px] font-bold rounded-lg uppercase transition-all ${
                      qtype === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search topic..."
                  className="pl-9 pr-4 py-2 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30 w-44" />
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>
          </div>

          <div className="card border border-slate-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">ID</th>
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Topic</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Type</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Difficulty</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden md:table-cell">Marks</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden md:table-cell">Used</th>
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden lg:table-cell">Source</th>
                  <th className="py-3 px-5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(q => (
                  <tr key={q.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-5 font-bold text-slate-700">{q.id}</td>
                    <td className="py-3.5 px-3">
                      <p className="font-semibold text-slate-800">{q.topic}</p>
                      <p className="text-[11px] text-slate-500">{q.chapter}</p>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        q.type === 'mcq' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                      }`}>{q.type}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                        q.difficulty === 'hard'   ? 'bg-rose-100 text-rose-700'     :
                        q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700'   :
                                                    'bg-emerald-100 text-emerald-700'
                      }`}>{q.difficulty}</span>
                    </td>
                    <td className="py-3.5 px-3 text-center text-slate-600 hidden md:table-cell">{q.marks}</td>
                    <td className="py-3.5 px-3 text-center text-slate-500 hidden md:table-cell">{q.usedCount}×</td>
                    <td className="py-3.5 px-3 text-slate-500 hidden lg:table-cell text-[12px]">{q.source}</td>
                    <td className="py-3.5 px-5">
                      <button className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <p className="text-[13px]">No questions match your filters for <strong>{chapter}</strong>.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
