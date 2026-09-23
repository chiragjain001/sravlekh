'use client';

// One student's answer sheet as a single review: the AI's marks for every answer,
// split tag-wise (Formula / Calculation / Final answer…), editable by the teacher,
// then submitted in one go. Submitting is what makes the marks count — until then
// they are suggestions (32-AI-GOVERNANCE-POLICY.md §2) and the student's score
// ignores them. Backed by CheckedCopyService (apps/api/src/evaluations).

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, Sparkles, FileDown, CheckCircle2, AlertTriangle, Loader2, Plus, Trash2, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';
import { useCheckedCopy, useRunAiCheck, useSubmitCheckedCopy, useCheckedCopyPdf, usePageImageUrl } from '@/hooks/useApi';
import { PageImageViewer, ViewerRegion } from './PageImageViewer';
import { AiConfidenceBadge } from '@/components/shared/AiConfidenceBadge';

type AnswerState = 'NEEDS_OCR' | 'ILLEGIBLE' | 'READY_FOR_AI' | 'AI_SUGGESTED' | 'REVIEWED';

interface TagMark { tag: string; maxMarks: number; marksAwarded: number; note?: string | null }
interface Breakdown { verdict?: string | null; tags?: TagMark[]; note?: string | null; modelSolution?: string | null; referenceUsed?: boolean }
interface SheetQuestion {
  responseId: string;
  number: number;
  content: string;
  marksAvailable: number;
  subjective: boolean;
  state: AnswerState | null;
  studentAnswer: string | null;
  ocrConfidence: number | null;
  region: { documentId: string; pageId: string; pageNumber: number; boundingBox: { x: number; y: number; width: number; height: number } } | null;
  rubricCriteria: { id: string; description: string; maxMarks: number }[] | null;
  current: {
    source: 'AI' | 'TEACHER' | 'REVIEWER' | null;
    marksAwarded: number;
    mistakeTagType: string | null;
    teacherComment: string | null;
    breakdown: Breakdown | null;
    criterionScores: { rubricCriterionId: string; marksAwarded: number }[];
  } | null;
  ai: { suggestedMarks: number; confidence: number; flags: string[]; breakdown: Breakdown | null } | null;
}

/** One editable part of an answer's marks: a tag, or a rubric criterion. */
interface Part { key: string; label: string; maxMarks: number; marksAwarded: string; note?: string | null }
interface Draft { parts: Part[]; marks: string; mistakeTagType: string; teacherComment: string; kind: 'rubric' | 'tags' | 'total' }

const TAG_CHOICES = ['FORMULA', 'SUBSTITUTION', 'CALCULATION', 'FINAL_ANSWER', 'UNITS', 'CONCEPT', 'KEY_POINTS', 'EXPLANATION', 'EXAMPLE', 'DIAGRAM', 'PRESENTATION'];
const MISTAKE_TAGS = ['CONCEPT_ERROR', 'FORMULA_ERROR', 'CALCULATION_ERROR', 'CARELESS', 'NOT_ATTEMPTED', 'PRESENTATION_ERROR'];

const STATE_CHIP: Record<AnswerState, { label: string; cls: string }> = {
  REVIEWED: { label: 'Reviewed', cls: 'bg-emerald-100 text-emerald-700' },
  AI_SUGGESTED: { label: 'AI checked — review', cls: 'bg-indigo-100 text-indigo-700' },
  READY_FOR_AI: { label: 'Waiting for AI check', cls: 'bg-slate-100 text-slate-600' },
  NEEDS_OCR: { label: 'Not read yet (run OCR)', cls: 'bg-amber-100 text-amber-700' },
  ILLEGIBLE: { label: 'Unreadable — mark it yourself', cls: 'bg-rose-100 text-rose-700' },
};

const FLAG_LABEL: Record<string, string> = {
  no_reference_answer: 'No reference answer — AI solved it itself',
  low_confidence: 'AI unsure',
  ocr_low_confidence: 'Handwriting hard to read',
  off_topic_suspected: 'Looks off-topic',
  answer_exceeds_expected_length: 'Unusually long answer',
  breakdown_mismatch: 'Tag marks don’t add up to the question',
};

const label = (tag: string) => tag.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''));
const num = (s: string) => (s.trim() === '' ? NaN : Number(s));

function initialDraft(q: SheetQuestion): Draft {
  const c = q.current;
  const common = {
    mistakeTagType: c?.mistakeTagType ?? '',
    // An AI note is shown separately; the comment box is only the teacher's own words.
    teacherComment: c && c.source !== 'AI' ? c.teacherComment ?? '' : '',
  };
  if (q.rubricCriteria) {
    return {
      ...common,
      kind: 'rubric',
      marks: '',
      parts: q.rubricCriteria.map((rc) => ({
        key: rc.id,
        label: rc.description,
        maxMarks: rc.maxMarks,
        marksAwarded: String(c?.criterionScores.find((s) => s.rubricCriterionId === rc.id)?.marksAwarded ?? ''),
      })),
    };
  }
  const tags = c?.breakdown?.tags ?? [];
  if (tags.length) {
    return {
      ...common,
      kind: 'tags',
      marks: '',
      parts: tags.map((t, i) => ({ key: `${t.tag}-${i}`, label: t.tag, maxMarks: t.maxMarks, marksAwarded: String(t.marksAwarded), note: t.note })),
    };
  }
  return { ...common, kind: 'total', parts: [], marks: c ? String(c.marksAwarded) : '' };
}

function draftTotal(d: Draft): number {
  return d.kind === 'total' ? num(d.marks) : d.parts.reduce((s, p) => s + num(p.marksAwarded), 0);
}

function draftError(d: Draft, max: number): string | null {
  if (d.kind === 'total') {
    const m = num(d.marks);
    if (Number.isNaN(m)) return 'Enter marks';
    if (m < 0 || m > max) return `Marks must be 0–${fmt(max)}`;
    return null;
  }
  for (const p of d.parts) {
    const m = num(p.marksAwarded);
    if (Number.isNaN(m)) return `Enter marks for ${label(p.label)}`;
    if (m < 0 || m > p.maxMarks) return `${label(p.label)} allows 0–${fmt(p.maxMarks)}`;
  }
  if (d.parts.length === 0) return 'Add at least one tag';
  if (draftTotal(d) > max + 0.001) return `Total is above ${fmt(max)}`;
  return null;
}

export function CheckedCopyReview({ attemptId, onBack }: { attemptId: string; onBack: () => void }) {
  const [aiStarted, setAiStarted] = useState(false);
  const { data: sheet, isLoading, isError, refetch } = useCheckedCopy(attemptId, { poll: aiStarted });
  const runAiCheck = useRunAiCheck();
  const submit = useSubmitCheckedCopy();
  const pdf = useCheckedCopyPdf();

  const questions: SheetQuestion[] = useMemo(() => sheet?.questions ?? [], [sheet]);
  const subjective = useMemo(() => questions.filter((q) => q.subjective), [questions]);

  // Drafts are seeded from the server, and re-seeded when an answer's AI check
  // lands — but never over something the teacher has already edited.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [seededFrom, setSeededFrom] = useState<Record<string, string>>({});
  useEffect(() => {
    const nextDrafts: Record<string, Draft> = {};
    const nextSeed: Record<string, string> = {};
    for (const q of subjective) {
      const signature = `${q.state}:${q.current?.source}:${q.current?.marksAwarded}`;
      nextSeed[q.responseId] = signature;
      if (touched.has(q.responseId) && drafts[q.responseId]) continue;
      if (seededFrom[q.responseId] !== signature || !drafts[q.responseId]) nextDrafts[q.responseId] = initialDraft(q);
    }
    if (Object.keys(nextDrafts).length) setDrafts((d) => ({ ...d, ...nextDrafts }));
    setSeededFrom(nextSeed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjective]);

  useEffect(() => {
    if (aiStarted && sheet && sheet.counts.readyForAi === 0) setAiStarted(false);
  }, [aiStarted, sheet]);
  // An answer the AI skips (timeout, unusable output) stays "waiting" and goes to
  // the teacher instead, so stop polling after a while rather than forever.
  useEffect(() => {
    if (!aiStarted) return;
    const timer = setTimeout(() => setAiStarted(false), 3 * 60_000);
    return () => clearTimeout(timer);
  }, [aiStarted]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = questions.find((q) => q.responseId === selectedId) ?? questions.find((q) => q.region) ?? null;
  const pageQuestions = questions.filter((q) => q.region && selected?.region && q.region.pageId === selected.region.pageId);
  const { data: imageResp } = usePageImageUrl(selected?.region?.documentId ?? null, selected?.region?.pageId ?? null);

  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState<{ pdfUrl: string | null; obtained?: number; total?: number } | null>(null);

  const update = (responseId: string, fn: (d: Draft) => Draft) => {
    setDrafts((all) => {
      const current = all[responseId];
      return current ? { ...all, [responseId]: fn(current) } : all;
    });
    setTouched((t) => new Set(t).add(responseId));
    setConfirmed(false);
  };

  if (isLoading) return <div className="py-16 text-center text-slate-400 text-[13px]">Loading answer sheet…</div>;
  if (isError || !sheet) {
    return (
      <div className="py-16 text-center">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-[13px] font-semibold text-slate-600 mb-3">Couldn&apos;t load this answer sheet.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-slate-900 text-white text-[12px] font-bold rounded-xl">Retry</button>
      </div>
    );
  }

  const locked = sheet.delivery.status === 'LOCKED';
  const errors = subjective
    .map((q) => {
      const d = drafts[q.responseId];
      return { q, error: d ? draftError(d, q.marksAvailable) : 'Not loaded' };
    })
    .filter((e) => e.error);
  const firstError = errors[0];
  const sheetTotal = questions.reduce((s, q) => {
    if (!q.subjective) return s + (q.current?.marksAwarded ?? 0);
    const d = drafts[q.responseId];
    const t = d ? draftTotal(d) : NaN;
    return s + (Number.isNaN(t) ? 0 : t);
  }, 0);
  const canSubmit = !locked && confirmed && errors.length === 0 && subjective.length > 0 && !submit.isPending;

  const viewerRegions: ViewerRegion[] = pageQuestions.map((q) => {
    const d = drafts[q.responseId];
    const t = d ? draftTotal(d) : NaN;
    return {
      id: q.responseId,
      boundingBox: q.region!.boundingBox,
      regionType: 'QUESTION_ANSWER',
      label: `Q${q.number} · ${Number.isNaN(t) ? '–' : fmt(t)}/${fmt(q.marksAvailable)}`,
    };
  });

  const handleSubmit = () => {
    const items = subjective.map((q) => {
      // canSubmit guarantees every subjective answer has a valid draft.
      const d = drafts[q.responseId] as Draft;
      const extra = {
        ...(d.mistakeTagType ? { mistakeTagType: d.mistakeTagType } : {}),
        ...(d.teacherComment.trim() ? { teacherComment: d.teacherComment.trim() } : {}),
      };
      if (d.kind === 'rubric') {
        return { responseId: q.responseId, criterionScores: d.parts.map((p) => ({ rubricCriterionId: p.key, marksAwarded: num(p.marksAwarded) })), ...extra };
      }
      if (d.kind === 'tags') {
        return { responseId: q.responseId, tags: d.parts.map((p) => ({ tag: p.label, maxMarks: p.maxMarks, marksAwarded: num(p.marksAwarded), ...(p.note ? { note: p.note } : {}) })), ...extra };
      }
      return { responseId: q.responseId, marksAwarded: num(d.marks), ...extra };
    });
    submit.mutate({ attemptId, confirmed, items }, {
      onSuccess: (r) => {
        setTouched(new Set());
        setConfirmed(false);
        setSubmitted({ pdfUrl: r.pdfUrl, obtained: r.scoreRecord?.obtainedMarks, total: r.scoreRecord?.totalMarks });
      },
    });
  };

  const openPdf = () => pdf.mutate({ attemptId }, { onSuccess: (r) => window.open(r.url, '_blank', 'noopener') });

  return (
    <div className="space-y-4 animate-fadein pb-28">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-500 hover:text-indigo-600">
          <ChevronLeft className="w-4 h-4" /> Back to booklet
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => runAiCheck.mutate({ attemptId }, { onSuccess: (r) => r.enqueuedCount && setAiStarted(true) })}
            disabled={locked || runAiCheck.isPending || sheet.counts.readyForAi === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40"
          >
            {runAiCheck.isPending || aiStarted ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiStarted ? 'AI is checking…' : `Check with AI${sheet.counts.readyForAi ? ` (${sheet.counts.readyForAi})` : ''}`}
          </button>
          <button onClick={openPdf} disabled={pdf.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 text-slate-700 text-[12px] font-bold rounded-xl hover:bg-slate-50 disabled:opacity-40">
            {pdf.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {sheet.status === 'FINAL' ? 'Checked copy (PDF)' : 'Draft copy (PDF)'}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-[15px] font-bold text-slate-800">{sheet.student.name}{sheet.student.rollNumber ? <span className="text-slate-400 font-semibold"> · Roll {sheet.student.rollNumber}</span> : null}</p>
          <p className="text-[12px] text-slate-500">{sheet.assessment.title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase ${sheet.status === 'FINAL' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {sheet.status === 'FINAL' ? `Final${sheet.reviewedBy ? ` · ${sheet.reviewedBy.name}` : ''}` : 'Draft — not submitted'}
          </span>
          <p className="text-[20px] font-extrabold text-rose-600">{fmt(sheetTotal)} <span className="text-[13px] text-slate-400 font-bold">/ {fmt(sheet.totals.total)}</span></p>
        </div>
      </div>

      {locked && (
        <p className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-600 bg-slate-100 rounded-xl px-3 py-2">
          <Lock className="w-3.5 h-3.5" /> This assessment is locked. An admin must unlock it before marks can change.
        </p>
      )}
      {sheet.counts.needsOcr > 0 && (
        <p className="text-[12.5px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {sheet.counts.needsOcr} answer(s) haven&apos;t been read yet. Go back to the booklet and run OCR, then check with AI.
        </p>
      )}
      {submitted && (
        <div className="flex items-center justify-between flex-wrap gap-2 text-[12.5px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />
            Marks submitted{submitted.obtained !== undefined ? ` — score now ${fmt(submitted.obtained)} / ${fmt(submitted.total ?? 0)}` : ''}.
          </span>
          {submitted.pdfUrl
            ? <a href={submitted.pdfUrl} target="_blank" rel="noopener noreferrer" className="underline">Open checked copy (PDF)</a>
            : <span className="text-amber-700">The PDF couldn&apos;t be generated just now. Use the PDF button to try again.</span>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
        {/* Answers */}
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionCard
              key={q.responseId}
              q={q}
              draft={drafts[q.responseId]}
              selected={selected?.responseId === q.responseId}
              disabled={locked}
              onSelect={() => setSelectedId(q.responseId)}
              onChange={(fn) => update(q.responseId, fn)}
            />
          ))}
        </div>

        {/* Scanned page */}
        <div className="lg:sticky lg:top-4">
          {selected?.region ? (
            <div className="space-y-2">
              <p className="text-[12px] font-bold text-slate-600">Page {selected.region.pageNumber}</p>
              {imageResp?.url
                ? <PageImageViewer imageUrl={imageResp.url} regions={viewerRegions} selectedRegionId={selected.responseId} onSelectRegion={setSelectedId} />
                : <div className="h-[560px] rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-[12px] text-slate-400">Loading page…</div>}
            </div>
          ) : (
            <div className="h-40 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-[12px] text-slate-400">No scanned page for this answer.</div>
          )}
        </div>
      </div>

      {/* Submit bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div className="text-[12px] text-slate-600">
            {firstError
              ? <span className="text-rose-600 font-semibold">Q{firstError.q.number}: {firstError.error}{errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}</span>
              : <span>{subjective.length} answer(s) · total <b className="text-rose-600">{fmt(sheetTotal)} / {fmt(sheet.totals.total)}</b></span>}
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-700 cursor-pointer">
              <input type="checkbox" checked={confirmed} disabled={locked} onChange={(e) => setConfirmed(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
              I have checked every answer on this sheet
            </label>
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-[13px] font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40">
              {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {sheet.status === 'FINAL' ? 'Update final marks' : 'Submit final marks'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({ q, draft, selected, disabled, onSelect, onChange }: {
  q: SheetQuestion;
  draft: Draft | undefined;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onChange: (fn: (d: Draft) => Draft) => void;
}) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [newTag, setNewTag] = useState<string>('FORMULA');
  const aiBreakdown = q.ai?.breakdown ?? null;

  if (!q.subjective) {
    return (
      <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-slate-600 line-clamp-1"><b className="text-slate-800">Q{q.number}</b> · {q.content}</p>
        <span className="text-[12px] font-bold text-slate-700 whitespace-nowrap">{fmt(q.current?.marksAwarded ?? 0)} / {fmt(q.marksAvailable)} <span className="text-slate-400 font-semibold">auto</span></span>
      </div>
    );
  }

  const total = draft ? draftTotal(draft) : NaN;
  const error = draft ? draftError(draft, q.marksAvailable) : null;
  const chip = q.state ? STATE_CHIP[q.state] : null;
  const flags = (q.ai?.flags ?? []).filter((f) => FLAG_LABEL[f]);

  const setPart = (i: number, value: string) => onChange((d) => ({ ...d, parts: d.parts.map((p, j) => (j === i ? { ...p, marksAwarded: value } : p)) }));

  return (
    <div onClick={onSelect}
      className={`p-4 rounded-2xl border bg-white space-y-3 cursor-pointer transition-colors ${selected ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-slate-800"><b>Q{q.number}.</b> {q.content}</p>
        <p className={`text-[16px] font-extrabold whitespace-nowrap ${error ? 'text-slate-300' : 'text-rose-600'}`}>
          {Number.isNaN(total) ? '–' : fmt(total)}<span className="text-[12px] text-slate-400 font-bold"> / {fmt(q.marksAvailable)}</span>
        </p>
      </div>

      <div className="flex items-center flex-wrap gap-1.5">
        {chip && <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${chip.cls}`}>{chip.label}</span>}
        {aiBreakdown?.verdict && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">AI: {label(aiBreakdown.verdict)}</span>}
        {q.ai && <AiConfidenceBadge confidence={q.ai.confidence} />}
        {q.ocrConfidence !== null && <AiConfidenceBadge confidence={q.ocrConfidence} label="OCR" />}
        {flags.map((f) => <span key={f} className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{FLAG_LABEL[f]}</span>)}
      </div>

      {q.studentAnswer && (
        <div>
          <button onClick={(e) => { e.stopPropagation(); setShowAnswer((s) => !s); }} className="flex items-center gap-1 text-[11.5px] font-bold text-slate-500 hover:text-indigo-600">
            {showAnswer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Student&apos;s answer (as read)
          </button>
          {showAnswer && <p className="mt-1 text-[12px] text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-xl p-2.5">{q.studentAnswer}</p>}
        </div>
      )}
      {aiBreakdown?.modelSolution && (
        <div>
          <button onClick={(e) => { e.stopPropagation(); setShowSolution((s) => !s); }} className="flex items-center gap-1 text-[11.5px] font-bold text-slate-500 hover:text-indigo-600">
            {showSolution ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} AI&apos;s own solution
          </button>
          {showSolution && <p className="mt-1 text-[12px] text-slate-700 whitespace-pre-wrap bg-indigo-50/50 border border-indigo-100 rounded-xl p-2.5">{aiBreakdown.modelSolution}</p>}
        </div>
      )}
      {aiBreakdown?.note && <p className="text-[12px] text-slate-600"><b className="text-slate-700">AI note:</b> {aiBreakdown.note}</p>}

      {draft && (
        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
          {draft.kind === 'total' ? (
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-slate-600">Marks</span>
              <input type="number" step="0.5" min={0} max={q.marksAvailable} value={draft.marks} disabled={disabled}
                onChange={(e) => onChange((d) => ({ ...d, marks: e.target.value }))}
                className="w-20 px-2 py-1.5 border border-slate-200 rounded-lg text-[13px] font-bold text-rose-600" />
              <span className="text-[12px] text-slate-400">/ {fmt(q.marksAvailable)}</span>
              {!disabled && (
                <button onClick={() => onChange((d) => ({ ...d, kind: 'tags', parts: [{ key: `${newTag}-0`, label: newTag, maxMarks: q.marksAvailable, marksAwarded: d.marks }] }))}
                  className="ml-auto text-[11.5px] font-bold text-indigo-600 hover:underline">Split into tags</button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100">
              {draft.parts.map((p, i) => (
                <div key={p.key} className="flex items-center gap-2 px-2.5 py-1.5">
                  <span className="flex-1 text-[12px] font-semibold text-slate-700" title={p.note ?? undefined}>{draft.kind === 'rubric' ? p.label : label(p.label)}</span>
                  <input type="number" step="0.5" min={0} max={p.maxMarks} value={p.marksAwarded} disabled={disabled}
                    onChange={(e) => setPart(i, e.target.value)}
                    className="w-16 px-2 py-1 border border-slate-200 rounded-lg text-[12.5px] font-bold text-rose-600" />
                  <span className="text-[11.5px] text-slate-400 w-8">/ {fmt(p.maxMarks)}</span>
                  {draft.kind === 'tags' && !disabled && (
                    <button onClick={() => onChange((d) => ({ ...d, parts: d.parts.filter((_, j) => j !== i) }))} className="p-1 text-slate-300 hover:text-rose-500" title="Remove tag">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {draft.kind === 'tags' && !disabled && (
                <div className="flex items-center gap-2 px-2.5 py-1.5">
                  <select value={newTag} onChange={(e) => setNewTag(e.target.value)} className="text-[11.5px] px-2 py-1 border border-slate-200 rounded-lg bg-white">
                    {TAG_CHOICES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
                  </select>
                  <button
                    onClick={() => onChange((d) => {
                      const used = d.parts.reduce((s, p) => s + p.maxMarks, 0);
                      return { ...d, parts: [...d.parts, { key: `${newTag}-${d.parts.length}-${Date.now()}`, label: newTag, maxMarks: Math.max(0.5, q.marksAvailable - used), marksAwarded: '0' }] };
                    })}
                    className="flex items-center gap-1 text-[11.5px] font-bold text-indigo-600 hover:underline">
                    <Plus className="w-3 h-3" /> Add tag
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <select value={draft.mistakeTagType} disabled={disabled} onChange={(e) => onChange((d) => ({ ...d, mistakeTagType: e.target.value }))}
              className="text-[11.5px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
              <option value="">No mistake tag</option>
              {MISTAKE_TAGS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
            </select>
            <input value={draft.teacherComment} disabled={disabled} placeholder="Remark for the student (optional)"
              onChange={(e) => onChange((d) => ({ ...d, teacherComment: e.target.value }))}
              className="flex-1 min-w-[160px] px-2.5 py-1.5 border border-slate-200 rounded-lg text-[12px]" />
          </div>
          {error && <p className="text-[11.5px] font-semibold text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
