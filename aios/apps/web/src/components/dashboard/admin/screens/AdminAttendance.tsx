'use client';

import React, { useState, useMemo } from 'react';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertCircle,
  Search, Users, Shield, ArrowRight, Check, Lock, AlertTriangle,
  Sparkles, Filter, MoreVertical, Edit2, ShieldAlert, BarChart2,
  List, Eye, Plus, UserCheck, X, FileSpreadsheet, ShieldCheck, Key, Settings, SlidersHorizontal,
} from 'lucide-react';
import {
  useTodayAttendanceSessions,
  useAttendanceSessionDetails,
  useAwaitingFinalizationSessions,
  useMissingAttendanceSessions,
  useDetectMissingAttendance,
  useFinalizeAttendance,
  useCorrectAttendanceRecord,
  useCreateTimetableException,
  useAdminOverrideAttendanceSession,
  useBatches,
  useTeachers,
  useAttendanceSummary,
  useStudents,
  usePermissionGrants,
  useCreatePermissionGrant,
  useRevokePermissionGrant,
  useAttendancePolicy,
  useUpdateAttendancePolicy,
} from '@/hooks/useApi';
import { DatePicker } from '@/components/ui/DatePicker';
import { AppleDropdown, AppleDropdownOption } from '@/components/ui/AppleDropdown';
import { toast } from 'react-hot-toast';

type AdminTab = 'overview' | 'awaiting' | 'missing' | 'register' | 'explorer' | 'permissions' | 'summary';

export function AdminAttendance() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0] ?? '';
  });
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');

  // Selected session for Inspect / Edit / Override
  const [inspectingSessionId, setInspectingSessionId] = useState<string | null>(null);

  // Modals state
  const [substituteModalSession, setSubstituteModalSession] = useState<any | null>(null);
  const [overrideModalSession, setOverrideModalSession] = useState<any | null>(null);

  // Queries
  const { data: todayResp, isLoading: sessionsLoading, refetch: refetchToday } = useTodayAttendanceSessions({
    date: selectedDate,
    batchId: selectedBatchId || undefined,
  });

  const { data: awaitingListRaw, isLoading: awaitingLoading, refetch: refetchAwaiting } = useAwaitingFinalizationSessions();
  const { data: missingListRaw, isLoading: missingLoading, refetch: refetchMissing } = useMissingAttendanceSessions();
  const awaitingList: any[] = (awaitingListRaw as any) ?? [];
  const missingList: any[] = (missingListRaw as any) ?? [];
  const { data: batchesResp } = useBatches();
  const { data: teachersResp } = useTeachers();

  const batches = batchesResp?.data ?? batchesResp ?? [];
  const teachers = teachersResp?.data ?? teachersResp ?? [];

  const detectMissingMutation = useDetectMissingAttendance();
  const finalizeMutation = useFinalizeAttendance();

  const sessions = todayResp?.sessions ?? [];
  const meta = todayResp?.meta ?? { total: 0, openCount: 0, finalizedCount: 0, awaitingCount: 0, missedCount: 0, cancelledCount: 0 };

  // Overview Filters State
  const [overviewBatchId, setOverviewBatchId] = useState<string>('');
  const [overviewTeacherId, setOverviewTeacherId] = useState<string>('');
  const [overviewStatus, setOverviewStatus] = useState<string>('ALL');

  const batchFilterOptions: AppleDropdownOption[] = useMemo(() => [
    { value: '', label: 'All Classes/Batches' },
    ...batches.map((b: any) => ({
      value: b.id,
      label: b.name,
      sublabel: b.academicYear ? `Academic Year: ${b.academicYear}` : undefined,
    })),
  ], [batches]);

  const teacherFilterOptions: AppleDropdownOption[] = useMemo(() => [
    { value: '', label: 'All Teachers' },
    ...teachers.map((t: any) => ({
      value: t.userId || t.id,
      label: t.user?.name || t.name,
      sublabel: t.user?.email || t.email,
    })),
  ], [teachers]);

  const filteredOverviewSessions = useMemo(() => {
    return sessions.filter((s: any) => {
      if (overviewBatchId && s.batchId !== overviewBatchId) return false;
      if (overviewTeacherId && s.snapshotTeacherUserId !== overviewTeacherId && s.substituteUserId !== overviewTeacherId) return false;
      if (overviewStatus === 'OPEN' && !(s.derivedState === 'OPEN' || s.derivedState === 'GRACE_PERIOD')) return false;
      if (overviewStatus === 'FINALIZED' && s.derivedState !== 'FINALIZED') return false;
      if (overviewStatus === 'AWAITING' && s.derivedState !== 'AWAITING_FINALIZATION') return false;
      if (overviewStatus === 'MISSED' && s.derivedState !== 'MISSED') return false;
      if (overviewStatus === 'CANCELLED' && s.derivedState !== 'CANCELLED') return false;
      return true;
    });
  }, [sessions, overviewBatchId, overviewTeacherId, overviewStatus]);

  // 1-Click Finalize from Awaiting tab
  const handleQuickFinalize = async (session: any) => {
    try {
      await finalizeMutation.mutateAsync({
        sessionId: session.id,
        expectedVersion: session.version,
      });
      refetchToday();
      refetchAwaiting();
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fadein">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Attendance Control Center</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Institute-wide timetable session tracking, 1-click finalization, substitutions &amp; audited corrections.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-44">
            <DatePicker value={selectedDate} onChange={(d) => setSelectedDate(d)} align="right" />
          </div>
          <button
            onClick={() => detectMissingMutation.mutate()}
            disabled={detectMissingMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95"
            title="Scan for missing attendance and dispatch teacher alerts"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
            <span>{detectMissingMutation.isPending ? 'Scanning...' : 'Scan Missing'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Slots</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{meta.total}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 bg-emerald-50/20 shadow-sm">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Open</p>
          <p className="text-2xl font-extrabold text-emerald-700 mt-1">{meta.openCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-sky-100 bg-sky-50/20 shadow-sm">
          <p className="text-[10px] font-bold text-sky-600 uppercase tracking-wider">Finalized</p>
          <p className="text-2xl font-extrabold text-sky-700 mt-1">{meta.finalizedCount}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 bg-indigo-50/20 shadow-sm cursor-pointer hover:border-indigo-300 transition-all" onClick={() => setActiveTab('awaiting')}>
          <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Awaiting Submit</p>
          <p className="text-2xl font-extrabold text-indigo-700 mt-1">{meta.awaitingCount ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-rose-100 bg-rose-50/20 shadow-sm cursor-pointer hover:border-rose-300 transition-all" onClick={() => setActiveTab('missing')}>
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Missed</p>
          <p className="text-2xl font-extrabold text-rose-700 mt-1">{meta.missedCount ?? 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cancelled</p>
          <p className="text-2xl font-extrabold text-slate-700 mt-1">{meta.cancelledCount ?? 0}</p>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto max-w-fit">
        <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Today's Overview" count={sessions.length} />
        <TabButton active={activeTab === 'awaiting'} onClick={() => setActiveTab('awaiting')} label="Awaiting Finalization" count={awaitingList?.length} highlight="indigo" />
        <TabButton active={activeTab === 'missing'} onClick={() => setActiveTab('missing')} label="Missing Attendance" count={missingList?.length} highlight="rose" />
        <TabButton active={activeTab === 'register'} onClick={() => setActiveTab('register')} label="Class Master Register" />
        <TabButton active={activeTab === 'explorer'} onClick={() => setActiveTab('explorer')} label="Session Explorer" />
        <TabButton active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} label="Policy & Permissions" />
        <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} label="Analytics Summary" />
      </div>

      {/* ── TAB 1: Today's Overview Grid ───────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick Filter Bar */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
            {/* Status Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
              <button
                onClick={() => setOverviewStatus('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  overviewStatus === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({sessions.length})
              </button>
              <button
                onClick={() => setOverviewStatus('OPEN')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  overviewStatus === 'OPEN'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Open ({meta.openCount})
              </button>
              <button
                onClick={() => setOverviewStatus('FINALIZED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  overviewStatus === 'FINALIZED'
                    ? 'bg-sky-600 text-white shadow-2xs'
                    : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                }`}
              >
                Finalized ({meta.finalizedCount})
              </button>
              <button
                onClick={() => setOverviewStatus('AWAITING')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  overviewStatus === 'AWAITING'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                }`}
              >
                Awaiting ({meta.awaitingCount ?? 0})
              </button>
              <button
                onClick={() => setOverviewStatus('MISSED')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  overviewStatus === 'MISSED'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Missed ({meta.missedCount ?? 0})
              </button>
            </div>

            {/* Dropdown Filters (Batch & Teacher) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2 w-full xl:w-auto shrink-0">
              <div className="w-full sm:w-auto md:w-[210px]">
                <AppleDropdown
                  value={overviewBatchId}
                  onChange={setOverviewBatchId}
                  options={batchFilterOptions}
                  placeholder="All Classes/Batches"
                  size="sm"
                  searchable
                  align="right"
                />
              </div>

              <div className="w-full sm:w-auto md:w-[190px]">
                <AppleDropdown
                  value={overviewTeacherId}
                  onChange={setOverviewTeacherId}
                  options={teacherFilterOptions}
                  placeholder="All Teachers"
                  size="sm"
                  searchable
                  align="right"
                />
              </div>

              {(overviewBatchId || overviewTeacherId || overviewStatus !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => { setOverviewBatchId(''); setOverviewTeacherId(''); setOverviewStatus('ALL'); }}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-all cursor-pointer h-[38px] sm:h-auto"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {sessionsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="h-44 bg-slate-100 animate-pulse rounded-2xl" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 max-w-md mx-auto">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Sessions Found</h3>
              <p className="text-xs text-slate-500 mt-1">No timetable classes scheduled for this date.</p>
            </div>
          ) : filteredOverviewSessions.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 max-w-md mx-auto">
              <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No Classes Matching Filter</h3>
              <p className="text-xs text-slate-500 mt-1">Try resetting your class, teacher, or status filter.</p>
              <button
                onClick={() => { setOverviewBatchId(''); setOverviewTeacherId(''); setOverviewStatus('ALL'); }}
                className="mt-3 text-xs font-semibold text-indigo-600 hover:underline"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOverviewSessions.map((session: any) => (
                <AdminSessionCard
                  key={session.id}
                  session={session}
                  onInspect={() => setInspectingSessionId(session.id)}
                  onAssignSubstitute={() => setSubstituteModalSession(session)}
                  onOverride={() => setOverrideModalSession(session)}
                  onQuickFinalize={() => handleQuickFinalize(session)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Awaiting Finalization (1-Click Action) ──────────────────── */}
      {activeTab === 'awaiting' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">100% Evaluated — Awaiting Teacher Submission</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              These classes have all student records marked, but the teacher forgot to tap Finalize. Admin can 1-click publish them to students.
            </p>
          </div>

          {awaitingLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />)}</div>
          ) : (awaitingList?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No sessions currently awaiting finalization. All marked sessions are up to date!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {awaitingList?.map((session: any) => (
                <div key={session.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{session.snapshotBatchName} · {session.snapshotSubjectName}</h4>
                    <p className="text-xs text-slate-500">
                      Teacher: {session.snapshotTeacherName} · {session.recordsCount} of {session.rosterCount} marked
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInspectingSessionId(session.id)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                      Review
                    </button>
                    <button
                      disabled={finalizeMutation.isPending}
                      onClick={() => handleQuickFinalize(session)}
                      className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-all"
                    >
                      1-Click Finalize
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Missing Attendance ─────────────────────────────────────── */}
      {activeTab === 'missing' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Missing Attendance Sessions</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Classes whose attendance window closed without being submitted.
              </p>
            </div>
            <button
              onClick={() => detectMissingMutation.mutate()}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700"
            >
              Alert Teachers
            </button>
          </div>

          {missingLoading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 bg-slate-100 animate-pulse rounded-xl" />)}</div>
          ) : (missingList?.length ?? 0) === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No missing attendance sessions detected for today! 🎉
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {missingList?.map((session: any) => (
                <div key={session.id} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{session.snapshotBatchName} · {session.snapshotSubjectName}</h4>
                    <p className="text-xs text-rose-600 font-medium">
                      Responsible: {session.substituteTeacherName || session.snapshotTeacherName} (Unmarked)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSubstituteModalSession(session)}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200"
                    >
                      Assign Substitute
                    </button>
                    <button
                      onClick={() => setInspectingSessionId(session.id)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl"
                    >
                      Admin Mark
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Class Master Register (Matrix View) ───────────────────── */}
      {activeTab === 'register' && (
        <AdminClassRegisterView
          batches={batches}
          date={selectedDate}
          onInspectSession={(id: string) => setInspectingSessionId(id)}
        />
      )}

      {/* ── TAB 5: Session Explorer (Batch / Date Filters) ────────────────── */}
      {activeTab === 'explorer' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-64">
              <AppleDropdown
                label="Filter Batch"
                value={selectedBatchId}
                onChange={setSelectedBatchId}
                options={batchFilterOptions}
                placeholder="All Batches"
                size="sm"
                searchable
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session: any) => (
              <AdminSessionCard
                key={session.id}
                session={session}
                onInspect={() => setInspectingSessionId(session.id)}
                onAssignSubstitute={() => setSubstituteModalSession(session)}
                onOverride={() => setOverrideModalSession(session)}
                onQuickFinalize={() => handleQuickFinalize(session)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 6: Policy & Teacher Permissions ────────────────────────────── */}
      {activeTab === 'permissions' && (
        <AdminPolicyPermissionsView teachers={teachers} />
      )}

      {/* ── TAB 7: Analytics Summary ───────────────────────────────────────── */}
      {activeTab === 'summary' && (
        <AdminAnalyticsSummary selectedDate={selectedDate} />
      )}

      {/* ── INSPECT / MARK / CORRECT MODAL ─────────────────────────────────── */}
      {inspectingSessionId && (
        <AdminInspectSessionModal
          sessionId={inspectingSessionId}
          onClose={() => {
            setInspectingSessionId(null);
            refetchToday();
          }}
        />
      )}

      {/* ── ASSIGN SUBSTITUTE MODAL ────────────────────────────────────────── */}
      {substituteModalSession && (
        <AdminAssignSubstituteModal
          session={substituteModalSession}
          teachers={teachers}
          onClose={() => {
            setSubstituteModalSession(null);
            refetchToday();
          }}
        />
      )}

      {/* ── OVERRIDE / CANCEL MODAL ────────────────────────────────────────── */}
      {overrideModalSession && (
        <AdminOverrideModal
          session={overrideModalSession}
          onClose={() => {
            setOverrideModalSession(null);
            refetchToday();
          }}
        />
      )}
    </div>
  );
}

// ── Tab Button Helper ────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  label,
  count,
  highlight,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  highlight?: 'indigo' | 'rose';
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
        active
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-800'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`px-1.5 py-0.2 rounded-full text-[10px] ${
            highlight === 'rose'
              ? 'bg-rose-100 text-rose-800'
              : highlight === 'indigo'
              ? 'bg-indigo-100 text-indigo-800'
              : 'bg-slate-200 text-slate-700'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Admin Session Card ───────────────────────────────────────────────────────

function AdminSessionCard({
  session,
  onInspect,
  onAssignSubstitute,
  onOverride,
  onQuickFinalize,
}: {
  session: any;
  onInspect: () => void;
  onAssignSubstitute: () => void;
  onOverride: () => void;
  onQuickFinalize: () => void;
}) {
  const isAwaiting = session.derivedState === 'AWAITING_FINALIZATION';
  const isFinalized = session.derivedState === 'FINALIZED';

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500">
            {session.snapshotStartTime ? new Date(session.snapshotStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
            {session.snapshotRoom && ` · ${session.snapshotRoom}`}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
            {session.derivedState}
          </span>
        </div>

        <h3 className="text-base font-bold text-slate-900 tracking-tight">{session.snapshotBatchName}</h3>
        <p className="text-xs font-medium text-slate-600">{session.snapshotSubjectName}</p>
        <p className="text-[11px] text-slate-400 mt-1">Teacher: {session.snapshotTeacherName}</p>

        {session.substituteUserId && (
          <div className="mt-2 text-[11px] font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
            Substitute: {session.substituteTeacherName || 'Assigned'}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium text-slate-500">
          {session.recordsCount} / {session.rosterCount} marked
        </div>

        <div className="flex items-center gap-1.5">
          {isAwaiting && (
            <button
              onClick={onQuickFinalize}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              Finalize
            </button>
          )}

          <button
            onClick={onInspect}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
            title="Inspect / Mark Session"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onAssignSubstitute}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
            title="Assign Substitute"
          >
            <UserCheck className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onOverride}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors"
            title="Cancel / Override"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Inspect Session Modal ─────────────────────────────────────────────

function AdminInspectSessionModal({
  sessionId,
  onClose,
}: {
  sessionId: string;
  onClose: () => void;
}) {
  const { data: sessionDataRaw, isLoading, refetch } = useAttendanceSessionDetails(sessionId);
  const sessionData: any = sessionDataRaw;
  const correctMutation = useCorrectAttendanceRecord();
  const [correctingStudent, setCorrectingStudent] = useState<any | null>(null);
  const [newStatus, setNewStatus] = useState<string>('PRESENT');
  const [reason, setReason] = useState<string>('');

  const session = sessionData?.session;
  const students = sessionData?.students ?? [];

  const handleCorrectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctingStudent || reason.trim().length < 10) return;

    try {
      await correctMutation.mutateAsync({
        sessionId,
        recordId: correctingStudent.recordId,
        expectedVersion: correctingStudent.recordVersion,
        status: newStatus,
        reason: reason.trim(),
      });
      setCorrectingStudent(null);
      setReason('');
      refetch();
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadein">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {session?.batchName} · {session?.subjectName}
            </h3>
            <p className="text-xs text-slate-500">
              {session?.date} · State: {session?.derivedState} · Version {session?.version}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />)}</div>
          ) : students.length === 0 ? (
            <div className="text-center text-xs text-slate-400 py-8">Roster has no students.</div>
          ) : (
            students.map((student: any) => (
              <div key={student.studentProfileId} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-slate-800">{student.name}</p>
                  <p className="text-[11px] text-slate-400">Roll: {student.rollNumber || '—'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    student.status === 'PRESENT' ? 'bg-emerald-100 text-emerald-800' :
                    student.status === 'ABSENT' ? 'bg-rose-100 text-rose-800' :
                    student.status === 'LATE' ? 'bg-amber-100 text-amber-800' :
                    student.status === 'EXCUSED' ? 'bg-sky-100 text-sky-800' :
                    'bg-slate-200 text-slate-600'
                  }`}>
                    {student.status || 'UNMARKED'}
                  </span>

                  {student.recordId && (
                    <button
                      onClick={() => {
                        setCorrectingStudent(student);
                        setNewStatus(student.status || 'PRESENT');
                        setReason('');
                      }}
                      className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
                    >
                      Correct
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Correction Sub-modal */}
        {correctingStudent && (
          <div className="p-5 border-t border-slate-100 bg-slate-50/80">
            <h4 className="text-xs font-bold text-slate-900 mb-2">
              Audited Correction for {correctingStudent.name}
            </h4>
            <form onSubmit={handleCorrectSubmit} className="space-y-3">
              <div className="flex gap-2">
                {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setNewStatus(st)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg ${
                      newStatus === st ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <input
                type="text"
                required
                minLength={10}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Mandatory reason for audit log (min 10 characters)..."
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setCorrectingStudent(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reason.trim().length < 10 || correctMutation.isPending}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-40"
                >
                  Save Audited Correction
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Admin Assign Substitute Modal ───────────────────────────────────────────

function AdminAssignSubstituteModal({
  session,
  teachers,
  onClose,
}: {
  session: any;
  teachers: any[];
  onClose: () => void;
}) {
  const [substituteUserId, setSubstituteUserId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const exceptionMutation = useCreateTimetableException();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!substituteUserId || !reason.trim() || !session.timetableSlotId) return;

    try {
      await exceptionMutation.mutateAsync({
        timetableSlotId: session.timetableSlotId,
        date: session.date,
        type: 'SUBSTITUTE',
        substituteUserId,
        reason: reason.trim(),
      });
      onClose();
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadein">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Assign Substitute Teacher</h3>
        <p className="text-xs text-slate-500">
          Assigning a substitute grants them exclusive operational authority for {session.snapshotBatchName} on {session.date}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <AppleDropdown
              label="Substitute Teacher"
              required
              value={substituteUserId}
              onChange={setSubstituteUserId}
              options={teachers.map((t: any) => ({
                value: t.userId || t.id,
                label: t.name || t.user?.name,
                sublabel: t.user?.email || t.email,
              }))}
              placeholder="Select a teacher..."
              searchable
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason</label>
            <input
              type="text"
              required
              minLength={5}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Teacher on medical leave"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl">
              Cancel
            </button>
            <button
              type="submit"
              disabled={exceptionMutation.isPending || !substituteUserId}
              className="flex-1 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
            >
              Assign
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Admin Override Modal ────────────────────────────────────────────────────

function AdminOverrideModal({
  session,
  onClose,
}: {
  session: any;
  onClose: () => void;
}) {
  const [action, setAction] = useState<'CANCEL' | 'UNCANCEL' | 'FORCE_UNLOCK'>('CANCEL');
  const [reason, setReason] = useState('');
  const overrideMutation = useAdminOverrideAttendanceSession();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) return;

    try {
      await overrideMutation.mutateAsync({
        sessionId: session.id,
        action,
        reason: reason.trim(),
      });
      onClose();
    } catch {
      // Error handled in hook
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadein">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4">
        <h3 className="text-base font-bold text-slate-900">Admin Session Override</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <AppleDropdown
              label="Action"
              required
              value={action}
              onChange={(v) => setAction(v as any)}
              options={[
                { value: 'CANCEL', label: 'Cancel Session', sublabel: 'Exclude from missed alerts' },
                { value: 'UNCANCEL', label: 'Uncancel Session', sublabel: 'Restore active schedule' },
                { value: 'FORCE_UNLOCK', label: 'Force Unlock', sublabel: 'Reopen finalized session' },
              ]}
              placeholder="Select override action..."
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Reason (min 10 chars)</label>
            <input
              type="text"
              required
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Audited justification..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-xl">
              Close
            </button>
            <button
              type="submit"
              disabled={overrideMutation.isPending || reason.trim().length < 10}
              className="flex-1 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-black rounded-xl"
            >
              Apply Override
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Admin Analytics Summary Tab ─────────────────────────────────────────────

function AdminAnalyticsSummary({ selectedDate }: { selectedDate: string }) {
  const { data: summary, isLoading } = useAttendanceSummary({
    dateFrom: selectedDate,
    dateTo: selectedDate,
  });

  if (isLoading) {
    return <div className="h-64 bg-slate-100 animate-pulse rounded-2xl" />;
  }

  const byBatch = summary?.byBatch ?? [];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
      <h3 className="text-base font-bold text-slate-900">Per-Batch Attendance Summary ({selectedDate})</h3>

      {byBatch.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">No attendance records found for this date.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {byBatch.map((b: any) => (
            <div key={b.batchId} className="py-3 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-800">{b.batchName}</h4>
                <p className="text-xs text-slate-500">{b.totalMarked} students evaluated</p>
              </div>
              <span className="text-base font-extrabold text-slate-900">{b.attendancePct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Class Master Register (Matrix / File System View) ──────────────────────

function AdminClassRegisterView({
  batches,
  date,
  onInspectSession,
}: {
  batches: any[];
  date: string;
  onInspectSession: (id: string) => void;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string>(() => batches[0]?.id || '');
  const effectiveBatchId = selectedBatchId || batches[0]?.id || '';

  const { data: batchSessionsResp, isLoading: sessionsLoading } = useTodayAttendanceSessions({
    date,
    batchId: effectiveBatchId || undefined,
  });

  const { data: studentsResp, isLoading: studentsLoading } = useStudents(
    effectiveBatchId ? { batchId: effectiveBatchId } : undefined,
  );

  const batchSessions: any[] = batchSessionsResp?.sessions ?? [];
  const studentsList: any[] = studentsResp?.data ?? (Array.isArray(studentsResp) ? studentsResp : []);

  // Sort periods in chronological order
  const sortedSessions = useMemo(() => {
    return [...batchSessions].sort((a, b) => {
      const pA = a.snapshotPeriodNumber ?? 0;
      const pB = b.snapshotPeriodNumber ?? 0;
      if (pA !== pB) return pA - pB;
      return new Date(a.snapshotStartTime).getTime() - new Date(b.snapshotStartTime).getTime();
    });
  }, [batchSessions]);

  // Merge students from session roster if available, otherwise from batch students list
  const rosterStudents = useMemo(() => {
    for (const s of sortedSessions) {
      if (s.roster && s.roster.length > 0) {
        return s.roster.map((r: any) => ({
          studentProfileId: r.studentProfileId,
          name: r.snapshotName || 'Student',
          rollNumber: r.snapshotRollNo || null,
        })).sort((a: any, b: any) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
      }
    }
    return studentsList.map((st: any) => ({
      studentProfileId: st.id,
      name: st.user?.name || st.name || 'Student',
      rollNumber: st.rollNumber || null,
    })).sort((a: any, b: any) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
  }, [sortedSessions, studentsList]);

  // Map: studentProfileId -> Map(sessionId -> status)
  const attendanceMatrix = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const session of sortedSessions) {
      if (session.records) {
        for (const rec of session.records) {
          let studentMap = map.get(rec.studentProfileId);
          if (!studentMap) {
            studentMap = new Map<string, string>();
            map.set(rec.studentProfileId, studentMap);
          }
          studentMap.set(session.id, rec.status);
        }
      }
    }
    return map;
  }, [sortedSessions]);

  const activeBatch = batches.find((b: any) => b.id === effectiveBatchId);

  // Overall attendance calculation for class today
  const classStats = useMemo(() => {
    let totalCells = 0;
    let presentCount = 0;
    for (const st of rosterStudents) {
      const stMap = attendanceMatrix.get(st.studentProfileId);
      if (stMap) {
        for (const s of sortedSessions) {
          const stStatus = stMap.get(s.id);
          if (stStatus) {
            totalCells++;
            if (stStatus === 'PRESENT') presentCount++;
            else if (stStatus === 'LATE') presentCount += 0.5;
          }
        }
      }
    }
    const pct = totalCells > 0 ? Math.round((presentCount / totalCells) * 100) : null;
    return { totalCells, presentCount, pct };
  }, [rosterStudents, sortedSessions, attendanceMatrix]);

  const STATUS_PILLS: Record<string, { label: string; bg: string; text: string }> = {
    PRESENT: { label: 'P', bg: 'bg-emerald-100 border-emerald-300', text: 'text-emerald-800' },
    ABSENT:  { label: 'A', bg: 'bg-rose-100 border-rose-300',       text: 'text-rose-800' },
    LATE:    { label: 'L', bg: 'bg-amber-100 border-amber-300',     text: 'text-amber-800' },
    EXCUSED: { label: 'E', bg: 'bg-sky-100 border-sky-300',         text: 'text-sky-800' },
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
      {/* Header and Batch Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Class Master Register (Daily Matrix)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Traditional File View
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            View period-by-period attendance across all subjects for a class on {date}.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <AppleDropdown
              label="Select Class / Section"
              value={effectiveBatchId}
              onChange={setSelectedBatchId}
              options={batches.map((b: any) => ({ value: b.id, label: b.name }))}
              placeholder="Select Class..."
              size="sm"
              searchable
            />
          </div>
        </div>
      </div>

      {/* Class Daily Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
        <div>
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Class</span>
          <p className="text-sm font-bold text-slate-900 mt-0.5">{activeBatch?.name || 'Selected Class'}</p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Roster Size</span>
          <p className="text-sm font-bold text-slate-900 mt-0.5">{rosterStudents.length} Students</p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Periods Today</span>
          <p className="text-sm font-bold text-slate-900 mt-0.5">{sortedSessions.length} Subjects Scheduled</p>
        </div>
        <div>
          <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">Overall Day Presence</span>
          <p className="text-sm font-bold text-emerald-700 mt-0.5">
            {classStats.pct !== null ? `${classStats.pct}% Present` : '— Not evaluated'}
          </p>
        </div>
      </div>

      {/* Matrix Table */}
      {sessionsLoading || studentsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : sortedSessions.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          No timetable sessions scheduled for {activeBatch?.name} on {date}.
        </div>
      ) : rosterStudents.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          No active students found in this class.
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200/80 rounded-2xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <th className="py-3 px-3 w-16 sticky left-0 bg-slate-50 z-10 border-r border-slate-200">Roll #</th>
                <th className="py-3 px-4 min-w-[160px] sticky left-16 bg-slate-50 z-10 border-r border-slate-200">Student Name</th>
                {sortedSessions.map((s, idx) => (
                  <th key={s.id} className="py-2.5 px-3 text-center min-w-[120px] border-r border-slate-200">
                    <button
                      onClick={() => onInspectSession(s.id)}
                      className="hover:text-indigo-600 cursor-pointer block mx-auto text-center"
                      title="Click to inspect period"
                    >
                      <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Period {s.snapshotPeriodNumber || idx + 1}</span>
                      <span className="block text-xs font-bold text-slate-800 truncate max-w-[110px]">{s.snapshotSubjectName}</span>
                      <span className="block text-[9.5px] text-slate-500 font-normal truncate max-w-[110px]">{s.snapshotTeacherName}</span>
                    </button>
                  </th>
                ))}
                <th className="py-3 px-3 text-center min-w-[100px] font-bold text-slate-700">Day Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rosterStudents.map((student: any) => {
                const stMap = attendanceMatrix.get(student.studentProfileId);
                let studentPresent = 0;
                let studentTotal = 0;

                return (
                  <tr key={student.studentProfileId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-500 sticky left-0 bg-white border-r border-slate-100">
                      {student.rollNumber || '—'}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-slate-800 sticky left-16 bg-white border-r border-slate-100 truncate max-w-[160px]">
                      {student.name}
                    </td>
                    {sortedSessions.map((s: any) => {
                      const stStatus = stMap?.get(s.id);
                      if (stStatus) {
                        studentTotal++;
                        if (stStatus === 'PRESENT') studentPresent++;
                        else if (stStatus === 'LATE') studentPresent += 0.5;
                      }
                      const cfg = stStatus ? STATUS_PILLS[stStatus] : null;

                      return (
                        <td key={s.id} className="py-2 px-3 text-center border-r border-slate-100">
                          {cfg ? (
                            <button
                              onClick={() => onInspectSession(s.id)}
                              className={`w-7 h-7 rounded-lg inline-flex items-center justify-center font-bold text-[11px] border ${cfg.bg} ${cfg.text} hover:scale-105 transition-all shadow-2xs`}
                              title={`${student.name}: ${stStatus} in ${s.snapshotSubjectName}`}
                            >
                              {cfg.label}
                            </button>
                          ) : (
                            <span className="text-slate-300 font-bold">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                      {studentTotal > 0 ? (
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-bold ${
                          studentPresent === studentTotal ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {studentPresent}/{studentTotal}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Policy & Teacher Permissions Tab ───────────────────────────────────────

function AdminPolicyPermissionsView({ teachers }: { teachers: any[] }) {
  const { data: grantsRaw, isLoading: grantsLoading, refetch: refetchGrants } = usePermissionGrants();
  const createGrantMutation = useCreatePermissionGrant();
  const revokeGrantMutation = useRevokePermissionGrant();

  const { data: policyData, isLoading: policyLoading } = useAttendancePolicy();
  const updatePolicyMutation = useUpdateAttendancePolicy();

  const [cutoffHour, setCutoffHour] = useState<number>(18);
  const [openBeforeMinutes, setOpenBeforeMinutes] = useState<number>(15);
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(30);
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');
  const [allowTeacherHistoricalEdit, setAllowTeacherHistoricalEdit] = useState<boolean>(false);
  const [allowFinalizedCorrection, setAllowFinalizedCorrection] = useState<boolean>(true);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Synchronize state when policyData loads or refreshes
  React.useEffect(() => {
    if (policyData) {
      setCutoffHour(typeof policyData.cutoffHour === 'number' ? policyData.cutoffHour : 18);
      setOpenBeforeMinutes(typeof policyData.openBeforeMinutes === 'number' ? policyData.openBeforeMinutes : 15);
      setGracePeriodMinutes(typeof policyData.gracePeriodMinutes === 'number' ? policyData.gracePeriodMinutes : 30);
      setTimezone(policyData.timezone || 'Asia/Kolkata');
      setAllowTeacherHistoricalEdit(!!policyData.allowTeacherHistoricalEdit);
      setAllowFinalizedCorrection(policyData.allowFinalizedCorrection !== false);
      setIsDirty(false);
    }
  }, [policyData]);

  const handleSavePolicy = async () => {
    try {
      await updatePolicyMutation.mutateAsync({
        cutoffHour,
        openBeforeMinutes,
        gracePeriodMinutes,
        timezone,
        allowTeacherHistoricalEdit,
        allowFinalizedCorrection,
      });
      setIsDirty(false);
    } catch {
      // Handled in mutation hook
    }
  };

  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedPermission, setSelectedPermission] = useState<string>('ATTENDANCE_CORRECT_HISTORICAL');

  const grants = Array.isArray(grantsRaw) ? grantsRaw : [];

  const handleGrant = async () => {
    if (!selectedTeacherId) {
      toast.error('Please select a teacher.');
      return;
    }
    try {
      await createGrantMutation.mutateAsync({
        userId: selectedTeacherId,
        permission: selectedPermission,
      });
      setSelectedTeacherId('');
      refetchGrants();
    } catch {
      // Handled in mutation hook
    }
  };

  const CAPABILITY_LABELS: Record<string, string> = {
    ATTENDANCE_CORRECT_HISTORICAL: 'Modify Past / Historical Attendance',
    ATTENDANCE_OVERRIDE: 'Override Session Timing Window',
    ATTENDANCE_ADMIN: 'Full Attendance Admin Access',
    ATTENDANCE_TAKE: 'Take Attendance (Delegate / Cover Classes)',
    ATTENDANCE_CORRECT: 'Correct Finalized Records (Same Day)',
  };

  const CUTOFF_OPTIONS = [
    { value: 12, label: '12:00 PM (Noon)' },
    { value: 13, label: '01:00 PM (13:00)' },
    { value: 14, label: '02:00 PM (14:00)' },
    { value: 15, label: '03:00 PM (15:00)' },
    { value: 16, label: '04:00 PM (16:00)' },
    { value: 17, label: '05:00 PM (17:00)' },
    { value: 18, label: '06:00 PM (18:00) — Default' },
    { value: 19, label: '07:00 PM (19:00)' },
    { value: 20, label: '08:00 PM (20:00)' },
    { value: 21, label: '09:00 PM (21:00)' },
    { value: 22, label: '10:00 PM (22:00)' },
  ];

  const TIMEZONE_OPTIONS = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +05:30)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (GST +04:00)' },
    { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT +08:00)' },
    { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
    { value: 'America/New_York', label: 'America/New_York (EST/EDT)' },
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Section 1: Daily Cutoff & Window Policy ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Attendance Timing &amp; Cutoff Policy</h3>
              {isDirty && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Rules determining when teachers are permitted to record and update sessions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSavePolicy}
              disabled={updatePolicyMutation.isPending || !isDirty}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 ${
                isDirty
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{updatePolicyMutation.isPending ? 'Saving...' : 'Save Policy Changes'}</span>
            </button>
          </div>
        </div>

        {policyLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Daily Submission Cutoff */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <AppleDropdown
                  label="Daily Submission Cutoff"
                  value={String(cutoffHour)}
                  onChange={(v) => {
                    setCutoffHour(Number(v));
                    setIsDirty(true);
                  }}
                  options={CUTOFF_OPTIONS.map((opt) => ({ value: String(opt.value), label: opt.label }))}
                  size="sm"
                />
                <p className="text-[11px] text-slate-500">
                  Teachers can freely submit attendance today until this hour before lockdown.
                </p>
              </div>

              {/* Morning Opening Window */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <AppleDropdown
                  label="Morning Early Window"
                  value={String(openBeforeMinutes)}
                  onChange={(v) => {
                    setOpenBeforeMinutes(Number(v));
                    setIsDirty(true);
                  }}
                  options={[
                    { value: '0', label: 'At Bell (0 Minutes)' },
                    { value: '5', label: '5 Minutes Early' },
                    { value: '10', label: '10 Minutes Early' },
                    { value: '15', label: '15 Minutes Early (Default)' },
                    { value: '30', label: '30 Minutes Early' },
                    { value: '60', label: '60 Minutes Early' },
                  ]}
                  size="sm"
                />
                <p className="text-[11px] text-slate-500">
                  Attendance unlocks this many minutes prior to period start.
                </p>
              </div>

              {/* Grace Period Buffer */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <AppleDropdown
                  label="Grace Period Buffer"
                  value={String(gracePeriodMinutes)}
                  onChange={(v) => {
                    setGracePeriodMinutes(Number(v));
                    setIsDirty(true);
                  }}
                  options={[
                    { value: '0', label: 'No Grace Period (0 min)' },
                    { value: '15', label: '15 Minutes' },
                    { value: '30', label: '30 Minutes (Default)' },
                    { value: '45', label: '45 Minutes' },
                    { value: '60', label: '60 Minutes' },
                    { value: '90', label: '90 Minutes' },
                  ]}
                  size="sm"
                />
                <p className="text-[11px] text-slate-500">
                  Buffer after period end before session transitions to review status.
                </p>
              </div>

              {/* Institute Timezone */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                <AppleDropdown
                  label="Institute Timezone"
                  value={timezone}
                  onChange={(v) => {
                    setTimezone(v);
                    setIsDirty(true);
                  }}
                  options={TIMEZONE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                  size="sm"
                  searchable
                />
                <p className="text-[11px] text-slate-500">
                  Local calendar day and cutoff boundary calculations timezone.
                </p>
              </div>
            </div>

            {/* Granular Policy Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/70 bg-white hover:bg-slate-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={allowTeacherHistoricalEdit}
                  onChange={(e) => {
                    setAllowTeacherHistoricalEdit(e.target.checked);
                    setIsDirty(true);
                  }}
                  className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">General Teacher Historical Editing</span>
                  <span className="text-[11px] text-slate-500">
                    If checked, assigned teachers can update attendance for past days without requiring an individual permission grant.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200/70 bg-white hover:bg-slate-50/50 cursor-pointer transition-all">
                <input
                  type="checkbox"
                  checked={allowFinalizedCorrection}
                  onChange={(e) => {
                    setAllowFinalizedCorrection(e.target.checked);
                    setIsDirty(true);
                  }}
                  className="mt-0.5 h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Permit Finalized Record Corrections</span>
                  <span className="text-[11px] text-slate-500">
                    If enabled, authorized users can submit audited corrections on already finalized sessions with mandatory justification.
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Strict Historical Protection Invariant: </span>
            Once the daily cutoff passes or a session is finalized, standard teacher editing is locked. Only administrators or teachers with the explicit &quot;Modify Past Attendance&quot; capability below can modify historical records.
          </div>
        </div>
      </div>

      {/* ── Section 2: Teacher Permissions & Authority Grants ──────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-5">
        <div className="pb-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Teacher Permission Grants</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Grant specific teachers elevated authority to modify historical attendance or override timetable timings.
          </p>
        </div>

        {/* Grant New Permission Bar */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 w-full sm:w-auto">
            <AppleDropdown
              label="Select Teacher"
              value={selectedTeacherId}
              onChange={setSelectedTeacherId}
              options={teachers.map((t: any) => ({
                value: t.userId || t.id,
                label: t.user?.name || t.name,
                sublabel: t.user?.email || 'Teacher',
              }))}
              placeholder="Choose teacher..."
              size="sm"
              searchable
            />
          </div>

          <div className="flex-1 w-full sm:w-auto">
            <AppleDropdown
              label="Capability / Power"
              value={selectedPermission}
              onChange={setSelectedPermission}
              options={[
                { value: 'ATTENDANCE_CORRECT_HISTORICAL', label: 'Modify Past / Historical Attendance' },
                { value: 'ATTENDANCE_OVERRIDE', label: 'Override Session Timing Window' },
                { value: 'ATTENDANCE_ADMIN', label: 'Full Attendance Admin Access' },
                { value: 'ATTENDANCE_TAKE', label: 'Take Attendance (Delegate / Cover Classes)' },
                { value: 'ATTENDANCE_CORRECT', label: 'Correct Finalized Records (Same Day)' },
              ]}
              size="sm"
            />
          </div>

          <div className="sm:self-end">
            <button
              onClick={handleGrant}
              disabled={createGrantMutation.isPending || !selectedTeacherId}
              className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {createGrantMutation.isPending ? 'Granting...' : 'Grant Capability'}
            </button>
          </div>
        </div>

        {/* Active Grants List */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Active Authorized Grants</h4>
          {grantsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-slate-100 animate-pulse rounded-xl" />
              ))}
            </div>
          ) : grants.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              No special permission grants assigned. All teachers currently operate strictly within normal timetable windows.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
              {grants.map((g: any) => (
                <div key={g.id} className="p-3.5 bg-white flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                      {(g.user?.name || 'T')[0]}
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-900">{g.user?.name || 'Teacher'}</h5>
                      <p className="text-[11px] text-slate-500">{g.user?.email || 'Authorized staff'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-[10.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {CAPABILITY_LABELS[g.permission] || g.permission}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                      Granted {new Date(g.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          await revokeGrantMutation.mutateAsync(g.id);
                          refetchGrants();
                        } catch {
                          // Handled in mutation hook
                        }
                      }}
                      disabled={revokeGrantMutation.isPending}
                      className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors border border-rose-200 cursor-pointer"
                      title="Revoke Permission Grant"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

