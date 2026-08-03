'use client';

import { AlertTriangle, ChevronRight } from 'lucide-react';

interface WeakTopic  { topic: string; weakCount: number; totalStudents: number; avgScore: number }
interface WeakStudent { studentId: string; name: string; batchId: string; avgInTopic: number }

export function BatchWeakTopics({ weakTopics, topicWeakStudents, onSelectStudent }: {
  weakTopics: WeakTopic[];
  topicWeakStudents: Record<string, WeakStudent[]>;
  onSelectStudent: (id: string) => void;
}) {
  if (weakTopics.length === 0) {
    return (
      <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 animate-fadein">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-[14px] font-semibold text-emerald-600">No weak topics. This batch is doing well!</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fadein">
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[13px] text-amber-800 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <p>These topics were identified as weak based on the last 3 tests. Take action to improve student performance.</p>
      </div>

      {weakTopics.map(wt => {
        const weakStudents = topicWeakStudents[wt.topic] ?? [];
        const pct = Math.round((wt.weakCount / wt.totalStudents) * 100);

        return (
          <div key={wt.topic} className="border border-slate-100 rounded-2xl overflow-hidden">
            {/* Topic header */}
            <div className="p-5 bg-rose-50/40 border-b border-rose-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[15px] font-bold text-slate-800">{wt.topic}</p>
                  <p className="text-[12px] text-rose-600 font-semibold mt-0.5">
                    {wt.weakCount} of {wt.totalStudents} students scored below 60% · Avg: {wt.avgScore}%
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3.5 py-1.5 bg-indigo-600 text-white text-[11.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
                    Schedule Extra Class
                  </button>
                  <button className="px-3.5 py-1.5 border border-indigo-200 text-indigo-700 text-[11.5px] font-bold rounded-xl hover:bg-indigo-50 transition-colors">
                    Assign Practice Set
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                <span>Students affected</span>
                <span className="font-bold text-rose-600">{pct}%</span>
              </div>
              <div className="w-full bg-white rounded-full h-2">
                <div className="h-2 rounded-full bg-rose-500" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Weak students for this topic */}
            {weakStudents.length > 0 && (
              <div className="divide-y divide-slate-50">
                {weakStudents.map(s => (
                  <button
                    key={s.studentId}
                    onClick={() => onSelectStudent(s.studentId)}
                    className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] font-black">
                        {s.name.split(' ').map(n=>n[0]).join('')}
                      </div>
                      <p className="text-[13px] font-semibold text-slate-800">{s.name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[13px] font-bold text-rose-600">{s.avgInTopic}%</span>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
