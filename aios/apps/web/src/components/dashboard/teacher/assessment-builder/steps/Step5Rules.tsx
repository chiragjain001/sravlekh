'use client';

import React from 'react';
import {
  RotateCcw,
  Star,
  Copy,
  Info,
  FileText,
  AlignLeft,
  CheckSquare,
  Sparkles,
  CheckCircle2,
  BookOpen,
  Shuffle,
  ShieldAlert,
  PenTool,
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step5RulesProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// ── Question type pools by format ──────────────────────────────────────────
const OMR_TYPES    = ['MCQ', 'Integer', 'Numerical', 'Assertion Reason', 'Mixed', 'Single Correct MCQ', 'Multiple Correct', 'True/False', 'Match the Following', 'Fill in the Blank', 'Numerical MCQ'];
const THEORY_TYPES = ['Very Short Answer', 'Short Answer', 'Long Answer', 'Essay', 'Case Based', 'Source Based', 'Diagram Based', 'Application', 'HOTS', 'Competency'];
const HYBRID_TYPES = [...OMR_TYPES, ...THEORY_TYPES];

const RECENT_DAYS_OPTIONS = [30, 60, 90, 0];

function getTypesForFormat(format: string): string[] {
  if (format === 'THEORY')  return THEORY_TYPES;
  if (format === 'HYBRID')  return HYBRID_TYPES;
  return OMR_TYPES;
}

// Apple / iOS-style Switch Toggle with smooth transition and 44px tap target
function IosSwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export function Step5Rules({ state, onChange, onNext, onPrev }: Step5RulesProps) {
  const isTheory = state.paperFormat === 'THEORY';
  const isHybrid = state.paperFormat === 'HYBRID';
  const isOMR    = state.paperFormat === 'OMR';

  const availableTypes = getTypesForFormat(state.paperFormat);

  const toggleQType = (type: string) => {
    const updated = state.questionTypes.includes(type)
      ? state.questionTypes.filter((t) => t !== type)
      : [...state.questionTypes, type];
    onChange({ questionTypes: updated });
  };

  const theoryTypesFromSections = isTheory
    ? Array.from(new Set(state.sections.map((s) => s.questionType).filter(Boolean)))
    : [];

  return (
    <div className="space-y-5 sm:space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            5
          </span>
          <h2 className="text-[17px] sm:text-[18px] font-bold text-slate-800">Generation Rules</h2>
          <span className="text-[10.5px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
            {state.paperFormat}
          </span>
        </div>
        <p className="text-[12px] sm:text-[12.5px] text-slate-500 pl-9">
          Control question freshness, quality thresholds, and paper variant settings
        </p>
      </div>

      {/* ── Section 1: Question Types (format-conditional) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-indigo-600" />
          Question Format Types
        </h3>

        {isTheory ? (
          /* Theory — types are locked to what was set in sections */
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 bg-violet-50/60 border border-violet-100 rounded-xl">
              <Info className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <p className="text-[11.5px] text-violet-800 font-medium leading-snug">
                Question types are determined by your sections in Step 4. Each section&apos;s type is listed below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {theoryTypesFromSections.length > 0 ? theoryTypesFromSections.map((type) => (
                <span key={type} className="px-3.5 py-2 rounded-xl text-[12px] font-bold border bg-violet-600 border-violet-600 text-white">
                  {type}
                </span>
              )) : (
                <span className="text-[12px] text-slate-400 italic">No sections defined — go back to Step 4</span>
              )}
            </div>
          </div>
        ) : (
          /* OMR / Hybrid — teacher selects types */
          <div className="space-y-2">
            <p className="text-[11.5px] text-slate-500">Select allowed question formats for this paper</p>
            <div className="flex flex-wrap gap-2 pt-1">
              {availableTypes.map((type) => {
                const isSelected = state.questionTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleQType(type)}
                    className={`px-3 sm:px-3.5 py-2 rounded-xl text-[11.5px] sm:text-[12px] font-bold border transition-all min-h-[42px] cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 2: Apple iOS Options Cards (Shuffle, Negative Marking) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
        <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 flex items-center gap-2">
          <Shuffle className="w-4 h-4 text-indigo-600" />
          Test Delivery & Randomization
        </h3>

        <div className="space-y-2.5">
          {/* Shuffle Questions */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-100 gap-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Shuffle className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-slate-800 block">Shuffle Questions</span>
                <span className="text-[11px] text-slate-500">Randomize question order for each student</span>
              </div>
            </div>
            <IosSwitch
              checked={!!state.shuffleQuestions}
              onChange={(checked) => onChange({ shuffleQuestions: checked })}
              aria-label="Shuffle Questions"
            />
          </div>

          {/* Shuffle Options */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-100 gap-3 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <Copy className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-slate-800 block">Shuffle Options</span>
                <span className="text-[11px] text-slate-500">Randomize options order inside MCQs</span>
              </div>
            </div>
            <IosSwitch
              checked={!!state.shuffleOptions}
              onChange={(checked) => onChange({ shuffleOptions: checked })}
              aria-label="Shuffle Options"
            />
          </div>

          {/* Negative Marking (OMR / Hybrid) */}
          {(isOMR || isHybrid) && (
            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-100 gap-3 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[13px] font-bold text-slate-800 block">Negative Marking</span>
                  <span className="text-[11px] text-slate-500">
                    {state.negativeMarking && state.negativeMarking !== 'None'
                      ? state.negativeMarking
                      : 'Enable -1 mark penalty for wrong answers'}
                  </span>
                </div>
              </div>
              <IosSwitch
                checked={state.negativeMarking !== 'None' && !!state.negativeMarking}
                onChange={(checked) =>
                  onChange({ negativeMarking: checked ? '-1 for each wrong answer' : 'None' })
                }
                aria-label="Negative Marking"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Theory Paper Options (if Theory/Hybrid) ── */}
      {(isTheory || isHybrid) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-violet-600" />
            Theory Paper Options
          </h3>

          <div className="space-y-2.5">
            {/* Word Limit */}
            <div className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[13px] font-bold text-slate-800 block">Suggested Word Limit</span>
                  <span className="text-[11px] text-slate-500">Show word count guidance to students</span>
                </div>
                <IosSwitch
                  checked={!!state.wordLimitEnabled}
                  onChange={(checked) => onChange({ wordLimitEnabled: checked })}
                  aria-label="Suggested Word Limit"
                />
              </div>

              {state.wordLimitEnabled && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-200/60 animate-fadein">
                  <label className="text-[11.5px] font-bold text-slate-600 whitespace-nowrap">Words per mark:</label>
                  <input
                    type="number"
                    value={state.wordLimitPerMark || 30}
                    onChange={(e) => onChange({ wordLimitPerMark: Math.max(10, Number(e.target.value)) })}
                    min={10}
                    max={200}
                    className="w-20 p-2 bg-white border border-slate-300 rounded-xl text-[13px] font-bold text-slate-800 text-center focus:outline-none focus:border-violet-500"
                  />
                  <span className="text-[11px] text-slate-400">e.g. 5 marks → {(state.wordLimitPerMark || 30) * 5} words</span>
                </div>
              )}
            </div>

            {/* Answer Lines */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100 gap-3">
              <div>
                <span className="text-[13px] font-bold text-slate-800 block">Include Answer Lines in PDF</span>
                <span className="text-[11px] text-slate-500">Print ruled lines below each question for handwritten answers</span>
              </div>
              <IosSwitch
                checked={!!state.includeAnswerLines}
                onChange={(checked) => onChange({ includeAnswerLines: checked })}
                aria-label="Include Answer Lines"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Section 4: Repetition & Paper Sets ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-indigo-600" />
            Repetition Controls
          </h3>

          <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-2xl border border-slate-100 gap-3">
            <div>
              <span className="text-[12.5px] font-bold text-slate-800 block">Allow Repeated Questions</span>
              <span className="text-[11px] text-slate-500">Include questions students have seen before</span>
            </div>
            <IosSwitch
              checked={!!state.allowRepeat}
              onChange={(checked) => onChange({ allowRepeat: checked })}
              aria-label="Allow Repeated Questions"
            />
          </div>

          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1.5">Avoid Questions Used Within</label>
            <div className="grid grid-cols-4 gap-2">
              {RECENT_DAYS_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ avoidRecentDays: days })}
                  className={`py-2 text-[11.5px] font-bold rounded-xl border transition-all cursor-pointer ${
                    state.avoidRecentDays === days
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800 font-extrabold shadow-2xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {days === 0 ? 'Never' : `${days}d`}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-amber-500" />
              Minimum Question Rating
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {[0, 4.0, 4.5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => onChange({ minRating: rating })}
                  className={`py-2 px-3 text-[12px] font-bold rounded-xl border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                    state.minRating === rating
                      ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs font-extrabold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {rating === 0 ? 'Any' : `${rating}+`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800 flex items-center gap-2 mb-1">
              <Copy className="w-4 h-4 text-indigo-600" />
              Paper Sets (Anti-Cheating)
            </h3>
            <p className="text-[11px] text-slate-500 mb-2">Randomized variants: Set A, B, C…</p>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => onChange({ paperSetsCount: count })}
                  className={`flex-1 h-10 rounded-xl font-extrabold text-[12.5px] border transition-all cursor-pointer ${
                    state.paperSetsCount === count
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {count}{count === 1 ? '' : '×'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 5: AI Teacher Intent Box (Reference Image Screen 4) ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 text-indigo-900">
          <PenTool className="w-4 h-4 text-indigo-600" />
          <h3 className="text-[13.5px] sm:text-[14px] font-bold text-slate-800">
            AI Teacher Intent <span className="text-slate-400 font-normal text-[12px]">(Optional)</span>
          </h3>
        </div>
        <textarea
          rows={3}
          placeholder="e.g. Focus on HOTS questions, avoid pure memory recall, emphasize practical application..."
          value={state.teacherIntent || ''}
          onChange={(e) => onChange({ teacherIntent: e.target.value })}
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
        />
      </div>

      {/* ── Section 6: AI Alignment Flags ── */}
      <div className="bg-gradient-to-r from-indigo-50/70 to-purple-50/70 border border-indigo-100 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h3 className="text-[13.5px] sm:text-[14px] font-bold text-indigo-900">AI Selection Preferences</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[
            { key: 'avoidRepeatedQuestions' as const, label: 'Avoid questions already in previous papers', icon: <RotateCcw className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> },
            { key: 'hotsPriority' as const,           label: 'Prioritise HOTS / application questions', icon: <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> },
            { key: 'ncertAlignment' as const,         label: 'Prefer NCERT-aligned questions', icon: <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> },
            { key: 'boardAlignment' as const,         label: `Align to ${state.board || 'Board'} pattern`, icon: <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> },
          ].map(({ key, label, icon }) => (
            <label key={key} className="flex items-center gap-2.5 p-3 bg-white/80 rounded-xl cursor-pointer hover:bg-white transition-colors border border-indigo-100 select-none">
              {icon}
              <span className="text-[11.5px] font-semibold text-slate-700 flex-1">{label}</span>
              <input
                type="checkbox"
                checked={!!state[key]}
                onChange={(e) => onChange({ [key]: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
