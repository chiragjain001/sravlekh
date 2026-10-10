'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X, CheckSquare, Square } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface AppleMultiSelectDropdownProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: MultiSelectOption[];
  label?: string;
  placeholder?: string;
  allOptionLabel?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  quickAction?: {
    label: string;
    onClick: () => void;
  };
}

export function AppleMultiSelectDropdown({
  values,
  onChange,
  options,
  label,
  placeholder = 'Select options…',
  allOptionLabel = 'All / Institute-wide',
  searchable = true,
  disabled = false,
  className = '',
  quickAction,
}: AppleMultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const q = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)),
    );
  }, [options, searchTerm]);

  const isAllSelected = values.length === 0;

  const handleToggle = (val: string) => {
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const handleSelectAll = () => {
    onChange([]); // Empty array represents All / Institute-wide
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const selectedLabels = useMemo(() => {
    return values
      .map((v) => options.find((o) => o.value === v)?.label)
      .filter(Boolean) as string[];
  }, [values, options]);

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">{label}</label>
          {quickAction && (
            <button
              type="button"
              onClick={quickAction.onClick}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
            >
              {quickAction.label}
            </button>
          )}
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[38px] px-3 py-1.5 text-left rounded-xl border bg-white flex items-center justify-between gap-2 transition-all cursor-pointer ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/10 shadow-xs'
            : 'border-slate-200/90 hover:border-slate-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex-1 min-w-0">
          {isAllSelected ? (
            <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              {allOptionLabel}
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/50">
                {values.length} selected
              </span>
              <span className="text-xs text-slate-600 truncate max-w-[180px]">
                {selectedLabels.slice(0, 2).join(', ')}
                {selectedLabels.length > 2 && ` +${selectedLabels.length - 2} more`}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 text-slate-400 shrink-0">
          {!isAllSelected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleClearAll();
              }}
              className="p-0.5 rounded-full hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              title="Reset to All"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-72 flex flex-col">
          {/* Search Input */}
          {searchable && (
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter options…"
                  className="w-full text-xs pl-7.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 placeholder-slate-400"
                />
              </div>
            </div>
          )}

          {/* Options List */}
          <div className="overflow-y-auto custom-scrollbar flex-1 py-1">
            {/* Institute-wide / All Option */}
            <button
              type="button"
              onClick={handleSelectAll}
              className={`w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                isAllSelected
                  ? 'bg-emerald-50/70 text-emerald-800 font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isAllSelected ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>
                  {isAllSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </span>
                <span>{allOptionLabel}</span>
              </div>
              {isAllSelected && <span className="text-[10px] font-bold text-emerald-600 uppercase">Default</span>}
            </button>

            <div className="h-px bg-slate-100 my-1" />

            {/* Individual Options */}
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No matching options
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = values.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleToggle(opt.value)}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 text-indigo-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300'}`}>
                        {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </span>
                      <div className="truncate">
                        <span className="truncate">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="block text-[10px] text-slate-400 truncate font-normal">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    {opt.badge && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 shrink-0 ml-2">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
