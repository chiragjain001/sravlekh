'use client';

import { useState } from 'react';
import {
  Video,
  Plus,
  Calendar,
  MapPin,
  Search,
  ExternalLink,
  Trash2,
  Sparkles,
  Clock,
  BookOpen,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useDashboardStore } from '@/store/dashboard-store';
import {
  useMyTeacherProfile,
  useTimetable,
  useBatchHeatmap,
  useDeleteTimetableSlot,
} from '@/hooks/useApi';
import { ScheduleExtraClassModal } from '@/components/dashboard/teacher/shared/ScheduleExtraClassModal';
import { MarqueeText } from '@/components/ui/MarqueeText';

function extractSubject(title?: string): string {
  if (!title) return 'General';
  const lower = title.toLowerCase();
  if (lower.includes('physic')) return 'Physics';
  if (lower.includes('chem')) return 'Chemistry';
  if (lower.includes('math')) return 'Mathematics';
  return 'General';
}

function getSubjectBadge(subject: string) {
  switch (subject) {
    case 'Physics':
      return 'bg-blue-50 text-blue-700 border-blue-200/80';
    case 'Chemistry':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    case 'Mathematics':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function BatchWeakTopicsPanel({
  batchId,
  batchName,
  onSchedule,
}: {
  batchId: string;
  batchName: string;
  onSchedule: (batchId: string, topic: string) => void;
}) {
  const { data: heatmapResp } = useBatchHeatmap(batchId);
  const weakTopics = (heatmapResp?.data ?? []).filter((t: any) => t.studentsStruggling > 0).slice(0, 3);
  if (weakTopics.length === 0) return null;

  return (
    <div className="space-y-3">
      {weakTopics.map((t: any) => (
        <div key={t.topicId} className="p-3.5 border border-rose-100 bg-rose-50/40 rounded-2xl">
          <div className="flex justify-between items-start mb-1.5 gap-2">
            <div className="flex-1 min-w-0">
              <MarqueeText
                text={t.topicName}
                className="text-[13px] font-bold text-slate-800"
              />
            </div>
            <span className="text-[10px] font-bold bg-white border border-rose-200 text-rose-600 px-2 py-0.5 rounded-lg flex-shrink-0">
              {batchName}
            </span>
          </div>
          <p className="text-[11.5px] text-slate-600 mb-2.5">
            {t.studentsStruggling} {t.studentsStruggling === 1 ? 'student' : 'students'} struggling. Avg mastery: {Math.round(t.averageMastery)}%
          </p>
          <button
            onClick={() => onSchedule(batchId, t.topicName)}
            className="text-[11.5px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Schedule Remedial
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
    .filter((b: any, idx: number, arr: any[]) => arr.findIndex((x: any) => x.id === b.id) === idx);

  const { data: slotsResp, isLoading, refetch } = useTimetable(user ? { teacherUserId: user.id } : undefined);
  const deleteSlot = useDeleteTimetableSlot();
  const slots: any[] = slotsResp?.data ?? slotsResp ?? [];
  const extraSlots = slots.filter((s: any) => s.type === 'EXTRA_CLASS' || s.type === 'REMEDIAL');

  const handleOpenSchedule = (batchId = '', topic = '') => {
    setModalBatchId(batchId);
    setModalTopic(topic);
    setModalOpen(true);
  };

  const enrichedClasses = extraSlots
    .map((s: any) => ({
      ...s,
      batchLabel: s.batch?.name ?? 'Assigned Batch',
    }))
    .filter((s: any) => s.title.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-4 sm:p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <ScheduleExtraClassModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialBatchId={modalBatchId}
        initialTopic={modalTopic}
        onScheduled={() => refetch()}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] sm:text-[22px] font-bold text-slate-800">Remedial & Extra Classes</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
              {extraSlots.length} Total
            </span>
          </div>
          <p className="text-[12.5px] text-slate-500 mt-0.5">
            Target weak topics, organize physical classroom clinics, or host live online doubt sessions.
          </p>
        </div>
        <button
          onClick={() => handleOpenSchedule()}
          className="flex items-center justify-center gap-2 px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-bold rounded-2xl transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Schedule Extra Class
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center gap-3 px-3.5 py-2 bg-white border border-slate-200/80 rounded-2xl shadow-2xs max-w-md">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by topic or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 text-[13px] outline-none placeholder:text-slate-400 bg-transparent min-w-0"
            />
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3.5 bg-white border border-slate-200/80 rounded-xl text-slate-600 text-[13px]">
                <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <span className="font-medium">Loading remedial and extra classes from server...</span>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrichedClasses.map((session: any) => {
                const sub = extractSubject(session.title);
                const subBadge = getSubjectBadge(sub);
                const isRemedial = session.type === 'REMEDIAL';
                const isOnline = Boolean(
                  session.roomRef &&
                    (session.roomRef.toLowerCase().includes('http') ||
                      session.roomRef.toLowerCase().includes('meet.') ||
                      session.roomRef.toLowerCase().includes('zoom') ||
                      session.roomRef.toLowerCase().startsWith('online')),
                );
                const onlineLink = isOnline
                  ? session.roomRef.replace(/^online:\s*/i, '').trim()
                  : null;

                const startDate = new Date(session.startTime);
                const endDate = new Date(session.endTime);
                const durationMins = Math.round(
                  (endDate.getTime() - startDate.getTime()) / 60_000,
                );

                return (
                  <div
                    key={session.id}
                    className="p-5 bg-white border border-slate-200/70 rounded-3xl shadow-2xs hover:border-indigo-200 hover:shadow-md transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${subBadge}`}>
                            {sub}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                              isRemedial
                                ? 'bg-rose-50 text-rose-700 border border-rose-200/80'
                                : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                            }`}
                          >
                            {isRemedial ? 'Remedial' : 'Extra Class'}
                          </span>
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                            {session.batchLabel}
                          </span>
                        </div>

                        {/* Delete/Cancel Session */}
                        <button
                          onClick={() => {
                            if (confirm(`Remove this session: "${session.title}"?`)) {
                              deleteSlot.mutate(session.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="Cancel session"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Continuous Smooth Ticker for Title */}
                      <div className="mb-3">
                        <MarqueeText
                          text={session.title}
                          className="text-[14.5px] font-bold text-slate-800"
                        />
                      </div>

                      {/* Timing & Venue */}
                      <div className="space-y-1.5 mb-4 text-[12px] text-slate-600">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>
                            {startDate.toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {' • '}
                            <span className="font-semibold text-slate-700">
                              {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                              {endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </span>{' '}
                            <span className="text-slate-400">({durationMins}m)</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isOnline ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                              <span className="text-purple-700 font-semibold truncate">
                                Online Live Class
                              </span>
                            </>
                          ) : session.roomRef ? (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="text-slate-600 font-medium truncate">
                                {session.roomRef}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action Prompts */}
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                      {isOnline && onlineLink ? (
                        <a
                          href={onlineLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-2xs"
                        >
                          <Video className="w-3.5 h-3.5" /> Start / Join Live
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </a>
                      ) : (
                        <button
                          onClick={() => {
                            setTeacherCtx({
                              classId: session.batch?.classYear ?? null,
                              subjectId: null,
                              batchId: session.batchId,
                              batchTab: 'extra-classes',
                              studentId: null,
                              testId: null,
                            });
                            setTeacherNav('classes');
                          }}
                          className="flex-1 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[12px] font-bold rounded-xl transition-colors border border-slate-200"
                        >
                          Manage Batch
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {enrichedClasses.length === 0 && (
                <div className="col-span-1 md:col-span-2 p-12 text-center bg-white border border-slate-200 rounded-3xl">
                  <Video className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-[14px] font-bold text-slate-700">No extra classes found</p>
                  <p className="text-[12px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Schedule a remedial or extra session to target low scoring topics in your batches.
                  </p>
                  <button
                    onClick={() => handleOpenSchedule()}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 font-bold text-[12.5px] rounded-xl hover:bg-indigo-100 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Schedule First Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Recommended Sessions Panel */}
        <div className="bg-white border border-slate-200/70 rounded-3xl p-5 shadow-2xs h-fit space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-600">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-slate-800">Target Weak Topics</h3>
              <p className="text-[11.5px] text-slate-500">Live AI diagnosis from recent batch test scores</p>
            </div>
          </div>

          <div className="space-y-4 pt-1">
            {myBatches.map((b: any) => (
              <BatchWeakTopicsPanel
                key={b.id}
                batchId={b.id}
                batchName={b.name}
                onSchedule={handleOpenSchedule}
              />
            ))}
            {myBatches.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-[12.5px]">
                No batch weak topics flagged at this time.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
