'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';

export function StudentTimeTable() {
  const [viewMode, setViewMode] = useState<'Week' | 'Day'>('Week');
  
  const timeSlots = [
    '09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', 
    '01:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM'
  ];

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Time Table</h2>
              <p className="text-[12px] text-slate-500">Your daily class schedule.</p>
            </div>
          </div>
          <button className="text-[14px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1">
            Full Timetable <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-4 text-slate-800 font-bold text-[14px]">
            <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span>23 May – 29 May, 2025</span>
            <button className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['Week', 'Day'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as 'Week' | 'Day')}
                className={`px-5 py-1.5 text-[13px] font-bold rounded-lg transition-all ${
                  viewMode === mode ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto custom-scrollbar border border-slate-100 rounded-2xl">
          <div className="min-w-[800px] h-full flex flex-col">
            {/* Header Row */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
              <div className="w-20 flex-shrink-0 border-r border-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400">
                Time
              </div>
              {d.timetableDays.map((day, idx) => {
                const [dayName, dateStr] = day.split(' ');
                const isActive = idx === 0; // highlighting first day like image
                return (
                  <div key={day} className="flex-1 text-center py-3 border-r border-slate-100 last:border-0 relative">
                    {isActive && <div className="absolute inset-0 bg-indigo-600 rounded-lg mx-1 -mt-1 -mb-1 shadow-sm z-0" />}
                    <div className="relative z-10 flex flex-col items-center">
                      <span className={`text-[13px] font-bold ${isActive ? 'text-white' : 'text-slate-800'}`}>{dayName}</span>
                      <span className={`text-[11px] mt-0.5 ${isActive ? 'text-indigo-100 font-medium' : 'text-slate-400'}`}>{dateStr} {day.split(' ')[2]}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Time Rows */}
            <div className="flex-1 flex flex-col relative">
              {timeSlots.map(time => (
                <div key={time} className="flex flex-1 min-h-[60px] border-b border-slate-50 last:border-0 group">
                  <div className="w-20 flex-shrink-0 border-r border-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-400 group-hover:bg-slate-50 transition-colors">
                    {time}
                  </div>
                  {d.timetableDays.map(day => {
                    const event = d.timetableEvents.find(e => e.day === day && e.time === time);
                    return (
                      <div key={`${day}-${time}`} className="flex-1 border-r border-slate-50 last:border-0 p-1 relative group-hover:bg-slate-50/30 transition-colors">
                        {event && (
                          <div className={`w-full h-full rounded-xl p-2 flex flex-col items-center justify-center text-center shadow-sm border border-black/5 hover:scale-[1.02] transition-transform cursor-pointer ${event.color}`}>
                            <span className="text-[12px] font-bold leading-tight">{event.subject}</span>
                            {event.teacher && <span className="text-[10px] opacity-80 mt-1">{event.teacher}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="text-right mt-4">
          <button className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 transition-colors">
            View Full Timetable <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
