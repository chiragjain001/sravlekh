'use client';

import { useState } from 'react';
import {
  AlertTriangle, Users, BookOpen,
  CalendarPlus, ChevronRight, ArrowRight
} from 'lucide-react';
import { useBatchHeatmap, useWeakStudentsForTopic } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { StudentListModal } from '../shared/StudentListModal';

export function BatchWeakTopics({ batchId, onSelectStudent }: {
  batchId: string;
  onSelectStudent: (id: string) => void;
}) {
  const { setTeacherNav } = useDashboardStore();
  const [openTopicId, setOpenTopicId] = useState<string | null>(null);
  const { data: heatmapResp, isLoading } = useBatchHeatmap(batchId);
  const allTopics: any[] = heatmapResp?.data ?? [];
  // A batch struggling on a topic = at least one student below the mastery threshold.
  const weakTopics = allTopics.filter((t) => t.studentsStruggling > 0);

  const { data: weakStudents = [] } = useWeakStudentsForTopic(batchId, openTopicId);
  const activeTopic = weakTopics.find((t) => t.topicId === openTopicId);

  if (isLoading) {
    return <div className="py-16 text-center text-slate-400 text-[13px] animate-fadein">Loading weak-topic analysis…</div>;
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
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[15px] font-bold text-slate-800 group-hover:text-rose-700 transition-colors">
                      {wt.topicName}
                    </p>
                    <p className="text-[12px] text-rose-600 font-semibold mt-0.5">
                      {wt.studentsStruggling} of {wt.totalStudents} students below threshold · Avg: {Math.round(wt.averageMastery)}%
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-lg">
                      <Users className="w-3 h-3" /> {wt.studentsStruggling} students
                    </span>
                    <span className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-rose-100 flex items-center justify-center transition-colors">
                      <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
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

              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5 flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setTeacherNav('remedial-extra')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <CalendarPlus className="w-3 h-3" /> Schedule Extra Class
                </button>
                <button
                  onClick={() => setTeacherNav('assignments')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-700 text-[11px] font-bold rounded-lg hover:bg-indigo-50 transition-colors"
                >
                  <BookOpen className="w-3 h-3" /> Assign Practice Set
                </button>
                <span className="ml-auto text-[11px] text-slate-400 flex items-center gap-1">
                  Click card to view students <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
