'use client';

import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import {
  Calendar, Users, FileText, PenTool, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import {
  useBatches, useExams, useEvaluationWorkItems, useDoubts, useTimetable, useMyTeacherProfile,
} from '@/hooks/useApi';
import { aiClient } from '@/lib/api-client';
import { toDisplayExamStatus } from '@/lib/exam-status';

function getScoreColor(val: number) {
  if (val >= 80) return 'bg-emerald-400';
  if (val >= 65) return 'bg-amber-400';
  if (val >= 50) return 'bg-orange-400';
  return 'bg-rose-500';
}

export function TeacherToday() {
  const { user } = useAuth();
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();

  const { data: batchesResp } = useBatches();
  const { data: examsResp } = useExams();
  const { data: workItemsResp } = useEvaluationWorkItems({ pageSize: 5 });
  const { data: doubtsResp } = useDoubts({ status: 'OPEN', limit: 1 });
  const { data: profile } = useMyTeacherProfile();

  const batches: any[] = batchesResp?.data ?? batchesResp ?? [];
  const exams: any[] = examsResp?.data ?? examsResp ?? [];

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const { data: timetableResp } = useTimetable(
    user ? { teacherUserId: user.id, dateStart: todayStart.toISOString(), dateEnd: todayEnd.toISOString() } : undefined,
  );
  const todaySlots: any[] = timetableResp?.data ?? timetableResp ?? [];

  const myBatchIds = useMemo(() => batches.map((b: any) => b.id as string), [batches]) as string[];
  const heatmapQueries = useQueries({
    queries: myBatchIds.map((batchId: string) => ({
      queryKey: ['analytics', 'heatmap', batchId],
      queryFn: async (): Promise<any> => (await aiClient.get(`/analytics/batch/${batchId}/heatmap`)).data,
    })),
  });

  const totalStudents = batches.reduce((sum: number, b: any) => sum + (b._count?.students ?? 0), 0);
  const workItems = workItemsResp?.data ?? [];
  const pendingPapers = workItemsResp?.meta?.total ?? workItems.length;
  const pendingDoubts = doubtsResp?.meta?.total ?? 0;

  const recentExams = [...exams]
    .filter((e: any) => toDisplayExamStatus(e.status) !== 'scheduled')
    .sort((a: any, b: any) => new Date(b.scheduledDate ?? b.createdAt).getTime() - new Date(a.scheduledDate ?? a.createdAt).getTime())
    .slice(0, 3);

  // Weak topics aggregated across all of the teacher's batches, from live mastery data.
  const weakTopics = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    heatmapQueries.forEach((q) => {
      (q.data?.data ?? []).filter((t: any) => t.studentsStruggling > 0).forEach((t: any) => {
        const entry = map.get(t.topicName) ?? { total: 0, count: 0 };
        entry.total += t.averageMastery;
        entry.count += 1;
        map.set(t.topicName, entry);
      });
    });
    const COLORS = ['bg-rose-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500'];
    return Array.from(map.entries())
      .map(([topic, { total, count }], i) => ({ topic, pct: Math.round(total / count), barColor: COLORS[i % COLORS.length] }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 4);
  }, [heatmapQueries]);

  const goToBatch = (batchId: string) => {
    setTeacherCtx({ classId: teacherCtx.classId, subjectId: teacherCtx.subjectId, batchId, batchTab: 'overview', studentId: null, testId: null });
    setTeacherNav('classes');
  };

  // Real, count-driven priority actions — not AI-generated.
  const priorityActions = [
    pendingPapers > 0 && { id: 'grade', text: `${pendingPapers} response${pendingPapers !== 1 ? 's' : ''} waiting to be graded.`, style: 'bg-amber-50 border-amber-100 text-amber-900', btnStyle: 'text-amber-700 hover:text-amber-900 font-bold', navTo: 'evaluation-queue' as const, cta: 'Start grading →' },
    pendingDoubts > 0 && { id: 'doubts', text: `${pendingDoubts} open doubt${pendingDoubts !== 1 ? 's' : ''} from students.`, style: 'bg-indigo-50 border-indigo-100 text-indigo-900', btnStyle: 'text-indigo-600 hover:text-indigo-800 font-bold', navTo: 'doubt-center' as const, cta: 'View doubts →' },
    weakTopics[0] && { id: 'weak', text: `${weakTopics[0].topic} is the weakest topic across your batches (${weakTopics[0].pct}% avg).`, style: 'bg-rose-50 border-rose-100 text-rose-900', btnStyle: 'text-rose-600 hover:text-rose-800 font-bold', navTo: 'remedial-extra' as const, cta: 'Schedule remedial →' },
  ].filter(Boolean) as { id: string; text: string; style: string; btnStyle: string; navTo: any; cta: string }[];

  return (
    <div className="p-6 space-y-6 animate-fadein bg-slate-50/50 min-h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div onClick={() => setTeacherNav('timetable')} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-500">Classes Today</span>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform"><Calendar className="w-5 h-5" /></div>
          </div>
          <p className="text-[28px] font-black text-slate-800 leading-none">{todaySlots.length}</p>
        </div>

        <div onClick={() => { setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null, batchTab: 'students' }); setTeacherNav('classes'); }}
          className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-sky-200 transition-all cursor-pointer group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-500">Students</span>
            <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform"><Users className="w-5 h-5" /></div>
          </div>
          <p className="text-[28px] font-black text-slate-800 leading-none">{totalStudents}</p>
        </div>

        <div onClick={() => setTeacherNav('tests-exams')} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold text-slate-500">Tests</span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform"><FileText className="w-5 h-5" /></div>
          </div>
          <p className="text-[28px] font-black text-slate-800 leading-none">{exams.length}</p>
        </div>

        <div onClick={() => setTeacherNav('evaluation-queue')} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-rose-200 transition-all cursor-pointer group flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[13px] font-semibold text-slate-500">Responses to Grade</span>
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform"><PenTool className="w-5 h-5" /></div>
            </div>
            <p className="text-[28px] font-black text-slate-800 leading-none">{pendingPapers}</p>
          </div>
          <div className="text-right mt-2"><span className="text-[11.5px] font-bold text-indigo-600 group-hover:underline">View All</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">Batch Performance</h3>
          <div className="space-y-3">
            {batches.map((b: any) => (
              <div key={b.id} onClick={() => goToBatch(b.id)} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer">
                <span className="text-[13px] font-semibold text-slate-700">{b.name}</span>
                <span className="text-[11px] text-slate-400">{b._count?.students ?? 0} students</span>
              </div>
            ))}
            {batches.length === 0 && <p className="text-[13px] text-slate-400 text-center py-6">Not assigned to any batches yet.</p>}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Evaluation Queue</h3>
              <button onClick={() => setTeacherNav('evaluation-queue')} className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">View All →</button>
            </div>
            <div className="space-y-3">
              {workItems.slice(0, 5).map((w: any) => (
                <div key={w.id} className="p-3 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer" onClick={() => setTeacherNav('evaluation-queue')}>
                  <p className="text-[12.5px] font-bold text-slate-800 truncate">{w.question?.content ?? w.attempt?.assessmentDelivery?.assessment?.title ?? 'Response pending review'}</p>
                </div>
              ))}
              {workItems.length === 0 && <p className="text-[13px] text-slate-400 text-center py-6">Nothing to grade right now.</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-indigo-500" /><h3 className="text-[15px] font-bold text-slate-800">Priority Actions</h3></div>
            <div className="space-y-3">
              {priorityActions.map(action => (
                <div key={action.id} className={`p-3.5 border rounded-xl transition-all ${action.style}`}>
                  <p className="text-[12.5px] font-semibold leading-snug mb-2">{action.text}</p>
                  <button onClick={() => setTeacherNav(action.navTo)} className={`text-[11.5px] inline-flex items-center gap-1 ${action.btnStyle}`}>{action.cta}</button>
                </div>
              ))}
              {priorityActions.length === 0 && <p className="text-[13px] text-slate-400 text-center py-6">All caught up!</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">Top Weak Topics</h3>
          <div className="space-y-4">
            {weakTopics.map(wt => (
              <div key={wt.topic} onClick={() => { setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null, batchTab: 'weak-topics' }); setTeacherNav('classes'); }} className="cursor-pointer group">
                <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                  <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors">{wt.topic}</span>
                  <span className="font-bold text-slate-800">{wt.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${wt.barColor} transition-all duration-500`} style={{ width: `${wt.pct}%` }} />
                </div>
              </div>
            ))}
            {weakTopics.length === 0 && (
              <div className="py-8 text-center text-emerald-600 font-semibold text-[12.5px] bg-emerald-50/50 border border-emerald-100 rounded-xl">No weak topics right now.</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Today's Schedule</h3>
              <button onClick={() => setTeacherNav('timetable')} className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">Full Timetable →</button>
            </div>
            <div className="space-y-3">
              {todaySlots.map((slot: any) => (
                <div key={slot.id} onClick={() => slot.batchId && goToBatch(slot.batchId)} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer">
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-bold text-indigo-600 w-16 flex-shrink-0">{new Date(slot.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="text-[12.5px] font-semibold text-slate-800">{slot.title}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded capitalize bg-slate-100 text-slate-600">{slot.type.replace('_', ' ')}</span>
                </div>
              ))}
              {todaySlots.length === 0 && <p className="text-[13px] text-slate-400 text-center py-6">No classes scheduled today.</p>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-bold text-slate-800">Recent Tests</h3>
              <button onClick={() => setTeacherNav('tests-exams')} className="text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors">View All</button>
            </div>
            <div className="space-y-3">
              {recentExams.map((e: any) => (
                <div key={e.id} onClick={() => setTeacherNav('tests-exams')} className="flex items-center justify-between p-3.5 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer">
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">{e.title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : '—'}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${toDisplayExamStatus(e.status) === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{e.status}</span>
                </div>
              ))}
              {recentExams.length === 0 && <p className="text-[13px] text-slate-400 text-center py-6">No tests conducted yet.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
