'use client';
// ─── AdminOverview — real KPI dashboard ────────────────────────────────────────
// Every tile aggregates real hooks already wired to apps/api. No revenue/fee
// figures (no billing domain exists) and no invented performance trend — the
// "Alerts" card surfaces real pending-action counts (unapproved questions,
// open doubts, unassigned teachers) instead of canned notification text.

import React from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertTriangle, HelpCircle, BookOpen, Users, GraduationCap, Layers, CalendarClock, ClipboardList } from 'lucide-react';
import { useStudentsStats } from '@/features/students/hooks/useStudents';
import { useTeachersStats } from '@/features/teachers/hooks/useTeachers';
import { useBatchesStats } from '@/features/batches/hooks/useBatches';
import { useQuestions, useDoubts, useAuditLogs, useAttendanceSummary, useExams } from '@/hooks/useApi';
import { useAdminStore } from '@/store/role-stores';

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function AttendanceDonut() {
  const { data, isPending } = useAttendanceSummary();
  if (isPending) return <div className="h-28 bg-slate-100 rounded-xl animate-pulse" />;
  const b = data?.statusBreakdown ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  const pieData = [
    { name: 'Present', value: b.PRESENT, fill: '#10b981' },
    { name: 'Late', value: b.LATE, fill: '#f59e0b' },
    { name: 'Absent', value: b.ABSENT, fill: '#f43f5e' },
    { name: 'Excused', value: b.EXCUSED, fill: '#3b82f6' },
  ];
  const total = pieData.reduce((s, p) => s + p.value, 0);

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-28 h-28">
        <PieChart width={112} height={112}>
          <Pie data={total > 0 ? pieData : [{ name: 'None', value: 1, fill: '#e2e8f0' }]} cx={52} cy={52} innerRadius={36} outerRadius={52} dataKey="value" strokeWidth={0}>
            {(total > 0 ? pieData : [{ fill: '#e2e8f0' }]).map((e, i) => <Cell key={i} fill={e.fill} />)}
          </Pie>
        </PieChart>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[16px] font-bold text-slate-800">{data?.overallAttendancePct ?? 0}%</span>
          <span className="text-[9px] text-slate-500">Avg. Attendance</span>
        </div>
      </div>
      <div className="space-y-2">
        {pieData.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-[12px] text-slate-600">{p.name}</span>
            <span className="text-[12px] font-bold text-slate-700 ml-auto pl-2">{p.value}</span>
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
  const { data: pendingQuestions } = useQuestions({ isApproved: false, limit: 1 });
  const { data: openDoubts } = useDoubts({ status: 'OPEN', limit: 1 });
  const { data: auditLogs } = useAuditLogs({ pageSize: 6 });
  const { data: examsData } = useExams();
  const exams: any[] = examsData?.data ?? examsData ?? [];
  const upcomingExams = exams.filter((e) => e.status === 'PUBLISHED' || e.status === 'APPROVED').length;

  // `active`, not `total`: archiving a student or teacher removes them from the
  // roster lists these cards link through to, so a KPI counting archived people
  // sends the admin to a list that disagrees with the number they just clicked.
  // The archived count is still surfaced separately in the roster snapshot below.
  const kpis = [
    { label: 'Active Students', value: studentStats?.active ?? '—', icon: <Users className="w-4 h-4" />, color: 'indigo' as const },
    { label: 'Active Teachers', value: teacherStats?.active ?? '—', icon: <GraduationCap className="w-4 h-4" />, color: 'emerald' as const },
    { label: 'Active Batches', value: batchStats?.active ?? '—', icon: <Layers className="w-4 h-4" />, color: 'sky' as const },
    { label: 'Upcoming Exams', value: upcomingExams, icon: <CalendarClock className="w-4 h-4" />, color: 'violet' as const },
  ];

  const pendingActions = [
    { label: `${pendingQuestions?.meta?.total ?? 0} question(s) pending approval`, icon: BookOpen, tone: (pendingQuestions?.meta?.total ?? 0) > 0 ? 'amber' : 'slate' },
    { label: `${openDoubts?.meta?.total ?? 0} open doubt(s)`, icon: HelpCircle, tone: (openDoubts?.meta?.total ?? 0) > 0 ? 'rose' : 'slate' },
    { label: `${teacherStats?.unassignedToSubject ?? 0} teacher(s) unassigned to a subject`, icon: AlertTriangle, tone: (teacherStats?.unassignedToSubject ?? 0) > 0 ? 'amber' : 'slate' },
    { label: `${studentStats?.inactive ?? 0} inactive student account(s)`, icon: Users, tone: 'slate' },
  ];

  return (
    <div className="p-5 space-y-4 animate-fadein">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((kpi) => (
          <StatCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} color={kpi.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Students by Batch">
          {!studentStats || (studentStats.byBatch?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No students enrolled yet.</p>
          ) : (
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentStats.byBatch ?? []} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="batchName" tick={{ fontSize: 9, fill: '#94a3b8' }} hide />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card title="Top Batches by Enrollment">
          {!batchStats || (batchStats.byEnrollment?.length ?? 0) === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No batches yet.</p>
          ) : (
            <div className="space-y-3">
              {(batchStats.byEnrollment ?? []).slice(0, 4).map((b: any, i: number) => {
                const max = (batchStats.byEnrollment ?? [])[0]?.studentCount || 1;
                return (
                  <div key={b.batchId}>
                    <div className="flex justify-between text-[12px] mb-1">
                      <span className="text-slate-700 font-medium truncate">{b.batchName}</span>
                      <span className="font-bold text-slate-700">{b.studentCount}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${i === 0 ? 'bg-indigo-500' : i === 1 ? 'bg-emerald-500' : i === 2 ? 'bg-sky-500' : 'bg-violet-500'}`} style={{ width: `${(b.studentCount / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Pending Actions">
          <div className="space-y-2">
            {pendingActions.map((a, i) => (
              <div key={i} className={`flex items-start gap-2.5 p-2.5 rounded-lg text-[12px] ${a.tone === 'amber' ? 'bg-amber-50 text-amber-700' : a.tone === 'rose' ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
                <a.icon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{a.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Recent Activity"
          action={
            <button onClick={() => setAdminNav('Audit Logs')} className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800">
              View all →
            </button>
          }
        >
          {!auditLogs || (auditLogs.data ?? []).length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {(auditLogs.data ?? []).map((a: any) => (
                <div key={a.id} className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-[12.5px] font-medium text-slate-700">
                      <span className="font-semibold text-slate-800">{a.actor?.name ?? 'Someone'}</span> {a.action.toLowerCase()} · {a.entity.replace(/_/g, ' ')}
                    </p>
                    <p className="text-[11px] text-slate-400">{new Date(a.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Attendance Overview">
          <AttendanceDonut />
        </Card>

        <Card title="Roster Snapshot">
          <div className="space-y-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">New students (30 days)</span><span className="font-bold text-slate-800">{studentStats?.newLast30Days ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Inactive students</span><span className="font-bold text-slate-800">{studentStats?.inactive ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Teachers with a batch</span><span className="font-bold text-slate-800">{teacherStats?.withBatchAssignment ?? '—'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Archived batches</span><span className="font-bold text-slate-800">{batchStats?.inactive ?? '—'}</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
