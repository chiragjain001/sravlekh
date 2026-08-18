'use client';

import { useState } from 'react';
import { BookOpen, Plus, Search, Calendar, ChevronRight } from 'lucide-react';
import { assignments as initialAssignments, batches } from '@/lib/mock-data/teacher';
import { useDashboardStore } from '@/store/dashboard-store';
import { AssignmentDetailModal } from '../shared/AssignmentDetailModal';
import { CreateAssignmentModal } from '../shared/CreateAssignmentModal';

export function TeacherAssignments() {
  const { setTeacherNav, setTeacherCtx } = useDashboardStore();
  const [assignmentList, setAssignmentList] = useState<any[]>(initialAssignments);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const enrichedAssignments = assignmentList.map(a => ({
    ...a,
    batchLabel: batches.find(b => b.id === a.batchId)?.label || a.batchId
  })).filter(a => a.title.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAssignmentCreated = (newAssignment: any) => {
    setAssignmentList(prev => [newAssignment, ...prev]);
  };

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      {/* Create Assignment Modal Wizard */}
      {showCreateModal && (
        <CreateAssignmentModal
          onClose={() => setShowCreateModal(false)}
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
            {enrichedAssignments.map(a => (
              <tr 
                key={a.id} 
                onClick={() => setSelectedAssignment(a)}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
              >
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">{a.title}</span>
                  </div>
                </td>
                <td className="py-4 px-4 font-medium text-slate-600">{a.batchLabel}</td>
                <td className="py-4 px-4 text-slate-500 hidden sm:table-cell">
                  <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {a.dueDate}</span>
                </td>
                <td className="py-4 px-4 text-center">
                  <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    a.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    a.status === 'active'    ? 'bg-amber-100 text-amber-700'     :
                                               'bg-slate-100 text-slate-600'
                  }`}>
                    {a.status}
                  </span>
                </td>
                <td className="py-4 px-4 text-center hidden md:table-cell">
                  <span className="font-bold text-slate-700">{a.submitted}/{a.totalStudents}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAssignment(a);
                    }}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                  >
                    View Submissions <ChevronRight className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}
            {enrichedAssignments.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 text-[13px]">
                  No assignments found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
