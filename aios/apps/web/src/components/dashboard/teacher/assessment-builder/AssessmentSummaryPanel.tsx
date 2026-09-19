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
  Users
} from 'lucide-react';

export interface AssessmentState {
  title: string;
  type: string;
  exam: string;
  subject: string;
  batches: string[];
  duration: number;
  totalMarks: number;
  negativeMarking: string;
  instructions: string;
  scheduleType: 'later' | 'immediate';
  dueDate: string;
  startTime: string;
  endTime: string;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showSolutions: boolean;
  selectedSources: string[];
  selectedChapters: string[];
  selectedTopics: string[];
  chapterQuestionPlan: Record<string, { easy: number; medium: number; hard: number }>;
  questionTypes: string[];
  allowRepeat: boolean;
  avoidRecentDays: number;
  minRating: number;
  paperSetsCount: number;
  strategy: 'general' | 'personalized';
}

interface AssessmentSummaryPanelProps {
  state: AssessmentState;
  totalQuestions: number;
  difficultyMix: { easyPct: number; medPct: number; hardPct: number };
  estimatedTime: number;
  qualityScore: number;
  availableQuestionsCount: number;
  onOpenAiAssistant?: () => void;
}

export function AssessmentSummaryPanel({
  state,
  totalQuestions,
  difficultyMix,
  estimatedTime,
  qualityScore,
  availableQuestionsCount,
  onOpenAiAssistant,
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

  return (
    <div className="w-[320px] bg-white border-l border-slate-200 p-5 flex flex-col justify-between flex-shrink-0 h-full overflow-y-auto space-y-5 custom-scrollbar">
      <div className="space-y-5">
        {/* Panel Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-800 tracking-tight">Assessment Summary</h3>
          <span className="flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        </div>

        {/* Meter Gauge: Quality Score & Availability */}
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
                {hasPlan && (
                  <path
                    className="text-indigo-600 transition-all duration-500 ease-out"
                    strokeDasharray={`${qualityScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                )}
              </svg>
              <div className="absolute text-center">
                <span className="text-[13px] font-extrabold text-slate-800 leading-none">{hasPlan ? qualityScore : '—'}</span>
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
              {hasPlan ? availableQuestionsCount.toLocaleString() : '—'}
            </span>
            <span className="text-[9.5px] text-slate-500 font-medium">
              {hasPlan ? 'Questions Available' : 'Plan questions to see this'}
            </span>
          </div>
        </div>

        {/* Live Details Breakdown */}
        <div className="space-y-2.5 text-[12px]">
          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Assessment</span>
            <span className="font-bold text-slate-800 truncate max-w-[150px]">{state.title || 'Untitled Test'}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Type</span>
            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[11px]">
              {state.type}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Exam</span>
            <span className="font-semibold text-slate-700">{state.exam}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Subject</span>
            <span className="font-semibold text-slate-700">{state.subject}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Batches</span>
            <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
              {state.batches.length > 0 ? `${state.batches.length} Selected` : 'None'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Duration</span>
            <span className="font-semibold text-slate-800">{state.duration} Minutes</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Total Marks</span>
            <span className="font-bold text-slate-800">{state.totalMarks}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Negative Marking</span>
            <span className="font-semibold text-rose-600">{state.negativeMarking}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Sources</span>
            <span className="font-semibold text-slate-700">{state.selectedSources.length} Selected</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Chapters</span>
            <span className="font-semibold text-slate-800">{state.selectedChapters.length}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Topics</span>
            <span className="font-semibold text-slate-800">{state.selectedTopics.length}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-medium">Total Questions</span>
            <span className="font-extrabold text-indigo-700 text-[13px]">{totalQuestions}</span>
          </div>

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
