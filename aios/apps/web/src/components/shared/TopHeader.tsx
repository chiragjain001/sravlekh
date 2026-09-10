'use client';

import React from 'react';
import { Calendar, Flame, ChevronLeft } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

interface TopHeaderProps {
  greeting: string;
  subtitle: string;
  rightContent?: React.ReactNode;
  showStreak?: boolean;
  streakCount?: number;
  showDate?: boolean;
  dateStr?: string;
  showBackButton?: boolean;
  previousNavLabel?: string | null;
  onBack?: () => void;
}

export function TopHeader({
  greeting,
  subtitle,
  rightContent,
  showStreak,
  streakCount,
  showDate,
  dateStr,
  showBackButton,
  previousNavLabel,
  onBack,
}: TopHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10 transition-all duration-200">
      <div className="flex items-center gap-3">
        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2.5 py-1.5 -ml-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors flex-shrink-0"
            title={previousNavLabel ? `Back to ${previousNavLabel}` : 'Back'}
            aria-label={previousNavLabel ? `Back to ${previousNavLabel}` : 'Back'}
          >
            <ChevronLeft className="w-4 h-4" />
            {previousNavLabel && <span className="text-[11.5px] font-semibold hidden sm:inline">{previousNavLabel}</span>}
          </button>
        )}
        <div>
          <h1 className="text-[17px] font-bold text-slate-800 leading-tight">
            {greeting}
          </h1>
          <p className="text-[12.5px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {rightContent}

        {showStreak && (
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-[13px] font-bold text-orange-600">{streakCount}</span>
            <span className="text-[11px] text-orange-500 font-medium">Day Streak</span>
          </div>
        )}

        {showDate && dateStr && (
          <div className="flex items-center gap-1.5 text-slate-500 text-[12.5px]">
            <Calendar className="w-4 h-4" />
            <span>{dateStr}</span>
          </div>
        )}

        <NotificationBell />
      </div>
    </div>
  );
}
