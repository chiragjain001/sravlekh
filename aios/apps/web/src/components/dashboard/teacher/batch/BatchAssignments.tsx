'use client';

import { useState } from 'react';
import { Plus, FileText, Eye, AlertCircle, BookOpen, Link2 } from 'lucide-react';
import { getTopicCompletionsByBatch } from '@/lib/mock-data/teacher';
import { AssignmentDetailModal } from '../shared/AssignmentDetailModal';
import { CreateAssignmentModal } from '../shared/CreateAssignmentModal';

interface Assignment {
  id: string; batchId: string; title: string;
  dueDate: string; totalStudents: number; submitted: number; status: string;
}

const statusStyle = (s: string) => ({
  active:    'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
}[s] ?? 'bg-slate-100 text-slate-500');

export function BatchAssignments({ assignments: initialAssignments, batchStrength, batchId }: {
  assignments: Assignment[];
  batchStrength: number;
  batchId: string;
}) {
  const [assignments, setAssignments] = useState<Assignment[]>(initialAssignments);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  const topicCompletions = getTopicCompletionsByBatch(batchId);
  const unlinkedTopics   = topicCompletions.filter(tc => !tc.assignmentLinked);

  const handleAssignmentCreated = (newAssignment: any) => {
    setAssignments(prev => [newAssignment, ...prev]);
  };

  return (
    <div className="space-y-4 animate-fadein">
      {/* Create Assignment Modal Wizard */}
      {showCreate && (
        <CreateAssignmentModal
          defaultBatchId={batchId}
          onClose={() => setShowCreate(false)}
          onSuccess={handleAssignmentCreated}
        />
      )}

      {/* Assignment Detail Modal */}
      {selectedAssignment && (
        <AssignmentDetailModal
          assignment={selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-slate-700">Assignments for Batch {batchId}</h3>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
          <Plus className="w-3.5 h-3.5" /> Create Assignment
        </button>
      </div>

      {/* Topic-linked nudge: unlinked topics alert */}
      {unlinkedTopics.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-amber-800">
                {unlinkedTopics.length} completed topic{unlinkedTopics.length > 1 ? 's' : ''} without assignments
              </p>
              <p className="text-[12px] text-amber-700 mt-0.5">
                Assign practice after teaching for better retention.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {unlinkedTopics.map(tc => (
                  <button
                    key={tc.topic}
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-800 text-[11.5px] font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3" />
                    Assign for "{tc.topic}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* List */}
      <div className="space-y-3">
        {assignments.map(a => {
          const pct = batchStrength > 0 ? Math.round((a.submitted / batchStrength) * 100) : 0;
          const linkedTopic = topicCompletions.find(tc => tc.assignmentId === a.id);
          return (
            <div 
              key={a.id} 
              onClick={() => setSelectedAssignment(a)}
              className="border border-slate-100 rounded-2xl p-5 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer bg-white group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{a.title}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5">Due: <span className="font-semibold text-slate-700">{a.dueDate}</span></p>
                    {linkedTopic && (
                      <p className="flex items-center gap-1 mt-1 text-[11px] text-indigo-600 font-semibold">
                        <Link2 className="w-3 h-3" /> Linked: {linkedTopic.topic}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg capitalize ${statusStyle(a.status)}`}>{a.status}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssignment(a);
                    }}
                    className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-[12px] mb-1.5">
                <span className="text-slate-500">Submitted: <span className="font-bold text-slate-700">{a.submitted} / {batchStrength}</span></span>
                <span className={`font-bold ${pct === 100 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-rose-600'}`}>{pct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {assignments.length === 0 && (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-[13px] font-semibold">No assignments yet. Create the first one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
