'use client';

import { useMemo, useState, useEffect } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { useMyStudentProfile } from '@/hooks/useApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ScoreRecord {
  id: string;
  percentage: number;
  rank: number | null;
  createdAt: string;
  exam?: { title: string } | null;
}
interface MasteryScore { masteryValue: number; subject: { name: string } }

export function StudentProgress() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: profile, isPending } = useMyStudentProfile();
  const scoreRecords: ScoreRecord[] = useMemo(() => profile?.scoreRecords ?? [], [profile]);
  const masteryScores: MasteryScore[] = useMemo(() => profile?.masteryScores ?? [], [profile]);

  const scoreTrend = useMemo(
    () => [...scoreRecords].reverse().map((r) => ({ test: r.exam?.title ?? 'Exam', score: Math.round(r.percentage) })),
    [scoreRecords],
  );

  const subjectMastery = useMemo(() => {
    const bySubject = new Map<string, { total: number; count: number }>();
    for (const s of masteryScores) {
      const e = bySubject.get(s.subject.name) ?? { total: 0, count: 0 };
      e.total += s.masteryValue * 100;
      e.count += 1;
      bySubject.set(s.subject.name, e);
    }
    return Array.from(bySubject.entries()).map(([subject, { total, count }]) => ({ subject, score: Math.round(total / count) }));
  }, [masteryScores]);

  const summary = useMemo(() => {
    if (scoreRecords.length === 0) return null;
    const avg = scoreRecords.reduce((s, r) => s + r.percentage, 0) / scoreRecords.length;
    const highest = Math.max(...scoreRecords.map((r) => r.percentage));
    const latestRank = scoreRecords[0]?.rank ?? null;
    return { testsAttempted: scoreRecords.length, averageScore: Math.round(avg), highestScore: Math.round(highest), latestRank };
  }, [scoreRecords]);

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col">

        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Progress</h2>
              <p className="text-[12px] text-slate-500">Your real score history and subject mastery.</p>
            </div>
          </div>
        </div>

        {isPending ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Loading your progress…</div>
        ) : scoreRecords.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
            <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-[14px] font-medium text-slate-500">No graded exams yet — your score trend appears here once results come in.</p>
          </div>
        ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 flex-1 mb-8">
          {/* Left: Line Chart */}
          <div className="flex flex-col h-full min-h-[300px]">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6">Score Trend</h3>
            <div className="flex-1 w-full relative">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scoreTrend} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="test" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(val) => `${val}%`} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }} />
                    <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right: Subject mastery (real, from MasteryScore) */}
          <div className="flex flex-col justify-center h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6">Subject Mastery</h3>
            <div className="space-y-6">
              {subjectMastery.length === 0 ? (
                <p className="text-[13px] text-slate-400">No mastery data yet.</p>
              ) : subjectMastery.map((s) => (
                <div key={s.subject}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-bold text-slate-700">{s.subject}</span>
                    <span className="text-[16px] font-black text-slate-800 min-w-[3ch] text-right">{s.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[6px]">
                    <div className="h-[6px] rounded-full bg-indigo-500 transition-all duration-1000" style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Stats — all real */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-slate-100 pt-6 mt-auto">
            <div className="p-4">
              <p className="text-[12px] font-bold text-slate-400 mb-1">Tests Attempted</p>
              <p className="text-[28px] font-black text-indigo-600">{summary.testsAttempted}</p>
            </div>
            <div className="p-4 border-l border-slate-100">
              <p className="text-[12px] font-bold text-slate-400 mb-1">Average Score</p>
              <p className="text-[28px] font-black text-slate-800 leading-none">{summary.averageScore}%</p>
            </div>
            <div className="p-4 border-l border-slate-100">
              <p className="text-[12px] font-bold text-slate-400 mb-1">Highest Score</p>
              <p className="text-[28px] font-black text-slate-800">{summary.highestScore}%</p>
            </div>
            {summary.latestRank != null && (
              <div className="p-4 border-l border-slate-100 col-span-2 md:col-span-1">
                <p className="text-[12px] font-bold text-slate-400 mb-1">Latest Rank</p>
                <span className="text-[28px] font-black text-emerald-500 leading-none flex items-center gap-1">
                  <TrendingUp className="w-6 h-6" /> #{summary.latestRank}
                </span>
              </div>
            )}
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
