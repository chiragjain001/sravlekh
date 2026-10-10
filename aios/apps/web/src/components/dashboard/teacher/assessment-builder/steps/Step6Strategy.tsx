'use client';

import React from 'react';
import {
  Users,
  Brain,
  Sparkles,
  Zap,
  Target,
  BarChart2,
  Check,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step6StrategyProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step6Strategy({ state, onChange, onNext, onPrev }: Step6StrategyProps) {
  // Clamp & re-normalize difficulty sliders so they always sum to 100.
  // We update all three values atomically on each slider move so the
  // displayed percentages always add up — the API never receives a
  // distribution that sums to ≠ 100.
  const updateDifficulty = (key: 'easy' | 'medium' | 'hard', raw: number) => {
    const val = Math.min(100, Math.max(0, raw));
    const others = {
      easy: state.difficultyDistribution.easy,
      medium: state.difficultyDistribution.medium,
      hard: state.difficultyDistribution.hard,
    };
    others[key] = val;
    const sum = others.easy + others.medium + others.hard;
    if (sum === 0) { onChange({ difficultyDistribution: { easy: 34, medium: 33, hard: 33 } }); return; }
    // Scale the other two to fill the gap
    const scale = (100 - val) / (sum - val || 1);
    const keys = (['easy', 'medium', 'hard'] as const).filter((k) => k !== key);
    const [k1, k2] = keys as ['easy' | 'medium' | 'hard', 'easy' | 'medium' | 'hard'];
    const a = Math.round(others[k1!] * scale);
    const b = 100 - val - a;
    onChange({ difficultyDistribution: { ...others, [key]: val, [k1!]: a, [k2!]: b } });
  };

  const updateBlooms = (key: keyof typeof state.bloomsDistribution, raw: number) => {
    const val = Math.min(100, Math.max(0, raw));
    onChange({ bloomsDistribution: { ...state.bloomsDistribution, [key]: val } });
  };

  const bloomsTotal = Object.values(state.bloomsDistribution).reduce((s, v) => s + v, 0);

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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
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

      {/* ── Difficulty Distribution ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
          <h3 className="text-[14px] font-bold text-slate-800">Difficulty Distribution</h3>
          <span className="text-[10.5px] font-semibold text-slate-400">— must total 100%</span>
        </div>

        {/* Visual Bar */}
        <div className="h-3 w-full rounded-full overflow-hidden flex">
          <div className="bg-emerald-400 transition-all" style={{ width: `${state.difficultyDistribution.easy}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${state.difficultyDistribution.medium}%` }} />
          <div className="bg-rose-400 transition-all" style={{ width: `${state.difficultyDistribution.hard}%` }} />
        </div>

        <div className="space-y-4">
          {([
            { key: 'easy'   as const, label: 'Easy',   color: 'text-emerald-700', track: 'accent-emerald-500' },
            { key: 'medium' as const, label: 'Medium', color: 'text-amber-700',   track: 'accent-amber-500'   },
            { key: 'hard'   as const, label: 'Hard',   color: 'text-rose-700',    track: 'accent-rose-500'    },
          ]).map(({ key, label, color, track }) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-[12px] font-bold ${color}`}>{label}</span>
                <span className={`text-[13px] font-extrabold ${color}`}>
                  {state.difficultyDistribution[key]}%
                </span>
              </div>
              <input
                type="range"
                min={0} max={100}
                value={state.difficultyDistribution[key]}
                onChange={(e) => updateDifficulty(key, Number(e.target.value))}
                className={`w-full h-2.5 rounded-full cursor-pointer ${track}`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Bloom's Taxonomy ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-600" />
          <h3 className="text-[14px] font-bold text-slate-800">Bloom&apos;s Taxonomy Distribution</h3>
          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
            bloomsTotal === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
          }`}>
            Total: {bloomsTotal}%
          </span>
          <Info className="w-3.5 h-3.5 text-slate-400" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {([
            { key: 'remember'   as const, label: 'Remember',   emoji: '🧠', desc: 'Recall facts' },
            { key: 'understand' as const, label: 'Understand',  emoji: '💡', desc: 'Explain ideas' },
            { key: 'apply'      as const, label: 'Apply',       emoji: '🔧', desc: 'Use in context' },
            { key: 'analyze'    as const, label: 'Analyse',     emoji: '🔍', desc: 'Break down' },
            { key: 'evaluate'   as const, label: 'Evaluate',    emoji: '⚖️', desc: 'Judge quality' },
            { key: 'create'     as const, label: 'Create',      emoji: '✨', desc: 'Produce new' },
          ]).map(({ key, label, emoji, desc }) => (
            <div key={key} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-700">{emoji} {label}</span>
                <span className="text-[12px] font-extrabold text-purple-700">{state.bloomsDistribution[key]}%</span>
              </div>
              <input
                type="range"
                min={0} max={50}
                value={state.bloomsDistribution[key]}
                onChange={(e) => updateBlooms(key, Number(e.target.value))}
                className="w-full h-1.5 rounded-full cursor-pointer accent-purple-500"
              />
              <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
        {bloomsTotal !== 100 && (
          <p className="text-[11.5px] text-amber-700 font-medium flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Bloom&apos;s percentages currently sum to {bloomsTotal}% — AI will normalise to 100% during generation.
          </p>
        )}
      </div>
    </div>
  );
}
