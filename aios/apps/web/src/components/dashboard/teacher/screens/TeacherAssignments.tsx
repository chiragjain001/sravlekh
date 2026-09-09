'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Plus, Search, Calendar, ChevronRight, Sparkles, Trash2 } from 'lucide-react';
import { useAssignments, useDeleteAssignment } from '@/hooks/useApi';
import { AssignmentDetailModal, GradeRow } from '../shared/AssignmentDetailModal';
import { CreateAssignmentModal } from '../shared/CreateAssignmentModal';

interface AssignmentGroup {
  key: string;
  title: string;
  batchId: string;
  batchLabel: string;
  dueDate: string;
  totalStudents: number;
  submitted: number;
  isFullyGraded: boolean;
}

export function TeacherAssignments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AssignmentGroup | null>(null);
  const deleteAssignment = useDeleteAssignment();

  const { data: resp, isLoading, refetch } = useAssignments({ limit: 200 });
  const assignments = resp?.data ?? [];

  // Assignments are created one row per student (see CreateAssignmentModal) —
  // group them back into one card per (title, batchId, dueDate) so the list
  // reads as "one assignment", matching how the teacher created it.
  const groups: AssignmentGroup[] = useMemo(() => {
    const map = new Map<string, AssignmentGroup>();
    for (const a of assignments) {
      if (!a.batchId) continue; // individual/personalized assignments aren't shown on this batch-oriented list
      const dueIso = new Date(a.dueDate).toISOString();
      const key = `${a.title}__${a.batchId}__${dueIso}`;
      const existing = map.get(key);
      const isSubmitted = a.status !== 'PENDING' && a.status !== 'MISSED';
      if (existing) {
        existing.totalStudents += 1;
        if (isSubmitted) existing.submitted += 1;
        if (a.status !== 'GRADED') existing.isFullyGraded = false;
      } else {
        map.set(key, {
          key,
          title: a.title,
          batchId: a.batchId,
          batchLabel: a.batch?.name ?? a.batchId,
          dueDate: dueIso,
          totalStudents: 1,
          submitted: isSubmitted ? 1 : 0,
          isFullyGraded: a.status === 'GRADED',
        });
      }
    }
    return Array.from(map.values())
      .filter(g => g.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  }, [assignments, searchTerm]);

  // Individual assignments (studentProfileId set, no batchId) — this is how
  // auto-generated weak-topic interventions land (see intervention_engine.py),
  // so they need their own view rather than being silently dropped by the
  // batch-oriented grouping above.
  const individualAssignments = useMemo(
    () => assignments
      .filter((a: any) => !a.batchId && a.title.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a: any, b: any) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()),
    [assignments, searchTerm],
  );

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      {showCreateModal && (
        <CreateAssignmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => refetch()}
        />
      )}

      {selectedGroup && (
        <AssignmentDetailModal
          title={selectedGroup.title}
          batchId={selectedGroup.batchId}
          dueDate={selectedGroup.dueDate}
          onClose={() => setSelectedGroup(null)}
        />
      )}

      {/* Cancelling removes the row for every student it was issued to, and any
          work already submitted against them — worth a confirmation. */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[16px] font-bold text-slate-800">Cancel this assignment?</h2>
                <p className="text-[12px] text-slate-500">{cancelTarget.batchLabel}</p>
              </div>
            </div>
            <p className="text-[13px] text-slate-600">
              <b>{cancelTarget.title}</b> will be withdrawn from all {cancelTarget.totalStudents} student
              {cancelTarget.totalStudents === 1 ? '' : 's'} it was issued to
              {cancelTarget.submitted > 0 && <>, including {cancelTarget.submitted} already submitted</>}. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={async () => {
                  const groupRows = assignments.filter(
                    (a: any) => a.batchId === cancelTarget.batchId && a.title === cancelTarget.title && new Date(a.dueDate).toISOString() === cancelTarget.dueDate,
                  );
                  if (groupRows.length > 0) await deleteAssignment.mutateAsync(groupRows[0].id);
                  setCancelTarget(null);
                }}
                disabled={deleteAssignment.isPending}
                className="flex-1 py-2.5 bg-rose-600 text-white text-[13px] font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleteAssignment.isPending ? 'Cancelling…' : 'Cancel Assignment'}
              </button>
              <button
                onClick={() => setCancelTarget(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Keep It
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Global Assignments</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Manage assignments and track submissions across all your batches.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Create Assignment
        </button>
      </div>

      <div className="flex items-center gap-3 p-2 bg-white border border-slate-200 rounded-xl max-w-md">
        <Search className="w-4 h-4 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Search assignments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 text-[13px] outline-none placeholder:text-slate-400 bg-transparent"
        />
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="py-3 px-5 font-bold text-[11px] text-slate-500 uppercase tracking-wider">Assignment Title</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider">Batch</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider hidden sm:table-cell">Due Date</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-center">Status</th>
              <th className="py-3 px-4 font-bold text-[11px] text-slate-500 uppercase tracking-wider text-center hidden md:table-cell">Submissions</th>
              <th className="py-3 px-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {isLoading ? (
              <tr><td colSpan={6} className="py-12 text-center text-slate-400 text-[13px]">Loading assignments…</td></tr>
            ) : (
              <>
                {groups.map(g => (
                  <tr
                    key={g.key}
                    onClick={() => setSelectedGroup(g)}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{g.title}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-slate-600">{g.batchLabel}</td>
                    <td className="py-4 px-4 text-slate-500 hidden sm:table-cell">
                      <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {new Date(g.dueDate).toLocaleDateString()}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                        g.isFullyGraded ? 'bg-emerald-100 text-emerald-700' :
                        g.submitted > 0 ? 'bg-amber-100 text-amber-700' :
                                          'bg-slate-100 text-slate-600'
                      }`}>
                        {g.isFullyGraded ? 'completed' : g.submitted > 0 ? 'active' : 'pending'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center hidden md:table-cell">
                      <span className="font-bold text-slate-700">{g.submitted}/{g.totalStudents}</span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedGroup(g); }}
                          className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          View Submissions <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelTarget(g); }}
                          title="Cancel this assignment"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {groups.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 text-[13px]">
                      No assignments found.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {individualAssignments.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="text-[15px] font-bold text-slate-800">Individual Assignments</h2>
          </div>
          <p className="text-[12.5px] text-slate-500 mb-4">
            Assigned to one student directly — includes auto-generated practice for students whose mastery dropped below threshold.
          </p>
          <div className="space-y-3">
            {individualAssignments.map((a: any) => (
              <div key={a.id} className="bg-white border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[13.5px] font-bold text-slate-800">{a.title}</p>
                    <p className="text-[11.5px] text-slate-500">
                      {a.topic?.name ?? 'Topic'} · Due {new Date(a.dueDate).toLocaleDateString()}
                      {a.isAutoGenerated && <span className="ml-2 text-[10px] font-bold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded">Auto-generated</span>}
                    </p>
                  </div>
                </div>
                <GradeRow a={a} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
