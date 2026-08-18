'use client';

import React, { useState } from 'react';
import {
  Send,
  FileText,
  Save,
  CheckCircle2,
  Printer,
  Sparkles,
  Award,
  Users,
  Clock,
  Globe,
  Radio,
  BookOpen
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step8GenerateProps {
  state: AssessmentState;
  onPrev: () => void;
  onPublishSuccess: () => void;
}

export function Step8Generate({ state, onPrev, onPublishSuccess }: Step8GenerateProps) {
  const [published, setPublished] = useState(false);
  const [publishMode, setPublishMode] = useState<'online' | 'live' | 'offline'>('online');

  const handlePublish = () => {
    setPublished(true);
    setTimeout(() => {
      onPublishSuccess();
    }, 1800);
  };

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-emerald-200 shadow-lg text-center space-y-4 animate-fadein">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-[22px] font-bold text-slate-800">Assessment Successfully Generated & Published! 🎉</h2>
        <p className="text-[13.5px] text-slate-600 max-w-md">
          <b>{state.title}</b> has been published to <b>{state.batches.join(', ')}</b> for exam <b>{state.exam}</b>.
        </p>
        <div className="flex items-center gap-3 pt-4">
          <button
            onClick={onPublishSuccess}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] rounded-xl shadow-md transition-all"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            8
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Generate & Publish Assessment</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Finalize delivery mode, download PDF, or publish directly to student portal
        </p>
      </div>

      {/* Mode Selection Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="text-[15px] font-bold text-slate-800">Select Assessment Delivery Mode</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Online App/Web */}
          <div
            onClick={() => setPublishMode('online')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2.5 ${
              publishMode === 'online'
                ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-600/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                <Globe className="w-5 h-5" />
              </div>
              <input
                type="radio"
                name="publishMode"
                checked={publishMode === 'online'}
                onChange={() => setPublishMode('online')}
                className="w-4 h-4 text-indigo-600"
              />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-800">Digital Online Mode</h4>
              <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                App & Web portal delivery with automatic timer, auto-grading, and AI analytics report.
              </p>
            </div>
          </div>

          {/* Live Exam */}
          <div
            onClick={() => setPublishMode('live')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2.5 ${
              publishMode === 'live'
                ? 'border-rose-500 bg-rose-50/40 ring-4 ring-rose-500/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <input
                type="radio"
                name="publishMode"
                checked={publishMode === 'live'}
                onChange={() => setPublishMode('live')}
                className="w-4 h-4 text-rose-600"
              />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-800">Live Classroom Test</h4>
              <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                Proctored real-time countdown test with live teacher dashboard & live leaderboard.
              </p>
            </div>
          </div>

          {/* Offline Print */}
          <div
            onClick={() => setPublishMode('offline')}
            className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2.5 ${
              publishMode === 'offline'
                ? 'border-amber-600 bg-amber-50/40 ring-4 ring-amber-600/10'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Printer className="w-5 h-5" />
              </div>
              <input
                type="radio"
                name="publishMode"
                checked={publishMode === 'offline'}
                onChange={() => setPublishMode('offline')}
                className="w-4 h-4 text-amber-600"
              />
            </div>
            <div>
              <h4 className="text-[14px] font-bold text-slate-800">Printable PDF & OMR</h4>
              <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                Generate high-resolution printable PDF question paper and downloadable OMR sheets.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Summary Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">
              Ready to Dispatch
            </span>
            <h3 className="text-[18px] font-bold text-white mt-1">{state.title || 'Physics Test'}</h3>
          </div>

          <div className="text-right">
            <span className="text-[12px] font-bold text-amber-400 block">{state.totalMarks} Marks</span>
            <span className="text-[11px] text-slate-400">{state.duration} Minutes</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Target Exam</span>
            <span className="font-bold text-white text-[13px]">{state.exam}</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Assigned Batches</span>
            <span className="font-bold text-white text-[13px]">{state.batches.join(', ')}</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Delivery Strategy</span>
            <span className="font-bold text-indigo-300 text-[13px] capitalize">{state.strategy}</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Paper Sets</span>
            <span className="font-bold text-white text-[13px]">{state.paperSetsCount} Variants</span>
          </div>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Preview
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <button className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors flex items-center gap-1.5">
            <Save className="w-4 h-4 text-slate-500" /> Save Draft
          </button>

          <button className="px-4 py-2.5 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[12.5px] rounded-xl transition-colors flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-indigo-600" /> Preview PDF
          </button>

          <button
            onClick={handlePublish}
            className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold text-[13.5px] rounded-xl shadow-lg transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> Generate & Publish Now
          </button>
        </div>
      </div>
    </div>
  );
}
