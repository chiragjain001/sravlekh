'use client';

import React from 'react';
import {
  Calendar,
  Clock,
  Lock,
  Edit2,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  Check,
  X,
  ChevronDown,
  Info
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step1DetailsProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  availableBatches: { id: string; name: string }[];
  onNext: () => void;
}

const ASSESSMENT_TYPES = [
  { id: 'Weekly Test', icon: '📅', label: 'Weekly Test', activeColor: 'border-indigo-600 bg-indigo-50/60 text-indigo-900' },
  { id: 'Chapter Test', icon: '📄', label: 'Chapter Test', activeColor: 'border-emerald-600 bg-emerald-50/60 text-emerald-900' },
  { id: 'Topic Test', icon: '📝', label: 'Topic Test', activeColor: 'border-blue-600 bg-blue-50/60 text-blue-900' },
  { id: 'Unit Test', icon: '📑', label: 'Unit Test', activeColor: 'border-purple-600 bg-purple-50/60 text-purple-900' },
  { id: 'Mock Test', icon: '🏆', label: 'Mock Test', activeColor: 'border-amber-600 bg-amber-50/60 text-amber-900' },
  { id: 'Grand Test', icon: '👑', label: 'Grand Test', activeColor: 'border-rose-600 bg-rose-50/60 text-rose-900' },
  { id: 'Revision Test', icon: '🔄', label: 'Revision Test', activeColor: 'border-teal-600 bg-teal-50/60 text-teal-900' },
  { id: 'Practice Test', icon: '🎯', label: 'Practice Test', activeColor: 'border-sky-600 bg-sky-50/60 text-sky-900' },
  { id: 'DPP', icon: '📋', label: 'DPP', activeColor: 'border-violet-600 bg-violet-50/60 text-violet-900' },
  { id: 'Assignment', icon: '📚', label: 'Assignment', activeColor: 'border-pink-600 bg-pink-50/60 text-pink-900' },
];

// Today's date in the browser's own local timezone, formatted for an
// <input type="date"> value/min — never UTC, or a teacher west of Greenwich
// past midnight local time would see "tomorrow" rejected as "in the past".
function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Step1Details({ state, onChange, availableBatches, onNext }: Step1DetailsProps) {
  const toggleBatch = (batchId: string) => {
    const current = state.batches;
    const updated = current.includes(batchId)
      ? current.filter((b) => b !== batchId)
      : [...current, batchId];
    onChange({ batches: updated });
  };

  return (
    <div className="space-y-6 animate-fadein">
      {/* Step Heading */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            1
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Assessment Details</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">Define the basic information for your assessment</p>
      </div>

      {/* Main Form Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left 6 cols: Assessment Type Cards */}
        <div className="xl:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <label className="text-[13px] font-bold text-slate-800 block">Assessment Type</label>
          <div className="grid grid-cols-2 gap-2.5">
            {ASSESSMENT_TYPES.map((type) => {
              const isSelected = state.type === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => onChange({ type: type.id, title: `Physics ${type.id} 08` })}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border text-[12px] font-bold text-left transition-all ${
                    isSelected
                      ? `${type.activeColor} ring-2 ring-indigo-500/20 shadow-2xs`
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg">{type.icon}</span>
                  <span className="truncate">{type.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 7 cols: Title, Batches, Exam */}
        <div className="xl:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-bold text-slate-700">Title <span className="text-slate-400 font-normal">(Auto Generated)</span></label>
              <Edit2 className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-indigo-600" />
            </div>
            <input
              type="text"
              value={state.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[13.5px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>

          {/* Batches Selection */}
          <div>
            <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">Batches *</label>
            <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px] items-center">
              {state.batches.map((batchId) => (
                <span
                  key={batchId}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-100/80 text-indigo-900 border border-indigo-200 rounded-lg text-[12px] font-bold"
                >
                  {batchId}
                  <button onClick={() => toggleBatch(batchId)} className="hover:text-rose-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {availableBatches
                .filter((b) => !state.batches.includes(b.name))
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBatch(b.name)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11.5px] font-semibold transition-colors"
                  >
                    + {b.name}
                  </button>
                ))}
            </div>
          </div>

          {/* Exam Field (Auto selected & locked) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-bold text-slate-700">Exam</label>
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3 text-slate-400" /> Auto-Selected
              </span>
            </div>
            <div className="w-full p-3 bg-slate-100/80 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 flex items-center justify-between">
              <span>{state.exam}</span>
              <Lock className="w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Duration, Marks, Negative Marking, Instructions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Duration */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <label className="text-[12px] font-bold text-slate-700 block mb-2">Duration</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={state.duration}
              onChange={(e) => onChange({ duration: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">Minutes</span>
            <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </div>
        </div>

        {/* Total Marks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <label className="text-[12px] font-bold text-slate-700 block mb-2">Total Marks</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={state.totalMarks}
              onChange={(e) => onChange({ totalMarks: Number(e.target.value) })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
            <span className="text-[12px] font-semibold text-slate-500">Marks</span>
          </div>
        </div>

        {/* Negative Marking */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1">
              Negative Marking <Info className="w-3.5 h-3.5 text-slate-400" />
            </label>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12px] font-semibold text-slate-600">{state.negativeMarking}</span>
            <input
              type="checkbox"
              checked={state.negativeMarking !== 'None'}
              onChange={(e) => onChange({ negativeMarking: e.target.checked ? '-1 for each wrong answer' : 'None' })}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
          <label className="text-[12px] font-bold text-slate-700 block mb-1">Instructions <span className="text-slate-400 font-normal">(Optional)</span></label>
          <textarea
            rows={2}
            value={state.instructions}
            onChange={(e) => onChange({ instructions: e.target.value })}
            placeholder="Add special instructions for students..."
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11.5px] focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Row 3: Availability & Schedule & Additional Options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Availability & Schedule (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <h3 className="text-[13.5px] font-bold text-slate-800">Availability & Schedule</h3>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-[12.5px] font-bold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="scheduleType"
                checked={state.scheduleType === 'later'}
                onChange={() => onChange({ scheduleType: 'later' })}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              Schedule for Later
            </label>

            <label className="flex items-center gap-2 text-[12.5px] font-bold text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="scheduleType"
                checked={state.scheduleType === 'immediate'}
                onChange={() => onChange({ scheduleType: 'immediate' })}
                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
              />
              Publish Immediately
            </label>
          </div>

          {state.scheduleType === 'later' && (
            <div className="grid grid-cols-3 gap-3 pt-2 animate-fadein">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Due Date</label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={state.dueDate}
                    min={todayIsoDate()}
                    // `min` alone is a browser-UI hint — it blocks the native
                    // picker but not a typed-in or pasted value, so the actual
                    // guard is here too. The backend enforces this again
                    // regardless (exams.service.ts createExam) since neither
                    // client-side check can be trusted on its own.
                    onChange={(e) => {
                      if (e.target.value && e.target.value < todayIsoDate()) return;
                      onChange({ dueDate: e.target.value });
                    }}
                    className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">Start Time</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="time"
                    value={state.startTime}
                    onChange={(e) => onChange({ startTime: e.target.value })}
                    className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1">End Time</label>
                <div className="relative">
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="time"
                    value={state.endTime}
                    onChange={(e) => onChange({ endTime: e.target.value })}
                    className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-800"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Additional Options (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-[13.5px] font-bold text-slate-800">Additional Options</h3>

          <div className="space-y-2.5">
            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-xl cursor-pointer">
              <span className="text-[12px] font-semibold text-slate-700">Shuffle Questions</span>
              <input
                type="checkbox"
                checked={state.shuffleQuestions}
                onChange={(e) => onChange({ shuffleQuestions: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-xl cursor-pointer">
              <span className="text-[12px] font-semibold text-slate-700">Shuffle Options</span>
              <input
                type="checkbox"
                checked={state.shuffleOptions}
                onChange={(e) => onChange({ shuffleOptions: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 bg-slate-50 rounded-xl cursor-pointer">
              <span className="text-[12px] font-semibold text-slate-700">Show Solutions After Submission</span>
              <input
                type="checkbox"
                checked={state.showSolutions}
                onChange={(e) => onChange({ showSolutions: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Row 4: Helper & Smart Checks + Next Button */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
        {/* Quick Tips */}
        <div className="md:col-span-4 bg-indigo-50/70 border border-indigo-100 p-3.5 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-[12px]">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Quick Tips</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Select topics and set difficulty mix in the next steps. AI will help balance your paper.
          </p>
        </div>

        {/* AI Smart Check */}
        <div className="md:col-span-4 bg-emerald-50/70 border border-emerald-100 p-3.5 rounded-2xl space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[12px]">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>AI Smart Check</span>
          </div>
          <div className="text-[11px] text-emerald-800 space-y-0.5 font-medium">
            <p className="flex items-center gap-1">✓ All selected batches have this syllabus</p>
            <p className="flex items-center gap-1">✓ Enough questions available for your selection</p>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="md:col-span-4 flex justify-end">
          <button
            onClick={onNext}
            className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            Next: Select Sources →
          </button>
        </div>
      </div>
    </div>
  );
}
