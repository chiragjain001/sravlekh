'use client';

import { useState } from 'react';
import { Calendar, Clock, MapPin, Search } from 'lucide-react';
import { useTimetable } from '@/hooks/useApi';
import { MarqueeText } from '@/components/ui/MarqueeText';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TYPE_STYLE: Record<string, string> = {
  CLASS: 'bg-indigo-100 text-indigo-700',
  EXAM: 'bg-rose-100 text-rose-700',
  REVISION: 'bg-purple-100 text-purple-700',
  REMEDIAL: 'bg-amber-100 text-amber-700',
  EXTRA_CLASS: 'bg-amber-100 text-amber-700',
  BREAK: 'bg-slate-100 text-slate-600',
  HOLIDAY: 'bg-rose-100 text-rose-700',
};

interface Slot {
  id: string;
  type: string;
  title: string;
  roomRef?: string | null;
  startTime: string;
  endTime: string;
}

function formatTimeRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(start).toLocaleTimeString([], opts)} - ${new Date(end).toLocaleTimeString([], opts)}`;
}

export function StudentTimeTable() {
  const [search, setSearch] = useState('');
  // Default mobile day to current day of week (1=Mon ... 6=Sat) or Mon if Sunday
  const todayIdx = new Date().getDay();
  const defaultMobileDay = todayIdx >= 1 && todayIdx <= 6 ? todayIdx : 1;
  const [mobileDay, setMobileDay] = useState<number | 'ALL'>(defaultMobileDay);

  const q = search.trim().toLowerCase();
  const { data: slotsResp, isPending } = useTimetable();
  const slots: Slot[] = slotsResp?.data ?? [];

  const slotsByDay = (dayIdx: number) =>
    slots
      .filter((s) => new Date(s.startTime).getDay() === dayIdx)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.roomRef ?? '').toLowerCase().includes(q))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const daysToRender = DAYS.slice(1, 7).map((day, idx) => ({ day, dayIdx: idx + 1 }));

  return (
    <div className="p-3 sm:p-5 md:p-6 animate-fadein h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col min-w-0 max-w-full overflow-hidden">

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-5 gap-3.5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[18px] sm:text-[19px] font-bold text-slate-800">Time Table</h2>
              <p className="text-[12px] text-slate-500">Your weekly class and exam schedule.</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl w-full sm:w-auto">
            <Search className="w-4 h-4 text-slate-400 ml-1.5 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by subject or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-52 text-[12.5px] outline-none placeholder:text-slate-400 bg-transparent text-slate-800"
            />
          </div>
        </div>

        {/* Mobile Apple-style Day Selector (Pills) */}
        <div className="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-3 mb-2">
          {daysToRender.map(({ day, dayIdx }) => {
            const isSelected = mobileDay === dayIdx;
            const isToday = todayIdx === dayIdx;
            return (
              <button
                key={day}
                onClick={() => setMobileDay(dayIdx)}
                className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{day}</span>
                {isToday && (
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-300' : 'bg-indigo-600'}`} />
                )}
              </button>
            );
          })}
          <button
            onClick={() => setMobileDay('ALL')}
            className={`px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all whitespace-nowrap cursor-pointer ${
              mobileDay === 'ALL'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Full Week
          </button>
        </div>

        {isPending ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] py-16">
            Loading timetable…
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto custom-scrollbar min-w-0 max-w-full">
            <div
              className={
                mobileDay === 'ALL'
                  ? 'grid grid-cols-1 md:grid-cols-6 gap-4 min-w-[780px] md:min-w-0'
                  : 'grid grid-cols-1 md:grid-cols-6 gap-4'
              }
            >
              {daysToRender
                .filter(({ dayIdx }) => mobileDay === 'ALL' || mobileDay === dayIdx || typeof window === 'undefined')
                .map(({ day, dayIdx }) => {
                  const daySlots = slotsByDay(dayIdx);
                  const isToday = todayIdx === dayIdx;

                  return (
                    <div key={day} className="flex flex-col min-w-0 max-w-full overflow-hidden">
                      <div
                        className={`text-white text-center py-2 rounded-t-2xl font-bold text-[13px] sm:text-[14px] flex items-center justify-center gap-1.5 shadow-xs ${
                          isToday ? 'bg-indigo-600 ring-2 ring-indigo-400 ring-offset-1' : 'bg-slate-700'
                        }`}
                      >
                        <span>{day}</span>
                        {isToday && (
                          <span className="text-[10px] bg-amber-400 text-amber-950 font-black px-1.5 py-0.2 rounded-md">
                            TODAY
                          </span>
                        )}
                      </div>
                      <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-3 flex-1 space-y-2.5 shadow-sm min-h-[360px] md:min-h-[420px] overflow-hidden">
                        {daySlots.map((slot) => (
                          <div
                            key={slot.id}
                            className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all min-w-0 max-w-full overflow-hidden"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider inline-block ${
                                TYPE_STYLE[slot.type] ?? 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {slot.type.replace('_', ' ')}
                            </span>
                            <div className="mt-1.5 mb-2 w-full max-w-full overflow-hidden">
                              <MarqueeText
                                text={slot.title}
                                className="text-[12.5px] font-bold text-slate-800"
                              />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                <Clock className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{formatTimeRange(slot.startTime, slot.endTime)}</span>
                              </div>
                              {slot.roomRef && (
                                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                  <MapPin className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{slot.roomRef}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {daySlots.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center opacity-60 py-12">
                            <Calendar className="w-6 h-6 text-slate-300 mb-2" />
                            <span className="text-[11.5px] font-semibold text-slate-400 text-center">
                              {q ? 'No matches' : 'No classes'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
