'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Clock, Check, ChevronDown, X } from 'lucide-react';

export interface TimePickerProps {
  value: string; // 'HH:mm' 24h e.g. '16:30'
  onChange: (time24: string) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placement?: 'auto' | 'top' | 'bottom';
  align?: 'left' | 'right';
  quickPresets?: boolean;
  error?: string;
}

// Convert 'HH:mm' 24h to { hour12: number, minute: number, period: 'AM' | 'PM', display: string }
export function parse24hTime(timeStr: string): {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  display: string;
} {
  if (!timeStr) {
    return { hour12: 4, minute: 30, period: 'PM', display: '4:30 PM' };
  }
  const parts = timeStr.split(':');
  let h = parseInt(parts[0] ?? '16', 10);
  let m = parseInt(parts[1] ?? '30', 10);
  if (isNaN(h)) h = 16;
  if (isNaN(m)) m = 30;

  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const padM = String(m).padStart(2, '0');
  const display = `${hour12}:${padM} ${period}`;

  return { hour12, minute: m, period, display };
}

// Convert hour12, minute, period to 'HH:mm' 24h string
export function format24hTime(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour12 % 12;
  if (period === 'PM') h += 12;
  const padH = String(h).padStart(2, '0');
  const padM = String(minute).padStart(2, '0');
  return `${padH}:${padM}`;
}

const COMMON_PRESETS = [
  { label: '3:00 PM', time24: '15:00' },
  { label: '3:30 PM', time24: '15:30' },
  { label: '4:00 PM', time24: '16:00' },
  { label: '4:30 PM', time24: '16:30' },
  { label: '5:00 PM', time24: '17:00' },
  { label: '5:30 PM', time24: '17:30' },
  { label: '6:00 PM', time24: '18:00' },
  { label: '6:30 PM', time24: '18:30' },
];

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export function TimePicker({
  value,
  onChange,
  label,
  required,
  disabled,
  className = '',
  placement = 'auto',
  align = 'left',
  quickPresets = true,
  error,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [effectivePlacement, setEffectivePlacement] = useState<'top' | 'bottom'>('top');

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parsed = useMemo(() => parse24hTime(value), [value]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Smart placement calculation
  useEffect(() => {
    if (!isOpen) return;

    if (placement === 'top') {
      setEffectivePlacement('top');
      return;
    }
    if (placement === 'bottom') {
      setEffectivePlacement('bottom');
      return;
    }

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 330;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const scrollParent = triggerRef.current.closest('.overflow-y-auto, [data-modal-body], form');
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const parentSpaceBelow = parentRect.bottom - rect.bottom;
        const parentSpaceAbove = rect.top - parentRect.top;

        if (parentSpaceBelow < popoverHeight && parentSpaceAbove > 180) {
          setEffectivePlacement('top');
          return;
        }
      }

      if (spaceBelow < popoverHeight && spaceAbove > 200) {
        setEffectivePlacement('top');
      } else {
        setEffectivePlacement('bottom');
      }
    }
  }, [isOpen, placement]);

  const handleHourSelect = (h: number) => {
    onChange(format24hTime(h, parsed.minute, parsed.period));
  };

  const handleMinuteSelect = (m: number) => {
    onChange(format24hTime(parsed.hour12, m, parsed.period));
  };

  const handlePeriodToggle = (p: 'AM' | 'PM') => {
    if (p !== parsed.period) {
      onChange(format24hTime(parsed.hour12, parsed.minute, p));
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-[12px] font-bold text-slate-700 mb-1.5 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
        </label>
      )}

      {/* Main Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs'
            : error
            ? 'border-rose-300 bg-rose-50/20'
            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <span className="text-[13.5px] font-bold text-slate-800">
            {parsed.display}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {parsed.period}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Quick Presets Row under input */}
      {quickPresets && !disabled && (
        <div className="flex items-center gap-1.5 mt-2 overflow-x-auto custom-scrollbar pb-0.5">
          {COMMON_PRESETS.map((p) => {
            const isSelected = value === p.time24;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => onChange(p.time24)}
                className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border transition-colors flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600 border-slate-200/70'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-[11.5px] text-rose-500 font-semibold mt-1">{error}</p>}

      {/* ── Apple-Style Interactive Time Popover ────────────────────────── */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-2xs z-[210] sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`fixed sm:absolute z-[220] w-[92vw] max-w-[340px] sm:w-[320px] bg-white rounded-3xl sm:rounded-2xl shadow-2xl border border-slate-100 p-4 animate-fadein ${
              align === 'right' ? 'sm:right-0 sm:left-auto' : 'sm:left-0 sm:right-auto'
            } ${
              // Mobile centered modal
              'left-1/2 -translate-x-1/2 bottom-4 sm:translate-x-0 ' +
              // Desktop top/bottom
              (effectivePlacement === 'top'
                ? 'sm:bottom-full sm:mb-2 sm:top-auto sm:origin-bottom'
                : 'sm:top-full sm:mt-2 sm:bottom-auto sm:origin-top')
            }`}
          >
            {/* Apple-style caret pointing directly to trigger */}
            {effectivePlacement === 'top' ? (
              <div
                className={`hidden sm:block absolute -bottom-1.5 w-3 h-3 bg-white border-r border-b border-slate-200/80 rotate-45 ${
                  align === 'right' ? 'right-6' : 'left-6'
                }`}
              />
            ) : (
              <div
                className={`hidden sm:block absolute -top-1.5 w-3 h-3 bg-white border-l border-t border-slate-200/80 rotate-45 ${
                  align === 'right' ? 'right-6' : 'left-6'
                }`}
              />
            )}
            {/* Popover Header: Large 12-Hour Display & AM/PM Switcher */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Selected Time
                </span>
                <span className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {parsed.hour12}:{String(parsed.minute).padStart(2, '0')}{' '}
                  <span className="text-indigo-600">{parsed.period}</span>
                </span>
              </div>

              {/* AM / PM Segmented Apple Toggle */}
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => handlePeriodToggle('AM')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    parsed.period === 'AM'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => handlePeriodToggle('PM')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    parsed.period === 'PM'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Hours Selector */}
            <div className="mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Hour
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {HOURS.map((h) => {
                  const isSelected = parsed.hour12 === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourSelect(h)}
                      className={`h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs scale-105'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Selector */}
            <div className="mb-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">
                Minute
              </span>
              <div className="grid grid-cols-6 gap-1.5">
                {MINUTES.map((m) => {
                  const isSelected = parsed.minute === m;
                  const pad = String(m).padStart(2, '0');
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteSelect(m)}
                      className={`h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-xs scale-105'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      :{pad}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer with Done button */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium">
                12-Hour format
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
