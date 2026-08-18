'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  X,
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  Award,
  Layers,
  FileText,
  Brain,
  Check,
  Plus,
  Trash2,
  Shuffle,
  Send,
  ChevronRight,
  ChevronLeft,
  Search,
  Users,
  Target,
  Zap,
  Paperclip,
  AlertCircle,
  Radio,
  Globe,
  Printer
} from 'lucide-react';
import { batches } from '@/lib/mock-data/teacher';
import { useAcademicContext } from '@/contexts/academic-context';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { useBeforeUnload } from '@/hooks/useMutation';

interface CreateAssignmentModalProps {
  onClose: () => void;
  onSuccess?: (newAssignment: any) => void;
  defaultBatchId?: string;
}

// Data Sources Available
const AVAILABLE_SOURCES = [
  { id: 'pyq', label: 'PYQ', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'ncert', label: 'NCERT', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { id: 'coaching_module', label: 'Coaching Module', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'dpp', label: 'DPP', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'practice_sheet', label: 'Practice Sheet', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { id: 'previous_assignment', label: 'Previous Assignment', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'test_paper', label: 'Test Paper', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'custom_bank', label: 'Custom Question Bank', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'syllabus', label: 'Syllabus', color: 'bg-violet-50 text-violet-700 border-violet-200' },
];

// Sample Chapter & Topic Data
const CHAPTER_DATA = [
  {
    id: 'ch1',
    name: '1. Physical World',
    topics: [
      { id: 't1_1', name: 'Scope of Physics', subtopics: ['Fundamental Forces', 'Nature of Physical Laws'] },
      { id: 't1_2', name: 'Units & Measurements', subtopics: ['SI Units', 'Dimensional Analysis'] }
    ]
  },
  {
    id: 'ch2',
    name: '2. Units & Measurements',
    topics: [
      { id: 't2_1', name: 'Significant Figures', subtopics: ['Rounding Off', 'Error Calculation'] },
      { id: 't2_2', name: 'Dimensions of Physical Quantities', subtopics: ['Dimensional Equations', 'Applications'] }
    ]
  },
  {
    id: 'ch3',
    name: '3. Kinematics',
    topics: [
      { id: 't3_1', name: 'Motion in a Straight Line', subtopics: ['Position-Time Graph', 'Equations of Motion'] },
      { id: 't3_2', name: 'Motion in a Plane', subtopics: ['Projectile Motion', 'Uniform Circular Motion'] }
    ]
  },
  {
    id: 'ch4',
    name: '4. Laws of Motion',
    topics: [
      { id: 't4_1', name: 'Rotational Motion', subtopics: ['Moment of Inertia', 'Torque', 'Angular Momentum', 'Rolling Motion'] },
      { id: 't4_2', name: 'Equilibrium & Friction', subtopics: ['Centre of Mass', 'Conservation of Angular Momentum', 'Gyroscope'] }
    ]
  },
  {
    id: 'ch5',
    name: '5. Work, Energy & Power',
    topics: [
      { id: 't5_1', name: 'Work-Energy Theorem', subtopics: ['Kinetic & Potential Energy', 'Conservation of Energy'] },
      { id: 't5_2', name: 'Collisions', subtopics: ['Elastic Collisions', 'Inelastic Collisions'] }
    ]
  },
  {
    id: 'ch6',
    name: '6. System of Particles',
    topics: [
      { id: 't6_1', name: 'Center of Mass Dynamics', subtopics: ['Linear Momentum', 'Rigid Body Rotation'] }
    ]
  }
];

export function CreateAssignmentModal({ onClose, onSuccess, defaultBatchId }: CreateAssignmentModalProps) {
  const { ctx } = useAcademicContext();
  const initialBatch = defaultBatchId || ctx.batchId || '11A';

  const { state, updateState, clearDraft } = useWizardDraft('create-assignment', {
    currentStep: 1,
    selectedSources: [] as string[],
    selectedChapters: ['ch2', 'ch3', 'ch4'],
    selectedTopics: ['t4_1', 't4_2'],
    selectedSubtopics: ['Moment of Inertia', 'Torque', 'Conservation of Angular Momentum'],
    totalQuestions: 25,
    difficultyMode: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
    difficultyDistribution: { easy: 30, medium: 50, hard: 20 },
    assignmentType: 'general' as 'general' | 'personalized',
    personalizationFactors: {
      weakTopics: true, previousPerformance: true, accuracyTrend: true,
      learningProgress: true, difficultyAdaptation: false, practiceHistory: true
    },
    selectedBatch: initialBatch,
    assignmentTitle: 'Rotational Motion & Kinematics Mastery Set',
    dueDate: '2026-08-15', dueTime: '23:59',
    estimatedTime: 60, marksPerQuestion: 1,
    randomizeQuestions: true, showSolutionsAfterSubmission: true,
    teacherInstructions: 'Complete all numerical steps cleanly on paper. Ensure free body diagrams are drawn for Torque calculations.',
    publishMode: 'online' as 'live' | 'online' | 'offline',
    generatedQuestions: [
      { id: 'q1', num: 1, text: 'A thin uniform rod of length L and mass M is free to rotate about a horizontal axis passing through one end. Calculate its angular acceleration when released from horizontal position.', topic: 'Rotational Motion', subtopic: 'Moment of Inertia', source: 'PYQ (JEE Main 2023)', difficulty: 'Hard', marks: 4 },
      { id: 'q2', num: 2, text: 'Find torque required to stop a wheel having moment of inertia 3 kg m² rotating at 20 rad/s in 10 seconds.', topic: 'Rotational Motion', subtopic: 'Torque', source: 'NCERT Ex 7.4', difficulty: 'Medium', marks: 4 },
      { id: 'q3', num: 3, text: 'A solid cylinder of mass 2 kg and radius 0.2 m rolls down an inclined plane of 30° without slipping. Find acceleration.', topic: 'Rotational Motion', subtopic: 'Rolling Motion', source: 'Coaching Module', difficulty: 'Medium', marks: 4 },
      { id: 'q4', num: 4, text: 'Derive relation between Angular Momentum (L) and Moment of Inertia (I).', topic: 'Rotational Motion', subtopic: 'Angular Momentum', source: 'DPP #14', difficulty: 'Easy', marks: 4 },
      { id: 'q5', num: 5, text: 'Two discs of moments of inertia I₁ and I₂ rotating with angular velocities ω₁ and ω₂ are brought in contact face to face. Find common angular velocity.', topic: 'Rotational Motion', subtopic: 'Conservation of Angular Momentum', source: 'PYQ (JEE Adv 2021)', difficulty: 'Hard', marks: 4 }
    ]
  });

  const {
    currentStep, selectedSources, selectedChapters, selectedTopics, selectedSubtopics,
    totalQuestions, difficultyMode, difficultyDistribution, assignmentType, personalizationFactors,
    selectedBatch, assignmentTitle, dueDate, dueTime, estimatedTime, marksPerQuestion,
    randomizeQuestions, showSolutionsAfterSubmission, teacherInstructions, publishMode, generatedQuestions
  } = state;

  useBeforeUnload(true); // Warn if user tries to leave with modal open

  // Setter adapters to maintain compatibility with existing UI code
  const setCurrentStep = (val: number | ((prev: number) => number)) => updateState({ currentStep: typeof val === 'function' ? val(state.currentStep) : val });
  const setSelectedSources = (val: string[] | ((prev: string[]) => string[])) => updateState({ selectedSources: typeof val === 'function' ? val(state.selectedSources) : val });
  const setSelectedChapters = (val: string[] | ((prev: string[]) => string[])) => updateState({ selectedChapters: typeof val === 'function' ? val(state.selectedChapters) : val });
  const setSelectedTopics = (val: string[] | ((prev: string[]) => string[])) => updateState({ selectedTopics: typeof val === 'function' ? val(state.selectedTopics) : val });
  const setSelectedSubtopics = (val: string[] | ((prev: string[]) => string[])) => updateState({ selectedSubtopics: typeof val === 'function' ? val(state.selectedSubtopics) : val });
  const setTotalQuestions = (val: number) => updateState({ totalQuestions: val });
  const setDifficultyMode = (val: any) => updateState({ difficultyMode: val });
  const setDifficultyDistribution = (val: any) => updateState({ difficultyDistribution: val });
  const setAssignmentType = (val: any) => updateState({ assignmentType: val });
  const setPersonalizationFactors = (val: any) => updateState({ personalizationFactors: typeof val === 'function' ? val(state.personalizationFactors) : val });
  const setSelectedBatch = (val: string) => updateState({ selectedBatch: val });
  const setAssignmentTitle = (val: string) => updateState({ assignmentTitle: val });
  const setDueDate = (val: string) => updateState({ dueDate: val });
  const setDueTime = (val: string) => updateState({ dueTime: val });
  const setEstimatedTime = (val: number) => updateState({ estimatedTime: val });
  const setMarksPerQuestion = (val: number) => updateState({ marksPerQuestion: val });
  const setRandomizeQuestions = (val: boolean | ((prev: boolean) => boolean)) => updateState({ randomizeQuestions: typeof val === 'function' ? val(state.randomizeQuestions) : val });
  const setShowSolutionsAfterSubmission = (val: boolean | ((prev: boolean) => boolean)) => updateState({ showSolutionsAfterSubmission: typeof val === 'function' ? val(state.showSolutionsAfterSubmission) : val });
  const setTeacherInstructions = (val: string) => updateState({ teacherInstructions: val });
  const setPublishMode = (val: any) => updateState({ publishMode: val });
  const setGeneratedQuestions = (val: any) => updateState({ generatedQuestions: typeof val === 'function' ? val(state.generatedQuestions) : val });

  const matchedBatchLabel = batches.find(b => b.id === selectedBatch)?.label || selectedBatch;


  // Filter Helper States for Panel 1 Search
  const [chapterSearch, setChapterSearch] = useState('');
  const [topicSearch, setTopicSearch] = useState('');
  const [subtopicSearch, setSubtopicSearch] = useState('');

  // Custom Source Modal UI States
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [newSourceInput, setNewSourceInput] = useState('');
  const [showAddSourceInput, setShowAddSourceInput] = useState(false);

  // Toggle helpers
  const toggleSource = (id: string) => {
    setSelectedSources((prev: string[]) =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleAddCustomSource = () => {
    if (newSourceInput.trim()) {
      setCustomSources((prev: string[]) => [...prev, newSourceInput.trim()]);
      setSelectedSources((prev: string[]) => [...prev, `custom_${newSourceInput.trim()}`]);
      setNewSourceInput('');
      setShowAddSourceInput(false);
    }
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters((prev: string[]) =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev: string[]) =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const toggleSubtopic = (id: string) => {
    setSelectedSubtopics((prev: string[]) =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  // Filter available topics based on selected chapters
  const availableTopics = CHAPTER_DATA
    .filter(ch => selectedChapters.includes(ch.id))
    .flatMap(ch => ch.topics);

  // Filter available subtopics based on selected topics
  const availableSubtopics = availableTopics
    .filter(t => selectedTopics.includes(t.id))
    .flatMap(t => t.subtopics);

  const calculateTotalMarks = () => totalQuestions * marksPerQuestion;

  // Revised 5 Steps Workflow
  const steps = [
    { num: 1, title: 'Source & Content', subtitle: 'Choose what to include' },
    { num: 2, title: 'Assignment Type', subtitle: 'General or Personalized' },
    { num: 3, title: 'Settings & Options', subtitle: 'Due date, marks & more' },
    { num: 4, title: 'Questions Review', subtitle: assignmentType === 'personalized' ? 'AI Dynamic Generation' : 'Review & set questions' },
    { num: 5, title: 'Publish', subtitle: 'Preview and assign' },
  ];

  // Dynamic Step Next Navigation
  const handleNextStep = () => {
    if (currentStep === 3) {
      if (assignmentType === 'personalized') {
        // Skip Questions Review for Personalized Assignment (AI dynamically generates)
        setCurrentStep(5);
      } else {
        setCurrentStep(4);
      }
    } else if (currentStep < 5) {
      setCurrentStep(prev => prev + 1);
    }
  };

  // Dynamic Step Prev Navigation
  const handlePrevStep = () => {
    if (currentStep === 5 && assignmentType === 'personalized') {
      setCurrentStep(3);
    } else if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handlePublish = () => {
    const createdAssignment = {
      id: `A-${Date.now()}`,
      batchId: selectedBatch,
      title: assignmentTitle,
      dueDate: `${dueDate} ${dueTime}`,
      totalStudents: batches.find(b => b.id === selectedBatch)?.strength || 48,
      submitted: 0,
      status: 'active',
      questionsCount: totalQuestions,
      estimatedTime: `${estimatedTime} Min`,
      type: assignmentType,
    };
    if (onSuccess) onSuccess(createdAssignment);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/65 backdrop-blur-md animate-fadein">
      {/* Container - Fixed SaaS Modal */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-[1340px] h-[92vh] max-h-[920px] flex flex-col overflow-hidden relative">

        {/* ── Top Header Bar ────────────────────────────────────────── */}
        <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-slate-800 leading-tight">Create Assignment</h1>
              <p className="text-[12px] text-slate-500">Build smart assignments in minutes with AI intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                updateState({
                  assignmentTitle: 'JEE Main Rotational Mechanics & Energy Template',
                  selectedChapters: ['ch3', 'ch4', 'ch5'],
                  selectedTopics: ['t4_1', 't5_1'],
                  totalQuestions: 30,
                  difficultyMode: 'mixed',
                });
                toast.success('Loaded Template: JEE Main Mechanics Set', { icon: '📑' });
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[12px] font-semibold transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              Template Library
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Modal Body (Grid: Left Navigation, Middle Content, Right Live Summary) ── */}
        <div className="flex-1 flex overflow-hidden bg-slate-50/50">

          {/* ── PANEL LEFT: Navigation Wizard Steps (240px) ─────────────────────── */}
          <div className="w-[240px] bg-white border-r border-slate-100 p-5 flex flex-col justify-between flex-shrink-0">
            <div className="space-y-6">
              <div className="space-y-3">
                {steps.map(step => {
                  const isPersonalizedDisabled = step.num === 4 && assignmentType === 'personalized';
                  const isActive = currentStep === step.num;
                  const isCompleted = currentStep > step.num;

                  return (
                    <div
                      key={step.num}
                      onClick={() => {
                        if (!isPersonalizedDisabled) {
                          setCurrentStep(step.num);
                        }
                      }}
                      className={`flex items-start gap-3 p-2.5 rounded-2xl transition-all ${
                        isPersonalizedDisabled
                          ? 'opacity-40 cursor-not-allowed bg-slate-50'
                          : isActive
                          ? 'bg-indigo-50/80 border border-indigo-100 text-indigo-900 shadow-xs cursor-pointer'
                          : 'hover:bg-slate-50 text-slate-500 cursor-pointer'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 transition-colors ${
                          isPersonalizedDisabled
                            ? 'bg-slate-200 text-slate-400'
                            : isActive
                            ? 'bg-indigo-600 text-white'
                            : isCompleted
                            ? 'bg-emerald-500 text-white'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-4 h-4" /> : step.num}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className={`text-[13px] font-bold leading-snug ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {step.title}
                          </p>
                          {isPersonalizedDisabled && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700">
                              N/A
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-medium">{step.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Assistant Callout Box */}
            <div className="p-4 bg-gradient-to-br from-indigo-50/70 via-purple-50/50 to-pink-50/70 border border-indigo-100/80 rounded-2xl text-left space-y-2">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-[12px] font-bold">AI Assistant</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Get AI recommendations for topics, difficulty & question balance based on your students' performance.
              </p>
              <button
                onClick={() => {
                  updateState({
                    selectedChapters: ['ch4', 'ch5'],
                    selectedTopics: ['t4_1', 't5_1'],
                    totalQuestions: 20,
                    difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
                  });
                  toast.success('AI Suggestions Applied: 20 Questions on Rotational Motion & Energy', { icon: '✨' });
                }}
                className="w-full mt-2 py-1.5 bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 text-[11.5px] font-bold rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Get Suggestions
              </button>
            </div>
          </div>

          {/* ── PANEL MIDDLE: Dynamic Active Step Content (Flex 1, Scrollable) ───────── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* ════════════ STEP 1: SOURCE & CONTENT ════════════ */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadein">
                {/* 1. Select Source(s) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                      <span className="text-indigo-600">1.</span> Select Source(s)
                    </h3>
                    <span className="text-[12px] text-slate-500 font-medium">{selectedSources.length} selected</span>
                  </div>
                  <p className="text-[12px] text-slate-500 mb-4">Choose one or more academic sources for questions</p>

                  <div className="flex flex-wrap gap-2.5">
                    {AVAILABLE_SOURCES.map(source => {
                      const isSelected = selectedSources.includes(source.id);
                      return (
                        <button
                          key={source.id}
                          onClick={() => toggleSource(source.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all ${
                            isSelected
                              ? `${source.color} ring-2 ring-indigo-400/20 shadow-2xs`
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{source.label}</span>
                          {isSelected && <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />}
                        </button>
                      );
                    })}

                    {customSources.map(cs => {
                      const id = `custom_${cs}`;
                      const isSelected = selectedSources.includes(id);
                      return (
                        <button
                          key={id}
                          onClick={() => toggleSource(id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-semibold transition-all ${
                            isSelected
                              ? 'bg-purple-50 text-purple-700 border-purple-200 ring-2 ring-purple-400/20 shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>{cs}</span>
                          {isSelected && <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />}
                        </button>
                      );
                    })}

                    {showAddSourceInput ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Source name..."
                          value={newSourceInput}
                          onChange={e => setNewSourceInput(e.target.value)}
                          className="px-3 py-1 border border-indigo-300 rounded-xl text-[12px] focus:outline-none"
                          autoFocus
                        />
                        <button
                          onClick={handleAddCustomSource}
                          className="px-3 py-1 bg-indigo-600 text-white text-[12px] font-bold rounded-xl hover:bg-indigo-700"
                        >
                          Add
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddSourceInput(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 bg-indigo-50/50 text-indigo-600 hover:bg-indigo-50 text-[12px] font-semibold transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Other Source
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Select Content (Chapters, Topics, Subtopics) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-indigo-600">2.</span> Select Content
                  </h3>
                  <p className="text-[12px] text-slate-500">Select chapters, topics and optional subtopics</p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Chapters Column */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 flex flex-col h-[280px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold text-slate-700">
                          Chapters ({selectedChapters.length} selected)
                        </span>
                      </div>
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search chapters..."
                          value={chapterSearch}
                          onChange={e => setChapterSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11.5px] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                        {CHAPTER_DATA.filter(c => c.name.toLowerCase().includes(chapterSearch.toLowerCase())).map(ch => {
                          const isSel = selectedChapters.includes(ch.id);
                          return (
                            <label
                              key={ch.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                                isSel ? 'bg-indigo-50/80 text-indigo-900 font-semibold' : 'hover:bg-white text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggleChapter(ch.id)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                              />
                              <span className="truncate">{ch.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {selectedChapters.length === CHAPTER_DATA.length ? (
                        <button
                          onClick={() => setSelectedChapters([])}
                          className="mt-2 text-[11px] font-bold text-rose-600 hover:text-rose-800 text-left cursor-pointer"
                        >
                          - Remove All
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedChapters(CHAPTER_DATA.map(c => c.id))}
                          className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 text-left cursor-pointer"
                        >
                          + Select All
                        </button>
                      )}
                    </div>

                    {/* Topics Column */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 flex flex-col h-[280px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold text-slate-700">
                          Topics ({selectedTopics.length} selected)
                        </span>
                      </div>
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search topics..."
                          value={topicSearch}
                          onChange={e => setTopicSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11.5px] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                        {availableTopics.filter(t => t.name.toLowerCase().includes(topicSearch.toLowerCase())).map(t => {
                          const isSel = selectedTopics.includes(t.id);
                          return (
                            <label
                              key={t.id}
                              className={`flex items-center gap-2.5 p-2 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                                isSel ? 'bg-indigo-50/80 text-indigo-900 font-semibold' : 'hover:bg-white text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggleTopic(t.id)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                              />
                              <span className="truncate">{t.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {selectedTopics.length > 0 && selectedTopics.length === availableTopics.length ? (
                        <button
                          onClick={() => setSelectedTopics([])}
                          className="mt-2 text-[11px] font-bold text-rose-600 hover:text-rose-800 text-left cursor-pointer"
                        >
                          - Remove All
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedTopics(availableTopics.map(t => t.id))}
                          className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 text-left cursor-pointer"
                        >
                          + Select All
                        </button>
                      )}
                    </div>

                    {/* Subtopics Column */}
                    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/40 flex flex-col h-[280px]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[12px] font-bold text-slate-700">Subtopics (Optional)</span>
                      </div>
                      <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Search subtopics..."
                          value={subtopicSearch}
                          onChange={e => setSubtopicSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[11.5px] focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                        {availableSubtopics.filter(s => s.toLowerCase().includes(subtopicSearch.toLowerCase())).map(sub => {
                          const isSel = selectedSubtopics.includes(sub);
                          return (
                            <label
                              key={sub}
                              className={`flex items-center gap-2.5 p-2 rounded-lg text-[12px] font-medium cursor-pointer transition-colors ${
                                isSel ? 'bg-indigo-50/80 text-indigo-900 font-semibold' : 'hover:bg-white text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSel}
                                onChange={() => toggleSubtopic(sub)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                              />
                              <span className="truncate">{sub}</span>
                            </label>
                          );
                        })}
                      </div>
                      {selectedSubtopics.length > 0 && selectedSubtopics.length === availableSubtopics.length ? (
                        <button
                          onClick={() => setSelectedSubtopics([])}
                          className="mt-2 text-[11px] font-bold text-rose-600 hover:text-rose-800 text-left cursor-pointer"
                        >
                          - Remove All
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedSubtopics(availableSubtopics)}
                          className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 text-left cursor-pointer"
                        >
                          + Select All
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Question Configuration (Question Range removed per request #2) */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <h3 className="text-[15px] font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-indigo-600">3.</span> Question Configuration
                  </h3>
                  <p className="text-[12px] text-slate-500">Define total number of questions and difficulty distribution</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Total Questions */}
                    <div className="space-y-4">
                      <div>
                        <label className="text-[12px] font-bold text-slate-700 block mb-1.5">Total Questions</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={totalQuestions}
                            onChange={e => setTotalQuestions(Number(e.target.value))}
                            className="w-32 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[12px] font-semibold text-slate-500">Questions</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Difficulty Level Selector */}
                    <div className="space-y-3">
                      <label className="text-[12px] font-bold text-slate-700 block">Difficulty Level</label>
                      <div className="grid grid-cols-4 gap-2 bg-slate-100 p-1 rounded-xl">
                        {(['easy', 'medium', 'hard', 'mixed'] as const).map(lvl => (
                          <button
                            key={lvl}
                            onClick={() => setDifficultyMode(lvl)}
                            className={`py-1.5 text-[12px] font-bold capitalize rounded-lg transition-all ${
                              difficultyMode === lvl
                                ? 'bg-white text-indigo-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>

                      {/* Distribution visualization */}
                      <div className="pt-2">
                        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                          <div style={{ width: `${difficultyDistribution.easy}%` }} className="bg-emerald-500" title="Easy" />
                          <div style={{ width: `${difficultyDistribution.medium}%` }} className="bg-amber-500" title="Medium" />
                          <div style={{ width: `${difficultyDistribution.hard}%` }} className="bg-rose-500" title="Hard" />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-medium">
                          <span className="text-emerald-700 font-bold">{difficultyDistribution.easy}% Easy ({Math.round(totalQuestions * 0.3)} Qs)</span>
                          <span className="text-amber-700 font-bold">{difficultyDistribution.medium}% Medium ({Math.round(totalQuestions * 0.5)} Qs)</span>
                          <span className="text-rose-700 font-bold">{difficultyDistribution.hard}% Hard ({Math.round(totalQuestions * 0.2)} Qs)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════ STEP 2: ASSIGNMENT TYPE ════════════ */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadein">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <h3 className="text-[15px] font-bold text-slate-800">Select Assignment Delivery Type</h3>
                  <p className="text-[12px] text-slate-500">Choose how the assignment will be assigned to batch students</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Option 1: General Assignment */}
                    <div
                      onClick={() => setAssignmentType('general')}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all space-y-3 ${
                        assignmentType === 'general'
                          ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-600/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                          <Users className="w-5 h-5" />
                        </div>
                        <input
                          type="radio"
                          name="assignmentType"
                          checked={assignmentType === 'general'}
                          onChange={() => setAssignmentType('general')}
                          className="w-4 h-4 text-indigo-600"
                        />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-slate-800">General Assignment</h4>
                        <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                          Same uniform question set sent to every student in the selected batch. Requires manual Questions Review in Step 4.
                        </p>
                      </div>
                    </div>

                    {/* Option 2: Personalized Assignment */}
                    <div
                      onClick={() => setAssignmentType('personalized')}
                      className={`p-5 rounded-2xl border-2 cursor-pointer transition-all space-y-3 ${
                        assignmentType === 'personalized'
                          ? 'border-purple-600 bg-purple-50/40 ring-4 ring-purple-600/10'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                          <Brain className="w-5 h-5" />
                        </div>
                        <input
                          type="radio"
                          name="assignmentType"
                          checked={assignmentType === 'personalized'}
                          onChange={() => setAssignmentType('personalized')}
                          className="w-4 h-4 text-purple-600"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-bold text-slate-800">Personalized Assignment</h4>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 uppercase tracking-wider">
                            AI Powered
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                          AI generates unique question sets tailored specifically for each student based on their performance. (Bypasses Step 4 paper review).
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* AI Personalization Factors Setup */}
                  {assignmentType === 'personalized' && (
                    <div className="p-4 bg-purple-50/60 border border-purple-100 rounded-xl space-y-3 animate-fadein">
                      <h4 className="text-[13px] font-bold text-purple-900 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Configure AI Personalization Logic
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
                        {Object.entries(personalizationFactors).map(([key, enabled]) => (
                          <label key={key} className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-purple-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={() =>
                                setPersonalizationFactors((prev: any) => ({
                                  ...prev,
                                  [key]: !prev[key as keyof typeof prev]
                                }))
                              }
                              className="rounded text-purple-600"
                            />
                            <span className="capitalize font-semibold text-slate-700">
                              {key.replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ════════════ STEP 3: SETTINGS & OPTIONS ════════════ */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadein">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-5">
                  <h3 className="text-[15px] font-bold text-slate-800">Additional Options & Deadline Settings</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[12px] font-bold text-slate-700">Target Batch</label>
                        {(defaultBatchId || ctx.batchId) && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                            ⚡ Pre-filled from Class View
                          </span>
                        )}
                      </div>
                      <select
                        value={selectedBatch}
                        onChange={e => setSelectedBatch(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-semibold text-slate-800 focus:outline-none"
                      >
                        {batches.map(b => (
                          <option key={b.id} value={b.id}>
                            Batch {b.label} ({b.strength} Students)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">Assignment Title</label>
                      <input
                        type="text"
                        value={assignmentTitle}
                        onChange={e => setAssignmentTitle(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-medium focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">Due Date & Time</label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => setDueDate(e.target.value)}
                          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium"
                        />
                        <input
                          type="time"
                          value={dueTime}
                          onChange={e => setDueTime(e.target.value)}
                          className="w-28 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">Estimated Solving Time</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={estimatedTime}
                          onChange={e => setEstimatedTime(Number(e.target.value))}
                          className="w-28 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800"
                        />
                        <span className="text-[12px] text-slate-500 font-semibold">Minutes</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <h4 className="text-[13px] font-bold text-slate-800">Scoring & Submission Rules</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[12.5px]">
                      <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                        <span className="font-semibold text-slate-700">Randomize Question Order</span>
                        <input
                          type="checkbox"
                          checked={randomizeQuestions}
                          onChange={e => setRandomizeQuestions(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                      </label>

                      <label className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                        <span className="font-semibold text-slate-700">Show Solutions After Submission</span>
                        <input
                          type="checkbox"
                          checked={showSolutionsAfterSubmission}
                          onChange={e => setShowSolutionsAfterSubmission(e.target.checked)}
                          className="rounded text-indigo-600"
                        />
                      </label>
                    </div>

                    <div>
                      <label className="text-[12px] font-bold text-slate-700 block mb-1">Teacher Instructions</label>
                      <textarea
                        rows={3}
                        value={teacherInstructions}
                        onChange={e => setTeacherInstructions(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ════════════ STEP 4: QUESTIONS REVIEW ════════════ */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadein">
                {assignmentType === 'personalized' ? (
                  <div className="p-6 bg-purple-50/70 border border-purple-200 rounded-2xl text-purple-950 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-[16px] font-bold">Personalized AI Assignment Active</h3>
                        <p className="text-[12.5px] text-purple-800">Dynamic question sets generated individually per student</p>
                      </div>
                    </div>
                    <p className="text-[12.5px] text-purple-800 leading-relaxed">
                      Since you selected <b>Personalized Assignment</b>, a single fixed paper review is not applicable. When you click Publish, the AI engine will dynamically compose customized question papers for each of the <b>{batches.find(b => b.id === selectedBatch)?.strength || 48} students</b> in Batch {selectedBatch} based on their weak topics, accuracy, and previous test history.
                    </p>
                    <button
                      onClick={() => setCurrentStep(5)}
                      className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[12.5px] rounded-xl transition-all shadow-xs inline-flex items-center gap-1.5"
                    >
                      Proceed to Publish <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-[15px] font-bold text-slate-800">Questions Review</h3>
                        <p className="text-[12px] text-slate-500">Review, add or replace questions for General Assignment paper</p>
                      </div>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-[12px] font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100">
                        <Shuffle className="w-3.5 h-3.5" />
                        Re-generate Questions
                      </button>
                    </div>

                    <div className="space-y-3">
                      {generatedQuestions.map((q) => (
                        <div key={q.id} className="p-4 border border-slate-200 rounded-xl bg-white hover:border-indigo-200 transition-all space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-[12px] flex items-center justify-center">
                                Q{q.num}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                q.difficulty === 'Hard' ? 'bg-rose-100 text-rose-700' :
                                q.difficulty === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                'bg-emerald-100 text-emerald-700'
                              }`}>
                                {q.difficulty}
                              </span>
                              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                                {q.source}
                              </span>
                            </div>
                            <button
                              onClick={() => setGeneratedQuestions((prev: any[]) => prev.filter((item: any) => item.id !== q.id))}
                              className="text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[13px] font-medium text-slate-800 pl-8 leading-relaxed">
                            {q.text}
                          </p>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pl-8 pt-1">
                            <span>Topic: {q.topic} ({q.subtopic})</span>
                            <span className="font-semibold text-slate-600">{q.marks} Marks</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button className="w-full py-2.5 border-2 border-dashed border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 hover:text-indigo-600 text-[12.5px] font-bold flex items-center justify-center gap-2 transition-all">
                      <Plus className="w-4 h-4" /> Add Custom Question
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ════════════ STEP 5: PUBLISH ════════════ */}
            {currentStep === 5 && (
              <div className="space-y-6 animate-fadein">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                        Ready to Publish
                      </span>
                      <h3 className="text-[18px] font-bold text-slate-800 mt-1">{assignmentTitle}</h3>
                    </div>
                    <button
                      onClick={handlePublish}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] rounded-xl shadow-md transition-all flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" /> Publish {publishMode.toUpperCase()} to Batch {selectedBatch}
                    </button>
                  </div>

                  {/* 3 Assignment Delivery Modes */}
                  <div className="space-y-3">
                    <label className="text-[13px] font-bold text-slate-800 block">Select Assignment Mode</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                      {/* 1. Live Assignment */}
                      <div
                        onClick={() => setPublishMode('live')}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 relative ${
                          publishMode === 'live'
                            ? 'border-rose-500 bg-rose-50/40 ring-4 ring-rose-500/10'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
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
                            className="w-4 h-4 text-rose-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-[13.5px] font-bold text-slate-800">1. Live Assignment</h4>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 uppercase">
                              Classroom
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                            Timed real-time exam with live countdown, teacher proctoring & live leaderboard during session.
                          </p>
                        </div>
                      </div>

                      {/* 2. Online Assignment */}
                      <div
                        onClick={() => setPublishMode('online')}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 relative ${
                          publishMode === 'online'
                            ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-600/10'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
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
                            className="w-4 h-4 text-indigo-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-[13.5px] font-bold text-slate-800">2. Online Assignment</h4>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 uppercase">
                              App / Web
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                            Standard digital homework/test mode accessible on student app until submission deadline.
                          </p>
                        </div>
                      </div>

                      {/* 3. Offline Assignment */}
                      <div
                        onClick={() => setPublishMode('offline')}
                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 relative ${
                          publishMode === 'offline'
                            ? 'border-amber-600 bg-amber-50/40 ring-4 ring-amber-600/10'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
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
                            className="w-4 h-4 text-amber-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-[13.5px] font-bold text-slate-800">3. Offline Assignment</h4>
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                              Print PDF & OMR
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                            Generate printable question paper & OMR sheets for pen-and-paper evaluation.
                          </p>
                        </div>
                      </div>

                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Batch Target</p>
                      <p className="text-[14px] font-bold text-slate-800 mt-0.5">Batch {selectedBatch}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Mode</p>
                      <p className="text-[14px] font-bold text-slate-800 mt-0.5 capitalize flex items-center gap-1">
                        {publishMode === 'live' && <Radio className="w-3.5 h-3.5 text-rose-500" />}
                        {publishMode === 'online' && <Globe className="w-3.5 h-3.5 text-indigo-500" />}
                        {publishMode === 'offline' && <Printer className="w-3.5 h-3.5 text-amber-500" />}
                        {publishMode}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Estimated Time</p>
                      <p className="text-[14px] font-bold text-slate-800 mt-0.5">{estimatedTime} Mins</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[11px] text-slate-400 font-bold uppercase">Due Date</p>
                      <p className="text-[14px] font-bold text-slate-800 mt-0.5">{dueDate}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-[12.5px]">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <span>Selected <b>{publishMode.toUpperCase()} Assignment</b> mode. Click <b>Publish</b> to generate or dispatch to students.</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── PANEL RIGHT: Live Assignment Summary & AI Recommendations (280px) ───── */}
          <div className="w-[300px] bg-white border-l border-slate-100 p-5 flex flex-col justify-between flex-shrink-0 overflow-y-auto space-y-5">
            <div className="space-y-5">

              {/* Assignment Summary Header */}
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-bold text-slate-800">Assignment Summary</h3>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" /> Live Preview
                </span>
              </div>

              {/* Selected Sources Badges */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Sources</span>
                {selectedSources.length === 0 ? (
                  <p className="text-[11.5px] text-slate-400 italic">No sources selected yet</p>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {selectedSources.map(src => {
                      const match = AVAILABLE_SOURCES.find(s => s.id === src);
                      return (
                        <span key={src} className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold border ${match?.color || 'bg-slate-100 text-slate-600'}`}>
                          {match?.label || src.replace('custom_', '')}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Content counters */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Content</span>
                <p className="text-[12.5px] font-bold text-slate-800">
                  {selectedChapters.length} Chapters · {selectedTopics.length} Topics · {selectedSubtopics.length} Subtopics
                </p>
              </div>

              {/* Questions count */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Questions</span>
                <p className="text-[12.5px] font-bold text-slate-800">
                  {totalQuestions} Questions · <span className="capitalize">{difficultyMode} Difficulty</span>
                </p>
              </div>

              {/* Assignment Type & Mode */}
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Assignment Type & Mode</span>
                <div className="flex flex-wrap gap-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-bold ${
                    assignmentType === 'personalized'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {assignmentType === 'personalized' ? <Brain className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    {assignmentType === 'personalized' ? 'Personalized (AI)' : 'General'}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11.5px] font-bold capitalize ${
                    publishMode === 'live' ? 'bg-rose-100 text-rose-700' :
                    publishMode === 'online' ? 'bg-indigo-100 text-indigo-700' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {publishMode === 'live' && <Radio className="w-3 h-3 text-rose-600" />}
                    {publishMode === 'online' && <Globe className="w-3 h-3 text-indigo-600" />}
                    {publishMode === 'offline' && <Printer className="w-3 h-3 text-amber-700" />}
                    {publishMode} Mode
                  </span>
                </div>
              </div>

              {/* Est Time & Marks */}
              <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Est. Time</p>
                  <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> {estimatedTime} Min
                  </p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Total Marks</p>
                  <p className="text-[13px] font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                    <Award className="w-3.5 h-3.5 text-amber-500" /> {calculateTotalMarks()}
                  </p>
                </div>
              </div>

              {/* AI Recommendations Card */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-indigo-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> AI Recommendations
                  </span>
                  <button className="text-[10.5px] font-bold text-indigo-600 hover:underline">View Details</button>
                </div>

                <div className="space-y-2 text-[11.5px]">
                  <div className="flex items-start gap-2 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>Good balance of difficulty levels. Ideal for practice.</span>
                  </div>
                  <div className="flex items-start gap-2 text-amber-800">
                    <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span>Add more questions from PYQ. Students score 18% higher on PYQs.</span>
                  </div>
                  <div className="flex items-start gap-2 text-indigo-800">
                    <Target className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <span>32% students weak in Rotational Motion. Consider extra questions.</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Need Help AI Box */}
            <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl space-y-2 text-left">
              <p className="text-[12px] font-bold">Need Help?</p>
              <p className="text-[11px] text-indigo-100">Let AI suggest the best assignment configuration for your students.</p>
              <button className="w-full py-2 bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-[12px] rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 mt-2">
                Generate with AI ✨
              </button>
            </div>
          </div>
        </div>

        {/* ── Modal Footer Bar Navigation ─────────────────────────────── */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 text-[12.5px] font-bold rounded-xl transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={handlePrevStep}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 text-[12.5px] font-bold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            
            {currentStep < 5 ? (
              <button
                onClick={handleNextStep}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                Next: {
                  currentStep === 3 && assignmentType === 'personalized'
                    ? steps[4]?.title || 'Next'
                    : steps[currentStep]?.title || 'Next'
                } <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handlePublish}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <Send className="w-4 h-4" /> Publish Assignment
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
