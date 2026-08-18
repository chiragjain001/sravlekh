'use client';
// ─── Batches Table Component ──────────────────────────────────────────────────

import React from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MoreHorizontal, Eye, Edit2, Trash2, CheckSquare, Square, Minus } from 'lucide-react';
import type { BatchListItem, SortDirection } from '../types/batch.types';

function SyllabusProgressBar({ pct }: { pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-slate-700">
        <span>Progress</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-blue-600 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ProgramBadge({ program }: { program: string }) {
  const cls =
    program === 'JEE'      ? 'bg-blue-50 text-blue-700 border-blue-100' :
    program === 'NEET'     ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
    program === 'Class 11' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
    program === 'Class 12' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                             'bg-amber-50 text-amber-700 border-amber-100';

  return (
    <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full border ${cls}`}>
      {program}
    </span>
  );
}

function SortHeader({
  label, col, sortBy, sortDir, onSort,
}: {
  label: string; col: keyof BatchListItem;
  sortBy: keyof BatchListItem; sortDir: SortDirection;
  onSort: (col: keyof BatchListItem) => void;
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

function RowActions({ batch, onView, onEdit, onDelete }: {
  batch: BatchListItem;
  onView:   (b: BatchListItem) => void;
  onEdit:   (b: BatchListItem) => void;
  onDelete: (b: BatchListItem) => void;
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
          <button onClick={() => { onView(batch); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Eye className="w-3.5 h-3.5 text-indigo-500" /> View Overview
          </button>
          <button onClick={() => { onEdit(batch); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 hover:bg-slate-50 text-slate-700 font-medium">
            <Edit2 className="w-3.5 h-3.5 text-emerald-500" /> Edit Batch
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
  batches:     BatchListItem[];
  loading:     boolean;
  selectedIds: Set<string>;
  sortBy:      keyof BatchListItem;
  sortDir:     SortDirection;
  onSort:      (col: keyof BatchListItem) => void;
  onSelectAll: () => void;
  onSelectOne: (id: string) => void;
  onView:      (b: BatchListItem) => void;
  onEdit:      (b: BatchListItem) => void;
  onDelete:    (b: BatchListItem) => void;
}

function TableSkeleton() {
  return (
    <tbody>
      {Array.from({ length: 6 }).map((_, i) => (
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

export function BatchesTable({
  batches, loading, selectedIds, sortBy, sortDir,
  onSort, onSelectAll, onSelectOne, onView, onEdit, onDelete,
}: BatchesTableProps) {
  const allSelected  = batches.length > 0 && batches.every((b) => selectedIds.has(b.id));
  const someSelected = batches.some((b) => selectedIds.has(b.id)) && !allSelected;

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs whitespace-nowrap">
        <thead className="bg-slate-50 border-y border-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 w-10">
              <button onClick={onSelectAll} className="flex items-center justify-center text-slate-500 hover:text-blue-600">
                {allSelected  ? <CheckSquare className="w-4 h-4 text-blue-600" /> :
                 someSelected ? <Minus className="w-4 h-4 text-slate-400" /> :
                                <Square className="w-4 h-4" />}
              </button>
            </th>
            <SortHeader label="Batch Name"     col="name"             sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Program"        col="program"          sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Target Year"    col="targetYear"       sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Students/Seats" col="enrolledStudents" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Lead Mentor"    col="leadMentor"       sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Attendance"     col="attendancePct"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Avg Score"      col="avgScore"         sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Syllabus"       col="syllabusProgress" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Next Test"      col="nextTestName"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <th className="px-4 py-3 w-10 text-right">Actions</th>
          </tr>
        </thead>

        {loading ? <TableSkeleton /> : batches.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={11} className="py-16 text-center text-slate-400 font-medium">
                No active batches found.
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody className="divide-y divide-slate-50 bg-white">
            {batches.map((b) => {
              const isSelected = selectedIds.has(b.id);
              return (
                <tr key={b.id} className={`hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                  <td className="px-4 py-3.5">
                    <button onClick={() => onSelectOne(b.id)} className="flex items-center justify-center text-slate-400 hover:text-blue-600">
                      {isSelected ? <CheckSquare className="w-4 h-4 text-blue-600" /> : <Square className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="cursor-pointer" onClick={() => onView(b)}>
                      <span className="font-bold text-slate-900 hover:text-blue-600 transition-colors block">{b.name}</span>
                      <span className="text-[10px] text-slate-400">{b.code}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5"><ProgramBadge program={b.program} /></td>
                  <td className="px-4 py-3.5 text-slate-500 font-medium">{b.targetYear}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">{b.enrolledStudents}/{b.maxCapacity}</td>
                  <td className="px-4 py-3.5 text-slate-700 font-semibold">{b.leadMentor}</td>
                  <td className="px-4 py-3.5 font-bold text-slate-900">{b.attendancePct}%</td>
                  <td className="px-4 py-3.5 font-bold text-emerald-600">{b.avgScore}%</td>
                  <td className="px-4 py-3.5 w-36"><SyllabusProgressBar pct={b.syllabusProgress} /></td>
                  <td className="px-4 py-3.5">
                    <div>
                      <p className="font-bold text-slate-900 text-[11.5px]">{b.nextTestName}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{b.nextTestDate}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <RowActions batch={b} onView={onView} onEdit={onEdit} onDelete={onDelete} />
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
