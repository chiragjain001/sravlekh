import { AlertTriangle, X, Users, ChevronRight, CalendarPlus, BookOpen } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';

export interface WeakStudent { studentId: string; name: string; batchId: string; avgInTopic: number }

export function StudentListModal({
  title = "Weak Students",
  topic,
  weakCount,
  totalStudents,
  avgScore,
  students,
  onClose,
  onSelectStudent,
}: {
  title?: string;
  topic: string;
  weakCount: number;
  totalStudents: number;
  avgScore: number;
  students: WeakStudent[];
  onClose: () => void;
  onSelectStudent: (id: string) => void;
}) {
  const pct = totalStudents > 0 ? Math.round((weakCount / totalStudents) * 100) : 0;
  const { setTeacherNav } = useDashboardStore();

  function goSchedule() {
    onClose();
    setTeacherNav('remedial-extra');
  }
  function goAssign() {
    onClose();
    setTeacherNav('assignments');
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadein"
      style={{ backdropFilter: 'blur(6px)', background: 'rgba(15,23,42,0.45)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col mx-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <p className="text-[15px] font-bold text-slate-800 leading-tight">{topic} ({title})</p>
            </div>
            <p className="text-[12px] text-rose-600 font-semibold pl-9">
              {weakCount} of {totalStudents} students · Avg {avgScore}%
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-4 pb-3">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
            <span>Students affected</span>
            <span className="font-bold text-rose-600">{pct}%</span>
          </div>
          <div className="w-full bg-rose-50 rounded-full h-2 overflow-hidden">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-rose-400 to-rose-600 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* CTAs */}
        <div className="px-5 pb-4 flex gap-2">
          <button onClick={goSchedule} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 text-white text-[11.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
            <CalendarPlus className="w-3.5 h-3.5" /> Schedule Extra Class
          </button>
          <button onClick={goAssign} className="flex items-center gap-1.5 px-3.5 py-1.5 border border-indigo-200 text-indigo-700 text-[11.5px] font-bold rounded-xl hover:bg-indigo-50 transition-colors">
            <BookOpen className="w-3.5 h-3.5" /> Assign Practice Set
          </button>
        </div>

        {/* Student list (scrollable) */}
        <div className="border-t border-slate-100 overflow-y-auto flex-1 custom-scrollbar">
          {students.length === 0 ? (
            <div className="py-12 px-6 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Users className="w-6 h-6" />
              </div>
              <p className="text-[14px] font-bold text-slate-700">No Student Performance Records</p>
              <p className="text-[12px] text-slate-400 max-w-sm">No students are currently flagged below the benchmark threshold for {topic}.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-5">
              {[...students].sort((a,b) => a.name.localeCompare(b.name)).map((s, idx) => {
                const severity =
                  s.avgInTopic < 40 ? 'critical' :
                  s.avgInTopic < 55 ? 'poor' : 'below-avg';

                const avatarBg =
                  severity === 'critical' ? 'bg-rose-200 text-rose-800' :
                  severity === 'poor'     ? 'bg-orange-100 text-orange-700' :
                                           'bg-amber-100 text-amber-700';

                const scoreBg =
                  severity === 'critical' ? 'bg-rose-100 text-rose-700' :
                  severity === 'poor'     ? 'bg-orange-100 text-orange-700' :
                                           'bg-amber-100 text-amber-700';

                return (
                  <button
                    key={s.studentId}
                    onClick={() => { onClose(); onSelectStudent(s.studentId); }}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all text-left group"
                  >
                    <span className="w-5 text-[11px] text-slate-400 font-bold flex-shrink-0 text-center">{idx + 1}</span>

                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${avatarBg}`}>
                      {s.name.split(' ').map(n => n[0]).join('')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">
                        {s.name}
                      </p>
                      <p className="text-[11px] text-slate-400">Batch {s.batchId}</p>
                    </div>

                    <span className={`text-[12px] font-black px-2.5 py-1 rounded-lg flex-shrink-0 ${scoreBg}`}>
                      {s.avgInTopic}%
                    </span>

                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <p className="text-[11px] text-slate-400 text-center">
            Click a student to view their full profile &amp; topic mastery
          </p>
        </div>
      </div>
    </div>
  );
}
