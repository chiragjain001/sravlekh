'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppleDropdown, AppleDropdownOption } from './AppleDropdown';

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
  pageSizeOptions?: AppleDropdownOption[];
  themeColor?: 'indigo' | 'emerald' | 'amber' | 'purple' | 'slate';
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS: AppleDropdownOption[] = [
  { value: '10', label: '10 / page' },
  { value: '20', label: '20 / page' },
  { value: '50', label: '50 / page' },
];

export function getPaginationPages(current: number, total: number): (number | string)[] {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 2, total - 1, total];
  }
  return [1, '...', current, '...', total];
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'items',
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  themeColor = 'indigo',
  className = '',
}: TablePaginationProps) {
  if (totalItems <= 0) return null;

  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);
  const paginationPages = getPaginationPages(page, totalPages);

  const activePageButtonClass =
    themeColor === 'emerald'
      ? 'bg-emerald-600 text-white shadow-xs font-bold'
      : themeColor === 'amber'
      ? 'bg-amber-600 text-white shadow-xs font-bold'
      : themeColor === 'purple'
      ? 'bg-purple-600 text-white shadow-xs font-bold'
      : themeColor === 'slate'
      ? 'bg-slate-800 text-white shadow-xs font-bold'
      : 'bg-indigo-600 text-white shadow-xs font-bold';

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3.5 sm:px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500 ${className}`}
    >
      {/* Range summary & page size selector */}
      <div className="flex items-center justify-between sm:justify-start w-full sm:w-auto gap-3">
        <span className="text-xs text-slate-600 font-medium select-none">
          <span className="font-bold text-slate-900">
            {startItem}–{endItem}
          </span>{' '}
          of <span className="font-bold text-slate-900">{totalItems}</span> {itemLabel}
        </span>

        <AppleDropdown
          variant="pill"
          themeColor={themeColor}
          size="sm"
          placement="top"
          align="right"
          value={String(pageSize)}
          onChange={(val) => onPageSizeChange(Number(val))}
          options={pageSizeOptions}
        />
      </div>

      {/* Mobile Apple-style Segmented Pagination */}
      <div className="flex sm:hidden items-center justify-between w-full p-1 bg-slate-100/90 rounded-2xl border border-slate-200/60 shadow-2xs">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-25 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Prev</span>
        </button>
        <span className="text-xs font-bold text-slate-800 select-none">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-25 disabled:pointer-events-none transition-all active:scale-95 cursor-pointer"
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Desktop & Tablet Segmented Pill Pagination */}
      <div className="hidden sm:inline-flex items-center justify-center p-1 bg-slate-100/80 rounded-2xl border border-slate-200/50 shadow-2xs gap-0.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white/80 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
          title="Previous Page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-0.5">
          {paginationPages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`dots-${idx}`} className="w-5 text-center text-slate-400 text-xs select-none">
                  …
                </span>
              );
            }
            const isCurrent = page === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p as number)}
                className={`min-w-[28px] sm:min-w-[32px] h-7 sm:h-8 px-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  isCurrent
                    ? activePageButtonClass
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/70 font-medium'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-white/80 disabled:opacity-25 disabled:pointer-events-none transition-all cursor-pointer active:scale-95"
          title="Next Page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
