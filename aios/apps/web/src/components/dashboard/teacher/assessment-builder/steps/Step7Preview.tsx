'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Pencil, Loader2, X, Check } from 'lucide-react';
import { usePaper, useRegeneratePaperItem, useReplaceItemManually } from '@/hooks/useApi';

interface Step7PreviewProps {
  onNext: () => void;
  onPrev: () => void;
  /** Set once the blueprint+paper generated when entering this step resolves. */
  paperId: string | null;
  /** True while that initial generation is in flight. */
  isGenerating: boolean;
  /** Set if generation itself failed (e.g. bank can't fill the plan) — surfaced instead of an empty paper. */
  generationError: string | null;
  onRetryGeneration: () => void;
}

const DIFFICULTY_STYLE: Record<string, string> = {
  HARD: 'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  EASY: 'bg-emerald-100 text-emerald-700',
};

/**
 * Step 7 — the review a real teacher asked for and never had.
 *
 * Before this, "Preview" showed up to 5 SAMPLE questions drawn straight from
 * the raw approved-question pool — not the paper that would actually publish.
 * The real selection happened blind, inside handlePublish, on the final
 * "Generate & Publish Now" click, with no point in between where a teacher
 * could object to a question.
 *
 * Now: the paper is generated (blueprint -> papers/generate, general, no
 * batch yet) the moment a teacher advances past Step 6, and THIS step shows
 * every item in it — the actual paper, not a sample. Two ways to reject a
 * question: "Regenerate" swaps it for a different approved match (same
 * topic/type/difficulty, excluding every question already elsewhere in this
 * paper), or "Write my own" lets the teacher type a replacement directly.
 * Both edit the paper in place; Step 8 then clones this exact reviewed state
 * to each target batch rather than drawing fresh (see clonePaper's comment
 * for why a straight re-link isn't possible).
 */
export function Step7Preview({ onNext, onPrev, paperId, isGenerating, generationError, onRetryGeneration }: Step7PreviewProps) {
  const { data: paper, isLoading: paperLoading, isFetching } = usePaper(paperId);
  const regenerate = useRegeneratePaperItem();
  const replaceManually = useReplaceItemManually();

  // Which item's "write my own" panel is open, and its draft text — item-
  // scoped so switching to a different question's editor doesn't lose either
  // draft mid-edit.
  const [editingItemId, setEditingItemId] = React.useState<string | null>(null);
  const [draftContent, setDraftContent] = React.useState('');
  const [pendingItemId, setPendingItemId] = React.useState<string | null>(null);

  const items: any[] = paper?.items ?? [];

  const startWriting = (itemId: string, currentContent: string) => {
    setEditingItemId(itemId);
    setDraftContent(currentContent);
  };

  const cancelWriting = () => {
    setEditingItemId(null);
    setDraftContent('');
  };

  const submitWritten = async (itemId: string) => {
    if (!paperId || !draftContent.trim()) return;
    setPendingItemId(itemId);
    try {
      await replaceManually.mutateAsync({ paperId, itemId, content: draftContent.trim() });
      cancelWriting();
    } finally {
      setPendingItemId(null);
    }
  };

  const handleRegenerate = async (itemId: string) => {
    if (!paperId) return;
    setPendingItemId(itemId);
    try {
      await regenerate.mutateAsync({ paperId, itemId });
    } finally {
      setPendingItemId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
              7
            </span>
            <h2 className="text-[18px] font-bold text-slate-800">Review Your Paper</h2>
          </div>
          <p className="text-[12.5px] text-slate-500 pl-9">
            This is the actual generated paper. Reject a question you don&apos;t like — regenerate it, or write your own.
          </p>
        </div>
      </div>

      {/* Generating */}
      {isGenerating && (
        <div className="p-10 text-center bg-white border border-slate-200 rounded-2xl">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-[13px] font-semibold text-slate-600">Generating your paper from the plan you set…</p>
        </div>
      )}

      {/* Generation failed — most commonly the bank can't fill the plan */}
      {!isGenerating && generationError && (
        <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-[13.5px] font-bold text-rose-900">Couldn&apos;t generate the paper</h4>
            <p className="text-[12px] text-rose-800 mt-0.5">{generationError}</p>
            <button
              onClick={onRetryGeneration}
              className="mt-3 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* The real paper */}
      {!isGenerating && !generationError && paperId && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-[15px] font-bold text-slate-800">Your Paper — {items.length} Questions</h3>
            {isFetching && <span className="text-[11px] text-slate-400 font-semibold">Saving…</span>}
          </div>

          {paperLoading ? (
            <div className="p-8 text-center text-[13px] font-semibold text-slate-400">Loading paper…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-[13px] font-semibold text-slate-500">
              This paper has no questions. Go back and widen your topic or difficulty plan.
            </div>
          ) : (
            <div className="space-y-3.5">
              {items.map((item, idx) => {
                const q = item.question;
                const isEditing = editingItemId === item.id;
                const isBusy = pendingItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 border rounded-2xl bg-white transition-all space-y-2.5 ${isBusy ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-[12px] flex items-center justify-center">
                          Q{idx + 1}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DIFFICULTY_STYLE[q.difficulty] ?? DIFFICULTY_STYLE.EASY}`}>
                          {q.difficulty}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {q.type?.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {!isEditing && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRegenerate(item.id)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Reject this question — swap for a different approved one on the same topic"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                            Regenerate
                          </button>
                          <button
                            onClick={() => startWriting(item.id, q.content)}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Write your own question for this slot instead"
                          >
                            <Pencil className="w-3.5 h-3.5" /> Write my own
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="pl-9 space-y-2">
                        <textarea
                          value={draftContent}
                          onChange={(e) => setDraftContent(e.target.value)}
                          rows={3}
                          placeholder="Type the question you want here…"
                          className="w-full p-2.5 bg-slate-50 border border-indigo-300 rounded-xl text-[13px] focus:outline-none focus:border-indigo-500"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => submitWritten(item.id)}
                            disabled={isBusy || !draftContent.trim()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11.5px] font-bold rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                          </button>
                          <button
                            onClick={cancelWriting}
                            disabled={isBusy}
                            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 text-slate-600 text-[11.5px] font-bold rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[13.5px] font-medium text-slate-800 pl-9 leading-relaxed">{q.content}</p>
                    )}

                    <div className="flex items-center justify-between text-[11.5px] text-slate-500 pl-9 pt-1 border-t border-slate-100">
                      <span>
                        <b>Topic:</b> {q.topic?.name ?? 'Unknown Topic'}
                      </span>
                      <span className="font-bold text-slate-700">{item.marks} Marks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Strategy
        </button>

        <button
          onClick={onNext}
          disabled={isGenerating || !!generationError || items.length === 0}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Looks Good — Proceed to Generate & Publish →
        </button>
      </div>
    </div>
  );
}
