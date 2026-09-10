'use client';

import React, { useState } from 'react';
import { Sparkles, X, Wand2, ArrowRight } from 'lucide-react';
import { useGenerateBlueprintAI } from '@/hooks/useApi';

export interface AiBlueprintRule {
  topicName: string;
  questionType: string;
  difficulty: string;
  count: number;
}

export interface AiBlueprintResult {
  title: string;
  duration: number;
  rules: AiBlueprintRule[];
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyResult: (result: AiBlueprintResult) => void;
}

const PRESET_PROMPTS = [
  'Create a 30-question Weekly Test for NEET 2027 on Rotational Motion with 30% Easy, 50% Medium, 20% Hard questions from PYQs and NCERT.',
  'Generate a 40-question Chapter Test on Gravitation & Current Electricity for Class 11 Batch A and B.',
  'Create a 120-minute Full Mock Test for NEET Physics with focus on weak topics of Batch NEET 2027.',
  'Build a 15-question DPP on Torque and Angular Momentum with high PYQ percentage.'
];

export function AiAssistantModal({ isOpen, onClose, onApplyResult }: AiAssistantModalProps) {
  const [prompt, setPrompt] = useState('');
  const generateBlueprint = useGenerateBlueprintAI();

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    try {
      const res = await generateBlueprint.mutateAsync({ prompt });
      onApplyResult(res.data as AiBlueprintResult);
      onClose();
    } catch {
      // useGenerateBlueprintAI's onError already surfaces a toast.
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadein">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-[620px] p-6 relative space-y-5">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-[18px] font-bold text-slate-800">Build Assessment with AI ✨</h2>
            <p className="text-[12px] text-slate-500">Describe what paper you want in plain English. AI pre-fills all 8 panels instantly.</p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[12px] font-bold text-slate-700 block">Your Academic Prompt</label>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Create a 30-question Physics Weekly Test for NEET 2027 focusing on Rotational Motion and Gravitation with 40% Easy, 40% Medium, 20% Hard questions..."
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-400/20 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Or Choose Quick Preset</span>
          <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
            {PRESET_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(p)}
                className="w-full text-left p-2.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-100 hover:border-indigo-200 rounded-xl text-[12px] text-slate-700 font-medium transition-all flex items-center justify-between group"
              >
                <span className="truncate pr-2">{p}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12.5px] font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || generateBlueprint.isPending}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-[13px] rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {generateBlueprint.isPending ? (
              <>
                <Wand2 className="w-4 h-4 animate-spin" />
                Auto-Filling Assessment...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate & Auto-Fill
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
