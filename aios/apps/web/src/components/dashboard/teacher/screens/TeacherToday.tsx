'use client';

import { useMemo } from 'react';
import {
  Calendar, Users, FileText, PenTool, Sparkles, BarChart2,
  TrendingUp, TrendingDown, Minus, ChevronRight, Clock,
  Target, CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import {
  useBatches, useExams, useEvaluationWorkItems, useDoubts, useTimetable, useMyTeacherProfile,
  useBatchPerformanceSummaries, useBatchesHeatmap,
} from '@/hooks/useApi';
import { toDisplayExamStatus } from '@/lib/exam-status';
import { MarqueeText } from '@/components/ui/MarqueeText';
import { ScreenLoadingState } from '@/components/ui/foundation';

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' | string }) {
  if (trend === 'up') return <span title="Improving trend" className="inline-flex"><TrendingUp className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /></span>;
  if (trend === 'down') return <span title="Declining trend" className="inline-flex"><TrendingDown className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" /></span>;
  return <span title="Stable trend" className="inline-flex"><Minus className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" /></span>;
}

function getBatchBadgeInitials(name: string): string {
  if (!name) return 'B';
  const classSecMatch = name.match(/Class\s*(\d+)\s*-\s*Section\s*([A-Za-z0-9]+)/i);
  if (classSecMatch?.[1] && classSecMatch[2]) return `${classSecMatch[1]}${classSecMatch[2]}`;
  const classMatch = name.match(/Class\s*(\d+)/i);
  if (classMatch?.[1]) return `C${classMatch[1]}`;
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && words[0]?.[0] && words[1]?.[0]) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

function getScoreBadge(score: number) {
  if (score >= 75) {
    return {
      text: 'text-emerald-700',
      bar: 'bg-emerald-500',
    };
  }
  if (score >= 60) {
    return {
      text: 'text-amber-700',
      bar: 'bg-amber-500',
    };
  }
  return {
    text: 'text-rose-700',
    bar: 'bg-rose-500',
  };
}

export function TeacherToday() {
  const { user } = useAuth();
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();

  const { data: batchesResp, isLoading: batchesLoading } = useBatches();
  const { data: examsResp, isLoading: examsLoading } = useExams();
  const { data: workItemsResp } = useEvaluationWorkItems({ pageSize: 10 });
  const { data: doubtsResp } = useDoubts({ status: 'OPEN', limit: 1 });
  const { data: profile, isLoading: profileLoading } = useMyTeacherProfile();
  const { data: batchSummaries } = useBatchPerformanceSummaries();

  const batches: any[] = batchesResp?.data ?? batchesResp ?? [];
  const exams: any[] = examsResp?.data ?? examsResp ?? [];

  const todayTimetableParams = useMemo(() => {
    if (!user?.id) return undefined;
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return { teacherUserId: user.id, dateStart: start.toISOString(), dateEnd: end.toISOString() };
  }, [user?.id]);
  const { data: timetableResp } = useTimetable(todayTimetableParams);
  const todaySlots: any[] = timetableResp?.data ?? timetableResp ?? [];

  const myBatchIds = useMemo(() => batches.map((b: any) => b.id as string), [batches]) as string[];
  const { data: heatmapsByBatch } = useBatchesHeatmap(myBatchIds);

  // Headline performance map from the batch performance summary endpoint
  const perfMap = useMemo(() => {
    const map = new Map<string, { studentCount: number; avgScore: number; trend: 'up' | 'down' | 'stable' }>();
    (batchSummaries ?? []).forEach((s) => {
      map.set(s.id, {
        studentCount: s.studentCount,
        avgScore: s.avgScore,
        trend: s.trend,
      });
    });
    return map;
  }, [batchSummaries]);

  // Topic mastery map from live heatmap as fallback indicator when no exam scores are recorded yet
  const batchHeatmapMastery = useMemo(() => {
    const map = new Map<string, number>();
    if (!heatmapsByBatch) return map;
    myBatchIds.forEach((id) => {
      const topics = (heatmapsByBatch[id] ?? []) as any[];
      if (topics.length > 0) {
        const totalMastery = topics.reduce((sum: number, t: any) => sum + (t.averageMastery ?? 0), 0);
        map.set(id, Math.round(totalMastery / topics.length));
      }
    });
    return map;
  }, [myBatchIds, heatmapsByBatch]);

  const totalStudents = batches.reduce((sum: number, b: any) => sum + (b._count?.students ?? 0), 0);
  const workItems = workItemsResp?.data ?? [];
  const pendingPapers = workItemsResp?.meta?.total ?? workItems.length;
  const pendingDoubts = doubtsResp?.meta?.total ?? 0;

  const recentExams = useMemo(() => {
    return [...exams]
      .filter((e: any) => toDisplayExamStatus(e.status) !== 'scheduled')
      .sort((a: any, b: any) => new Date(b.scheduledDate ?? b.createdAt).getTime() - new Date(a.scheduledDate ?? a.createdAt).getTime())
      .slice(0, 10);
  }, [exams]);

  // Weak topics aggregated across all of the teacher's batches, from live mastery data.
  const weakTopics = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    if (heatmapsByBatch) {
      Object.values(heatmapsByBatch).forEach((topics: any) => {
        (topics ?? []).filter((t: any) => t.studentsStruggling > 0).forEach((t: any) => {
          const entry = map.get(t.topicName) ?? { total: 0, count: 0 };
          entry.total += t.averageMastery;
          entry.count += 1;
          map.set(t.topicName, entry);
        });
      });
    }
    const COLORS = ['bg-rose-500', 'bg-amber-500', 'bg-purple-500', 'bg-cyan-500'];
    return Array.from(map.entries())
      .map(([topic, { total, count }], i) => ({ topic, pct: Math.round(total / count), barColor: COLORS[i % COLORS.length] }))
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 10);
  }, [heatmapsByBatch]);

  // Overall batch performance average across all batches that have score or mastery data
  const overallBatchAvg = useMemo(() => {
    const validScores: number[] = [];
    batches.forEach((b: any) => {
      const p = perfMap.get(b.id);
      if (p && p.avgScore > 0) {
        validScores.push(p.avgScore);
      } else {
        const m = batchHeatmapMastery.get(b.id);
        if (m && m > 0) validScores.push(m);
      }
    });
    if (validScores.length === 0) return null;
    return Math.round(validScores.reduce((acc, s) => acc + s, 0) / validScores.length);
  }, [batches, perfMap, batchHeatmapMastery]);

  const goToBatch = (batchId: string) => {
    setTeacherCtx({ classId: teacherCtx.classId, subjectId: teacherCtx.subjectId, batchId, batchTab: 'overview', studentId: null, testId: null });
    setTeacherNav('classes');
  };

  // Real, count-driven priority actions — not AI-generated.
  const priorityActions = [
    pendingPapers > 0 && { id: 'grade', text: `${pendingPapers} response${pendingPapers !== 1 ? 's' : ''} waiting to be graded.`, style: 'bg-amber-50/80 border-amber-200/70 text-amber-900', btnStyle: 'text-amber-700 hover:text-amber-900 font-bold', navTo: 'evaluation-queue' as const, cta: 'Start grading →' },
    pendingDoubts > 0 && { id: 'doubts', text: `${pendingDoubts} open doubt${pendingDoubts !== 1 ? 's' : ''} from students.`, style: 'bg-indigo-50/80 border-indigo-200/70 text-indigo-900', btnStyle: 'text-indigo-600 hover:text-indigo-800 font-bold', navTo: 'doubt-center' as const, cta: 'View doubts →' },
    weakTopics[0] && { id: 'weak', text: `${weakTopics[0].topic} is the weakest topic across your batches (${weakTopics[0].pct}% avg).`, style: 'bg-rose-50/80 border-rose-200/70 text-rose-900', btnStyle: 'text-rose-600 hover:text-rose-800 font-bold', navTo: 'remedial-extra' as const, cta: 'Schedule remedial →' },
  ].filter(Boolean) as { id: string; text: string; style: string; btnStyle: string; navTo: any; cta: string }[];

  const isInitialLoading = (batchesLoading || profileLoading) && !batchesResp && !profile;
  if (isInitialLoading) {
    return (
      <ScreenLoadingState
        title="Loading Teacher Overview..."
        subtitle="Fetching your assigned batches, timetable, and student performance data..."
        layout="overview"
      />
    );
  }

  return (
    <div className="p-3.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 animate-fadein bg-slate-50/50 min-h-full">
      {/* ── 1. Top 4 KPI Cards: 2x2 Grid on Mobile, 4 Cols on Desktop ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Classes Today */}
        <div
          onClick={() => setTeacherNav('timetable')}
          className="bg-white border border-slate-100 hover:border-indigo-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[96px] sm:min-h-[114px]"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
            <span className="text-[11.5px] sm:text-[13px] font-semibold text-slate-500 tracking-tight leading-tight truncate">Classes Today</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform flex-shrink-0">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <p className="text-2xl sm:text-[28px] font-black text-slate-800 leading-none tracking-tight">{todaySlots.length}</p>
            <span className="text-[10px] sm:text-[11.5px] font-semibold text-slate-400 group-hover:text-indigo-600 transition-colors hidden xs:inline-flex items-center gap-0.5">
              Schedule <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Students */}
        <div
          onClick={() => { setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null, batchTab: 'students' }); setTeacherNav('classes'); }}
          className="bg-white border border-slate-100 hover:border-sky-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[96px] sm:min-h-[114px]"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
            <span className="text-[11.5px] sm:text-[13px] font-semibold text-slate-500 tracking-tight leading-tight truncate">Students</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-sky-50 flex items-center justify-center text-sky-600 group-hover:scale-105 transition-transform flex-shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <p className="text-2xl sm:text-[28px] font-black text-slate-800 leading-none tracking-tight">{totalStudents}</p>
            <span className="text-[10px] sm:text-[11.5px] font-semibold text-slate-400 group-hover:text-sky-600 transition-colors hidden xs:inline-flex items-center gap-0.5">
              Roster <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Tests */}
        <div
          onClick={() => setTeacherNav('assessments')}
          className="bg-white border border-slate-100 hover:border-purple-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[96px] sm:min-h-[114px]"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
            <span className="text-[11.5px] sm:text-[13px] font-semibold text-slate-500 tracking-tight leading-tight truncate">Tests</span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 group-hover:scale-105 transition-transform flex-shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <p className="text-2xl sm:text-[28px] font-black text-slate-800 leading-none tracking-tight">{exams.length}</p>
            <span className="text-[10px] sm:text-[11.5px] font-semibold text-slate-400 group-hover:text-purple-600 transition-colors hidden xs:inline-flex items-center gap-0.5">
              Tests <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>

        {/* Responses to Grade */}
        <div
          onClick={() => setTeacherNav('evaluation-queue')}
          className="bg-white border border-slate-100 hover:border-rose-200 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[96px] sm:min-h-[114px]"
        >
          <div className="flex items-center justify-between gap-1.5 mb-2 sm:mb-3">
            <span className="text-[11.5px] sm:text-[13px] font-semibold text-slate-500 tracking-tight leading-tight line-clamp-1" title="Responses to Grade">
              Responses to Grade
            </span>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform flex-shrink-0">
              <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-auto">
            <p className="text-2xl sm:text-[28px] font-black text-slate-800 leading-none tracking-tight">{pendingPapers}</p>
            <span className="text-[10px] sm:text-[11.5px] font-bold text-rose-600 group-hover:text-rose-700 transition-colors flex items-center gap-0.5">
              {pendingPapers > 0 ? 'Grade' : 'View All'} <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>

      {/* ── Row 2: Batch Performance | Evaluation Queue | Priority Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Card 1: Batch Performance */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-[320px] sm:h-[360px] lg:h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100/90 flex-shrink-0 touch-pan-y select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 leading-tight">Batch Performance</h3>
                  <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {batches.length}
                  </span>
                </div>
                {overallBatchAvg !== null && (
                  <p className="text-[10.5px] text-slate-400 leading-none mt-0.5">
                    Average score across batches: <span className="font-bold text-slate-700">{overallBatchAvg}%</span>
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => { setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null, batchTab: 'overview' }); setTeacherNav('classes'); }}
              className="text-[11.5px] sm:text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 flex-shrink-0 group"
            >
              <span>View Classes</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1.5 overscroll-y-auto touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {batches.map((b: any) => {
              const perf = perfMap.get(b.id);
              const heatmapMastery = batchHeatmapMastery.get(b.id);
              const hasScore = perf && perf.avgScore > 0;
              const displayScore = hasScore ? perf.avgScore : (heatmapMastery && heatmapMastery > 0 ? heatmapMastery : null);
              const scoreType = hasScore ? 'exam' : (heatmapMastery ? 'mastery' : null);
              const trend = perf?.trend ?? 'stable';
              const studentCount = b._count?.students ?? perf?.studentCount ?? 0;
              const badgeInitials = getBatchBadgeInitials(b.name);
              const scoreStyle = displayScore !== null ? getScoreBadge(displayScore) : null;

              return (
                <div
                  key={b.id}
                  onClick={() => goToBatch(b.id)}
                  className="group flex items-center justify-between gap-2.5 p-2.5 sm:p-3 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-slate-50/60 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-sm min-w-0"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 font-bold text-[11px] flex items-center justify-center transition-colors flex-shrink-0 tracking-tight">
                      {badgeInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] sm:text-[13px] font-semibold text-slate-800 group-hover:text-indigo-900 transition-colors truncate" title={b.name}>
                        {b.name}
                      </p>
                      <p className="text-[10.5px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-slate-400 flex-shrink-0" />
                        <span>{studentCount} student{studentCount !== 1 ? 's' : ''}</span>
                        {scoreType === 'mastery' && (
                          <span className="text-[9.5px] text-slate-400 font-normal bg-slate-100 px-1 rounded ml-1">topic avg</span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {displayScore !== null && scoreStyle ? (
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`text-[12.5px] sm:text-[13px] font-black tabular-nums leading-none ${scoreStyle.text}`}>
                            {displayScore}%
                          </span>
                          <TrendIcon trend={trend} />
                        </div>
                        <div className="w-12 sm:w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1 ml-auto">
                          <div
                            className={`h-full rounded-full ${scoreStyle.bar} transition-all duration-300`}
                            style={{ width: `${Math.min(100, displayScore)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="text-[10px] sm:text-[10.5px] font-medium text-slate-400 bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded-full">
                          No scores yet
                        </span>
                      </div>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
            {batches.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-[12.5px]">
                <BarChart2 className="w-8 h-8 text-slate-200 mb-2" />
                <p>Not assigned to any batches yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Evaluation Queue */}
        <div className="lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-[320px] sm:h-[360px] lg:h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100/90 flex-shrink-0 touch-pan-y select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center flex-shrink-0">
                <PenTool className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 leading-tight">Evaluation Queue</h3>
                {pendingPapers > 0 && (
                  <span className="text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {pendingPapers}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setTeacherNav('evaluation-queue')}
              className="text-[11.5px] sm:text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 flex-shrink-0 group"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1.5 overscroll-y-auto touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {workItems.map((w: any) => (
              <div
                key={w.id}
                onClick={() => setTeacherNav('evaluation-queue')}
                className="group flex items-center justify-between gap-2 p-2.5 sm:p-3 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer min-w-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] sm:text-[12.5px] font-semibold text-slate-800 group-hover:text-indigo-900 transition-colors truncate" title={w.question?.content ?? w.attempt?.assessmentDelivery?.assessment?.title ?? 'Response pending review'}>
                    {w.question?.content ?? w.attempt?.assessmentDelivery?.assessment?.title ?? 'Response pending review'}
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-0.5 truncate">
                    {w.attempt?.student?.name ? `Student: ${w.attempt.student.name}` : 'Pending teacher review'}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex-shrink-0">
                  Pending
                </span>
              </div>
            ))}
            {workItems.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-[12.5px]">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="font-semibold text-slate-700">All caught up!</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">Nothing to grade right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Priority Actions */}
        <div className="lg:col-span-3 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-[320px] sm:h-[360px] lg:h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100/90 flex-shrink-0 touch-pan-y select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 leading-tight">Priority Actions</h3>
            </div>
            {priorityActions.length > 0 && (
              <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {priorityActions.length}
              </span>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1.5 overscroll-y-auto touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {priorityActions.map(action => (
              <div key={action.id} className={`p-3 border rounded-xl transition-all ${action.style}`}>
                <p className="text-[12px] sm:text-[12.5px] font-semibold leading-snug mb-2">{action.text}</p>
                <button
                  onClick={() => setTeacherNav(action.navTo)}
                  className={`text-[11px] sm:text-[11.5px] inline-flex items-center gap-1 ${action.btnStyle}`}
                >
                  {action.cta}
                </button>
              </div>
            ))}
            {priorityActions.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-[12.5px]">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="font-semibold text-slate-700">All caught up!</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">No urgent actions pending.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 3: Top Weak Topics | Today's Schedule | Recent Tests ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Card 4: Top Weak Topics */}
        <div className="md:col-span-1 lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-[320px] sm:h-[360px] lg:h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100/90 flex-shrink-0 touch-pan-y select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 leading-tight">Top Weak Topics</h3>
            </div>
            <button
              onClick={() => { setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null, batchTab: 'weak-topics' }); setTeacherNav('classes'); }}
              className="text-[11.5px] sm:text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 flex-shrink-0 group"
            >
              <span>Remedial</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-3.5 pr-1.5 overscroll-y-auto touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {weakTopics.map(wt => (
              <div
                key={wt.topic}
                onClick={() => { setTeacherCtx({ classId: null, batchId: null, studentId: null, testId: null, batchTab: 'weak-topics' }); setTeacherNav('classes'); }}
                className="cursor-pointer group p-1.5 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between text-[12px] sm:text-[12.5px] mb-1.5 gap-2">
                  <span className="font-semibold text-slate-700 group-hover:text-indigo-600 transition-colors truncate min-w-0" title={wt.topic}>
                    {wt.topic}
                  </span>
                  <span className="font-bold text-slate-800 flex-shrink-0 tabular-nums">{wt.pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className={`h-2 rounded-full ${wt.barColor} transition-all duration-500`} style={{ width: `${wt.pct}%` }} />
                </div>
              </div>
            ))}
            {weakTopics.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-[12.5px]">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                <p className="font-semibold text-slate-700">Healthy Mastery</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">No weak topics right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 5: Today's Schedule */}
        <div className="md:col-span-1 lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-[320px] sm:h-[360px] lg:h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100/90 flex-shrink-0 touch-pan-y select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 leading-tight">Today's Schedule</h3>
            </div>
            <button
              onClick={() => setTeacherNav('timetable')}
              className="text-[11.5px] sm:text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 flex-shrink-0 group"
            >
              <span>Full Timetable</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1.5 overscroll-y-auto touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {todaySlots.map((slot: any) => (
              <div
                key={slot.id}
                onClick={() => slot.batchId && goToBatch(slot.batchId)}
                className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer min-w-0 overflow-hidden"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden pr-2">
                  <span className="text-[11.5px] sm:text-[12px] font-bold text-indigo-600 w-14 sm:w-16 flex-shrink-0">
                    {new Date(slot.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <MarqueeText text={slot.title} className="text-[12px] sm:text-[12.5px] font-semibold text-slate-800" />
                  </div>
                </div>
                <span className="text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded capitalize bg-slate-100 text-slate-600 flex-shrink-0">
                  {slot.type.replace('_', ' ')}
                </span>
              </div>
            ))}
            {todaySlots.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-[12.5px]">
                <Calendar className="w-8 h-8 text-slate-200 mb-2" />
                <p>No classes scheduled today.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 6: Recent Tests */}
        <div className="md:col-span-2 lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-all flex flex-col h-[320px] sm:h-[360px] lg:h-[400px]">
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100/90 flex-shrink-0 touch-pan-y select-none">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800 leading-tight">Recent Tests</h3>
            </div>
            <button
              onClick={() => setTeacherNav('assessments')}
              className="text-[11.5px] sm:text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 flex-shrink-0 group"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1.5 overscroll-y-auto touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {recentExams.map((e: any) => (
              <div
                key={e.id}
                onClick={() => setTeacherNav('assessments')}
                className="flex items-center justify-between p-2.5 sm:p-3 border border-slate-100 rounded-xl hover:border-indigo-100 hover:bg-indigo-50/20 transition-all cursor-pointer min-w-0 overflow-hidden"
              >
                <div className="min-w-0 flex-1 overflow-hidden pr-2">
                  <MarqueeText text={e.title} className="text-[12.5px] sm:text-[13px] font-bold text-slate-800" />
                  <p className="text-[10.5px] text-slate-400 mt-0.5">
                    {e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : '—'}
                  </p>
                </div>
                <span className={`text-[9.5px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded capitalize flex-shrink-0 ${
                  toDisplayExamStatus(e.status) === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {e.status}
                </span>
              </div>
            ))}
            {recentExams.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 text-[12.5px]">
                <FileText className="w-8 h-8 text-slate-200 mb-2" />
                <p>No tests conducted yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

