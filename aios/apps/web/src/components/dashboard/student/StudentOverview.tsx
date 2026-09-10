'use client';

import { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, Clock, FileText } from 'lucide-react';
import { useMyStudentProfile, useExams, useAssignments, useTimetable } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';

/** Mastery at or above this is not a weakness — matches levelFor()'s "Low"
 *  priority band in StudentWeakTopics.tsx. */
const WEAK_MASTERY_THRESHOLD = 0.7;

function OverallDonut({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const data = [
    { value: score, fill: '#6366f1' },
    { value: 100 - score, fill: '#f1f5f9' },
  ];
  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      {mounted && (
        <PieChart width={144} height={144}>
          <Pie data={data} cx={68} cy={68} innerRadius={48} outerRadius={66} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center -ml-2 -mt-2">
        <span className="text-[22px] font-bold text-slate-800">{score}%</span>
        <span className="text-[10px] text-slate-500">Overall Score</span>
      </div>
    </div>
  );
}

function ProgressChart({ data }: { data: { test: string; score: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-full h-[140px]" />;
  if (data.length === 0) return <div className="w-full h-[140px] flex items-center justify-center text-[12px] text-slate-400">No graded tests yet.</div>;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="test" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StudentOverview() {
  const { setStudentActiveNav } = useDashboardStore();
  const { data: profile } = useMyStudentProfile();
  const { data: examsResp } = useExams();
  const { data: assignmentsResp } = useAssignments({ status: 'PENDING' });
  const { data: timetableResp } = useTimetable();

  const scoreRecords: any[] = useMemo(() => profile?.scoreRecords ?? [], [profile]);
  const masteryScores: any[] = useMemo(() => profile?.masteryScores ?? [], [profile]);
  const exams: any[] = useMemo(() => examsResp?.data ?? [], [examsResp]);
  const pendingAssignments: any[] = useMemo(() => assignmentsResp?.data ?? [], [assignmentsResp]);
  const slots: any[] = useMemo(() => timetableResp?.data ?? [], [timetableResp]);

  const overallScore = scoreRecords.length > 0 ? Math.round(scoreRecords.reduce((s, r) => s + r.percentage, 0) / scoreRecords.length) : 0;

  const subjectScores = useMemo(() => {
    const bySubject = new Map<string, { total: number; count: number }>();
    for (const s of masteryScores) {
      const e = bySubject.get(s.subject.name) ?? { total: 0, count: 0 };
      e.total += s.masteryValue * 100;
      e.count += 1;
      bySubject.set(s.subject.name, e);
    }
    return Array.from(bySubject.entries()).map(([subject, { total, count }]) => ({ subject, score: Math.round(total / count) })).slice(0, 4);
  }, [masteryScores]);

  // Filtered, not just sorted: taking the bottom 4 unconditionally meant a
  // student strong in every topic still saw four entries under "Weak Topics",
  // each with a red alert icon — their *best* topics, labelled as problems.
  // 0.7 is this screen family's existing cutoff, not a new number: levelFor()
  // in StudentWeakTopics.tsx already treats >= 70% as "Low" priority.
  const weakTopics = useMemo(
    () => masteryScores.filter((s) => s.masteryValue < WEAK_MASTERY_THRESHOLD)
      .sort((a, b) => a.masteryValue - b.masteryValue)
      .slice(0, 4),
    [masteryScores],
  );

  const nextTest = useMemo(() => {
    const upcoming = exams.filter((e) => e.scheduledDate && new Date(e.scheduledDate).getTime() >= Date.now())
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    return upcoming[0] ?? null;
  }, [exams]);
  const countdown = useMemo(() => {
    if (!nextTest?.scheduledDate) return null;
    const diff = Math.max(0, new Date(nextTest.scheduledDate).getTime() - Date.now());
    return {
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff / 3600000) % 24),
      mins: Math.floor((diff / 60000) % 60),
    };
  }, [nextTest]);

  const todaySlots = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return slots.filter((s) => new Date(s.startTime) >= today && new Date(s.startTime) < tomorrow).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [slots]);

  const upcomingAssignments = useMemo(
    () => [...pendingAssignments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 4),
    [pendingAssignments],
  );

  const recentTests = scoreRecords.slice(0, 4);
  const scoreTrend = [...scoreRecords].reverse().map((r) => ({ test: r.exam?.title ?? 'Exam', score: Math.round(r.percentage) }));

  return (
    <div className="p-5 space-y-5 animate-fadein">
      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <p className="section-title">Overall Performance</p>
          {scoreRecords.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-8 text-center">No graded exams yet.</p>
          ) : (
            <div className="flex items-center gap-5">
              <OverallDonut score={overallScore} />
              <div className="flex-1 space-y-2.5">
                {subjectScores.map((s) => (
                  <div key={s.subject}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-slate-600">{s.subject}</span>
                      <span className="font-semibold text-slate-800">{s.score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-indigo-500 transition-all" style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Weak Topics</p>
            <button onClick={() => setStudentActiveNav('Weak Topics')} className="view-all-link">View All Weak Topics →</button>
          </div>
          <div className="space-y-2">
            {weakTopics.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">
                {masteryScores.length === 0
                  ? 'No mastery data yet.'
                  : 'No weak topics — you’re above 70% everywhere.'}
              </p>
            ) : weakTopics.map((t) => {
              const pct = Math.round(t.masteryValue * 100);
              return (
                <div key={t.id} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    <span className="text-[12.5px] text-slate-700">{t.topic?.name ?? 'Unknown Topic'}</span>
                  </div>
                  <span className={`chip ${pct < 40 ? 'chip-high' : 'chip-medium'}`}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-0">
          <p className="text-[12px] font-semibold text-indigo-200 mb-1">Next Test</p>
          {nextTest ? (
            <>
              <p className="text-[15px] font-bold mb-1">{nextTest.title}</p>
              <p className="text-[11.5px] text-indigo-200 mb-4">{new Date(nextTest.scheduledDate).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
              {countdown && (
                <div className="flex gap-3 mb-5">
                  {[{ val: countdown.days, label: 'Days' }, { val: countdown.hours, label: 'Hrs' }, { val: countdown.mins, label: 'Mins' }].map((c) => (
                    <div key={c.label} className="text-center">
                      <div className="bg-white/20 rounded-lg px-3 py-2 min-w-[44px]">
                        <span className="text-[20px] font-bold leading-none">{String(c.val).padStart(2, '0')}</span>
                      </div>
                      <p className="text-[10px] text-indigo-300 mt-1">{c.label}</p>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setStudentActiveNav('My Tests')} className="w-full bg-white text-indigo-700 font-semibold text-[13px] py-2 rounded-lg hover:bg-indigo-50 transition-colors">
                View Test Details
              </button>
            </>
          ) : (
            <p className="text-[13px] text-indigo-200 py-6">No upcoming test scheduled.</p>
          )}
        </div>
      </div>

      {/* Row 2 — today's real schedule + real pending assignments */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <p className="section-title">Today&apos;s Schedule</p>
          {todaySlots.length === 0 ? (
            <p className="text-[12px] text-slate-400 py-6 text-center">No classes scheduled for today.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {todaySlots.slice(0, 3).map((s) => (
                <div key={s.id} className="border border-slate-100 rounded-xl p-3.5">
                  <p className="text-[10.5px] text-slate-500 uppercase tracking-wide font-semibold mb-1">{s.type.replace('_', ' ')}</p>
                  <p className="text-[13px] font-semibold text-slate-800 mb-0.5">{s.title}</p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(s.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Assignments Due</p>
            <button onClick={() => setStudentActiveNav('Assignments')} className="text-[11px] text-indigo-500 font-semibold">All →</button>
          </div>
          <div className="space-y-2">
            {upcomingAssignments.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">Nothing due — you&apos;re all caught up.</p>
            ) : upcomingAssignments.map((a) => (
              <div key={a.id} className="flex items-start gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
                <FileText className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-slate-700 truncate">{a.title}</p>
                  <p className="text-[10.5px] text-slate-400">Due {new Date(a.dueDate).toLocaleDateString([], { day: 'numeric', month: 'short' })}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Recent Tests</p>
            <button onClick={() => setStudentActiveNav('My Tests')} className="view-all-link">View All</button>
          </div>
          <div className="space-y-2">
            {recentTests.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-4 text-center">No graded tests yet.</p>
            ) : recentTests.map((t) => {
              const pct = Math.round(t.percentage);
              return (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}>
                      {pct}
                    </div>
                    <div>
                      <p className="text-[12.5px] font-medium text-slate-700">{t.exam?.title ?? 'Exam'}</p>
                      <p className="text-[11px] text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <span className={`text-[13px] font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card">
          <p className="section-title mb-3">Progress Over Time</p>
          <ProgressChart data={scoreTrend} />
        </div>
      </div>
    </div>
  );
}
