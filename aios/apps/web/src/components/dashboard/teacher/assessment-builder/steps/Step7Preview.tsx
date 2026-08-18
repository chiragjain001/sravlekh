'use client';

import React, { useState } from 'react';
import {
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Shuffle,
  Trash2,
  RotateCcw,
  FileText,
  Award,
  Clock
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step7PreviewProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export function Step7Preview({ state, onChange, onNext, onPrev }: Step7PreviewProps) {
  const [sampleQuestions, setSampleQuestions] = useState([
    {
      id: 'Q101',
      num: 1,
      text: 'A thin uniform rod of length L and mass M is free to rotate about a horizontal axis passing through one end. Calculate its angular acceleration when released from horizontal position.',
      topic: 'Rotational Motion',
      subtopic: 'Moment of Inertia',
      difficulty: 'Hard',
      marks: 4,
      source: 'PYQ (JEE Main 2023)',
    },
    {
      id: 'Q102',
      num: 2,
      text: 'Find torque required to stop a wheel having moment of inertia 3 kg m² rotating at 20 rad/s in 10 seconds.',
      topic: 'Rotational Motion',
      subtopic: 'Torque',
      difficulty: 'Medium',
      marks: 4,
      source: 'NCERT Ex 7.4',
    },
    {
      id: 'Q103',
      num: 3,
      text: 'A solid cylinder of mass 2 kg and radius 0.2 m rolls down an inclined plane of 30° without slipping. Find acceleration.',
      topic: 'Rotational Motion',
      subtopic: 'Rolling Motion',
      difficulty: 'Medium',
      marks: 4,
      source: 'Institute Module',
    },
    {
      id: 'Q104',
      num: 4,
      text: 'Derive relation between Angular Momentum (L) and Moment of Inertia (I).',
      topic: 'Rotational Motion',
      subtopic: 'Angular Momentum',
      difficulty: 'Easy',
      marks: 4,
      source: 'DPP #14',
    },
    {
      id: 'Q105',
      num: 5,
      text: 'Calculate the escape velocity of a body thrown from Earth surface given radius of Earth is 6400 km.',
      topic: 'Gravitation',
      subtopic: 'Escape Velocity',
      difficulty: 'Easy',
      marks: 4,
      source: 'NCERT Exemplar',
    },
  ]);

  const handleRegenerateQuestion = (qId: string) => {
    setSampleQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? {
              ...q,
              text: `[Re-generated Variant] ${q.text}`,
              source: 'AI Smart Swap',
            }
          : q
      )
    );
  };

  const handleRegenerateAll = () => {
    setSampleQuestions((prev) =>
      prev.map((q) => ({
        ...q,
        text: `[Regenerated Paper Set] ${q.text}`,
      }))
    );
  };

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
              7
            </span>
            <h2 className="text-[18px] font-bold text-slate-800">Paper Preview & Quality Check</h2>
          </div>
          <p className="text-[12.5px] text-slate-500 pl-9">
            Review questions, balance index, warnings, and fine-tune questions before final publishing
          </p>
        </div>

        <button
          onClick={handleRegenerateAll}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[12px] rounded-xl border border-indigo-200 transition-all"
        >
          <Shuffle className="w-4 h-4" />
          Regenerate Entire Paper
        </button>
      </div>

      {/* Warnings / Smart Check Alert */}
      <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13.5px] font-bold text-amber-900">Blueprint Warning Alert</h4>
            <p className="text-[12px] text-amber-800 mt-0.5">
              Only 3 Hard Questions available in Torque subtopic. Need 1 more to fulfill target hard difficulty ratio.
            </p>
          </div>
        </div>

        <button className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 font-bold text-[11.5px] rounded-xl hover:bg-amber-100 shadow-2xs transition-colors flex items-center gap-1.5 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Auto-Fix with AI
        </button>
      </div>

      {/* Generated Paper Questions List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-[15px] font-bold text-slate-800">Generated Paper Questions Preview</h3>
          <span className="text-[12px] font-semibold text-slate-500">
            Showing 5 of {state.title ? 30 : 25} Questions
          </span>
        </div>

        <div className="space-y-3.5">
          {sampleQuestions.map((q) => (
            <div
              key={q.id}
              className="p-4 border border-slate-200 rounded-2xl bg-white hover:border-indigo-200 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-[12px] flex items-center justify-center">
                    Q{q.num}
                  </span>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      q.difficulty === 'Hard'
                        ? 'bg-rose-100 text-rose-700'
                        : q.difficulty === 'Medium'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {q.difficulty}
                  </span>

                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {q.source}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRegenerateQuestion(q.id)}
                    title="Swap Question"
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Swap
                  </button>
                </div>
              </div>

              <p className="text-[13.5px] font-medium text-slate-800 pl-9 leading-relaxed">{q.text}</p>

              <div className="flex items-center justify-between text-[11.5px] text-slate-500 pl-9 pt-1 border-t border-slate-100">
                <span>
                  <b>Topic:</b> {q.topic} ({q.subtopic})
                </span>
                <span className="font-bold text-slate-700">{q.marks} Marks</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Strategy
        </button>

        <button
          onClick={onNext}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all flex items-center gap-2"
        >
          Proceed to Generate & Publish →
        </button>
      </div>
    </div>
  );
}
