'use client';
// ─── Timetable Matrix View Component ──────────────────────────────────────────
// Time / Batch Matrix rendering weekly class periods mapped by time slots and weekdays.

import React from 'react';
import { Clock } from 'lucide-react';
import type { ClassSessionItem, DayHeaderItem, TimetableGridRow } from '../types/timetable.types';

export interface TimetableMatrixViewProps {
  days:        DayHeaderItem[];
  rows:        TimetableGridRow[];
  loading:     boolean;
  onSelectCell: (session: ClassSessionItem) => void;
}

function GridSkeleton() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-16 bg-slate-100 rounded-xl" />
      ))}
    </div>
  );
}

export function TimetableMatrixView({ days, rows, loading, onSelectCell }: TimetableMatrixViewProps) {
  if (loading) return <GridSkeleton />;

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-center border-collapse">
        <thead>
          <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-600">
            <th className="py-3.5 px-4 border-r border-gray-100 w-44 text-left font-bold text-gray-800">Time / Batch</th>
            {days.map((d, idx) => (
              <th
                key={idx}
                className={`py-3 px-3 border-r border-gray-100 last:border-r-0 ${
                  d.active ? 'bg-blue-600 text-white font-bold' : 'text-gray-700'
                }`}
              >
                <div className="text-[10px] opacity-80 uppercase font-semibold">{d.name}</div>
                <div className="text-xs">{d.day}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-xs">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-blue-50/20 transition-colors">
              <td className="py-4 px-4 border-r border-gray-100 font-bold text-gray-900 text-left whitespace-nowrap text-[11.5px] bg-gray-50/30">
                {row.time}
              </td>
              {[row.mon, row.tue, row.wed, row.thu, row.fri, row.sat, row.sun].map((cell, cIdx) => (
                <td key={cIdx} className="p-2 border-r border-gray-100 last:border-r-0 align-top min-w-[130px] h-20">
                  {cell ? (
                    <div
                      onClick={() => onSelectCell(cell)}
                      className={`p-2.5 rounded-xl border text-left ${cell.color} space-y-1 shadow-2xs hover:shadow-xs transition-shadow cursor-pointer`}
                    >
                      <div className="font-bold text-xs">{cell.subject}</div>
                      <div className="text-[10.5px] font-medium opacity-90">{cell.batch}</div>
                      <div className="text-[9.5px] font-bold opacity-75 flex items-center justify-between">
                        <span>Room {cell.room}</span>
                        <span className="text-[8.5px] uppercase font-extrabold px-1 rounded bg-white/50">
                          {cell.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-300 text-[11px] font-medium">
                      —
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
