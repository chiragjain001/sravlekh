'use client';

import { useState } from 'react';
import { Calendar, Clock, MapPin, Search } from 'lucide-react';
import { useTimetable } from '@/hooks/useApi';

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
  const q = search.trim().toLowerCase();
  const { data: slotsResp, isPending } = useTimetable();
  const slots: Slot[] = slotsResp?.data ?? [];

  const slotsByDay = (dayIdx: number) =>
    slots
      .filter((s) => new Date(s.startTime).getDay() === dayIdx)
      .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.roomRef ?? '').toLowerCase().includes(q))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col">

        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Time Table</h2>
              <p className="text-[12px] text-slate-500">Your weekly class schedule.</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-xl">
            <Search className="w-4 h-4 text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="Search by subject or room…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 text-[13px] outline-none placeholder:text-slate-400 bg-transparent"
            />
          </div>
        </div>

        {isPending ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Loading timetable…</div>
        ) : (
          <div className="flex-1 overflow-x-auto custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 min-w-[900px] md:min-w-0">
              {DAYS.slice(1, 7).map((day, idx) => {
                const dayIdx = idx + 1; // Mon=1 … Sat=6
                const daySlots = slotsByDay(dayIdx);
                return (
                  <div key={day} className="flex flex-col">
                    <div className="bg-indigo-600 text-white text-center py-2.5 rounded-t-2xl font-bold text-[14px]">{day}</div>
                    <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-3 flex-1 space-y-3 shadow-sm min-h-[400px]">
                      {daySlots.map((slot) => (
                        <div key={slot.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${TYPE_STYLE[slot.type] ?? 'bg-slate-100 text-slate-600'}`}>
                            {slot.type.replace('_', ' ')}
                          </span>
                          <p className="text-[12.5px] font-bold text-slate-800 leading-snug mt-2 mb-2">{slot.title}</p>
                          <div className="space-y-1">
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
                      ))}
                      {daySlots.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center opacity-50 py-10">
                          <Calendar className="w-6 h-6 text-slate-300 mb-2" />
                          <span className="text-[11px] font-semibold text-slate-400 text-center">{q ? 'No matches' : 'No classes'}</span>
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
