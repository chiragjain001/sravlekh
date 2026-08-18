'use client';

import React from 'react';
import {
  Users,
  Brain,
  Sparkles,
  Zap,
  Target,
  BarChart2,
  Check
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step6StrategyProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step6Strategy({ state, onChange, onNext, onPrev }: Step6StrategyProps) {
  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            6
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Generation Strategy</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Choose between uniform general assessment or personalized AI adaptive papers
        </p>
      </div>

      {/* Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Option 1: General Paper */}
        <div
          onClick={() => onChange({ strategy: 'general' })}
          className={`p-6 rounded-3xl border-2 cursor-pointer transition-all space-y-4 relative ${
            state.strategy === 'general'
              ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-600/10 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>

            <div
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                state.strategy === 'general'
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {state.strategy === 'general' && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>

          <div>
            <h3 className="text-[16px] font-bold text-slate-800">General Paper (Standard Exam)</h3>
            <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
              Every student receives the exact same set of questions. Ideal for official weekly institute tests, ranking comparisons, and standardized board mocks.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2 text-[11px]">
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold">
              ✓ Standard Blueprint
            </span>
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 font-semibold">
              ✓ Unified Batch Leaderboard
            </span>
          </div>
        </div>

        {/* Option 2: Personalized AI Paper */}
        <div
          onClick={() => onChange({ strategy: 'personalized' })}
          className={`p-6 rounded-3xl border-2 cursor-pointer transition-all space-y-4 relative ${
            state.strategy === 'personalized'
              ? 'border-purple-600 bg-purple-50/40 ring-4 ring-purple-600/10 shadow-sm'
              : 'border-slate-200 bg-white hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Brain className="w-6 h-6" />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 uppercase tracking-wider">
                AI Powered
              </span>
              <div
                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  state.strategy === 'personalized'
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'border-slate-300 bg-white'
                }`}
              >
                {state.strategy === 'personalized' && <Check className="w-4 h-4 text-white" />}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[16px] font-bold text-purple-950 flex items-center gap-2">
              Personalized AI Paper (Adaptive)
            </h3>
            <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed">
              Every student receives questions individually customized by AI based on their weak topics, past error logs, topic mastery score, and learning velocity.
            </p>
          </div>

          <div className="pt-3 border-t border-purple-100 flex flex-wrap gap-2 text-[11px]">
            <span className="px-2.5 py-1 bg-purple-100/70 text-purple-800 rounded-lg font-bold">
              ✨ Targeted Remedial Focus
            </span>
            <span className="px-2.5 py-1 bg-purple-100/70 text-purple-800 rounded-lg font-bold">
              ⚡ Adaptive Difficulty Scaling
            </span>
          </div>
        </div>
      </div>

      {/* Adaptive Parameters list if Personalized */}
      {state.strategy === 'personalized' && (
        <div className="p-5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3 animate-fadein">
          <h4 className="text-[13px] font-bold text-purple-950 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" /> AI Adaptive Personalization Factors Active
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[12px]">
            <div className="p-3 bg-white rounded-xl border border-purple-100">
              <span className="font-bold text-purple-900 block">1. Weak Topics Boost</span>
              <span className="text-slate-500 text-[11px]">Incorporate 40% questions from student's historical weak areas.</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-purple-100">
              <span className="font-bold text-purple-900 block">2. Error Log Retry</span>
              <span className="text-slate-500 text-[11px]">Re-present concepts student answered wrong in past 3 tests.</span>
            </div>
            <div className="p-3 bg-white rounded-xl border border-purple-100">
              <span className="font-bold text-purple-900 block">3. Velocity Matching</span>
              <span className="text-slate-500 text-[11px]">Adjust solving duration estimates based on student solving speed.</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Rules
        </button>

        <button
          onClick={onNext}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all"
        >
          Next: Paper Preview →
        </button>
      </div>
    </div>
  );
}
