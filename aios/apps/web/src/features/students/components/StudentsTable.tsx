'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare, BarChart2 } from 'lucide-react';
import { TableCheckbox } from '@/components/ui/TableCheckbox';
import type { StudentListItem, SortDirection, StudentSortField } from '../types/student.types';

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ACTIVE'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    status === 'SUSPENDED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
    status === 'PENDING'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border capitalize ${cls}`}>
      {status.toLowerCase()}
    </span>
  );
}

function SortHeader({
  label, col, sortBy, sortDir, onSort,
}: {
  label: string; col: StudentSortField;
  sortBy: StudentSortField; sortDir: SortDirection;
  onSort: (col: StudentSortField) => void;
}) {
  const active = sortBy === col;
  return (
    <th
      className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap group"
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

function RowActions({ student, onView, onEdit, onDelete, onView360 }: {
  student: StudentListItem;
  onView: (s: StudentListItem) => void;
  onEdit: (s: StudentListItem) => void;
  onDelete: (s: StudentListItem) => void;
  onView360?: (s: StudentListItem) => void;
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
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
        aria-label="Row actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 w-48 text-xs animate-fadein">
          <button onClick={() => { onView(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Profile
          </button>
          {onView360 && (
            <button onClick={() => { onView360(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-indigo-50 text-indigo-700 font-medium cursor-pointer">
              <BarChart2 className="w-3.5 h-3.5 text-indigo-500" /> View 360
            </button>
          )}
          <button onClick={() => { onEdit(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Details
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => { onDelete(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600 font-medium cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Archive
          </button>
        </div>
      )}
    </div>
  );
}

export interface StudentsTableProps {
  students: StudentListItem[];
  loading: boolean;
  selectedIds: Set<string>;
  sortBy: StudentSortField;
  sortDir: SortDirection;
  onSort: (col: StudentSortField) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (s: StudentListItem) => void;
  onView360?: (s: StudentListItem) => void;
  onEdit: (s: StudentListItem) => void;
  onDelete: (s: StudentListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50">
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-3 bg-slate-100 rounded-full" style={{ width: `${60 + (j * 7) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

function EmptyState() {
  return (
    <tbody>
      <tr>
        <td colSpan={9} className="py-20 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
              <CheckSquare className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-bold text-slate-500">No students found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

export function StudentsTable({
  students, loading, selectedIds, sortBy, sortDir,
  onSort, onSelectAll, onSelectOne, onView, onView360, onEdit, onDelete,
}: StudentsTableProps) {
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id)) && !allSelected;

  return (
    <div className="relative w-full">
      <div className="w-full max-h-[520px] md:max-h-none overflow-y-auto overflow-x-auto custom-scrollbar touch-pan-x overscroll-x-contain pb-1">
        <table className="w-full text-xs whitespace-nowrap min-w-[820px]">
          <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20 shadow-2xs">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
                <TableCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                  ariaLabel="Select all students"
                  color="indigo"
                />
              </th>
              <SortHeader label="Student" col="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Roll No" col="rollNumber" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 font-semibold text-slate-600">Batch</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Tags</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Guardian</th>
              <SortHeader label="Admitted" col="admissionDate" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>

          {loading ? <TableSkeleton /> :
           students.length === 0 ? <EmptyState /> : (
            <tbody className="divide-y divide-slate-50 bg-white">
              {students.map((s) => {
                const isSelected = selectedIds.has(s.id);
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-indigo-50/30 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                  >
                    <td className="px-4 py-3 text-center">
                      <TableCheckbox
                        checked={isSelected}
                        onChange={() => onSelectOne(s.id)}
                        ariaLabel={`Select student ${s.name}`}
                        color="indigo"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => onView(s)}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-[10.5px] shrink-0 shadow-xs">
                          {s.avatarInitials}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors block">{s.name}</span>
                          <span className="text-[10px] text-slate-400">{s.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 font-medium">{s.rollNumber ?? '—'}</td>
                    <td className="px-4 py-3 text-indigo-600 font-semibold max-w-[140px] truncate">{s.batchLabel}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {s.tags.length === 0 && <span className="text-slate-300">—</span>}
                        {s.tags.slice(0, 2).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">{t}</span>
                        ))}
                        {s.tags.length > 2 && <span className="text-[10px] text-slate-400 font-medium">+{s.tags.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-700">{s.guardianName ?? '—'}</p>
                        {s.guardianPhone && <p className="text-[10px] text-slate-400">{s.guardianPhone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{new Date(s.admissionDate).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <RowActions student={s} onView={onView} onView360={onView360} onEdit={onEdit} onDelete={onDelete} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
