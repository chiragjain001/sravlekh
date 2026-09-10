'use client';
// ─── Evaluation Workspace — 25-EVALUATION-ENGINE.md / 27-AI-EVALUATION-
// ARCHITECTURE.md, Phase 12 (manual-only) + Phase 13 (AI suggestion panel) +
// Phase 14 (source-image split pane). Records a TEACHER (or TEACHER-endorsed-
// AI) EvaluationVersion for one Response. When an AI recommendation exists,
// shows it per doc 28 §2 ("AI suggestion... visually distinct from a
// human-entered score, confidence/flags always visible") with a real Accept
// action (ACCEPT_AI — still a real, distinct EvaluationVersion, never a
// no-op per 25 §4.2) alongside the manual Adjust form, prefilled from the
// AI's numbers. Left pane renders the scanned source page (via the
// questionRegion -> pageImage -> page chain evaluations.service.ts's
// getWorkItems() now includes) for PAGE_REGION responses, with the answer
// region highlighted; DIGITAL_VALUE responses fall back to the plain text
// answer since there's no scan to show. "Save Draft" is genuine client-side
// persistence (localStorage, keyed per response) — there is no backend
// draft endpoint, so this never pretends to save anything server-side.

import { useEffect, useState } from 'react';
import { X, ClipboardCheck, Loader2, Sparkles, ChevronLeft, ChevronRight, Save, ImageOff, History, AlertTriangle } from 'lucide-react';
import { useRubric, useDecideEvaluation, useOverrideEvaluation, usePageImageUrl } from '@/hooks/useApi';
import { PageImageViewer } from '../digital-copy/PageImageViewer';
import { AiConfidenceBadge } from '@/components/shared/AiConfidenceBadge';

const MISTAKE_TAGS = [
  { value: '', label: 'No tag' },
  { value: 'CONCEPT_ERROR', label: 'Concept Error' },
  { value: 'FORMULA_ERROR', label: 'Formula Error' },
  { value: 'CALCULATION_ERROR', label: 'Calculation Error' },
  { value: 'CARELESS', label: 'Careless Mistake' },
  { value: 'NOT_ATTEMPTED', label: 'Not Attempted' },
  { value: 'PRESENTATION_ERROR', label: 'Presentation Error' },
];

interface RubricCriterion { id: string; description: string; maxMarks: number }
interface AiRecommendation {
  suggestedMarks: number;
  suggestedCriterionScores?: { rubricCriterionId: string; marksAwarded: number; note?: string }[] | null;
  confidence: number;
  flags: string[];
}
interface OcrResult { extractedText: string; confidence: number }
interface WorkItem {
  id: string;
  studentAnswer?: string | null;
  evidenceType?: string | null;
  question: { id: string; content: string; marks: number };
  attempt?: { studentProfile?: { rollNumber?: string | null; user?: { name: string } } };
  evaluation?: { status: string; currentVersion?: { marksAwarded: number; aiRecommendation?: AiRecommendation | null } | null } | null;
  questionRegion?: {
    id: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    pageImage?: { id: string; page?: { id: string; documentId: string; pageNumber: number } } | null;
    ocrBlocks?: { results?: OcrResult[] }[];
  } | null;
}

const FLAG_LABELS: Record<string, string> = {
  low_confidence: 'Low confidence',
  ocr_low_confidence: 'Low OCR confidence',
  off_topic_suspected: 'Possibly off-topic',
  answer_exceeds_expected_length: 'Unusually long answer',
  none: '',
};

interface DraftShape {
  marksAwarded: number;
  criterionMarks: Record<string, number>;
  mistakeTagType: string;
  teacherComment: string;
}

function draftKey(responseId: string) {
  return `aios:evaluation-draft:${responseId}`;
}
function loadDraft(responseId: string): DraftShape | null {
  try {
    const raw = localStorage.getItem(draftKey(responseId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveDraft(responseId: string, draft: DraftShape) {
  try {
    localStorage.setItem(draftKey(responseId), JSON.stringify(draft));
  } catch {
    // localStorage unavailable (private mode / quota) — draft simply won't persist
  }
}
function clearDraft(responseId: string) {
  try {
    localStorage.removeItem(draftKey(responseId));
  } catch {
    // ignore
  }
}

interface EvaluationDecisionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  items: WorkItem[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  /** Reviewer-override mode (21 §4.10 / 31 §4) — the item already has a
   * TEACHER_REVIEWED/REVIEWER_FINALIZED decision; submitting requires a
   * disputeReason and calls POST .../override instead of .../decide. Never a
   * silent edit — the backend enforces this is a mandatory, distinct action,
   * gated behind the REVIEW_EVALUATION permission for non-FOUNDER actors. */
  overrideMode?: boolean;
}

export function EvaluationDecisionDialog({ isOpen, onClose, items, activeIndex, onIndexChange, overrideMode = false }: EvaluationDecisionDialogProps) {
  const item = items[activeIndex];
  const { data: rubric, isPending: isLoadingRubric } = useRubric(isOpen && item ? item.question.id : undefined);
  const decideEvaluation = useDecideEvaluation();
  const overrideEvaluation = useOverrideEvaluation();
  const activeMutation = overrideMode ? overrideEvaluation : decideEvaluation;

  const [marksAwarded, setMarksAwarded] = useState(0);
  const [criterionMarks, setCriterionMarks] = useState<Record<string, number>>({});
  const [mistakeTagType, setMistakeTagType] = useState('');
  const [teacherComment, setTeacherComment] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  const page = item?.questionRegion?.pageImage?.page;
  const { data: imageResp, isLoading: imageLoading, isError: imageError } = usePageImageUrl(page?.documentId ?? null, page?.id ?? null);
  const latestOcr = item?.questionRegion?.ocrBlocks?.[0]?.results?.[0];

  const usesCriteria = rubric && ['CRITERION_ADDITIVE', 'STEP_WISE'].includes(rubric.scoringMode);
  const criteria: RubricCriterion[] = rubric?.versions?.[0]?.criteria ?? [];
  const aiRecommendation = item?.evaluation?.status === 'AI_SUGGESTED' ? item.evaluation.currentVersion?.aiRecommendation : null;

  useEffect(() => {
    if (!isOpen || !item) return;
    setDisputeReason('');
    if (overrideMode) {
      // Start from the currently-decided score, not zero or the AI's number —
      // a reviewer is disputing what a teacher already finalized.
      setMarksAwarded(item.evaluation?.currentVersion?.marksAwarded ?? 0);
      setCriterionMarks({});
      setMistakeTagType('');
      setTeacherComment('');
      setDraftSavedAt(null);
      return;
    }
    const draft = loadDraft(item.id);
    if (draft) {
      setMarksAwarded(draft.marksAwarded);
      setCriterionMarks(draft.criterionMarks);
      setMistakeTagType(draft.mistakeTagType);
      setTeacherComment(draft.teacherComment);
    } else {
      // Pre-fill from the AI's numbers when one exists — a teacher adjusting an
      // AI suggestion starts from its score, not from zero.
      setMarksAwarded(aiRecommendation?.suggestedMarks ?? 0);
      setCriterionMarks(
        aiRecommendation?.suggestedCriterionScores
          ? Object.fromEntries(aiRecommendation.suggestedCriterionScores.map((c) => [c.rubricCriterionId, c.marksAwarded]))
          : {},
      );
      setMistakeTagType('');
      setTeacherComment('');
    }
    setDraftSavedAt(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item?.id, overrideMode]);

  if (!isOpen || !item) return null;
  const currentItem = item;

  const derivedTotal = criteria.reduce((sum, c) => sum + (criterionMarks[c.id] ?? 0), 0);
  const canSubmit = (usesCriteria ? criteria.length > 0 : marksAwarded >= 0) && (!overrideMode || disputeReason.trim().length >= 10);
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < items.length - 1;

  function handleAcceptAi() {
    decideEvaluation.mutate({ responseId: currentItem.id, decision: 'ACCEPT_AI' }, { onSuccess: () => { clearDraft(currentItem.id); onClose(); } });
  }

  function handleSaveDraft() {
    saveDraft(currentItem.id, { marksAwarded, criterionMarks, mistakeTagType, teacherComment });
    setDraftSavedAt(Date.now());
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const scoreFields = usesCriteria
      ? { criterionScores: criteria.map((c) => ({ rubricCriterionId: c.id, marksAwarded: criterionMarks[c.id] ?? 0 })) }
      : { marksAwarded };

    if (overrideMode) {
      overrideEvaluation.mutate(
        {
          responseId: currentItem.id,
          ...scoreFields,
          ...(mistakeTagType && { mistakeTagType }),
          ...(teacherComment.trim() && { teacherComment: teacherComment.trim() }),
          disputeReason: disputeReason.trim(),
        },
        { onSuccess: () => onClose() },
      );
      return;
    }

    decideEvaluation.mutate(
      {
        responseId: currentItem.id,
        decision: 'ADJUST',
        ...scoreFields,
        ...(mistakeTagType && { mistakeTagType }),
        ...(teacherComment.trim() && { teacherComment: teacherComment.trim() }),
      },
      { onSuccess: () => { clearDraft(currentItem.id); onClose(); } },
    );
  }

  const studentLabel = item.attempt?.studentProfile?.user?.name ?? item.attempt?.studentProfile?.rollNumber ?? 'Student';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm animate-fadein">
      <div className="flex-1 m-4 bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                {overrideMode && <History className="w-3.5 h-3.5 text-amber-600" />}
                {overrideMode ? 'Override Decided Evaluation' : 'Evaluate Response'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{studentLabel} — {item.question.marks} marks · {activeIndex + 1} of {items.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => hasPrev && onIndexChange(activeIndex - 1)}
              disabled={!hasPrev}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30"
              title="Previous student/question"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <button
              type="button"
              onClick={() => hasNext && onIndexChange(activeIndex + 1)}
              disabled={!hasNext}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-30"
              title="Next student/question"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 ml-1" aria-label="Close workspace">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Split pane body */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 overflow-hidden">
          {/* Left: scanned source */}
          <div className="p-4 border-r border-slate-100 overflow-y-auto bg-slate-50/40">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Scanned Answer</p>
            {item.questionRegion && page ? (
              imageLoading ? (
                <div className="h-[560px] flex items-center justify-center text-slate-400 bg-white border border-slate-200 rounded-xl">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : imageError || !imageResp?.url ? (
                <div className="h-[560px] flex flex-col items-center justify-center gap-2 text-slate-400 bg-white border border-slate-200 rounded-xl">
                  <ImageOff className="w-6 h-6" />
                  <span className="text-[12px]">Couldn't load the source image.</span>
                </div>
              ) : (
                <PageImageViewer
                  imageUrl={imageResp.url}
                  regions={[{ id: item.questionRegion.id, boundingBox: item.questionRegion.boundingBox, regionType: 'QUESTION_ANSWER', label: 'Answer' }]}
                  selectedRegionId={item.questionRegion.id}
                />
              )
            ) : (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 mt-1">Student Answer (digital)</p>
                {item.studentAnswer ? (
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-3">{item.studentAnswer}</p>
                ) : (
                  <p className="text-[12px] text-slate-400 italic bg-white border border-slate-200 rounded-lg p-3">No digital answer text captured for this response.</p>
                )}
              </div>
            )}

            {latestOcr && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">OCR Transcript</p>
                  <AiConfidenceBadge confidence={latestOcr.confidence} label="OCR" />
                </div>
                <p className={`text-[12.5px] leading-relaxed whitespace-pre-wrap rounded-lg p-3 border ${
                  latestOcr.confidence < 0.5 ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : latestOcr.confidence < 0.85 ? 'bg-amber-50 border-amber-200 text-slate-800'
                  : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  {latestOcr.extractedText}
                </p>
                {latestOcr.confidence < 0.85 && (
                  <p className="text-[10.5px] text-slate-400 mt-1">Verify against the image before trusting this transcript.</p>
                )}
              </div>
            )}
          </div>

          {/* Right: evaluation form */}
          <div className="overflow-y-auto">
            {isLoadingRubric ? (
              <div className="p-10 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="p-4 space-y-4 flex-1">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Question</p>
                    <p className="text-[13px] text-slate-800">{item.question.content}</p>
                  </div>

                  {overrideMode && (
                    <div className="flex items-center gap-2 border border-amber-200 bg-amber-50 rounded-xl p-3 text-[12px] text-amber-800">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      Currently decided: <span className="font-bold">{item.evaluation?.currentVersion?.marksAwarded} / {item.question.marks}</span>
                    </div>
                  )}

                  {aiRecommendation && (
                    <div className="border-2 border-violet-200 bg-violet-50/60 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-violet-700">
                          <Sparkles className="w-3.5 h-3.5" />
                          <p className="text-[11px] font-bold uppercase tracking-wide">AI Suggestion</p>
                        </div>
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-violet-700">
                          {aiRecommendation.suggestedMarks} / {item.question.marks}
                          <AiConfidenceBadge confidence={aiRecommendation.confidence} />
                        </span>
                      </div>
                      {aiRecommendation.flags.filter((f) => f !== 'none').length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {aiRecommendation.flags.filter((f) => f !== 'none').map((f) => (
                            <span key={f} className="text-[10px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">{FLAG_LABELS[f] ?? f}</span>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={handleAcceptAi}
                        disabled={decideEvaluation.isPending}
                        className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-[11.5px] font-bold rounded-lg hover:bg-violet-700 disabled:opacity-40"
                      >
                        {decideEvaluation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                        Accept AI Score
                      </button>
                      <p className="mt-1.5 text-[10.5px] text-violet-600">Accepting still records your review as a distinct decision — not a silent default.</p>
                    </div>
                  )}

                  {usesCriteria ? (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Rubric Criteria</p>
                      <div className="space-y-2">
                        {criteria.map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <span className="flex-1 text-[12.5px] text-slate-700">{c.description}</span>
                            <input
                              type="number" min={0} max={c.maxMarks} step="0.5"
                              value={criterionMarks[c.id] ?? 0}
                              onChange={(e) => setCriterionMarks((m) => ({ ...m, [c.id]: Number(e.target.value) }))}
                              className="w-16 px-2 py-1 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <span className="text-[11px] text-slate-400 w-10">/ {c.maxMarks}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] font-semibold text-slate-600">Total (derived): {derivedTotal} / {rubric?.maxMarks}</p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Marks Awarded</label>
                      <input
                        type="number" min={0} max={item.question.marks} step="0.5"
                        value={marksAwarded}
                        onChange={(e) => setMarksAwarded(Number(e.target.value))}
                        className="w-32 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <span className="ml-2 text-[11px] text-slate-400">/ {item.question.marks}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Mistake Tag</label>
                    <select
                      value={mistakeTagType}
                      onChange={(e) => setMistakeTagType(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
                    >
                      {MISTAKE_TAGS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Comment / Annotation</label>
                    <textarea
                      value={teacherComment}
                      onChange={(e) => setTeacherComment(e.target.value)}
                      rows={3}
                      placeholder="Feedback for the student — doubles as the annotation on this response"
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  {overrideMode && (
                    <div>
                      <label className="block text-xs font-semibold text-amber-700 mb-1">Reason for override (required, min. 10 characters)</label>
                      <textarea
                        value={disputeReason}
                        onChange={(e) => setDisputeReason(e.target.value)}
                        rows={2}
                        placeholder="Why is this decision being disputed? This is never a silent edit — it's recorded as a new, attributed evaluation version."
                        className="w-full px-3 py-2 text-xs border border-amber-200 bg-amber-50/40 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    {!overrideMode && (
                      <>
                        <button type="button" onClick={handleSaveDraft} className="flex items-center gap-1.5 px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-white">
                          <Save className="w-3.5 h-3.5" /> Save Draft
                        </button>
                        {draftSavedAt && <span className="text-[10.5px] text-emerald-600 font-semibold">Draft saved</span>}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-white">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!canSubmit || activeMutation.isPending}
                      className={`flex items-center gap-2 px-5 py-2 text-white text-[13px] font-bold rounded-xl disabled:opacity-40 ${overrideMode ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                    >
                      {activeMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {overrideMode ? 'Submit Override' : aiRecommendation ? 'Adjust & Finalize' : 'Finalize Evaluation'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
