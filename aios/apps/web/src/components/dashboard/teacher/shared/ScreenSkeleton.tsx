'use client';

import React from 'react';

interface ScreenSkeletonProps {
  title?: string;
  cardsCount?: number;
}

export function ScreenSkeleton({ title = 'Loading Dashboard Data...', cardsCount = 4 }: ScreenSkeletonProps) {
  return (
    <div className="p-6 space-y-6 animate-pulse max-w-6xl mx-auto">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-200 rounded-xl" />
          <div className="h-4 w-96 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-10 w-32 bg-slate-200 rounded-xl" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cardsCount} gap-4`}>
        {Array.from({ length: cardsCount }).map((_, i) => (
          <div key={i} className="bg-white border border-slate-100 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-slate-200 rounded-md" />
              <div className="w-8 h-8 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-8 w-16 bg-slate-200 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main Content Table / Grid Skeleton */}
      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-xs space-y-4">
        <div className="h-6 w-48 bg-slate-200 rounded-lg" />
        <div className="space-y-3 pt-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between px-4">
              <div className="h-4 w-40 bg-slate-200 rounded-md" />
              <div className="h-4 w-20 bg-slate-200 rounded-md" />
              <div className="h-4 w-16 bg-slate-200 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
