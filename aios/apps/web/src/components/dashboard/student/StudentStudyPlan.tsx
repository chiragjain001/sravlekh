'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  FileText,
  Clock,
  Sparkles,
  BookOpen,
  Award,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  ArrowRight,
  ExternalLink,
  MapPin,
  CalendarDays,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useTimetable, useAssignments, useExams } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { useAuth } from '@/contexts/auth.context';
import { MarqueeText } from '@/components/ui/MarqueeText';

interface Slot {
  id: string;
  type: string;
  title: string;
  startTime: string;
  endTime: string;
  roomRef?: string;
  batch?: { name: string };
}

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  topic?: { name: string; chapter?: { subject?: { name: string } } };
}

interface Exam {
  id: string;
  title: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  status: string;
  subject?: { name: string };
}

interface PersonalGoal {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
}

function startOfDay(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

export function StudentStudyPlan() {
  const [dateOffset, setDateOffset] = useState(0);
  const [newGoalText, setNewGoalText] = useState('');
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [personalGoals, setPersonalGoals] = useState<PersonalGoal[]>([]);

  const { user } = useAuth();
  const { setStudentActiveNav } = useDashboardStore();

  const { data: timetableResp, isLoading: isTimetableLoading } = useTimetable();
  const { data: assignmentsResp, isLoading: isAssignmentsLoading } = useAssignments();
  const { data: examsResp, isLoading: isExamsLoading } = useExams();

  // Safely normalize arrays regardless of whether backend returned array or { data: [...] }
  const slots: Slot[] = useMemo(() => {
    if (Array.isArray(timetableResp)) return timetableResp;
    if (Array.isArray((timetableResp as any)?.data)) return (timetableResp as any).data;
    return [];
  }, [timetableResp]);

  const assignments: Assignment[] = useMemo(() => {
    if (Array.isArray(assignmentsResp)) return assignmentsResp;
    if (Array.isArray((assignmentsResp as any)?.data)) return (assignmentsResp as any).data;
    return [];
  }, [assignmentsResp]);

  const exams: Exam[] = useMemo(() => {
    if (Array.isArray(examsResp)) return examsResp;
    if (Array.isArray((examsResp as any)?.data)) return (examsResp as any).data;
    return [];
  }, [examsResp]);

  const day = useMemo(() => startOfDay(dateOffset), [dateOffset]);
  const nextDay = useMemo(() => startOfDay(dateOffset + 1), [dateOffset]);
  const now = Date.now();

  const dateKey = useMemo(() => {
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [day]);

  // Load personal goals for this specific date
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = `aios_study_goals_${user?.id || 'guest'}_${dateKey}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setPersonalGoals(JSON.parse(stored));
      } else {
        setPersonalGoals([]);
      }
    } catch {
      setPersonalGoals([]);
    }
  }, [user?.id, dateKey]);

  // Save personal goals helper
  const savePersonalGoals = (updated: PersonalGoal[]) => {
    setPersonalGoals(updated);
    if (typeof window === 'undefined') return;
    const storageKey = `aios_study_goals_${user?.id || 'guest'}_${dateKey}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save study goals to storage', e);
    }
  };

  const handleAddGoal = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newGoalText.trim();
    if (!trimmed) return;
    const newGoal: PersonalGoal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: trimmed,
      done: false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...personalGoals, newGoal];
    savePersonalGoals(updated);
    setNewGoalText('');
    setIsAddingGoal(false);
  };

  const handleToggleGoal = (goalId: string) => {
    const updated = personalGoals.map((g) => (g.id === goalId ? { ...g, done: !g.done } : g));
    savePersonalGoals(updated);
  };

  const handleDeleteGoal = (goalId: string) => {
    const updated = personalGoals.filter((g) => g.id !== goalId);
    savePersonalGoals(updated);
  };

  // Filter slots for the selected day
  const daySlots = useMemo(
    () =>
      slots
        .filter((s) => {
          const t = new Date(s.startTime);
          return t >= day && t < nextDay;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [slots, day, nextDay],
  );

  // Filter assignments due on the selected day
  const dueAssignments = useMemo(
    () =>
      assignments.filter((a) => {
        const d = new Date(a.dueDate);
        return d >= day && d < nextDay;
      }),
    [assignments, day, nextDay],
  );

  // Filter exams scheduled on the selected day
  const dayExams = useMemo(
    () =>
      exams.filter((e) => {
        const dateStr = e.scheduledDate || e.startTime;
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d >= day && d < nextDay;
      }),
    [exams, day, nextDay],
  );

  // Aggregate all items for the day
  const items = useMemo(() => {
    const combined = [
      ...daySlots.map((s) => ({
        kind: 'slot' as const,
        id: s.id,
        time: s.startTime,
        endTime: s.endTime,
        label: s.title,
        sub: s.roomRef ? `${s.type.replace('_', ' ')} • Room ${s.roomRef}` : s.type.replace('_', ' '),
        done: new Date(s.endTime).getTime() < now,
        raw: s,
      })),
      ...dueAssignments.map((a) => ({
        kind: 'assignment' as const,
        id: a.id,
        time: a.dueDate,
        endTime: a.dueDate,
        label: `Assignment: ${a.title}`,
        sub:
          a.status === 'SUBMITTED'
            ? 'Submitted • Awaiting Teacher Grading'
            : a.status === 'GRADED'
            ? 'Completed & Graded'
            : 'Pending Submission',
        done: a.status === 'SUBMITTED' || a.status === 'GRADED',
        raw: a,
      })),
      ...dayExams.map((e) => ({
        kind: 'exam' as const,
        id: e.id,
        time: e.scheduledDate || e.startTime || day.toISOString(),
        endTime: e.endTime || e.scheduledDate || day.toISOString(),
        label: `Exam: ${e.title}`,
        sub: e.subject?.name ? `${e.subject.name} • ${e.durationMinutes ?? 60}m` : 'Scheduled Test',
        done: e.status === 'EVALUATED' || e.status === 'SUBMITTED',
        raw: e,
      })),
      ...personalGoals.map((g) => ({
        kind: 'goal' as const,
        id: g.id,
        time: g.createdAt || day.toISOString(),
        endTime: g.createdAt || day.toISOString(),
        label: g.title,
        sub: 'Self-Study Goal',
        done: g.done,
        raw: g,
      })),
    ];

    return combined.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [daySlots, dueAssignments, dayExams, personalGoals, now, day]);

  const totalTasks = items.length;
  const tasksDone = items.filter((i) => i.done).length;
  const completionPercentage = totalTasks > 0 ? Math.round((tasksDone / totalTasks) * 100) : 0;

  const studyMinutes = daySlots.reduce(
    (sum, s) => sum + Math.max(0, (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000),
    0,
  );
  const studyTimeLabel = studyMinutes > 0 ? `${Math.floor(studyMinutes / 60)}h ${Math.round(studyMinutes % 60)}m` : '—';

  const isToday = dateOffset === 0;
  const isTomorrow = dateOffset === 1;
  const isYesterday = dateOffset === -1;

  const dateLabel = isToday
    ? `Today • ${day.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : isTomorrow
    ? `Tomorrow • ${day.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : isYesterday
    ? `Yesterday • ${day.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`
    : day.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const isLoading = isTimetableLoading || isAssignmentsLoading || isExamsLoading;

  return (
    <div className="p-3 sm:p-5 md:p-6 animate-fadein min-h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 bg-white">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-[18px] sm:text-[19px] font-bold text-slate-800">Study Plan</h2>
              <p className="text-[12px] text-slate-500">Track your daily classes, homework, exams, and personal goals.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[12.5px] font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Goal</span>
            </button>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 mb-6">
          <button
            onClick={() => setDateOffset((p) => p - 1)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 cursor-pointer active:scale-95"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-4 py-1.5 rounded-xl">
            <p className="text-[13px] sm:text-[14px] font-bold text-slate-800 min-w-[170px] sm:min-w-[210px] text-center select-none">
              {dateLabel}
            </p>
          </div>

          <button
            onClick={() => setDateOffset((p) => p + 1)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500 cursor-pointer active:scale-95"
            aria-label="Next day"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          {!isToday && (
            <button
              onClick={() => setDateOffset(0)}
              className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer ml-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Jump to Today
            </button>
          )}
        </div>

        {/* Quick Add Goal Input (Expandable) */}
        {isAddingGoal && (
          <form
            onSubmit={handleAddGoal}
            className="mb-6 p-4 rounded-xl bg-indigo-50/50 border border-indigo-100 max-w-2xl mx-auto w-full animate-fadein"
          >
            <label className="block text-[12px] font-bold text-indigo-900 mb-1.5">
              New Study Goal for {isToday ? 'Today' : day.toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                autoFocus
                placeholder="e.g., Read Physics Chapter 3, Solve 10 Chemistry MCQs..."
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                className="flex-1 px-3.5 py-2 text-[13px] bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!newGoalText.trim()}
                  className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                >
                  Save Goal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingGoal(false);
                    setNewGoalText('');
                  }}
                  className="px-3 py-2 text-slate-500 hover:text-slate-700 text-[12.5px] font-semibold rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Main Content Area */}
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-slate-400 font-medium">Loading schedule and study items...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-14 px-4 my-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-3 shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-[15px] font-bold text-slate-700">No scheduled activities on this day</p>
            <p className="text-[12.5px] text-slate-500 max-w-sm mt-1 mb-5">
              {isToday
                ? 'No institute classes or assignment deadlines today. Use this time for self-paced revision!'
                : 'No classes or assignment deadlines scheduled for this date.'}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                onClick={() => setIsAddingGoal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[12.5px] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" /> Add Personal Goal
              </button>
              {!isToday && (
                <button
                  onClick={() => setDateOffset(0)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Back to Today
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="relative mb-8 max-w-2xl mx-auto w-full flex-1">
            {/* Desktop timeline vertical guide line */}
            <div className="absolute left-[84px] top-4 bottom-4 w-px bg-indigo-100 hidden sm:block" />

            <div className="space-y-4 sm:space-y-6 relative">
              {items.map((item) => {
                const isSlot = item.kind === 'slot';
                const isAssignment = item.kind === 'assignment';
                const isExam = item.kind === 'exam';
                const isGoal = item.kind === 'goal';

                return (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center group relative z-10 transition-all"
                  >
                    {/* Time Column (Desktop) */}
                    <div className="w-[72px] flex-shrink-0 text-right pr-4 hidden sm:block">
                      <span className="text-[12.5px] font-bold text-indigo-600">
                        {isGoal
                          ? 'Self'
                          : new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>

                    {/* Timeline Dot (Desktop) */}
                    <div className="hidden sm:flex relative z-10 w-6 h-6 items-center justify-center bg-white flex-shrink-0">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${
                          item.done ? 'bg-emerald-500' : 'bg-indigo-300 group-hover:bg-indigo-500 transition-colors'
                        }`}
                      />
                    </div>

                    {/* Item Card */}
                    <div
                      className={`flex-1 pl-3.5 sm:pl-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ml-0 sm:ml-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0 w-full max-w-full overflow-hidden ${
                        item.done
                          ? 'bg-slate-50/60 border-slate-200/70 opacity-85'
                          : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0 w-full max-w-full overflow-hidden">
                        {/* Checkbox / Kind Icon */}
                        {isGoal ? (
                          <button
                            type="button"
                            onClick={() => handleToggleGoal(item.id)}
                            className="mt-0.5 text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer flex-shrink-0"
                            aria-label={item.done ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {item.done ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300 hover:text-emerald-500" />
                            )}
                          </button>
                        ) : isAssignment ? (
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText className="w-4 h-4" />
                          </div>
                        ) : isExam ? (
                          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Award className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Clock className="w-4 h-4" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className="min-w-0 flex-1 overflow-hidden">
                              <MarqueeText
                                text={item.label}
                                className={`text-[13.5px] sm:text-[14px] font-bold text-slate-800 ${
                                  item.done && isGoal ? 'line-through text-slate-400' : ''
                                }`}
                              />
                            </div>

                            {/* Kind Badges */}
                            {isAssignment && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                                Assignment
                              </span>
                            )}
                            {isExam && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 flex-shrink-0">
                                Exam
                              </span>
                            )}
                            {isGoal && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                                Goal
                              </span>
                            )}
                          </div>

                          {/* Time on Mobile */}
                          {!isGoal && (
                            <p className="text-[11.5px] text-indigo-600 font-semibold sm:hidden mb-0.5">
                              {new Date(item.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </p>
                          )}

                          <p className="text-[12px] text-slate-500 font-medium truncate">{item.sub}</p>
                        </div>
                      </div>

                      {/* Right Action / Status */}
                      <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                        {isGoal && (
                          <button
                            onClick={() => handleDeleteGoal(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            aria-label="Delete goal"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                        {isAssignment && (
                          <button
                            onClick={() => setStudentActiveNav('Assignments')}
                            className="text-[11.5px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Open</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {isExam && (
                          <button
                            onClick={() => setStudentActiveNav('My Tests')}
                            className="text-[11.5px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>View</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}

                        {isSlot && (
                          <span
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                              item.done
                                ? 'bg-slate-100 text-slate-500'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {item.done ? 'Finished' : 'Upcoming'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Metrics Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200/80 gap-4 sm:gap-0 mt-auto">
          {/* Card 1: Total Items */}
          <div className="text-center sm:border-r border-slate-200/80 pb-3 sm:pb-0 border-b sm:border-b-0 flex flex-col justify-center">
            <p className="text-[22px] sm:text-[24px] font-extrabold text-slate-800 tracking-tight">{totalTasks}</p>
            <p className="text-[11.5px] font-medium text-slate-500 mt-0.5">
              Items {isToday ? 'Today' : 'This Day'}
            </p>
          </div>

          {/* Card 2: Scheduled Class Time */}
          <div className="text-center sm:border-r border-slate-200/80 pb-3 sm:pb-0 border-b sm:border-b-0 flex flex-col justify-center">
            <p className="text-[22px] sm:text-[24px] font-extrabold text-slate-800 tracking-tight">{studyTimeLabel}</p>
            <p className="text-[11.5px] font-medium text-slate-500 mt-0.5">Scheduled Class Time</p>
          </div>

          {/* Card 3: Day Completion */}
          <div className="flex items-center justify-center gap-3.5">
            <div className="relative w-12 h-12 flex-shrink-0">
              <PieChart width={48} height={48}>
                <Pie
                  data={[
                    { value: completionPercentage, fill: '#10b981' },
                    { value: 100 - completionPercentage, fill: '#e2e8f0' },
                  ]}
                  cx={24}
                  cy={24}
                  innerRadius={17}
                  outerRadius={24}
                  startAngle={90}
                  endAngle={-270}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {[{ fill: '#10b981' }, { fill: '#e2e8f0' }].map((e, i) => (
                    <Cell key={i} fill={e.fill} />
                  ))}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-extrabold text-emerald-600">{completionPercentage}%</span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-[12.5px] font-bold text-slate-800">Day Completion</p>
              <p className="text-[11px] text-slate-500 font-medium">
                {tasksDone} of {totalTasks} finished
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
