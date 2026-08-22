'use client';
// ─── AdminTimetable — Timetable & Schedule ─────────────────────────────────
// Real backend from day one: slots are created against
// POST /institutes/:id/timetable, which now rejects overlapping teacher/room
// bookings with a 409 (18-EDGE-CASES.md) instead of silently double-booking.

import { useState } from 'react';
import { Plus, Search, Clock, MapPin, Loader2 } from 'lucide-react';
import {
  useTimetable, useBatches, useTeachers,
  useCreateTimetableSlot,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const SLOT_TYPES = ['CLASS', 'EXAM', 'REVISION', 'REMEDIAL', 'EXTRA_CLASS', 'BREAK', 'HOLIDAY'];

const TYPE_STYLE: Record<string, string> = {
  CLASS: 'bg-indigo-50 text-indigo-700',
  EXAM: 'bg-rose-50 text-rose-700',
  REVISION: 'bg-sky-50 text-sky-700',
  REMEDIAL: 'bg-amber-50 text-amber-700',
  EXTRA_CLASS: 'bg-violet-50 text-violet-700',
  BREAK: 'bg-slate-100 text-slate-600',
  HOLIDAY: 'bg-emerald-50 text-emerald-700',
};

interface SlotRow {
  id: string;
  title: string;
  type: string;
  teacherUserId?: string | null;
  roomRef?: string | null;
  startTime: string;
  endTime: string;
  batch?: { name: string } | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function AdminTimetable() {
  const [search, setSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: teachers } = useTeachers();
  const teacherNames = new Map<string, string>(
    (teachers?.data ?? []).map((t: { user: { id: string; name: string } }) => [t.user.id, t.user.name]),
  );

  const { data, isPending, isError } = useTimetable(batchFilter ? { batchId: batchFilter } : undefined);
  const slots: SlotRow[] = data ?? [];
  const visibleSlots = search.trim()
    ? slots.filter((s) => s.title.toLowerCase().includes(search.trim().toLowerCase()))
    : slots;

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Timetable</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule classes, exams, and remedial sessions — overlapping teacher or room bookings are rejected.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Schedule Slot
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search slots by title..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {isPending && <SkeletonTable rows={6} cols={5} />}

      {isError && (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="Couldn't load the timetable"
          description="Something went wrong fetching timetable slots. Try refreshing the page."
        />
      )}

      {!isPending && !isError && visibleSlots.length === 0 && (
        <EmptyState
          icon={<Clock className="w-6 h-6" />}
          title="No slots scheduled yet"
          description="Schedule a class, exam, or remedial session to get started."
          action={{ label: 'Schedule Slot', onClick: () => setCreateOpen(true) }}
        />
      )}

      {!isPending && !isError && visibleSlots.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Batch</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Teacher</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Room</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">When</th>
              </tr>
            </thead>
            <tbody>
              {visibleSlots.map((slot) => (
                <tr key={slot.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">{slot.title}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${TYPE_STYLE[slot.type] ?? 'bg-slate-100 text-slate-600'}`}>
                      {slot.type.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{slot.batch?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">
                    {slot.teacherUserId ? teacherNames.get(slot.teacherUserId) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">
                    {slot.roomRef ? (
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{slot.roomRef}</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                    {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateSlotDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ─── Schedule Slot ──────────────────────────────────────────────────────────

function CreateSlotDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: batches } = useBatches();
  const { data: teachers } = useTeachers();
  const createSlot = useCreateTimetableSlot();

  const [title, setTitle] = useState('');
  const [type, setType] = useState(SLOT_TYPES[0]);
  const [batchId, setBatchId] = useState('');
  const [teacherUserId, setTeacherUserId] = useState('');
  const [roomRef, setRoomRef] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  if (!isOpen) return null;

  function reset() {
    setTitle(''); setType(SLOT_TYPES[0]); setBatchId(''); setTeacherUserId('');
    setRoomRef(''); setStartTime(''); setEndTime('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startTime || !endTime) return;
    createSlot.mutate(
      {
        title: title.trim(),
        type,
        ...(batchId ? { batchId } : {}),
        ...(teacherUserId ? { teacherUserId } : {}),
        ...(roomRef.trim() ? { roomRef: roomRef.trim() } : {}),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
      },
      { onSuccess: () => { reset(); onClose(); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Schedule Slot</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics — Kinematics Revision"
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                {SLOT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Batch</label>
              <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                <option value="">No batch</option>
                {(batches ?? []).map((b: { id: string; name: string }) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Teacher</label>
              <select value={teacherUserId} onChange={(e) => setTeacherUserId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                <option value="">Unassigned</option>
                {(teachers?.data ?? []).map((t: { user: { id: string; name: string } }) => (
                  <option key={t.user.id} value={t.user.id}>{t.user.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Room</label>
              <input
                value={roomRef}
                onChange={(e) => setRoomRef(e.target.value)}
                placeholder="e.g. Room 204"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Starts</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Ends</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSlot.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createSlot.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
