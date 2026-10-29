'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  MessageCircleQuestion,
  X,
  TrendingDown,
  TrendingUp,
  Minus,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Check,
  Filter,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useMyStudentProfile } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { isStudentClassSubject, DEFAULT_STUDENT_ENROLLED_SUBJECTS } from '@/lib/student-subjects';
import { MarqueeText } from '@/components/ui/MarqueeText';

interface MasteryScore {
  id: string;
  masteryValue: number;
  trend: number;
  topic: { name: string };
  subject: { name: string };
}

function levelFor(pct: number) {
  if (pct < 40) {
    return {
      label: 'High Priority',
      shortLabel: 'High',
      chip: 'text-rose-700 bg-rose-50 border border-rose-200/80',
      bar: 'bg-rose-500',
      dot: 'bg-rose-500',
      text: 'text-rose-600',
    };
  }
  if (pct < 70) {
    return {
      label: 'Moderate',
      shortLabel: 'Medium',
      chip: 'text-amber-700 bg-amber-50 border border-amber-200/80',
      bar: 'bg-amber-500',
      dot: 'bg-amber-500',
      text: 'text-amber-600',
    };
  }
  return {
    label: 'Good Standing',
    shortLabel: 'Low',
    chip: 'text-emerald-700 bg-emerald-50 border border-emerald-200/80',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
    text: 'text-emerald-600',
  };
}

export function StudentWeakTopics() {
  const [selectedTopic, setSelectedTopic] = useState<MasteryScore | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: profile, isPending } = useMyStudentProfile();
  const { setStudentActiveNav } = useDashboardStore();
  const rawScores: MasteryScore[] = useMemo(() => profile?.masteryScores ?? [], [profile]);
  // Filter out any subjects not belonging to this student's class (e.g. keep Physics, Chemistry, Mathematics)
  const scores: MasteryScore[] = useMemo(
    () => rawScores.filter((s) => isStudentClassSubject(s.subject?.name)),
    [rawScores],
  );

  // Click outside to close custom dropdown
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

  // Lock body scroll and handle Escape for modal
  useEffect(() => {
    if (selectedTopic) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setSelectedTopic(null);
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
    document.body.style.overflow = '';
  }, [selectedTopic]);

  // Extract distinct subjects and aggregated statistics for student's class
  const availableSubjects = useMemo(() => {
    const map = new Map<string, { count: number; totalScore: number }>();
    // Guarantee that all student class subjects exist in dropdown
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      map.set(sub, { count: 0, totalScore: 0 });
    }
    for (const s of scores) {
      if (!s?.subject?.name || !isStudentClassSubject(s.subject.name)) continue;
      const cur = map.get(s.subject.name) ?? { count: 0, totalScore: 0 };
      cur.count += 1;
      cur.totalScore += (s.masteryValue ?? 0) * 100;
      map.set(s.subject.name, cur);
    }
    return Array.from(map.entries())
      .map(([name, { count, totalScore }]) => ({
        name,
        count,
        avgScore: count > 0 ? Math.round(totalScore / count) : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [scores]);

  // Filter scores by selected subject
  const filteredScores = useMemo(() => {
    if (selectedSubject === 'ALL') return scores;
    return scores.filter((s) => s.subject?.name?.toLowerCase() === selectedSubject.toLowerCase());
  }, [scores, selectedSubject]);

  // Weakest first for priority ranking
  const weakestFirst = useMemo(
    () => [...filteredScores].sort((a, b) => a.masteryValue - b.masteryValue),
    [filteredScores],
  );

  // Summary counts for the selected view
  const stats = useMemo(() => {
    const total = filteredScores.length;
    if (total === 0) return { avg: 0, high: 0, med: 0, low: 0 };

    let sum = 0;
    let high = 0;
    let med = 0;
    let low = 0;

    for (const s of filteredScores) {
      const pct = Math.round(s.masteryValue * 100);
      sum += pct;
      if (pct < 40) high += 1;
      else if (pct < 70) med += 1;
      else low += 1;
    }

    return {
      avg: Math.round(sum / total),
      high,
      med,
      low,
    };
  }, [filteredScores]);

  function goAskTeacher(topicTitle?: string) {
    setSelectedTopic(null);
    setStudentActiveNav('Doubt Center');
  }

  // The weakest topic for the bottom banner
  const topWeakTopic = weakestFirst[0] ?? null;

  const currentLabel =
    selectedSubject === 'ALL'
      ? availableSubjects.length > 0
        ? `All Subjects (${availableSubjects.length})`
        : 'All Subjects'
      : selectedSubject;

  return (
    <div className="p-3 sm:p-5 md:p-6 pb-32 sm:pb-8 animate-fadein min-h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-3xl w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 bg-white relative">
        {/* Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-[19px] sm:text-[20px] font-bold text-slate-900 tracking-tight">Weak Topics</h2>
              <p className="text-[12px] text-slate-500">Based on your real graded exam performance.</p>
            </div>
          </div>

          {/* Custom Apple-Style Subject Selector (NO NATIVE SELECT) */}
          {scores.length > 0 && (
            <div className="relative self-start sm:self-auto w-full sm:w-auto" ref={dropdownRef}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="w-full sm:w-[230px] flex items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-100/70 hover:bg-slate-200/60 active:scale-[0.98] text-slate-800 text-[12.5px] font-bold rounded-2xl border border-slate-200/60 transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{currentLabel}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {selectedSubject !== 'ALL' && (
                  <button
                    onClick={() => setSelectedSubject('ALL')}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                    title="Reset to All Subjects"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Floating Custom Apple Popover Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[260px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl p-1.5 z-50 animate-fadein">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                    Filter by Subject
                  </div>

                  {/* Option: All Subjects */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubject('ALL');
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                      selectedSubject === 'ALL'
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
                      {selectedSubject === 'ALL' && <Check className="w-4 h-4 text-rose-600" />}
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
          )}
        </div>

        {/* Diagnostic Guide & Evaluation Guarantee Callout */}
        <div className="mb-6 bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 border border-emerald-200/60 shadow-2xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[12.5px] font-bold text-slate-800">
                  Teacher-Verified Diagnostic Mastery
                </p>
                <p className="text-[11.5px] text-slate-500">
                  Scores are calculated exclusively from teacher-evaluated assessments. Unreviewed AI suggestions never affect your academic standing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide((prev) => !prev)}
              className="text-[11.5px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto flex-shrink-0"
              aria-expanded={showGuide}
            >
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span>{showGuide ? 'Hide Guide' : 'Mastery Guide'}</span>
            </button>
          </div>

          {showGuide && (
            <div className="mt-3.5 pt-3.5 border-t border-slate-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadein">
              <div className="bg-white rounded-xl p-3 border border-rose-100">
                <div className="flex items-center gap-1.5 mb-1 text-rose-700 font-bold text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>High Priority (&lt;40%)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Critical conceptual gaps requiring immediate revision and teacher guidance. Remedial practice coursework is recommended.
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-amber-100">
                <div className="flex items-center gap-1.5 mb-1 text-amber-700 font-bold text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Moderate (40% – 69%)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Foundational understanding present, but frequent mistakes in complex exam questions. Targeted problem sets suggested.
                </p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-emerald-100">
                <div className="flex items-center gap-1.5 mb-1 text-emerald-700 font-bold text-[11.5px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Good Standing (&ge;70%)</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Strong concept mastery demonstrated across past exams. Ready for higher-order reasoning problems.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Content Body */}
        {isPending ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-slate-400 font-medium">Loading your mastery evaluation data…</p>
          </div>
        ) : scores.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-3 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-[15px] font-bold text-slate-700">No weak topics recorded yet</p>
            <p className="text-[12.5px] text-slate-500 max-w-md mt-1 mb-5">
              Once you take and complete graded exams, AIOS tracks your topic-level mastery and highlights your priority
              focus areas here.
            </p>
            <button
              onClick={() => setStudentActiveNav('My Tests')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[12.5px] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>Go to My Tests</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 mb-6 flex-1 items-start">
            {/* Left Column: Consistent Apple-Style Overview */}
            <div className="flex flex-col h-full bg-slate-50/60 rounded-3xl p-4 sm:p-6 border border-slate-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14.5px] font-bold text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-rose-600" />
                  <span>
                    {selectedSubject === 'ALL' ? 'Overall Weakness Overview' : `${selectedSubject} Mastery Overview`}
                  </span>
                </h3>
                <span className="text-[11.5px] font-bold text-slate-400">
                  {selectedSubject === 'ALL'
                    ? `${availableSubjects.length} Subject${availableSubjects.length !== 1 ? 's' : ''}`
                    : `${filteredScores.length} Topics Evaluated`}
                </span>
              </div>

              {/* Apple-Style Mastery Gauge & Priority Breakdown */}
              <div className="flex-1 flex flex-col justify-between space-y-4">
                {/* Gauge Card */}
                <div className="flex items-center gap-5 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/60 shadow-xs">
                  <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
                    <svg className="w-20 h-20 -rotate-90 transform" viewBox="0 0 80 80">
                      <circle
                        cx="40"
                        cy="40"
                        r={32}
                        stroke="#f1f5f9"
                        strokeWidth={7}
                        fill="transparent"
                      />
                      <circle
                        cx="40"
                        cy="40"
                        r={32}
                        stroke={stats.avg >= 70 ? '#10b981' : stats.avg >= 40 ? '#f59e0b' : '#f43f5e'}
                        strokeWidth={7}
                        strokeDasharray={201.06}
                        strokeDashoffset={201.06 - (Math.min(100, Math.max(0, stats.avg)) / 100) * 201.06}
                        strokeLinecap="round"
                        fill="transparent"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[16px] font-extrabold text-slate-900 tracking-tight">{stats.avg}%</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Avg</span>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-[14px] font-bold text-slate-900 truncate">
                      {selectedSubject === 'ALL' ? 'All Subjects Average' : `${selectedSubject} Performance`}
                    </h4>
                    <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">
                      {stats.high > 0
                        ? `${stats.high} critical topic${stats.high !== 1 ? 's' : ''} require immediate revision.`
                        : 'All tested topics meet the minimum mastery benchmark.'}
                    </p>
                  </div>
                </div>

                {/* 3 Status KPI Pills (Apple Health Inset Style) */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* High Priority */}
                  <div className="bg-rose-50/80 border border-rose-100/80 rounded-2xl p-3 text-center transition-all hover:bg-rose-50">
                    <p className="text-[20px] sm:text-[22px] font-extrabold text-rose-700 tracking-tight">{stats.high}</p>
                    <p className="text-[11px] font-bold text-rose-600 mt-0.5">High Priority</p>
                  </div>

                  {/* Medium Priority */}
                  <div className="bg-amber-50/80 border border-amber-100/80 rounded-2xl p-3 text-center transition-all hover:bg-amber-50">
                    <p className="text-[20px] sm:text-[22px] font-extrabold text-amber-700 tracking-tight">{stats.med}</p>
                    <p className="text-[11px] font-bold text-amber-600 mt-0.5">Moderate</p>
                  </div>

                  {/* Low Priority / Good */}
                  <div className="bg-emerald-50/80 border border-emerald-100/80 rounded-2xl p-3 text-center transition-all hover:bg-emerald-50">
                    <p className="text-[20px] sm:text-[22px] font-extrabold text-emerald-700 tracking-tight">{stats.low}</p>
                    <p className="text-[11px] font-bold text-emerald-600 mt-0.5">Good Standing</p>
                  </div>
                </div>

                {/* Subject Breakdown List when multiple subjects exist */}
                {selectedSubject === 'ALL' && availableSubjects.length > 1 && (
                  <div className="bg-white rounded-2xl border border-slate-200/70 p-3.5 space-y-2 max-h-[160px] overflow-y-auto overscroll-contain custom-scrollbar touch-pan-y">
                    <div className="flex items-center justify-between text-[10.5px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      <span>Subject Breakdown</span>
                      <span>Mastery</span>
                    </div>
                    {availableSubjects.map((sub) => (
                      <div
                        key={sub.name}
                        onClick={() => setSelectedSubject(sub.name)}
                        className="flex items-center justify-between p-1.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <span className="text-[12.5px] font-bold text-slate-700 group-hover:text-rose-600 transition-colors">
                          {sub.name}
                        </span>
                        <div className="flex items-center gap-2.5">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${
                                sub.avgScore >= 70 ? 'bg-emerald-500' : sub.avgScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${sub.avgScore}%` }}
                            />
                          </div>
                          <span className="text-[12px] font-extrabold text-slate-900 w-8 text-right">{sub.avgScore}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3 bg-white rounded-2xl border border-slate-200/70 text-[11.5px] text-slate-600 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">
                    Topics with <strong>0% – 39%</strong> mastery are prioritized for teacher revision and remedial
                    sessions.
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Top Priority Areas with Vertical Scroll */}
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14.5px] font-bold text-slate-900 flex items-center gap-2">
                  <span>Top Priority Areas</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    {weakestFirst.length}
                  </span>
                </h3>
                <span className="text-[11.5px] text-slate-400 font-medium">Ranked by weakest first</span>
              </div>

              {/* Scrollable Container with Apple-like scrollbar (Guaranteed containment on mobile & desktop) */}
              <div className="max-h-[380px] sm:max-h-[440px] overflow-y-auto overscroll-contain pr-1.5 space-y-2.5 custom-scrollbar touch-pan-y flex-1">
                {weakestFirst.length === 0 ? (
                  <p className="text-[12.5px] text-slate-400 py-8 text-center">
                    No weak topics found for this selection.
                  </p>
                ) : (
                  weakestFirst.map((score) => {
                    const pct = Math.round(score.masteryValue * 100);
                    const level = levelFor(pct);

                    return (
                      <div
                        key={score.id}
                        onClick={() => setSelectedTopic(score)}
                        className="group cursor-pointer p-3.5 sm:p-4 rounded-2xl border border-slate-200/60 bg-white hover:border-slate-300 hover:bg-slate-50/60 active:scale-[0.99] transition-all shadow-2xs hover:shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-2.5 gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <MarqueeText
                                  text={score.topic.name}
                                  className="text-[13.5px] font-bold text-slate-900 group-hover:text-rose-600 transition-colors"
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full flex-shrink-0">
                                {score.subject.name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="text-[13.5px] font-extrabold text-slate-900">{pct}%</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${level.chip}`}>
                              {level.shortLabel}
                            </span>
                          </div>
                        </div>

                        {/* Apple-style Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-[6px] overflow-hidden">
                          <div
                            className={`h-[6px] rounded-full ${level.bar} transition-all duration-700`}
                            style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Banner: Ask Teacher Box — Floating Apple capsule on mobile, natural card footer on desktop */}
        {scores.length > 0 && (
          <div className="fixed bottom-3 left-3 right-3 sm:static sm:mt-auto z-40">
            <div className="bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-slate-200/90 sm:border-rose-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.12)] sm:shadow-xs p-3.5 sm:p-5 flex items-center justify-between gap-3 sm:bg-gradient-to-r sm:from-rose-50/70 sm:to-rose-50/30">
              <div className="flex items-center gap-3 min-w-0 flex-1 pl-9 sm:pl-0">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-rose-500 text-white shadow-sm shadow-rose-200">
                  <MessageCircleQuestion className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] sm:text-[14.5px] font-bold text-slate-900 truncate">
                    {topWeakTopic
                      ? `Struggling with ${topWeakTopic.topic.name}?`
                      : 'Need guidance on your weak areas?'}
                  </p>
                  <p className="text-[11px] sm:text-[12px] text-slate-500 truncate hidden xs:block sm:block">
                    Ask your teacher directly — connects straight to Doubt Center.
                  </p>
                </div>
              </div>

              <button
                onClick={() => goAskTeacher(topWeakTopic?.topic?.name)}
                className="px-4 sm:px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[12.5px] sm:text-[13px] rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer flex-shrink-0 whitespace-nowrap"
              >
                <span>Ask a Teacher</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Topic Detail Modal (Responsive Apple Sheet on mobile, centered dialog on desktop) */}
        {selectedTopic && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadein">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative animate-slide-up max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedTopic(null)}
                className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>

              {(() => {
                const pct = Math.round(selectedTopic.masteryValue * 100);
                const level = levelFor(pct);
                const TrendIcon = selectedTopic.trend > 0 ? TrendingUp : selectedTopic.trend < 0 ? TrendingDown : Minus;

                return (
                  <>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${level.chip}`}>
                      <AlertCircle className="w-6 h-6" />
                    </div>

                    <div className="mb-1">
                      <MarqueeText
                        text={selectedTopic.topic.name}
                        className="text-[19px] sm:text-[20px] font-bold text-slate-900"
                      />
                    </div>
                    <p className="text-[12.5px] text-slate-500 mb-4">{selectedTopic.subject.name}</p>

                    <div className="flex flex-wrap items-center gap-2.5 mb-6 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-[12.5px] text-slate-800 font-bold">Mastery: {pct}%</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${level.chip}`}>
                        {level.label}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <TrendIcon className="w-3.5 h-3.5" />
                        {selectedTopic.trend > 0 ? 'Improving' : selectedTopic.trend < 0 ? 'Declining' : 'Stable'}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6 text-[12.5px] text-slate-600 leading-relaxed">
                      <p>
                        Your mastery in <strong>{selectedTopic.topic.name}</strong> was calculated across your evaluated
                        exams.
                      </p>
                      <p>
                        Asking a question will pre-fill this topic in the Doubt Center so your teacher can review your
                        exact area of difficulty.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <button
                        onClick={() => goAskTeacher(selectedTopic.topic.name)}
                        className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                      >
                        <MessageCircleQuestion className="w-4 h-4" /> Ask Teacher About This
                      </button>
                      <button
                        onClick={() => setSelectedTopic(null)}
                        className="px-5 py-3 text-slate-600 hover:bg-slate-100 font-bold text-[13px] rounded-xl transition-colors cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
