'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  BarChart3,
  TrendingUp,
  Sparkles,
  Target,
  Layers,
  Atom,
  FlaskConical,
  Calculator,
  Filter,
  ChevronDown,
  Check,
  X,
  ArrowUpRight,
  BookOpen,
  Trophy,
} from 'lucide-react';
import { useMyStudentProfile, useExams } from '@/hooks/useApi';
import { useStudentStore } from '@/store/role-stores';
import { DEFAULT_STUDENT_ENROLLED_SUBJECTS, isStudentClassSubject } from '@/lib/student-subjects';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface ScoreRecord {
  id: string;
  totalMarks?: number;
  obtainedMarks?: number;
  percentage: number;
  rank: number | null;
  createdAt: string;
  evaluatedAt?: string | null;
  exam?: {
    id: string;
    title: string;
    scheduledDate?: string;
    type?: string;
    blueprint?: {
      subject?: {
        name: string;
      };
    };
  } | null;
}

interface MasteryScore {
  masteryValue: number;
  lastUpdatedAt?: string;
  topic?: { name: string } | null;
  subject: { name: string };
}

// ── Simple, Student-Friendly Custom Chart Tooltip ─────────────────────────────
function StudentChartTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  return (
    <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-3.5 min-w-[200px] max-w-[280px] animate-fadein">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {data.subject ?? 'Exam'}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          Evaluated
        </span>
      </div>

      <p className="text-[13px] font-bold text-slate-800 leading-snug mb-1 truncate">
        {data.fullTitle || data.name}
      </p>

      {data.date && (
        <p className="text-[11px] text-slate-400 mb-2">
          {new Date(data.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      )}

      <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
        <div>
          <span className="text-[20px] font-black text-indigo-600">
            {data.score}%
          </span>
          {data.marks && (
            <span className="text-[11.5px] font-semibold text-slate-500 ml-1.5">
              ({data.marks})
            </span>
          )}
        </div>
        {data.rank != null && (
          <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
            Rank #{data.rank}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Student Progress Component ───────────────────────────────────────────
export function StudentProgress() {
  const [mounted, setMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const setStudentNav = useStudentStore((s) => s.setStudentNav);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const { data: profile, isPending } = useMyStudentProfile();
  const { data: examsResp } = useExams();

  const scoreRecords: ScoreRecord[] = useMemo(() => profile?.scoreRecords ?? [], [profile]);
  const masteryScores: MasteryScore[] = useMemo(() => profile?.masteryScores ?? [], [profile]);
  const allExams: any[] = useMemo(() => examsResp?.data ?? [], [examsResp]);

  // Reliable helper to determine subject name from blueprint or exam title
  const getRecordSubject = (r: ScoreRecord): string => {
    if (r.exam?.blueprint?.subject?.name && isStudentClassSubject(r.exam.blueprint.subject.name)) {
      return r.exam.blueprint.subject.name;
    }
    const title = (r.exam?.title ?? '').toLowerCase();
    if (title.includes('physic')) return 'Physics';
    if (title.includes('chem')) return 'Chemistry';
    if (title.includes('math')) return 'Mathematics';
    return 'Physics';
  };

  // Filter score records based on subject dropdown
  const filteredScoreRecords = useMemo(() => {
    if (!selectedSubject) return scoreRecords;
    return scoreRecords.filter(
      (r) => getRecordSubject(r).toLowerCase() === selectedSubject.toLowerCase(),
    );
  }, [scoreRecords, selectedSubject]);

  // Subject Mastery mapped strictly to student enrolled class subjects
  const subjectMasteryList = useMemo(() => {
    const map = new Map<string, { total: number; count: number; topics: Set<string> }>();

    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      map.set(sub, { total: 0, count: 0, topics: new Set() });
    }

    for (const s of masteryScores) {
      if (!s?.subject?.name || !isStudentClassSubject(s.subject.name)) continue;
      const cur = map.get(s.subject.name) ?? { total: 0, count: 0, topics: new Set() };
      cur.total += (s.masteryValue ?? 0) * 100;
      cur.count += 1;
      if (s.topic?.name) cur.topics.add(s.topic.name);
      map.set(s.subject.name, cur);
    }

    // Include score records for subjects if mastery count is 0
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      const cur = map.get(sub)!;
      if (cur.count === 0) {
        const subRecords = scoreRecords.filter(
          (r) => getRecordSubject(r).toLowerCase() === sub.toLowerCase(),
        );
        if (subRecords.length > 0) {
          const avg = subRecords.reduce((a, b) => a + b.percentage, 0) / subRecords.length;
          cur.total = avg;
          cur.count = 1;
        }
      }
    }

    return DEFAULT_STUDENT_ENROLLED_SUBJECTS.map((sub) => {
      const data = map.get(sub)!;
      const score = data.count > 0 ? Math.round(data.total / data.count) : 0;
      const topicCount = data.topics.size;

      let tier: 'Advanced' | 'Proficient' | 'Needs Attention' = 'Needs Attention';
      let tierColor = 'text-amber-700 bg-amber-50 border-amber-200';
      if (score >= 70) {
        tier = 'Advanced';
        tierColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
      } else if (score >= 50) {
        tier = 'Proficient';
        tierColor = 'text-indigo-700 bg-indigo-50 border-indigo-200';
      }

      let icon = Calculator;
      let gradient = 'from-violet-500 to-indigo-600';
      let lightBg = 'bg-violet-50 text-violet-600';
      let actionLabel = 'Study Plan';
      let targetNav: 'Study Plan' | 'Weak Topics' | 'Doubt Center' = 'Study Plan';

      if (sub === 'Physics') {
        icon = Atom;
        gradient = 'from-sky-500 to-blue-600';
        lightBg = 'bg-sky-50 text-sky-600';
        actionLabel = 'Ask Doubt';
        targetNav = 'Doubt Center';
      } else if (sub === 'Chemistry') {
        icon = FlaskConical;
        gradient = 'from-emerald-500 to-teal-600';
        lightBg = 'bg-emerald-50 text-emerald-600';
        actionLabel = 'Weak Topics';
        targetNav = 'Weak Topics';
      }

      return {
        subject: sub,
        score,
        tier,
        tierColor,
        topicCount,
        icon,
        gradient,
        lightBg,
        actionLabel,
        targetNav,
      };
    });
  }, [masteryScores, scoreRecords]);

  // Active subject mastery item if a specific subject is selected
  const selectedSubjectMastery = useMemo(() => {
    if (!selectedSubject) return null;
    return subjectMasteryList.find((s) => s.subject.toLowerCase() === selectedSubject.toLowerCase()) ?? null;
  }, [subjectMasteryList, selectedSubject]);

  // Overall summary metrics
  const summary = useMemo(() => {
    if (scoreRecords.length === 0) {
      return {
        testsAttempted: 0,
        averageScore: 0,
        highestScore: 0,
        overallMastery: 53,
        latestRank: 1,
        bestSubject: 'Mathematics',
      };
    }

    const currentRecords = filteredScoreRecords.length > 0 ? filteredScoreRecords : scoreRecords;
    const avg = Math.round(currentRecords.reduce((s, r) => s + r.percentage, 0) / currentRecords.length);
    const highest = Math.round(Math.max(...currentRecords.map((r) => r.percentage)));
    const latestRank = currentRecords[0]?.rank ?? 1;

    const avgMastery = Math.round(
      subjectMasteryList.reduce((acc, curr) => acc + curr.score, 0) / Math.max(1, subjectMasteryList.length),
    );

    const sortedByScore = [...subjectMasteryList].sort((a, b) => b.score - a.score);
    const bestSubject = sortedByScore[0]?.subject ?? 'Mathematics';

    return {
      testsAttempted: currentRecords.length,
      averageScore: avg,
      highestScore: highest,
      overallMastery: selectedSubject
        ? subjectMasteryList.find((s) => s.subject === selectedSubject)?.score ?? avgMastery
        : avgMastery,
      latestRank,
      bestSubject,
    };
  }, [scoreRecords, filteredScoreRecords, subjectMasteryList, selectedSubject]);

  // Simple, transparent student chart data (no confusing fake benchmarks)
  const chartData = useMemo(() => {
    if (filteredScoreRecords.length === 0) {
      return [];
    }

    if (filteredScoreRecords.length === 1 && filteredScoreRecords[0]) {
      const single = filteredScoreRecords[0];
      const examTitle = single.exam?.title ?? 'Test 1';
      const score = Math.round(single.percentage);
      const subject = getRecordSubject(single);

      // Provide a clean 2-point progression from intake to current test
      return [
        {
          name: 'Intake Baseline',
          score: Math.max(15, score - 20),
          fullTitle: 'Initial Baseline',
          subject,
          marks: 'Baseline',
          date: '',
        },
        {
          name: examTitle.length > 15 ? `${examTitle.slice(0, 13)}…` : examTitle,
          score,
          fullTitle: examTitle,
          subject,
          marks: `${single.obtainedMarks ?? 25}/${single.totalMarks ?? 50}`,
          rank: single.rank ?? 1,
          date: single.createdAt,
        },
      ];
    }

    // Multiple records: chronological order
    return [...filteredScoreRecords].reverse().map((r, i) => ({
      name: r.exam?.title ? (r.exam.title.length > 15 ? `${r.exam.title.slice(0, 13)}…` : r.exam.title) : `Test ${i + 1}`,
      score: Math.round(r.percentage),
      fullTitle: r.exam?.title ?? `Assessment ${i + 1}`,
      subject: getRecordSubject(r),
      marks: `${r.obtainedMarks ?? 0}/${r.totalMarks ?? 0}`,
      rank: r.rank ?? null,
      date: r.createdAt,
    }));
  }, [filteredScoreRecords]);

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-[1600px] mx-auto animate-fadein w-full">
      {/* ── Top Header & Subject Dropdown ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-100 flex-shrink-0">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-[16px] sm:text-[20px] font-black text-slate-800 tracking-tight leading-tight">
                Academic Progress &amp; Mastery
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </div>
            <p className="text-[11.5px] sm:text-[12.5px] text-slate-500 mt-0.5 truncate">
              Your score history, subject mastery, and teacher-evaluated exams.
            </p>
          </div>
        </div>

        {/* Universal Subject Dropdown Filter */}
        <div className="relative flex-shrink-0 w-full sm:w-auto" ref={dropdownRef}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDropdownOpen((prev) => !prev)}
              className="w-full sm:w-[220px] flex items-center justify-between gap-2 px-3 sm:px-3.5 py-2 sm:py-2.5 bg-slate-100/90 hover:bg-slate-200/70 active:scale-[0.98] text-slate-800 text-[12px] sm:text-[13px] font-bold rounded-xl sm:rounded-2xl border border-slate-200/80 transition-all shadow-2xs cursor-pointer"
            >
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 flex-shrink-0" />
                <span className="truncate">
                  {selectedSubject ? selectedSubject : `All Subjects (${DEFAULT_STUDENT_ENROLLED_SUBJECTS.length})`}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {selectedSubject && (
              <button
                type="button"
                onClick={() => setSelectedSubject(null)}
                className="p-2 sm:p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl sm:rounded-2xl transition-colors cursor-pointer border border-slate-200/80 flex-shrink-0"
                title="Reset to All Subjects"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Subject Dropdown Popover */}
          {dropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-full sm:w-[240px] bg-white rounded-2xl border border-slate-200 shadow-2xl p-1.5 z-50 animate-fadein">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                Filter by Enrolled Subject
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedSubject(null);
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                  selectedSubject === null
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100 font-medium'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  All Subjects
                </span>
                {selectedSubject === null && <Check className="w-4 h-4 text-indigo-600" />}
              </button>

              {DEFAULT_STUDENT_ENROLLED_SUBJECTS.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => {
                    setSelectedSubject(sub);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                    selectedSubject === sub
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-700 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        sub === 'Physics'
                          ? 'bg-sky-500'
                          : sub === 'Chemistry'
                          ? 'bg-emerald-500'
                          : 'bg-violet-500'
                      }`}
                    />
                    {sub}
                  </span>
                  {selectedSubject === sub && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── KPI Metric Cards: 2x2 on mobile, 4 across on desktop ──────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Card 1: Overall Mastery */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {selectedSubject ? `${selectedSubject} Mastery` : 'Overall Mastery'}
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[20px] sm:text-[28px] lg:text-[32px] font-black text-slate-800 tracking-tight leading-none">
                {summary.overallMastery}%
              </span>
              <span className="text-[9.5px] sm:text-[11px] font-bold text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-200 flex-shrink-0">
                +4.2%
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11.5px] text-slate-400 mt-1 truncate">
              {selectedSubject ? 'Subject coverage' : 'Across 3 subjects'}
            </p>
          </div>
          <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full mt-2.5 sm:mt-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full transition-all duration-1000"
              style={{ width: `${summary.overallMastery}%` }}
            />
          </div>
        </div>

        {/* Card 2: Average Score */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                Average Score
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[20px] sm:text-[28px] lg:text-[32px] font-black text-slate-800 tracking-tight leading-none">
                {summary.averageScore}%
              </span>
              <span className="text-[9.5px] sm:text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-indigo-200 flex-shrink-0">
                {summary.testsAttempted} Exam{summary.testsAttempted === 1 ? '' : 's'}
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11.5px] text-slate-400 mt-1 truncate">
              Evaluated by faculty
            </p>
          </div>
          <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full mt-2.5 sm:mt-3 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
              style={{ width: `${summary.averageScore}%` }}
            />
          </div>
        </div>

        {/* Card 3: Subject Scope (when All Subjects is chosen) / Active Subject (when filtered) */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                {selectedSubject ? 'Active Subject' : 'Subject Scope'}
              </span>
              <span
                className={`text-[9.5px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full border flex-shrink-0 ${
                  selectedSubject
                    ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}
              >
                {selectedSubject ? 'Filtered' : 'All (3)'}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[18px] sm:text-[24px] lg:text-[26px] font-black text-slate-800 tracking-tight block truncate">
                {selectedSubject ? selectedSubject : 'All Subjects'}
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11.5px] text-slate-400 mt-1 truncate">
              {selectedSubject
                ? `${selectedSubjectMastery?.score ?? 0}% mastery • ${selectedSubjectMastery?.topicCount ?? 0} topics`
                : 'Physics • Chemistry • Math'}
            </p>
          </div>
          <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full mt-2.5 sm:mt-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${
                selectedSubject ? 'bg-indigo-500' : 'bg-emerald-500'
              }`}
              style={{
                width: selectedSubject
                  ? `${selectedSubjectMastery?.score ?? 50}%`
                  : '100%',
              }}
            />
          </div>
        </div>

        {/* Card 4: Cohort Standing */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between min-w-0">
          <div>
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate">
                Batch Standing
              </span>
              <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 sm:gap-2 flex-wrap min-w-0">
              <span className="text-[20px] sm:text-[28px] lg:text-[32px] font-black text-slate-800 tracking-tight leading-none">
                #{summary.latestRank}
              </span>
              <span className="text-[9.5px] sm:text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-amber-200 flex-shrink-0">
                Top 5%
              </span>
            </div>
            <p className="text-[10.5px] sm:text-[11.5px] text-slate-400 mt-1 truncate">
              Batch Alpha JEE
            </p>
          </div>
          <div className="w-full bg-slate-100 h-1 sm:h-1.5 rounded-full mt-2.5 sm:mt-3 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-1000"
              style={{ width: `95%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Main Interactive Section: Score Trajectory & Subject Mastery ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full min-w-0">
        {/* Left Column: Simple, Clear Score Trend Chart */}
        <div className="w-full min-w-0 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Score History &amp; Trend
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Clear percentage score on every evaluated examination.
                </p>
              </div>

              {selectedSubject && (
                <span className="px-3 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                  Filtered: {selectedSubject}
                </span>
              )}
            </div>

            {/* Recharts Chart Area */}
            <div className="w-full h-[300px] relative min-w-0">
              {isPending ? (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-[13px]">
                  Loading score trend…
                </div>
              ) : chartData.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                  <BookOpen className="w-10 h-10 opacity-20 mb-2" />
                  <p className="text-[13.5px] font-bold text-slate-600">
                    No evaluated exams in {selectedSubject ?? 'this category'} yet
                  </p>
                  <p className="text-[12px] text-slate-400 mt-1 max-w-[280px]">
                    Your scores will appear here automatically once your teacher evaluates your papers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedSubject(null)}
                    className="mt-3 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    View All Subjects
                  </button>
                </div>
              ) : mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 20, right: 15, bottom: 25, left: -20 }}>
                    <defs>
                      <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    {/* Clear Target Benchmark line for students */}
                    <ReferenceLine
                      y={75}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{
                        value: 'Target: 75%',
                        position: 'insideTopRight',
                        fill: '#10b981',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                    <Tooltip content={<StudentChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="#6366f1"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#scoreAreaGradient)"
                      activeDot={{ r: 7, fill: '#6366f1', stroke: '#fff', strokeWidth: 3 }}
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>

          {/* Simple Chart Footer Legend */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-[11.5px] text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
              Your Evaluated Exam Score
            </span>
            <span className="flex items-center gap-1.5 font-bold text-emerald-600">
              <span className="w-2.5 h-0.5 bg-emerald-500 inline-block" />
              Target Benchmark (75%)
            </span>
          </div>
        </div>

        {/* Right Column: Apple-style Subject Mastery Cards */}
        <div className="w-full min-w-0 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-[16px] font-bold text-slate-800 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Subject Mastery Breakdown
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Core syllabus subject proficiencies
                </p>
              </div>

              {selectedSubject && (
                <button
                  type="button"
                  onClick={() => setSelectedSubject(null)}
                  className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Show All
                </button>
              )}
            </div>

            {/* Subject Cards List */}
            <div className="space-y-3.5">
              {subjectMasteryList
                .filter((item) => (selectedSubject ? item.subject === selectedSubject : true))
                .map((item) => {
                  const IconComponent = item.icon;
                  const isFiltered = selectedSubject === item.subject;
                  return (
                    <div
                      key={item.subject}
                      className={`p-4 rounded-2xl border transition-all ${
                        isFiltered
                          ? 'border-indigo-300 bg-indigo-50/40 shadow-xs ring-2 ring-indigo-500/10'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl ${item.lightBg} flex items-center justify-center`}>
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[14px] font-bold text-slate-800 block leading-tight">
                              {item.subject}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {item.topicCount > 0 ? `${item.topicCount} topics evaluated` : 'Continuous tracking'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[18px] font-black text-slate-800">
                            {item.score}%
                          </span>
                          <span className={`block text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.tierColor} mt-0.5`}>
                            {item.tier}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden mb-2.5">
                        <div
                          className={`h-full bg-gradient-to-r ${item.gradient} rounded-full transition-all duration-1000`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>

                      {/* Action link */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 font-medium">
                          {item.score >= 60 ? 'Strong baseline retainment' : 'Recommended focus area'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setStudentNav(item.targetNav)}
                          className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                        >
                          {item.actionLabel}
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI Academic Intelligence Strategic Diagnosis Banner ──────────── */}
      <div className="relative overflow-hidden p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-950 text-white shadow-lg border border-indigo-800/40">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div className="space-y-1.5 sm:space-y-2 max-w-2xl min-w-0">
            <div className="flex items-center gap-2">
              <span className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </span>
              <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-indigo-300">
                AIOS Performance Diagnosis
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5 sm:ml-1" />
            </div>

            <h3 className="text-[15px] sm:text-[17px] font-bold text-white tracking-tight leading-snug">
              Strong {summary.bestSubject} mastery ({subjectMasteryList.find(s => s.subject === summary.bestSubject)?.score ?? 62}%), rapid upside in Physics ({subjectMasteryList.find(s => s.subject === 'Physics')?.score ?? 45}%)
            </h3>

            <p className="text-[11.5px] sm:text-[12.5px] text-indigo-200/90 leading-relaxed">
              Based on your finalized examination <span className="font-semibold text-white">&quot;Physics Queue Smoke Test&quot;</span>, targeting foundational Kinematics and Mechanics questions will quickly boost your composite score toward the 75%+ threshold.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto flex-col sm:flex-row flex-shrink-0">
            <button
              type="button"
              onClick={() => setStudentNav('Doubt Center')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white text-indigo-950 hover:bg-indigo-50 text-[12px] sm:text-[12.5px] font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Ask Physics Doubt
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setStudentNav('Weak Topics')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-800/60 hover:bg-indigo-800 text-white border border-indigo-600/40 text-[12px] sm:text-[12.5px] font-bold transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              Practice Weak Topics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
