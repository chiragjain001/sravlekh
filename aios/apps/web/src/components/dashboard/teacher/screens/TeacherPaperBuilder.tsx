'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  FolderKanban,
  FileCheck,
  HelpCircle,
  X,
  ChevronRight,
  Moon,
  Bell,
  CheckCircle2,
  ChevronDown,
  Trash2,
  Clock,
  Search,
  Plus,
  ArrowRight,
  Check
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';
import { batches, teacherProfile } from '@/lib/mock-data/teacher';

// Subcomponents
import { AssessmentSummaryPanel, AssessmentState } from '../assessment-builder/AssessmentSummaryPanel';
import { AiAssistantModal } from '../assessment-builder/AiAssistantModal';
import { Step1Details } from '../assessment-builder/steps/Step1Details';
import { Step2Sources } from '../assessment-builder/steps/Step2Sources';
import { Step3Syllabus } from '../assessment-builder/steps/Step3Syllabus';
import { Step4Planning } from '../assessment-builder/steps/Step4Planning';
import { Step5Rules } from '../assessment-builder/steps/Step5Rules';
import { Step6Strategy } from '../assessment-builder/steps/Step6Strategy';
import { Step7Preview } from '../assessment-builder/steps/Step7Preview';
import { Step8Generate } from '../assessment-builder/steps/Step8Generate';

const STEP_NAMES = [
  { num: 1, label: 'Details' },
  { num: 2, label: 'Sources' },
  { num: 3, label: 'Syllabus' },
  { num: 4, label: 'Planning' },
  { num: 5, label: 'Rules' },
  { num: 6, label: 'Strategy' },
  { num: 7, label: 'Preview' },
  { num: 8, label: 'Generate' },
];

export function TeacherPaperBuilder() {
  const { teacherCtx, setTeacherNav } = useDashboardStore();
  const { classId, subjectId, batchId } = teacherCtx;

  // Active step (1 to 8)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // Pre-fill initial context details based on active class / batch context
  const initialContext = React.useMemo(() => {
    const activeSubLabel = subjectId === 'maths' ? 'Mathematics' : subjectId === 'chemistry' ? 'Chemistry' : subjectId === 'biology' ? 'Biology' : 'Physics';
    const activeExamLabel = classId === '12' ? 'NEET 2026' : 'NEET 2027';

    let defaultBatches: string[] = ['Batch 11A', 'Batch 11B', 'Batch 11C'];
    let defaultTitle = 'Physics Weekly Test 08';

    if (batchId) {
      const matchBatch = batches.find(b => b.id === batchId);
      const labelText = matchBatch ? matchBatch.label : batchId;
      defaultBatches = [`Batch ${labelText}`];
      defaultTitle = `${activeSubLabel} Test (Batch ${labelText})`;
    } else if (classId) {
      const classBatches = batches.filter(b => b.classId === classId);
      if (classBatches.length > 0) {
        defaultBatches = classBatches.map(b => `Batch ${b.label}`);
      }
      defaultTitle = `Class ${classId} ${activeSubLabel} Weekly Test`;
    }

    return {
      exam: activeExamLabel,
      subject: activeSubLabel,
      batches: defaultBatches,
      title: defaultTitle,
    };
  }, [classId, subjectId, batchId]);

  // Modals state for header utilities
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Saved Drafts List
  const [draftsList, setDraftsList] = useState([
    {
      id: 'draft-1',
      title: 'Physics Weekly Mock Test 07',
      type: 'Weekly Test',
      date: '2 hours ago',
      questions: 35,
      subject: 'Physics',
    },
    {
      id: 'draft-2',
      title: 'Rotational Motion Chapter Quiz',
      type: 'Chapter Test',
      date: 'Yesterday',
      questions: 20,
      subject: 'Physics',
    },
    {
      id: 'draft-3',
      title: 'NEET Gravitation Practice Set',
      type: 'DPP',
      date: '3 days ago',
      questions: 15,
      subject: 'Physics',
    },
  ]);

  // Global Assessment State
  const [assessmentState, setAssessmentState] = useState<AssessmentState>(() => ({
    title: initialContext.title,
    type: 'Weekly Test',
    exam: initialContext.exam,
    subject: initialContext.subject,
    batches: initialContext.batches,
    duration: 120,
    totalMarks: 240,
    negativeMarking: '-1 for each wrong answer',
    instructions: 'Add special instructions for students...',
    scheduleType: 'later',
    dueDate: '2024-05-28',
    startTime: '09:00',
    endTime: '11:00',
    shuffleQuestions: true,
    shuffleOptions: true,
    showSolutions: false,
    selectedSources: ['NCERT', 'PYQ', 'Institute Module', 'DPP', 'Teacher Questions'],
    selectedChapters: ['ch_rotational', 'ch_gravitation', 'ch_electricity'],
    selectedTopics: ['top_torque', 'top_moi', 'top_angular_momentum', 'top_escape_velocity', 'top_orbital_motion'],
    chapterQuestionPlan: {
      ch_rotational: { easy: 4, medium: 6, hard: 2 },
      ch_gravitation: { easy: 3, medium: 5, hard: 2 },
      ch_electricity: { easy: 2, medium: 4, hard: 2 },
    },
    questionTypes: ['MCQ', 'Numerical'],
    allowRepeat: false,
    avoidRecentDays: 60,
    minRating: 4.0,
    paperSetsCount: 1,
    strategy: 'general',
  }));

  // Sync state if initialContext changes
  React.useEffect(() => {
    setAssessmentState((prev) => ({
      ...prev,
      title: initialContext.title,
      exam: initialContext.exam,
      subject: initialContext.subject,
      batches: initialContext.batches,
    }));
  }, [initialContext]);

  const updateState = (updates: Partial<AssessmentState>) => {
    setAssessmentState((prev) => ({ ...prev, ...updates }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleSaveDraft = () => {
    const newDraft = {
      id: `draft-${Date.now()}`,
      title: assessmentState.title || 'Untitled Draft',
      type: assessmentState.type,
      date: 'Just now',
      questions: 30,
      subject: assessmentState.subject,
    };
    setDraftsList((prev) => [newDraft, ...prev]);
    showToast('Draft successfully saved to cloud drafts!');
  };

  // Compute stats for summary panel
  let easyCount = 0;
  let medCount = 0;
  let hardCount = 0;

  Object.values(assessmentState.chapterQuestionPlan).forEach((plan) => {
    easyCount += plan.easy || 0;
    medCount += plan.medium || 0;
    hardCount += plan.hard || 0;
  });

  const totalQuestions = easyCount + medCount + hardCount || 40;
  const easyPct = Math.round((easyCount / totalQuestions) * 100) || 30;
  const medPct = Math.round((medCount / totalQuestions) * 100) || 50;
  const hardPct = 100 - easyPct - medPct;

  const estimatedTime = Math.round(totalQuestions * 3);
  const qualityScore = 82;
  const availableQuestionsCount = 12540;

  // AI Prompt fill handler
  const handleApplyAiPrompt = (promptText: string) => {
    updateState({
      title: 'AI Generated NEET Physics Test',
      type: 'Weekly Test',
      exam: 'NEET 2027',
      duration: 120,
      totalMarks: 240,
      selectedSources: ['NCERT', 'PYQ', 'Institute Module'],
      selectedChapters: ['ch_rotational', 'ch_gravitation'],
      selectedTopics: ['top_torque', 'top_moi', 'top_escape_velocity'],
      chapterQuestionPlan: {
        ch_rotational: { easy: 5, medium: 7, hard: 3 },
        ch_gravitation: { easy: 4, medium: 6, hard: 2 },
      },
      strategy: 'personalized',
    });
    setCurrentStep(4);
    showToast('AI filled assessment state!');
  };

  // Progress calculation
  const progressPct = Math.round((currentStep / 8) * 100);

  // ── Step Validation (P2-1) ───────────────────────────────────────────
  const canAdvance = (stepNum: number): { valid: boolean; error?: string } => {
    if (stepNum === 1) {
      if (!assessmentState.title.trim()) return { valid: false, error: 'Please enter an Assessment Title.' };
      if (!assessmentState.batches.length) return { valid: false, error: 'Please select at least one Batch.' };
    }
    if (stepNum === 2) {
      if (!assessmentState.selectedSources.length) return { valid: false, error: 'Please select at least one Question Source.' };
    }
    if (stepNum === 3) {
      if (!assessmentState.selectedChapters.length) return { valid: false, error: 'Please select at least one Chapter.' };
    }
    if (stepNum === 4) {
      if (totalQuestions <= 0) return { valid: false, error: 'Total questions must be greater than 0.' };
    }
    if (stepNum === 5) {
      if (assessmentState.duration <= 0) return { valid: false, error: 'Please set a valid exam duration.' };
      if (assessmentState.totalMarks <= 0) return { valid: false, error: 'Please set valid total marks.' };
    }
    return { valid: true };
  };

  const handleNextStep = (targetStep: number) => {
    // Validate current step before advancing
    const check = canAdvance(currentStep);
    if (targetStep > currentStep && !check.valid) {
      showToast(check.error || 'Please complete required fields before advancing.');
      return;
    }
    setCurrentStep(targetStep);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden font-sans text-slate-800 animate-fadein relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-slate-900 text-white font-bold text-[13px] rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Top Bar (Institute Context & Header Actions) ────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        {/* Left: Dropdown selectors for Context */}
        <div className="flex items-center gap-3 text-[12.5px] font-bold">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/80 text-indigo-900 border border-indigo-200/80 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors">
            <span>{assessmentState.exam}</span>
            <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50/80 text-indigo-900 border border-indigo-200/80 rounded-xl cursor-pointer hover:bg-indigo-100 transition-colors">
            <span>{assessmentState.subject}</span>
            <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
            <span className="text-slate-600 font-normal">
              🏫 {batchId ? `Batch ${batchId}` : classId ? `Class ${classId}` : 'Ahmedabad Branch'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </div>
        </div>

        {/* Right Top Bar Utility Items */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => showToast('Dark mode toggled')}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <Moon className="w-4.5 h-4.5" />
          </button>

          <div
            onClick={() => showToast('12 Notifications')}
            className="relative p-2 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute top-1 right-1 bg-rose-500 text-white text-[9px] font-extrabold px-1 rounded-full">
              12
            </span>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-[12px] shadow-2xs">
              RS
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[12.5px] font-bold text-slate-800 leading-tight">Rahul Sharma</p>
              <p className="text-[10px] text-slate-400 font-semibold">Physics Faculty</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sub Header Bar: Title & Utility Buttons ──────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-[19px] font-extrabold text-slate-800 flex items-center gap-2">
            Assessment Builder <Sparkles className="w-4.5 h-4.5 text-indigo-600 fill-indigo-600" />
          </h1>
          <p className="text-[12px] text-slate-500">Create high-quality tests in less than 2 minutes</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[12px] font-bold rounded-xl transition-colors shadow-2xs"
          >
            <FolderKanban className="w-4 h-4 text-indigo-600" /> Template Library
          </button>

          <button
            onClick={() => setIsDraftsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold rounded-xl transition-colors shadow-2xs"
          >
            <FileCheck className="w-4 h-4 text-slate-500" /> Saved Drafts ({draftsList.length})
          </button>

          <button
            onClick={() => setIsQuestionBankOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[12px] font-bold rounded-xl transition-colors shadow-2xs"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" /> Question Bank
          </button>

          <button
            onClick={() => showToast('AIOS Assessment Help Center')}
            className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTeacherNav('today')}
            className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 8-Step Wizard Stepper Header Bar ────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex-shrink-0">
        {/* Mobile Compact Stepper (sm:hidden) */}
        <div className="sm:hidden flex items-center justify-between">
          <span className="text-[12.5px] font-bold text-slate-800">
            Step {currentStep} of 8: <span className="text-indigo-600">{STEP_NAMES[currentStep - 1]?.label}</span>
          </span>
          <div className="flex items-center gap-2">
            <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-600 h-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            <span className="text-[11px] font-bold text-slate-500">{progressPct}%</span>
          </div>
        </div>

        {/* Desktop Full Stepper (hidden sm:block) */}
        <div className="hidden sm:block overflow-x-auto custom-scrollbar">
          <div className="flex items-center justify-between min-w-[760px] gap-2">
            {STEP_NAMES.map((step, idx) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;

              return (
                <React.Fragment key={step.num}>
                  <div
                    onClick={() => handleNextStep(step.num)}
                    className={`flex items-center gap-2 cursor-pointer p-1.5 rounded-xl transition-all ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-900 font-extrabold'
                        : isCompleted
                        ? 'text-slate-700 font-bold hover:bg-slate-50'
                        : 'text-slate-400 font-medium hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isCompleted ? '✓' : step.num}
                    </div>
                    <span className="text-[12.5px] whitespace-nowrap">{step.label}</span>
                  </div>

                  {idx < STEP_NAMES.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Main Workspace Body (Flex 1: Left Form Steps, Right Live Summary) ─ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Step Workspace Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {currentStep === 1 && (
            <Step1Details
              state={assessmentState}
              onChange={updateState}
              availableBatches={batches.map((b) => ({ id: b.id, name: `Batch ${b.label}` }))}
              onNext={() => handleNextStep(2)}
            />
          )}

          {currentStep === 2 && (
            <Step2Sources
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(3)}
              onPrev={() => setCurrentStep(1)}
            />
          )}

          {currentStep === 3 && (
            <Step3Syllabus
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(4)}
              onPrev={() => setCurrentStep(2)}
            />
          )}

          {currentStep === 4 && (
            <Step4Planning
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(5)}
              onPrev={() => setCurrentStep(3)}
            />
          )}

          {currentStep === 5 && (
            <Step5Rules
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(6)}
              onPrev={() => setCurrentStep(4)}
            />
          )}

          {currentStep === 6 && (
            <Step6Strategy
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(7)}
              onPrev={() => setCurrentStep(5)}
            />
          )}

          {currentStep === 7 && (
            <Step7Preview
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(8)}
              onPrev={() => setCurrentStep(6)}
            />
          )}

          {currentStep === 8 && (
            <Step8Generate
              state={assessmentState}
              onPrev={() => setCurrentStep(7)}
              onPublishSuccess={() => setTeacherNav('tests-exams')}
            />
          )}
        </div>

        {/* Live Summary Side Panel (Desktop Right Side) */}
        <AssessmentSummaryPanel
          state={assessmentState}
          totalQuestions={totalQuestions}
          difficultyMix={{ easyPct, medPct, hardPct }}
          estimatedTime={estimatedTime}
          qualityScore={qualityScore}
          availableQuestionsCount={availableQuestionsCount}
          onOpenAiAssistant={() => setIsAiModalOpen(true)}
        />
      </div>

      {/* ── Bottom Overall Progress Footer Bar ──────────────────────────── */}
      <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 w-full sm:w-72">
          <span className="text-[12px] font-bold text-slate-600 whitespace-nowrap">Overall Progress</span>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              style={{ width: `${progressPct}%` }}
              className="h-full bg-indigo-600 transition-all duration-300"
            />
          </div>
          <span className="text-[12px] font-extrabold text-indigo-700 whitespace-nowrap">
            {progressPct}% Completed
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-[12.5px] font-bold rounded-xl transition-colors"
          >
            Save Draft
          </button>

          {currentStep < 8 ? (
            <button
              onClick={() => setCurrentStep((prev) => Math.min(8, prev + 1))}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              Next: {STEP_NAMES[currentStep]?.label || 'Next'} →
            </button>
          ) : (
            <button
              onClick={() => setTeacherNav('tests-exams')}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[13px] rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              Finish & Done ✓
            </button>
          )}
        </div>
      </div>

      {/* Floating AI Prompt Modal */}
      <AiAssistantModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyPrompt={handleApplyAiPrompt}
      />

      {/* Template Library Modal */}
      {isTemplatesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadein">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl space-y-4 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setIsTemplatesOpen(false)}
              className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <FolderKanban className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-[17px] font-bold text-slate-800">Standard Template Library</h3>
                <p className="text-[12px] text-slate-500">Load pre-configured blueprints for NEET & JEE</p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {[
                { name: 'NEET 2027 Weekly 40-Q Standard Blueprint', qs: 40, duration: 120 },
                { name: 'Class 11 Rotational Motion Chapter Drill', qs: 25, duration: 60 },
                { name: 'Grand Physics Mock Exam (NEET Pattern)', qs: 50, duration: 180 },
              ].map((t, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    updateState({ title: t.name, duration: t.duration });
                    setIsTemplatesOpen(false);
                    showToast(`Loaded Template: ${t.name}`);
                  }}
                  className="p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
                >
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-800">{t.name}</h4>
                    <p className="text-[11.5px] text-slate-500">
                      {t.qs} Questions • {t.duration} Minutes
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Drawer / Modal */}
      {isDraftsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadein">
          <div className="bg-white rounded-3xl p-6 w-full max-w-xl space-y-4 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setIsDraftsOpen(false)}
              className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <FileCheck className="w-6 h-6 text-slate-700" />
              <div>
                <h3 className="text-[17px] font-bold text-slate-800">Saved Cloud Drafts</h3>
                <p className="text-[12px] text-slate-500">Resume unfinished assessment drafts</p>
              </div>
            </div>

            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
              {draftsList.map((d) => (
                <div
                  key={d.id}
                  className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between hover:border-indigo-200 transition-all"
                >
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-800">{d.title}</h4>
                    <p className="text-[11.5px] text-slate-500">
                      {d.type} • Saved {d.date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateState({ title: d.title, type: d.type });
                        setIsDraftsOpen(false);
                        showToast(`Loaded draft: ${d.title}`);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-[11.5px] rounded-xl hover:bg-indigo-700"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => {
                        setDraftsList((prev) => prev.filter((x) => x.id !== d.id));
                        showToast('Draft deleted');
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Question Bank Modal */}
      {isQuestionBankOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadein">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl space-y-4 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setIsQuestionBankOpen(false)}
              className="absolute top-5 right-5 p-1 text-slate-400 hover:text-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-indigo-600" />
              <div>
                <h3 className="text-[17px] font-bold text-slate-800">AIOS Master Question Repository</h3>
                <p className="text-[12px] text-slate-500">Search 12,540+ authentic NEET questions</p>
              </div>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search questions by topic, keyword, or formula..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px]"
              />
            </div>

            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl text-[12px] space-y-1 text-indigo-900">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Integrated Question Bank
              </p>
              <p className="text-slate-600 text-[11.5px]">
                Questions selected here will auto-merge into Step 2 (Question Sources) & Step 3 (Syllabus Builder).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
