'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare, Square, Minus } from 'lucide-react';
import type { StudentListItem, SortDirection } from '../types/student.types';

// ── Badge helpers ──────────────────────────────────────────────────────────────
function PerformanceBadge({ level }: { level: string }) {
  const label =
    level === 'low' ? 'High' :
    level === 'medium' ? 'Medium' :
    level === 'high' ? 'Low' :
    'Critical';

  const cls =
    level === 'low'      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    level === 'medium'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
    level === 'high'     ? 'bg-rose-50 text-rose-700 border-rose-200' :
                           'bg-red-100 text-red-800 border-red-300';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        level === 'low' ? 'bg-emerald-500' : level === 'medium' ? 'bg-amber-500' :
        level === 'high' ? 'bg-rose-500' : 'bg-red-700'}`} />
      {label}
    </span>
  );
}

function FeeBadge({ status }: { status: string }) {
  const cls =
    status === 'paid'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    status === 'partial' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    status === 'waived'  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                           'bg-rose-50 text-rose-700 border-rose-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold border ${cls} capitalize`}>
      {status}
    </span>
  );
}

function AttendanceBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#10b981' : pct >= 65 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-slate-700">{pct}%</span>
    </div>
  );
}

// ── Column sort header ─────────────────────────────────────────────────────────
function SortHeader({
  label, col, sortBy, sortDir, onSort,
}: {
  label: string; col: keyof StudentListItem;
  sortBy: keyof StudentListItem; sortDir: SortDirection;
  onSort: (col: keyof StudentListItem) => void;
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

// ── Row Action Menu ────────────────────────────────────────────────────────────
function RowActions({ student, onView, onEdit, onDelete }: {
  student: StudentListItem;
  onView:   (s: StudentListItem) => void;
  onEdit:   (s: StudentListItem) => void;
  onDelete: (s: StudentListItem) => void;
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
        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        aria-label="Row actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 w-40 text-xs">
          <button onClick={() => { onView(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Profile
          </button>
          <button onClick={() => { onEdit(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Details
          </button>
          <div className="h-px bg-slate-100 my-1" />
          <button onClick={() => { onDelete(student); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-rose-50 text-rose-600 font-medium">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Table ─────────────────────────────────────────────────────────────────
export interface StudentsTableProps {
  students:      StudentListItem[];
  loading:       boolean;
  selectedIds:   Set<string>;
  sortBy:        keyof StudentListItem;
  sortDir:       SortDirection;
  onSort:        (col: keyof StudentListItem) => void;
  onSelectAll:   () => void;
  onSelectOne:   (id: string) => void;
  onView:        (s: StudentListItem) => void;
  onEdit:        (s: StudentListItem) => void;
  onDelete:      (s: StudentListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50">
          {Array.from({ length: 10 }).map((__, j) => (
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
        <td colSpan={11} className="py-20 text-center">
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
  onSort, onSelectAll, onSelectOne, onView, onEdit, onDelete,
}: StudentsTableProps) {
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id));
  const someSelected = students.some((s) => selectedIds.has(s.id)) && !allSelected;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 w-10">
              <button onClick={onSelectAll} className="flex items-center justify-center text-slate-500 hover:text-indigo-600">
                {allSelected   ? <CheckSquare className="w-4 h-4 text-indigo-600" /> :
                 someSelected  ? <Minus className="w-4 h-4 text-slate-400" /> :
                                 <Square className="w-4 h-4" />}
              </button>
            </th>
            <SortHeader label="Student"    col="name"          sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Roll No"    col="rollNo"        sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Program"    col="program"       sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Batch"      col="batchLabel"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Attendance" col="attendancePct" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Avg Score"  col="avgScore"      sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Fee"        col="feeStatus"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Performance" col="riskLevel"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-3 font-semibold text-slate-600">Parent</th>
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
                  <td className="px-4 py-3">
                    <button onClick={() => onSelectOne(s.id)} className="flex items-center justify-center text-slate-400 hover:text-indigo-600">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => onView(s)}>
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                        {s.avatarInitials}
                      </div>
                      <span className="font-bold text-slate-900 hover:text-indigo-600 transition-colors">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-medium">{s.rollNo}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-bold">{s.program}</span>
                  </td>
                  <td className="px-4 py-3 text-blue-600 font-semibold max-w-[140px] truncate">{s.batchLabel}</td>
                  <td className="px-4 py-3"><AttendanceBar pct={s.attendancePct} /></td>
                  <td className="px-4 py-3 font-bold text-slate-900">{s.avgScore}%</td>
                  <td className="px-4 py-3"><FeeBadge status={s.feeStatus} /></td>
                  <td className="px-4 py-3"><PerformanceBadge level={s.riskLevel} /></td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-700">{s.parentName ?? '—'}</p>
                      {s.parentPhone && <p className="text-[10px] text-slate-400">{s.parentPhone}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RowActions student={s} onView={onView} onEdit={onEdit} onDelete={onDelete} />
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
