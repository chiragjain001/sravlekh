'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Pencil, Loader2, X, Check } from 'lucide-react';
import { usePaper, useRegeneratePaperItem, useReplaceItemManually } from '@/hooks/useApi';

import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step7PreviewProps {
  state: AssessmentState;
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
export function Step7Preview({ state, onNext, onPrev, paperId, isGenerating, generationError, onRetryGeneration }: Step7PreviewProps) {
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

  const isSectionBased = state.paperFormat === 'THEORY' || state.paperFormat === 'HYBRID';
  const sectionGroups = [];
  let unsectioned = [];
  
  if (isSectionBased && state.sections && state.sections.length > 0) {
    let offset = 0;
    for (const sec of state.sections) {
      if (sec.questionCount > 0) {
        sectionGroups.push({ section: sec, items: items.slice(offset, offset + sec.questionCount) });
        offset += sec.questionCount;
      }
    }
    // Any remaining items? (Shouldn't happen if blueprint generated correctly)
    if (offset < items.length) {
      unsectioned = items.slice(offset);
    }
  } else {
    unsectioned = [...items];
  }

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
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 sm:p-5 md:p-6 shadow-xs space-y-4">
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
            <div className="space-y-6">
              {sectionGroups.map((group, sIdx) => (
                <div key={group.section.id} className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-[14px] font-bold text-slate-800">
                        Section {String.fromCharCode(65 + sIdx)}: {group.section.name}
                      </h4>
                      {group.section.instructions && (
                        <p className="text-[11.5px] text-slate-500 mt-0.5">{group.section.instructions}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
                      <span className="bg-white px-2 py-1 rounded-md border border-slate-200">
                        {group.section.questionCount} {group.section.questionCount === 1 ? 'Question' : 'Questions'}
                      </span>
                      <span className="bg-white px-2 py-1 rounded-md border border-slate-200">
                        {group.section.marksPerQuestion} Marks Each
                      </span>
                      {group.section.internalChoice && group.section.attemptRequired !== undefined && (
                        <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-md border border-amber-200">
                          Attempt {group.section.attemptRequired}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3.5 pl-2 sm:pl-4 border-l-2 border-slate-100">
                    {group.items.map((item, idx) => {
                      const q = item.question;
                      const isEditing = editingItemId === item.id;
                      const isBusy = pendingItemId === item.id;
                      const overallIdx = items.findIndex(i => i.id === item.id) + 1;

                      return (
                        <div
                          key={item.id}
                          className={`p-3.5 sm:p-4 border rounded-xl sm:rounded-2xl bg-white transition-all space-y-2.5 ${isBusy ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-indigo-200'}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-[12px] flex items-center justify-center shrink-0">
                                Q{overallIdx}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DIFFICULTY_STYLE[q.difficulty] ?? DIFFICULTY_STYLE.EASY}`}>
                                {q.difficulty}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                {q.type?.replace(/_/g, ' ')}
                              </span>
                            </div>

                            {!isEditing && (
                              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                                <button
                                  onClick={() => handleRegenerate(item.id)}
                                  disabled={isBusy}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 min-h-[34px] border border-slate-200 bg-slate-50/70 cursor-pointer"
                                  title="Regenerate"
                                >
                                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  <span>Regenerate</span>
                                </button>
                                <button
                                  onClick={() => startWriting(item.id, q.content)}
                                  disabled={isBusy}
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 min-h-[34px] border border-slate-200 bg-slate-50/70 cursor-pointer"
                                  title="Write my own"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditing ? (
                            <div className="pt-1 space-y-2">
                              <textarea
                                value={draftContent}
                                onChange={(e) => setDraftContent(e.target.value)}
                                rows={4}
                                placeholder="Type the question you want here…"
                                className="w-full p-2.5 bg-slate-50 border border-indigo-300 rounded-xl text-[13px] focus:outline-none focus:border-indigo-500 min-h-[100px]"
                                autoFocus
                              />
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => void submitWritten(item.id)}
                                  disabled={isBusy || !draftContent.trim()}
                                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11.5px] font-bold rounded-lg transition-colors disabled:opacity-50 min-h-[40px]"
                                >
                                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                                </button>
                                <button
                                  onClick={cancelWriting}
                                  disabled={isBusy}
                                  className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-[11.5px] font-bold rounded-lg hover:bg-slate-50 transition-colors min-h-[40px]"
                                >
                                  <X className="w-3.5 h-3.5" /> Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="py-1">
                              <p className="text-[13px] sm:text-[14px] text-slate-800 leading-relaxed font-medium break-words overflow-hidden" dangerouslySetInnerHTML={{ __html: q.content }} />
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 text-[11px] sm:text-[11.5px] text-slate-500 pt-2 border-t border-slate-100">
                            <span className="truncate max-w-[200px] sm:max-w-md">
                              <b>Topic:</b> {q.topic?.name ?? 'Unknown Topic'}
                            </span>
                            <span className="font-bold text-slate-700 shrink-0">{item.marks} Marks</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {unsectioned.length > 0 && (
                <div className="space-y-3.5">
                  {sectionGroups.length > 0 && (
                    <h4 className="text-[14px] font-bold text-slate-800 pt-4 border-t border-slate-200">Other Questions</h4>
                  )}
                  {unsectioned.map((item, idx) => {
                    const q = item.question;
                    const isEditing = editingItemId === item.id;
                    const isBusy = pendingItemId === item.id;
                    const overallIdx = items.findIndex(i => i.id === item.id) + 1;

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 sm:p-4 border rounded-xl sm:rounded-2xl bg-white transition-all space-y-2.5 ${isBusy ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-indigo-200'}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-[12px] flex items-center justify-center shrink-0">
                              Q{overallIdx}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${DIFFICULTY_STYLE[q.difficulty] ?? DIFFICULTY_STYLE.EASY}`}>
                              {q.difficulty}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 shrink-0">
                              {q.type?.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {!isEditing && (
                            <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                              <button
                                onClick={() => handleRegenerate(item.id)}
                                disabled={isBusy}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 min-h-[34px] border border-slate-200 bg-slate-50/70 cursor-pointer"
                                title="Regenerate"
                              >
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                <span>Regenerate</span>
                              </button>
                              <button
                                onClick={() => startWriting(item.id, q.content)}
                                disabled={isBusy}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50 min-h-[34px] border border-slate-200 bg-slate-50/70 cursor-pointer"
                                title="Write my own"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="pt-1 space-y-2">
                            <textarea
                              value={draftContent}
                              onChange={(e) => setDraftContent(e.target.value)}
                              rows={4}
                              placeholder="Type the question you want here…"
                              className="w-full p-2.5 bg-slate-50 border border-indigo-300 rounded-xl text-[13px] focus:outline-none focus:border-indigo-500 min-h-[100px]"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => void submitWritten(item.id)}
                                disabled={isBusy || !draftContent.trim()}
                                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[11.5px] font-bold rounded-lg transition-colors disabled:opacity-50 min-h-[40px]"
                              >
                                {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                              </button>
                              <button
                                onClick={cancelWriting}
                                disabled={isBusy}
                                className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 text-slate-600 text-[11.5px] font-bold rounded-lg hover:bg-slate-50 transition-colors min-h-[40px]"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="py-1">
                            <p className="text-[13px] sm:text-[14px] text-slate-800 leading-relaxed font-medium break-words overflow-hidden" dangerouslySetInnerHTML={{ __html: q.content }} />
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 text-[11px] sm:text-[11.5px] text-slate-500 pt-2 border-t border-slate-100">
                          <span className="truncate max-w-[200px] sm:max-w-md">
                            <b>Topic:</b> {q.topic?.name ?? 'Unknown Topic'}
                          </span>
                          <span className="font-bold text-slate-700 shrink-0">{item.marks} Marks</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons Row — responsive for mobile, tablet, and desktop */}
          <div className="pt-4 border-t border-slate-200">
            {/* Mobile (sm:hidden): stacked full-width */}
            <div className="flex sm:hidden flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={onPrev}
                className="w-full px-4 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px] rounded-2xl transition-colors min-h-[46px] flex items-center justify-center shadow-xs cursor-pointer active:scale-95"
              >
                ← Back to Strategy
              </button>
              <button
                type="button"
                onClick={onNext}
                className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer active:scale-95"
              >
                Continue to Publish →
              </button>
            </div>

            {/* Desktop / Tablet (hidden sm:flex): row */}
            <div className="hidden sm:flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onPrev}
                className="px-6 py-2.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors min-h-[44px] flex items-center shadow-xs cursor-pointer active:scale-95"
              >
                ← Back to Strategy
              </button>
              <button
                type="button"
                onClick={onNext}
                className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold text-[13.5px] rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 min-h-[44px] cursor-pointer active:scale-95"
              >
                Continue to Publish →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
