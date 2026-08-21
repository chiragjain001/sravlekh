'use client';
// ─── AdminExams — Exam Workflow ────────────────────────────────────────────
// Real backend from day one: the 7-stage exam state machine
// (DRAFT -> REVIEW -> APPROVED -> PUBLISHED -> ONGOING -> EVALUATING -> LOCKED,
// with admin-only unlock as the sole backward transition) per
// 02-SYSTEM-ARCHITECTURE.md / 03-FEATURE-SPECIFICATIONS.md / 18-EDGE-CASES.md.

import { useState } from 'react';
import { Plus, Search, ArrowRight, Unlock, ClipboardList, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useExams, useBatches, useBlueprints,
  useCreateExam, useUpdateExamStatus, useUnlockExam,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

type ExamStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ONGOING' | 'EVALUATING' | 'LOCKED';

const EXAM_TYPES = [
  'UNIT_TEST', 'CHAPTER_TEST', 'WEEKLY_TEST', 'MONTHLY_TEST',
  'MOCK_TEST', 'REVISION_TEST', 'PRE_BOARD', 'SUBJECT_TEST', 'PRACTICE_TEST',
];

const NEXT_STATUS: Record<ExamStatus, ExamStatus | null> = {
  DRAFT: 'REVIEW',
  REVIEW: 'APPROVED',
  APPROVED: 'PUBLISHED',
  PUBLISHED: 'ONGOING',
  ONGOING: 'EVALUATING',
  EVALUATING: 'LOCKED',
  LOCKED: null,
};

const STATUS_STYLE: Record<ExamStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  REVIEW: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-sky-50 text-sky-700',
  PUBLISHED: 'bg-indigo-50 text-indigo-700',
  ONGOING: 'bg-violet-50 text-violet-700',
  EVALUATING: 'bg-orange-50 text-orange-700',
  LOCKED: 'bg-emerald-50 text-emerald-700',
};

interface ExamRow {
  id: string;
  title: string;
  type: string;
  status: ExamStatus;
  version: number;
  scheduledDate?: string | null;
  durationMinutes?: number | null;
  batch?: { id: string; name: string };
  blueprint?: { id: string; name: string; totalMarks: number };
}

export function AdminExams() {
  const { user } = useAuth();
  const canApprove = user?.role === 'ADMIN' || user?.role === 'FOUNDER';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<ExamRow | null>(null);

  const { data, isPending, isError } = useExams(statusFilter ? { status: statusFilter } : undefined);
  const updateStatus = useUpdateExamStatus();

  const exams: ExamRow[] = data ?? [];
  const visibleExams = search.trim()
    ? exams.filter((e) => e.title.toLowerCase().includes(search.trim().toLowerCase()))
    : exams;

  function handleAdvance(exam: ExamRow) {
    const next = NEXT_STATUS[exam.status];
    if (!next) return;
    updateStatus.mutate({ examId: exam.id, status: next, version: exam.version });
  }

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Exams</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Schedule exams from a blueprint and move them through review, approval, and evaluation.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Schedule Exam
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams by title..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="">All statuses</option>
          {Object.keys(STATUS_STYLE).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {isPending && <SkeletonTable rows={6} cols={5} />}

      {isError && (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title="Couldn't load exams"
          description="Something went wrong fetching exams. Try refreshing the page."
        />
      )}

      {!isPending && !isError && visibleExams.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6" />}
          title="No exams yet"
          description="Schedule an exam from an existing blueprint to get started."
          action={{ label: 'Schedule Exam', onClick: () => setCreateOpen(true) }}
        />
      )}

      {!isPending && !isError && visibleExams.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Batch</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Scheduled</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleExams.map((exam) => {
                const next = NEXT_STATUS[exam.status];
                const approvalBlocked = next === 'APPROVED' && !canApprove;
                return (
                  <tr key={exam.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">{exam.title}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{exam.batch?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[11.5px] text-slate-600">{exam.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">
                      {exam.scheduledDate ? new Date(exam.scheduledDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[exam.status]}`}>
                        {exam.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {next && (
                          <button
                            onClick={() => handleAdvance(exam)}
                            disabled={approvalBlocked || updateStatus.isPending}
                            title={approvalBlocked ? 'Only admins can approve an exam' : `Move to ${next}`}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                            {next}
                          </button>
                        )}
                        {exam.status === 'LOCKED' && canApprove && (
                          <button
                            onClick={() => setUnlockTarget(exam)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-rose-700 bg-rose-50 rounded-md hover:bg-rose-100 transition-colors"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Unlock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateExamDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <UnlockExamDialog exam={unlockTarget} onClose={() => setUnlockTarget(null)} />
    </div>
  );
}

// ─── Create Exam (from a Blueprint) ────────────────────────────────────────

function CreateExamDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: batches } = useBatches();
  const { data: blueprints } = useBlueprints();
  const createExam = useCreateExam();

  const [title, setTitle] = useState('');
  const [batchId, setBatchId] = useState('');
  const [blueprintId, setBlueprintId] = useState('');
  const [type, setType] = useState(EXAM_TYPES[0]);
  const [scheduledDate, setScheduledDate] = useState('');

  if (!isOpen) return null;

  function reset() {
    setTitle(''); setBatchId(''); setBlueprintId(''); setType(EXAM_TYPES[0]); setScheduledDate('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !batchId || !blueprintId) return;
    createExam.mutate(
      {
        title: title.trim(),
        batchId,
        blueprintId,
        type,
        ...(scheduledDate ? { scheduledDate: new Date(scheduledDate).toISOString() } : {}),
      },
      { onSuccess: () => { reset(); onClose(); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Schedule Exam</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly Test 12"
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Batch</label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Select a batch</option>
              {(batches ?? []).map((b: { id: string; name: string }) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Blueprint</label>
            <select
              value={blueprintId}
              onChange={(e) => setBlueprintId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="">Select a blueprint</option>
              {(blueprints ?? []).map((bp: { id: string; name: string }) => (
                <option key={bp.id} value={bp.id}>{bp.name}</option>
              ))}
            </select>
            {blueprints?.length === 0 && (
              <p className="text-[11px] text-slate-400 mt-1">No blueprints yet — create one under Papers first.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
              >
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Scheduled Date</label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
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
              disabled={createExam.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createExam.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Unlock (LOCKED -> EVALUATING, admin-only, reason required) ───────────

function UnlockExamDialog({ exam, onClose }: { exam: ExamRow | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const unlockExam = useUnlockExam();

  if (!exam) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exam || reason.trim().length < 10) return;
    unlockExam.mutate(
      { examId: exam.id, reason: reason.trim(), version: exam.version },
      { onSuccess: () => { setReason(''); onClose(); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Unlock "{exam.title}"</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <p className="text-[12.5px] text-slate-600 leading-relaxed">
            This reopens the exam for evaluation so grades can change again. It's audited — give a reason (at least 10 characters).
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Score dispute raised by a parent — re-evaluating Q4"
            rows={3}
            required
            minLength={10}
            className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={unlockExam.isPending || reason.trim().length < 10}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50"
            >
              {unlockExam.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
