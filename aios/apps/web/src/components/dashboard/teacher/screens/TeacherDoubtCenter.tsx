'use client';

import { useState } from 'react';
import { Search, MessageCircle, CheckCircle2, Clock, Send } from 'lucide-react';
import { useDoubts, useResolveDoubt } from '@/hooks/useApi';

type StatusFilter   = 'All' | 'pending' | 'resolved';
type PriorityFilter = 'All' | 'high' | 'medium' | 'low';

const priorityStyle = (p: string) => ({
  high:   'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-slate-100 text-slate-500',
}[p] ?? 'bg-slate-100 text-slate-500');

const RESOLVED_STATUSES = new Set(['ANSWERED', 'CLOSED']);
const urgencyToPriority = (u: number) => (u >= 3 ? 'high' : u === 2 ? 'medium' : 'low');

interface DisplayDoubt {
  id: string;
  studentName: string;
  topic: string;
  question: string;
  askedAt: string;
  priority: string;
  status: 'pending' | 'resolved';
  responseText: string | null;
}

export function TeacherDoubtCenter() {
  const [statusF,   setStatusF]   = useState<StatusFilter>('All');
  const [priorityF, setPriorityF] = useState<PriorityFilter>('All');
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<string | null>(null);
  const [reply,     setReply]     = useState('');

  const { data: doubtsResp, isLoading } = useDoubts();
  const resolveDoubt = useResolveDoubt();
  const doubts: DisplayDoubt[] = (doubtsResp?.data ?? []).map((d: any) => ({
    id: d.id,
    studentName: d.studentProfile?.user?.name ?? 'Unknown Student',
    topic: d.subject?.name ?? 'General',
    question: d.content,
    askedAt: new Date(d.createdAt).toLocaleString(),
    priority: urgencyToPriority(d.urgency),
    status: RESOLVED_STATUSES.has(d.status) ? 'resolved' : 'pending',
    responseText: d.responseText,
  }));

  const filtered = doubts.filter((d) => {
    const matchStatus   = statusF   === 'All' || d.status === statusF;
    const matchPriority = priorityF === 'All' || d.priority === priorityF;
    const matchSearch   = search === '' ||
      d.studentName.toLowerCase().includes(search.toLowerCase()) ||
      d.topic.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPriority && matchSearch;
  });

  const selectedDoubt = doubts.find((d) => d.id === selected);

  const handleResolve = () => {
    if (selected && reply.trim()) {
      resolveDoubt.mutate(
        { doubtId: selected, data: { resolutionText: reply.trim() } },
        { onSuccess: () => setReply('') },
      );
    }
  };

  const pending  = doubts.filter((d) => d.status === 'pending').length;
  const total    = doubts.length;
  const resCount = doubts.filter((d) => d.status === 'resolved').length;

  return (
    <div className="p-6 animate-fadein space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Doubt Center</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">View and resolve doubts from students across your batches.</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: total,    color: 'text-slate-800'   },
          { label: 'Pending',  value: pending,  color: pending > 0 ? 'text-rose-600' : 'text-slate-800' },
          { label: 'Resolved', value: resCount, color: 'text-emerald-600' },
        ].map((k, i) => (
          <div key={i} className="card border border-slate-100 rounded-2xl p-5">
            <p className="text-[11px] font-medium text-slate-500">{k.label}</p>
            <p className={`text-[24px] font-black leading-tight mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* ── Doubt list ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div role="tablist" aria-label="Doubt status filters" className="flex gap-1">
              {(['All', 'pending', 'resolved'] as StatusFilter[]).map(f => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={statusF === f}
                  onClick={() => setStatusF(f)}
                  className={`px-3 py-1.5 text-[12px] font-bold rounded-xl capitalize transition-all ${
                    statusF === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="w-px h-5 bg-slate-200 self-center" />
            <div role="tablist" aria-label="Doubt priority filters" className="flex gap-1">
              {(['All', 'high', 'medium', 'low'] as PriorityFilter[]).map(p => (
                <button
                  key={p}
                  role="tab"
                  aria-selected={priorityF === p}
                  onClick={() => setPriorityF(p)}
                  className={`px-3 py-1.5 text-[12px] font-bold rounded-xl capitalize transition-all ${
                    priorityF === p ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by student or topic..."
              className="w-full pl-9 pr-4 py-2 text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
          </div>

          <div className="space-y-2">
            {isLoading ? (
              <div className="py-10 text-center text-slate-400 text-[13px]">Loading doubts…</div>
            ) : (
              <>
                {filtered.map(d => {
                  const res = d.status === 'resolved';
                  return (
                    <button key={d.id} onClick={() => setSelected(d.id === selected ? null : d.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selected === d.id ? 'border-indigo-200 bg-indigo-50/40' :
                        res ? 'border-slate-100 bg-slate-50/50 opacity-70' : 'border-slate-100 hover:border-slate-200'
                      }`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-black">
                            {d.studentName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-[12.5px] font-bold text-slate-800">{d.studentName}</span>
                        </div>
                        {res
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          : <Clock        className="w-3.5 h-3.5 text-amber-500"    />
                        }
                      </div>
                      <p className="text-[12px] font-semibold text-indigo-600 mb-1">{d.topic}</p>
                      <p className="text-[11.5px] text-slate-600 line-clamp-2 leading-snug">{d.question}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-slate-400">{d.askedAt}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${priorityStyle(d.priority)}`}>{d.priority}</span>
                      </div>
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-10 text-center text-slate-400">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-[13px]">No doubts match your filters.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Reply panel ────────────────────────────────────────────────── */}
        <div className="xl:col-span-3">
          {!selectedDoubt ? (
            <div className="flex items-center justify-center h-full min-h-[360px] rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
              <div className="text-center">
                <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-[13px] font-semibold">Select a doubt to view and reply</p>
              </div>
            </div>
          ) : (
            <div className="card border border-slate-100 rounded-2xl overflow-hidden animate-fadein flex flex-col h-full">
              {/* Doubt header */}
              <div className="p-5 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[12px] font-black">
                    {selectedDoubt.studentName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">{selectedDoubt.studentName}</p>
                    <p className="text-[11px] text-slate-500">{selectedDoubt.askedAt}</p>
                  </div>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded capitalize ${priorityStyle(selectedDoubt.priority)}`}>
                    {selectedDoubt.priority} priority
                  </span>
                </div>
                <div className="bg-white border border-slate-100 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-indigo-600 mb-2">{selectedDoubt.topic}</p>
                  <p className="text-[13px] text-slate-700 leading-relaxed">{selectedDoubt.question}</p>
                </div>
              </div>

              {/* Reply area */}
              <div className="p-5 flex flex-col gap-4 flex-1">
                {selectedDoubt.status === 'resolved' ? (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-bold text-emerald-800">Doubt Resolved</p>
                      {selectedDoubt.responseText && (
                        <p className="text-[12px] text-emerald-700 mt-1">{selectedDoubt.responseText}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[13px] font-bold text-slate-700">Your Reply</p>
                    <textarea rows={6} value={reply} onChange={e => setReply(e.target.value)}
                      placeholder="Type your answer or explanation here..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400" />
                    <button onClick={handleResolve} disabled={!reply.trim() || resolveDoubt.isPending}
                      className="flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold text-[13px] rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                      <Send className="w-4 h-4" /> {resolveDoubt.isPending ? 'Sending…' : 'Send Reply & Mark Resolved'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
