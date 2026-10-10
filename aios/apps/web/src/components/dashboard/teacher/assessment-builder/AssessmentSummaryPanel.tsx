'use client';

import React from 'react';
import {
  Sparkles,
  Database,
  Calendar,
  Layers,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Award,
  Layers3,
  FileCheck,
  Zap,
  Users,
  FileText,
  X,
} from 'lucide-react';

// ── Paper Format ─────────────────────────────────────────────────────────────
// Drives format-specific UI in Step 1 (format selector), Step 4 (section
// builder vs topic-plan), Step 5 (rules panel), and Step 6 (strategy).
export type PaperFormat = 'THEORY' | 'OMR' | 'HYBRID';

// ── Section Definition ────────────────────────────────────────────────────────
// Replaces the per-chapter easy/medium/hard plan for Theory/Hybrid papers.
// Each section maps to a block of questions with a distinct type + marks.
export interface PaperSection {
  id: string;              // client-side stable key (e.g. nanoid)
  name: string;            // e.g. "Section A"
  instructions: string;    // e.g. "Answer all questions"
  questionType: string;    // maps to QuestionType enum: SHORT_ANSWER, MCQ, etc.
  questionCount: number;   // total questions in this section
  marksPerQuestion: number;
  internalChoice: boolean; // teacher writes X+1 questions, student attempts X
  attemptRequired: number; // X of questionCount must be attempted
}

// ── Difficulty Distribution ────────────────────────────────────────────────────
export interface DifficultyDist {
  easy: number;   // percent 0–100
  medium: number;
  hard: number;
}

// ── Bloom’s Taxonomy Distribution ───────────────────────────────────────────
export interface BloomsDist {
  remember: number;
  understand: number;
  apply: number;
  analyze: number;
  evaluate: number;
  create: number;
}

export interface AssessmentState {
  // ── Core Identity (Step 1) ────────────────────────────────────────────────
  title: string;
  type: string;         // Assessment type label e.g. "Weekly Test"
  exam: string;         // Display label derived from subject
  subject: string;
  batches: string[];
  board: string;        // e.g. "CBSE", "ICSE", "State Board"
  classGrade: string;   // e.g. "Class 10"
  language: string;     // e.g. "English", "Hindi"
  academicYear: string; // e.g. "2025-26"
  paperFormat: PaperFormat;
  teacherIntent: string; // optional AI prompt
  duration: number;
  totalMarks: number;   // computed from sections for Theory; manual for OMR
  instructions: string;
  scheduleType: 'later' | 'immediate';
  dueDate: string;
  startTime: string;
  endTime: string;

  // ── Sources (Step 2) ────────────────────────────────────────────────────
  selectedSources: string[];
  sourceWeights: Record<string, number>; // sourceId -> percent weight

  // ── Syllabus (Step 3) ───────────────────────────────────────────────────
  selectedChapters: string[];
  selectedTopics: string[];

  // ── Planning (Step 4) ──────────────────────────────────────────────────
  // Theory/Hybrid: sections drive everything. OMR uses chapterQuestionPlan.
  sections: PaperSection[];
  chapterQuestionPlan: Record<string, { easy: number; medium: number; hard: number }>;

  // ── Rules (Step 5) ─────────────────────────────────────────────────────
  questionTypes: string[];   // OMR/Hybrid allowed types override
  negativeMarking: string;   // OMR/Hybrid
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showSolutions: boolean;
  allowRepeat: boolean;
  avoidRecentDays: number;
  minRating: number;
  paperSetsCount: number;
  // Theory-specific
  wordLimitEnabled: boolean;
  wordLimitPerMark: number;
  includeAnswerLines: boolean;
  generalInstructions: string[];

  // ── Strategy (Step 6) ──────────────────────────────────────────────────
  strategy: 'general' | 'personalized';
  difficultyDistribution: DifficultyDist;
  bloomsDistribution: BloomsDist;
  avoidRepeatedQuestions: boolean;
  hotsPriority: boolean;
  ncertAlignment: boolean;
  boardAlignment: boolean;
}

export interface AssessmentSummaryPanelProps {
  state: AssessmentState;
  totalQuestions: number;
  difficultyMix: { easyPct: number; medPct: number; hardPct: number };
  estimatedTime: number;
  qualityScore: number;
  availableQuestionsCount: number;
  onOpenAiAssistant?: () => void;
  isDrawer?: boolean;
  onClose?: () => void;
  className?: string;
}

// Converts PaperFormat to a human-readable label + badge color.
const FORMAT_META: Record<string, { label: string; color: string }> = {
  THEORY: { label: 'Theory / Descriptive', color: 'bg-violet-100 text-violet-800 border-violet-200' },
  OMR:    { label: 'OMR / Objective',       color: 'bg-sky-100 text-sky-800 border-sky-200' },
  HYBRID: { label: 'Hybrid / Mixed',        color: 'bg-amber-100 text-amber-800 border-amber-200' },
};

export function AssessmentSummaryPanel({
  state,
  totalQuestions,
  difficultyMix,
  estimatedTime,
  qualityScore,
  availableQuestionsCount,
  onOpenAiAssistant,
  isDrawer = false,
  onClose,
  className,
}: AssessmentSummaryPanelProps) {
  // Both meters are derived from chapterQuestionPlan (Step 4) and
  // selectedTopics (Step 3) — before a teacher has touched either, totalQuestions
  // is genuinely 0, and qualityScore's own "0 -> Needs Review" branch turned that
  // into an alarming-looking red flag on the very first step, before there was
  // anything to review. A plan that doesn't exist yet isn't a plan that failed
  // review, so show a neutral "not planned yet" state instead of 0/100 until
  // there's an actual plan to score.
  const hasPlan = totalQuestions > 0;
  const scoreLabel = !hasPlan ? 'Not Planned Yet' : qualityScore >= 80 ? 'Good' : qualityScore >= 60 ? 'Fair' : 'Needs Review';
  const scoreLabelColor = !hasPlan ? 'text-slate-400' : qualityScore >= 60 ? 'text-emerald-600' : 'text-rose-600';

  // Swipe right on touch screen to dismiss drawer smoothly
  const touchStartX = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (deltaX > 60 && onClose) {
      onClose();
    }
    touchStartX.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`${
        isDrawer
          ? 'w-full h-full bg-white p-5 flex flex-col justify-between overflow-y-auto space-y-5 custom-scrollbar'
          : 'w-[320px] bg-white border-l border-slate-200 p-5 flex flex-col justify-between flex-shrink-0 h-full overflow-y-auto space-y-5 custom-scrollbar'
      } ${className ?? ''}`}
    >
      <div className="space-y-5">
        {/* Panel Header */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] sm:text-[16px] font-bold text-slate-800 tracking-tight">Assessment Summary</h3>
            <span className="flex items-center gap-1.5 text-[10px] sm:text-[10.5px] font-extrabold px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
            </span>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close summary drawer"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Meter Gauge: Quality Score & Availability */}
        {hasPlan && (
          <div className="grid grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
            {/* Quality Score Meter */}
            <div className="flex flex-col items-center justify-center p-2 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-100"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-indigo-600 transition-all duration-500 ease-out"
                    strokeDasharray={`${qualityScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-[13px] font-extrabold text-slate-800 leading-none">{qualityScore}</span>
                  <span className="text-[9px] text-slate-400 font-semibold block">/100</span>
                </div>
              </div>
              <span className={`text-[10px] font-bold mt-1 ${scoreLabelColor}`}>{scoreLabel}</span>
              <span className="text-[9px] text-slate-400 font-medium">Quality Score</span>
            </div>

            {/* Availability */}
            <div className="flex flex-col justify-center p-2.5 bg-white rounded-xl border border-slate-100 shadow-2xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                <Database className="w-4 h-4" />
              </div>
              <span className="text-[14px] font-extrabold text-slate-800 leading-tight">
                {availableQuestionsCount.toLocaleString()}
              </span>
              <span className="text-[9.5px] text-slate-500 font-medium">
                Questions Available
              </span>
            </div>
          </div>
        )}

        {/* Live Details Breakdown */}
        <div className="space-y-2.5 text-[12px]">
          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Assessment</span>
            <span className="font-bold text-slate-800 truncate max-w-[150px]">{state.title || 'Untitled Test'}</span>
          </div>

          {(() => {
            const fm = FORMAT_META[state.paperFormat] ?? { label: 'OMR / Objective', color: 'bg-sky-100 text-sky-800 border-sky-200' };
            return (
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Format</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] border ${fm.color}`}>
                  {fm.label}
                </span>
              </div>
            );
          })()}

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Type</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px]">
              {state.type}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Subject</span>
            <span className="font-semibold text-slate-700">{state.subject}</span>
          </div>

          {state.board && (
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Board</span>
              <span className="font-semibold text-slate-700">{state.board}</span>
            </div>
          )}

          {state.classGrade && (
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Class</span>
              <span className="font-semibold text-slate-700">{state.classGrade}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Batches</span>
            <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
              {state.batches.length > 0 ? `${state.batches.length} Selected` : 'None'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Duration</span>
            <span className="font-semibold text-slate-800">{state.duration > 0 ? `${state.duration} Minutes` : '---'}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Total Marks</span>
            <span className="font-bold text-slate-800">{state.totalMarks > 0 ? state.totalMarks : '---'}</span>
          </div>

          {state.paperFormat !== 'THEORY' && (
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Negative Marking</span>
              <span className="font-semibold text-rose-600">{state.negativeMarking}</span>
            </div>
          )}

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Sources</span>
            <span className="font-semibold text-slate-700">{state.selectedSources.length} Selected</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Chapters</span>
            <span className="font-semibold text-slate-800">{state.selectedChapters.length}</span>
          </div>

          {/* For Theory papers, show section summary; for OMR, show question count */}
          {state.paperFormat === 'THEORY' && state.sections && state.sections.length > 0 ? (
            <div className="py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium block mb-1">Sections ({state.sections.length})</span>
              <div className="space-y-0.5">
                {state.sections.map((sec) => (
                  <div key={sec.id} className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-semibold">{sec.name}</span>
                    <span className="text-slate-500">
                      {sec.questionCount}Q &times; {sec.marksPerQuestion}M = {sec.questionCount * sec.marksPerQuestion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500 font-medium">Total Questions</span>
              <span className="font-extrabold text-indigo-700 text-[13px]">{totalQuestions}</span>
            </div>
          )}

          {/* Difficulty Mix Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[11px] font-bold">
              <span className="text-slate-600">Difficulty Mix</span>
              <div className="flex gap-2 text-[10px]">
                <span className="text-emerald-600 font-bold">Easy {difficultyMix.easyPct}%</span>
                <span className="text-amber-600 font-bold">Med {difficultyMix.medPct}%</span>
                <span className="text-rose-600 font-bold">Hard {difficultyMix.hardPct}%</span>
              </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
              <div style={{ width: `${difficultyMix.easyPct}%` }} className="bg-emerald-500 transition-all duration-300" title="Easy" />
              <div style={{ width: `${difficultyMix.medPct}%` }} className="bg-amber-500 transition-all duration-300" title="Medium" />
              <div style={{ width: `${difficultyMix.hardPct}%` }} className="bg-rose-500 transition-all duration-300" title="Hard" />
            </div>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Estimated Time</span>
            <span className="font-semibold text-slate-700">{estimatedTime}-{estimatedTime + 10} Min</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 font-medium">Paper Sets</span>
            <span className="font-semibold text-slate-800">{state.paperSetsCount}</span>
          </div>
        </div>

        {/* Warnings & Suggestions Box */}
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/80 rounded-2xl space-y-2">
          <div className="flex items-start gap-2 text-amber-900 text-[11.5px] leading-snug">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">Need 3 more Hard questions</p>
              <p className="text-[10.5px] text-amber-700 mt-0.5">In Rotational Motion to fulfill your NEET target difficulty blueprint.</p>
            </div>
          </div>
          <button className="w-full py-1.5 bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-800 text-[11px] font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-600" /> View AI Suggestions
          </button>
        </div>
      </div>

      {/* Floating AI Trigger Banner */}
      <button
        onClick={onOpenAiAssistant}
        className="w-full p-3.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 text-white rounded-2xl space-y-1 text-left shadow-lg shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99] transition-all group"
      >
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-extrabold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
            AI Prompt Builder
          </span>
          <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full uppercase">Instant</span>
        </div>
        <p className="text-[11px] text-indigo-100 font-medium leading-tight">
          Type prompt like "Create a 40-Q NEET Physics mock paper on Rotational Motion"
        </p>
      </button>
    </div>
  );
}
