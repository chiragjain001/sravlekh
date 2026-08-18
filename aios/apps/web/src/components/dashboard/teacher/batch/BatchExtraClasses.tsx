'use client';

import { useState } from 'react';
import { Plus, Calendar, MapPin, Users, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ScheduleExtraClassModal } from '@/components/dashboard/teacher/shared/ScheduleExtraClassModal';

interface Session {
  id: string; topic: string; date: string; time: string;
  room: string; enrolled: number; capacity: number; status: string;
}

export function BatchExtraClasses({ sessions: initialSessions }: { sessions: Session[] }) {
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [showCreate, setShowCreate] = useState(false);

  const upcoming  = sessions.filter(s => s.status === 'upcoming');
  const completed = sessions.filter(s => s.status === 'completed');

  return (
    <div className="space-y-5 animate-fadein">
      <ScheduleExtraClassModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSchedule={(newSession) => {
          setSessions(prev => [newSession, ...prev]);
          toast.success('Session scheduled successfully!');
        }}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Extra & Remedial Classes</h3>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Schedule Session
        </button>
      </div>

      {upcoming.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">Upcoming</h4>
          <div className="space-y-3">
            {upcoming.map(s => (
              <div key={s.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-sm transition-all">
                <p className="text-[14px] font-bold text-slate-800 mb-3">{s.topic}</p>
                <div className="flex flex-wrap items-center gap-5 text-[12px] text-slate-600">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-400" /><span className="font-semibold text-slate-800">{s.date}</span> · {s.time}</span>
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-400" />{s.room}</span>
                  <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-indigo-400" />{s.enrolled} / {s.capacity} enrolled</span>
                </div>
                <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${(s.enrolled/s.capacity)*100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">Completed</h4>
          <div className="space-y-2">
            {completed.map(s => (
              <div key={s.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl opacity-70">
                <div>
                  <p className="text-[13px] font-bold text-slate-700">{s.topic}</p>
                  <p className="text-[11px] text-slate-500">{s.date} · {s.room} · {s.enrolled} attended</p>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
          <p className="text-[13px] font-semibold">No extra classes scheduled yet.</p>
        </div>
      )}
    </div>
  );
}

