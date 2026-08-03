'use client';

import { useState } from 'react';
import { Video, Plus, Calendar, Users, MapPin, Search } from 'lucide-react';
import { extraClasses, batches, batchWeakTopics } from '@/lib/mock-data/teacher';
import { useDashboardStore } from '@/store/dashboard-store';

export function TeacherRemedialExtraClass() {
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [searchTerm, setSearchTerm] = useState('');

  const enrichedClasses = extraClasses.map(ec => ({
    ...ec,
    batchLabel: batches.find(b => b.id === ec.batchId)?.label || ec.batchId
  })).filter(ec => ec.topic.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Remedial & Extra Classes</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage extra sessions and address weak topics across all your batches.</p>
        </div>
        <button
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrichedClasses.map(session => (
              <div key={session.id} className="p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      session.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                      session.status === 'upcoming'  ? 'bg-indigo-100 text-indigo-700' :
                                                       'bg-slate-100 text-slate-600'
                    }`}>
                      {session.status}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Batch {session.batchLabel}
                    </span>
                  </div>
                </div>

                <h3 className="text-[15px] font-bold text-slate-800 mb-4">{session.topic}</h3>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span>{session.date} • {session.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{session.room}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600">
                    <Users className="w-4 h-4 text-slate-400" />
                    <span>{session.enrolled} / {session.capacity} Enrolled</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setTeacherCtx({ batchId: session.batchId, batchTab: 'extra-classes' });
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
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm h-fit">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">AI Recommended Sessions</h3>
          <p className="text-[12.5px] text-slate-500 mb-4">Based on recent batch analytics and weak topics.</p>
          
          <div className="space-y-4">
            {Object.entries(batchWeakTopics).map(([batchId, topics]) => (
              <div key={batchId} className="space-y-3">
                {topics.map(t => (
                  <div key={`${batchId}-${t.topic}`} className="p-3 border border-rose-100 bg-rose-50/50 rounded-xl">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[13px] font-bold text-slate-800">{t.topic}</p>
                      <span className="text-[10px] font-bold bg-white border border-rose-200 text-rose-600 px-1.5 py-0.5 rounded">Batch {batches.find(b => b.id === batchId)?.label || batchId}</span>
                    </div>
                    <p className="text-[11.5px] text-slate-600 mb-3">{t.weakCount} students struggling. Avg score: {t.avgScore}%</p>
                    <button className="text-[11.5px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Schedule Remedial
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
