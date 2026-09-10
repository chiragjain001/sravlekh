'use client';
// ─── FounderTickets — real backend ─────────────────────────────────────────
// Founder Console Phase 8 — a genuinely new subsystem: no backend existed
// for support tickets before this (only a mock UI with alert()-based fake
// actions). Real Prisma-backed CRUD, cross-tenant for Founder, audit-logged
// status/priority/assignment changes, and a real reply thread that reopens
// a resolved/closed ticket.

import { useState } from 'react';
import { Search, MessageSquare, X, Send, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useFounderTickets,
  useFounderTicketDetail,
  useUpdateTicketStatus,
  useUpdateTicketPriority,
  useAssignTicket,
  useReplyOnTicket,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-sky-50 text-sky-700',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-500',
};

const PRIORITY_STYLE: Record<string, string> = {
  URGENT: 'text-rose-600',
  HIGH: 'text-amber-600',
  MEDIUM: 'text-slate-600',
  LOW: 'text-slate-400',
};

interface TicketRow {
  id: string;
  subject: string;
  status: string;
  priority: string;
  assignedToUserId: string | null;
  createdAt: string;
  institute: { id: string; name: string };
}

export function FounderTickets() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params: Record<string, unknown> = {};
  if (search.trim()) params.search = search.trim();
  if (statusFilter) params.status = statusFilter;
  if (priorityFilter) params.priority = priorityFilter;

  const { data, isPending, isError } = useFounderTickets(params);
  const updateStatus = useUpdateTicketStatus();

  const rows: TicketRow[] = data?.data ?? [];

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Support Tickets</h2>
        <p className="text-xs text-slate-500 mt-0.5">Cross-tenant support ticket queue — every institute at once.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject or description..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-600">
          <option value="">Status: All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-600">
          <option value="">Priority: All</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {isPending && <SkeletonTable rows={8} cols={5} />}
      {isError && <EmptyState icon={<MessageSquare className="w-6 h-6" />} title="Couldn't load tickets" />}
      {!isPending && !isError && rows.length === 0 && <EmptyState icon={<MessageSquare className="w-6 h-6" />} title="No support tickets" description="Nothing raised yet — tickets appear here once an institute admin opens one." />}

      {!isPending && !isError && rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Subject</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Priority</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} onClick={() => setSelectedId(t.id)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer">
                  <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800 hover:text-indigo-600">{t.subject}</td>
                  <td className="px-4 py-3 text-[11.5px] text-slate-600">{t.institute.name}</td>
                  <td className={`px-4 py-3 text-[11px] font-bold ${PRIORITY_STYLE[t.priority]}`}>{t.priority}</td>
                  <td className="px-4 py-3">
                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateStatus.mutate({ id: t.id, status: e.target.value })}
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border-0 ${STATUS_STYLE[t.status]}`}
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TicketDetailDrawer ticketId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}

interface TicketMessage { id: string; authorUserId: string; body: string; createdAt: string }
interface TicketDetail extends TicketRow {
  description: string;
  createdByUserId: string;
  messages: TicketMessage[];
}

function TicketDetailDrawer({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) {
  const { data, isPending } = useFounderTicketDetail(ticketId);
  const detail = data as TicketDetail | undefined;
  const updatePriority = useUpdateTicketPriority();
  const assign = useAssignTicket();
  const reply = useReplyOnTicket();
  const [replyBody, setReplyBody] = useState('');
  const { user } = useAuth();

  if (!ticketId) return null;

  const submitReply = () => {
    if (!replyBody.trim()) return;
    reply.mutate({ id: ticketId, body: replyBody.trim() }, { onSuccess: () => setReplyBody('') });
  };

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-lg h-full bg-white shadow-2xl overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-[14px] font-bold text-slate-900">{detail?.subject ?? 'Ticket'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        {isPending && <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}

        {detail && (
          <>
            <div className="p-5 space-y-4 flex-1">
              <div className="flex items-center gap-3">
                <select
                  value={detail.priority}
                  onChange={(e) => updatePriority.mutate({ id: ticketId, priority: e.target.value })}
                  className="text-[11px] font-semibold border border-slate-200 rounded-lg px-2 py-1"
                >
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <span className="text-[11.5px] text-slate-400">{detail.institute.name}</span>
              </div>

              <p className="text-[13px] text-slate-700 bg-slate-50 rounded-lg p-3">{detail.description}</p>

              {!detail.assignedToUserId && user && (
                <button
                  onClick={() => assign.mutate({ id: ticketId, assignedToUserId: user.id })}
                  disabled={assign.isPending}
                  className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Assign to me
                </button>
              )}

              <div>
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Thread ({detail.messages.length})</h4>
                <ul className="space-y-2">
                  {detail.messages.map((m) => (
                    <li key={m.id} className="text-[12.5px] text-slate-700 bg-slate-50 rounded-lg p-2.5">
                      <div className="text-[10.5px] text-slate-400 mb-1">{new Date(m.createdAt).toLocaleString()}</div>
                      {m.body}
                    </li>
                  ))}
                  {detail.messages.length === 0 && <p className="text-[11.5px] text-slate-400">No replies yet.</p>}
                </ul>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center gap-2">
              <input
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitReply()}
                placeholder="Reply..."
                className="flex-1 text-[12.5px] border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button onClick={submitReply} disabled={reply.isPending || !replyBody.trim()} className="p-2 rounded-lg bg-indigo-600 text-white disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
