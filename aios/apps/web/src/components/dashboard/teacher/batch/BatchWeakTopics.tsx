'use client';

import { useState } from 'react';
import {
  AlertTriangle, Users, BookOpen,
  CalendarPlus, ChevronRight, ArrowRight
} from 'lucide-react';
import { useBatchHeatmap, useWeakStudentsForTopic } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { StudentListModal } from '../shared/StudentListModal';
import { ScheduleExtraClassModal } from '../shared/ScheduleExtraClassModal';
import { InlineLoadingSpinner } from '@/components/ui/foundation';

export function BatchWeakTopics({ batchId, onSelectStudent, onScheduleRemedial }: {
  batchId: string;
  onSelectStudent: (id: string) => void;
  /** If provided, called with (batchId, topicName) when the "Schedule Extra Class" button is clicked.
   *  If omitted, the component manages its own modal internally. */
  onScheduleRemedial?: (batchId: string, topic: string) => void;
}) {
  const { setTeacherNav } = useDashboardStore();
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  // internal modal state used only when parent doesn't provide onScheduleRemedial
  const [localModalOpen, setLocalModalOpen]   = useState(false);
  const [localModalBatchId, setLocalModalBatchId] = useState('');
  const [localModalTopic, setLocalModalTopic] = useState('');
  const { data: heatmapResp, isLoading } = useBatchHeatmap(batchId);
  const allTopics: any[] = heatmapResp?.data ?? [];
  // A batch struggling on a topic = at least one student below the mastery threshold.
  const weakTopics = allTopics.filter((t) => t.studentsStruggling > 0);

  const { data: weakStudents = [] } = useWeakStudentsForTopic(batchId, openTopicId);
  const activeTopic = weakTopics.find((t) => t.topicId === openTopicId);

  if (isLoading) {
    return <InlineLoadingSpinner label="Analyzing topic mastery and struggling students..." />;
  }

  if (weakTopics.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 animate-fadein">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-[14px] font-semibold text-emerald-600">No weak topics. This batch is doing well!</p>
      </div>
    );
  }

  return (
    <>
      {openTopicId && activeTopic && (
        <StudentListModal
          topic={activeTopic.topicName}
          weakCount={activeTopic.studentsStruggling}
          totalStudents={activeTopic.totalStudents}
          avgScore={Math.round(activeTopic.averageMastery)}
          students={weakStudents}
          onClose={() => setOpenTopicId(null)}
          onSelectStudent={onSelectStudent}
        />
      )}

      <div className="space-y-5 animate-fadein">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[13px] text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
          <p>These topics are based on this batch's live mastery scores. Click a topic to see which students need help.</p>
        </div>

        {weakTopics.map((wt) => {
          const pct = wt.totalStudents > 0 ? Math.round((wt.studentsStruggling / wt.totalStudents) * 100) : 0;

          return (
            <div
              key={wt.topicId}
              className="border border-slate-100 rounded-2xl overflow-hidden hover:border-rose-200 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => setOpenTopicId(wt.topicId)}
            >
              <div className="p-3.5 sm:p-5">
                <div className="flex items-start justify-between gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] sm:text-[15px] font-bold text-slate-800 group-hover:text-rose-700 transition-colors truncate">
                      {wt.topicName}
                    </p>
                    <p className="text-[11.5px] sm:text-[12px] text-rose-600 font-semibold mt-0.5 truncate">
                      {wt.studentsStruggling} of {wt.totalStudents} students below threshold · Avg: {Math.round(wt.averageMastery)}%
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <span className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10.5px] sm:text-[11px] font-bold rounded-lg">
                      <Users className="w-3 h-3" /> {wt.studentsStruggling}
                    </span>
                    <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                  <span>Students affected</span>
                  <span className="font-bold text-rose-600">{pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-gradient-to-r from-rose-400 to-rose-600" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/70 p-3 sm:px-5 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5" onClick={e => e.stopPropagation()}>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => {
                      if (onScheduleRemedial) {
                        onScheduleRemedial(batchId, wt.topicName);
                      } else {
                        setLocalModalBatchId(batchId);
                        setLocalModalTopic(wt.topicName);
                        setLocalModalOpen(true);
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[11px] sm:text-[11.5px] font-bold rounded-xl transition-all text-center"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Extra Class</span>
                  </button>
                  <button
                    onClick={() => setTeacherNav('assessments')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50 active:scale-[0.98] text-[11px] sm:text-[11.5px] font-bold rounded-xl transition-all text-center"
                  >
                    <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">Practice Set</span>
                  </button>
                </div>
                <span className="text-[11px] text-slate-400 flex items-center justify-end gap-1 font-medium pt-0.5 sm:pt-0">
                  <span>View students</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {/* internal modal for when parent doesn't wire up onScheduleRemedial */}
      <ScheduleExtraClassModal
        isOpen={localModalOpen}
        onClose={() => setLocalModalOpen(false)}
        initialBatchId={localModalBatchId}
        initialTopic={localModalTopic}
        onScheduled={() => setLocalModalOpen(false)}
      />
    </>
  );
}
