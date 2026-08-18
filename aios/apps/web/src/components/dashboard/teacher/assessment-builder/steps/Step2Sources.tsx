'use client';

import React from 'react';
import {
  BookOpen,
  FileCheck,
  Building2,
  Bookmark,
  UserCheck,
  UploadCloud,
  History,
  CheckCircle2,
  Plus
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step2SourcesProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export const QUESTION_SOURCES_DATA = [
  {
    id: 'NCERT',
    title: 'NCERT Textbook & Exemplar',
    icon: BookOpen,
    questionsAvailable: 3420,
    coverage: '98%',
    lastUpdated: 'Yesterday',
    qualityScore: '96/100',
    tagColor: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Standard textbook questions, exemplar problems & direct conceptual drills.',
  },
  {
    id: 'PYQ',
    title: 'Previous Year Questions (PYQ)',
    icon: FileCheck,
    questionsAvailable: 4850,
    coverage: '95%',
    lastUpdated: '2 days ago',
    qualityScore: '98/100',
    tagColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description: '15+ Years of authentic NEET, JEE Main & Advanced questions with solutions.',
  },
  {
    id: 'Institute Module',
    title: 'Institute Coaching Module',
    icon: Building2,
    questionsAvailable: 2150,
    coverage: '90%',
    lastUpdated: 'Last week',
    qualityScore: '92/100',
    tagColor: 'bg-purple-100 text-purple-800 border-purple-200',
    description: 'High-yield coaching institute question sets categorized by difficulty levels.',
  },
  {
    id: 'DPP',
    title: 'Daily Practice Papers (DPP)',
    icon: Bookmark,
    questionsAvailable: 1200,
    coverage: '85%',
    lastUpdated: '3 days ago',
    qualityScore: '88/100',
    tagColor: 'bg-amber-100 text-amber-800 border-amber-200',
    description: 'Curated daily practice sets from ongoing classroom lecture progression.',
  },
  {
    id: 'Teacher Questions',
    title: 'Teacher Custom Question Bank',
    icon: UserCheck,
    questionsAvailable: 420,
    coverage: '60%',
    lastUpdated: 'Today',
    qualityScore: '95/100',
    tagColor: 'bg-pink-100 text-pink-800 border-pink-200',
    description: 'Your privately created or star-marked questions from personal library.',
  },
  {
    id: 'Previous Tests',
    title: 'Previous Tests Archive',
    icon: History,
    questionsAvailable: 890,
    coverage: '75%',
    lastUpdated: '4 days ago',
    qualityScore: '90/100',
    tagColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    description: 'Recycle questions from recent weekly or unit tests for revision checks.',
  },
  {
    id: 'Custom Upload',
    title: 'Custom File / Image Upload',
    icon: UploadCloud,
    questionsAvailable: 0,
    coverage: '--',
    lastUpdated: 'Never',
    qualityScore: 'Custom',
    tagColor: 'bg-slate-100 text-slate-800 border-slate-200',
    description: 'Upload PDF or Word document questions via OCR parser.',
  },
];

export function Step2Sources({ state, onChange, onNext, onPrev }: Step2SourcesProps) {
  const toggleSource = (sourceId: string) => {
    const current = state.selectedSources;
    const updated = current.includes(sourceId)
      ? current.filter((s) => s !== sourceId)
      : [...current, sourceId];
    onChange({ selectedSources: updated });
  };

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            2
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Question Sources</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Select academic question banks and repositories to draw questions from
        </p>
      </div>

      {/* Grid of Source Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {QUESTION_SOURCES_DATA.map((source) => {
          const isSelected = state.selectedSources.includes(source.id);
          const Icon = source.icon;

          return (
            <div
              key={source.id}
              onClick={() => toggleSource(source.id)}
              className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between relative space-y-4 ${
                isSelected
                  ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-4 ring-indigo-600/10'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-2xs'
              }`}
            >
              {/* Checkmark Badge */}
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center font-bold">
                  <Icon className="w-5 h-5" />
                </div>

                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && <CheckCircle2 className="w-4 h-4 fill-indigo-600 text-white" />}
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="text-[14.5px] font-bold text-slate-800 leading-snug">{source.title}</h3>
                <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">{source.description}</p>
              </div>

              {/* Metrics Bar */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-[11px]">
                <div>
                  <span className="text-slate-400 font-medium block">Available</span>
                  <span className="font-extrabold text-slate-800">{source.questionsAvailable.toLocaleString()} Qs</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Coverage</span>
                  <span className="font-bold text-slate-700">{source.coverage}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Updated</span>
                  <span className="font-semibold text-slate-600">{source.lastUpdated}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block">Quality</span>
                  <span className={`inline-block px-1.5 py-0.2 rounded font-bold ${source.tagColor}`}>
                    {source.qualityScore}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors"
        >
          ← Back to Details
        </button>

        <button
          onClick={onNext}
          disabled={state.selectedSources.length === 0}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          Next: Syllabus Builder →
        </button>
      </div>
    </div>
  );
}
