'use client';
// ─── AdminOverview — real KPI dashboard ────────────────────────────────────────
// Every tile aggregates real hooks already wired to apps/api. No revenue/fee
// figures (no billing domain exists) and no invented performance trend — the
// "Alerts" card surfaces real pending-action counts (unapproved questions,
// open doubts, unassigned teachers) instead of canned notification text.

import React from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, HelpCircle, Users, GraduationCap, Layers, CalendarClock, ClipboardList } from 'lucide-react';
import { useStudentsStats } from '@/features/students/hooks/useStudents';
import { useTeachersStats } from '@/features/teachers/hooks/useTeachers';
import { useBatchesStats } from '@/features/batches/hooks/useBatches';
import { useDoubts, useAuditLogs, useAttendanceSummary, useExams } from '@/hooks/useApi';
import { useAdminStore } from '@/store/role-stores';

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm flex flex-col min-w-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0 min-w-0">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide truncate">{title}</p>
        {action}
      </div>
      <div className="flex-1 min-h-0 min-w-0">
        {children}
      </div>
    </div>
  );
}

function AttendanceDonut() {
  const { data, isPending } = useAttendanceSummary();
  if (isPending) return <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />;
  const b = data?.statusBreakdown ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  const pieData = [
    { name: 'Present', value: b.PRESENT, fill: '#10b981' },
    { name: 'Late', value: b.LATE, fill: '#f59e0b' },
    { name: 'Absent', value: b.ABSENT, fill: '#f43f5e' },
    { name: 'Excused', value: b.EXCUSED, fill: '#3b82f6' },
  ];
  const total = pieData.reduce((s, p) => s + p.value, 0);

  return (
    <div className="h-48 flex items-center justify-between gap-3 px-1">
      <div className="relative w-28 h-28 flex-shrink-0">
        <PieChart width={112} height={112}>
          <Pie data={total > 0 ? pieData : [{ name: 'None', value: 1, fill: '#e2e8f0' }]} cx={52} cy={52} innerRadius={36} outerRadius={52} dataKey="value" strokeWidth={0}>
            {(total > 0 ? pieData : [{ fill: '#e2e8f0' }]).map((e, i) => <Cell key={i} fill={e.fill} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[16px] font-bold text-slate-800">{data?.overallAttendancePct ?? 0}%</span>
          <span className="text-[9px] text-slate-500">Avg. Attendance</span>
        </div>
      </div>
      <div className="space-y-2 flex-1 min-w-0 pr-1">
        {pieData.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-[12px] text-slate-600 truncate">{p.name}</span>
            <span className="text-[12px] font-bold text-slate-700 ml-auto pl-2 flex-shrink-0">{p.value}</span>
          </div>
        ))}
        {total === 0 && <p className="text-[11px] text-slate-400">No attendance marked yet.</p>}
      </div>
    </div>
  );
}

export function AdminOverview() {
  const { setAdminNav } = useAdminStore();
  const { data: studentStats } = useStudentsStats();
  const { data: teacherStats } = useTeachersStats();
  const { data: batchStats } = useBatchesStats();
  const { data: openDoubts } = useDoubts({ status: 'OPEN', limit: 1 });
  const { data: auditLogs } = useAuditLogs({ pageSize: 15 });
  const { data: examsData } = useExams();
  const exams: any[] = examsData?.data ?? examsData ?? [];
  const upcomingExams = exams.filter((e) => e.status === 'PUBLISHED' || e.status === 'APPROVED').length;

  // `active`, not `total`: archiving a student or teacher removes them from the
  // roster lists these cards link through to, so a KPI counting archived people
  // sends the admin to a list that disagrees with the number they just clicked.
  // The archived count is still surfaced separately in the roster snapshot below.
  const kpis = [
    {
      label: 'Active Students',
      value: studentStats?.active ?? '—',
      icon: <Users className="w-4 h-4" />,
      color: 'indigo' as const,
      onClick: () => setAdminNav('Students'),
    },
    {
      label: 'Active Teachers',
      value: teacherStats?.active ?? '—',
      icon: <GraduationCap className="w-4 h-4" />,
      color: 'emerald' as const,
      onClick: () => setAdminNav('Teachers'),
    },
    {
      label: 'Active Batches',
      value: batchStats?.active ?? '—',
      icon: <Layers className="w-4 h-4" />,
      color: 'sky' as const,
      onClick: () => setAdminNav('Batches'),
    },
    {
      label: 'Upcoming Exams',
      value: upcomingExams,
      icon: <CalendarClock className="w-4 h-4" />,
      color: 'violet' as const,
      onClick: () => setAdminNav('Exams'),
    },
  ];

  const pendingActions = [
    {
      label: `${openDoubts?.meta?.total ?? 0} open doubt(s)`,
      icon: HelpCircle,
      tone: (openDoubts?.meta?.total ?? 0) > 0 ? 'rose' : 'slate',
      count: openDoubts?.meta?.total ?? 0,
      nav: 'Doubts' as const,
    },
    {
      label: `${teacherStats?.unassignedToSubject ?? 0} teacher(s) unassigned to a subject`,
      icon: AlertTriangle,
      tone: (teacherStats?.unassignedToSubject ?? 0) > 0 ? 'amber' : 'slate',
      count: teacherStats?.unassignedToSubject ?? 0,
      nav: 'Teachers' as const,
    },
    {
      label: `${studentStats?.inactive ?? 0} inactive student account(s)`,
      icon: Users,
      tone: (studentStats?.inactive ?? 0) > 0 ? 'amber' : 'slate',
      count: studentStats?.inactive ?? 0,
      nav: 'Students' as const,
    },
    {
      label: `${teacherStats?.withoutBatchAssignment ?? 0} teacher(s) without a batch`,
      icon: GraduationCap,
      tone: (teacherStats?.withoutBatchAssignment ?? 0) > 0 ? 'amber' : 'slate',
      count: teacherStats?.withoutBatchAssignment ?? 0,
      nav: 'Teachers' as const,
    },
    {
      label: `${batchStats?.inactive ?? 0} archived batch(es)`,
      icon: Layers,
      tone: (batchStats?.inactive ?? 0) > 0 ? 'slate' : 'slate',
      count: batchStats?.inactive ?? 0,
      nav: 'Batches' as const,
    },
  ];

  const rosterItems = [
    { label: 'Total students', value: studentStats?.total ?? '—', nav: 'Students' as const },
    { label: 'Active students', value: studentStats?.active ?? '—', nav: 'Students' as const },
    { label: 'New students (30 days)', value: studentStats?.newLast30Days ?? '—', nav: 'Students' as const },
    { label: 'Inactive students', value: studentStats?.inactive ?? '—', nav: 'Students' as const },
    { label: 'Total teachers', value: teacherStats?.total ?? '—', nav: 'Teachers' as const },
    { label: 'Active teachers', value: teacherStats?.active ?? '—', nav: 'Teachers' as const },
    { label: 'Teachers with a batch', value: teacherStats?.withBatchAssignment ?? '—', nav: 'Teachers' as const },
    { label: 'Teachers without a batch', value: teacherStats?.withoutBatchAssignment ?? '—', nav: 'Teachers' as const },
    { label: 'Unassigned to subject', value: teacherStats?.unassignedToSubject ?? '—', nav: 'Teachers' as const },
    { label: 'Total batches', value: batchStats?.total ?? '—', nav: 'Batches' as const },
    { label: 'Active batches', value: batchStats?.active ?? '—', nav: 'Batches' as const },
    { label: 'Archived batches', value: batchStats?.inactive ?? '—', nav: 'Batches' as const },
  ];

  return (
    <div className="px-2.5 sm:px-4 lg:px-6 py-3.5 sm:py-5 w-full max-w-[1700px] mx-auto space-y-3 sm:space-y-4 animate-fadein">
      {/* 4 Clickable KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            color={kpi.color}
            onClick={kpi.onClick}
          />
        ))}
      </div>

      {/* Responsive Dashboard Grid — Desktop (3 cols), Tablet (2 cols), Mobile (1 col) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Students by Batch */}
        <Card title="Students by Batch">
          {!studentStats || (studentStats.byBatch?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400 text-center">No students enrolled yet.</p>
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentStats.byBatch ?? []} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="batchName" tick={{ fontSize: 9, fill: '#94a3b8' }} hide />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* 2. Top Batches by Enrollment (Scrollable when list is lengthy) */}
        <Card
          title="Top Batches by Enrollment"
          action={
            (batchStats?.byEnrollment?.length ?? 0) > 0 ? (
              <span className="text-[11px] text-slate-400 font-medium">
                {batchStats?.byEnrollment?.length} {batchStats?.byEnrollment?.length === 1 ? 'batch' : 'batches'}
              </span>
            ) : null
          }
        >
          {!batchStats || (batchStats.byEnrollment?.length ?? 0) === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400 text-center">No batches yet.</p>
            </div>
          ) : (
            <div className="h-48 overflow-y-auto overscroll-contain pr-1.5 space-y-3 custom-scrollbar">
              {(batchStats.byEnrollment ?? []).map((b: any, i: number) => {
                const max = (batchStats.byEnrollment ?? [])[0]?.studentCount || 1;
                const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-amber-500', 'bg-teal-500'];
                const barColor = colors[i % colors.length];
                return (
                  <div
                    key={b.batchId}
                    onClick={() => setAdminNav('Batches')}
                    className="group cursor-pointer hover:bg-slate-50/80 p-1 rounded-lg transition-colors"
                  >
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-slate-700 font-medium truncate group-hover:text-indigo-600 transition-colors" title={b.batchName}>
                        {b.batchName}
                      </span>
                      <span className="font-bold text-slate-700 ml-2 flex-shrink-0">{b.studentCount}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${Math.max(4, (b.studentCount / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 3. Pending Actions (Scrollable when list is lengthy) */}
        <Card
          title="Pending Actions"
          action={
            <span className="text-[11px] text-slate-400 font-medium">
              {pendingActions.filter((a) => a.count > 0).length} active
            </span>
          }
        >
          <div className="h-48 overflow-y-auto overscroll-contain pr-1.5 space-y-2 custom-scrollbar">
            {pendingActions.map((a, i) => (
              <div
                key={i}
                onClick={() => setAdminNav(a.nav)}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg text-[12px] transition-all cursor-pointer hover:shadow-xs ${
                  a.tone === 'amber'
                    ? 'bg-amber-50/90 text-amber-800 hover:bg-amber-100/80 border border-amber-100/80'
                    : a.tone === 'rose'
                    ? 'bg-rose-50/90 text-rose-800 hover:bg-rose-100/80 border border-rose-100/80'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100/80 border border-slate-100'
                }`}
              >
                <a.icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="flex-1 font-medium leading-tight">{a.label}</span>
                {a.count > 0 && (
                  <span
                    className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      a.tone === 'amber'
                        ? 'bg-amber-200/70 text-amber-900'
                        : a.tone === 'rose'
                        ? 'bg-rose-200/70 text-rose-900'
                        : 'bg-slate-200/70 text-slate-700'
                    }`}
                  >
                    {a.count}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* 4. Recent Activity (Scrollable when list is lengthy) */}
        <Card
          title="Recent Activity"
          action={
            <button
              onClick={() => setAdminNav('Audit Logs')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              View all →
            </button>
          }
        >
          {!auditLogs || (auditLogs.data ?? []).length === 0 ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-xs text-slate-400 text-center">No activity recorded yet.</p>
            </div>
          ) : (
            <div className="h-48 overflow-y-auto overscroll-contain pr-1.5 space-y-1.5 custom-scrollbar">
              {(auditLogs.data ?? []).map((a: any) => (
                <div
                  key={a.id}
                  className="flex items-start gap-2.5 py-2 px-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/70 rounded transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[12px] font-medium text-slate-700 truncate"
                      title={`${a.actor?.name ?? 'Someone'} ${a.action.toLowerCase()} · ${a.entity.replace(/_/g, ' ')}`}
                    >
                      <span className="font-semibold text-slate-800">{a.actor?.name ?? 'Someone'}</span> {a.action.toLowerCase()} · {a.entity.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 5. Attendance Overview */}
        <Card title="Attendance Overview">
          <AttendanceDonut />
        </Card>

        {/* 6. Roster Snapshot (Scrollable when list is lengthy) */}
        <Card
          title="Roster Snapshot"
          action={
            <span className="text-[11px] text-slate-400 font-medium">
              {rosterItems.length} metrics
            </span>
          }
        >
          <div className="h-48 overflow-y-auto overscroll-contain pr-1.5 space-y-1.5 text-xs custom-scrollbar">
            {rosterItems.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setAdminNav(item.nav)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer group"
              >
                <span className="text-slate-500 group-hover:text-indigo-600 transition-colors truncate" title={item.label}>
                  {item.label}
                </span>
                <span className="font-bold text-slate-800 ml-2 flex-shrink-0">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
