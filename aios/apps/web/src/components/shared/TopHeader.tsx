'use client';

import { Bell, Calendar, Flame } from 'lucide-react';

interface TopHeaderProps {
  greeting: string;
  subtitle: string;
  rightContent?: React.ReactNode;
  showStreak?: boolean;
  streakCount?: number;
  showDate?: boolean;
  dateStr?: string;
}

export function TopHeader({
  greeting,
  subtitle,
  rightContent,
  showStreak,
  streakCount,
  showDate,
  dateStr,
}: TopHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
      <div>
        <h1 className="text-[17px] font-bold text-slate-800 leading-tight">
          {greeting}
        </h1>
        <p className="text-[12.5px] text-slate-500 mt-0.5">{subtitle}</p>
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

        <button className="relative p-2 rounded-lg hover:bg-slate-50 transition-colors">
          <Bell className="w-5 h-5 text-slate-500" />
          <span className="absolute -top-1 -right-1 w-[18px] h-[18px] bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
            4
          </span>
        </button>
      </div>
    </div>
  );
}
