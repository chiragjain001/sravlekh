'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare } from 'lucide-react';
import { TableCheckbox } from '@/components/ui/TableCheckbox';
import type { TeacherListItem, SortDirection, TeacherSortField } from '../types/teacher.types';

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

function SortHeader({ label, col, sortBy, sortDir, onSort }: {
  label: string; col: TeacherSortField; sortBy: TeacherSortField; sortDir: SortDirection; onSort: (col: TeacherSortField) => void;
}) {
  const active = sortBy === col;
  return (
    <th className="px-4 py-3 text-left font-semibold text-slate-600 cursor-pointer select-none whitespace-nowrap group" onClick={() => onSort(col)}>
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
          {active ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3" />}
        </span>
      </div>
    </th>
  );
}

function RowActions({ teacher, onView, onEdit, onDelete }: {
  teacher: TeacherListItem;
  onView: (t: TeacherListItem) => void;
  onEdit: (t: TeacherListItem) => void;
  onDelete: (t: TeacherListItem) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
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
        <div className="absolute right-0 top-9 z-30 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 w-44 text-xs animate-fadein">
          <button onClick={() => { onView(teacher); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Profile
          </button>
          <button onClick={() => { onEdit(teacher); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium cursor-pointer">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Details
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => { onDelete(teacher); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600 font-medium cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" /> Archive
          </button>
        </div>
      )}
    </div>
  );
}

export interface TeachersTableProps {
  teachers: TeacherListItem[];
  loading: boolean;
  selectedIds: Set<string>;
  sortBy: TeacherSortField;
  sortDir: SortDirection;
  onSort: (col: TeacherSortField) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (t: TeacherListItem) => void;
  onEdit: (t: TeacherListItem) => void;
  onDelete: (t: TeacherListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50">
          {Array.from({ length: 8 }).map((__, j) => (
            <td key={j} className="px-4 py-3.5"><div className="h-3 bg-slate-100 rounded-full" style={{ width: `${60 + (j * 7) % 40}%` }} /></td>
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
        <td colSpan={8} className="py-20 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><CheckSquare className="w-7 h-7 text-slate-300" /></div>
            <p className="text-sm font-bold text-slate-500">No teachers found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

export function TeachersTable({
  teachers, loading, selectedIds, sortBy, sortDir, onSort, onSelectAll, onSelectOne, onView, onEdit, onDelete,
}: TeachersTableProps) {
  const allSelected = teachers.length > 0 && teachers.every((t) => selectedIds.has(t.id));
  const someSelected = teachers.some((t) => selectedIds.has(t.id)) && !allSelected;

  return (
    <div className="relative w-full">
      <div className="w-full max-h-[520px] md:max-h-none overflow-y-auto overflow-x-auto custom-scrollbar touch-pan-x overscroll-x-contain pb-1">
        <table className="w-full text-xs whitespace-nowrap min-w-[780px]">
          <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-20 shadow-2xs">
            <tr>
              <th className="px-4 py-3 w-10 text-center">
                <TableCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                  ariaLabel="Select all teachers"
                  color="emerald"
                />
              </th>
              <SortHeader label="Teacher" col="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <SortHeader label="Qualification" col="qualification" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
              <th className="px-4 py-3 font-semibold text-slate-600">Subjects</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Batches</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-600">Joined</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>

          {loading ? <TableSkeleton /> :
           teachers.length === 0 ? <EmptyState /> : (
            <tbody className="divide-y divide-slate-50 bg-white">
              {teachers.map((t) => {
                const isSelected = selectedIds.has(t.id);
                return (
                  <tr key={t.id} className={`hover:bg-emerald-50/20 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''}`}>
                    <td className="px-4 py-3 text-center">
                      <TableCheckbox
                        checked={isSelected}
                        onChange={() => onSelectOne(t.id)}
                        ariaLabel={`Select teacher ${t.name}`}
                        color="emerald"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => onView(t)}>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-[10.5px] shrink-0 shadow-xs">
                          {t.avatarInitials}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 group-hover:text-emerald-600 transition-colors block">{t.name}</span>
                          <span className="text-[10px] text-slate-400">{t.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{t.qualification ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{t.subjectIds.length} subject{t.subjectIds.length === 1 ? '' : 's'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[180px]">
                        {t.batchAssignments.length === 0 && <span className="text-slate-300">Unassigned</span>}
                        {t.batchAssignments.slice(0, 2).map((a) => (
                          <span key={a.id} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium truncate max-w-[90px]">{a.batchName}</span>
                        ))}
                        {t.batchAssignments.length > 2 && <span className="text-[10px] text-slate-400 font-medium">+{t.batchAssignments.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-slate-500">{new Date(t.joinedOn).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><RowActions teacher={t} onView={onView} onEdit={onEdit} onDelete={onDelete} /></td>
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
