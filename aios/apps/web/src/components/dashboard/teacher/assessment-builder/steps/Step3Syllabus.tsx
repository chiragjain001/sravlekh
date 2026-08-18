'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  BookOpen,
  Layers,
  Filter,
  CheckSquare,
  Square
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';

interface Step3SyllabusProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onPrev: () => void;
}

export interface SyllabusChapter {
  id: string;
  name: string;
  totalQuestions: number;
  topics: {
    id: string;
    name: string;
    subtopics: string[];
  }[];
}

export const PHYSICS_SYLLABUS_TREE: SyllabusChapter[] = [
  {
    id: 'ch_rotational',
    name: 'Rotational Motion & Rigid Body Dynamics',
    totalQuestions: 1420,
    topics: [
      {
        id: 'top_torque',
        name: 'Torque & Angular Equilibrium',
        subtopics: ['Vector Product', 'Equilibrium of Rigid Bodies', 'Couple Moment'],
      },
      {
        id: 'top_moi',
        name: 'Moment of Inertia',
        subtopics: ['Parallel Axes Theorem', 'Perpendicular Axes Theorem', 'Radius of Gyration'],
      },
      {
        id: 'top_angular_momentum',
        name: 'Angular Momentum & Conservation',
        subtopics: ['Conservation of Angular Momentum', 'Keplerian Analogy'],
      },
      {
        id: 'top_rolling',
        name: 'Rolling Motion without Slipping',
        subtopics: ['Kinetic Energy of Rolling Body', 'Instantaneous Centre of Rotation'],
      },
    ],
  },
  {
    id: 'ch_gravitation',
    name: 'Gravitation & Satellite Motion',
    totalQuestions: 980,
    topics: [
      {
        id: 'top_escape_velocity',
        name: 'Escape Velocity & Energy',
        subtopics: ['Gravitational Potential Energy', 'Escape Velocity Calculation'],
      },
      {
        id: 'top_orbital_motion',
        name: 'Orbital Motion & Satellites',
        subtopics: ['Kepler’s Three Laws', 'Geostationary Satellites', 'Binding Energy'],
      },
      {
        id: 'top_gravitational_field',
        name: 'Gravitational Field Intensity',
        subtopics: ['Field due to Solid Sphere', 'Acceleration due to Gravity Variation'],
      },
    ],
  },
  {
    id: 'ch_electricity',
    name: 'Current Electricity & Circuits',
    totalQuestions: 1250,
    topics: [
      {
        id: 'top_ohms_law',
        name: 'Ohm’s Law & Resistance Drift',
        subtopics: ['Drift Velocity', 'Temperature Dependence of Resistance'],
      },
      {
        id: 'top_kirchhoff',
        name: 'Kirchhoff’s Laws & Network Analysis',
        subtopics: ['Loop Rule & Junction Rule', 'Wheatstone Bridge Symmetry'],
      },
      {
        id: 'top_potentiometer',
        name: 'Potentiometer & Meter Bridge',
        subtopics: ['Comparison of EMFs', 'Internal Resistance Measurement'],
      },
    ],
  },
  {
    id: 'ch_thermo',
    name: 'Thermodynamics & Kinetic Theory',
    totalQuestions: 1100,
    topics: [
      {
        id: 'top_carnot',
        name: 'Carnot Engine & Efficiency',
        subtopics: ['First & Second Laws', 'Carnot Cycle Efficiency'],
      },
      {
        id: 'top_isothermal',
        name: 'Thermodynamic Processes',
        subtopics: ['Isothermal & Adiabatic Processes', 'Work Done in Expansion'],
      },
    ],
  },
];

export function Step3Syllabus({ state, onChange, onNext, onPrev }: Step3SyllabusProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<string[]>(['ch_rotational', 'ch_gravitation']);

  const toggleChapterExpand = (chapterId: string) => {
    setExpandedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const toggleChapterSelect = (chapter: SyllabusChapter) => {
    const chapterTopicIds = chapter.topics.map((t) => t.id);
    const isChapterSelected = state.selectedChapters.includes(chapter.id);

    let updatedChapters: string[];
    let updatedTopics: string[];

    if (isChapterSelected) {
      updatedChapters = state.selectedChapters.filter((c) => c !== chapter.id);
      updatedTopics = state.selectedTopics.filter((t) => !chapterTopicIds.includes(t));
    } else {
      updatedChapters = [...state.selectedChapters, chapter.id];
      updatedTopics = Array.from(new Set([...state.selectedTopics, ...chapterTopicIds]));
    }

    onChange({ selectedChapters: updatedChapters, selectedTopics: updatedTopics });
  };

  const toggleTopicSelect = (chapterId: string, topicId: string) => {
    const isTopicSelected = state.selectedTopics.includes(topicId);
    let updatedTopics: string[];

    if (isTopicSelected) {
      updatedTopics = state.selectedTopics.filter((t) => t !== topicId);
    } else {
      updatedTopics = [...state.selectedTopics, topicId];
    }

    // Ensure parent chapter is added to selectedChapters if topic is selected
    let updatedChapters = [...state.selectedChapters];
    if (!updatedChapters.includes(chapterId)) {
      updatedChapters.push(chapterId);
    }

    onChange({ selectedChapters: updatedChapters, selectedTopics: updatedTopics });
  };

  const filteredTree = PHYSICS_SYLLABUS_TREE.filter((ch) => {
    const matchesChapter = ch.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTopics = ch.topics.some((t) => t.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesChapter || matchesTopics;
  });

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            3
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Syllabus Builder</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Select chapters, topics, and subtopics for {state.subject} ({state.exam})
        </p>
      </div>

      {/* Top Search & Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search chapters or topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12.5px] focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 text-[12px]">
          <button
            onClick={() => setExpandedChapters(PHYSICS_SYLLABUS_TREE.map((c) => c.id))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedChapters([])}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree Accordion Container */}
      <div className="space-y-3">
        {filteredTree.map((chapter) => {
          const isExpanded = expandedChapters.includes(chapter.id);
          const isChapterSelected = state.selectedChapters.includes(chapter.id);
          const selectedTopicsCount = chapter.topics.filter((t) => state.selectedTopics.includes(t.id)).length;

          return (
            <div
              key={chapter.id}
              className={`bg-white rounded-2xl border transition-all ${
                isChapterSelected ? 'border-indigo-200 shadow-2xs' : 'border-slate-200'
              }`}
            >
              {/* Chapter Accordion Header */}
              <div className="flex items-center justify-between p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl transition-colors">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleChapterExpand(chapter.id)} className="text-slate-500 hover:text-slate-800">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </button>

                  <input
                    type="checkbox"
                    checked={isChapterSelected}
                    onChange={() => toggleChapterSelect(chapter)}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />

                  <span
                    onClick={() => toggleChapterExpand(chapter.id)}
                    className="text-[14.5px] font-bold text-slate-800 cursor-pointer"
                  >
                    {chapter.name}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11.5px] font-semibold text-slate-500">
                    {selectedTopicsCount}/{chapter.topics.length} Topics
                  </span>
                  <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-100">
                    {chapter.totalQuestions} Qs Available
                  </span>
                </div>
              </div>

              {/* Topics Sub-Tree */}
              {isExpanded && (
                <div className="p-4 pt-1 border-t border-slate-100 space-y-2.5 pl-11">
                  {chapter.topics.map((topic) => {
                    const isTopicSelected = state.selectedTopics.includes(topic.id);

                    return (
                      <div
                        key={topic.id}
                        className={`p-3 rounded-xl border transition-all space-y-1.5 ${
                          isTopicSelected
                            ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900'
                            : 'bg-white border-slate-100 text-slate-700 hover:border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isTopicSelected}
                              onChange={() => toggleTopicSelect(chapter.id, topic.id)}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                            <span className="text-[13px] font-bold">{topic.name}</span>
                          </label>
                        </div>

                        {/* Subtopics Chips */}
                        <div className="flex flex-wrap gap-1.5 pl-6 pt-1">
                          {topic.subtopics.map((sub, idx) => (
                            <span
                              key={idx}
                              className="text-[10.5px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md"
                            >
                              • {sub}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
          ← Back to Sources
        </button>

        <button
          onClick={onNext}
          disabled={state.selectedTopics.length === 0}
          className="px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all disabled:opacity-50"
        >
          Next: Question Planning →
        </button>
      </div>
    </div>
  );
}
