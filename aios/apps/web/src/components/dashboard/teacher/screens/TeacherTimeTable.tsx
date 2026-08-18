'use client';

import { useState } from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, Search } from 'lucide-react';
import { weeklyTimetable, batches } from '@/lib/mock-data/teacher';
import { useDashboardStore } from '@/store/dashboard-store';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function TeacherTimeTable() {
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();
  // P1-4: search state wired to filter timetable slots
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const handleSlotClick = (batchId: string) => {
    setTeacherCtx({
      classId: batchId.startsWith('12') ? '12' : '11',
      subjectId: teacherCtx.subjectId || 'physics',
      batchId,
      batchTab: 'overview',
      studentId: null,
      testId: null,
    });
    setTeacherNav('classes');
  };

  /** Filter a day's slots based on the search query */
  const filterSlots = (slots: (typeof weeklyTimetable)[keyof typeof weeklyTimetable]) => {
    if (!q) return slots ?? [];
    return (slots ?? []).filter(slot => {
      const batchLabel = batches.find(b => b.id === slot.batchId)?.label ?? slot.batchId;
      return (
        slot.topic.toLowerCase().includes(q) ||
        slot.room.toLowerCase().includes(q) ||
        batchLabel.toLowerCase().includes(q) ||
        slot.type.toLowerCase().includes(q)
      );
    });
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

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {DAYS.map(day => (
          <div key={day} className="flex flex-col">
            <div className="bg-indigo-600 text-white text-center py-2.5 rounded-t-2xl font-bold text-[14px]">
              {day}
            </div>
            <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-3 flex-1 space-y-3 shadow-sm min-h-[500px]">
              {filterSlots(weeklyTimetable[day]).map((slot, idx) => {
                const batchLabel = batches.find(b => b.id === slot.batchId)?.label || slot.batchId;
                return (
                  <div
                    key={`${day}-${idx}`}
                    onClick={() => handleSlotClick(slot.batchId)}
                    className="p-3 border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group bg-slate-50 hover:bg-white"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        slot.type === 'class' ? 'bg-indigo-100 text-indigo-700' :
                        slot.type === 'practical' ? 'bg-purple-100 text-purple-700' :
                        slot.type === 'extra' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>
                        {slot.type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                        Batch {batchLabel}
                      </span>
                    </div>

                    <p className="text-[12.5px] font-bold text-slate-800 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">
                      {slot.topic}
                    </p>

                    <div className="space-y-1 mt-auto">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{slot.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span>{slot.room}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filterSlots(weeklyTimetable[day]).length === 0 && (
                <div className="h-full flex flex-col items-center justify-center opacity-50 py-10">
                  <CalendarIcon className="w-6 h-6 text-slate-300 mb-2" />
                  <span className="text-[11px] font-semibold text-slate-400 text-center">{q ? 'No matches' : 'No classes'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
