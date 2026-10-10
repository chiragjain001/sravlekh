'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Trophy,
  TrendingUp,
  Rocket,
  Flame,
  Award,
  Crown,
  ShieldCheck,
  Zap,
  Info,
  ChevronDown,
  Filter,
  Check,
  X,
  Target,
  Sparkles,
  Compass,
  HelpCircle,
  Users,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import {
  useLeaderboard,
  useLeaderboardGrowth,
  useMyTeacherProfile,
  useSubjects,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

// ── Reusable Apple-Style Dropdown Component ──────────────────────────────────
interface DropdownOption {
  value: string | number;
  label: string;
}

interface AppleDropdownProps {
  value: string | number;
  onChange: (value: any) => void;
  options: DropdownOption[];
  icon?: React.ReactNode;
  ariaLabel?: string;
  themeColor?: 'indigo' | 'amber';
}

function AppleDropdown({
  value,
  onChange,
  options,
  icon,
  ariaLabel,
  themeColor = 'indigo',
}: AppleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => String(opt.value) === String(value)) || options[0],
    [options, value]
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeBadgeColor =
    themeColor === 'amber'
      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-bold'
      : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold';

  const checkColor =
    themeColor === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-indigo-600 dark:text-indigo-400';

  return (
    <div className="relative inline-block w-full sm:w-auto" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full sm:w-auto flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-semibold rounded-xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs transition-all active:scale-[0.98] cursor-pointer"
      >
        <div className="flex items-center gap-1.5 min-w-0 truncate">
          {icon}
          <span className="truncate max-w-[190px] sm:max-w-[220px]">
            {selectedOption?.label || 'Select'}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-1.5 w-full sm:w-auto min-w-[210px] max-w-[calc(100vw-32px)] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/90 shadow-2xl p-1.5 z-50 animate-fadein max-h-60 overflow-y-auto custom-scrollbar">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${isSelected
                  ? activeBadgeColor
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                  }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className={`w-3.5 h-3.5 shrink-0 ${checkColor}`} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main StudentLeaderboard Component ────────────────────────────────────────
export function StudentLeaderboard({ isTeacher: propIsTeacher }: { isTeacher?: boolean } = {}) {
  const { user } = useAuth();
  const isTeacher = propIsTeacher ?? (user?.role === 'TEACHER');

  const [activeTab, setActiveTab] = useState<'growth' | 'rank'>('growth');
  const [scope, setScope] = useState<'class' | 'batch'>('class');

  // Teacher-specific data fetching
  const { data: teacherProfile } = useMyTeacherProfile();
  const { data: subjectsResp } = useSubjects();
  const allSubjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];

  const assignments = useMemo(
    () => (teacherProfile?.batchAssignments ?? []).filter((a: any) => !a.removedAt),
    [teacherProfile],
  );

  const teacherBatches = useMemo(() => {
    const map = new Map<string, { id: string; name: string; classYear?: string }>();
    assignments.forEach((a: any) => {
      if (a.batch && !map.has(a.batch.id)) {
        map.set(a.batch.id, {
          id: a.batch.id,
          name: a.batch.name,
          classYear: a.batch.classYear,
        });
      }
    });
    return Array.from(map.values());
  }, [assignments]);

  const teacherSubjectIds = useMemo(() => {
    const set = new Set<string>();
    (teacherProfile?.subjectIds ?? []).forEach((id: string) => set.add(id));
    assignments.forEach((a: any) => {
      if (a.subjectId) set.add(a.subjectId);
    });
    return set;
  }, [teacherProfile, assignments]);

  const teacherSubjects = useMemo(() => {
    if (teacherSubjectIds.size === 0) return [];
    return allSubjects.filter((s: any) => teacherSubjectIds.has(s.id));
  }, [allSubjects, teacherSubjectIds]);

  // Section options for teacher
  const sectionOptions = useMemo(() => {
    const list: DropdownOption[] = [];
    if (teacherBatches.length > 1) {
      list.push({ value: 'all', label: 'All Assigned Sections' });
    }
    teacherBatches.forEach((b) => {
      list.push({ value: b.id, label: b.name });
    });
    if (list.length === 0) {
      list.push({ value: 'all', label: 'All Sections' });
    }
    return list;
  }, [teacherBatches]);

  // Teacher Section filter state (defaults to first batch if available, else 'all')
  const [teacherBatchId, setTeacherBatchId] = useState<string>('all');

  useEffect(() => {
    if (isTeacher && teacherBatches.length === 1 && teacherBatchId === 'all' && teacherBatches[0]) {
      setTeacherBatchId(teacherBatches[0].id);
    }
  }, [isTeacher, teacherBatches, teacherBatchId]);

  // Filters for Rank Board
  const [rankSubjectId, setRankSubjectId] = useState<string>('all');
  const [rankExamId, setRankExamId] = useState<string>('all');

  // Filters for Growth Board
  const [growthSubjectId, setGrowthSubjectId] = useState<string>('all');
  const [growthExamFamily, setGrowthExamFamily] = useState<'ALL' | 'SPOT' | 'PERIODIC' | 'MAJOR'>('ALL');
  const [growthPeriodWeeks, setGrowthPeriodWeeks] = useState<number>(52);

  // Calculation Breakdown Modal state
  const [selectedBreakdownStudent, setSelectedBreakdownStudent] = useState<any | null>(null);

  // Resolve scope and batchId
  const activeScope = isTeacher
    ? (teacherBatchId === 'all' ? 'class' : 'batch')
    : scope;
  const activeBatchId = isTeacher
    ? (teacherBatchId === 'all' ? undefined : teacherBatchId)
    : undefined;

  // Queries (Data is refetched via global TopHeader refresh)
  const {
    data: rankData,
    isLoading: isRankLoading,
  } = useLeaderboard({
    scope: activeScope,
    batchId: activeBatchId,
    subjectId: rankSubjectId === 'all' ? undefined : rankSubjectId,
    examId: rankExamId === 'all' ? undefined : rankExamId,
  });

  const {
    data: growthData,
    isLoading: isGrowthLoading,
  } = useLeaderboardGrowth({
    scope: activeScope,
    batchId: activeBatchId,
    subjectId: growthSubjectId === 'all' ? undefined : growthSubjectId,
    examFamily: growthExamFamily,
    periodWeeks: growthPeriodWeeks,
  });

  // Options for Dropdowns
  const rankExamOptions = useMemo(() => {
    const list: DropdownOption[] = [{ value: 'all', label: 'All Finalized Exams (Cumulative)' }];
    if (rankData?.availableExams) {
      rankData.availableExams.forEach((ex: any) => {
        list.push({
          value: ex.id,
          label: `${ex.title} (${ex.subjectName})`,
        });
      });
    }
    return list;
  }, [rankData]);

  const rankSubjectOptions = useMemo(() => {
    const list: DropdownOption[] = [{ value: 'all', label: isTeacher ? 'All Assigned Subjects' : 'All Subjects' }];
    const sourceList =
      isTeacher && teacherSubjects.length > 0
        ? teacherSubjects
        : rankData?.availableSubjects || [];
    sourceList.forEach((sub: any) => {
      list.push({ value: sub.id, label: sub.name });
    });
    return list;
  }, [rankData, isTeacher, teacherSubjects]);

  const growthSubjectOptions = useMemo(() => {
    const list: DropdownOption[] = [{ value: 'all', label: isTeacher ? 'All Assigned Subjects' : 'All Subjects (Combined)' }];
    const sourceList =
      isTeacher && teacherSubjects.length > 0
        ? teacherSubjects
        : growthData?.availableSubjects || [];
    sourceList.forEach((sub: any) => {
      list.push({ value: sub.id, label: sub.name });
    });
    return list;
  }, [growthData, isTeacher, teacherSubjects]);

  const growthExamFamilyOptions: DropdownOption[] = [
    { value: 'ALL', label: 'All Test Tiers (Z-Normalized)' },
    { value: 'SPOT', label: 'Spot / Unit Tests (Single-Chapter)' },
    { value: 'PERIODIC', label: 'Periodic Tests (Multi-Chapter)' },
    { value: 'MAJOR', label: 'Major Exams (Pre-Board / Mock)' },
  ];

  const growthPeriodOptions: DropdownOption[] = [
    { value: 52, label: 'Full Academic Year' },
    { value: 8, label: 'Past 8 Weeks' },
    { value: 4, label: 'Past 4 Weeks' },
  ];

  // Active standing for Hero Cards (for teacher, top student is featured)
  const activeGrowthStanding = isTeacher
    ? (growthData?.myStanding || growthData?.rankings?.find((r: any) => r.rank === 1) || growthData?.rankings?.[0])
    : growthData?.myStanding;

  const activeRankStanding = isTeacher
    ? (rankData?.myStanding || rankData?.rankings?.find((r: any) => r.rank === 1) || rankData?.rankings?.[0])
    : rankData?.myStanding;

  return (
    <div className="space-y-5 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-2">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/90 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center p-2 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Trophy className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Leaderboard
            </h1>
          </div>
        </div>

        {/* Scope Switcher: Whole Grade vs My Section for Student, or Teacher Cohort Indicator */}
        {isTeacher ? (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shadow-2xs self-start sm:self-auto">
            <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Teacher View • Assigned Cohorts</span>
          </div>
        ) : (
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 shadow-2xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setScope('class')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer ${scope === 'class'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Whole Grade
            </button>
            <button
              type="button"
              onClick={() => setScope('batch')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer ${scope === 'batch'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs ring-1 ring-slate-200/50 dark:ring-slate-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              My Section
            </button>
          </div>
        )}
      </div>

      {/* ── Main Tab Switcher (Growth Board vs Rank Board) ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('growth')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${activeTab === 'growth'
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
            : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Rocket className="w-4 h-4" />
          <span>Growth Board</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rank')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${activeTab === 'rank'
            ? 'border-amber-500 text-amber-600 dark:text-amber-400 dark:border-amber-400'
            : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Rank Board</span>
        </button>
      </div>

      {/* ── TAB 1: GROWTH BOARD (MOMENTUM & LEARNING PROGRESS) ── */}
      {activeTab === 'growth' && (
        <div className="space-y-5">
          {/* Filter Bar with Apple-Style Custom Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold pl-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Teacher Section Filter */}
            {isTeacher && sectionOptions.length > 0 && (
              <AppleDropdown
                value={teacherBatchId}
                onChange={setTeacherBatchId}
                options={sectionOptions}
                ariaLabel="Filter by Section"
                themeColor="indigo"
                icon={<Users className="w-3.5 h-3.5 text-indigo-500" />}
              />
            )}

            <AppleDropdown
              value={growthSubjectId}
              onChange={setGrowthSubjectId}
              options={growthSubjectOptions}
              ariaLabel="Filter by Subject"
              themeColor="indigo"
              icon={isTeacher ? <BookOpen className="w-3.5 h-3.5 text-indigo-500" /> : undefined}
            />

            <AppleDropdown
              value={growthExamFamily}
              onChange={setGrowthExamFamily}
              options={growthExamFamilyOptions}
              ariaLabel="Filter by Exam Family"
              themeColor="indigo"
            />

            <AppleDropdown
              value={growthPeriodWeeks}
              onChange={setGrowthPeriodWeeks}
              options={growthPeriodOptions}
              ariaLabel="Filter by Time Period"
              themeColor="indigo"
            />

            {growthData?.scopeLabel && (
              <span className="ml-auto text-xs font-medium text-slate-400 hidden md:inline pr-1">
                Cohort: <span className="text-slate-700 dark:text-slate-200 font-semibold">{growthData.scopeLabel}</span>
              </span>
            )}
          </div>

          {/* ── My Momentum / Top Student Hero Card (Sleek Dark Glowing Apple Card) ── */}
          {activeGrowthStanding && (
            <div
              className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-indigo-500/25"
              style={{
                backgroundColor: '#0c1021',
                backgroundImage:
                  'radial-gradient(circle at 90% 10%, rgba(99, 102, 241, 0.25) 0%, transparent 45%), radial-gradient(circle at 10% 90%, rgba(139, 92, 246, 0.18) 0%, transparent 40%), linear-gradient(135deg, #1e1b4b 0%, #0f172a 55%, #181938 100%)',
                colorScheme: 'dark',
              }}
            >
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/25 text-indigo-200 border border-indigo-400/35">
                      {isTeacher ? 'Top Student Growth Standing' : 'Your Growth Standing'}
                    </span>
                    {activeGrowthStanding.rank !== null ? (
                      <span className="text-xs text-indigo-200/80 font-medium">
                        {isTeacher
                          ? `Rank #${activeGrowthStanding.rank} Top Performer in ${growthData?.scopeLabel || 'Cohort'}`
                          : `Rank #${activeGrowthStanding.rank} of ${growthData.totalStudents} in ${growthData.scopeLabel}`}
                      </span>
                    ) : (
                      <span className="text-xs text-indigo-200/60 font-medium">
                        Awaiting evaluated test data in this cohort
                      </span>
                    )}
                    {activeGrowthStanding.confidence && activeGrowthStanding.confidence !== 'NONE' && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white/10 text-indigo-200 border border-white/15">
                        Confidence: {activeGrowthStanding.confidence}
                      </span>
                    )}
                  </div>

                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                      {activeGrowthStanding.name}
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
                      {activeGrowthStanding.whyText}
                    </p>
                  </div>

                  {/* Badges Earned */}
                  {activeGrowthStanding.badges?.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {activeGrowthStanding.badges.map((b: any) => (
                        <span
                          key={b.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold bg-white/10 text-indigo-200 border border-white/15"
                        >
                          <BadgeIcon iconName={b.icon} className="w-3.5 h-3.5 text-amber-400" />
                          <span>{b.label}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score & Gauge Callout Card (Frosted Dark Glass) */}
                <div className="flex items-center gap-4 bg-slate-950/50 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 shrink-0 self-start md:self-auto shadow-inner">
                  <div className="text-center px-1">
                    <div className="text-3xl sm:text-4xl font-black text-indigo-400 tracking-tight">
                      {activeGrowthStanding.momentumScore !== null ? activeGrowthStanding.momentumScore : '—'}
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-200/75 mt-0.5">
                      Momentum Score
                    </div>
                  </div>

                  <div className="h-10 w-px bg-white/15" />

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-3 text-slate-300">
                      <span>Peer Standing:</span>
                      <span className="font-bold text-emerald-400">
                        {activeGrowthStanding.zScoreDelta !== null
                          ? activeGrowthStanding.zScoreDelta === 0
                            ? 'At Class Avg'
                            : `${activeGrowthStanding.zScoreDelta >= 0 ? '+' : ''}${activeGrowthStanding.zScoreDelta}σ`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-slate-300">
                      <span>Skill Rating:</span>
                      <span className="font-bold text-white">
                        {activeGrowthStanding.eloRating !== null ? `${activeGrowthStanding.eloRating} pts` : '—'}
                      </span>
                    </div>
                    {activeGrowthStanding.momentumScore !== null && (
                      <button
                        type="button"
                        onClick={() => setSelectedBreakdownStudent(activeGrowthStanding)}
                        className="text-[11px] text-indigo-300 hover:text-indigo-200 hover:underline font-bold pt-0.5 cursor-pointer block text-right"
                      >
                        View Breakdown →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress Snapshot Sparkline (Only if multi-exam history exists) */}
              {activeGrowthStanding.eloHistory?.length > 1 && (
                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                    <span className="font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
                      Academic Ability Trajectory Across Exams
                    </span>
                    <span className="text-[11px]">
                      {activeGrowthStanding.eloHistory.length} exams tracked
                    </span>
                  </div>
                  <div className="h-20 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeGrowthStanding.eloHistory}>
                        <defs>
                          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="examTitle" hide />
                        <YAxis domain={['auto', 'auto']} hide />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#ffffff',
                            borderColor: '#e2e8f0',
                            borderRadius: '12px',
                            fontSize: '11px',
                            color: '#0f172a',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          }}
                          formatter={(val: any) => [`${val} pts`, 'Academic ELO']}
                          labelFormatter={(l: any) => `${l}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="elo"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#eloGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Cohort Growth Rankings List ── */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Cohort Growth Rankings ({growthData?.totalStudents ?? growthData?.rankings?.length ?? 0})
              </h3>
              <span className="text-xs text-slate-400 font-medium">
                Sorted by Momentum Score
              </span>
            </div>

            {isGrowthLoading ? (
              <div className="p-8 text-center text-sm text-slate-400 space-y-2">
                <div className="animate-spin w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto" />
                <p>Computing statistical growth metrics...</p>
              </div>
            ) : growthData?.rankings?.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {growthData.rankings.map((student: any) => {
                  const isMe = !isTeacher && student.studentProfileId === growthData?.myStanding?.studentProfileId;
                  const isUnranked = student.rank === null || student.momentumScore === null;

                  return (
                    <div
                      key={student.studentProfileId}
                      className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isMe
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${student.rank === 1
                            ? 'bg-amber-400 text-amber-950 shadow-2xs font-extrabold'
                            : student.rank === 2
                              ? 'bg-slate-200 text-slate-800 font-bold'
                              : student.rank === 3
                                ? 'bg-amber-700 text-white font-bold'
                                : isUnranked
                                  ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px]'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                          {student.rank ?? '—'}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {student.name}
                            </h4>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">
                                You
                              </span>
                            )}
                            {isUnranked && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                                Awaiting Exam
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {student.batchName} • Roll {student.rollNumber || '—'}
                          </p>
                        </div>
                      </div>

                      {/* Right Details */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pl-10 sm:pl-0">
                        {/* Badges */}
                        <div className="hidden lg:flex items-center gap-1">
                          {student.badges?.map((b: any) => (
                            <span
                              key={b.id}
                              title={b.description}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            >
                              {b.label}
                            </span>
                          ))}
                        </div>

                        {/* Peer Delta */}
                        <div className="text-left sm:text-right">
                          <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {student.zScoreDelta !== null
                              ? student.zScoreDelta === 0
                                ? 'At Class Avg'
                                : `${student.zScoreDelta >= 0 ? '+' : ''}${student.zScoreDelta}σ`
                              : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">Peer Standing</div>
                        </div>

                        {/* Skill Rating (ELO) */}
                        <div className="text-left sm:text-right">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            {student.eloRating !== null ? `${student.eloRating} pts` : '—'}
                          </div>
                          <div className="text-[10px] text-slate-400">Skill Rating</div>
                        </div>

                        {/* Momentum Score Pill */}
                        <div className="text-right">
                          {student.momentumScore !== null ? (
                            <div className="px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-extrabold text-sm">
                              {student.momentumScore}
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-medium text-xs">
                              —
                            </div>
                          )}
                        </div>

                        {/* Info Button */}
                        {student.momentumScore !== null && (
                          <button
                            type="button"
                            onClick={() => setSelectedBreakdownStudent(student)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="View calculation breakdown"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No growth data available for this cohort yet. Exams must be locked and finalized to compute learning momentum." />
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: RANK BOARD (SCORE-BASED) ── */}
      {activeTab === 'rank' && (
        <div className="space-y-5">
          {/* Filter Bar for Rank Board */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold pl-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            {/* Teacher Section Filter */}
            {isTeacher && sectionOptions.length > 0 && (
              <AppleDropdown
                value={teacherBatchId}
                onChange={setTeacherBatchId}
                options={sectionOptions}
                ariaLabel="Filter by Section"
                themeColor="amber"
                icon={<Users className="w-3.5 h-3.5 text-amber-500" />}
              />
            )}

            <AppleDropdown
              value={rankExamId}
              onChange={setRankExamId}
              options={rankExamOptions}
              ariaLabel="Filter by Exam"
              themeColor="amber"
            />

            <AppleDropdown
              value={rankSubjectId}
              onChange={setRankSubjectId}
              options={rankSubjectOptions}
              ariaLabel="Filter by Subject"
              themeColor="amber"
              icon={isTeacher ? <BookOpen className="w-3.5 h-3.5 text-amber-500" /> : undefined}
            />

            {rankData?.scopeLabel && (
              <span className="ml-auto text-xs font-medium text-slate-400 hidden md:inline pr-1">
                Cohort: <span className="text-slate-700 dark:text-slate-200 font-semibold">{rankData.scopeLabel}</span>
              </span>
            )}
          </div>

          {/* ── My Standing / Top Student Hero Card (Rank Board, Sleek Dark Amber Glowing Apple Card) ── */}
          {activeRankStanding && (
            <div
              className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-xl border border-amber-600/30"
              style={{
                backgroundColor: '#140f09',
                backgroundImage:
                  'radial-gradient(circle at 90% 10%, rgba(245, 158, 11, 0.25) 0%, transparent 45%), radial-gradient(circle at 10% 90%, rgba(217, 119, 6, 0.15) 0%, transparent 40%), linear-gradient(135deg, #321903 0%, #17141f 50%, #0d0f18 100%)',
                colorScheme: 'dark',
              }}
            >
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/25 text-amber-300 border border-amber-500/35">
                      {isTeacher ? 'Top Student Exam Rank' : 'Your Exam Rank'}
                    </span>
                    {activeRankStanding.rank !== null ? (
                      <span className="text-xs text-amber-200/85 font-medium">
                        {isTeacher
                          ? `Rank #${activeRankStanding.rank} Top Score in ${rankData?.scopeLabel || 'Cohort'}`
                          : (activeRankStanding.topPercentage !== null && activeRankStanding.topPercentage < 100
                              ? `Top ${activeRankStanding.topPercentage}% in ${rankData.scopeLabel}`
                              : `Rank #${activeRankStanding.rank} in ${rankData.scopeLabel}`)}
                      </span>
                    ) : (
                      <span className="text-xs text-amber-200/60 font-medium">
                        Not evaluated in this exam filter
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {activeRankStanding.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-amber-100/85 max-w-xl leading-relaxed">
                    {activeRankStanding.examCount > 0
                      ? `Participated in ${activeRankStanding.examCount} evaluated test${activeRankStanding.examCount === 1 ? '' : 's'} with an average score of ${activeRankStanding.avgScore}%.`
                      : 'No evaluated test submissions recorded for this filter.'}
                  </p>
                </div>

                {/* Score Callout Box (Frosted Dark Glass) */}
                <div className="flex items-center gap-5 bg-slate-950/50 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-white/15 shrink-0 self-start sm:self-auto shadow-inner">
                  <div className="text-center px-1">
                    <div className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                      {activeRankStanding.rank !== null ? `#${activeRankStanding.rank}` : '—'}
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-amber-200/80 mt-0.5">
                      Cohort Rank
                    </div>
                  </div>

                  <div className="h-10 w-px bg-white/15" />

                  <div className="text-center px-1">
                    <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      {activeRankStanding.avgScore !== null ? `${activeRankStanding.avgScore}%` : '—'}
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-300 mt-0.5">
                      Average Score
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Full Score Rankings List ── */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200/90 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Exam Rankings ({rankData?.rankings?.length || 0})
              </h3>
              <span className="text-xs text-slate-400 font-medium">Sorted by Exam Score</span>
            </div>

            {isRankLoading ? (
              <div className="p-8 text-center text-sm text-slate-400 space-y-2">
                <div className="animate-spin w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full mx-auto" />
                <p>Loading exam score rankings...</p>
              </div>
            ) : rankData?.rankings?.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {rankData.rankings.map((student: any) => {
                  const isMe = !isTeacher && student.studentProfileId === rankData?.myStanding?.studentProfileId;
                  const isUnranked = student.rank === null || !student.hasParticipated;

                  return (
                    <div
                      key={student.studentProfileId}
                      className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-colors ${isMe
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-500/20'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${student.rank === 1
                            ? 'bg-amber-400 text-amber-950 font-extrabold shadow-2xs'
                            : student.rank === 2
                              ? 'bg-slate-200 text-slate-800 font-bold'
                              : student.rank === 3
                                ? 'bg-amber-700 text-white font-bold'
                                : isUnranked
                                  ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[10px]'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                        >
                          {student.rank ?? '—'}
                        </span>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {student.name}
                            </h4>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-600 text-white">
                                You
                              </span>
                            )}
                            {isUnranked && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-400">
                                Not Attempted
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {student.batchName} • Roll {student.rollNumber || '—'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xs text-slate-400 hidden sm:inline">
                          {student.examCount} {student.examCount === 1 ? 'exam' : 'exams'}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-black text-slate-900 dark:text-white">
                            {student.avgScore !== null ? `${student.avgScore}%` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState message="No scores recorded yet for this cohort. Once exams are evaluated and finalized, rankings will update automatically." />
            )}
          </div>
        </div>
      )}

      {/* ── Calculation Breakdown Modal (Apple-Style Sheet, Fully Mobile Responsive) ── */}
      {selectedBreakdownStudent && (
        <div
          onClick={() => setSelectedBreakdownStudent(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-lg w-full max-h-[90dvh] sm:max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            {/* Sticky Header */}
            <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
              <div className="min-w-0 pr-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                  Growth Score Breakdown
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {selectedBreakdownStudent.name} • Growth: {selectedBreakdownStudent.momentumScore}/100
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBreakdownStudent(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body Container */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-3.5 sm:space-y-4 flex-1 overscroll-contain custom-scrollbar">
              {/* How It Works Explainer for Students */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-slate-900 dark:text-white">How does Growth Scoring work?</strong>{' '}
                  Unlike raw marks that swing depending on test difficulty, AIOS measures actual learning progress by comparing your scores against class peers, adjusting for paper difficulty, and rewarding test attendance.
                </p>
              </div>

              {/* AIOS Engine Status Insight */}
              <div className="p-3 sm:p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold mb-1 text-indigo-700 dark:text-indigo-300">
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  <span>Current Learning Status:</span>
                </div>
                {selectedBreakdownStudent.whyText}
              </div>

              {/* 5 Growth Pillars (Mobile-Adaptive Layout) */}
              <div className="space-y-2.5 sm:space-y-3">
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">
                  How Your Growth Score is Calculated
                </h4>

                <div className="space-y-2 text-xs">
                  {/* 1. Class Comparison */}
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-white block leading-snug">
                        1. Performance vs Class Average (30% Weight)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        How your score compares to classmates in this exam
                      </span>
                    </div>
                    <div className="self-start sm:self-auto shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                        {selectedBreakdownStudent.zScoreDelta !== null
                          ? selectedBreakdownStudent.zScoreDelta === 0
                            ? 'At Class Avg (±0.0)'
                            : `${selectedBreakdownStudent.zScoreDelta >= 0 ? '+' : ''}${selectedBreakdownStudent.zScoreDelta}σ Above Class Avg`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* 2. Paper Difficulty Calibration */}
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-white block leading-snug">
                        2. Exam Paper Difficulty Adjustment (25% Weight)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        Bonus credit applied so challenging test papers don’t lower your score
                      </span>
                    </div>
                    <div className="self-start sm:self-auto shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                        Calibrated (Fair Weight)
                      </span>
                    </div>
                  </div>

                  {/* 3. Skill & Ability Rating */}
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-white block leading-snug">
                        3. Skill & Ability Rating (30% Weight)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        Your ongoing capability rating (starts at 1200 pts) that grows as you solve tougher problems
                      </span>
                    </div>
                    <div className="self-start sm:self-auto shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                        {selectedBreakdownStudent.eloRating !== null
                          ? `${selectedBreakdownStudent.eloRating} pts ${selectedBreakdownStudent.eloRating === 1200 ? '(Starting Baseline)' : ''
                          }`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* 4. Topic Velocity */}
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-white block leading-snug">
                        4. Topic Mastery Speed (15% Weight)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        How steadily you conquer syllabus topics and overcome weak areas
                      </span>
                    </div>
                    <div className="self-start sm:self-auto shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                        {selectedBreakdownStudent.masteryTrend !== null
                          ? `${selectedBreakdownStudent.masteryTrend >= 0 ? '+' : ''}${selectedBreakdownStudent.masteryTrend} Velocity`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* 5. Consistency */}
                  <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-xs sm:text-[13px] text-slate-900 dark:text-white block leading-snug">
                        5. Test Attendance & Consistency (Factor)
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                        Regular participation across scheduled evaluations
                      </span>
                    </div>
                    <div className="self-start sm:self-auto shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                        {selectedBreakdownStudent.consistency}% Attendance
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Helpful Student Tip */}
              <div className="p-3 rounded-xl sm:rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <span className="text-sm shrink-0">💡</span>
                <span className="leading-relaxed">
                  <strong>Student Tip:</strong> Attempting weekly chapter tests and practicing your weak topics will steadily increase your Skill Rating and Growth Score.
                </span>
              </div>
            </div>

            {/* Sticky Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setSelectedBreakdownStudent(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="p-12 text-center space-y-3">
      <div className="inline-flex p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
        <Trophy className="w-6 h-6" />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
        {message}
      </p>
    </div>
  );
}

function BadgeIcon({ iconName, className }: { iconName: string; className?: string }) {
  switch (iconName) {
    case 'Rocket':
      return <Rocket className={className} />;
    case 'TrendingUp':
      return <TrendingUp className={className} />;
    case 'Flame':
      return <Flame className={className} />;
    case 'Crown':
      return <Crown className={className} />;
    case 'ShieldCheck':
      return <ShieldCheck className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    default:
      return <Award className={className} />;
  }
}

// ── Specialized Teacher Leaderboard Wrapper ─────────────────────────────────
export function TeacherLeaderboard() {
  return <StudentLeaderboard isTeacher={true} />;
}

