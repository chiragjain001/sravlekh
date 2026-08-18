'use client';
// ─── Announcements Data Table Component ──────────────────────────────────────

import React from 'react';
import type { AnnouncementItem } from '../types/communication.types';

export interface AnnouncementsTableProps {
  announcements: AnnouncementItem[];
  loading:       boolean;
  onSelect:      (announcement: AnnouncementItem) => void;
  onViewStats:   (announcement: AnnouncementItem) => void;
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-lg" />
      ))}
    </div>
  );
}

export function AnnouncementsTable({
  announcements, loading, onSelect, onViewStats,
}: AnnouncementsTableProps) {
  if (loading) return <TableSkeleton />;

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left text-xs whitespace-nowrap">
        <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500 font-semibold">
          <tr>
            <th className="px-5 py-3.5 text-gray-700">Announcement Title</th>
            <th className="px-5 py-3.5 text-gray-700">Target Audience</th>
            <th className="px-5 py-3.5 text-gray-700">Published Date &amp; Time</th>
            <th className="px-5 py-3.5 text-gray-700">Active Channels</th>
            <th className="px-5 py-3.5 text-gray-700">Read / Delivered Stats</th>
            <th className="px-5 py-3.5 text-gray-700 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 bg-white">
          {announcements.map((item) => (
            <tr
              key={item.id}
              onClick={() => onSelect(item)}
              className="hover:bg-blue-50/30 transition-colors cursor-pointer"
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="font-bold text-gray-900 text-[12.5px]">{item.title}</span>
                </div>
              </td>
              <td className="px-5 py-3.5 font-semibold text-gray-700">{item.targetAudience}</td>
              <td className="px-5 py-3.5 text-gray-500 font-medium">{item.publishDate}</td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.channels.map((ch, i) => (
                    <span key={i} className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                      {ch}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-5 py-3.5 font-bold text-emerald-600">
                Read: {item.readCount.toLocaleString()} / {item.totalTarget.toLocaleString()} ({item.readRate}%)
              </td>
              <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onViewStats(item)}
                  className="text-blue-600 hover:underline font-bold text-xs cursor-pointer"
                >
                  View Stats →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
