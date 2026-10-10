'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertCircle,
  Clock,
  FileText,
  Calendar,
  MapPin,
  Radio,
  CheckCircle2,
  BookOpen,
  TrendingUp,
  Filter,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useMyStudentProfile, useExams, useAssignments, useTimetable } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { isStudentClassSubject, DEFAULT_STUDENT_ENROLLED_SUBJECTS } from '@/lib/student-subjects';
import { MarqueeText } from '@/components/ui/MarqueeText';

/** Mastery at or above this is not a weakness — matches levelFor()'s "Low"
 *  priority band in StudentWeakTopics.tsx. */
const WEAK_MASTERY_THRESHOLD = 0.7;

function useCurrentTime(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function OverallDonut({ score, label = 'Overall Score' }: { score: number; label?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const safeScore = Math.min(100, Math.max(0, Math.round(score)));
  const data = [
    { value: safeScore, fill: safeScore >= 75 ? '#10b981' : safeScore >= 50 ? '#6366f1' : '#f43f5e' },
    { value: 100 - safeScore, fill: '#f1f5f9' },
  ];

  return (
    <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
      {mounted && (
        <PieChart width={128} height={128}>
          <Pie
            data={data}
            cx={64}
            cy={64}
            innerRadius={44}
            outerRadius={60}
            startAngle={90}
            endAngle={-270}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[22px] font-black text-slate-800 tracking-tight leading-none">{safeScore}%</span>
        <span className="text-[10px] text-slate-400 font-medium mt-1 truncate max-w-[90px] text-center px-1">
          {label}
        </span>
      </div>
    </div>
  );
}

function ProgressChart({ data }: { data: { test: string; score: number }[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="w-full h-[180px]" />;
  if (data.length === 0) {
    return (
      <div className="w-full h-[180px] flex flex-col items-center justify-center text-slate-400 text-center py-6">
        <TrendingUp className="w-8 h-8 opacity-40 mb-2" />
        <p className="text-[12px] font-medium text-slate-500">No test data available yet.</p>
        <p className="text-[10.5px] text-slate-400 mt-0.5">Your progress curve will develop as you take tests.</p>
      </div>
    );
  }

  const avg = Math.round(data.reduce((sum, d) => sum + d.score, 0) / data.length);
  const latest = data[data.length - 1]?.score ?? 0;
  const chartData = data.slice(-8);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50/80 px-3 py-1.5 rounded-lg border border-slate-100">
        <span>Average: <strong className="text-slate-800 font-bold">{avg}%</strong></span>
        <span>Latest: <strong className="text-indigo-600 font-bold">{latest}%</strong></span>
      </div>
      <ResponsiveContainer width="100%" height={155}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -24, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="test"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickFormatter={(val: string) => (val.length > 12 ? `${val.slice(0, 10)}…` : val)}
          />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            }}
            formatter={(value: any) => [`${value}%`, 'Score']}
            labelFormatter={(label) => `Test: ${label}`}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#6366f1"
            strokeWidth={2.5}
            dot={{ fill: '#6366f1', r: 4, strokeWidth: 2, stroke: '#ffffff' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StudentOverview() {
  const now = useCurrentTime(30_000);
  const { setStudentActiveNav } = useDashboardStore();
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const { data: profile } = useMyStudentProfile();
  const { data: examsResp } = useExams();
  const { data: assignmentsResp } = useAssignments({ status: 'PENDING' });
  const { data: timetableResp } = useTimetable();

  const scoreRecords: any[] = useMemo(() => profile?.scoreRecords ?? [], [profile]);
  const masteryScores: any[] = useMemo(() => profile?.masteryScores ?? [], [profile]);
  const exams: any[] = useMemo(() => examsResp?.data ?? [], [examsResp]);
  const pendingAssignments: any[] = useMemo(() => assignmentsResp?.data ?? [], [assignmentsResp]);
  const slots: any[] = useMemo(() => timetableResp?.data ?? [], [timetableResp]);

  // Aggregate subject scores across all topics (scoped to student's enrolled class subjects)
  const subjectScores = useMemo(() => {
    const bySubject = new Map<string, { total: number; count: number }>();
    for (const s of masteryScores) {
      if (!s?.subject?.name || !isStudentClassSubject(s.subject.name)) continue;
      const e = bySubject.get(s.subject.name) ?? { total: 0, count: 0 };
      e.total += (s.masteryValue ?? 0) * 100;
      e.count += 1;
      bySubject.set(s.subject.name, e);
    }
    // Ensure all student class subjects are represented (Physics, Chemistry, Mathematics)
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      if (!bySubject.has(sub)) {
        const subRecords = scoreRecords.filter(
          (r) => r.exam?.blueprint?.subject?.name?.toLowerCase() === sub.toLowerCase(),
        );
        if (subRecords.length > 0) {
          const avg = Math.round(subRecords.reduce((a, b) => a + b.percentage, 0) / subRecords.length);
          bySubject.set(sub, { total: avg, count: 1 });
        } else {
          bySubject.set(sub, { total: 0, count: 0 });
        }
      }
    }
    return Array.from(bySubject.entries())
      .map(([subject, { total, count }]) => ({
        subject,
        score: count > 0 ? Math.round(total / count) : 0,
      }))
      .sort((a, b) => b.score - a.score);
  }, [masteryScores, scoreRecords]);

  // Available subjects for the filter bar (only student's enrolled class subjects)
  const availableSubjects = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      map.set(sub, { count: 0, total: 0 });
    }
    for (const s of masteryScores) {
      if (!s?.subject?.name || !isStudentClassSubject(s.subject.name)) continue;
      const cur = map.get(s.subject.name) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += (s.masteryValue ?? 0) * 100;
      map.set(s.subject.name, cur);
    }
    for (const r of scoreRecords) {
      const sub = r.exam?.blueprint?.subject?.name;
      if (sub && isStudentClassSubject(sub)) {
        const cur = map.get(sub) ?? { count: 0, total: 0 };
        cur.count += 1;
        cur.total += r.percentage ?? 0;
        map.set(sub, cur);
      }
    }
    return Array.from(map.entries())
      .map(([name, { count, total }]) => ({
        name,
        avgScore: count > 0 ? Math.round(total / count) : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masteryScores, scoreRecords]);

  // If selectedSubject is set, get specific topics for that subject
  const subjectTopicScores = useMemo(() => {
    if (!selectedSubject) return null;
    return masteryScores
      .filter((s) => s.subject?.name?.toLowerCase() === selectedSubject.toLowerCase())
      .map((s) => ({
        name: s.topic?.name ?? 'Topic',
        score: Math.round((s.masteryValue ?? 0) * 100),
      }))
      .sort((a, b) => b.score - a.score);
  }, [masteryScores, selectedSubject]);

  // Overall score: prefers real exam scores; falls back to subject mastery average
  const overallScore = useMemo(() => {
    if (selectedSubject) {
      const found = subjectScores.find((s) => s.subject.toLowerCase() === selectedSubject.toLowerCase());
      if (found) return found.score;
      const subRecords = scoreRecords.filter((r) => {
        const sub = r.exam?.blueprint?.subject?.name;
        return (sub && sub.toLowerCase() === selectedSubject.toLowerCase()) ||
               (r.exam?.title && r.exam.title.toLowerCase().includes(selectedSubject.toLowerCase()));
      });
      if (subRecords.length > 0) {
        return Math.round(subRecords.reduce((s, r) => s + r.percentage, 0) / subRecords.length);
      }
    }
    if (scoreRecords.length > 0) {
      return Math.round(scoreRecords.reduce((s, r) => s + r.percentage, 0) / scoreRecords.length);
    }
    if (subjectScores.length > 0) {
      return Math.round(subjectScores.reduce((s, sub) => s + sub.score, 0) / subjectScores.length);
    }
    return 0;
  }, [scoreRecords, subjectScores, selectedSubject]);

  // Weak topics (below 70%), filtered by subject if active
  const weakTopics = useMemo(() => {
    const list = masteryScores
      .filter((s) => (s?.masteryValue ?? 1) < WEAK_MASTERY_THRESHOLD)
      .sort((a, b) => a.masteryValue - b.masteryValue);

    if (!selectedSubject) return list;
    return list.filter((s) => s.subject?.name?.toLowerCase() === selectedSubject.toLowerCase());
  }, [masteryScores, selectedSubject]);

  // Upcoming tests (excludes already scored exams), filtered by subject if active
  const scoredExamIds = useMemo(
    () => new Set(scoreRecords.map((r) => r.exam?.id).filter(Boolean)),
    [scoreRecords],
  );

  const upcomingExams = useMemo(() => {
    const list = exams
      .filter((e) => e.scheduledDate && !scoredExamIds.has(e.id))
      .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

    if (!selectedSubject) return list;
    return list.filter((e) => {
      const sub = e.blueprint?.subject?.name;
      return (sub && sub.toLowerCase() === selectedSubject.toLowerCase()) ||
             (e.title && e.title.toLowerCase().includes(selectedSubject.toLowerCase()));
    });
  }, [exams, scoredExamIds, selectedSubject]);

  const nextTest = upcomingExams[0] ?? null;

  // Real-time status for next test
  const nextTestStatus = useMemo(() => {
    if (!nextTest?.scheduledDate) return null;
    const start = new Date(nextTest.scheduledDate).getTime();
    const durationMs = (nextTest.durationMinutes || 60) * 60 * 1000;
    const end = start + durationMs;
    const isLive = now >= start && now <= end;
    const diff = Math.max(0, start - now);
    const isToday = diff < 24 * 60 * 60 * 1000 && new Date(start).getDate() === new Date(now).getDate();

    return {
      isLive,
      isToday,
      days: Math.floor(diff / 86400000),
      hours: Math.floor((diff / 3600000) % 24),
      mins: Math.floor((diff / 60000) % 60),
    };
  }, [nextTest, now]);

  // Today's classes / slots
  const todaySlots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return slots
      .filter((s) => new Date(s.startTime) >= today && new Date(s.startTime) < tomorrow)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [slots]);

  const hasLiveClass = useMemo(() => {
    return todaySlots.some((s) => {
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      return now >= start && now <= end;
    });
  }, [todaySlots, now]);

  // Upcoming assignments sorted by due date, filtered by subject if active
  const upcomingAssignments = useMemo(() => {
    const list = [...pendingAssignments].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );

    if (!selectedSubject) return list;
    return list.filter((a) => {
      const topicSub = a.topic?.chapter?.subject?.name ?? a.topic?.subject?.name;
      const directSub = a.subject?.name;
      return (topicSub && topicSub.toLowerCase() === selectedSubject.toLowerCase()) ||
             (directSub && directSub.toLowerCase() === selectedSubject.toLowerCase()) ||
             a.title.toLowerCase().includes(selectedSubject.toLowerCase());
    });
  }, [pendingAssignments, selectedSubject]);

  // Score records filtered by subject
  const displayScoreRecords = useMemo(() => {
    if (!selectedSubject) return scoreRecords;
    return scoreRecords.filter((t) => {
      const sub = t.exam?.blueprint?.subject?.name;
      return (sub && sub.toLowerCase() === selectedSubject.toLowerCase()) ||
             (t.exam?.title && t.exam.title.toLowerCase().includes(selectedSubject.toLowerCase()));
    });
  }, [scoreRecords, selectedSubject]);

  const scoreTrend = useMemo(
    () =>
      [...displayScoreRecords].reverse().map((r) => ({
        test: r.exam?.title ?? 'Exam',
        score: Math.round(r.percentage),
      })),
    [displayScoreRecords],
  );

  return (
    <div className="p-3.5 sm:p-5 space-y-4 animate-fadein">
      {/* ── Subject Filter Bar (Custom Apple Dropdown + Quick Pills) ──── */}
      {availableSubjects.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-100 shadow-sm relative z-30">
          <div className="flex items-center gap-2 flex-1 min-w-0" ref={dropdownRef}>
            {/* Custom Apple-Style Dropdown (NO native select) */}
            <div className="relative inline-flex items-center flex-shrink-0">
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-100/70 hover:bg-slate-200/60 active:scale-[0.98] text-slate-800 text-[12.5px] font-bold rounded-2xl border border-slate-200/60 transition-all shadow-2xs cursor-pointer min-w-[180px] sm:min-w-[200px]"
              >
                <div className="flex items-center gap-2 truncate">
                  <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span className="truncate">
                    {selectedSubject ? `${selectedSubject}` : `All Subjects (${availableSubjects.length})`}
                  </span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                    dropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Floating Custom Apple Popover Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl p-1.5 z-50 animate-fadein">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                    Filter by Subject
                  </div>

                  {/* Option: All Subjects */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubject(null);
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                      selectedSubject === null
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      All Subjects
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">
                        {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''}
                      </span>
                      {selectedSubject === null && <Check className="w-4 h-4 text-rose-600" />}
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1" />

                  {/* Individual Subjects */}
                  {availableSubjects.map((sub) => {
                    const isSel = selectedSubject === sub.name;
                    return (
                      <button
                        key={sub.name}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(sub.name);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-rose-50 text-rose-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-indigo-500" />
                          {sub.name}
                        </span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                              sub.avgScore >= 70
                                ? 'bg-emerald-50 text-emerald-700'
                                : sub.avgScore >= 40
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {sub.avgScore}%
                          </span>
                          {isSel && <Check className="w-4 h-4 text-rose-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSubject && (
              <button
                onClick={() => setSelectedSubject(null)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                title="Reset to All Subjects"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Right side: Desktop helper text */}
          <div className="hidden lg:flex items-center gap-2 flex-shrink-0 text-[11.5px] text-slate-400 font-medium">
            {selectedSubject ? (
              <span>
                Focusing on <strong className="text-indigo-600 font-bold">{selectedSubject}</strong>
              </span>
            ) : (
              <span>Select a subject to filter</span>
            )}
          </div>
        </div>
      )}

      {/* Row 1 — Overall / Subject Performance, Weak Topics, Next Test */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full max-w-full overflow-hidden">
        {/* Overall or Subject Performance Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="section-title mb-0">
                {selectedSubject ? `${selectedSubject} Performance` : 'Overall Performance'}
              </p>
              <span className="text-[11px] text-slate-400 font-medium">
                {selectedSubject
                  ? `${subjectTopicScores?.length ?? 0} topics`
                  : `${subjectScores.length} subject${subjectScores.length !== 1 ? 's' : ''}`}
              </span>
            </div>

            {scoreRecords.length === 0 && subjectScores.length === 0 ? (
              <p className="text-[12px] text-slate-400 py-8 text-center">
                No graded exams or topic scores yet.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 min-w-0 w-full max-w-full overflow-hidden">
                <OverallDonut
                  score={overallScore}
                  label={selectedSubject ? `${selectedSubject} Score` : 'Overall Score'}
                />
                <div className="flex-1 w-full sm:w-auto min-w-0 max-h-[175px] overflow-y-auto pr-1 sm:pr-2 space-y-2.5 custom-scrollbar">
                  {selectedSubject && subjectTopicScores ? (
                    subjectTopicScores.length === 0 ? (
                      <p className="text-[11px] text-slate-400 py-4">No topic data for {selectedSubject}.</p>
                    ) : (
                      subjectTopicScores.map((t) => {
                        const barColor =
                          t.score >= 75
                            ? 'bg-emerald-500'
                            : t.score >= 50
                            ? 'bg-indigo-500'
                            : 'bg-rose-500';

                        return (
                          <div key={t.name} className="group">
                            <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
                              <div className="flex-1 min-w-0 pr-1">
                                <MarqueeText
                                  text={t.name}
                                  className="text-slate-600 font-medium group-hover:text-slate-900 transition-colors text-[12px]"
                                />
                              </div>
                              <span className="font-semibold text-slate-800 flex-shrink-0">{t.score}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-1.5 rounded-full ${barColor} transition-all duration-300`}
                                style={{ width: `${Math.min(100, Math.max(0, t.score))}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )
                  ) : subjectScores.length === 0 ? (
                    <p className="text-[11px] text-slate-400 py-4">
                      Subject breakdown will appear as topics are evaluated.
                    </p>
                  ) : (
                    subjectScores.map((s) => {
                      const barColor =
                        s.score >= 75
                          ? 'bg-emerald-500'
                          : s.score >= 50
                          ? 'bg-indigo-500'
                          : 'bg-rose-500';

                      return (
                        <div
                          key={s.subject}
                          onClick={() => setSelectedSubject(s.subject)}
                          className="group cursor-pointer p-1 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[12px] mb-1 gap-2">
                            <div className="flex-1 min-w-0 pr-1">
                              <MarqueeText
                                text={s.subject}
                                className="text-slate-600 font-medium group-hover:text-indigo-600 transition-colors text-[12px]"
                              />
                            </div>
                            <span className="font-semibold text-slate-800 flex-shrink-0">{s.score}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${barColor} transition-all duration-300`}
                              style={{ width: `${Math.min(100, Math.max(0, s.score))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Weak Topics Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <p className="section-title mb-0">
                  {selectedSubject ? `${selectedSubject} Weak Topics` : 'Weak Topics'}
                </p>
                {weakTopics.length > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-600 rounded-full border border-rose-100">
                    {weakTopics.length}
                  </span>
                )}
              </div>
              <button onClick={() => setStudentActiveNav('Weak Topics')} className="view-all-link">
                View All Weak Topics →
              </button>
            </div>

            <div className="max-h-[175px] overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
              {weakTopics.length === 0 ? (
                <div className="py-6 text-center">
                  <p className="text-[12px] text-slate-400">
                    {masteryScores.length === 0
                      ? 'No mastery data yet.'
                      : selectedSubject
                      ? `🎉 Great job! No weak topics in ${selectedSubject}.`
                      : '🎉 Great job! No weak topics — above 70% in all areas.'}
                  </p>
                </div>
              ) : (
                weakTopics.map((t) => {
                  const pct = Math.round(t.masteryValue * 100);
                  const isCritical = pct < 40;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setStudentActiveNav('Weak Topics')}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 min-w-0 w-full max-w-full overflow-hidden"
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-2 flex-1 overflow-hidden">
                        <AlertCircle
                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                            isCritical ? 'text-rose-500 animate-pulse' : 'text-amber-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <MarqueeText
                            text={t.topic?.name ?? 'Unknown Topic'}
                            className="text-[12px] font-medium text-slate-700"
                          />
                          {t.subject?.name && (
                            <p className="text-[10px] text-slate-400 truncate">{t.subject.name}</p>
                          )}
                        </div>
                      </div>
                      <span
                        className={`chip flex-shrink-0 text-[10.5px] ${
                          isCritical ? 'chip-high' : 'chip-medium'
                        }`}
                      >
                        {pct}% {isCritical ? '• Critical' : ''}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Next Test Card */}
        <div className="card bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-0 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-semibold text-indigo-200">
                  {selectedSubject ? `${selectedSubject} Test` : 'Next Test'}
                </p>
                {nextTestStatus?.isLive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                    <Radio className="w-2.5 h-2.5" /> LIVE NOW
                  </span>
                )}
                {!nextTestStatus?.isLive && nextTestStatus?.isToday && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-amber-950">
                    TODAY
                  </span>
                )}
              </div>
              {upcomingExams.length > 1 && (
                <span className="text-[10px] text-indigo-200 bg-white/10 px-1.5 py-0.5 rounded">
                  1 of {upcomingExams.length}
                </span>
              )}
            </div>

            {nextTest ? (
              <>
                <div className="mb-1">
                  <MarqueeText
                    text={nextTest.title}
                    className="text-[15px] font-bold text-white"
                  />
                </div>
                <p className="text-[11.5px] text-indigo-200 mb-3 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-indigo-300" />
                  {new Date(nextTest.scheduledDate).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {nextTest.durationMinutes ? ` (${nextTest.durationMinutes}m)` : ''}
                </p>

                {nextTestStatus && !nextTestStatus.isLive && (
                  <div className="flex gap-2.5 mb-4">
                    {[
                      { val: nextTestStatus.days, label: 'Days' },
                      { val: nextTestStatus.hours, label: 'Hrs' },
                      { val: nextTestStatus.mins, label: 'Mins' },
                    ].map((c) => (
                      <div key={c.label} className="text-center">
                        <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2.5 py-1.5 min-w-[42px]">
                          <span className="text-[18px] font-bold leading-none">
                            {String(c.val).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-[10px] text-indigo-200 mt-1">{c.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {nextTestStatus?.isLive && (
                  <div className="bg-rose-500/20 border border-rose-300/30 rounded-lg p-2.5 mb-4 text-center">
                    <p className="text-[12px] font-semibold text-white">This exam is currently active!</p>
                    <p className="text-[10.5px] text-indigo-100">Click below to enter the exam room.</p>
                  </div>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <p className="text-[13px] text-indigo-100 font-medium">
                  {selectedSubject
                    ? `No upcoming ${selectedSubject} test scheduled.`
                    : 'No upcoming test scheduled.'}
                </p>
                <p className="text-[11px] text-indigo-200 mt-1">
                  Stay prepared! Review your weak topics or take practice quizzes.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => setStudentActiveNav('My Tests')}
            className="w-full bg-white text-indigo-700 font-semibold text-[13px] py-2 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm mt-3"
          >
            {nextTestStatus?.isLive ? 'Take Test Now →' : nextTest ? 'View Test Details' : 'Browse Tests'}
          </button>
        </div>
      </div>

      {/* Row 2 — Today's Schedule & Assignments Due */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full max-w-full overflow-hidden">
        {/* Today's Schedule Card (Spans 2 cols) */}
        <div className="card lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <p className="section-title mb-0">Today&apos;s Schedule</p>
                {todaySlots.length > 0 && (
                  <span className="px-2 py-0.5 text-[10.5px] font-semibold bg-indigo-50 text-indigo-700 rounded-full">
                    {todaySlots.length} session{todaySlots.length !== 1 ? 's' : ''}
                  </span>
                )}
                {hasLiveClass && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 rounded-full border border-rose-200 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> LIVE NOW
                  </span>
                )}
              </div>
              <button onClick={() => setStudentActiveNav('Time Table')} className="view-all-link">
                Full Timetable →
              </button>
            </div>

            {todaySlots.length === 0 ? (
              <div className="py-8 text-center">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                <p className="text-[12.5px] text-slate-500 font-medium">No classes scheduled for today.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Use this time for self-paced study or revision.</p>
              </div>
            ) : (
              <div className="max-h-[195px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {todaySlots.map((s) => {
                    const start = new Date(s.startTime).getTime();
                    const end = new Date(s.endTime).getTime();
                    const isLive = now >= start && now <= end;
                    const isDone = now > end;
                    const matchesFocus =
                      selectedSubject && s.title.toLowerCase().includes(selectedSubject.toLowerCase());

                    return (
                      <div
                        key={s.id}
                        className={`border rounded-xl p-3 transition-all relative min-w-0 w-full max-w-full overflow-hidden ${
                          isLive
                            ? 'border-indigo-400 bg-indigo-50/60 shadow-sm ring-1 ring-indigo-200'
                            : matchesFocus
                            ? 'border-indigo-300 bg-indigo-50/20'
                            : isDone
                            ? 'border-slate-100 bg-slate-50/60 opacity-75'
                            : 'border-slate-100 bg-white hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-[9.5px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                              isLive
                                ? 'bg-rose-500 text-white animate-pulse'
                                : matchesFocus
                                ? 'bg-indigo-600 text-white'
                                : isDone
                                ? 'bg-slate-200 text-slate-600'
                                : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {isLive ? '● LIVE' : matchesFocus ? `${selectedSubject}` : isDone ? 'Done' : s.type.replace('_', ' ')}
                          </span>
                          {s.roomRef && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5 truncate max-w-[90px]">
                              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                              <span className="truncate">{s.roomRef}</span>
                            </span>
                          )}
                        </div>
                        <div className="mb-1">
                          <MarqueeText
                            text={s.title}
                            className={`text-[12.5px] font-semibold ${
                              isDone ? 'text-slate-500 line-through' : 'text-slate-800'
                            }`}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400 flex-shrink-0" />
                          {new Date(s.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          {' - '}
                          {new Date(s.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Assignments Due Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <p className="section-title mb-0">
                  {selectedSubject ? `${selectedSubject} Assignments` : 'Assignments Due'}
                </p>
                {upcomingAssignments.length > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-50 text-indigo-700 rounded-full">
                    {upcomingAssignments.length}
                  </span>
                )}
              </div>
              <button onClick={() => setStudentActiveNav('Assignments')} className="view-all-link">
                All →
              </button>
            </div>

            <div className="max-h-[185px] overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
              {upcomingAssignments.length === 0 ? (
                <div className="py-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-60" />
                  <p className="text-[12px] text-slate-500 font-medium">
                    {selectedSubject
                      ? `No ${selectedSubject} assignments pending!`
                      : "Nothing due — you're all caught up!"}
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Check back later for new homework.</p>
                </div>
              ) : (
                upcomingAssignments.map((a) => {
                  const due = new Date(a.dueDate).getTime();
                  const diffHours = (due - now) / 3600000;
                  const isOverdue = diffHours < 0;
                  const isDueToday = !isOverdue && diffHours <= 24;
                  const isDueSoon = !isOverdue && !isDueToday && diffHours <= 48;

                  return (
                    <div
                      key={a.id}
                      onClick={() => setStudentActiveNav('Assignments')}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 min-w-0 w-full max-w-full overflow-hidden"
                    >
                      <div className="flex items-start gap-2.5 min-w-0 pr-2 flex-1 overflow-hidden">
                        <FileText
                          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                            isOverdue
                              ? 'text-rose-500'
                              : isDueToday
                              ? 'text-amber-500'
                              : 'text-indigo-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <MarqueeText
                            text={a.title}
                            className="text-[12px] font-semibold text-slate-700"
                          />
                          <p className="text-[10.5px] text-slate-400 truncate">
                            {a.topic?.name ?? (a.topic?.chapter?.subject?.name || a.subject?.name || 'Assignment')}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`chip flex-shrink-0 text-[10px] ${
                          isOverdue
                            ? 'chip-high'
                            : isDueToday
                            ? 'bg-amber-100 text-amber-800 border border-amber-200 font-bold'
                            : isDueSoon
                            ? 'chip-warning'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isOverdue
                          ? 'Overdue'
                          : isDueToday
                          ? 'Due Today'
                          : isDueSoon
                          ? 'Due Tomorrow'
                          : `Due ${new Date(a.dueDate).toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Recent Tests & Progress Over Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full max-w-full overflow-hidden">
        {/* Recent Tests Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <p className="section-title mb-0">
                  {selectedSubject ? `${selectedSubject} Tests` : 'Recent Tests'}
                </p>
                {displayScoreRecords.length > 0 && (
                  <span className="px-2 py-0.5 text-[10.5px] font-semibold bg-slate-100 text-slate-600 rounded-full">
                    {displayScoreRecords.length}
                  </span>
                )}
              </div>
              <button onClick={() => setStudentActiveNav('My Tests')} className="view-all-link">
                View All →
              </button>
            </div>

            <div className="max-h-[220px] overflow-y-auto pr-2 space-y-1.5 custom-scrollbar">
              {displayScoreRecords.length === 0 ? (
                <div className="py-8 text-center">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2 opacity-60" />
                  <p className="text-[12px] text-slate-500 font-medium">
                    {selectedSubject
                      ? `No graded ${selectedSubject} tests yet.`
                      : 'No graded tests yet.'}
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Your test results and detailed analysis will appear here.</p>
                </div>
              ) : (
                displayScoreRecords.map((t) => {
                  const pct = Math.round(t.percentage);
                  const gradeBadgeColor =
                    pct >= 80
                      ? 'bg-emerald-500 text-white'
                      : pct >= 60
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-500 text-white';

                  const scoreTextColor =
                    pct >= 80
                      ? 'text-emerald-600'
                      : pct >= 60
                      ? 'text-amber-600'
                      : 'text-rose-600';

                  return (
                    <div
                      key={t.id}
                      onClick={() => setStudentActiveNav('My Tests')}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50 last:border-0 min-w-0 w-full max-w-full overflow-hidden"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 flex-1 overflow-hidden">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10.5px] font-black flex-shrink-0 shadow-sm ${gradeBadgeColor}`}
                        >
                          {pct}
                        </div>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <MarqueeText
                            text={t.exam?.title ?? 'Exam'}
                            className="text-[12.5px] font-semibold text-slate-700"
                          />
                          <p className="text-[11px] text-slate-400 truncate">
                            {new Date(t.createdAt).toLocaleDateString([], {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                            {t.exam?.blueprint?.subject?.name ? ` • ${t.exam.blueprint.subject.name}` : ''}
                            {t.exam?.type ? ` • ${t.exam.type.replace('_', ' ')}` : ''}
                            {t.rank ? ` • Rank #${t.rank}` : ''}
                          </p>
                        </div>
                      </div>
                      <span className={`text-[13px] font-black flex-shrink-0 ${scoreTextColor}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Progress Over Time Card */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="section-title mb-0">
                {selectedSubject ? `${selectedSubject} Progress` : 'Progress Over Time'}
              </p>
              {scoreTrend.length > 0 && (
                <span className="text-[11px] text-slate-400">
                  Last {Math.min(scoreTrend.length, 8)} tests
                </span>
              )}
            </div>
            <ProgressChart data={scoreTrend} />
          </div>
        </div>
      </div>
    </div>
  );
}


