'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { useBatches, useCreateTimetableSlot } from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';

export interface ScheduleExtraClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBatchId?: string;
  initialTopic?: string;
  onScheduled?: () => void;
}

export function ScheduleExtraClassModal({
  isOpen,
  onClose,
  initialBatchId = '',
  initialTopic = '',
  onScheduled,
}: ScheduleExtraClassModalProps) {
  const { user } = useAuth();
  const { data: batchesResp } = useBatches();
  const batches: any[] = batchesResp?.data ?? batchesResp ?? [];
  const createSlot = useCreateTimetableSlot();
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    batchId: initialBatchId,
    topic: initialTopic,
    isRemedial: true,
    date: '',
    time: '',
    duration: '60',
    room: '',
  });

  useEffect(() => {
    if (isOpen) {
      setDone(false);
      setForm({ batchId: initialBatchId || batches[0]?.id || '', topic: initialTopic, isRemedial: true, date: '', time: '', duration: '60', room: '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialBatchId, initialTopic]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.batchId || !form.topic || !form.date || !form.time) return;

    const startTime = new Date(`${form.date}T${form.time}:00`);
    const endTime = new Date(startTime.getTime() + Number(form.duration) * 60_000);

    try {
      await createSlot.mutateAsync({
        batchId: form.batchId,
        type: form.isRemedial ? 'REMEDIAL' : 'EXTRA_CLASS',
        title: form.topic,
        teacherUserId: user?.id,
        roomRef: form.room || undefined,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      setDone(true);
      onScheduled?.();
      setTimeout(() => { setDone(false); onClose(); }, 1200);
    } catch {
      // useCreateTimetableSlot's onError already surfaces a toast (incl. room/teacher conflicts).
    }
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
              <select required value={form.batchId} onChange={e => setForm(p => ({ ...p, batchId: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30 bg-white">
                <option value="">Select a batch…</option>
                {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Topic / Purpose *</label>
              <input required value={form.topic} onChange={e => setForm(p => ({ ...p, topic: e.target.value }))}
                placeholder="e.g. Rotational Motion – Torque Problems"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
            </div>

            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Session Type</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(p => ({ ...p, isRemedial: true }))}
                  className={`flex-1 py-2 text-[12.5px] font-bold rounded-xl border transition-colors ${form.isRemedial ? 'bg-rose-50 border-rose-300 text-rose-700' : 'border-slate-200 text-slate-500'}`}>
                  Remedial
                </button>
                <button type="button" onClick={() => setForm(p => ({ ...p, isRemedial: false }))}
                  className={`flex-1 py-2 text-[12.5px] font-bold rounded-xl border transition-colors ${!form.isRemedial ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-slate-200 text-slate-500'}`}>
                  Extra Class
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Date *</label>
                <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Time *</label>
                <input required type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Room</label>
                <input value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))}
                  placeholder="e.g. Room 201"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
              </div>
              <div>
                <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Duration (min)</label>
                <input type="number" min="15" step="15" value={form.duration} onChange={e => setForm(p => ({ ...p, duration: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={createSlot.isPending}
                className="flex-1 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50">
                {createSlot.isPending ? 'Scheduling…' : 'Schedule Session'}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
