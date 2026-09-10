'use client';

import { useState } from 'react';
import { BookOpen, Clock, MapPin, CalendarCheck, CalendarClock } from 'lucide-react';
import { useTimetable } from '@/hooks/useApi';

interface Slot {
  id: string;
  type: string;
  title: string;
  roomRef?: string | null;
  startTime: string;
  endTime: string;
}

export function StudentExtraClasses() {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const { data: slotsResp, isPending } = useTimetable();
  const slots: Slot[] = slotsResp?.data ?? [];

  // Reuses the same real Timetable data every other screen in the app is
  // backed by, filtered to the REMEDIAL/EXTRA_CLASS slot types — there's no
  // separate "extra class" domain, and there doesn't need to be. No fake
  // join/RSVP action: no video-session infrastructure exists anywhere in
  // this codebase, so a "Join" button here would just be theater. This is
  // an honest schedule listing instead.
  const extraSlots = slots.filter((s) => s.type === 'REMEDIAL' || s.type === 'EXTRA_CLASS');
  const now = Date.now();
  const upcoming = extraSlots.filter((s) => new Date(s.startTime).getTime() >= now).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const past = extraSlots.filter((s) => new Date(s.startTime).getTime() < now).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const filtered = activeTab === 'Upcoming' ? upcoming : past;

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Extra &amp; Remedial Classes</h2>
              <p className="text-[12px] text-slate-500">Extra sessions scheduled for your batch.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 border-b border-slate-100 mb-6">
          {([
            { id: 'Upcoming' as const, label: `Upcoming (${upcoming.length})` },
            { id: 'Past' as const, label: `Past (${past.length})` },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-[13.5px] font-bold transition-all relative ${
                activeTab === tab.id ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-emerald-500 rounded-t-full animate-fadein" />
              )}
            </button>
          ))}
        </div>

        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
          {isPending ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />)}</div>
          ) : filtered.length > 0 ? filtered.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-slate-100 rounded-2xl hover:border-emerald-100 hover:bg-emerald-50/20 transition-all gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-emerald-600 bg-emerald-50">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-800">{item.title}</h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block">
                    {item.type.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-1 text-slate-500">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-700">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(item.startTime).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                </div>
                {item.roomRef && (
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    <MapPin className="w-3.5 h-3.5" /> {item.roomRef}
                  </div>
                )}
              </div>
            </div>
          )) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              {activeTab === 'Upcoming' ? <CalendarClock className="w-12 h-12 mb-3 opacity-20" /> : <CalendarCheck className="w-12 h-12 mb-3 opacity-20" />}
              <p className="text-[14px] font-medium text-slate-500">No {activeTab.toLowerCase()} extra classes for your batch.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
