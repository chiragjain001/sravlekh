'use client';
// ─── Teachers Table Component ──────────────────────────────────────────────────

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare, Square, Minus } from 'lucide-react';
import type { TeacherListItem, SortDirection } from '../types/teacher.types';

function WorkloadBar({ pct }: { pct: number }) {
  const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-slate-700">{pct}%</span>
    </div>
  );
}

function AvailabilityBadge({ status }: { status: string }) {
  const cls =
    status === 'available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    status === 'busy'      ? 'bg-amber-50 text-amber-700 border-amber-200' :
                             'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${cls} capitalize`}>
      {status}
    </span>
  );
}

function SortHeader({
  label, col, sortBy, sortDir, onSort,
}: {
  label: string; col: keyof TeacherListItem;
  sortBy: keyof TeacherListItem; sortDir: SortDirection;
  onSort: (col: keyof TeacherListItem) => void;
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

function RowActions({ teacher, onView, onEdit, onDelete }: {
  teacher: TeacherListItem;
  onView:   (t: TeacherListItem) => void;
  onEdit:   (t: TeacherListItem) => void;
  onDelete: (t: TeacherListItem) => void;
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
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-40 text-xs">
          <button onClick={() => { onView(teacher); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Profile
          </button>
          <button onClick={() => { onEdit(teacher); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Details
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => { onDelete(teacher); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600 font-medium">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

export interface TeachersTableProps {
  teachers:    TeacherListItem[];
  loading:     boolean;
  selectedIds: Set<string>;
  sortBy:      keyof TeacherListItem;
  sortDir:     SortDirection;
  onSort:      (col: keyof TeacherListItem) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView:      (t: TeacherListItem) => void;
  onEdit:      (t: TeacherListItem) => void;
  onDelete:    (t: TeacherListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50">
          {Array.from({ length: 9 }).map((__, j) => (
            <td key={j} className="px-4 py-3.5">
              <div className="h-3 bg-slate-100 rounded-full" style={{ width: `${60 + (j * 7) % 40}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function TeachersTable({
  teachers, loading, selectedIds, sortBy, sortDir,
  onSort, onSelectAll, onSelectOne, onView, onEdit, onDelete,
}: TeachersTableProps) {
  const allSelected  = teachers.length > 0 && teachers.every((t) => selectedIds.has(t.id));
  const someSelected = teachers.some((t) => selectedIds.has(t.id)) && !allSelected;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 w-10">
              <button onClick={onSelectAll} className="flex items-center justify-center text-slate-500 hover:text-indigo-600">
                {allSelected  ? <CheckSquare className="w-4 h-4 text-indigo-600" /> :
                 someSelected ? <Minus className="w-4 h-4 text-slate-400" /> :
                                <Square className="w-4 h-4" />}
              </button>
            </th>
            <SortHeader label="Teacher"       col="name"            sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Subject"       col="subject"         sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Batches"       col="assignedBatches" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Weekly Hrs"    col="weeklyClasses"   sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Pending Eval"  col="pendingEvaluations" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Avg Perf."     col="avgStudentScore" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Workload"      col="workloadPct"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Availability"  col="availability"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-3 w-10" />
          </tr>
        </thead>

        {loading ? <TableSkeleton /> : teachers.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={10} className="py-16 text-center text-slate-400 font-medium">
                No faculty members found.
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-slate-50 bg-white">
            {teachers.map((t) => {
              const isSelected = selectedIds.has(t.id);
              return (
                <tr key={t.id} className={`hover:bg-indigo-50/30 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                  <td className="px-4 py-3">
                    <button onClick={() => onSelectOne(t.id)} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onView(t)}>
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                        {t.avatarInitials}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 hover:text-indigo-600 transition-colors block">{t.name}</span>
                        <span className="text-[10px] text-slate-400">{t.designation}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{t.subject}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{t.assignedBatches} Batches</td>
                  <td className="px-4 py-3 font-bold text-slate-900">{t.weeklyClasses} hrs/wk</td>
                  <td className="px-4 py-3">
                    {t.pendingEvaluations > 0 ? (
                      <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                        {t.pendingEvaluations} Pending
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{t.avgStudentScore}%</td>
                  <td className="px-4 py-3"><WorkloadBar pct={t.workloadPct} /></td>
                  <td className="px-4 py-3"><AvailabilityBadge status={t.availability} /></td>
                  <td className="px-4 py-3">
                    <RowActions teacher={t} onView={onView} onEdit={onEdit} onDelete={onDelete} />
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
