'use client';

import { useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Circle, FileText } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { useTimetable, useAssignments } from '@/hooks/useApi';

interface Slot { id: string; type: string; title: string; startTime: string; endTime: string }
interface Assignment { id: string; title: string; dueDate: string; status: string }

function startOfDay(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

export function StudentStudyPlan() {
  const [dateOffset, setDateOffset] = useState(0);
  const { data: timetableResp } = useTimetable();
  const { data: assignmentsResp } = useAssignments({ status: 'PENDING' });
  const slots: Slot[] = useMemo(() => timetableResp?.data ?? [], [timetableResp]);
  const assignments: Assignment[] = useMemo(() => assignmentsResp?.data ?? [], [assignmentsResp]);

  const day = useMemo(() => startOfDay(dateOffset), [dateOffset]);
  const nextDay = useMemo(() => startOfDay(dateOffset + 1), [dateOffset]);
  const now = Date.now();

  const daySlots = useMemo(
    () => slots.filter((s) => new Date(s.startTime) >= day && new Date(s.startTime) < nextDay).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [slots, day, nextDay],
  );
  const dueAssignments = useMemo(
    () => assignments.filter((a) => { const d = new Date(a.dueDate); return d >= day && d < nextDay; }),
    [assignments, day, nextDay],
  );

  const items = [
    ...daySlots.map((s) => ({ kind: 'slot' as const, id: s.id, time: s.startTime, label: s.title, sub: s.type.replace('_', ' '), done: new Date(s.endTime).getTime() < now })),
    ...dueAssignments.map((a) => ({ kind: 'assignment' as const, id: a.id, time: a.dueDate, label: `Due: ${a.title}`, sub: 'Assignment', done: false })),
  ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const totalTasks = items.length;
  const tasksDone = items.filter((i) => i.done).length;
  const completionPercentage = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

  const studyMinutes = daySlots.reduce((sum, s) => sum + Math.max(0, (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000), 0);
  const studyTimeLabel = studyMinutes > 0 ? `${Math.floor(studyMinutes / 60)}h ${Math.round(studyMinutes % 60)}m` : '—';

  const dateLabel = dateOffset === 0 ? `Today • ${day.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}` : day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="p-5 animate-fadein h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full flex-1 flex flex-col p-6 lg:p-8">

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-[19px] font-bold text-slate-800">Study Plan</h2>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <button onClick={() => setDateOffset((p) => p - 1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-[14px] font-bold text-slate-700 min-w-[190px] text-center">{dateLabel}</p>
          <button onClick={() => setDateOffset((p) => p + 1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] py-10">
            No classes or assignment deadlines on this day.
          </div>
        ) : (
        <div className="relative mb-10 max-w-2xl mx-auto w-full">
          <div className="absolute left-[84px] top-4 bottom-4 w-px bg-indigo-100 hidden sm:block" />
          <div className="space-y-6 relative">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col sm:flex-row sm:items-center group relative z-10">
                <div className="w-[72px] flex-shrink-0 text-right pr-4 hidden sm:block">
                  <span className="text-[13px] font-bold text-indigo-600">{new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                <div className="hidden sm:flex relative z-10 w-6 h-6 items-center justify-center bg-white">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.done ? 'bg-indigo-600' : 'bg-indigo-200 group-hover:bg-indigo-400 transition-colors'}`} />
                </div>
                <div className="flex-1 pl-0 sm:pl-4 flex flex-col sm:flex-row sm:items-center justify-between border-l-2 sm:border-l-0 border-indigo-100 ml-4 sm:ml-0 py-1 sm:py-0">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-[14px] font-bold text-slate-800">{item.label}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5 sm:hidden mb-1 font-semibold text-indigo-600">{new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
                    <p className="text-[12px] text-slate-500">{item.sub}</p>
                  </div>
                  <div className="flex-shrink-0 mt-2 sm:mt-0 sm:ml-4">
                    {item.done ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50" />
                    ) : item.kind === 'assignment' ? (
                      <FileText className="w-6 h-6 text-amber-400" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-200 hidden sm:block" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 rounded-xl p-4 border border-slate-100 gap-4 sm:gap-0 mt-auto">
          <div className="text-center flex-1 sm:border-r border-slate-200 w-full sm:w-auto pb-4 sm:pb-0 border-b sm:border-b-0">
            <p className="text-[20px] font-bold text-slate-800">{totalTasks}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Items {dateOffset === 0 ? 'Today' : 'This Day'}</p>
          </div>
          <div className="text-center flex-1 sm:border-r border-slate-200 w-full sm:w-auto pb-4 sm:pb-0 border-b sm:border-b-0">
            <p className="text-[20px] font-bold text-slate-800">{studyTimeLabel}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Scheduled Class Time</p>
          </div>
          <div className="flex items-center justify-center flex-1 gap-3 w-full sm:w-auto">
            <div className="relative w-10 h-10 flex-shrink-0">
              <PieChart width={40} height={40}>
                <Pie data={[{ value: completionPercentage, fill: '#10b981' }, { value: 100 - completionPercentage, fill: '#e2e8f0' }]} cx={20} cy={20} innerRadius={14} outerRadius={20} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  {[{ fill: '#10b981' }, { fill: '#e2e8f0' }].map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-600">{completionPercentage}%</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Day Completion</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
