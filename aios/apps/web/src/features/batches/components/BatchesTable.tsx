'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare, Square, Minus, Users, GraduationCap } from 'lucide-react';
import type { BatchListItem, SortDirection, BatchSortField } from '../types/batch.types';

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
      {isActive ? 'Active' : 'Archived'}
    </span>
  );
}

function SortHeader({ label, col, sortBy, sortDir, onSort }: {
  label: string; col: BatchSortField; sortBy: BatchSortField; sortDir: SortDirection; onSort: (col: BatchSortField) => void;
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

function RowActions({ batch, onView, onEdit, onDelete }: {
  batch: BatchListItem;
  onView: (b: BatchListItem) => void;
  onEdit: (b: BatchListItem) => void;
  onDelete: (b: BatchListItem) => void;
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
      <button onClick={() => setOpen((v) => !v)} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors" aria-label="Row actions">
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-40 text-xs">
          <button onClick={() => { onView(batch); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Details
          </button>
          <button onClick={() => { onEdit(batch); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Details
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => { onDelete(batch); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600 font-medium">
            <Trash2 className="w-3.5 h-3.5" /> Archive
          </button>
        </div>
      )}
    </div>
  );
}

export interface BatchesTableProps {
  batches: BatchListItem[];
  loading: boolean;
  selectedIds: Set<string>;
  sortBy: BatchSortField;
  sortDir: SortDirection;
  onSort: (col: BatchSortField) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView: (b: BatchListItem) => void;
  onEdit: (b: BatchListItem) => void;
  onDelete: (b: BatchListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50">
          {Array.from({ length: 7 }).map((__, j) => (
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
        <td colSpan={7} className="py-20 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center"><CheckSquare className="w-7 h-7 text-slate-300" /></div>
            <p className="text-sm font-bold text-slate-500">No batches found</p>
            <p className="text-xs text-slate-400">Try adjusting your search or filters</p>
          </div>
        </td>
      </tr>
    </tbody>
  );
}

export function BatchesTable({
  batches, loading, selectedIds, sortBy, sortDir, onSort, onSelectAll, onSelectOne, onView, onEdit, onDelete,
}: BatchesTableProps) {
  const allSelected = batches.length > 0 && batches.every((b) => selectedIds.has(b.id));
  const someSelected = batches.some((b) => selectedIds.has(b.id)) && !allSelected;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 w-10">
              <button onClick={onSelectAll} className="flex items-center justify-center text-slate-500 hover:text-indigo-600">
                {allSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : someSelected ? <Minus className="w-4 h-4 text-slate-400" /> : <Square className="w-4 h-4" />}
              </button>
            </th>
            <SortHeader label="Batch" col="name" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Class / Section" col="classYear" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Academic Year" col="academicYear" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-3 font-semibold text-slate-600">Students</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Teachers</th>
            <th className="px-4 py-3 font-semibold text-slate-600">Status</th>
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>

        {loading ? <TableSkeleton /> :
         batches.length === 0 ? <EmptyState /> : (
          <tbody className="divide-y divide-slate-50 bg-white">
            {batches.map((b) => {
              const isSelected = selectedIds.has(b.id);
              return (
                <tr key={b.id} className={`hover:bg-indigo-50/30 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => onSelectOne(b.id)} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer" onClick={() => onView(b)}>{b.name}</span>
                    {b.branchName && <p className="text-[10px] text-slate-400">{b.branchName}</p>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{[b.classYear, b.section].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{b.academicYear ?? '—'}</td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-slate-700 font-semibold"><Users className="w-3 h-3 text-blue-500" /> {b.studentCount}</span></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-slate-700 font-semibold"><GraduationCap className="w-3 h-3 text-emerald-500" /> {b.teacherCount}</span></td>
                  <td className="px-4 py-3"><StatusBadge isActive={b.isActive} /></td>
                  <td className="px-4 py-3"><RowActions batch={b} onView={onView} onEdit={onEdit} onDelete={onDelete} /></td>
                </tr>
              );
            })}
          </tbody>
        )}
      </table>
    </div>
  );
}
