'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft,
  Search, Users, Save, Sparkles, MoreVertical, RefreshCw, AlertTriangle,
  Lock, Shield, Check, Info, ArrowRight,
} from 'lucide-react';
import {
  useTodayAttendanceSessions,
  useAttendanceSessionDetails,
  useSaveAttendanceDraft,
  useFinalizeAttendance,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import { DatePicker } from '@/components/ui/DatePicker';
import { AppleDropdown, AppleDropdownOption } from '@/components/ui/AppleDropdown';
import { toast } from 'react-hot-toast';

type StudentStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | null;

interface StudentRow {
  studentProfileId: string;
  name: string;
  rollNumber: string | null;
  status: StudentStatus;
  avatarUrl?: string | null;
}

export function TeacherAttendance() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] ?? '';
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedBatchFilter, setSelectedBatchFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Today's sessions query
  const { data: todayResp, isLoading: sessionsLoading, refetch: refetchSessions } = useTodayAttendanceSessions({
    date: selectedDate,
  });

  const sessions = todayResp?.sessions ?? [];
  const meta = todayResp?.meta ?? { total: 0, openCount: 0, finalizedCount: 0 };

  const availableBatches = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      if (s.snapshotBatchName) {
        map.set(s.snapshotBatchName, s.snapshotBatchName);
      }
    }
    return Array.from(map.keys());
  }, [sessions]);

  const displayedSessions = useMemo(() => {
    return sessions.filter((s: any) => {
      if (selectedBatchFilter !== 'ALL' && s.snapshotBatchName !== selectedBatchFilter) {
        return false;
      }
      if (selectedStatusFilter === 'OPEN') {
        return s.derivedState === 'OPEN' || s.derivedState === 'GRACE_PERIOD';
      }
      if (selectedStatusFilter === 'FINALIZED') {
        return s.derivedState === 'FINALIZED';
      }
      if (selectedStatusFilter === 'AWAITING') {
        return s.derivedState === 'AWAITING_FINALIZATION';
      }
      return true;
    });
  }, [sessions, selectedBatchFilter, selectedStatusFilter]);

  if (activeSessionId) {
    return (
      <SessionMarkingView
        sessionId={activeSessionId}
        onBack={() => {
          setActiveSessionId(null);
          refetchSessions();
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fadein">
      {/* Top Header & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Today&apos;s Attendance</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Authoritative timetable-backed sessions for your classes &amp; substitute duties.
          </p>
        </div>
        <div className="w-48">
          <DatePicker
            value={selectedDate}
            onChange={(d) => setSelectedDate(d)}
            align="right"
          />
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Scheduled</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{meta.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
          <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Open for Marking</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{meta.openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-sky-100 bg-sky-50/20 shadow-sm">
          <p className="text-[11px] font-semibold text-sky-600 uppercase tracking-wider">Finalized</p>
          <p className="text-2xl font-bold text-sky-700 mt-1">{meta.finalizedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-amber-100 bg-amber-50/20 shadow-sm">
          <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Awaiting Submit</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{meta.awaitingCount ?? 0}</p>
        </div>
      </div>

      {/* Filter Strip */}
      {sessions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
          {/* Status Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedStatusFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All ({sessions.length})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('OPEN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedStatusFilter === 'OPEN'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Open Now ({meta.openCount})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('FINALIZED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedStatusFilter === 'FINALIZED'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
              }`}
            >
              Finalized ({meta.finalizedCount})
            </button>
            {(meta.awaitingCount ?? 0) > 0 && (
              <button
                onClick={() => setSelectedStatusFilter('AWAITING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedStatusFilter === 'AWAITING'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Awaiting Submit ({meta.awaitingCount})
              </button>
            )}
          </div>

          {/* Batch Filter Dropdown */}
          {availableBatches.length > 1 && (
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Class:</span>
              <div className="w-full sm:w-48">
                <AppleDropdown
                  value={selectedBatchFilter}
                  onChange={setSelectedBatchFilter}
                  options={[
                    { value: 'ALL', label: 'All My Classes' },
                    ...availableBatches.map((bName) => ({ value: bName, label: bName })),
                  ]}
                  placeholder="All My Classes"
                  size="sm"
                  align="right"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sessions Grid */}
      {sessionsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 max-w-md mx-auto my-8">
          <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Timetable Classes</h3>
          <p className="text-xs text-slate-500 mt-1">
            You have no timetable classes or substitute assignments scheduled for this date.
          </p>
        </div>
      ) : displayedSessions.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 max-w-md mx-auto my-8">
          <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Classes Matching Filter</h3>
          <p className="text-xs text-slate-500 mt-1">
            Try resetting your status or class filter.
          </p>
          <button
            onClick={() => { setSelectedBatchFilter('ALL'); setSelectedStatusFilter('ALL'); }}
            className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedSessions.map((session: any) => {
            const isMarkable = (session.derivedState === 'OPEN' || session.derivedState === 'GRACE_PERIOD') && session.canOperate;
            const isAwaiting = session.derivedState === 'AWAITING_FINALIZATION';
            const isFinalized = session.derivedState === 'FINALIZED';
            const isCancelled = session.derivedState === 'CANCELLED';
            const isExamOverride = session.derivedState === 'EXAM_OVERRIDE';
            const isSubstituteDuty = session.isSubstitute;
            const isBlockedBySub = session.isBlockedBySubstitute;

            const startTime = session.snapshotStartTime
              ? new Date(session.snapshotStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '--:--';
            const endTime = session.snapshotEndTime
              ? new Date(session.snapshotEndTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '--:--';

            return (
              <div
                key={session.id}
                className={`bg-white rounded-2xl p-5 border transition-all duration-200 flex flex-col justify-between ${
                  isMarkable
                    ? 'border-emerald-200 shadow-sm hover:shadow-md hover:border-emerald-300 ring-1 ring-emerald-500/10'
                    : isFinalized
                    ? 'border-slate-100 bg-slate-50/40'
                    : 'border-slate-100'
                }`}
              >
                <div>
                  {/* Card Header & Status Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{startTime} – {endTime}</span>
                      {session.snapshotRoom && (
                        <span className="text-slate-400">· {session.snapshotRoom}</span>
                      )}
                    </div>
                    <SessionStateBadge state={session.derivedState} />
                  </div>

                  {/* Class & Subject */}
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    {session.snapshotBatchName}
                  </h3>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    {session.snapshotSubjectName}
                  </p>

                  {/* Context Banners */}
                  {isSubstituteDuty && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-800">
                      <Shield className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Substitute duty for {session.snapshotTeacherName}</span>
                    </div>
                  )}

                  {isBlockedBySub && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600">
                      <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Handled by substitute ({session.substituteTeacherName || 'Substitute'})</span>
                    </div>
                  )}

                  {isExamOverride && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-50 border border-violet-200 text-[11px] font-medium text-violet-800">
                      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Official Exam: {session.examTitle || 'Exam Overlap'}</span>
                    </div>
                  )}

                  {isCancelled && session.cancelledReason && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] font-medium text-rose-700">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Cancelled: {session.cancelledReason}</span>
                    </div>
                  )}
                </div>

                {/* Bottom Action Section */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500">
                    {session.recordsCount > 0 ? (
                      <span className="font-semibold text-slate-700">
                        {session.recordsCount} marked
                      </span>
                    ) : (
                      <span>Not started</span>
                    )}
                  </div>

                  {isMarkable || isAwaiting ? (
                    <button
                      onClick={() => setActiveSessionId(session.id)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                        isAwaiting
                          ? 'bg-amber-600 text-white hover:bg-amber-700'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      <span>{isAwaiting ? 'Review & Submit' : 'Take Attendance'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : isFinalized ? (
                    <button
                      onClick={() => setActiveSessionId(session.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                    >
                      <span>View Records</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium">Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Status Badge Component ──────────────────────────────────────────────────

function SessionStateBadge({ state }: { state: string }) {
  switch (state) {
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          OPEN NOW
        </span>
      );
    case 'GRACE_PERIOD':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
          GRACE PERIOD
        </span>
      );
    case 'AWAITING_FINALIZATION':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
          AWAITING SUBMIT
        </span>
      );
    case 'FINALIZED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
          <CheckCircle2 className="w-3 h-3" />
          FINALIZED
        </span>
      );
    case 'MISSED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
          MISSED
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
          CANCELLED
        </span>
      );
    case 'EXAM_OVERRIDE':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
          OFFICIAL EXAM
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
          SCHEDULED
        </span>
      );
  }
}

// ── Fast Apple-Style Session Marking View ───────────────────────────────────

function SessionMarkingView({
  sessionId,
  onBack,
}: {
  sessionId: string;
  onBack: () => void;
}) {
  const { data: sessionDataRaw, isLoading, refetch } = useAttendanceSessionDetails(sessionId);
  const sessionData: any = sessionDataRaw;
  const saveDraftMutation = useSaveAttendanceDraft();
  const finalizeMutation = useFinalizeAttendance();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [version, setVersion] = useState<number>(1);
  const [search, setSearch] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Initialize or update local state from server payload
  useEffect(() => {
    if (sessionData?.students) {
      setStudents(
        sessionData.students.map((s: any) => ({
          studentProfileId: s.studentProfileId,
          name: s.name,
          rollNumber: s.rollNumber,
          status: s.status as StudentStatus,
          avatarUrl: s.avatarUrl,
        })),
      );
      setVersion(sessionData.session.version);
      setConflictError(null);
    }
  }, [sessionData?.session?.id, sessionData?.session?.version]);

  const session = sessionData?.session;
  const isFinalized = Boolean(session?.finalizedAt);
  const canOperate = Boolean(sessionData?.authority?.canOperate) && !isFinalized;

  // Live count computations
  const totalStudents = students.length;
  const presentCount = students.filter((s) => s.status === 'PRESENT').length;
  const absentCount = students.filter((s) => s.status === 'ABSENT').length;
  const lateCount = students.filter((s) => s.status === 'LATE').length;
  const excusedCount = students.filter((s) => s.status === 'EXCUSED').length;
  const unmarkedCount = students.filter((s) => s.status === null).length;
  const markedCount = totalStudents - unmarkedCount;
  const isAllMarked = totalStudents > 0 && unmarkedCount === 0;

  // Auto-save draft on debounced changes
  const triggerAutoSave = (updatedStudents: StudentRow[]) => {
    if (!canOperate) return;
    setHasUnsavedChanges(true);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(async () => {
      const entries = updatedStudents
        .filter((s) => s.status !== null)
        .map((s) => ({
          studentProfileId: s.studentProfileId,
          status: s.status as string,
        }));

      if (entries.length === 0) return;

      try {
        const res = await saveDraftMutation.mutateAsync({
          sessionId,
          expectedVersion: version,
          entries,
        });
        setVersion(res.version);
        setHasUnsavedChanges(false);
        setConflictError(null);
      } catch (err: any) {
        if (err?.response?.status === 409) {
          setConflictError('Session was updated elsewhere. Reload latest changes to resolve.');
        }
      }
    }, 1200);
  };

  // Primary Apple-style interaction: 1-Tap Toggle PRESENT ↔ ABSENT
  const toggleStatus = (studentProfileId: string) => {
    if (!canOperate) return;

    setStudents((prev) => {
      const next = prev.map((s) => {
        if (s.studentProfileId !== studentProfileId) return s;
        // If PRESENT -> ABSENT, if ABSENT -> PRESENT, if null/other -> PRESENT
        const nextStatus: StudentStatus = s.status === 'PRESENT' ? 'ABSENT' : 'PRESENT';
        return { ...s, status: nextStatus };
      });
      triggerAutoSave(next);
      return next;
    });
  };

  // Secondary status setter for (···) menu
  const setSecondaryStatus = (studentProfileId: string, status: StudentStatus) => {
    if (!canOperate) return;

    setStudents((prev) => {
      const next = prev.map((s) => (s.studentProfileId === studentProfileId ? { ...s, status } : s));
      triggerAutoSave(next);
      return next;
    });
  };

  // 1-Tap "Mark All Present" — the signature speed feature
  const handleMarkAllPresent = () => {
    if (!canOperate) return;

    setStudents((prev) => {
      const next = prev.map((s) => ({ ...s, status: 'PRESENT' as const }));
      triggerAutoSave(next);
      return next;
    });
    toast.success('Marked all students as Present. Tap absentees to flip.');
  };

  // Submit & Finalize
  const handleFinalize = async () => {
    if (!canOperate || !isAllMarked) return;

    try {
      await finalizeMutation.mutateAsync({
        sessionId,
        expectedVersion: version,
      });
      setIsFinalizeModalOpen(false);
      refetch();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setConflictError('Concurrency conflict during finalization. Please reload.');
      }
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(q)),
    );
  }, [students, search]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-4">
        <div className="h-20 bg-slate-100 animate-pulse rounded-2xl" />
        <div className="h-96 bg-slate-100 animate-pulse rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#f8fafc]">
      {/* ── Sticky Apple-Style Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-sm transition-all">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          {/* Top Row: Back button, Title & Autosave status */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors active:scale-95"
                title="Back to Sessions"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {session?.batchName} · {session?.subjectName}
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  {session?.date} · {session?.teacherName}
                </p>
              </div>
            </div>

            {/* Autosave Status Pill */}
            <div className="flex items-center gap-2">
              {saveDraftMutation.isPending || hasUnsavedChanges ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                  <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />
                  Saving...
                </span>
              ) : isFinalized ? (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-800">
                  <Lock className="w-3 h-3" />
                  Finalized &amp; Published
                </span>
              ) : (
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                  <Check className="w-3 h-3" />
                  Saved
                </span>
              )}
            </div>
          </div>

          {/* Conflict Banner if OCC fails */}
          {conflictError && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between gap-2 text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{conflictError}</span>
              </div>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 bg-rose-600 text-white rounded-lg font-semibold hover:bg-rose-700 transition-colors"
              >
                Reload Latest
              </button>
            </div>
          )}

          {/* Stats Bar & Action Strip */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            {/* Counts */}
            <div className="flex items-center gap-2 sm:gap-3 text-xs font-semibold">
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                Present: {presentCount}
              </span>
              <span className="text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg">
                Absent: {absentCount}
              </span>
              {lateCount > 0 && (
                <span className="text-amber-700 bg-amber-50 px-2 py-1 rounded-lg">
                  Late: {lateCount}
                </span>
              )}
              {excusedCount > 0 && (
                <span className="text-sky-700 bg-sky-50 px-2 py-1 rounded-lg">
                  Excused: {excusedCount}
                </span>
              )}
              <span className="text-slate-500 font-medium">
                {markedCount} / {totalStudents} marked
              </span>
            </div>

            {/* Header Actions */}
            {canOperate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkAllPresent}
                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all active:scale-95"
                >
                  Mark All Present
                </button>
                <button
                  disabled={!isAllMarked || finalizeMutation.isPending}
                  onClick={() => setIsFinalizeModalOpen(true)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 ${
                    isAllMarked
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700 ring-2 ring-emerald-500/20'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                  title={isAllMarked ? 'Submit and publish attendance' : 'All students must be marked to submit'}
                >
                  Submit Attendance
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Student Roster Content ──────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Search Input */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or roll no..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>

        {/* Student Roster Cards */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 overflow-hidden">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              No matching students found in this roster.
            </div>
          ) : (
            filteredStudents.map((student) => {
              const isPresent = student.status === 'PRESENT';
              const isAbsent = student.status === 'ABSENT';
              const isLate = student.status === 'LATE';
              const isExcused = student.status === 'EXCUSED';

              return (
                <div
                  key={student.studentProfileId}
                  className="px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  {/* Student Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {student.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {student.name}
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Roll: {student.rollNumber || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Right Actions: Segmented Toggle + Overflow */}
                  <div className="flex items-center gap-2">
                    {/* iOS / Apple-Style Fast Segmented Toggle */}
                    <div className="relative inline-flex p-1 bg-slate-100 rounded-xl select-none">
                      <button
                        type="button"
                        disabled={!canOperate}
                        onClick={() => toggleStatus(student.studentProfileId)}
                        aria-label={`Mark ${student.name} ${isPresent ? 'Absent' : 'Present'}`}
                        className={`relative z-10 min-w-[70px] sm:min-w-[80px] h-9 px-3 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                          isPresent
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Check className={`w-3.5 h-3.5 ${isPresent ? 'opacity-100' : 'opacity-0'}`} />
                        <span>Present</span>
                      </button>

                      <button
                        type="button"
                        disabled={!canOperate}
                        onClick={() => toggleStatus(student.studentProfileId)}
                        aria-label={`Mark ${student.name} Absent`}
                        className={`relative z-10 min-w-[70px] sm:min-w-[80px] h-9 px-3 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-1 ${
                          isAbsent
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <XCircle className={`w-3.5 h-3.5 ${isAbsent ? 'opacity-100' : 'opacity-0'}`} />
                        <span>Absent</span>
                      </button>
                    </div>

                    {/* Secondary Status Badge (if LATE or EXCUSED) */}
                    {isLate && (
                      <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Late
                      </span>
                    )}
                    {isExcused && (
                      <span className="px-2 py-1 rounded-lg bg-sky-100 text-sky-800 text-[10px] font-bold">
                        Excused
                      </span>
                    )}

                    {/* Compact Secondary Menu (···) */}
                    {canOperate && (
                      <SecondaryStatusDropdown
                        onSelect={(st) => setSecondaryStatus(student.studentProfileId, st)}
                      />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* ── Finalization Confirmation Modal ──────────────────────────────────── */}
      {isFinalizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadein">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Finalize &amp; Publish Attendance?</h3>
              <p className="text-xs text-slate-500 mt-1">
                You are submitting attendance for <span className="font-semibold text-slate-800">{totalStudents}</span> students:
              </p>
              <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs font-medium text-slate-700">
                <div className="flex justify-between"><span>Present:</span> <span className="font-bold text-emerald-700">{presentCount}</span></div>
                <div className="flex justify-between"><span>Absent:</span> <span className="font-bold text-rose-700">{absentCount}</span></div>
                {lateCount > 0 && <div className="flex justify-between"><span>Late:</span> <span className="font-bold text-amber-700">{lateCount}</span></div>}
                {excusedCount > 0 && <div className="flex justify-between"><span>Excused:</span> <span className="font-bold text-sky-700">{excusedCount}</span></div>}
              </div>
              <p className="text-[11px] text-slate-400 mt-3">
                Once finalized, editing will be locked. Records will become visible to students immediately.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsFinalizeModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={finalizeMutation.isPending}
                onClick={handleFinalize}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-md active:scale-95"
              >
                {finalizeMutation.isPending ? 'Publishing...' : 'Confirm & Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Secondary Status Overflow Dropdown ──────────────────────────────────────

function SecondaryStatusDropdown({
  onSelect,
}: {
  onSelect: (status: StudentStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-36 bg-white rounded-xl shadow-lg border border-slate-100 p-1 space-y-0.5 text-xs font-semibold animate-scalein">
          <button
            onClick={() => {
              onSelect('LATE');
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            Mark Late
          </button>
          <button
            onClick={() => {
              onSelect('EXCUSED');
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 rounded-lg text-sky-700 hover:bg-sky-50 transition-colors flex items-center gap-1.5"
          >
            <Shield className="w-3.5 h-3.5" />
            Mark Excused
          </button>
          <button
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Clear / Unmark
          </button>
        </div>
      )}
    </div>
  );
}
