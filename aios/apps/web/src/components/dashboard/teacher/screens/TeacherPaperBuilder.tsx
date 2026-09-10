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
  CheckCircle2,
  ChevronDown,
  Clock,
  Search,
  Plus,
  ArrowRight,
  Check
} from 'lucide-react';
import axios from 'axios';
import { useDashboardStore } from '@/store/dashboard-store';
import { useAuth } from '@/contexts/auth.context';
import { NotificationBell } from '@/components/shared/NotificationBell';
import {
  useBatches, useSubjects, useQuestions,
  useCreateBlueprint, useGeneratePaper, useCreateExam, useLinkPaperToExam, useBlueprints,
} from '@/hooks/useApi';
import { buildDistributionRules, totalQuestionsFromRules, mapExamType, MARKS_PER_QUESTION } from '@/lib/assessment-blueprint';

// Subcomponents
import { AssessmentSummaryPanel, AssessmentState } from '../assessment-builder/AssessmentSummaryPanel';
import { AiAssistantModal, AiBlueprintResult } from '../assessment-builder/AiAssistantModal';
import { Step1Details } from '../assessment-builder/steps/Step1Details';
import { Step2Sources } from '../assessment-builder/steps/Step2Sources';
import { Step3Syllabus, SyllabusChapter } from '../assessment-builder/steps/Step3Syllabus';
import { Step4Planning } from '../assessment-builder/steps/Step4Planning';
import { Step5Rules } from '../assessment-builder/steps/Step5Rules';
import { Step6Strategy } from '../assessment-builder/steps/Step6Strategy';
import { Step7Preview, PreviewQuestion } from '../assessment-builder/steps/Step7Preview';
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
  const { user } = useAuth();
  const { classId, subjectId, batchId } = teacherCtx;

  // Active step (1 to 8)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  // ── Real data: subjects/chapters/topics, batches, question bank ─────────
  const { data: subjectsResp } = useSubjects();
  const subjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];
  const { data: realBatchesRaw } = useBatches();
  const realBatches: { id: string; name: string }[] = (() => { const d = realBatchesRaw?.data ?? realBatchesRaw; return Array.isArray(d) ? d : []; })();
  const { data: blueprintsRaw } = useBlueprints();
  const blueprintsList: any[] = blueprintsRaw?.data ?? blueprintsRaw ?? [];

  // Pre-fill initial context details based on active class / batch context
  const initialContext = React.useMemo(() => {
    const activeSubLabel = subjectId === 'maths' ? 'Mathematics' : subjectId === 'chemistry' ? 'Chemistry' : subjectId === 'biology' ? 'Biology' : 'Physics';
    const activeExamLabel = classId === '12' ? 'NEET 2026' : 'NEET 2027';

    let defaultBatches: string[] = [];
    let defaultTitle = `${activeSubLabel} Weekly Test`;

    const matchBatch = batchId ? realBatches.find((b) => b.id === batchId) : undefined;
    if (matchBatch) {
      defaultBatches = [matchBatch.name];
      defaultTitle = `${activeSubLabel} Test (${matchBatch.name})`;
    }

    return {
      exam: activeExamLabel,
      subject: activeSubLabel,
      batches: defaultBatches,
      title: defaultTitle,
    };
  }, [classId, subjectId, batchId, realBatches]);

  // Tracks an AI-driven subject switch (see handleApplyAiResult below) that
  // overrides the teacher's own logged-in subject context. Reset whenever
  // that context itself changes, so navigating to a different class/subject
  // doesn't keep a stale override alive.
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  React.useEffect(() => {
    setSelectedSubjectId(null);
  }, [initialContext.subject]);

  const activeSubject = React.useMemo(() => {
    if (selectedSubjectId) {
      return subjects.find((s: any) => s.id === selectedSubjectId) ?? null;
    }
    return subjects.find((s: any) => s.name.toLowerCase() === initialContext.subject.toLowerCase()) ?? null;
  }, [subjects, selectedSubjectId, initialContext.subject]);

  const chaptersTree: SyllabusChapter[] = React.useMemo(() => {
    if (!activeSubject) return [];
    return (activeSubject.chapters ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      topics: (c.topics ?? []).map((t: any) => ({ id: t.id, name: t.name })),
    }));
  }, [activeSubject]);

  const { data: questionsResp, isLoading: questionsLoading } = useQuestions(
    activeSubject ? { subjectId: activeSubject.id, isApproved: true, limit: 200 } : { isApproved: true, limit: 0 },
  );
  const approvedQuestions: any[] = questionsResp?.data ?? [];

  // Modals state for header utilities
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
    selectedChapters: [],
    selectedTopics: [],
    chapterQuestionPlan: {},
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

  // Compute stats for summary panel — real, derived from the teacher's own plan.
  let easyCount = 0;
  let medCount = 0;
  let hardCount = 0;

  Object.values(assessmentState.chapterQuestionPlan).forEach((plan) => {
    easyCount += plan.easy || 0;
    medCount += plan.medium || 0;
    hardCount += plan.hard || 0;
  });

  const totalQuestions = easyCount + medCount + hardCount;
  const easyPct = totalQuestions > 0 ? Math.round((easyCount / totalQuestions) * 100) : 0;
  const medPct = totalQuestions > 0 ? Math.round((medCount / totalQuestions) * 100) : 0;
  const hardPct = totalQuestions > 0 ? 100 - easyPct - medPct : 0;

  const estimatedTime = Math.round(totalQuestions * 3);

  const selectedTopicQuestions = approvedQuestions.filter((q) => assessmentState.selectedTopics.includes(q.topicId));
  const availableQuestionsCount = selectedTopicQuestions.length;
  // Real coverage heuristic: how much of the planned question count the approved
  // bank can actually supply for the selected topics — not a fabricated score.
  const qualityScore = totalQuestions > 0
    ? Math.max(0, Math.min(100, Math.round((availableQuestionsCount / totalQuestions) * 100)))
    : 0;

  // Keep the displayed/submitted Total Marks in sync with the real plan
  // (papers.service.ts createBlueprint() requires distribution marks to sum
  // exactly to totalMarks — MARKS_PER_QUESTION per question, by convention).
  React.useEffect(() => {
    const computed = totalQuestions * MARKS_PER_QUESTION;
    setAssessmentState((prev) => (prev.totalMarks === computed ? prev : { ...prev, totalMarks: computed }));
  }, [totalQuestions]);

  // AI Prompt fill handler — takes the real AI blueprint result and resolves
  // its topicName strings against the loaded real curriculum tree.
  const handleApplyAiResult = (result: AiBlueprintResult) => {
    // The AI result carries only topic names, never a subject (see
    // BlueprintGenerationResult in apps/api-python/src/ai/blueprint_agent.py)
    // — so it must be resolved against every loaded subject's curriculum,
    // not just the teacher's own logged-in subject. Matching only against
    // `chaptersTree` (activeSubject's chapters) silently produced 0/N
    // matches whenever the prompt was about a different subject than the
    // teacher's own (e.g. a Chemistry prompt typed by a Physics teacher).
    type Match = { chapterId: string; topicId: string };
    let best: { subject: any; matches: Map<number, Match> } | null = null;

    for (const subject of subjects) {
      const chapters = subject.chapters ?? [];
      const matches = new Map<number, Match>();
      result.rules.forEach((rule, idx) => {
        const norm = rule.topicName.trim().toLowerCase();
        for (const chapter of chapters) {
          const topic = (chapter.topics ?? []).find((t: any) => t.name.trim().toLowerCase() === norm);
          if (topic) { matches.set(idx, { chapterId: chapter.id, topicId: topic.id }); break; }
        }
      });
      if (matches.size === 0) continue;
      // Ties favor the teacher's currently active subject, so an ambiguous
      // prompt doesn't jump curricula unnecessarily.
      if (!best || matches.size > best.matches.size || (matches.size === best.matches.size && subject.id === activeSubject?.id)) {
        best = { subject, matches };
      }
    }

    const targetSubject = best?.subject ?? activeSubject;
    const matches = best?.matches ?? new Map<number, Match>();
    const unmatched = result.rules.length - matches.size;
    const isSubjectSwitch = Boolean(targetSubject && targetSubject.id !== activeSubject?.id);

    // A subject switch means prior selections belong to a different
    // curriculum's topic IDs — carrying them forward would silently mix
    // topic IDs from two subjects, so start clean instead of merging.
    const selectedChapters = new Set<string>(isSubjectSwitch ? [] : assessmentState.selectedChapters);
    const selectedTopics = new Set<string>(isSubjectSwitch ? [] : assessmentState.selectedTopics);
    const chapterQuestionPlan: AssessmentState['chapterQuestionPlan'] = isSubjectSwitch ? {} : { ...assessmentState.chapterQuestionPlan };

    result.rules.forEach((rule, idx) => {
      const found = matches.get(idx);
      if (!found) return;
      selectedChapters.add(found.chapterId);
      selectedTopics.add(found.topicId);
      const tier = rule.difficulty.toUpperCase() === 'HARD' ? 'hard' : rule.difficulty.toUpperCase() === 'MEDIUM' ? 'medium' : 'easy';
      const existing = chapterQuestionPlan[found.chapterId] ?? { easy: 0, medium: 0, hard: 0 };
      chapterQuestionPlan[found.chapterId] = { ...existing, [tier]: existing[tier] + rule.count };
    });

    if (isSubjectSwitch) setSelectedSubjectId(targetSubject.id);

    updateState({
      title: result.title || assessmentState.title,
      duration: result.duration || assessmentState.duration,
      subject: targetSubject ? targetSubject.name : assessmentState.subject,
      selectedChapters: Array.from(selectedChapters),
      selectedTopics: Array.from(selectedTopics),
      chapterQuestionPlan,
      strategy: 'personalized',
    });
    setCurrentStep(3);
    const switchNote = isSubjectSwitch ? ` (switched to ${targetSubject.name})` : '';
    showToast(
      unmatched > 0
        ? `AI filled ${result.rules.length - unmatched} of ${result.rules.length} topics${switchNote} — the rest weren't found in your curriculum.`
        : `AI filled the assessment from your prompt!${switchNote}`,
    );
  };

  // ── Publish chain: Blueprint -> (Paper + Exam per batch) -> link ────────
  const createBlueprint = useCreateBlueprint();
  const generatePaper = useGeneratePaper();
  const createExam = useCreateExam();
  const linkPaper = useLinkPaperToExam();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  function extractErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as { message?: string; error?: { message?: string } } | undefined;
      return data?.error?.message ?? data?.message ?? fallback;
    }
    return fallback;
  }

  const handleSaveDraft = async () => {
    if (!activeSubject) { showToast('Select a subject with a real curriculum before saving.'); return; }
    const rules = buildDistributionRules(assessmentState, chaptersTree);
    if (rules.length === 0) { showToast('Select topics and set a question plan (Step 3-4) before saving.'); return; }

    setIsSavingDraft(true);
    try {
      await createBlueprint.mutateAsync({
        subjectId: activeSubject.id,
        name: assessmentState.title || 'Untitled Draft',
        totalMarks: totalQuestionsFromRules(rules) * MARKS_PER_QUESTION,
        duration: assessmentState.duration,
        instructions: assessmentState.instructions,
        distribution: rules,
      });
      showToast('Draft saved as a blueprint.');
    } catch (err) {
      showToast(extractErrorMessage(err, 'Failed to save draft.'));
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishError(null);

    if (!activeSubject) { setPublishError('Select a subject with a real curriculum before publishing.'); throw new Error('no-subject'); }
    const rules = buildDistributionRules(assessmentState, chaptersTree);
    if (rules.length === 0) { setPublishError('Select topics and set a question plan (Step 3-4) before publishing.'); throw new Error('no-rules'); }
    const targetBatches = realBatches.filter((b) => assessmentState.batches.includes(b.name));
    if (targetBatches.length === 0) { setPublishError('Select at least one batch (Step 1) before publishing.'); throw new Error('no-batches'); }

    setIsPublishing(true);
    try {
      const blueprint = await createBlueprint.mutateAsync({
        subjectId: activeSubject.id,
        name: assessmentState.title || 'Untitled Assessment',
        totalMarks: totalQuestionsFromRules(rules) * MARKS_PER_QUESTION,
        duration: assessmentState.duration,
        instructions: assessmentState.instructions,
        distribution: rules,
      });

      // One Paper + Exam per selected batch, from the same Blueprint — Exam
      // and Paper are both single-batch models (apps/api/src/exams/dto/exam.dto.ts),
      // so a multi-batch assessment fans out into one exam instance per batch.
      for (const batch of targetBatches) {
        const paper = await generatePaper.mutateAsync({
          blueprintId: blueprint.id,
          title: assessmentState.title || 'Untitled Assessment',
          targetBatchId: batch.id,
        });
        const exam = await createExam.mutateAsync({
          title: assessmentState.title || 'Untitled Assessment',
          batchId: batch.id,
          blueprintId: blueprint.id,
          type: mapExamType(assessmentState.type),
          scheduledDate: assessmentState.scheduleType === 'later' && assessmentState.dueDate
            ? new Date(`${assessmentState.dueDate}T${assessmentState.startTime || '09:00'}:00`).toISOString()
            : undefined,
          durationMinutes: assessmentState.duration,
        });
        await linkPaper.mutateAsync({ examId: exam.id, paperId: paper.id });
      }
    } catch (err) {
      setPublishError(extractErrorMessage(err, 'Failed to publish assessment. Please try again.'));
      throw err;
    } finally {
      setIsPublishing(false);
    }
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

          <NotificationBell />

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-[12px] shadow-2xs">
              {(user?.name ?? '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[12.5px] font-bold text-slate-800 leading-tight">{user?.name ?? 'Teacher'}</p>
              <p className="text-[10px] text-slate-400 font-semibold">{assessmentState.subject} Faculty</p>
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
            <FileCheck className="w-4 h-4 text-slate-500" /> Saved Drafts ({blueprintsList.length})
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
              availableBatches={realBatches.map((b) => ({ id: b.id, name: b.name }))}
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
              chapters={chaptersTree}
              isLoading={!activeSubject && subjects.length === 0}
            />
          )}

          {currentStep === 4 && (
            <Step4Planning
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(5)}
              onPrev={() => setCurrentStep(3)}
              chapters={chaptersTree}
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
              questions={selectedTopicQuestions.map((q, idx): PreviewQuestion => ({
                id: q.id,
                num: idx + 1,
                text: q.content,
                topic: q.topic?.name ?? 'Unknown Topic',
                difficulty: q.difficulty === 'HARD' ? 'Hard' : q.difficulty === 'MEDIUM' ? 'Medium' : 'Easy',
                marks: q.marks,
                isApproved: true,
              }))}
              totalAvailable={availableQuestionsCount}
              isLoading={questionsLoading}
            />
          )}

          {currentStep === 8 && (
            <Step8Generate
              state={assessmentState}
              onPrev={() => setCurrentStep(7)}
              onPublishSuccess={() => setTeacherNav('tests-exams')}
              onPublish={handlePublish}
              isPublishing={isPublishing}
              publishError={publishError}
              onSaveDraft={handleSaveDraft}
              isSavingDraft={isSavingDraft}
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
            disabled={isSavingDraft}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-[12.5px] font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {isSavingDraft ? 'Saving…' : 'Save Draft'}
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
        onApplyResult={handleApplyAiResult}
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
              {blueprintsList.length === 0 ? (
                <p className="text-[12.5px] text-slate-500 text-center py-6">No saved drafts yet — use "Save Draft" once you've planned some topics.</p>
              ) : (
                blueprintsList.map((bp: any) => (
                  <div
                    key={bp.id}
                    className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between hover:border-indigo-200 transition-all"
                  >
                    <div>
                      <h4 className="text-[13.5px] font-bold text-slate-800">{bp.name}</h4>
                      <p className="text-[11.5px] text-slate-500">
                        {bp.subject?.name ?? 'Unknown Subject'} • {bp.totalMarks} Marks • {bp.duration} Min
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const rules: { topicId: string; difficulty: string; count: number }[] = Array.isArray(bp.distribution) ? bp.distribution : [];
                        const selectedTopics = new Set<string>();
                        const selectedChapters = new Set<string>();
                        const chapterQuestionPlan: AssessmentState['chapterQuestionPlan'] = {};

                        for (const rule of rules) {
                          const chapter = chaptersTree.find((c) => c.topics.some((t) => t.id === rule.topicId));
                          if (!chapter) continue;
                          selectedTopics.add(rule.topicId);
                          selectedChapters.add(chapter.id);
                          const tier = rule.difficulty === 'HARD' ? 'hard' : rule.difficulty === 'MEDIUM' ? 'medium' : 'easy';
                          const existing = chapterQuestionPlan[chapter.id] ?? { easy: 0, medium: 0, hard: 0 };
                          chapterQuestionPlan[chapter.id] = { ...existing, [tier]: existing[tier] + rule.count };
                        }

                        updateState({
                          title: bp.name,
                          duration: bp.duration,
                          totalMarks: bp.totalMarks,
                          instructions: bp.instructions ?? assessmentState.instructions,
                          selectedChapters: Array.from(selectedChapters),
                          selectedTopics: Array.from(selectedTopics),
                          chapterQuestionPlan,
                        });
                        setIsDraftsOpen(false);
                        showToast(`Loaded draft: ${bp.name}`);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-[11.5px] rounded-xl hover:bg-indigo-700"
                    >
                      Load
                    </button>
                  </div>
                ))
              )}
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
