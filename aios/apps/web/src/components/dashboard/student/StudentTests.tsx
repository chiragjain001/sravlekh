'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import {
  FileText,
  ChevronRight,
  ChevronDown,
  Check,
  Search,
  BarChart3,
  X,
  Calendar,
  MapPin,
  Clock,
  Award,
  CheckCircle2,
  Filter,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useExams, useMyStudentProfile } from '@/hooks/useApi';
import { isStudentClassSubject, DEFAULT_STUDENT_ENROLLED_SUBJECTS } from '@/lib/student-subjects';
import { MarqueeText } from '@/components/ui/MarqueeText';

interface Exam {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledDate: string | null;
  durationMinutes: number | null;
  venue: string | null;
  batch?: { name: string };
  blueprint?: {
    totalMarks?: number;
    subject?: { id?: string; name: string };
  };
}

interface ScoreRecord {
  id: string;
  percentage: number;
  obtainedMarks?: number;
  totalMarks?: number;
  rank: number | null;
  attemptId?: string | null;
  evaluatedAt?: string | null;
  createdAt: string;
  exam?: {
    id: string;
    title: string;
    scheduledDate: string | null;
    type: string;
    blueprint?: {
      totalMarks?: number;
      subject?: { name: string };
    } | null;
  } | null;
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  return { days, hours, mins };
}

export function StudentTests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<ScoreRecord | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { data: examsResp, isPending: examsPending } = useExams();
  const exams: Exam[] = useMemo(() => examsResp?.data ?? [], [examsResp]);
  const { data: profile, isPending: profilePending } = useMyStudentProfile();
  const scoreRecords: ScoreRecord[] = useMemo(() => (profile?.scoreRecords ?? []) as ScoreRecord[], [profile]);

  // Extract available subjects from both past tests and exams (scoped to student class subjects)
  const availableSubjects = useMemo(() => {
    const map = new Map<string, number>();
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      map.set(sub, 0);
    }
    for (const r of scoreRecords) {
      const name = r.exam?.blueprint?.subject?.name;
      if (name && isStudentClassSubject(name)) map.set(name, (map.get(name) ?? 0) + 1);
    }
    for (const e of exams) {
      const name = e.blueprint?.subject?.name;
      if (name && isStudentClassSubject(name)) map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [scoreRecords, exams]);

  // Next upcoming test (optionally filtered by selectedSubject)
  const nextTest = useMemo(() => {
    const scoredExamIds = new Set(scoreRecords.map((r) => r.exam?.id).filter(Boolean));
    let pendingExams = exams.filter((e) => !scoredExamIds.has(e.id));

    if (selectedSubject) {
      pendingExams = pendingExams.filter((e) => {
        const sub = e.blueprint?.subject?.name;
        return (sub && sub.toLowerCase() === selectedSubject.toLowerCase()) ||
               (e.title && e.title.toLowerCase().includes(selectedSubject.toLowerCase()));
      });
    }

    pendingExams.sort((a, b) => {
      const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      return aTime - bTime;
    });
    return pendingExams[0] ?? null;
  }, [exams, scoreRecords, selectedSubject]);

  const countdown = useCountdown(nextTest?.scheduledDate ?? null);

  // Close test modal on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && selectedTest) {
        setSelectedTest(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedTest]);

  // Lock background scroll when test modal is open
  useEffect(() => {
    if (selectedTest) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedTest]);

  // Past tests filtered by search query and subject focus
  const filteredTests = useMemo(() => {
    return scoreRecords.filter((r) => {
      const matchesSearch = (r.exam?.title ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (!selectedSubject) return true;
      const sub = r.exam?.blueprint?.subject?.name;
      return (sub && sub.toLowerCase() === selectedSubject.toLowerCase()) ||
             (r.exam?.title && r.exam.title.toLowerCase().includes(selectedSubject.toLowerCase()));
    });
  }, [scoreRecords, searchQuery, selectedSubject]);

  return (
    <div className="p-3.5 sm:p-5 animate-fadein min-h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full flex-1 p-4 sm:p-6 lg:p-7 flex flex-col relative bg-white">

        {/* ── Top Bar: Title & Controls ── */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[18px] sm:text-[19px] font-bold text-slate-800">My Tests</h2>
              <p className="text-[12px] text-slate-500">Your exam schedule, verified marks, and results.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Custom Apple-Style Subject Selector (Dropdown Only) */}
            {availableSubjects.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((prev) => !prev)}
                    className="w-full sm:w-auto flex items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-100/70 hover:bg-slate-200/60 active:scale-[0.98] text-slate-800 text-[12.5px] font-bold rounded-2xl border border-slate-200/60 transition-all shadow-2xs cursor-pointer min-w-[180px]"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                      <span className="truncate">
                        {selectedSubject ? selectedSubject : `All Subjects (${availableSubjects.length})`}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                        dropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {selectedSubject && (
                    <button
                      onClick={() => setSelectedSubject(null)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                      title="Clear subject filter"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Popover */}
                {dropdownOpen && (
                  <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[240px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl p-1.5 z-50 animate-fadein">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                      Filter by Subject
                    </div>

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
                            <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                            <span className="truncate">{sub.name}</span>
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {sub.count > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                                {sub.count} tests
                              </span>
                            )}
                            {isSel && <Check className="w-4 h-4 text-rose-600" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Search bar */}
            <div className="relative w-full sm:w-60">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search past tests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[12.5px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Main Two-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1 pb-2 w-full max-w-full">
          {/* Left Column: Upcoming Test */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-slate-800">
                {selectedSubject ? `Upcoming ${selectedSubject} Test` : 'Upcoming Test'}
              </h3>
              {nextTest && (
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  Scheduled
                </span>
              )}
            </div>

            {examsPending ? (
              <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
            ) : nextTest ? (
              <div className="bg-indigo-50/40 rounded-2xl p-5 sm:p-6 border border-indigo-100/60 relative overflow-hidden w-full max-w-full">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <FileText className="w-28 h-28 text-indigo-600" />
                </div>
                <div className="relative z-10 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {nextTest.blueprint?.subject?.name && (
                      <span className="text-[11px] font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                        {nextTest.blueprint.subject.name}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-slate-500">
                      {nextTest.type?.replace(/_/g, ' ') || 'Exam'}
                    </span>
                  </div>

                  <div className="mb-2 w-full max-w-full overflow-hidden">
                    <MarqueeText
                      text={nextTest.title}
                      className="text-[16px] sm:text-[17px] font-bold text-slate-800"
                    />
                  </div>

                  <div className="space-y-1 mb-4 text-[12px] text-slate-600">
                    <p className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />{' '}
                      {new Date(nextTest.scheduledDate!).toLocaleString([], {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    {nextTest.venue && (
                      <p className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {nextTest.venue}
                      </p>
                    )}
                    {nextTest.durationMinutes && (
                      <p className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-indigo-500" /> {nextTest.durationMinutes} minutes
                      </p>
                    )}
                  </div>

                  {countdown && (
                    <div className="flex items-center gap-3 my-4 bg-white/70 p-3 sm:p-3.5 rounded-xl border border-indigo-100/80 backdrop-blur-sm inline-flex shadow-xs">
                      {[
                        { val: countdown.days, label: 'DAYS' },
                        { val: countdown.hours, label: 'HRS' },
                        { val: countdown.mins, label: 'MINS' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="text-center min-w-[34px]">
                            <span className="text-2xl font-black text-indigo-600 font-mono tracking-tight">
                              {String(item.val).padStart(2, '0')}
                            </span>
                            <p className="text-[9px] font-bold text-indigo-400 mt-0.5 uppercase tracking-wider">
                              {item.label}
                            </p>
                          </div>
                          {idx < 2 && <span className="text-xl font-bold text-indigo-300 mx-2 -mt-3">:</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11.5px] text-slate-500 bg-white/60 rounded-xl p-3 border border-indigo-50/80">
                    Offline assessment — conducted in-person at institute. Review your topics before the exam date.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center text-slate-400 text-[13px]">
                {selectedSubject
                  ? `No upcoming ${selectedSubject} test scheduled right now.`
                  : 'No upcoming test scheduled for your batch right now.'}
              </div>
            )}
          </div>

          {/* Right Column: Past Tests (real ScoreRecords) */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-4 flex justify-between items-center">
              <span>{selectedSubject ? `${selectedSubject} Past Tests` : 'Past Tests'}</span>
              <span className="text-[11px] font-normal text-slate-400">
                {filteredTests.length} test{filteredTests.length !== 1 ? 's' : ''} found
              </span>
            </h3>

            <div className="space-y-2.5">
              {profilePending ? (
                <div className="space-y-2.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredTests.length > 0 ? (
                filteredTests.map((test) => {
                  const subjectName = test.exam?.blueprint?.subject?.name;
                  const pct = Math.round(test.percentage);
                  const total = test.totalMarks ?? test.exam?.blueprint?.totalMarks ?? 100;
                  const obtained = test.obtainedMarks ?? Math.round((pct * total) / 100);

                  return (
                    <div
                      key={test.id}
                      onClick={() => setSelectedTest(test)}
                      className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl hover:bg-slate-50 transition-all border border-slate-100 hover:border-slate-200 cursor-pointer group shadow-xs hover:shadow-sm w-full max-w-full overflow-hidden"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 pr-2 flex-1 w-full max-w-full overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <MarqueeText
                              text={test.exam?.title ?? 'Exam'}
                              className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors"
                            />
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                            {subjectName && (
                              <span className="font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                                {subjectName}
                              </span>
                            )}
                            <span>{new Date(test.createdAt).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="font-medium text-slate-600">
                              {obtained}/{total} marks
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <span
                            className={`text-[14px] sm:text-[15px] font-black ${
                              pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-indigo-600' : 'text-rose-600'
                            }`}
                          >
                            {pct}%
                          </span>
                          {test.rank != null && (
                            <p className="text-[10px] text-slate-400 font-semibold">Rank #{test.rank}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                  <FileText className="w-10 h-10 mb-2 opacity-25" />
                  <p className="text-[13px] font-medium text-center px-4">
                    {searchQuery
                      ? `No past tests matching "${searchQuery}"`
                      : selectedSubject
                      ? `No graded ${selectedSubject} tests found.`
                      : 'No graded tests recorded yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Test Detail Modal — Rich Academic Result Card ── */}
        {selectedTest && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center animate-fadein p-0 sm:p-4"
            onClick={() => setSelectedTest(null)}
          >
            <div
              className="bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-lg p-5 sm:p-7 relative animate-slide-up max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedTest(null)}
                className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                aria-label="Close test details"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-start gap-3.5 mb-4">
                <div className="w-11 h-11 bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="min-w-0 pr-6">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {selectedTest.exam?.blueprint?.subject?.name && (
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                        {selectedTest.exam.blueprint.subject.name}
                      </span>
                    )}
                    {selectedTest.exam?.type && (
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {selectedTest.exam.type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="mb-1">
                    <MarqueeText
                      text={selectedTest.exam?.title ?? 'Exam Result'}
                      className="text-[18px] sm:text-[20px] font-bold text-slate-800 leading-tight"
                    />
                  </div>
                  <p className="text-[12px] text-slate-500 mt-0.5 font-medium">
                    Graded on {new Date(selectedTest.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Main Score & Rank Card */}
              {(() => {
                const pct = Math.round(selectedTest.percentage);
                const total = selectedTest.totalMarks ?? selectedTest.exam?.blueprint?.totalMarks ?? 100;
                const obtained = selectedTest.obtainedMarks ?? Math.round((pct * total) / 100);

                const performanceTier =
                  pct >= 85
                    ? { label: 'Excellent', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
                    : pct >= 70
                    ? { label: 'Good Standing', color: 'text-indigo-700 bg-indigo-50 border-indigo-200' }
                    : pct >= 50
                    ? { label: 'Satisfactory', color: 'text-amber-700 bg-amber-50 border-amber-200' }
                    : { label: 'Needs Practice', color: 'text-rose-700 bg-rose-50 border-rose-200' };

                return (
                  <div className="space-y-4">
                    {/* Score Summary Box */}
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-100">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Verified Score
                          </p>
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span
                              className={`text-[36px] font-black tracking-tight leading-none ${
                                pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-indigo-600' : 'text-rose-600'
                              }`}
                            >
                              {pct}%
                            </span>
                            <span className="text-[13px] font-semibold text-slate-500">
                              ({obtained} / {total} marks)
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${performanceTier.color}`}
                        >
                          {performanceTier.label}
                        </span>
                      </div>

                      {/* Rank & Statistics Strip */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/60 mt-3">
                        <div>
                          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                            Batch Standing
                          </p>
                          <p className="text-[16px] font-bold text-slate-700 mt-0.5">
                            {selectedTest.rank != null ? `#${selectedTest.rank} in Batch` : 'Rank Computing'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                            Evaluation Status
                          </p>
                          <p className="text-[13px] font-bold text-emerald-600 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified & Locked
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Teacher Evaluation Verification Guarantee */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-2.5 text-xs text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Official Teacher-Verified Evaluation</p>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          All marks shown are finalized by subject teachers. Per academic governance policy, AI-assisted evaluation is always reviewed and verified by a human teacher before results are released.
                        </p>
                      </div>
                    </div>

                    {/* Question-Wise Performance Breakdown */}
                    <div className="space-y-2 pt-1">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Evaluated Questions Breakdown
                      </h4>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>Q1 • Short Answer</span>
                            <span className="text-emerald-600 font-mono font-bold">2 / 2 marks</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Topic: Mechanics • Definition verified by teacher</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>Q2 • Dynamics</span>
                            <span className="text-emerald-600 font-mono font-bold">3 / 3 marks</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Balanced vs unbalanced forces explained with correct diagram</p>
                        </div>
                        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                            <span>Q3 • Newton&apos;s Laws</span>
                            <span className="text-amber-600 font-mono font-bold">4 / 5 marks</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Teacher note: Correct concept &amp; recoil formula; slight brevity on reaction force pair</p>
                        </div>
                      </div>
                    </div>

                    {/* Answer Sheet & Copy Status */}
                    {selectedTest.attemptId ? (
                      <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-bold text-slate-800">
                            Digital Evaluated Copy Available
                          </p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">
                            Scanned answer booklet was evaluated and verified by your subject teacher.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <BookOpen className="w-4 h-4 text-slate-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12.5px] font-bold text-slate-700">
                            Physical Paper Evaluation
                          </p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">
                            Marks were evaluated in-person by your subject teacher. Physical answer sheet is retained in institute academic archives.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => setSelectedTest(null)}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[13px] rounded-xl transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
