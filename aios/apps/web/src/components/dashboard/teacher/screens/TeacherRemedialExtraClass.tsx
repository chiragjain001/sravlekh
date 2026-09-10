'use client';

import { useState } from 'react';
import { Video, Plus, Calendar, MapPin, Search } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import { useMyTeacherProfile, useTimetable, useBatchHeatmap, useSubjects } from '@/hooks/useApi';
import { ScheduleExtraClassModal } from '@/components/dashboard/teacher/shared/ScheduleExtraClassModal';

function BatchWeakTopicsPanel({ batchId, batchName, onSchedule }: { batchId: string; batchName: string; onSchedule: (batchId: string, topic: string) => void }) {
  const { data: heatmapResp } = useBatchHeatmap(batchId);
  const weakTopics = (heatmapResp?.data ?? []).filter((t: any) => t.studentsStruggling > 0).slice(0, 3);
  if (weakTopics.length === 0) return null;

  return (
    <div className="space-y-3">
      {weakTopics.map((t: any) => (
        <div key={t.topicId} className="p-3 border border-rose-100 bg-rose-50/50 rounded-xl">
          <div className="flex justify-between items-start mb-2">
            <p className="text-[13px] font-bold text-slate-800">{t.topicName}</p>
            <span className="text-[10px] font-bold bg-white border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded">{batchName}</span>
          </div>
          <p className="text-[11.5px] text-slate-600 mb-3">{t.studentsStruggling} {t.studentsStruggling === 1 ? 'student' : 'students'} struggling. Avg mastery: {Math.round(t.averageMastery)}%</p>
          <button
            onClick={() => onSchedule(batchId, t.topicName)}
            className="text-[11.5px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Schedule Remedial
          </button>
        </div>
      ))}
    </div>
  );
}

export function TeacherRemedialExtraClass() {
  const { user } = useAuth();
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBatchId, setModalBatchId] = useState('');
  const [modalTopic, setModalTopic] = useState('');

  const { data: profile } = useMyTeacherProfile();
  const myBatches = (profile?.batchAssignments ?? [])
    .filter((a: any) => !a.removedAt)
    .map((a: any) => a.batch)
    .filter((b: any, idx: number, arr: any[]) => arr.findIndex(x => x.id === b.id) === idx);

  const { data: slotsResp, isLoading, refetch } = useTimetable(user ? { teacherUserId: user.id } : undefined);
  const slots: any[] = slotsResp?.data ?? slotsResp ?? [];
  const extraSlots = slots.filter((s: any) => s.type === 'EXTRA_CLASS' || s.type === 'REMEDIAL');

  const handleOpenSchedule = (batchId = '', topic = '') => {
    setModalBatchId(batchId);
    setModalTopic(topic);
    setModalOpen(true);
  };

  const enrichedClasses = extraSlots.map((s: any) => ({
    ...s,
    batchLabel: s.batch?.name ?? 'Unknown Batch',
  })).filter((s: any) => s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <ScheduleExtraClassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialBatchId={modalBatchId}
        initialTopic={modalTopic}
        onScheduled={() => refetch()}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Remedial & Extra Classes</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage extra sessions and address weak topics across all your batches.</p>
        </div>
        <button
          onClick={() => handleOpenSchedule()}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Schedule Extra Class
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl max-w-md">
            <Search className="w-4 h-4 text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="Search by topic..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 text-[13px] outline-none placeholder:text-slate-400 bg-transparent"
            />
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-[13px]">Loading sessions…</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrichedClasses.map((session: any) => (
                <div key={session.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${session.type === 'REMEDIAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                        {session.type.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{session.batchLabel}</span>
                    </div>
                  </div>

                  <h3 className="text-[15px] font-bold text-slate-800 mb-4">{session.title}</h3>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{new Date(session.startTime).toLocaleDateString()} • {new Date(session.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    {session.roomRef && (
                      <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <span>{session.roomRef}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setTeacherCtx({ classId: session.batch?.classYear ?? null, subjectId: null, batchId: session.batchId, batchTab: 'extra-classes', studentId: null, testId: null });
                      setTeacherNav('classes');
                    }}
                    className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[12.5px] font-bold rounded-xl transition-colors border border-slate-200"
                  >
                    Manage Session
                  </button>
                </div>
              ))}
              {enrichedClasses.length === 0 && (
                <div className="col-span-1 md:col-span-2 p-12 text-center bg-white border border-slate-200 rounded-2xl">
                  <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-[14px] font-semibold text-slate-600">No extra classes found.</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-fit">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">Recommended Sessions</h3>
          <p className="text-[12.5px] text-slate-500 mb-4">Based on live mastery scores for your batches.</p>

          <div className="space-y-4">
            {myBatches.map((b: any) => (
              <BatchWeakTopicsPanel key={b.id} batchId={b.id} batchName={b.name} onSchedule={handleOpenSchedule} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
