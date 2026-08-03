'use client';

import { useState } from 'react';
import {
  Calendar, Users, FileText, PenTool, ChevronRight, Sparkles,
  ArrowRight, CheckCircle2, Clock, BarChart2, Zap, AlertTriangle
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';

// ─── Heatmap Data ─────────────────────────────────────────────────────────────
const BATCH_COLS = ['11A', '11B', '11C', '12A', '12B'];
const HEATMAP_DATA = [
  { topic: 'Rotational Motion',   scores: { '11A': 85, '11B': 72, '11C': 60, '12A': 78, '12B': 91 } },
  { topic: 'Work, Power, Energy', scores: { '11A': 70, '11B': 80, '11C': 55, '12A': 65, '12B': 75 } },
  { topic: 'Thermodynamics',      scores: { '11A': 60, '11B': 65, '11C': 70, '12A': 82, '12B': 58 } },
  { topic: 'Modern Physics',      scores: { '11A': 75, '11B': 88, '11C': 79, '12A': 63, '12B': 70 } },
  { topic: 'Electrostatics',      scores: { '11A': 90, '11B': 77, '11C': 84, '12A': 71, '12B': 68 } },
];

function getScoreColor(val: number) {
  if (val >= 80) return 'bg-emerald-400 text-white font-bold';
  if (val >= 65) return 'bg-amber-400 text-white font-bold';
  if (val >= 50) return 'bg-orange-400 text-white font-bold';
  return 'bg-rose-500 text-white font-bold';
}

// ─── Evaluation Queue Data ───────────────────────────────────────────────────
const EVAL_QUEUE = [
  { id: 'E1', test: 'JEE Main Mock Test 07 (Physics)', batch: '11A', copies: '45 Copies', pct: 20, barColor: 'bg-rose-500',   classId: '11' },
  { id: 'E2', test: 'JEE Main Mock Test 07 (Physics)', batch: '11B', copies: '48 Copies', pct: 40, barColor: 'bg-amber-400',  classId: '11' },
  { id: 'E3', test: 'JEE Main Mock Test 07 (Physics)', batch: '12A', copies: '50 Copies', pct: 10, barColor: 'bg-emerald-400', classId: '12' },
];

// ─── AI Actions Data ─────────────────────────────────────────────────────────
const AI_ACTIONS = [
  {
    id: 'A1',
    text: '32 students are weak in Rotational Motion',
    cta: 'Create remedial class →',
    style: 'bg-rose-50 border-rose-100 text-rose-900 hover:bg-rose-100/80',
    btnStyle: 'text-rose-600 hover:text-rose-800 font-bold',
    navTo: 'remedial-extra' as const,
  },
  {
    id: 'A2',
    text: '18 students need practice in Integrals',
    cta: 'Assign practice set →',
    style: 'bg-amber-50 border-amber-100 text-amber-900 hover:bg-amber-100/80',
    btnStyle: 'text-amber-700 hover:text-amber-900 font-bold',
    navTo: 'assignments' as const,
  },
  {
    id: 'A3',
    text: 'Class test average is low',
    cta: 'Review and plan revision →',
    style: 'bg-indigo-50 border-indigo-100 text-indigo-900 hover:bg-indigo-100/80',
    btnStyle: 'text-indigo-600 hover:text-indigo-800 font-bold',
    navTo: 'classes' as const,
  },
];

// ─── Weak Topics Data ────────────────────────────────────────────────────────
const WEAK_TOPICS = [
  { topic: 'Rotational Motion', pct: 62, barColor: 'bg-rose-500'   },
  { topic: 'Integrals',         pct: 65, barColor: 'bg-amber-500'  },
  { topic: 'Thermodynamics',    pct: 68, barColor: 'bg-purple-500' },
  { topic: 'Modern Physics',    pct: 72, barColor: 'bg-cyan-500'   },
];

// ─── Schedule Data ───────────────────────────────────────────────────────────
const TODAY_SCHEDULE = [
  { time: '09:00 AM', label: '11A – Physics',          type: 'class',     badgeBg: 'bg-emerald-50 text-emerald-700', batchId: '11A', classId: '11' },
  { time: '10:00 AM', label: '11B – Physics',          type: 'class',     badgeBg: 'bg-emerald-50 text-emerald-700', batchId: '11B', classId: '11' },
  { time: '11:00 AM', label: '12A – Physics Practical',type: 'practical', badgeBg: 'bg-purple-50 text-purple-700',   batchId: '12A', classId: '12' },
  { time: '02:00 PM', label: 'Extra Class – Weak Students', type: 'extra',badgeBg: 'bg-amber-50 text-amber-700',    batchId: '11A', classId: '11' },
];

// ─── Recent Tests Data ───────────────────────────────────────────────────────
const RECENT_TESTS = [
  { name: 'JEE Main Mock Test 07', date: '3 May 2025',  avg: '76%' },
  { name: 'Physics Unit Test 05',  date: '28 Apr 2025', avg: '70%' },
  { name: 'Physics Unit Test 04',  date: '20 Apr 2025', avg: '68%' },
];

export function TeacherToday() {
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [hoverCell, setHoverCell] = useState<{ topic: string; batch: string; score: number } | null>(null);

  const goToBatch = (batchId: string, classId: string = '11') => {
    setTeacherNav('classes');
    setTeacherCtx({ classId, subjectId: 'physics', batchId, batchTab: 'overview' });
  };

  return (
    <div className="p-6 space-y-6 animate-fadein bg-slate-50/50 min-h-full">

      {/* ── Top 4 KPI Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div
          onClick={() => setTeacherNav('timetable')}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-500">Classes Today</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[28px] font-black text-slate-800 leading-none">08</p>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => setTeacherNav('classes')}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-200 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-500">Students</span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[28px] font-black text-slate-800 leading-none">256</p>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => setTeacherNav('tests-exams')}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-500">Tests Conducted</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <p className="text-[28px] font-black text-slate-800 leading-none">12</p>
        </div>

        {/* Card 4 */}
        <div
          onClick={() => setTeacherNav('evaluation-queue')}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-rose-200 transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-slate-500">Papers to Check</span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform">
                <PenTool className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[28px] font-black text-slate-800 leading-none">23</p>
          </div>
          <div className="text-right mt-2">
            <span className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 group-hover:underline">View All</span>
          </div>
        </div>
      </div>

      {/* ── Middle Row (Heatmap | Evaluation Queue | AI Action Center) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Class Performance Heatmap (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Class Performance Heatmap</h3>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr>
                    <th className="py-2 text-[11px] font-semibold text-slate-400">Topics</th>
                    {BATCH_COLS.map(b => (
                      <th key={b} className="py-2 text-center text-[11px] font-bold text-slate-500 w-11">{b}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {HEATMAP_DATA.map(row => (
                    <tr key={row.topic}>
                      <td className="py-2.5 font-medium text-slate-700 pr-2 text-[12.5px] truncate max-w-[130px]">{row.topic}</td>
                      {BATCH_COLS.map(b => {
                        const score = row.scores[b as keyof typeof row.scores];
                        return (
                          <td key={b} className="py-1 px-1 text-center">
                            <button
                              onClick={() => goToBatch(b, b.startsWith('12') ? '12' : '11')}
                              onMouseEnter={() => setHoverCell({ topic: row.topic, batch: b, score })}
                              onMouseLeave={() => setHoverCell(null)}
                              className={`w-9 h-8 rounded-lg ${getScoreColor(score)} flex items-center justify-center text-[12px] transition-transform hover:scale-110 shadow-xs mx-auto`}
                            >
                              {score}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Heatmap Legend */}
          <div className="flex items-center gap-4 mt-6 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-400 inline-block" /> ≥80</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> 65–79</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-orange-400 inline-block" /> 50–64</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500 inline-block" /> &lt;50</span>
            {hoverCell && (
              <span className="ml-auto font-bold text-indigo-600 animate-fadein">
                {hoverCell.batch}: {hoverCell.topic} ({hoverCell.score}%)
              </span>
            )}
          </div>
        </div>

        {/* Column 2: Evaluation Queue (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Evaluation Queue</h3>
              <button
                onClick={() => setTeacherNav('evaluation-queue')}
                className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View All →
              </button>
            </div>

            <div className="space-y-4">
              {EVAL_QUEUE.map(item => (
                <div
                  key={item.id}
                  onClick={() => goToBatch(item.batch, item.classId)}
                  className="p-3 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12.5px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate max-w-[200px]">
                      {item.test}
                    </p>
                    <span className="text-[12px] font-black text-slate-700">{item.pct}%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mb-2">{item.batch} – {item.copies}</p>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className={`h-1.5 rounded-full ${item.barColor} transition-all duration-500`} style={{ width: `${item.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: AI Action Center (3 Cols) */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <h3 className="text-[15px] font-bold text-slate-800">AI Action Center</h3>
            </div>

            <div className="space-y-3">
              {AI_ACTIONS.map(action => (
                <div
                  key={action.id}
                  className={`p-3.5 border rounded-xl transition-all ${action.style}`}
                >
                  <p className="text-[12.5px] font-semibold leading-snug mb-2">{action.text}</p>
                  <button
                    onClick={() => setTeacherNav(action.navTo)}
                    className={`text-[11.5px] inline-flex items-center gap-1 ${action.btnStyle}`}
                  >
                    {action.cta}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ── Bottom Row (Top Weak Topics | Today's Schedule | Recent Tests) ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Column 1: Top Weak Topics (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">Top Weak Topics</h3>
          <div className="space-y-4">
            {WEAK_TOPICS.map(wt => (
              <div
                key={wt.topic}
                onClick={() => setTeacherNav('classes')}
                className="cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                  <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{wt.topic}</span>
                  <span className="font-bold text-slate-800">{wt.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${wt.barColor} transition-all duration-500`} style={{ width: `${wt.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Today's Schedule (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Today's Schedule</h3>
              <button
                onClick={() => setTeacherNav('timetable')}
                className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View Full Timetable →
              </button>
            </div>

            <div className="space-y-3">
              {TODAY_SCHEDULE.map(slot => (
                <div
                  key={slot.time + slot.label}
                  onClick={() => goToBatch(slot.batchId, slot.classId)}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold text-indigo-600 w-16 flex-shrink-0">{slot.time}</span>
                    <span className="text-[12.5px] font-semibold text-slate-800">{slot.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${slot.badgeBg}`}>
                    {slot.type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: Recent Tests (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Recent Tests</h3>
              <button
                onClick={() => setTeacherNav('tests-exams')}
                className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {RECENT_TESTS.map(t => (
                <div
                  key={t.name}
                  onClick={() => setTeacherNav('tests-exams')}
                  className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer"
                >
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">{t.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{t.date}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-black text-slate-800">Avg {t.avg}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
