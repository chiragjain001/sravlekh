'use client';

import { useState, useMemo } from 'react';
import { X, CheckCircle2, FileText, Search, AlertCircle, UserCheck, UserX, ExternalLink } from 'lucide-react';
import { useAssignments, useGradeAssignment } from '@/hooks/useApi';

export interface AssignmentDetailModalProps {
  title: string;
  batchId: string;
  dueDate: string;
  onClose: () => void;
}

export function GradeRow({ a }: { a: any }) {
  const [grade, setGrade] = useState(a.gradedMarks != null ? String(a.gradedMarks) : '');
  const gradeAssignment = useGradeAssignment();
  const isSubmitted = a.status === 'SUBMITTED' || a.status === 'LATE_SUBMITTED' || a.status === 'GRADED';

  const handleSave = () => {
    const val = Number(grade);
    if (!grade || Number.isNaN(val) || val < 0) return;
    gradeAssignment.mutate({ assignmentId: a.id, gradedMarks: val });
  };

  return (
    <div className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs transition-all flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 min-w-0">
        <div className={`w-10 h-10 rounded-full font-black text-[13px] flex items-center justify-center flex-shrink-0 ${isSubmitted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
          {(a.studentProfile?.user?.name ?? '?').split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-bold text-slate-800 truncate">{a.studentProfile?.user?.name ?? 'Unknown Student'}</p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${isSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {a.status.replace('_', ' ')}
            </span>
          </div>
          {a.submissionUrl && (
            <a href={a.submissionUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11.5px] text-indigo-600 hover:underline mt-0.5">
              <ExternalLink className="w-3 h-3" /> View submission
            </a>
          )}
        </div>
      </div>

      {isSubmitted && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <input type="number" min={0} placeholder="Marks" value={grade} onChange={e => setGrade(e.target.value)}
            className="w-20 text-center px-2 py-1.5 border border-slate-200 rounded-lg text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
          <button onClick={handleSave} disabled={!grade || gradeAssignment.isPending}
            className="px-3 py-1.5 bg-indigo-600 text-white text-[12px] font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-all">
            {a.status === 'GRADED' ? 'Update' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}

export function AssignmentDetailModal({ title, batchId, dueDate, onClose }: AssignmentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'submitted' | 'pending'>('submitted');
  const [searchTerm, setSearchTerm] = useState('');
  const { data: resp, isLoading } = useAssignments({ batchId, limit: 200 });

  const roster = useMemo(() => {
    const all = resp?.data ?? [];
    return all.filter((a: any) => a.title === title && new Date(a.dueDate).toISOString() === dueDate);
  }, [resp, title, dueDate]);

  const submittedList = roster
    .filter((a: any) => a.status !== 'PENDING' && a.status !== 'MISSED')
    .filter((a: any) => (a.studentProfile?.user?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()));
  const pendingList = roster
    .filter((a: any) => a.status === 'PENDING' || a.status === 'MISSED')
    .filter((a: any) => (a.studentProfile?.user?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[70vw] h-[70vh] flex flex-col overflow-hidden relative">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/80 flex-shrink-0">
          <div>
            <span className="text-[12px] font-medium text-slate-400">Due: {new Date(dueDate).toLocaleDateString()}</span>
            <h2 className="text-[18px] font-bold text-slate-800 leading-tight">{title}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 shadow-xs">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button onClick={() => setActiveTab('submitted')}
              className={`flex items-center gap-2 px-4 py-1.5 text-[12.5px] font-bold rounded-lg transition-all ${activeTab === 'submitted' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" /> Submitted ({submittedList.length})
            </button>
            <button onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-1.5 text-[12.5px] font-bold rounded-lg transition-all ${activeTab === 'pending' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}>
              <UserX className="w-3.5 h-3.5 text-rose-500" /> Not Submitted ({pendingList.length})
            </button>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search student..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent text-[12px] outline-none w-full placeholder:text-slate-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-[13px]">Loading roster…</div>
          ) : activeTab === 'submitted' ? (
            submittedList.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-[13px] font-semibold">No submissions yet.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {submittedList.map((a: any) => <GradeRow key={a.id} a={a} />)}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {pendingList.length > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <p className="text-[13px] font-bold text-rose-900">{pendingList.length} students haven't submitted yet.</p>
                </div>
              )}
              {pendingList.length === 0 ? (
                <div className="py-16 text-center text-emerald-600 font-semibold text-[13px]">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  Everyone has submitted.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingList.map((a: any) => (
                    <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-black text-[13px] flex items-center justify-center flex-shrink-0">
                          {(a.studentProfile?.user?.name ?? '?').split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <p className="text-[14px] font-bold text-slate-800">{a.studentProfile?.user?.name ?? 'Unknown Student'}</p>
                      </div>
                      <span className="text-[11px] font-bold px-3 py-1 bg-rose-100 text-rose-700 rounded-lg">{a.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11.5px] text-slate-500 flex-shrink-0">
          <span>Total: {roster.length} students</span>
          <span className="font-semibold text-slate-700">
            Submission Rate: {roster.length > 0 ? Math.round((submittedList.length / roster.length) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
  );
}
