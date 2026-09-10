'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

export interface PreviewQuestion {
  id: string;
  num: number;
  text: string;
  topic: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  marks: number;
  isApproved: boolean;
}

interface Step7PreviewProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
  questions: PreviewQuestion[];
  totalAvailable: number;
  isLoading?: boolean;
}

export function Step7Preview({ state, onChange, onNext, onPrev, questions, totalAvailable, isLoading }: Step7PreviewProps) {
  const sampleQuestions = questions.slice(0, 5);
  const shortfall = state.selectedTopics.length > 0 && totalAvailable < 1;

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
            Review a sample of the questions your blueprint will draw from before final publishing
          </p>
        </div>
      </div>

      {/* Shortfall warning — only shown when the question bank genuinely can't cover the plan */}
      {shortfall && (
        <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-[13.5px] font-bold text-amber-900">Not enough approved questions</h4>
            <p className="text-[12px] text-amber-800 mt-0.5">
              The selected topics have no approved questions in the bank yet. Generation will fail until more are added, or reduce your question plan in Step 4.
            </p>
          </div>
        </div>
      )}

      {/* Generated Paper Questions List */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-[15px] font-bold text-slate-800">Sample Questions from the Question Bank</h3>
          <span className="text-[12px] font-semibold text-slate-500">
            Showing {sampleQuestions.length} of {totalAvailable} approved questions
          </span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[13px] font-semibold text-slate-400">Loading questions…</div>
        ) : sampleQuestions.length === 0 ? (
          <div className="p-8 text-center text-[13px] font-semibold text-slate-500">
            No approved questions found for the selected topics yet.
          </div>
        ) : (
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
                </div>
              </div>

              <p className="text-[13.5px] font-medium text-slate-800 pl-9 leading-relaxed">{q.text}</p>

              <div className="flex items-center justify-between text-[11.5px] text-slate-500 pl-9 pt-1 border-t border-slate-100">
                <span>
                  <b>Topic:</b> {q.topic}
                </span>
                <span className="font-bold text-slate-700">{q.marks} Marks</span>
              </div>
            </div>
          ))}
        </div>
        )}
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
