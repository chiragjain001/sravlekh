'use client';

import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface TableCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel: string;
  color?: 'indigo' | 'emerald' | 'amber' | 'purple' | 'slate';
  disabled?: boolean;
  className?: string;
}

const COLOR_MAP: Record<NonNullable<TableCheckboxProps['color']>, { active: string; ring: string }> = {
  indigo: {
    active: 'bg-indigo-600 border-indigo-600 shadow-indigo-500/25',
    ring: 'focus-visible:ring-indigo-500/30',
  },
  emerald: {
    active: 'bg-emerald-600 border-emerald-600 shadow-emerald-500/25',
    ring: 'focus-visible:ring-emerald-500/30',
  },
  amber: {
    active: 'bg-amber-600 border-amber-600 shadow-amber-500/25',
    ring: 'focus-visible:ring-amber-500/30',
  },
  purple: {
    active: 'bg-purple-600 border-purple-600 shadow-purple-500/25',
    ring: 'focus-visible:ring-purple-500/30',
  },
  slate: {
    active: 'bg-slate-700 border-slate-700 shadow-slate-500/25',
    ring: 'focus-visible:ring-slate-500/30',
  },
};

export function TableCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  color = 'indigo',
  disabled = false,
  className = '',
}: TableCheckboxProps) {
  const isSelected = checked || indeterminate;
  const colorTheme = COLOR_MAP[color] ?? COLOR_MAP.indigo;

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange();
      }}
      className={`w-7 h-7 sm:w-8 sm:h-8 inline-flex items-center justify-center rounded-lg hover:bg-slate-100/80 active:bg-slate-200/60 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 group focus-visible:outline-none focus-visible:ring-2 ${colorTheme.ring} ${className}`}
    >
      <div
        className={`w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center transition-all duration-150 select-none ${
          isSelected
            ? `${colorTheme.active} text-white shadow-xs`
            : 'bg-white border-slate-300 shadow-2xs group-hover:border-slate-400 group-hover:bg-slate-50/50'
        }`}
      >
        {checked ? (
          <Check className="w-3.5 h-3.5 text-white stroke-[3] transition-transform duration-100" />
        ) : indeterminate ? (
          <Minus className="w-3.5 h-3.5 text-white stroke-[3] transition-transform duration-100" />
        ) : null}
      </div>
    </button>
  );
}
