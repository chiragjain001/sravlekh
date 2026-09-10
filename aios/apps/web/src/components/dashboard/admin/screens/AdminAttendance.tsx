'use client';
// ─── AdminAttendance — real attendance marking, records, and summary ──────────
// Every value flows through the new apps/api/src/attendance module. Marking a
// never-recorded date uses the bulk mark endpoint; changing an already-marked
// record goes through the dedicated correction endpoint, which requires a
// reason and is audit-logged — matching this project's established
// audit-on-correction pattern (e.g. ExamsService.unlock).

import React, { useState, useMemo } from 'react';
import {
  CalendarDays, Users, CheckCircle2, XCircle, Clock, ShieldAlert,
  BarChart2, List, Loader2, AlertTriangle, Edit2, X,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBatches, useBatch, useAttendanceRecords, useAttendanceSummary, useMarkAttendance, useCorrectAttendance } from '@/hooks/useApi';

type MainTab = 'mark' | 'summary';
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

const STATUS_CONFIG: Record<AttendanceStatus, { label: string; icon: React.ElementType; color: string; active: string }> = {
  PRESENT: { label: 'Present', icon: CheckCircle2, color: 'text-emerald-600', active: 'bg-emerald-600 text-white border-emerald-600' },
  ABSENT: { label: 'Absent', icon: XCircle, color: 'text-rose-600', active: 'bg-rose-600 text-white border-rose-600' },
  LATE: { label: 'Late', icon: Clock, color: 'text-amber-600', active: 'bg-amber-600 text-white border-amber-600' },
  EXCUSED: { label: 'Excused', icon: ShieldAlert, color: 'text-blue-600', active: 'bg-blue-600 text-white border-blue-600' },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function CorrectionDialog({ record, onClose }: { record: { id: string; status: AttendanceStatus; studentName: string } | null; onClose: () => void }) {
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [reason, setReason] = useState('');
  const correctMutation = useCorrectAttendance();

  React.useEffect(() => { if (record) setStatus(record.status); setReason(''); }, [record]);

  if (!record) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10 || !record) return;
    await correctMutation.mutateAsync({ recordId: record.id, status, reason: reason.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Correct Attendance</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{record.studentName}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"><X className="w-3.5 h-3.5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${status === s ? STATUS_CONFIG[s].active : 'bg-white border-slate-200 text-slate-600'}`}>
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Reason for correction <span className="text-rose-500">*</span></label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} required rows={3} placeholder="At least 10 characters — why is this being corrected?" className="w-full text-xs border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <button type="submit" disabled={correctMutation.isPending || reason.trim().length < 10} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white bg-indigo-600 rounded-lg py-2 hover:bg-indigo-700 disabled:opacity-60">
            {correctMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Correction
          </button>
        </form>
      </div>
    </div>
  );
}

function MarkTab() {
  const { data: batchesData } = useBatches();
  const batches: { id: string; name: string }[] = batchesData?.data ?? batchesData ?? [];
  const [batchId, setBatchId] = useState('');
  const [date, setDate] = useState(todayIso());
  const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});
  const [correctionTarget, setCorrectionTarget] = useState<{ id: string; status: AttendanceStatus; studentName: string } | null>(null);

  const { data: batch, isPending: batchPending } = useBatch(batchId || null);
  const { data: recordsData, isPending: recordsPending } = useAttendanceRecords(batchId ? { batchId, dateFrom: date, dateTo: date, limit: 200 } : undefined);
  const markMutation = useMarkAttendance();

  const students: { id: string; name: string }[] = (batch?.students ?? []).map((s: any) => ({ id: s.id, name: s.user?.name ?? '—' }));
  const existingByStudent = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of recordsData?.data ?? []) map.set(r.studentProfileId, r);
    return map;
  }, [recordsData]);

  const isPastRecord = (studentId: string) => existingByStudent.has(studentId);

  function setStatus(studentId: string, status: AttendanceStatus) {
    if (isPastRecord(studentId)) return; // already recorded — must go through correction
    setDraft((d) => ({ ...d, [studentId]: status }));
  }

  async function handleSave() {
    const entries = students
      .filter((s) => !isPastRecord(s.id))
      .map((s) => ({ studentProfileId: s.id, status: draft[s.id] ?? 'PRESENT' }));
    if (entries.length === 0 || !batchId) return;
    await markMutation.mutateAsync({ batchId, date, entries });
    setDraft({});
  }

  const unmarkedCount = students.filter((s) => !isPastRecord(s.id)).length;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-400" />
          <select value={batchId} onChange={(e) => { setBatchId(e.target.value); setDraft({}); }} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[220px]">
            <option value="">Select a batch</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-slate-400" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white" />
        </div>
        {batchId && unmarkedCount > 0 && (
          <button onClick={handleSave} disabled={markMutation.isPending} className="ml-auto flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {markMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Save Attendance ({unmarkedCount})
          </button>
        )}
      </div>

      {!batchId ? (
        <div className="text-center py-16 text-sm text-slate-400">Select a batch and date to mark attendance.</div>
      ) : batchPending || recordsPending ? (
        <div className="space-y-2 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-12 bg-slate-100 rounded-xl" />)}</div>
      ) : students.length === 0 ? (
        <div className="text-center py-16 text-sm text-slate-400">This batch has no enrolled students.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {students.map((s) => {
            const existing = existingByStudent.get(s.id);
            const current: AttendanceStatus = existing?.status ?? draft[s.id] ?? 'PRESENT';
            const locked = !!existing;
            return (
              <div key={s.id} className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">{s.name}</span>
                  {locked && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">already recorded{existing.correctedAt ? ' · corrected' : ''}</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((st) => {
                    const cfg = STATUS_CONFIG[st];
                    const isActive = current === st;
                    return (
                      <button
                        key={st} type="button" disabled={locked}
                        onClick={() => setStatus(s.id, st)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${isActive ? cfg.active : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
                      >
                        {cfg.label}
                      </button>
                    );
                  })}
                  {locked && (
                    <button onClick={() => setCorrectionTarget({ id: existing.id, status: existing.status, studentName: s.name })} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-indigo-600" aria-label="Correct">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CorrectionDialog record={correctionTarget} onClose={() => setCorrectionTarget(null)} />
    </div>
  );
}

function SummaryTab() {
  const { data: batchesData } = useBatches();
  const batches: { id: string; name: string }[] = batchesData?.data ?? batchesData ?? [];
  const [batchId, setBatchId] = useState('');
  const { data: summary, isPending, isError } = useAttendanceSummary(batchId ? { batchId } : undefined);

  if (isPending) return <div className="space-y-4 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-40 bg-slate-100 rounded-2xl" />)}</div>;
  if (isError || !summary) return <div className="text-center py-16 text-sm text-slate-500">Failed to load attendance summary.</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white min-w-[220px]">
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
        <div className="text-4xl font-black text-slate-900">{summary.overallAttendancePct}%</div>
        <div className="text-xs text-slate-500">Overall attendance rate{batchId ? ' for this batch' : ' across all batches'} (excused absences excluded)</div>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
        <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Attendance by Batch</h4>
        {summary.byBatch.length === 0 ? <p className="text-xs text-slate-400 py-8 text-center">No attendance recorded yet.</p> : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.byBatch} margin={{ top: 5, right: 10, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="batchName" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '11px' }} />
                <Bar dataKey="attendancePct" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {batchId && (
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <h4 className="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wide">Students Needing Attention (lowest attendance first)</h4>
          {summary.byStudent.length === 0 ? <p className="text-xs text-slate-400 py-8 text-center">No attendance recorded for this batch yet.</p> : (
            <div className="space-y-1.5">
              {summary.byStudent.map((s: any) => (
                <div key={s.studentProfileId} className="flex items-center justify-between px-3 py-2 bg-slate-50 rounded-lg text-xs">
                  <span className="font-medium text-slate-700">{s.name} {s.rollNumber && <span className="text-slate-400">({s.rollNumber})</span>}</span>
                  <span className={`font-bold ${s.attendancePct < 75 ? 'text-rose-600' : 'text-emerald-600'}`}>{s.attendancePct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AdminAttendance() {
  const [tab, setTab] = useState<MainTab>('mark');

  return (
    <div className="flex flex-col min-h-full bg-[#f8fafc]">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-100">
        <div className="max-w-[1700px] mx-auto">
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-indigo-500" /> Attendance</h1>
          <p className="text-xs text-slate-500 mt-0.5">Mark, review, and correct attendance — all real, all audit-logged</p>
          <div className="flex gap-1 mt-4">
            {(['mark', 'summary'] as MainTab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                {t === 'mark' ? <List className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
                {t === 'mark' ? 'Mark & Records' : 'Summary'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-[1700px] mx-auto w-full">
        {tab === 'mark' ? <MarkTab /> : <SummaryTab />}
      </div>
    </div>
  );
}
