'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

export interface DatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  minDate?: string; // 'YYYY-MM-DD'
  maxDate?: string; // 'YYYY-MM-DD'
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  quickPresets?: boolean;
  error?: string;
  placement?: 'auto' | 'top' | 'bottom';
  align?: 'auto' | 'left' | 'right';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function formatDateDisplay(isoDateString: string): string {
  if (!isoDateString) return '';
  const parts = isoDateString.split('T')[0]?.split('-');
  if (!parts || parts.length < 3) return isoDateString;
  const y = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10) - 1;
  const d = parseInt(parts[2]!, 10);
  const dateObj = new Date(y, m, d);

  // Check if today, tomorrow
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateObj.getTime() === today.getTime()) {
    return `Today (${d} ${MONTH_NAMES[m]?.slice(0, 3)})`;
  }
  if (dateObj.getTime() === tomorrow.getTime()) {
    return `Tomorrow (${d} ${MONTH_NAMES[m]?.slice(0, 3)})`;
  }

  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
  return `${dayOfWeek}, ${d} ${MONTH_NAMES[m]?.slice(0, 3)} ${y}`;
}

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = 'Select date…',
  label,
  required,
  disabled,
  className = '',
  quickPresets = false,
  error,
  placement = 'auto',
  align = 'auto',
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerWrapRef = useRef<HTMLDivElement>(null);
  const [effectivePlacement, setEffectivePlacement] = useState<'top' | 'bottom'>('bottom');
  const [effectiveAlign, setEffectiveAlign] = useState<'left' | 'right'>(() => {
    if (align === 'right') return 'right';
    return 'left';
  });

  const updatePositioning = () => {
    if (placement === 'top') {
      setEffectivePlacement('top');
    } else if (placement === 'bottom') {
      setEffectivePlacement('bottom');
    } else if (triggerWrapRef.current) {
      const rect = triggerWrapRef.current.getBoundingClientRect();
      const calendarHeight = 350;
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      // Check within scrollable parent container (e.g. modal body)
      const scrollParent = triggerWrapRef.current.closest('.overflow-y-auto, [data-modal-body], form');
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const parentSpaceBelow = parentRect.bottom - rect.bottom;
        const parentSpaceAbove = rect.top - parentRect.top;

        if (parentSpaceBelow < calendarHeight && parentSpaceAbove > 180) {
          setEffectivePlacement('top');
        } else {
          setEffectivePlacement('bottom');
        }
      } else if (spaceBelow < calendarHeight && spaceAbove > 200) {
        setEffectivePlacement('top');
      } else {
        setEffectivePlacement('bottom');
      }
    }

    if (align === 'right') {
      setEffectiveAlign('right');
    } else if (align === 'left') {
      setEffectiveAlign('left');
    } else if (triggerWrapRef.current) {
      const rect = triggerWrapRef.current.getBoundingClientRect();
      const calendarWidth = 330;
      const viewportWidth = window.innerWidth;
      const spaceRight = viewportWidth - rect.left;
      const spaceLeft = rect.right;

      if (spaceRight < calendarWidth && spaceLeft >= calendarWidth) {
        setEffectiveAlign('right');
      } else if (spaceRight < calendarWidth) {
        setEffectiveAlign('right');
      } else {
        setEffectiveAlign('left');
      }
    }
  };

  // Calculate smart placement & alignment when calendar opens or resizes
  useEffect(() => {
    if (!isOpen) return;

    updatePositioning();

    const handleResize = () => {
      updatePositioning();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, placement, align]);

  // Current view month & year
  const initialDate = useMemo(() => {
    if (value) {
      const parts = value.split('T')[0]?.split('-');
      if (parts && parts.length === 3) {
        return new Date(parseInt(parts[0]!, 10), parseInt(parts[1]!, 10) - 1, 1);
      }
    }
    return new Date();
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Keep view aligned when value changes
  useEffect(() => {
    if (value) {
      const parts = value.split('T')[0]?.split('-');
      if (parts && parts.length === 3) {
        setViewYear(parseInt(parts[0]!, 10));
        setViewMonth(parseInt(parts[1]!, 10) - 1);
      }
    }
  }, [value]);

  // Handle click outside to close popover
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y: number) => y - 1);
    } else {
      setViewMonth((m: number) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y: number) => y + 1);
    } else {
      setViewMonth((m: number) => m + 1);
    }
  };

  // Days in current view month
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  // Days in previous month for leading padding
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handleSelectDay = (day: number) => {
    const selected = new Date(viewYear, viewMonth, day);
    onChange(toDateString(selected));
    setIsOpen(false);
  };

  const normalizedValue = value ? value.split('T')[0] : '';
  const normalizedMin = minDate ? minDate.split('T')[0] : '';
  const normalizedMax = maxDate ? maxDate.split('T')[0] : '';

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePositioning();
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[12px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {normalizedValue && !disabled && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
            >
              Clear
            </button>
          )}
        </label>
      )}

      {/* Main trigger button & Popover anchor */}
      <div className="relative" ref={triggerWrapRef}>
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggle}
          className={`w-full min-h-[46px] flex items-center justify-between px-3.5 py-2.5 rounded-2xl border text-left transition-all select-none ${
            isOpen
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs'
              : error
              ? 'border-rose-300 bg-rose-50/20'
              : 'border-slate-200/90 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.03)]'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
        >
          <div className="flex items-center gap-2.5 min-w-0 pr-1">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 ${
              normalizedValue ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'
            }`}>
              <CalendarIcon className="w-3.5 h-3.5" />
            </div>
            <span className={`text-[13px] sm:text-[13.5px] font-semibold truncate ${
              normalizedValue ? 'text-slate-800' : 'text-slate-400'
            }`}>
              {normalizedValue ? formatDateDisplay(normalizedValue) : placeholder}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-400">
            {normalizedValue && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Date selected" />
            )}
          </div>
        </button>

        {/* Interactive Calendar Popover */}
        {isOpen && (
          <>
            {/* Backdrop on mobile screens for sheet feel */}
            <div
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-[190] sm:hidden"
              onClick={() => setIsOpen(false)}
            />

            <div
              className={`fixed sm:absolute z-[200] w-[92vw] max-w-[340px] sm:w-[320px] bg-white rounded-3xl sm:rounded-2xl shadow-2xl border border-slate-100 p-4 animate-fadein ${
                effectiveAlign === 'right' ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
              } ${
                // Mobile: centered bottom sheet
                'left-1/2 -translate-x-1/2 bottom-4 sm:translate-x-0 ' +
                // Desktop: top or bottom of input box
                (effectivePlacement === 'top'
                  ? 'sm:bottom-full sm:mb-2 sm:top-auto sm:origin-bottom'
                  : 'sm:top-full sm:mt-2 sm:bottom-auto sm:origin-top')
              }`}
            >
              {/* Apple-style subtle caret pointer pointing directly to the input box */}
              {effectivePlacement === 'top' ? (
                <div
                  className={`hidden sm:block absolute -bottom-1.5 w-3 h-3 bg-white border-r border-b border-slate-200/80 rotate-45 ${
                    effectiveAlign === 'right' ? 'right-6' : 'left-6'
                  }`}
                />
              ) : (
                <div
                  className={`hidden sm:block absolute -top-1.5 w-3 h-3 bg-white border-l border-t border-slate-200/80 rotate-45 ${
                    effectiveAlign === 'right' ? 'right-6' : 'left-6'
                  }`}
                />
              )}
            {/* Calendar header with navigation */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-[14px] font-bold text-slate-800 select-none">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Weekday column names */}
            <div className="grid grid-cols-7 gap-1 text-center mb-1">
              {WEEKDAYS.map(d => (
                <span key={d} className="text-[11px] font-bold text-slate-400 py-1">
                  {d}
                </span>
              ))}
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Previous month leading days */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => {
                const dayNum = daysInPrevMonth - firstDayOfWeek + i + 1;
                return (
                  <div
                    key={`prev-${i}`}
                    className="h-8 flex items-center justify-center text-[12px] font-medium text-slate-300 select-none"
                  >
                    {dayNum}
                  </div>
                );
              })}

              {/* Current month days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = toDateString(new Date(viewYear, viewMonth, day));
                const isSelected = normalizedValue === dateStr;

                const isPast = normalizedMin ? dateStr < normalizedMin : false;
                const isFutureBlocked = normalizedMax ? dateStr > normalizedMax : false;
                const isDisabled = isPast || isFutureBlocked;

                const isToday = toDateString(new Date()) === dateStr;

                return (
                  <button
                    key={day}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleSelectDay(day)}
                    className={`h-8 w-full rounded-xl text-[12.5px] font-semibold transition-all relative flex items-center justify-center ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-sm font-bold scale-105'
                        : isDisabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : isToday
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Bottom bar with Clear and Done */}
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const todayStr = toDateString(new Date());
                  onChange(todayStr);
                  setIsOpen(false);
                }}
                className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
      </div>

      {error && <p className="text-[11.5px] text-rose-500 font-semibold mt-1.5">{error}</p>}
    </div>
  );
}
