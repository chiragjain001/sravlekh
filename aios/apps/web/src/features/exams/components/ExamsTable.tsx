'use client';
// ─── Exams Table Component ───────────────────────────────────────────────────

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare, Square, Minus } from 'lucide-react';
import type { ExamListItem, SortDirection } from '../types/exam.types';

function ExamTypeBadge({ type }: { type: string }) {
  const cls =
    type === 'Mock Test'   ? 'bg-blue-50 text-blue-700 border-blue-100' :
    type === 'Part Test'   ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    type === 'Subjective'  ? 'bg-purple-50 text-purple-700 border-purple-100' :
    type === 'Weekly Test' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                             'bg-rose-50 text-rose-700 border-rose-100';

  return (
    <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full border ${cls}`}>
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'Upcoming'           ? 'bg-blue-50 text-blue-600 border-blue-100' :
    status === 'Completed'          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    status === 'Evaluation Pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                      'bg-rose-50 text-rose-600 border-rose-100';

  return (
    <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full border ${cls}`}>
      {status}
    </span>
  );
}

function SortHeader({
  label, col, sortBy, sortDir, onSort,
}: {
  label: string; col: keyof ExamListItem;
  sortBy: keyof ExamListItem; sortDir: SortDirection;
  onSort: (col: keyof ExamListItem) => void;
}) {
  const active = sortBy === col;
  return (
    <th
      className="px-5 py-3.5 text-left font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap group"
      onClick={() => onSort(col)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {active ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
        </span>
      </div>
    </th>
  );
}

function RowActions({ exam, onView, onEdit, onDelete }: {
  exam: ExamListItem;
  onView:   (e: ExamListItem) => void;
  onEdit:   (e: ExamListItem) => void;
  onDelete: (e: ExamListItem) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors"
      >
        Manage
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-40 text-xs">
          <button onClick={() => { onView(exam); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Details
          </button>
          <button onClick={() => { onEdit(exam); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Schedule
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => { onDelete(exam); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600 font-medium">
            <Trash2 className="w-3.5 h-3.5" /> Cancel Exam
          </button>
        </div>
      )}
    </div>
  );
}

export interface ExamsTableProps {
  exams:       ExamListItem[];
  loading:     boolean;
  selectedIds: Set<string>;
  sortBy:      keyof ExamListItem;
  sortDir:     SortDirection;
  onSort:      (col: keyof ExamListItem) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView:      (e: ExamListItem) => void;
  onEdit:      (e: ExamListItem) => void;
  onDelete:    (e: ExamListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-gray-50">
          {Array.from({ length: 10 }).map((__, j) => (
            <td key={j} className="px-5 py-3.5">
              <div className="h-3 bg-slate-100 rounded-full" style={{ width: `${60 + (j * 7) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function ExamsTable({
  exams, loading, selectedIds, sortBy, sortDir,
  onSort, onSelectAll, onSelectOne, onView, onEdit, onDelete,
}: ExamsTableProps) {
  const allSelected  = exams.length > 0 && exams.every((e) => selectedIds.has(e.id));
  const someSelected = exams.some((e) => selectedIds.has(e.id)) && !allSelected;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left text-xs whitespace-nowrap">
        <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500">
          <tr>
            <th className="px-4 py-3.5 w-10">
              <button onClick={onSelectAll} className="flex items-center justify-center text-slate-500 hover:text-blue-600">
                {allSelected  ? <CheckSquare className="w-4 h-4 text-blue-600" /> :
                 someSelected ? <Minus className="w-4 h-4 text-slate-400" /> :
                                <Square className="w-4 h-4" />}
              </button>
            </th>
            <SortHeader label="Exam Name"              col="name"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Code"                   col="code"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Batch Cohort"           col="batch"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Exam Type"              col="type"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Scheduled Date"         col="date"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Duration"               col="duration" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Registered Candidates" col="students" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Status"                 col="status"   sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th className="px-5 py-3.5 font-semibold text-gray-700 text-center">Actions</th>
          </tr>
        </thead>

        {loading ? <TableSkeleton /> : exams.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={10} className="py-16 text-center text-slate-400 font-medium">
                No scheduled exams found.
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-gray-50 bg-white">
            {exams.map((exam) => {
              const isSelected = selectedIds.has(exam.id);
              return (
                <tr key={exam.id} className={`hover:bg-blue-50/30 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onSelectOne(exam.id)} className="flex items-center justify-center text-slate-400 hover:text-blue-600">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-5 py-3.5" onClick={() => onView(exam)}>
                    <span className="font-bold text-gray-900 text-[12.5px] hover:text-blue-600 transition-colors block">{exam.name}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-gray-500 text-[11px] bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{exam.code}</span>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-blue-600">{exam.batch}</td>
                  <td className="px-5 py-3.5"><ExamTypeBadge type={exam.type} /></td>
                  <td className="px-5 py-3.5 font-medium text-gray-700">{exam.date}</td>
                  <td className="px-5 py-3.5 text-gray-500 font-medium">{exam.duration}</td>
                  <td className="px-5 py-3.5 font-bold text-gray-900">{exam.students} Students</td>
                  <td className="px-5 py-3.5"><StatusBadge status={exam.status} /></td>
                  <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                    <RowActions exam={exam} onView={onView} onEdit={onEdit} onDelete={onDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
