'use client';
// ─── Evaluation Decision Dialog — 25-EVALUATION-ENGINE.md / 27-AI-EVALUATION-
// ARCHITECTURE.md, Phase 12 (manual-only) + Phase 13 (AI suggestion panel) ──
// Records a TEACHER (or TEACHER-endorsed-AI) EvaluationVersion for one
// Response. When an AI recommendation exists, shows it per doc 28 §2 ("AI
// suggestion... visually distinct from a human-entered score, confidence/
// flags always visible") with a real Accept action (ACCEPT_AI — still a real,
// distinct EvaluationVersion, never a no-op per 25 §4.2) alongside the manual
// Adjust form, prefilled from the AI's numbers. The source-image/OCR-
// transcript viewer (doc 28 §2's left pane) is still deliberately not built
// — see docs/33 Phase 10/12 write-up for why.

import { useEffect, useState } from 'react';
import { X, ClipboardCheck, Loader2, Sparkles } from 'lucide-react';
import { useRubric, useDecideEvaluation } from '@/hooks/useApi';

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
interface WorkItem {
  id: string;
  studentAnswer?: string | null;
  evidenceType?: string | null;
  question: { id: string; content: string; marks: number };
  attempt?: { studentProfile?: { rollNumber?: string | null; user?: { name: string } } };
  evaluation?: { status: string; currentVersion?: { marksAwarded: number; aiRecommendation?: AiRecommendation | null } | null } | null;
}

const FLAG_LABELS: Record<string, string> = {
  low_confidence: 'Low confidence',
  ocr_low_confidence: 'Low OCR confidence',
  off_topic_suspected: 'Possibly off-topic',
  answer_exceeds_expected_length: 'Unusually long answer',
  none: '',
};

interface EvaluationDecisionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  item: WorkItem;
}

export function EvaluationDecisionDialog({ isOpen, onClose, item }: EvaluationDecisionDialogProps) {
  const { data: rubric, isPending: isLoadingRubric } = useRubric(isOpen ? item.question.id : undefined);
  const decideEvaluation = useDecideEvaluation();

  const [marksAwarded, setMarksAwarded] = useState(0);
  const [criterionMarks, setCriterionMarks] = useState<Record<string, number>>({});
  const [mistakeTagType, setMistakeTagType] = useState('');
  const [teacherComment, setTeacherComment] = useState('');

  const usesCriteria = rubric && ['CRITERION_ADDITIVE', 'STEP_WISE'].includes(rubric.scoringMode);
  const criteria: RubricCriterion[] = rubric?.versions?.[0]?.criteria ?? [];
  const aiRecommendation = item.evaluation?.status === 'AI_SUGGESTED' ? item.evaluation.currentVersion?.aiRecommendation : null;

  useEffect(() => {
    if (!isOpen) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, item.id]);

  function handleAcceptAi() {
    decideEvaluation.mutate({ responseId: item.id, decision: 'ACCEPT_AI' }, { onSuccess: onClose });
  }

  if (!isOpen) return null;

  const derivedTotal = criteria.reduce((sum, c) => sum + (criterionMarks[c.id] ?? 0), 0);
  const canSubmit = usesCriteria ? criteria.length > 0 : marksAwarded >= 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    decideEvaluation.mutate(
      {
        responseId: item.id,
        decision: 'ADJUST',
        ...(usesCriteria
          ? { criterionScores: criteria.map((c) => ({ rubricCriterionId: c.id, marksAwarded: criterionMarks[c.id] ?? 0 })) }
          : { marksAwarded }),
        ...(mistakeTagType && { mistakeTagType }),
        ...(teacherComment.trim() && { teacherComment: teacherComment.trim() }),
      },
      { onSuccess: onClose },
    );
  }

  const studentLabel = item.attempt?.studentProfile?.user?.name ?? item.attempt?.studentProfile?.rollNumber ?? 'Student';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden border border-slate-100" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Evaluate Response</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{studentLabel} — {item.question.marks} marks</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500" aria-label="Close dialog">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoadingRubric ? (
          <div className="p-10 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Question</p>
                <p className="text-[13px] text-slate-800">{item.question.content}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Student Answer</p>
                {item.studentAnswer ? (
                  <p className="text-[13px] text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-3">{item.studentAnswer}</p>
                ) : (
                  <p className="text-[12px] text-slate-400 italic bg-slate-50 border border-slate-200 rounded-lg p-3">
                    {item.evidenceType === 'PAGE_REGION'
                      ? 'Scanned-answer viewer not yet built — see the OCR transcript in the API response until then.'
                      : 'No digital answer text captured for this response.'}
                  </p>
                )}
              </div>

              {aiRecommendation && (
                <div className="border-2 border-violet-200 bg-violet-50/60 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-violet-700">
                      <Sparkles className="w-3.5 h-3.5" />
                      <p className="text-[11px] font-bold uppercase tracking-wide">AI Suggestion</p>
                    </div>
                    <span className="text-[11px] font-bold text-violet-700">
                      {aiRecommendation.suggestedMarks} / {item.question.marks} · {Math.round(aiRecommendation.confidence * 100)}% confidence
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">Comment</label>
                <textarea
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  rows={2}
                  placeholder="Optional feedback for the student"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
              <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-white">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || decideEvaluation.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40"
              >
                {decideEvaluation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {aiRecommendation ? 'Adjust & Submit' : 'Submit Evaluation'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
