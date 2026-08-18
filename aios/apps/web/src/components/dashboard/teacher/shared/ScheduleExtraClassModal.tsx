'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { batches } from '@/lib/mock-data/teacher';

export interface ScheduleExtraClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBatchId?: string;
  initialTopic?: string;
  onSchedule?: (newSession: {
    id: string;
    topic: string;
    date: string;
    time: string;
    room: string;
    batchId: string;
    enrolled: number;
    capacity: number;
    status: string;
  }) => void;
}

export function ScheduleExtraClassModal({
  isOpen,
  onClose,
  initialBatchId = '',
  initialTopic = '',
  onSchedule,
}: ScheduleExtraClassModalProps) {
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    batchId: initialBatchId || (batches[0]?.id ?? '11A'),
    topic: initialTopic,
    date: '',
    time: '',
    room: '',
    capacity: '40',
  });

  useEffect(() => {
    if (isOpen) {
      setDone(false);
      setForm({
        batchId: initialBatchId || (batches[0]?.id ?? '11A'),
        topic: initialTopic,
        date: '',
        time: '',
        room: '',
        capacity: '40',
      });
    }
  }, [isOpen, initialBatchId, initialTopic]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDone(true);

    const newSession = {
      id: `ec-${Date.now()}`,
      batchId: form.batchId,
      topic: form.topic,
      date: form.date,
      time: form.time,
      room: form.room || 'Room 101',
      enrolled: 0,
      capacity: Number(form.capacity) || 40,
      status: 'upcoming',
    };

    if (onSchedule) {
      onSchedule(newSession);
    }

    setTimeout(() => {
      setDone(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[150] flex items-center justify-center p-4 animate-fadein">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-slate-800">Schedule Extra Class</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <p className="text-[14px] font-bold text-slate-800">Session Scheduled Successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Target Batch *</label>
              <select
                required
                value={form.batchId}
                onChange={e => setForm(p => ({ ...p, batchId: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    Batch {b.label} (Class {b.classId})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Topic / Purpose *</label>
              <input
                required
                value={form.topic}
                onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                placeholder="e.g. Rotational Motion – Torque Problems"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Date *</label>
                <input
                  required
                  type="date"
                  value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Time *</label>
                <input
                  required
                  type="time"
                  value={form.time}
                  onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Room *</label>
                <input
                  required
                  value={form.room}
                  onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
                  placeholder="e.g. Room 201"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={e => setForm(p => ({ ...p, capacity: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-xs"
              >
                Schedule Session
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
