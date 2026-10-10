'use client';

import { useState } from 'react';
import { Plus, Calendar, MapPin } from 'lucide-react';
import { useTimetable } from '@/hooks/useApi';
import { ScheduleExtraClassModal } from '@/components/dashboard/teacher/shared/ScheduleExtraClassModal';
import { InlineLoadingSpinner } from '@/components/ui/foundation';

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

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-700">Extra & Remedial Classes</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[12.5px] font-bold rounded-xl transition-all shadow-xs"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Schedule Session</span>
        </button>
      </div>

      {isLoading ? (
        <InlineLoadingSpinner label="Loading sessions for this batch..." />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div>
              <h4 className="text-[11.5px] sm:text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2.5 sm:mb-3">Upcoming</h4>
              <div className="space-y-2.5 sm:space-y-3">
                {upcoming.map((s: any) => (
                  <div key={s.id} className="border border-slate-100 rounded-2xl p-3.5 sm:p-5 bg-white shadow-2xs hover:shadow-xs transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${s.type === 'REMEDIAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {s.type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 mb-2 sm:mb-3 truncate">{s.title}</p>
                    <div className="flex flex-wrap items-center gap-3 sm:gap-5 text-[11.5px] sm:text-[12px] text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="font-semibold text-slate-800">{new Date(s.startTime).toLocaleDateString()}</span> · {new Date(s.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      {s.roomRef && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                          <span>{s.roomRef}</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed.length > 0 && (
            <div>
              <h4 className="text-[11.5px] sm:text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2.5 sm:mb-3">Past</h4>
              <div className="space-y-2">
                {completed.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between p-3.5 sm:p-4 border border-slate-100 rounded-xl bg-white/70">
                    <div className="min-w-0 pr-3">
                      <p className="text-[13px] font-bold text-slate-700 truncate">{s.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{new Date(s.startTime).toLocaleDateString()}{s.roomRef ? ` · ${s.roomRef}` : ''}</p>
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
