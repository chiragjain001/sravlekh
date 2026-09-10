'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Search } from 'lucide-react';
import { useTimetable } from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_INDEX: Record<(typeof DAYS)[number], number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const TYPE_STYLE: Record<string, string> = {
  CLASS: 'bg-indigo-100 text-indigo-700',
  EXAM: 'bg-rose-100 text-rose-700',
  REVISION: 'bg-purple-100 text-purple-700',
  REMEDIAL: 'bg-amber-100 text-amber-700',
  EXTRA_CLASS: 'bg-amber-100 text-amber-700',
  BREAK: 'bg-slate-100 text-slate-600',
  HOLIDAY: 'bg-rose-100 text-rose-700',
};

function formatTimeRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(start).toLocaleTimeString([], opts)} - ${new Date(end).toLocaleTimeString([], opts)}`;
}

export function TeacherTimeTable() {
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const { data: slotsResp, isLoading } = useTimetable(user ? { teacherUserId: user.id } : undefined);
  const slots: any[] = slotsResp?.data ?? slotsResp ?? [];

  const handleSlotClick = (batchId: string) => {
    setTeacherCtx({
      classId: teacherCtx.classId,
      subjectId: teacherCtx.subjectId || null,
      batchId,
      batchTab: 'overview',
      studentId: null,
      testId: null,
    });
    setTeacherNav('classes');
  };

  const slotsByDay = (day: (typeof DAYS)[number]) => {
    const dayNum = DAY_INDEX[day];
    return slots
      .filter((s: any) => new Date(s.startTime).getDay() === dayNum)
      .filter((s: any) => {
        if (!q) return true;
        const batchLabel = s.batch?.name ?? s.batchId ?? '';
        return (
          s.title.toLowerCase().includes(q) ||
          (s.roomRef ?? '').toLowerCase().includes(q) ||
          batchLabel.toLowerCase().includes(q) ||
          s.type.toLowerCase().includes(q)
        );
      })
      .sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Global Time Table</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Your complete weekly schedule across all assigned batches.</p>
        </div>
        <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl">
          <Search className="w-4 h-4 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Search by topic, batch, or room…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-52 text-[13px] outline-none placeholder:text-slate-400 bg-transparent"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 text-[11px] font-bold mr-1">✕</button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-slate-400 text-[13px]">Loading timetable…</div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {DAYS.map(day => {
          const daySlots = slotsByDay(day);
          return (
          <div key={day} className="flex flex-col">
            <div className="bg-indigo-600 text-white text-center py-2.5 rounded-t-2xl font-bold text-[14px]">
              {day}
            </div>
            <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-3 flex-1 space-y-3 shadow-sm min-h-[500px]">
              {daySlots.map((slot: any) => {
                const batchLabel = slot.batch?.name ?? 'All Batches';
                return (
                  <div
                    key={slot.id}
                    onClick={() => slot.batchId && handleSlotClick(slot.batchId)}
                    className="p-3 border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group bg-slate-50 hover:bg-white"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${TYPE_STYLE[slot.type] ?? 'bg-slate-100 text-slate-600'}`}>
                        {slot.type.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        {batchLabel}
                      </span>
                    </div>

                    <p className="text-[12.5px] font-bold text-slate-800 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">
                      {slot.title}
                    </p>

                    <div className="space-y-1 mt-auto">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{formatTimeRange(slot.startTime, slot.endTime)}</span>
                      </div>
                      {slot.roomRef && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span>{slot.roomRef}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {daySlots.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-50 py-10">
                  <CalendarIcon className="w-6 h-6 text-slate-300 mb-2" />
                  <span className="text-[11px] font-semibold text-slate-400 text-center">{q ? 'No matches' : 'No classes'}</span>
                </div>
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
