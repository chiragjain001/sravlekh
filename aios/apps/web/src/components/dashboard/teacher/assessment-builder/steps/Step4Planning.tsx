'use client';

import React from 'react';
import {
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Clock,
  Award,
  BarChart3,
  Layers,
  Sparkles
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';
import { SyllabusChapter } from './Step3Syllabus';

interface Step4PlanningProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
  chapters: SyllabusChapter[];
}

const DEFAULT_CHAPTER_PLAN = { easy: 4, medium: 6, hard: 2 };

export function Step4Planning({ state, onChange, onNext, onPrev, chapters }: Step4PlanningProps) {
  // Every chapter the teacher selected is rendered with DEFAULT_CHAPTER_PLAN
  // when it has no entry yet. That default has to be committed to the real
  // assessment state, not just drawn: publishing reads chapterQuestionPlan, so
  // a teacher who accepted the visible defaults without touching a slider used
  // to reach the last step with an empty plan and be told to "set a question
  // plan (Step 3-4)" on a screen that was showing them one.
  React.useEffect(() => {
    const missing = state.selectedChapters.filter((id) => !state.chapterQuestionPlan[id]);
    if (missing.length === 0) return;

    const seeded = { ...state.chapterQuestionPlan };
    for (const id of missing) seeded[id] = { ...DEFAULT_CHAPTER_PLAN };
    onChange({ chapterQuestionPlan: seeded });
  }, [state.selectedChapters, state.chapterQuestionPlan, onChange]);

  // Update question plan for a specific chapter
  const handleCountChange = (
    chapterId: string,
    difficulty: 'easy' | 'medium' | 'hard',
    val: number
  ) => {
    const currentPlan = state.chapterQuestionPlan;
    const currentChapterPlan = currentPlan[chapterId] || { easy: 0, medium: 0, hard: 0 };

    const updatedPlan = {
      ...currentPlan,
      [chapterId]: {
        ...currentChapterPlan,
        [difficulty]: Math.max(0, val),
      },
    };

    onChange({ chapterQuestionPlan: updatedPlan });
  };

  // Calculate totals
  const chaptersList = state.selectedChapters;

  const chapterNamesMap: Record<string, string> = Object.fromEntries(
    chapters.map((c) => [c.id, c.name]),
  );

  let totalEasy = 0;
  let totalMedium = 0;
  let totalHard = 0;

  chaptersList.forEach((chId) => {
    const plan = state.chapterQuestionPlan[chId] || DEFAULT_CHAPTER_PLAN;
    totalEasy += plan.easy;
    totalMedium += plan.medium;
    totalHard += plan.hard;
  });

  const totalQuestions = totalEasy + totalMedium + totalHard;
  const totalMarks = totalQuestions * 4; // 4 marks per Q
  const estimatedTime = Math.round(totalQuestions * 3); // 3 mins per Q
  const coveragePct = chapters.length > 0
    ? Math.min(100, Math.round((chaptersList.length / chapters.length) * 100))
    : 0;

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            4
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Question Planning</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Set question count by chapter and difficulty level using interactive sliders
        </p>
      </div>

      {/* Chapter Expandable Planning Cards */}
      <div className="space-y-4">
        {chaptersList.map((chapterId) => {
          const plan = state.chapterQuestionPlan[chapterId] || DEFAULT_CHAPTER_PLAN;
          const chapterTotal = plan.easy + plan.medium + plan.hard;

          return (
            <div
              key={chapterId}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4"
            >
              {/* Chapter Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-extrabold text-[13px]">
                    {chapterTotal}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-800">
                      {chapterNamesMap[chapterId] || chapterId}
                    </h3>
                    <p className="text-[11.5px] text-slate-500 font-medium">
                      Target Chapter Weightage: {chapterTotal > 0 ? `${Math.round((chapterTotal / (totalQuestions || 1)) * 100)}%` : '0%'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700">
                    Easy: {plan.easy}
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700">
                    Medium: {plan.medium}
                  </span>
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700">
                    Hard: {plan.hard}
                  </span>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                {/* Easy Slider */}
                <div className="space-y-2 bg-emerald-50/40 p-3.5 rounded-xl border border-emerald-100">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="font-bold text-emerald-800">Easy Questions</span>
                    <input
                      type="number"
                      value={plan.easy}
                      onChange={(e) => handleCountChange(chapterId, 'easy', Number(e.target.value))}
                      className="w-14 px-2 py-0.5 bg-white border border-emerald-200 rounded-md text-right font-extrabold text-emerald-900 text-[13px]"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={plan.easy}
                    onChange={(e) => handleCountChange(chapterId, 'easy', Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-emerald-200 rounded-lg"
                  />
                </div>

                {/* Medium Slider */}
                <div className="space-y-2 bg-amber-50/40 p-3.5 rounded-xl border border-amber-100">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="font-bold text-amber-800">Medium Questions</span>
                    <input
                      type="number"
                      value={plan.medium}
                      onChange={(e) => handleCountChange(chapterId, 'medium', Number(e.target.value))}
                      className="w-14 px-2 py-0.5 bg-white border border-amber-200 rounded-md text-right font-extrabold text-amber-900 text-[13px]"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={plan.medium}
                    onChange={(e) => handleCountChange(chapterId, 'medium', Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer h-2 bg-amber-200 rounded-lg"
                  />
                </div>

                {/* Hard Slider */}
                <div className="space-y-2 bg-rose-50/40 p-3.5 rounded-xl border border-rose-100">
                  <div className="flex justify-between items-center text-[12px]">
                    <span className="font-bold text-rose-800">Hard Questions</span>
                    <input
                      type="number"
                      value={plan.hard}
                      onChange={(e) => handleCountChange(chapterId, 'hard', Number(e.target.value))}
                      className="w-14 px-2 py-0.5 bg-white border border-rose-200 rounded-md text-right font-extrabold text-rose-900 text-[13px]"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    value={plan.hard}
                    onChange={(e) => handleCountChange(chapterId, 'hard', Number(e.target.value))}
                    className="w-full accent-rose-600 cursor-pointer h-2 bg-rose-200 rounded-lg"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Running Total Summary Bar */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Running Total</span>
            <span className="text-[18px] font-extrabold text-white">{totalQuestions} Questions</span>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Marks</span>
            <span className="text-[16px] font-bold text-amber-400">{totalMarks} Marks</span>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Est. Time</span>
            <span className="text-[16px] font-bold text-emerald-400">{estimatedTime} Mins</span>
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Syllabus Coverage</span>
            <span className="text-[16px] font-bold text-indigo-300">{coveragePct}%</span>
          </div>
        </div>

        <button
          onClick={onNext}
          disabled={totalQuestions === 0}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[13px] rounded-xl transition-all shadow-md"
        >
          Next: Question Rules →
        </button>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-3">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Syllabus
        </button>
      </div>
    </div>
  );
}
