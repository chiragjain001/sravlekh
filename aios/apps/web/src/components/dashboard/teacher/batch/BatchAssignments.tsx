'use client';

import { useMemo, useState } from 'react';
import { Plus, FileText, Eye } from 'lucide-react';
import { useAssignments } from '@/hooks/useApi';
import { AssignmentDetailModal } from '../shared/AssignmentDetailModal';
import { CreateAssignmentModal } from '../shared/CreateAssignmentModal';
import { InlineLoadingSpinner } from '@/components/ui/foundation';

interface AssignmentGroup {
  key: string;
  title: string;
  dueDate: string;
  totalStudents: number;
  submitted: number;
  isFullyGraded: boolean;
}

export function BatchAssignments({ batchId }: { batchId: string }) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AssignmentGroup | null>(null);

  const { data: resp, isLoading, refetch } = useAssignments({ batchId, limit: 200 });
  const assignments = resp?.data ?? [];

  const groups: AssignmentGroup[] = useMemo(() => {
    const map = new Map<string, AssignmentGroup>();
    for (const a of assignments) {
      const dueIso = new Date(a.dueDate).toISOString();
      const key = `${a.title}__${dueIso}`;
      const existing = map.get(key);
      const isSubmitted = a.status !== 'PENDING' && a.status !== 'MISSED';
      if (existing) {
        existing.totalStudents += 1;
        if (isSubmitted) existing.submitted += 1;
        if (a.status !== 'GRADED') existing.isFullyGraded = false;
      } else {
        map.set(key, { key, title: a.title, dueDate: dueIso, totalStudents: 1, submitted: isSubmitted ? 1 : 0, isFullyGraded: a.status === 'GRADED' });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  }, [assignments]);

  return (
    <div className="space-y-4 animate-fadein">
      {showCreate && (
        <CreateAssignmentModal
          defaultBatchId={batchId}
          onClose={() => setShowCreate(false)}
          onSuccess={() => refetch()}
        />
      )}

      {selectedGroup && (
        <AssignmentDetailModal
          title={selectedGroup.title}
          batchId={batchId}
          dueDate={selectedGroup.dueDate}
          onClose={() => setSelectedGroup(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-700">Assignments for this batch</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[12.5px] font-bold rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Create Assignment</span>
        </button>
      </div>

      {isLoading ? (
        <InlineLoadingSpinner label="Loading assignments for this batch..." />
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {groups.map(g => {
            const pct = g.totalStudents > 0 ? Math.round((g.submitted / g.totalStudents) * 100) : 0;
            return (
              <div
                key={g.key}
                onClick={() => setSelectedGroup(g)}
                className="border border-slate-100 rounded-2xl p-3.5 sm:p-5 hover:border-indigo-200 hover:shadow-xs transition-all cursor-pointer bg-white group shadow-2xs active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2.5 sm:gap-3 mb-2.5 sm:mb-3">
                  <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors truncate">{g.title}</p>
                      <p className="text-[11.5px] sm:text-[12px] text-slate-500 mt-0.5">Due: <span className="font-semibold text-slate-700">{new Date(g.dueDate).toLocaleDateString()}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg capitalize ${g.isFullyGraded ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                      {g.isFullyGraded ? 'completed' : 'active'}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedGroup(g); }}
                      className="p-1 sm:p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11.5px] sm:text-[12px] mb-1.5">
                  <span className="text-slate-500">Submitted: <span className="font-bold text-slate-700">{g.submitted} / {g.totalStudents}</span></span>
                  <span className={`font-bold ${pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
          {groups.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-semibold">No assignments yet. Create the first one.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
