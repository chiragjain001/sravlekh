'use client';

import { useState } from 'react';
import { Plus, Calendar, MapPin } from 'lucide-react';
import { useTimetable } from '@/hooks/useApi';
import { ScheduleExtraClassModal } from '@/components/dashboard/teacher/shared/ScheduleExtraClassModal';

export function BatchExtraClasses({ batchId }: { batchId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const { data: slotsResp, isLoading, refetch } = useTimetable({ batchId });
  const slots: any[] = slotsResp?.data ?? slotsResp ?? [];

  const extraSlots = slots.filter((s: any) => s.type === 'EXTRA_CLASS' || s.type === 'REMEDIAL');
  const now = Date.now();
  const upcoming = extraSlots.filter((s: any) => new Date(s.startTime).getTime() >= now);
  const completed = extraSlots.filter((s: any) => new Date(s.startTime).getTime() < now);

  return (
    <div className="space-y-5 animate-fadein">
      <ScheduleExtraClassModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        initialBatchId={batchId}
        onScheduled={() => refetch()}
      />

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Extra & Remedial Classes</h3>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Schedule Session
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-[13px]">Loading sessions…</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">Upcoming</h4>
              <div className="space-y-3">
                {upcoming.map((s: any) => (
                  <div key={s.id} className="border border-slate-100 rounded-2xl p-5 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${s.type === 'REMEDIAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>{s.type.replace('_', ' ')}</span>
                    </div>
                    <p className="text-[14px] font-bold text-slate-800 mb-3">{s.title}</p>
                    <div className="flex flex-wrap items-center gap-5 text-[12px] text-slate-600">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-indigo-400" /><span className="font-semibold text-slate-800">{new Date(s.startTime).toLocaleDateString()}</span> · {new Date(s.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                      {s.roomRef && <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-indigo-400" />{s.roomRef}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-3">Past</h4>
              <div className="space-y-2">
                {completed.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl opacity-70">
                    <div>
                      <p className="text-[13px] font-bold text-slate-700">{s.title}</p>
                      <p className="text-[11px] text-slate-500">{new Date(s.startTime).toLocaleDateString()}{s.roomRef ? ` · ${s.roomRef}` : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {extraSlots.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              <p className="text-[13px] font-semibold">No extra classes scheduled yet.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
