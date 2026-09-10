'use client';
// ─── Teacher Evaluation Work Queue — 25-EVALUATION-ENGINE.md §7, Phase 12 ──────
// Cross-delivery view backing GET /evaluation-work-items — replaces the v1
// mock (test-grouped progress cards) with a real, individual-response queue,
// per 28-DIGITAL-COPY-UX-SPECIFICATION.md §4's "replacing the need to
// navigate delivery-by-delivery for routine grading." Real API from day one.
// Phase 13: items with an AI suggestion are visually marked (doc 28 §2 —
// "visually distinct from a human-entered score").
// Batch/subject/AI-flag filters + the Decided tab (reviewer override entry
// point, 21 §4.10 / 31 §4) were audit-flagged as missing UI over a real,
// already-accepting-these-params backend.

import { useState } from 'react';
import { ClipboardCheck, CheckCircle2, PenTool, Sparkles, History, Lock } from 'lucide-react';
import { useEvaluationWorkItems, useBatches, useSubjects, useMyPermissionGrants, hasScopedPermission } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';
import { EvaluationDecisionDialog } from './EvaluationDecisionDialog';

interface WorkItem {
  id: string;
  studentAnswer?: string | null;
  evidenceType?: string | null;
  question: { id: string; content: string; marks: number; subjectId: string };
  attempt?: { studentProfile?: { rollNumber?: string | null; user?: { name: string } }; assessmentDelivery?: { batchId?: string; assessment?: { title: string } } };
  evaluation?: { status: string; currentVersion?: { marksAwarded: number; aiRecommendation?: { suggestedMarks: number; confidence: number; flags: string[] } | null } | null } | null;
  questionRegion?: {
    id: string;
    boundingBox: { x: number; y: number; width: number; height: number };
    pageImage?: { id: string; page?: { id: string; documentId: string; pageNumber: number } } | null;
    ocrBlocks?: { results?: { extractedText: string; confidence: number }[] }[];
  } | null;
}

const AI_FLAGS = [
  { value: '', label: 'All flags' },
  { value: 'low_confidence', label: 'Low confidence' },
  { value: 'ocr_low_confidence', label: 'Low OCR confidence' },
  { value: 'off_topic_suspected', label: 'Possibly off-topic' },
  { value: 'answer_exceeds_expected_length', label: 'Unusually long answer' },
];

export function TeacherEvaluationQueue() {
  const [tab, setTab] = useState<'pending' | 'decided'>('pending');
  const [page, setPage] = useState(1);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [aiFlag, setAiFlag] = useState('');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const { data: batchesResp } = useBatches();
  const { data: subjectsResp } = useSubjects();
  const { data: myGrants } = useMyPermissionGrants();
  const batches: { id: string; name: string }[] = batchesResp?.data ?? batchesResp ?? [];
  const subjects: { id: string; name: string }[] = subjectsResp ?? [];

  const { data, isPending, isError } = useEvaluationWorkItems({
    page,
    pageSize: 20,
    ...(batchId && { batchId }),
    ...(subjectId && { subjectId }),
    ...(tab === 'pending' && aiFlag && { aiFlag }),
    ...(tab === 'decided' && { includeDecided: true }),
  });
  const items: WorkItem[] = data?.data ?? [];
  const meta = data?.meta as { total: number; page: number; pageSize: number; totalPages: number } | undefined;

  function changeTab(next: 'pending' | 'decided') {
    setTab(next);
    setPage(1);
  }

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto animate-fadein">
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Evaluation Queue</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          {tab === 'pending' ? 'Subjective responses across your batches awaiting a decision, oldest first.' : 'Already-decided responses — open one to dispute/override it.'}
        </p>
      </div>

      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button onClick={() => changeTab('pending')} className={`px-4 py-1.5 text-[12.5px] font-bold rounded-lg transition-all ${tab === 'pending' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Pending</button>
        <button onClick={() => changeTab('decided')} className={`px-4 py-1.5 text-[12.5px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${tab === 'decided' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
          <History className="w-3.5 h-3.5" /> Decided
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={batchId} onChange={(e) => { setBatchId(e.target.value); setPage(1); }} className="text-[12px] font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="">All batches</option>
          {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setPage(1); }} className="text-[12px] font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {tab === 'pending' && (
          <select value={aiFlag} onChange={(e) => { setAiFlag(e.target.value); setPage(1); }} className="text-[12px] font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-slate-700">
            {AI_FLAGS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        )}
      </div>

      {isPending && <SkeletonTable rows={6} cols={3} />}

      {isError && (
        <EmptyState
          icon={<ClipboardCheck className="w-6 h-6" />}
          title="Couldn't load the evaluation queue"
          description="Something went wrong fetching work items. Try refreshing the page."
        />
      )}

      {!isPending && !isError && items.length === 0 && tab === 'pending' && (
        <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h3 className="text-[16px] font-bold text-slate-800">All Caught Up!</h3>
          <p className="text-[13px] text-slate-500 mt-1">There are no pending responses to evaluate across your batches.</p>
        </div>
      )}

      {!isPending && !isError && items.length === 0 && tab === 'decided' && (
        <EmptyState icon={<History className="w-6 h-6" />} title="No decided responses match these filters" />
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
                    {tab === 'decided' && (
                      <span className="flex-shrink-0 text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">
                        {item.evaluation?.currentVersion?.marksAwarded} / {item.question.marks} decided
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
              {tab === 'decided' && !hasScopedPermission(myGrants, 'REVIEW_EVALUATION', { batchId: item.attempt?.assessmentDelivery?.batchId, subjectId: item.question.subjectId }) ? (
                <span
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-slate-400 text-[12px] font-bold rounded-xl border border-slate-200 cursor-not-allowed"
                  title="You need the REVIEW_EVALUATION permission for this batch/subject — ask an Admin to grant it (Institute Settings → Permissions)"
                >
                  <Lock className="w-3.5 h-3.5" /> Override
                </span>
              ) : (
                <button
                  onClick={() => setActiveIndex(items.findIndex((i) => i.id === item.id))}
                  className={`flex-shrink-0 px-4 py-2 text-white text-[12px] font-bold rounded-xl transition-colors ${tab === 'decided' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-900 hover:bg-slate-800'}`}
                >
                  {tab === 'decided' ? 'Override' : 'Evaluate'}
                </button>
              )}
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

      {activeIndex !== null && (
        <EvaluationDecisionDialog
          isOpen={activeIndex !== null}
          onClose={() => setActiveIndex(null)}
          items={items}
          activeIndex={activeIndex}
          onIndexChange={setActiveIndex}
          overrideMode={tab === 'decided'}
        />
      )}
    </div>
  );
}
