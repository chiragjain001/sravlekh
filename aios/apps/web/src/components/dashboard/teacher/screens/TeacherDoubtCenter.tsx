'use client';

import { useState } from 'react';
import {
  Search,
  MessageCircle,
  CheckCircle2,
  Clock,
  Send,
  X,
  Sparkles,
  CornerDownRight,
  ArrowLeft,
  User,
  SlidersHorizontal,
} from 'lucide-react';
import { useDoubts, useResolveDoubt } from '@/hooks/useApi';

type StatusFilter   = 'All' | 'pending' | 'resolved';
type PriorityFilter = 'All' | 'high' | 'medium' | 'low';

const priorityStyle = (p: string) => ({
  high:   'bg-rose-50 text-rose-700 border-rose-200/80',
  medium: 'bg-amber-50 text-amber-700 border-amber-200/80',
  low:    'bg-slate-100 text-slate-600 border-slate-200/80',
}[p] ?? 'bg-slate-100 text-slate-600 border-slate-200/80');

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
  isFollowUp: boolean;
}

export function TeacherDoubtCenter() {
  const [statusF,   setStatusF]   = useState<StatusFilter>('All');
  const [priorityF, setPriorityF] = useState<PriorityFilter>('All');
  const [search,    setSearch]    = useState('');
  const [selected,  setSelected]  = useState<string | null>(null);
  const [reply,     setReply]     = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  const { data: doubtsResp, isLoading } = useDoubts();
  const resolveDoubt = useResolveDoubt();
  
  const doubts: DisplayDoubt[] = (doubtsResp?.data ?? []).map((d: any) => {
    const rawContent = d.content ?? '';
    const isFollowUp = rawContent.startsWith('[Follow-up to:');
    return {
      id: d.id,
      studentName: d.studentProfile?.user?.name ?? 'Unknown Student',
      topic: d.subject?.name ?? 'General',
      question: rawContent,
      askedAt: new Date(d.createdAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      priority: urgencyToPriority(d.urgency),
      status: RESOLVED_STATUSES.has(d.status) ? 'resolved' : 'pending',
      responseText: d.responseText,
      isFollowUp,
    };
  });

  const filtered = doubts.filter((d) => {
    const matchStatus   = statusF   === 'All' || d.status === statusF;
    const matchPriority = priorityF === 'All' || d.priority === priorityF;
    const matchSearch   = search === '' ||
      d.studentName.toLowerCase().includes(search.toLowerCase()) ||
      d.topic.toLowerCase().includes(search.toLowerCase()) ||
      d.question.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchPriority && matchSearch;
  });

  const selectedDoubt = doubts.find((d) => d.id === selected);

  const handleSelectDoubt = (id: string) => {
    setSelected(id);
    setReply('');
    setIsEditing(false);
    setIsMobileModalOpen(true);
  };

  const handleResolve = () => {
    if (selected && reply.trim()) {
      resolveDoubt.mutate(
        { doubtId: selected, data: { resolutionText: reply.trim() } },
        {
          onSuccess: () => {
            setReply('');
            setIsEditing(false);
            setIsMobileModalOpen(false);
          },
        },
      );
    }
  };

  const pending  = doubts.filter((d) => d.status === 'pending').length;
  const total    = doubts.length;
  const resCount = doubts.filter((d) => d.status === 'resolved').length;

  // Helper to cleanly render question with follow-up header if applicable
  const renderQuestionContent = (content: string) => {
    if (content.startsWith('[Follow-up to:')) {
      const parts = content.split('\n\n');
      const followUpHeader = parts[0];
      const actualQuestion = parts.slice(1).join('\n\n') || content;
      return (
        <div className="space-y-2">
          <div className="p-2.5 rounded-xl bg-purple-50/90 border border-purple-200/80 text-[11.5px] text-purple-800 font-medium">
            <div className="flex items-center gap-1.5 font-bold mb-0.5">
              <CornerDownRight className="w-3.5 h-3.5 text-purple-600" />
              <span>Reference Context:</span>
            </div>
            <p className="italic">{followUpHeader}</p>
          </div>
          <p className="text-[13px] text-slate-800 leading-relaxed font-medium">{actualQuestion}</p>
        </div>
      );
    }
    return <p className="text-[13px] text-slate-800 leading-relaxed font-medium">{content}</p>;
  };

  return (
    <div className="p-3.5 sm:p-5 md:p-6 animate-fadein space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-slate-900 tracking-tight">Doubt Center</h1>
          <p className="text-[12px] sm:text-[13px] text-slate-500 mt-0.5">
            Review student questions, reply directly, and track follow-up discussions.
          </p>
        </div>
      </div>

      {/* Apple-Style Glassy KPI Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {[
          {
            label: 'Total Doubts',
            value: total,
            badge: `${total}`,
            bg: 'bg-white',
            border: 'border-slate-200/70',
            color: 'text-slate-900',
            sub: 'All time',
          },
          {
            label: 'Pending',
            value: pending,
            badge: pending > 0 ? 'Needs Action' : 'Cleared',
            bg: pending > 0 ? 'bg-rose-50/30' : 'bg-white',
            border: pending > 0 ? 'border-rose-200/80' : 'border-slate-200/70',
            color: pending > 0 ? 'text-rose-600' : 'text-slate-800',
            sub: pending > 0 ? 'Awaiting reply' : 'All caught up',
          },
          {
            label: 'Resolved',
            value: resCount,
            badge: total > 0 ? `${Math.round((resCount / total) * 100)}%` : '100%',
            bg: 'bg-white',
            border: 'border-slate-200/70',
            color: 'text-emerald-600',
            sub: 'Answered',
          },
        ].map((k, i) => (
          <div
            key={i}
            className={`card ${k.bg} border ${k.border} rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-sm transition-all`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10.5px] sm:text-[12px] font-bold text-slate-500 truncate">{k.label}</p>
              <span className="hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {k.badge}
              </span>
            </div>
            <p className={`text-[20px] sm:text-[26px] font-black leading-tight mt-1 sm:mt-1.5 ${k.color}`}>
              {k.value}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 hidden xs:block">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* ── Doubt list Column ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-3.5">
          {/* Apple-Style Segmented Control for Status */}
          <div className="bg-slate-100/90 p-1 rounded-2xl flex items-center border border-slate-200/60 shadow-2xs">
            {(['All', 'pending', 'resolved'] as StatusFilter[]).map((f) => {
              const isSel = statusF === f;
              const count = f === 'All' ? total : f === 'pending' ? pending : resCount;
              return (
                <button
                  key={f}
                  role="tab"
                  aria-selected={isSel}
                  onClick={() => setStatusF(f)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 sm:px-3 text-[12px] sm:text-[12.5px] font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                    isSel
                      ? 'bg-white text-slate-900 shadow-sm shadow-slate-200/70 scale-[1.01]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span className="capitalize">{f}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold transition-colors ${
                      isSel
                        ? f === 'pending' && pending > 0
                          ? 'bg-rose-100 text-rose-700'
                          : f === 'resolved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200/70 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Priority Pill Filters & Search Toolbar */}
          <div className="space-y-2.5">
            {/* Priority Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              <span className="text-[11px] font-bold text-slate-400 pl-1 pr-1 flex items-center gap-1 flex-shrink-0">
                <SlidersHorizontal className="w-3 h-3 text-slate-400" />
                Priority:
              </span>
              {(['All', 'high', 'medium', 'low'] as PriorityFilter[]).map((p) => {
                const isSel = priorityF === p;
                const dotColor =
                  p === 'high'
                    ? 'bg-rose-500'
                    : p === 'medium'
                    ? 'bg-amber-500'
                    : p === 'low'
                    ? 'bg-slate-400'
                    : 'bg-indigo-500';

                return (
                  <button
                    key={p}
                    onClick={() => setPriorityF(p)}
                    className={`px-3 py-1 text-[11.5px] font-bold rounded-full border transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      isSel
                        ? p === 'high'
                          ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                          : p === 'medium'
                          ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                          : p === 'low'
                          ? 'bg-slate-200 border-slate-300 text-slate-800 shadow-2xs'
                          : 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                        : 'bg-white/80 border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                    <span className="capitalize">{p === 'All' ? 'All Priorities' : p}</span>
                  </button>
                );
              })}
            </div>

            {/* iOS-Style Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student, topic, or question..."
                className="w-full pl-9 pr-9 py-2.5 text-[12.5px] bg-slate-50/90 border border-slate-200/80 rounded-2xl placeholder:text-slate-400 text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-2xs"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Doubt Cards Stream */}
          <div className="space-y-2.5">
            {isLoading ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[12.5px] font-medium">Loading doubts…</p>
              </div>
            ) : (
              <>
                {filtered.map((d) => {
                  const res = d.status === 'resolved';
                  const isSelected = selected === d.id;

                  return (
                    <div
                      key={d.id}
                      onClick={() => handleSelectDoubt(d.id)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all duration-150 cursor-pointer shadow-2xs ${
                        isSelected
                          ? 'border-indigo-400 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                          : res
                          ? 'border-slate-200/70 bg-white/70 hover:border-slate-300'
                          : 'border-slate-200/90 bg-white hover:border-indigo-200 hover:shadow-sm'
                      }`}
                    >
                      {/* Header Row: Student + Status Badge */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9.5px] font-black flex-shrink-0">
                            {d.studentName.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="text-[13px] font-bold text-slate-800 truncate">{d.studentName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {d.isFollowUp && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/70">
                              <CornerDownRight className="w-3 h-3 text-purple-600" /> Follow-up
                            </span>
                          )}
                          {res ? (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-amber-600" /> Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Subject Tag */}
                      <div className="mb-1.5">
                        <span className="text-[11.5px] font-bold text-indigo-600">{d.topic}</span>
                      </div>

                      {/* Question Preview */}
                      <p className="text-[12px] text-slate-600 line-clamp-2 leading-relaxed mb-2.5">
                        {d.isFollowUp
                          ? d.question.replace(/^\[Follow-up to:[^\]]*\]\s*/i, '')
                          : d.question}
                      </p>

                      {/* Footer Row: Timestamp + Priority */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10.5px]">
                        <span className="text-slate-400 font-medium">{d.askedAt}</span>
                        <span className={`font-bold px-2 py-0.5 rounded-md border capitalize ${priorityStyle(d.priority)}`}>
                          {d.priority}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filtered.length === 0 && (
                  <div className="py-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-6">
                    <MessageCircle className="w-9 h-9 mx-auto mb-2 text-slate-300" />
                    <p className="text-[13px] font-bold text-slate-600">No doubts found</p>
                    <p className="text-[11.5px] text-slate-400 mt-0.5">
                      Try adjusting your status, priority, or search query.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Desktop Reply & Details Panel (>= xl) ───────────────────────── */}
        <div className="hidden xl:block xl:col-span-3 sticky top-6">
          {!selectedDoubt ? (
            <div className="flex flex-col items-center justify-center min-h-[420px] rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/40 text-slate-400 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                <MessageCircle className="w-6 h-6 text-indigo-500 opacity-80" />
              </div>
              <p className="text-[14px] font-bold text-slate-700">Select a doubt to review and reply</p>
              <p className="text-[12px] text-slate-400 max-w-xs mt-1">
                Choose any pending or resolved student question from the list on the left.
              </p>
            </div>
          ) : (
            <div className="card bg-white border border-slate-200/80 rounded-3xl overflow-hidden shadow-sm animate-fadein flex flex-col">
              {/* Card Header */}
              <div className="p-5 bg-gradient-to-b from-slate-50 to-white border-b border-slate-100">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-[12px] font-black shadow-2xs">
                      {selectedDoubt.studentName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-900">{selectedDoubt.studentName}</p>
                      <p className="text-[11.5px] text-slate-400 font-medium">{selectedDoubt.askedAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedDoubt.isFollowUp && (
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200">
                        Follow-up Question
                      </span>
                    )}
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border capitalize ${priorityStyle(selectedDoubt.priority)}`}>
                      {selectedDoubt.priority} Priority
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100">
                      {selectedDoubt.topic}
                    </span>
                  </div>
                  {renderQuestionContent(selectedDoubt.question)}
                </div>
              </div>

              {/* Reply Section */}
              <div className="p-5 flex flex-col gap-4">
                {selectedDoubt.status === 'resolved' ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl">
                      <div className="flex items-center gap-2 text-emerald-800 font-bold text-[13px] mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Resolution Provided</span>
                      </div>
                      <p className="text-[13px] text-emerald-950 whitespace-pre-wrap leading-relaxed">
                        {selectedDoubt.responseText || 'Marked as resolved.'}
                      </p>
                    </div>

                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between text-[12px] text-slate-500">
                      <span>Want to update your answer or provide more clarity?</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(true);
                          setReply(selectedDoubt.responseText ?? '');
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                      >
                        Edit Answer
                      </button>
                    </div>

                    {isEditing && (
                      <div className="space-y-3 pt-2 animate-fadein">
                        <label className="text-[12.5px] font-bold text-slate-700">Update Answer</label>
                        <textarea
                          rows={4}
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Type updated explanation..."
                          className="w-full p-3.5 border border-slate-200 rounded-2xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false);
                              setReply('');
                            }}
                            className="px-3 py-1.5 text-[12px] text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleResolve}
                            disabled={resolveDoubt.isPending || !reply.trim()}
                            className="px-4 py-2 bg-indigo-600 text-white font-bold text-[12.5px] rounded-xl hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {resolveDoubt.isPending ? 'Updating...' : 'Save Updated Answer'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-indigo-600" />
                        <span>Your Reply & Resolution</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Sent instantly to the student</span>
                    </div>
                    <textarea
                      rows={6}
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Type your explanation, formula derivations, step-by-step guidance, or learning tips here..."
                      className="w-full p-4 border border-slate-200/90 rounded-2xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all placeholder:text-slate-400 leading-relaxed shadow-2xs"
                    />
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={handleResolve}
                        disabled={!reply.trim() || resolveDoubt.isPending}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-[13px] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                      >
                        {resolveDoubt.isPending ? (
                          <>
                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" /> Send Reply & Mark Resolved
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile & Tablet Detail & Reply Modal Drawer (< xl) ──────────── */}
      {isMobileModalOpen && selectedDoubt && (
        <div className="xl:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadein">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl max-h-[90dvh] sm:max-h-[85vh] flex flex-col overflow-hidden animate-slide-up border border-slate-100">
            {/* Modal Header */}
            <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setIsMobileModalOpen(false)}
                  className="p-1.5 text-slate-500 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-slate-900 truncate">{selectedDoubt.studentName}</p>
                  <p className="text-[11px] text-slate-500 truncate">{selectedDoubt.topic} • {selectedDoubt.askedAt}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border capitalize ${priorityStyle(selectedDoubt.priority)}`}>
                  {selectedDoubt.priority}
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex-1 space-y-4 overscroll-contain">
              {/* Question */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {selectedDoubt.topic}
                  </span>
                  {selectedDoubt.isFollowUp && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
                      Follow-up
                    </span>
                  )}
                </div>
                {renderQuestionContent(selectedDoubt.question)}
              </div>

              {/* Resolution or Reply Box */}
              {selectedDoubt.status === 'resolved' ? (
                <div className="space-y-3.5">
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-[13px] mb-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Resolution Provided</span>
                    </div>
                    <p className="text-[13px] text-emerald-950 whitespace-pre-wrap leading-relaxed">
                      {selectedDoubt.responseText || 'Marked as resolved.'}
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between gap-2 text-[12px] text-slate-500">
                    <span className="leading-snug">Want to update your answer or provide more clarity?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        setReply(selectedDoubt.responseText ?? '');
                      }}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer shrink-0 py-1 px-2 rounded-lg hover:bg-indigo-50 transition-colors"
                    >
                      Edit Answer
                    </button>
                  </div>

                  {isEditing && (
                    <div className="space-y-3 pt-1 animate-fadein">
                      <div className="flex items-center justify-between">
                        <label className="text-[12.5px] font-bold text-slate-700">Update Answer</label>
                        <span className="text-[11px] text-slate-400 font-medium">Editing previous reply</span>
                      </div>
                      <textarea
                        rows={4}
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Type updated explanation..."
                        className="w-full p-3.5 border border-slate-200 rounded-2xl text-[16px] sm:text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all placeholder:text-slate-400 leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[12.5px] font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Your Answer</span>
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">Sent to student</span>
                  </div>
                  <textarea
                    rows={4}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Type your explanation, formula derivations, step-by-step guidance, or learning tips here..."
                    className="w-full p-3.5 border border-slate-200 rounded-2xl text-[16px] sm:text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all placeholder:text-slate-400 leading-relaxed shadow-2xs"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/90 shrink-0 flex items-center justify-end gap-2">
              {selectedDoubt.status !== 'resolved' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMobileModalOpen(false)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-200/60 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={!reply.trim() || resolveDoubt.isPending}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-[12.5px] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    {resolveDoubt.isPending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Send Reply & Mark Resolved
                      </>
                    )}
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setReply('');
                    }}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-200/60 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={resolveDoubt.isPending || !reply.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-[12.5px] rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                  >
                    {resolveDoubt.isPending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Updating…
                      </>
                    ) : (
                      'Save Updated Answer'
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsMobileModalOpen(false)}
                  className="px-5 py-2 bg-slate-200/80 hover:bg-slate-300/80 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

