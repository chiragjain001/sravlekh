'use client';

import { useState } from 'react';
import { useTimetable } from '@/hooks/useApi';
import { Plus, CalendarDays } from 'lucide-react';

export function TimetableList() {
  const { data: timetableData, isLoading } = useTimetable();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">Timetable</h2>
          <p className="text-sm text-navy-500">Manage class and exam schedules.</p>
        </div>
        <button
          className="btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Slot
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-navy-500">Loading timetable...</div>
        ) : timetableData?.length === 0 ? (
          <div className="p-12 text-center">
            <CalendarDays className="w-12 h-12 text-navy-300 mx-auto mb-3" />
            <p className="text-navy-900 font-medium mb-1">No slots scheduled.</p>
            <p className="text-navy-500 text-sm">Add a class or exam slot to the timetable.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-navy-50 text-navy-700 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-medium">Title</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Batch</th>
                  <th className="px-6 py-4 font-medium">Start Time</th>
                  <th className="px-6 py-4 font-medium">End Time</th>
                  <th className="px-6 py-4 font-medium">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {timetableData?.map((slot: any) => (
                  <tr key={slot.id} className="hover:bg-navy-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-navy-900">
                      {slot.title}
                      {slot.isRecurring && <span className="ml-2 text-xs text-navy-400 border border-navy-200 px-1.5 py-0.5 rounded">Recurring</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="chip-navy">{slot.type}</span>
                    </td>
                    <td className="px-6 py-4 text-navy-700">{slot.batch?.name || 'All'}</td>
                    <td className="px-6 py-4 text-navy-700">
                      {new Date(slot.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-navy-700">
                      {new Date(slot.endTime).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 text-navy-700">{slot.roomRef || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
