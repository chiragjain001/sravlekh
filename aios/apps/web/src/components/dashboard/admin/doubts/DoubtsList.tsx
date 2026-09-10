'use client';

import { useState } from 'react';
import { useDoubts, useTeachers, useAssignDoubt, useResolveDoubt } from '@/hooks/useApi';
import { Search, Filter, MessageSquare, X, Loader2 } from 'lucide-react';

interface DoubtRow {
  id: string;
  content: string;
  urgency: number;
  status: string;
  createdAt: string;
  assignedTeacherId?: string | null;
  responseText?: string | null;
  studentProfile?: { user?: { name?: string } };
  subject?: { name?: string };
}

export function DoubtsList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [activeDoubt, setActiveDoubt] = useState<DoubtRow | null>(null);

  const { data: doubtsData, isPending } = useDoubts({
    status: status || undefined,
  });

  const doubts: DoubtRow[] = doubtsData?.data ?? [];
  const visibleDoubts = search.trim()
    ? doubts.filter((d) => d.content.toLowerCase().includes(search.trim().toLowerCase()))
    : doubts;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Doubt Resolution</h2>
          <p className="text-sm text-navy-500">Manage and assign student doubts to teachers.</p>
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <input
            type="text"
            placeholder="Search doubts..."
            className="input pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative sm:w-48">
          <Filter className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-navy-400" />
          <select
            className="input pl-10 appearance-none bg-transparent"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ANSWERED">Answered</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isPending ? (
          <div className="p-8 text-center text-navy-500">Loading doubts...</div>
        ) : visibleDoubts.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="w-12 h-12 text-navy-300 mx-auto mb-3" />
            <p className="text-navy-900 font-medium mb-1">No doubt tickets found.</p>
            <p className="text-navy-500 text-sm">Students haven't raised any doubts yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Student</th>
                  <th className="px-6 py-4 font-medium">Subject</th>
                  <th className="px-6 py-4 font-medium">Preview</th>
                  <th className="px-6 py-4 font-medium">Urgency</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visibleDoubts.map((doubt) => (
                  <tr key={doubt.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-navy-900">
                      {doubt.studentProfile?.user?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-navy-700">{doubt.subject?.name || '—'}</td>
                    <td className="px-6 py-4">
                      <div className="text-navy-700 truncate max-w-[200px]" title={doubt.content}>
                        {doubt.content}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`chip-${doubt.urgency === 3 ? 'error' : doubt.urgency === 2 ? 'warning' : 'navy'}`}>
                        {doubt.urgency === 3 ? 'High' : doubt.urgency === 2 ? 'Medium' : 'Low'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`chip-${
                        doubt.status === 'OPEN' ? 'error' :
                        doubt.status === 'ANSWERED' ? 'success' :
                        doubt.status === 'ASSIGNED' ? 'warning' : 'navy'
                      }`}>
                        {doubt.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-navy-700">
                      {new Date(doubt.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setActiveDoubt(doubt)}
                        className="text-teal-600 hover:text-teal-800 font-medium text-xs"
                      >
                        View / Assign
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DoubtActionDialog doubt={activeDoubt} onClose={() => setActiveDoubt(null)} />
    </div>
  );
}

// ─── Assign / Resolve ───────────────────────────────────────────────────────

function DoubtActionDialog({ doubt, onClose }: { doubt: DoubtRow | null; onClose: () => void }) {
  const { data: teachers } = useTeachers();
  const assignDoubt = useAssignDoubt();
  const resolveDoubt = useResolveDoubt();

  const [teacherUserId, setTeacherUserId] = useState('');
  const [resolutionText, setResolutionText] = useState('');

  if (!doubt) return null;

  const isClosed = doubt.status === 'ANSWERED' || doubt.status === 'CLOSED';

  function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!doubt || !teacherUserId) return;
    assignDoubt.mutate({ doubtId: doubt.id, data: { teacherUserId } }, { onSuccess: () => setTeacherUserId('') });
  }

  function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!doubt || resolutionText.trim().length === 0) return;
    resolveDoubt.mutate(
      { doubtId: doubt.id, data: { resolutionText: resolutionText.trim() } },
      { onSuccess: () => { setResolutionText(''); onClose(); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Doubt from {doubt.studentProfile?.user?.name || 'a student'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-[12.5px] text-slate-700 bg-slate-50 border border-slate-100 rounded-lg p-3">{doubt.content}</p>

          {doubt.responseText && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">Resolution</p>
              <p className="text-[12.5px] text-slate-700 bg-emerald-50 border border-emerald-100 rounded-lg p-3">{doubt.responseText}</p>
            </div>
          )}

          {!isClosed && (
            <>
              <form onSubmit={handleAssign} className="space-y-2">
                <label className="block text-[12px] font-semibold text-slate-700">Assign to teacher</label>
                <div className="flex gap-2">
                  <select
                    value={teacherUserId}
                    onChange={(e) => setTeacherUserId(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Select a teacher</option>
                    {(teachers?.data ?? []).filter((t: any) => !!t.user?.id).map((t: any) => (
                      <option key={t.user.id} value={t.user.id}>{t.user.name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!teacherUserId || assignDoubt.isPending}
                    className="px-3 py-2 text-[12px] font-bold text-white bg-slate-700 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {assignDoubt.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Assign'}
                  </button>
                </div>
              </form>

              <form onSubmit={handleResolve} className="space-y-2">
                <label className="block text-[12px] font-semibold text-slate-700">Mark resolved</label>
                <textarea
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  placeholder="Write the answer the student will see..."
                  rows={3}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={resolveDoubt.isPending || resolutionText.trim().length === 0}
                    className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {resolveDoubt.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Resolve
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
