'use client';

import React, { useState } from 'react';
import { Calendar, Flame, ChevronLeft, Menu, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import toast from 'react-hot-toast';
import { NotificationBell } from './NotificationBell';
import { useDashboardStore } from '@/store/dashboard-store';
import { useStudentStore, useAdminStore } from '@/store/role-stores';
import { useTeacherStore } from '@/store/teacher-store';

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
  const { toggleMobileSidebar } = useDashboardStore();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const pathname = usePathname();
  const studentNav = useStudentStore((s) => s.studentNav);
  const teacherNav = useTeacherStore((s) => s.teacherNav);
  const adminNav = useAdminStore((s) => s.adminNav);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      if (pathname.includes('/student')) {
        switch (studentNav) {
          case 'Overview':
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['students'] }),
              queryClient.invalidateQueries({ queryKey: ['exams'] }),
              queryClient.invalidateQueries({ queryKey: ['assignments'] }),
              queryClient.invalidateQueries({ queryKey: ['timetable'] }),
            ]);
            break;
          case 'Progress':
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['students'] }),
              queryClient.invalidateQueries({ queryKey: ['exams'] }),
            ]);
            break;
          case 'My Tests':
            await queryClient.invalidateQueries({ queryKey: ['exams'] });
            break;
          case 'Assignments':
            await queryClient.invalidateQueries({ queryKey: ['assignments'] });
            break;
          case 'Study Plan':
          case 'Weak Topics':
          case 'Settings':
            await queryClient.invalidateQueries({ queryKey: ['students'] });
            break;
          case 'Doubt Center':
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['doubts'] }),
              queryClient.invalidateQueries({ queryKey: ['subjects'] }),
            ]);
            break;
          case 'Time Table':
          case 'Extra Classes':
            await queryClient.invalidateQueries({ queryKey: ['timetable'] });
            break;
          case 'Leaderboard':
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
              queryClient.invalidateQueries({ queryKey: ['leaderboard-growth'] }),
            ]);
            break;
          case 'Attendance':
            await queryClient.invalidateQueries({ queryKey: ['student-attendance'] });
            break;
          default:
            await queryClient.invalidateQueries({ queryKey: ['students'] });
            break;
        }
      } else if (pathname.includes('/teacher')) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['teacher'] }),
          queryClient.invalidateQueries({ queryKey: ['batches'] }),
          queryClient.invalidateQueries({ queryKey: ['exams'] }),
          queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
          queryClient.invalidateQueries({ queryKey: ['leaderboard-growth'] }),
          queryClient.invalidateQueries({ queryKey: ['today-sessions'] }),
          queryClient.invalidateQueries({ queryKey: ['attendance-session'] }),
        ]);
      } else if (pathname.includes('/admin')) {
        if (adminNav === 'Attendance') {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['today-sessions'] }),
            queryClient.invalidateQueries({ queryKey: ['attendance-missing'] }),
            queryClient.invalidateQueries({ queryKey: ['attendance-awaiting-finalization'] }),
            queryClient.invalidateQueries({ queryKey: ['attendance-session'] }),
            queryClient.invalidateQueries({ queryKey: ['attendance-summary'] }),
            queryClient.invalidateQueries({ queryKey: ['batches'] }),
            queryClient.invalidateQueries({ queryKey: ['teachers'] }),
          ]);
        } else {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['admin'] }),
            queryClient.invalidateQueries({ queryKey: ['students'] }),
            queryClient.invalidateQueries({ queryKey: ['teachers'] }),
            queryClient.invalidateQueries({ queryKey: ['today-sessions'] }),
            queryClient.invalidateQueries({ queryKey: ['batches'] }),
          ]);
        }
      } else if (pathname.includes('/founder')) {
        await queryClient.invalidateQueries({ queryKey: ['founder'] });
      } else {
        await queryClient.invalidateQueries();
      }
      toast.success('Synced latest data', { duration: 1500, id: 'sync-data-toast' });
    } catch {
      toast.error('Sync failed', { duration: 1500 });
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 border-b border-slate-100 bg-white sticky top-0 z-20 transition-all duration-200 min-w-0 w-full max-w-full">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 mr-2">
        {/* Apple-style mobile & tablet menu trigger */}
        <button
          onClick={toggleMobileSidebar}
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Open navigation menu"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {showBackButton && onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 px-2 py-1.5 -ml-1 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
            title={previousNavLabel ? `Back to ${previousNavLabel}` : 'Back'}
            aria-label={previousNavLabel ? `Back to ${previousNavLabel}` : 'Back'}
          >
            <ChevronLeft className="w-4 h-4" />
            {previousNavLabel && <span className="text-[11.5px] font-semibold hidden sm:inline">{previousNavLabel}</span>}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] sm:text-[17px] font-bold text-slate-800 leading-tight truncate">
            {greeting}
          </h1>
          <p className="text-[11px] sm:text-[12.5px] text-slate-500 mt-0.5 truncate max-w-[200px] sm:max-w-none">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
        {rightContent}

        {showStreak && (
          <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-2.5 sm:px-3 py-1.5 flex-shrink-0">
            <Flame className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-[13px] font-bold text-orange-600">{streakCount}</span>
            <span className="text-[11px] text-orange-500 font-medium hidden sm:inline">Day Streak</span>
          </div>
        )}

        {showDate && dateStr && (
          <div className="hidden lg:flex items-center gap-1.5 text-slate-500 text-[12.5px] flex-shrink-0">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{dateStr}</span>
          </div>
        )}

        {/* Global Page-Aware Live Sync Button */}
        <button
          type="button"
          onClick={handleSync}
          disabled={isSyncing}
          title="Sync latest data for this section"
          aria-label="Sync data"
          className="relative p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 active:scale-95 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-center flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform duration-500 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
        </button>

        <NotificationBell />
      </div>
    </div>
  );
}
