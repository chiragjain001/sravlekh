'use client';

import { useState } from 'react';
import { Plus, Calendar, MapPin, Users, CheckCircle2, X } from 'lucide-react';

interface Session {
  id: string; topic: string; date: string; time: string;
  room: string; enrolled: number; capacity: number; status: string;
}

export function BatchExtraClasses({ sessions }: { sessions: Session[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [done, setDone]   = useState(false);
  const [form, setForm]   = useState({ topic: '', date: '', time: '', room: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(true);
    setTimeout(() => { setShowCreate(false); setDone(false); setForm({ topic: '', date: '', time: '', room: '' }); }, 1500);
  };

  const upcoming  = sessions.filter(s => s.status === 'upcoming');
  const completed = sessions.filter(s => s.status === 'completed');

  return (
    <div className="space-y-5 animate-fadein">
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Extra & Remedial Classes</h3>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Schedule Session
        </button>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4 animate-fadein">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[16px] font-bold text-slate-800">Schedule Extra Class</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            {done ? (
              <div className="flex flex-col items-center py-8 gap-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                <p className="text-[14px] font-bold text-slate-800">Session Scheduled!</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Topic / Purpose *</label>
                  <input required value={form.topic} onChange={e => setForm(p=>({...p,topic:e.target.value}))}
                    placeholder="e.g. Rotational Motion – Torque Problems"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Date *</label>
                    <input required type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Time *</label>
                    <input required type="time" value={form.time} onChange={e => setForm(p=>({...p,time:e.target.value}))}
                      className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Room *</label>
                  <input required value={form.room} onChange={e => setForm(p=>({...p,room:e.target.value}))}
                    placeholder="e.g. Room 201"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="submit" className="flex-1 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700">Schedule</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
