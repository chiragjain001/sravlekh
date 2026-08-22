'use client';
// ─── Teacher Evaluation Work Queue — 25-EVALUATION-ENGINE.md §7, Phase 12 ──────
// Cross-delivery view backing GET /evaluation-work-items — replaces the v1
// mock (test-grouped progress cards) with a real, individual-response queue,
// per 28-DIGITAL-COPY-UX-SPECIFICATION.md §4's "replacing the need to
// navigate delivery-by-delivery for routine grading." Real API from day one.
// Phase 13: items with an AI suggestion are visually marked (doc 28 §2 —
// "visually distinct from a human-entered score").

import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, PenTool, Sparkles } from 'lucide-react';
import { useEvaluationWorkItems } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';
import { EvaluationDecisionDialog } from './EvaluationDecisionDialog';

interface WorkItem {
  id: string;
  studentAnswer?: string | null;
  evidenceType?: string | null;
  question: { id: string; content: string; marks: number; subjectId: string };
  attempt?: { studentProfile?: { rollNumber?: string | null; user?: { name: string } }; assessmentDelivery?: { assessment?: { title: string } } };
  evaluation?: { status: string; currentVersion?: { marksAwarded: number; aiRecommendation?: { suggestedMarks: number; confidence: number; flags: string[] } | null } | null } | null;
}

export function TeacherEvaluationQueue() {
  const [page, setPage] = useState(1);
  const [scoringItem, setScoringItem] = useState<WorkItem | null>(null);

  const { data, isPending, isError } = useEvaluationWorkItems({ page, pageSize: 20 });
  const items: WorkItem[] = data?.data ?? [];
  const meta = data?.meta as { total: number; page: number; pageSize: number; totalPages: number } | undefined;

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto animate-fadein">
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Evaluation Queue</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Subjective responses across your batches awaiting a decision, oldest first.</p>
      </div>

      {isPending && <SkeletonTable rows={6} cols={3} />}

      {isError && (
        <EmptyState
          icon={<ClipboardCheck className="w-6 h-6" />}
          title="Couldn't load the evaluation queue"
          description="Something went wrong fetching work items. Try refreshing the page."
        />
      )}

      {!isPending && !isError && items.length === 0 && (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-[16px] font-bold text-slate-800">All Caught Up!</h3>
          <p className="text-[13px] text-slate-500 mt-1">There are no pending responses to evaluate across your batches.</p>
        </div>
      )}

      {!isPending && !isError && items.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
                  <PenTool className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-[13px] font-semibold text-slate-800 truncate">{item.question.content}</p>
                    {item.evaluation?.status === 'AI_SUGGESTED' && (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded-md">
                        <Sparkles className="w-2.5 h-2.5" /> AI suggested
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-slate-500 mt-0.5">
                    {item.attempt?.studentProfile?.user?.name ?? item.attempt?.studentProfile?.rollNumber ?? 'Student'}
                    {item.attempt?.assessmentDelivery?.assessment?.title && ` · ${item.attempt.assessmentDelivery.assessment.title}`}
                    {' · '}{item.question.marks} marks
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScoringItem(item)}
                className="flex-shrink-0 px-4 py-2 bg-slate-900 text-white text-[12px] font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Evaluate
              </button>
            </div>
          ))}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[11px] text-slate-500">Page {meta.page} of {meta.totalPages} · {meta.total} items</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Previous</button>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {scoringItem && (
        <EvaluationDecisionDialog isOpen={!!scoringItem} onClose={() => setScoringItem(null)} item={scoringItem} />
      )}
    </div>
  );
}
