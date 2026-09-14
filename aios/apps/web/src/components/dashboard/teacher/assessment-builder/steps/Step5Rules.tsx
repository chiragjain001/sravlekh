'use client';

import React from 'react';
import {
  CheckSquare,
  ShieldAlert,
  RotateCcw,
  Star,
  Shuffle,
  Copy,
  Layers
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step5RulesProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

// Short/Long Answer added alongside the existing competitive-exam formats —
// the backend's QuestionType enum has always had SHORT_ANSWER/LONG_ANSWER
// (packages/db/prisma/schema.prisma), but nothing in the wizard ever offered
// them, so a school-style theory paper (mostly subjective questions) could
// never actually be built here, only MCQ/Numerical competitive-exam papers.
const QUESTION_TYPES = ['MCQ', 'Integer', 'Numerical', 'Assertion Reason', 'Mixed', 'Short Answer', 'Long Answer'];
const RECENT_DAYS_OPTIONS = [30, 60, 90, 0];

export function Step5Rules({ state, onChange, onNext, onPrev }: Step5RulesProps) {
  const toggleQType = (type: string) => {
    const current = state.questionTypes;
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange({ questionTypes: updated });
  };

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            5
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Question Rules</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Configure question types, anti-cheating, repetition prevention, and paper set generation
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Question Types */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-indigo-600" /> Question Format Types
          </h3>
          <p className="text-[11.5px] text-slate-500">Select allowed question formats for this paper</p>

          <div className="flex flex-wrap gap-2 pt-1">
            {QUESTION_TYPES.map((type) => {
              const isSelected = state.questionTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleQType(type)}
                  className={`px-3.5 py-2 rounded-xl text-[12px] font-bold border transition-all ${
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

        {/* 2. Repeated Questions & Recently Used */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-indigo-600" /> Repetition Controls
          </h3>

          {/* Allow Repeated */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <div>
              <span className="text-[12.5px] font-bold text-slate-800 block">Allow Repeated Questions</span>
              <span className="text-[11px] text-slate-500">Allow questions that students saw in previous tests</span>
            </div>
            <input
              type="checkbox"
              checked={state.allowRepeat}
              onChange={(e) => onChange({ allowRepeat: e.target.checked })}
              className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Avoid Recently Used */}
          <div>
            <label className="text-[12px] font-bold text-slate-700 block mb-1.5">Avoid Questions Used Within</label>
            <div className="grid grid-cols-4 gap-2">
              {RECENT_DAYS_OPTIONS.map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => onChange({ avoidRecentDays: days })}
                  className={`py-2 text-[11.5px] font-bold rounded-xl border transition-all ${
                    state.avoidRecentDays === days
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {days === 0 ? 'Never' : `${days} Days`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Question Quality Score Filter */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" /> Minimum Question Rating
          </h3>
          <p className="text-[11.5px] text-slate-500">Filter questions by institute peer-review rating</p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            {[0, 4.0, 4.5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => onChange({ minRating: rating })}
                className={`py-2 px-3 text-[12px] font-bold rounded-xl border transition-all flex items-center justify-center gap-1 ${
                  state.minRating === rating
                    ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                {rating === 0 ? 'Any Rating' : `${rating}+ Stars`}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Multiple Paper Sets */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-[14px] font-bold text-slate-800 flex items-center gap-2">
            <Copy className="w-4 h-4 text-indigo-600" /> Generate Multiple Paper Sets
          </h3>
          <p className="text-[11.5px] text-slate-500">Generates randomized variants (Set A, B, C, D, E) for anti-cheating</p>

          <div className="flex items-center gap-2 pt-1">
            {[1, 2, 3, 4, 5].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onChange({ paperSetsCount: count })}
                className={`w-11 h-11 rounded-xl font-extrabold text-[14px] border transition-all ${
                  state.paperSetsCount === count
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {count} {count === 1 ? 'Set' : 'Sets'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Planning
        </button>

        <button
          onClick={onNext}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all"
        >
          Next: Generation Strategy →
        </button>
      </div>
    </div>
  );
}
