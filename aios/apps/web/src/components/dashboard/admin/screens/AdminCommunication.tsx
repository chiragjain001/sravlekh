'use client';
// ─── AdminCommunication — Notice Center ────────────────────────────────────
// Real backend: broadcast is queued (IN_APP delivers immediately; EMAIL/SMS/
// WHATSAPP need a provider that isn't configured in this environment, so
// those deliveries land as FAILED "provider_not_configured" rather than a
// faked SENT — see NoticeDispatchProcessor).

import { useState } from 'react';
import { Plus, Search, Send, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { useNotices, useCreateNotice, useNoticeDeliveryReport, useBatches, useDeleteNotice } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'];
const STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-600',
  SENT: 'bg-emerald-50 text-emerald-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose-50 text-rose-700',
  READ: 'bg-indigo-50 text-indigo-700',
};

interface NoticeRow {
  id: string;
  title: string;
  channels: string[];
  createdAt: string;
  _count?: { deliveries: number };
}

export function AdminCommunication() {
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<NoticeRow | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<NoticeRow | null>(null);
  const deleteNotice = useDeleteNotice();

  const { data, isPending, isError } = useNotices();
  const notices: NoticeRow[] = data?.data ?? [];
  const visible = search.trim()
    ? notices.filter((n) => n.title.toLowerCase().includes(search.trim().toLowerCase()))
    : notices;

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Notice Center</h2>
          <p className="text-xs text-slate-500 mt-0.5">Broadcast notices to students, batches, or staff across channels.</p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> New Notice
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search notices by title..."
          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {isPending && <SkeletonTable rows={6} cols={4} />}

      {isError && (
        <EmptyState icon={<Megaphone className="w-6 h-6" />} title="Couldn't load notices" description="Something went wrong. Try refreshing the page." />
      )}

      {!isPending && !isError && visible.length === 0 && (
        <EmptyState
          icon={<Megaphone className="w-6 h-6" />}
          title="No notices sent yet"
          description="Broadcast your first notice to students, a batch, or staff."
          action={{ label: 'New Notice', onClick: () => setCreateOpen(true) }}
        />
      )}

      {!isPending && !isError && visible.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Channels</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Recipients</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Sent</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((n) => (
                <tr key={n.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">{n.title}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {n.channels.map((c) => (
                        <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{n._count?.deliveries ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{new Date(n.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button onClick={() => setReportTarget(n)} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                        Delivery Report
                      </button>
                      <button
                        onClick={() => setWithdrawTarget(n)}
                        title="Withdraw this notice"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateNoticeDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      {withdrawTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-[16px] font-bold text-slate-800">Withdraw this notice?</h2>
            </div>
            <p className="text-[13px] text-slate-600">
              <b>{withdrawTarget.title}</b> and its {withdrawTarget._count?.deliveries ?? 0} recipient
              {(withdrawTarget._count?.deliveries ?? 0) === 1 ? '' : 's'} will be removed. It will no longer appear in anyone's notifications.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={async () => { await deleteNotice.mutateAsync(withdrawTarget.id); setWithdrawTarget(null); }}
                disabled={deleteNotice.isPending}
                className="flex-1 py-2.5 bg-rose-600 text-white text-[13px] font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50"
              >
                {deleteNotice.isPending ? 'Withdrawing…' : 'Withdraw Notice'}
              </button>
              <button onClick={() => setWithdrawTarget(null)} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors">
                Keep It
              </button>
            </div>
          </div>
        </div>
      )}

      <DeliveryReportDialog notice={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

// ─── Create Notice ──────────────────────────────────────────────────────────

function CreateNoticeDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const isTeacher = user?.role === 'TEACHER';
  const { data: batches } = useBatches();
  const createNotice = useCreateNotice();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [channels, setChannels] = useState<string[]>(['IN_APP']);
  const [batchId, setBatchId] = useState('');

  if (!isOpen) return null;

  function toggleChannel(c: string) {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  function reset() {
    setTitle(''); setBody(''); setChannels(['IN_APP']); setBatchId('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !body.trim() || channels.length === 0) return;
    const targetAudience = batchId
      ? { batchIds: [batchId] }
      : { roles: ['STUDENT'] }; // ADMIN default broadcast; teachers must pick a batch
    createNotice.mutate(
      { title: title.trim(), body: body.trim(), channels, targetAudience },
      { onSuccess: () => { reset(); onClose(); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">New Notice</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Diwali Break Schedule"
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              required
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">
              Batch {isTeacher ? '(required — you can only notify your own batches)' : '(optional — leave blank to notify all students)'}
            </label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} required={isTeacher} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
              <option value="">{isTeacher ? 'Select a batch' : 'All students'}</option>
              {(batches ?? []).map((b: { id: string; name: string }) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Channels</label>
            <div className="flex gap-2 flex-wrap">
              {CHANNELS.map((c) => (
                <button
                  key={c} type="button" onClick={() => toggleChannel(c)}
                  className={`px-2.5 py-1.5 text-[11px] font-semibold rounded-md border transition-colors ${
                    channels.includes(c) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {c.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {channels.some((c) => c !== 'IN_APP') && (
              <p className="text-[11px] text-amber-600 mt-1.5">Email/SMS/WhatsApp providers aren't configured in this environment — those deliveries will show as failed.</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createNotice.isPending || channels.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {createNotice.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Broadcast
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delivery Report ────────────────────────────────────────────────────────

function DeliveryReportDialog({ notice, onClose }: { notice: NoticeRow | null; onClose: () => void }) {
  const { data } = useNoticeDeliveryReport(notice?.id ?? null);

  if (!notice) return null;

  const deliveries: { id: string; channel: string; status: string; failureReason?: string | null }[] = data?.deliveries ?? [];
  const summary: Record<string, number> = data?.summary ?? {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Delivery Report — {notice.title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex gap-2 flex-wrap">
            {Object.entries(summary).map(([status, count]) => (
              <span key={status} className={`text-[10.5px] font-bold px-2.5 py-1 rounded-md ${STATUS_STYLE[status] ?? 'bg-slate-100 text-slate-600'}`}>
                {status}: {count}
              </span>
            ))}
          </div>
          <div className="divide-y divide-slate-50 border border-slate-100 rounded-lg overflow-hidden">
            {deliveries.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-3 py-2 text-[12px]">
                <span className="text-slate-600">{d.channel}</span>
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[d.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {d.status}{d.failureReason ? ` — ${d.failureReason}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
