'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, X } from 'lucide-react';

export interface AppleDropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  icon?: React.ReactNode;
}

export interface AppleDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: AppleDropdownOption[];
  label?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  themeColor?: 'indigo' | 'emerald' | 'amber' | 'purple' | 'slate';
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
  placement?: 'auto' | 'top' | 'bottom';
  searchable?: boolean;
  error?: string;
  variant?: 'default' | 'pill';
  menuWidth?: string;
}

export function AppleDropdown({
  value,
  onChange,
  options,
  label,
  placeholder = 'Select…',
  icon,
  disabled = false,
  required = false,
  className = '',
  themeColor = 'indigo',
  size = 'md',
  align = 'left',
  placement = 'auto',
  searchable = false,
  error,
  variant = 'default',
  menuWidth,
}: AppleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [effectivePlacement, setEffectivePlacement] = useState<'top' | 'bottom'>('bottom');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

  const listboxId = React.useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  // Filtered options if search is active
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  // Keep highlighted index in sync when opening or filtering
  useEffect(() => {
    if (isOpen) {
      const idx = filteredOptions.findIndex((opt) => opt.value === value);
      setHighlightedIndex(idx >= 0 ? idx : 0);
    } else {
      setHighlightedIndex(-1);
    }
  }, [isOpen, filteredOptions, value]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearchTerm('');
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (filteredOptions.length > 0 ? (prev + 1) % filteredOptions.length : -1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) =>
          filteredOptions.length > 0 ? (prev <= 0 ? filteredOptions.length - 1 : prev - 1) : -1
        );
      } else if (e.key === 'Enter') {
        const targetOpt = filteredOptions[highlightedIndex];
        if (targetOpt) {
          e.preventDefault();
          onChange(targetOpt.value);
          setIsOpen(false);
          setSearchTerm('');
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, filteredOptions, highlightedIndex, onChange]);

  // Focus search input when open
  useEffect(() => {
    if (isOpen && (searchable || options.length > 6)) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [isOpen, searchable, options.length]);

  // Smart placement calculation for desktop popover
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
      const popoverHeight = Math.min(options.length * 40 + 60, 260);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      const scrollParent = triggerRef.current.closest('.overflow-y-auto, [data-modal-body], form');
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const parentSpaceBelow = parentRect.bottom - rect.bottom;
        const parentSpaceAbove = rect.top - parentRect.top;

        if (parentSpaceBelow < popoverHeight && parentSpaceAbove > 150) {
          setEffectivePlacement('top');
          return;
        }
      }

      if (spaceBelow < popoverHeight && spaceAbove > 160) {
        setEffectivePlacement('top');
      } else {
        setEffectivePlacement('bottom');
      }
    }
  }, [isOpen, placement, options.length]);

  const activeBadgeColor =
    themeColor === 'emerald'
      ? 'bg-emerald-50 text-emerald-800 font-semibold'
      : themeColor === 'amber'
      ? 'bg-amber-50 text-amber-800 font-semibold'
      : themeColor === 'purple'
      ? 'bg-purple-50 text-purple-800 font-semibold'
      : themeColor === 'slate'
      ? 'bg-slate-100 text-slate-800 font-semibold'
      : 'bg-indigo-50 text-indigo-900 font-semibold';

  const checkColor =
    themeColor === 'emerald'
      ? 'text-emerald-600'
      : themeColor === 'amber'
      ? 'text-amber-600'
      : themeColor === 'purple'
      ? 'text-purple-600'
      : themeColor === 'slate'
      ? 'text-slate-600'
      : 'text-indigo-600';

  const accentButtonBg =
    themeColor === 'emerald'
      ? 'bg-emerald-600'
      : themeColor === 'amber'
      ? 'bg-amber-600'
      : themeColor === 'purple'
      ? 'bg-purple-600'
      : themeColor === 'slate'
      ? 'bg-slate-700'
      : 'bg-indigo-600';

  const openTriggerClasses =
    themeColor === 'emerald'
      ? 'border-emerald-500 ring-2 ring-emerald-500/15 bg-white shadow-xs'
      : themeColor === 'amber'
      ? 'border-amber-500 ring-2 ring-amber-500/15 bg-white shadow-xs'
      : themeColor === 'purple'
      ? 'border-purple-500 ring-2 ring-purple-500/15 bg-white shadow-xs'
      : themeColor === 'slate'
      ? 'border-slate-500 ring-2 ring-slate-500/15 bg-white shadow-xs'
      : 'border-indigo-500 ring-2 ring-indigo-500/15 bg-white shadow-xs';

  const chevronOpenClass =
    themeColor === 'emerald'
      ? 'rotate-180 text-emerald-600'
      : themeColor === 'amber'
      ? 'rotate-180 text-amber-600'
      : themeColor === 'purple'
      ? 'rotate-180 text-purple-600'
      : themeColor === 'slate'
      ? 'rotate-180 text-slate-600'
      : 'rotate-180 text-indigo-600';

  return (
    <div className={`relative ${variant === 'pill' ? 'inline-block' : ''} ${className}`} ref={containerRef}>
      {label && variant !== 'pill' && (
        <label className={`block font-bold text-slate-700 mb-1 flex items-center justify-between ${size === 'sm' ? 'text-[11px]' : 'text-[12px]'}`}>
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
        </label>
      )}

      {/* Trigger Button */}
      {variant === 'pill' ? (
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={label || placeholder}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className={`inline-flex items-center justify-between gap-1.5 rounded-full border text-left transition-all duration-150 pl-3 pr-2.5 py-1 text-[11.5px] font-semibold select-none ${
            isOpen
              ? openTriggerClasses
              : 'bg-white hover:bg-slate-50 active:bg-slate-100 border-slate-200/90 text-slate-700 shadow-2xs hover:border-slate-300'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? chevronOpenClass : ''
            }`}
          />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={label || placeholder}
          disabled={disabled}
          onClick={() => {
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          onKeyDown={(e) => {
            if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              setIsOpen(true);
            }
          }}
          className={`w-full flex items-center justify-between gap-2 rounded-xl border text-left transition-all duration-150 ${
            size === 'sm' ? 'px-3 py-2 sm:py-1.5 text-xs min-h-[44px] sm:min-h-[36px]' : 'px-3.5 py-2.5 text-[13px] min-h-[44px]'
          } ${
            isOpen
              ? openTriggerClasses
              : error
              ? 'border-rose-300 bg-rose-50/20'
              : 'border-slate-200/90 bg-slate-50/80 hover:bg-slate-100/70 hover:border-slate-300 focus:bg-white shadow-2xs'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-[0.99]'}`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {icon && <span className="text-slate-400 flex-shrink-0">{icon}</span>}
            <div className="min-w-0 flex items-center gap-1.5">
              <span
                className={`truncate font-medium ${
                  size === 'sm' ? 'text-xs' : 'text-[13px]'
                } ${selectedOption ? 'text-slate-800 font-semibold' : 'text-slate-400'}`}
              >
                {selectedOption ? selectedOption.label : placeholder}
              </span>
              {selectedOption?.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </div>
          </div>

          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? chevronOpenClass : ''
            }`}
          />
        </button>
      )}

      {error && <p className="text-[11.5px] text-rose-500 font-semibold mt-1">{error}</p>}

      {/* Apple-Style Popover Menu / Mobile Sheet */}
      {isOpen && (
        <>
          {/* Mobile Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[300] sm:hidden animate-fadein"
            onClick={() => {
              setIsOpen(false);
              setSearchTerm('');
            }}
          />

          {/* Mobile Bottom Action Sheet (Apple iOS Picker) */}
          <div
            className="fixed inset-x-0 bottom-0 z-[310] sm:hidden bg-white/95 backdrop-blur-2xl rounded-t-[28px] border-t border-slate-200/80 shadow-[0_-12px_40px_rgba(0,0,0,0.18)] max-h-[82vh] flex flex-col overflow-hidden animate-slide-up"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}
          >
            {/* iOS Grab Bar & Header */}
            <div className="pt-2.5 pb-2 px-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-slate-50/80">
              <div className="flex-1 text-center">
                <div className="w-9 h-1 rounded-full bg-slate-300 mx-auto mb-2" />
                <span className="text-[13px] font-bold text-slate-800 tracking-tight block">
                  {label ? `Select ${label}` : placeholder || 'Select Option'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className={`absolute right-3.5 top-3 text-xs font-bold ${
                  themeColor === 'emerald' ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                } px-3 py-1 rounded-full transition-colors cursor-pointer`}
              >
                Done
              </button>
            </div>

            {/* Mobile Search input */}
            {(searchable || options.length > 6) && (
              <div className="p-2.5 border-b border-slate-100 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search options…"
                    className={`w-full pl-9 pr-8 py-2 text-xs bg-slate-100/80 rounded-xl focus:outline-none focus:ring-2 ${
                      themeColor === 'emerald' ? 'focus:ring-emerald-500/20' : 'focus:ring-indigo-500/20'
                    } focus:bg-white text-slate-800 placeholder:text-slate-400 transition-all`}
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Mobile Options List */}
            <div
              id={`${listboxId}-mobile-listbox`}
              role="listbox"
              aria-label={label || placeholder}
              className="p-2 overflow-y-auto max-h-[52vh] space-y-1 custom-scrollbar"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl text-xs transition-colors cursor-pointer text-left active:scale-[0.99] min-h-[46px] ${
                        isSelected
                          ? activeBadgeColor
                          : isHighlighted
                          ? 'bg-slate-100 text-slate-900 font-medium'
                          : 'text-slate-700 hover:bg-slate-100/80 active:bg-slate-200/50 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {opt.icon && <span className="flex-shrink-0 text-slate-400">{opt.icon}</span>}
                        <div className="min-w-0">
                          <p className="truncate text-[13px]">{opt.label}</p>
                          {opt.sublabel && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{opt.sublabel}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {opt.badge && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && (
                          <span className={`w-5 h-5 rounded-full ${accentButtonBg} flex items-center justify-center text-white`}>
                            <Check className="w-3 h-3 stroke-[2.5]" />
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Desktop & Tablet Popover (Apple Frosted Glass) */}
          <div
            className={`hidden sm:block absolute z-[310] bg-white/98 backdrop-blur-xl rounded-2xl shadow-[0_12px_36px_-4px_rgba(0,0,0,0.14),0_4px_12px_rgba(0,0,0,0.06)] border border-slate-200/90 p-1.5 animate-fadein ${
              menuWidth || (variant === 'pill' ? 'w-48' : 'w-full min-w-[220px] sm:min-w-[240px]')
            } ${
              align === 'right' ? 'right-0 left-auto' : 'left-0 right-auto'
            } ${
              effectivePlacement === 'top'
                ? 'bottom-full mb-1.5 origin-bottom'
                : 'top-full mt-1.5 origin-top'
            }`}
          >
            {/* Desktop search if searchable or options > 7 */}
            {(searchable || options.length > 7) && (
              <div className="relative px-2 py-1.5 border-b border-slate-100 mb-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filter options…"
                  className={`w-full pl-7 pr-7 py-1 text-xs text-slate-800 placeholder:text-slate-400 bg-slate-50 border border-slate-200/80 rounded-lg focus:outline-none focus:ring-1 ${
                    themeColor === 'emerald' ? 'focus:ring-emerald-400' : 'focus:ring-indigo-400'
                  }`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Desktop Options List */}
            <div
              id={listboxId}
              role="listbox"
              aria-label={label || placeholder}
              className="max-h-56 overflow-y-auto custom-scrollbar space-y-0.5"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 font-medium">
                  No matching options
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(opt.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left active:scale-[0.99] ${
                        isSelected
                          ? activeBadgeColor
                          : isHighlighted
                          ? 'bg-slate-100/90 text-slate-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {opt.icon && <span className="flex-shrink-0">{opt.icon}</span>}
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{opt.label}</p>
                          {opt.sublabel && (
                            <p className="text-[10.5px] text-slate-400 truncate mt-0.5">
                              {opt.sublabel}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {opt.badge && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            {opt.badge}
                          </span>
                        )}
                        {isSelected && <Check className={`w-3.5 h-3.5 ${checkColor} stroke-[2.5]`} />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
