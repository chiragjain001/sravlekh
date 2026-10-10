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
  ChevronLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  Search,
  Plus,
  ArrowRight,
  Check,
  Zap,
  Users,
  Menu,
  Save,
} from 'lucide-react';
import axios from 'axios';
import { useDashboardStore } from '@/store/dashboard-store';
import {
  useBatches, useSubjects, useQuestions,
  useCreateBlueprint, useGeneratePaper, useClonePaper, useCreateExam, useLinkPaperToExam, useBlueprints, useMyTeacherProfile,
} from '@/hooks/useApi';
import { buildDistributionRules, totalQuestionsFromRules, mapExamType, MARKS_PER_QUESTION, computeSectionsTotal } from '@/lib/assessment-blueprint';

// Subcomponents
import { AssessmentSummaryPanel, AssessmentState } from '../assessment-builder/AssessmentSummaryPanel';
import { AiAssistantModal, AiBlueprintResult } from '../assessment-builder/AiAssistantModal';
import { Step1Details } from '../assessment-builder/steps/Step1Details';
import { Step2Sources } from '../assessment-builder/steps/Step2Sources';
import { Step3Syllabus, SyllabusChapter } from '../assessment-builder/steps/Step3Syllabus';
import { Step4Planning } from '../assessment-builder/steps/Step4Planning';
import { Step4SectionBuilder } from '../assessment-builder/steps/Step4SectionBuilder';
import { Step5Rules } from '../assessment-builder/steps/Step5Rules';
import { Step6Strategy } from '../assessment-builder/steps/Step6Strategy';
import { Step7Preview } from '../assessment-builder/steps/Step7Preview';
import { Step8Generate } from '../assessment-builder/steps/Step8Generate';
import { QuickGenerateModal } from '../shared/QuickGenerateModal';

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

// Today's date in the BROWSER's own local timezone, as YYYY-MM-DD — never
// `new Date().toISOString().slice(0, 10)`, which is UTC and reads as
// "tomorrow" or "yesterday" for anyone not near Greenwich right around
// midnight local time. Mirrors Step1Details.tsx's own todayIsoDate() exactly,
// since both need to agree on what "today" means for the same date field.
function todayIsoDateLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TeacherPaperBuilder() {
  const { teacherCtx, setTeacherNav, setTeacherCtx } = useDashboardStore();
  const { classId, subjectId, batchId } = teacherCtx;

  // Active step (1 to 8)
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSummaryDrawerOpen, setIsSummaryDrawerOpen] = useState(false);

  // Desktop Context Dropdowns State (Apple / iOS-level popovers)
  const [isSubjectDropdownOpen, setIsSubjectDropdownOpen] = useState(false);
  const [isBatchDropdownOpen, setIsBatchDropdownOpen] = useState(false);
  const subjectDropdownRef = React.useRef<HTMLDivElement>(null);
  const batchDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(e.target as Node)) {
        setIsSubjectDropdownOpen(false);
      }
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target as Node)) {
        setIsBatchDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSubjectDropdownOpen(false);
        setIsBatchDropdownOpen(false);
      }
    };
    if (isSubjectDropdownOpen || isBatchDropdownOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSubjectDropdownOpen, isBatchDropdownOpen]);

  // Close summary drawer on ESC key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSummaryDrawerOpen(false);
    };
    if (isSummaryDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSummaryDrawerOpen]);

  // ── Real data: subjects/chapters/topics, batches, question bank ─────────
  const { data: subjectsResp } = useSubjects();
  const subjects: any[] = React.useMemo(() => subjectsResp?.data ?? subjectsResp ?? [], [subjectsResp]);
  
  const { data: realBatchesRaw } = useBatches();
  const realBatches: { id: string; name: string; classYear?: string }[] = React.useMemo(() => {
    const d = realBatchesRaw?.data ?? realBatchesRaw;
    return Array.isArray(d) ? d : [];
  }, [realBatchesRaw]);

  // Group desktop batches by Class / Grade for Apple/iOS-style grouped menu
  const groupedDesktopBatches = React.useMemo(() => {
    const groups: Record<string, typeof realBatches> = {};
    realBatches.forEach((b) => {
      let groupName = b.classYear || '';
      if (!groupName) {
        const match = b.name.match(/^(Class \d+|Grade \d+|Standard \d+|Year \d+)/i);
        groupName = match && match[1] ? match[1] : 'Other Batches';
      }
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName]!.push(b);
    });
    return groups;
  }, [realBatches]);
  const { data: blueprintsRaw } = useBlueprints();
  const blueprintsList: any[] = blueprintsRaw?.data ?? blueprintsRaw ?? [];

  const { data: teacherProfile } = useMyTeacherProfile();

  // Teacher's assigned subjects derived from teacherProfile
  const teacherAssignedSubjects = React.useMemo(() => {
    const profileSubjectIds: string[] = Array.isArray(teacherProfile?.subjectIds) ? teacherProfile.subjectIds : [];
    const batchAssignments = teacherProfile?.batchAssignments ?? [];
    const batchSubjectIds = batchAssignments
      .filter((a: any) => !a.removedAt && a.subjectId)
      .map((a: any) => a.subjectId as string);

    const allAssignedIds = Array.from(new Set([...profileSubjectIds, ...batchSubjectIds]));

    if (allAssignedIds.length > 0) {
      const matched = subjects.filter((s: any) => allAssignedIds.includes(s.id));
      if (matched.length > 0) return matched;
    }

    const withChapters = subjects.filter((s: any) => (s.chapters ?? []).length > 0);
    return withChapters.length > 0 ? withChapters : subjects;
  }, [teacherProfile, subjects]);

  // Pre-fill initial context details based on active class / batch context or teacher's assigned subject
  const initialContext = React.useMemo(() => {
    const matchedSubject = subjectId
      ? subjects.find((s: any) => s.id === subjectId || s.name.toLowerCase() === subjectId.toLowerCase())
      : undefined;
    const defaultSub = matchedSubject || (teacherAssignedSubjects.length > 0 ? teacherAssignedSubjects[0] : undefined);
    const activeSubLabel = defaultSub?.name ?? 'General';
    const activeExamLabel = `${activeSubLabel} Assessment`;

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
  }, [classId, subjectId, batchId, realBatches, subjects, teacherAssignedSubjects]);

  // Tracks an AI-driven subject switch (see handleApplyAiResult below) that
  // overrides the teacher's own logged-in subject context. Reset whenever
  // that context itself changes, so navigating to a different class/subject
  // doesn't keep a stale override alive.
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  React.useEffect(() => {
    setSelectedSubjectId(null);
  }, [initialContext.subject]);

  // Opening Paper Builder from the sidebar carries no subject context, so
  // initialContext.subject is the "General" placeholder — which matches no
  // real subject, leaving the syllabus empty and the wizard stuck at Step 3.
  // Fall back to the subjects that actually have a syllabus: auto-pick when
  // there is exactly one, otherwise let the teacher choose (picker in Step 3).
  const subjectsWithSyllabus = React.useMemo(
    () => subjects.filter((s: any) => (s.chapters ?? []).length > 0),
    [subjects],
  );
  const contextSubject = React.useMemo(
    () => subjects.find((s: any) => s.name.toLowerCase() === initialContext.subject.toLowerCase()) ?? null,
    [subjects, initialContext.subject],
  );

  const activeSubject = React.useMemo(() => {
    if (selectedSubjectId) {
      return subjects.find((s: any) => s.id === selectedSubjectId) ?? null;
    }
    if (contextSubject) return contextSubject;
    return subjectsWithSyllabus.length === 1 ? subjectsWithSyllabus[0] : null;
  }, [subjects, selectedSubjectId, contextSubject, subjectsWithSyllabus]);

  // Keep the displayed subject/exam/title in step with the resolved subject
  // when it came from the fallback rather than from navigation context.
  React.useEffect(() => {
    if (!activeSubject || activeSubject.name === assessmentState.subject) return;
    setAssessmentState((prev) => ({
      ...prev,
      subject: activeSubject.name,
      exam: `${activeSubject.name} Assessment`,
      title: prev.title.startsWith('General') ? prev.title.replace('General', activeSubject.name) : prev.title,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubject, initialContext]);

  const chaptersTree: SyllabusChapter[] = React.useMemo(() => {
    if (!activeSubject) return [];
    return (activeSubject.chapters ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      topics: (c.topics ?? []).map((t: any) => ({ id: t.id, name: t.name })),
    }));
  }, [activeSubject]);

  // Only fires once a real subject has resolved — { limit: 0 } was being sent
  // in the meantime as a "give me nothing yet" placeholder, but the backend's
  // validation requires limit >= 1 and rejected it outright with a 400 on
  // every load, visible in the network log on every single page visit before
  // the subject list finished loading.
  // isLoading no longer consumed here — it only ever fed Step7Preview's old
  // sample-questions loading state, which is gone now that Step 7 loads the
  // real generated paper itself (via usePaper inside Step7Preview).
  const { data: questionsResp } = useQuestions(
    activeSubject ? { subjectId: activeSubject.id, isApproved: true, limit: 200 } : undefined,
    !!activeSubject,
  );
  const approvedQuestions: any[] = questionsResp?.data ?? [];

  // Modals state for header utilities
  const [isQuickGenerateOpen, setIsQuickGenerateOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isDraftsOpen, setIsDraftsOpen] = useState(false);
  const [isQuestionBankOpen, setIsQuestionBankOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // A week out, in the browser's own local date — a real default a teacher
  // would then adjust, not a fixed calendar date that ages into the past the
  // moment "now" moves past it. This was previously '2024-05-28', hardcoded
  // and already stale by the time this was tested live: a teacher who never
  // touched Step 1's date field would publish an exam dated in the past with
  // nothing anywhere — frontend or backend — objecting. Both now do
  // (Step1Details.tsx's min attribute + guard, exams.service.ts createExam).
  const defaultDueDate = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // Global Assessment State
  const [assessmentState, setAssessmentState] = useState<AssessmentState>(() => ({
    title: initialContext.title,
    type: 'Weekly Test',
    exam: initialContext.exam,
    subject: initialContext.subject,
    batches: initialContext.batches,
    board: '',
    classGrade: '',
    language: 'English',
    academicYear: '2025-26',
    paperFormat: 'OMR' as const,
    teacherIntent: '',
    duration: 120,
    totalMarks: 240,
    instructions: '',
    scheduleType: 'later',
    dueDate: defaultDueDate,
    startTime: '09:00',
    endTime: '11:00',
    selectedSources: ['NCERT', 'PYQ', 'Institute Module', 'DPP', 'Teacher Questions'],
    sourceWeights: {},
    selectedChapters: [],
    selectedTopics: [],
    sections: [],
    chapterQuestionPlan: {},
    questionTypes: ['MCQ', 'Numerical'],
    negativeMarking: '-1 for each wrong answer',
    shuffleQuestions: true,
    shuffleOptions: true,
    showSolutions: false,
    allowRepeat: false,
    avoidRecentDays: 60,
    minRating: 4.0,
    paperSetsCount: 1,
    wordLimitEnabled: false,
    wordLimitPerMark: 30,
    includeAnswerLines: false,
    generalInstructions: [],
    strategy: 'general',
    difficultyDistribution: { easy: 30, medium: 40, hard: 30 },
    bloomsDistribution: { remember: 15, understand: 20, apply: 25, analyze: 20, evaluate: 10, create: 10 },
    avoidRepeatedQuestions: true,
    hotsPriority: false,
    ncertAlignment: true,
    boardAlignment: false,
  }));

  const prevContextRef = React.useRef(initialContext);
  
  // Sync state if initialContext changes (e.g. data loaded, or sidebar navigation),
  // but NEVER overwrite a field if the teacher has manually edited it.
  React.useEffect(() => {
    setAssessmentState((prev) => {
      const next = { ...prev };
      
      if (prev.title === prevContextRef.current.title) next.title = initialContext.title;
      if (prev.type === prevContextRef.current.exam) next.type = initialContext.exam;
      if (prev.subject === prevContextRef.current.subject) next.subject = initialContext.subject;
      
      // For arrays like batches, a deep equality check or simple length/element check could work,
      // but batches are usually explicitly picked by the teacher. We'll only sync if it was exactly the default.
      if (JSON.stringify(prev.batches) === JSON.stringify(prevContextRef.current.batches)) {
        next.batches = initialContext.batches;
      }

      return next;
    });
    
    prevContextRef.current = initialContext;
  }, [initialContext]);

  const updateState = (updates: Partial<AssessmentState>) => {
    setAssessmentState((prev) => ({ ...prev, ...updates }));
  };

  // A different subject has a different syllabus, so any chapter/topic picks
  // and the question plan built against the old one must be cleared.
  const changeSubject = (id: string) => {
    updateState({ selectedChapters: [], selectedTopics: [], chapterQuestionPlan: {} });
    setSelectedSubjectId(id || null);
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

  // Keep the displayed/submitted Total Marks in sync with the real plan:
  // - For OMR papers, distribution marks sum to totalQuestions * MARKS_PER_QUESTION
  // - For Theory/Hybrid papers, sections total drives totalMarks
  React.useEffect(() => {
    if (assessmentState.paperFormat === 'OMR') {
      const computed = totalQuestions * MARKS_PER_QUESTION;
      setAssessmentState((prev) => (prev.totalMarks === computed ? prev : { ...prev, totalMarks: computed }));
    } else {
      const sectionsMarks = computeSectionsTotal(assessmentState.sections || []);
      if (sectionsMarks > 0) {
        setAssessmentState((prev) => (prev.totalMarks === sectionsMarks ? prev : { ...prev, totalMarks: sectionsMarks }));
      }
    }
  }, [totalQuestions, assessmentState.paperFormat, assessmentState.sections]);

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

  const isQuickGeneratingRef = React.useRef(false);

  const handleQuickGenerate = async (data: {
    batchId?: string;
    batchIds?: string[];
    subjectId: string;
    chapterIds: string[];
    title: string;
    questionCount: number;
  }) => {
    isQuickGeneratingRef.current = true;
    try {
      setIsGeneratingReview(true);
      const targetBatchIds = data.batchIds && data.batchIds.length > 0
        ? data.batchIds
        : (data.batchId ? [data.batchId] : []);
      const matchedBatches = realBatches.filter(b => targetBatchIds.includes(b.id));
      const batchNames = matchedBatches.map(b => b.name);
      const fallbackBatchName = realBatches.find(b => b.id === data.batchId)?.name || '';
      const finalBatches = batchNames.length > 0 ? batchNames : (fallbackBatchName ? [fallbackBatchName] : []);

      const selectedSubject = subjects.find(s => s.id === data.subjectId);
      const subjectName = selectedSubject?.name || '';
      const targetChapters = selectedSubject?.chapters ?? [];

      // Collect all topics within the selected chapters
      const topicsWithChapter: { topicId: string; chapterId: string }[] = [];
      for (const cid of data.chapterIds) {
        const ch = targetChapters.find((c: any) => c.id === cid);
        if (ch && Array.isArray(ch.topics)) {
          for (const t of ch.topics) {
            topicsWithChapter.push({ topicId: t.id, chapterId: cid });
          }
        }
      }

      if (topicsWithChapter.length === 0) {
        throw new Error('Selected chapters do not contain any topics.');
      }

      // Distribute data.questionCount across the topics evenly
      const totalQ = Math.max(1, data.questionCount);
      const numTopics = topicsWithChapter.length;

      const counts: number[] = [];
      if (totalQ >= numTopics) {
        const base = Math.floor(totalQ / numTopics);
        const rem = totalQ % numTopics;
        for (let i = 0; i < numTopics; i++) {
          counts.push(base + (i < rem ? 1 : 0));
        }
      } else {
        for (let i = 0; i < numTopics; i++) {
          counts.push(i < totalQ ? 1 : 0);
        }
      }

      // Build distribution rules with all required fields (topicId, type, difficulty, count, marksPerQuestion)
      const rules: {
        topicId: string;
        type: string;
        difficulty: 'MEDIUM';
        count: number;
        marksPerQuestion: number;
      }[] = [];
      const selectedTopics: string[] = [];
      const chapterQuestionPlan: Record<string, { easy: number; medium: number; hard: number }> = {};
      for (const cid of data.chapterIds) {
        chapterQuestionPlan[cid] = { easy: 0, medium: 0, hard: 0 };
      }

      for (let i = 0; i < numTopics; i++) {
        const qCount = counts[i] ?? 0;
        const item = topicsWithChapter[i];
        if (qCount > 0 && item) {
          rules.push({
            topicId: item.topicId,
            type: 'MCQ',
            difficulty: 'MEDIUM',
            count: qCount,
            marksPerQuestion: MARKS_PER_QUESTION,
          });
          selectedTopics.push(item.topicId);
          const plan = chapterQuestionPlan[item.chapterId];
          if (plan) {
            plan.medium += qCount;
          }
        }
      }

      const calculatedTotalMarks = rules.reduce((acc, r) => acc + (r.count * r.marksPerQuestion), 0);

      // 1. Update state
      updateState({
        title: data.title,
        subject: subjectName,
        batches: finalBatches,
        selectedChapters: data.chapterIds,
        selectedTopics,
        chapterQuestionPlan,
        duration: totalQ * 2, // 2 mins per Q
        totalMarks: calculatedTotalMarks,
      });

      setSelectedSubjectId(data.subjectId);

      // 2. Call backend APIs exactly as generateReviewPaper does
      const blueprint = await createBlueprint.mutateAsync({
        subjectId: data.subjectId,
        name: data.title,
        totalMarks: calculatedTotalMarks,
        duration: totalQ * 2,
        instructions: '',
        distribution: rules,
        format: 'OMR',
        difficultyDistribution: { easy: 0, medium: 100, hard: 0 },
        bloomsDistribution: { remember: 20, understand: 30, apply: 30, analyze: 20, evaluate: 0, create: 0 },
      });

      const paper = await generatePaper.mutateAsync({
        blueprintId: blueprint.id,
        title: data.title,
      });

      setReviewBlueprintId(blueprint.id);
      setReviewPaperId(paper.id);
      setIsQuickGenerateOpen(false);
      setCurrentStep(7); // Jump directly to Preview
      showToast('Quick paper generated successfully!');
    } catch (err) {
      setGenerationError(extractErrorMessage(err, 'Failed to quick-generate.'));
      showToast('Error generating quick paper.');
    } finally {
      setIsGeneratingReview(false);
      setTimeout(() => {
        isQuickGeneratingRef.current = false;
      }, 500);
    }
  };

  // ── Publish chain ─────────────────────────────────────────────────────
  //
  // Blueprint -> ONE review Paper (generated the moment Step 7 is entered,
  // general/no batch) -> teacher reviews/edits it in Step 7 -> Step 8 clones
  // that exact reviewed state into one Paper + Exam PER target batch.
  //
  // This used to generate blind: one blueprint, then generatePaper called
  // fresh per batch inside handlePublish, with no step in between where a
  // teacher could see or reject a question before it reached students. The
  // review-then-clone split is what makes Step 7 real rather than decorative
  // — cloning (not a second generatePaper call) is what lets every batch get
  // the identical, already-approved set of questions instead of each batch
  // independently drawing its own random paper from the same blueprint.
  const createBlueprint = useCreateBlueprint();
  const generatePaper = useGeneratePaper();
  const clonePaper = useClonePaper();
  const createExam = useCreateExam();
  const linkPaper = useLinkPaperToExam();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const [reviewBlueprintId, setReviewBlueprintId] = useState<string | null>(null);
  const [reviewPaperId, setReviewPaperId] = useState<string | null>(null);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  function extractErrorMessage(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
      const data = err.response?.data as { message?: string; error?: { message?: string } } | undefined;
      return data?.error?.message ?? data?.message ?? fallback;
    }
    return fallback;
  }

  // Invalidates the generated review paper whenever anything that would
  // change what's IN it changes. Without this, going back from Step 7 to
  // adjust the topic plan (or switching subject entirely) would leave Step 7
  // showing a paper generated from the OLD plan — the review would no longer
  // describe what Step 8 is about to publish.
  React.useEffect(() => {
    if (isQuickGeneratingRef.current) return;
    setReviewPaperId(null);
    setReviewBlueprintId(null);
    setGenerationError(null);
  }, [
    activeSubject?.id,
    assessmentState.selectedChapters,
    assessmentState.selectedTopics,
    assessmentState.chapterQuestionPlan,
    assessmentState.questionTypes,
    assessmentState.difficultyDistribution,
    assessmentState.bloomsDistribution,
    assessmentState.sections,
    assessmentState.totalMarks,
    assessmentState.paperFormat,
  ]);

  const generateReviewPaper = async () => {
    if (!activeSubject) { setGenerationError('Select a subject with a real curriculum before generating.'); return; }
    const rules = buildDistributionRules(assessmentState, chaptersTree);
    if (rules.length === 0) { setGenerationError('Select topics and set a question plan (Step 3-4) before generating.'); return; }

    setIsGeneratingReview(true);
    setGenerationError(null);
    try {
      const blueprint = await createBlueprint.mutateAsync({
        subjectId: activeSubject.id,
        name: assessmentState.title || 'Untitled Assessment',
        totalMarks: assessmentState.paperFormat !== 'OMR' ? assessmentState.totalMarks : (totalQuestionsFromRules(rules) * MARKS_PER_QUESTION),
        duration: assessmentState.duration,
        instructions: assessmentState.instructions,
        distribution: rules,
        format: assessmentState.paperFormat,
        sections: assessmentState.paperFormat !== 'OMR' ? assessmentState.sections : undefined,
        difficultyDistribution: assessmentState.difficultyDistribution,
        bloomsDistribution: assessmentState.bloomsDistribution,
      });
      // General — no targetBatchId. This is the one paper every batch's copy
      // gets cloned from at publish time, so it deliberately isn't scoped to
      // any single batch yet.
      const paper = await generatePaper.mutateAsync({
        blueprintId: blueprint.id,
        title: assessmentState.title || 'Untitled Assessment',
      });
      setReviewBlueprintId(blueprint.id);
      setReviewPaperId(paper.id);
    } catch (err) {
      setGenerationError(extractErrorMessage(err, 'Failed to generate the paper. Please try again.'));
    } finally {
      setIsGeneratingReview(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!activeSubject) { showToast('Select a subject with a real curriculum before saving.'); return; }
    const rules = buildDistributionRules(assessmentState, chaptersTree);
    if (rules.length === 0) { showToast('Select topics and set a question plan (Step 3-4) before saving.'); return; }

    setIsSavingDraft(true);
    try {
      await createBlueprint.mutateAsync({
        subjectId: activeSubject.id,
        name: assessmentState.title || 'Untitled Draft',
        totalMarks: assessmentState.paperFormat !== 'OMR' ? assessmentState.totalMarks : (totalQuestionsFromRules(rules) * MARKS_PER_QUESTION),
        duration: assessmentState.duration,
        instructions: assessmentState.instructions,
        distribution: rules,
        format: assessmentState.paperFormat,
        sections: assessmentState.paperFormat !== 'OMR' ? assessmentState.sections : undefined,
        difficultyDistribution: assessmentState.difficultyDistribution,
        bloomsDistribution: assessmentState.bloomsDistribution,
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

    if (!reviewPaperId || !reviewBlueprintId) {
      setPublishError('Please finish reviewing your paper (Step 7) before publishing.');
      throw new Error('not-reviewed');
    }
    const targetBatches = realBatches.filter((b) => assessmentState.batches.includes(b.name));
    if (targetBatches.length === 0) { setPublishError('Select at least one batch (Step 1) before publishing.'); throw new Error('no-batches'); }
    // Belt and braces alongside Step1Details' date picker guard — the backend
    // (exams.service.ts createExam) is the real enforcement, but failing here
    // first means the teacher sees one clear message instead of a batch of
    // per-request API errors after already starting to publish.
    if (assessmentState.scheduleType === 'later' && assessmentState.dueDate) {
      const todayStr = todayIsoDateLocal();
      if (assessmentState.dueDate < todayStr) {
        setPublishError('The exam date is in the past — go back to Step 1 and pick today or a later date.');
        throw new Error('past-date');
      }
    }

    setIsPublishing(true);
    try {
      // One Paper (cloned from the reviewed paper — never re-generated) +
      // Exam per selected batch. Exam is a single-batch model
      // (apps/api/src/exams/dto/exam.dto.ts), so a multi-batch assessment
      // fans out into one exam instance per batch, each with its own copy of
      // the exact questions the teacher approved in Step 7.
      for (const batch of targetBatches) {
        const paper = await clonePaper.mutateAsync({
          paperId: reviewPaperId,
          title: assessmentState.title || 'Untitled Assessment',
          targetBatchId: batch.id,
        });
        const exam = await createExam.mutateAsync({
          title: assessmentState.title || 'Untitled Assessment',
          batchId: batch.id,
          blueprintId: reviewBlueprintId,
          type: mapExamType(assessmentState.type),
          status: 'PUBLISHED',
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
      if (assessmentState.scheduleType === 'later' && assessmentState.dueDate) {
        const todayStr = todayIsoDateLocal();
        if (assessmentState.dueDate < todayStr) {
          return { valid: false, error: 'The exam date cannot be in the past — pick today or a later date.' };
        }
      }
    }
    if (stepNum === 2) {
      if (!assessmentState.selectedSources.length) return { valid: false, error: 'Please select at least one Question Source.' };
    }
    if (stepNum === 3) {
      if (!assessmentState.selectedChapters.length) return { valid: false, error: 'Please select at least one Chapter.' };
      if (!assessmentState.selectedTopics.length) return { valid: false, error: 'Please select at least one Topic.' };
    }
    if (stepNum === 4) {
      const isTheoryLike = assessmentState.paperFormat === 'THEORY' || assessmentState.paperFormat === 'HYBRID';
      if (isTheoryLike) {
        if (!assessmentState.sections || assessmentState.sections.length === 0)
          return { valid: false, error: 'Please add at least one section before continuing.' };
        if (computeSectionsTotal(assessmentState.sections) <= 0)
          return { valid: false, error: 'Sections must have at least 1 mark total.' };
      } else {
        if (totalQuestions <= 0) return { valid: false, error: 'Total questions must be greater than 0.' };
      }
    }
    if (stepNum === 5) {
      if (assessmentState.duration <= 0) return { valid: false, error: 'Please set a valid exam duration.' };
      if (assessmentState.totalMarks <= 0) return { valid: false, error: 'Please set valid total marks.' };
    }
    if (stepNum === 7) {
      if (isGeneratingReview) return { valid: false, error: 'Please wait for paper generation to finish.' };
      if (generationError) return { valid: false, error: 'Please resolve generation errors before continuing.' };
      if (!reviewPaperId) return { valid: false, error: 'Review paper is missing.' };
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

    // Entering the review step for the first time since the plan last
    // changed (the useEffect above clears reviewPaperId on exactly those
    // changes) — generate the real paper now, so Step 7 has something to
    // show instead of yesterday's decorative 5-question sample.
    if (targetStep === 7 && !reviewPaperId && !isGeneratingReview) {
      void generateReviewPaper();
    }
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

      {/* ── Top Bar (Desktop Only: Institute Context) ──── */}
      <div className="hidden sm:flex bg-white border-b border-slate-200 px-6 py-2.5 items-center flex-shrink-0">
        {/* Dropdown selectors for Context */}
        <div className="flex items-center gap-3 text-[12.5px] font-bold">
          {/* Exam label is derived from the subject, so it is display-only. */}
          <div className="flex items-center px-3.5 py-1.5 bg-indigo-50/80 text-indigo-900 border border-indigo-200/80 rounded-xl shadow-2xs select-none">
            <span>{assessmentState.exam}</span>
          </div>

          {/* Subject: Apple / iOS-style custom dropdown */}
          <div ref={subjectDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsSubjectDropdownOpen((v) => !v);
                setIsBatchDropdownOpen(false);
              }}
              aria-expanded={isSubjectDropdownOpen}
              aria-haspopup="listbox"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[12.5px] font-bold transition-all select-none cursor-pointer shadow-2xs ${
                isSubjectDropdownOpen
                  ? 'bg-white border-indigo-400 ring-2 ring-indigo-500/20 text-indigo-950 shadow-sm'
                  : 'bg-indigo-50/80 hover:bg-indigo-100/80 active:bg-indigo-100 text-indigo-950 border-indigo-200/90'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[200px]">
                {activeSubject?.name || assessmentState.subject || 'Select Subject'}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-indigo-500 shrink-0 transition-transform duration-200 ${
                  isSubjectDropdownOpen ? 'rotate-180 text-indigo-700' : ''
                }`}
              />
            </button>

            {isSubjectDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 min-w-[230px] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 p-1.5 ring-1 ring-black/5 animate-fadein">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Assigned Subjects
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-0.5">
                  {teacherAssignedSubjects.map((s: any) => {
                    const isSelected = activeSubject?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          changeSubject(s.id);
                          setIsSubjectDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/90 text-indigo-900 font-bold'
                            : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-900 font-medium'
                        }`}
                      >
                        <span className="truncate">{s.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Batch: Apple / iOS-style custom dropdown */}
          <div ref={batchDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsBatchDropdownOpen((v) => !v);
                setIsSubjectDropdownOpen(false);
              }}
              aria-expanded={isBatchDropdownOpen}
              aria-haspopup="listbox"
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-[12.5px] font-bold transition-all select-none cursor-pointer shadow-2xs ${
                isBatchDropdownOpen
                  ? 'bg-white border-indigo-400 ring-2 ring-indigo-500/20 text-indigo-950 shadow-sm'
                  : 'bg-indigo-50/80 hover:bg-indigo-100/80 active:bg-indigo-100 text-indigo-950 border-indigo-200/90'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate max-w-[260px]">
                {assessmentState.batches.length === 0
                  ? 'No batch selected'
                  : assessmentState.batches.length === 1
                  ? assessmentState.batches[0]
                  : `${assessmentState.batches.length} Batches (${assessmentState.batches.join(', ')})`}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-indigo-500 shrink-0 transition-transform duration-200 ${
                  isBatchDropdownOpen ? 'rotate-180 text-indigo-700' : ''
                }`}
              />
            </button>

            {isBatchDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 z-50 min-w-[280px] max-w-[360px] bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-900/10 p-1.5 ring-1 ring-black/5 animate-fadein">
                <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1">
                  {/* Clear / No batch selected option */}
                  <button
                    type="button"
                    onClick={() => {
                      setAssessmentState((prev) => ({ ...prev, batches: [] }));
                      setIsBatchDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] text-left transition-all cursor-pointer ${
                      assessmentState.batches.length === 0
                        ? 'bg-indigo-50/90 text-indigo-900 font-bold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <span className="italic">No batch selected</span>
                    {assessmentState.batches.length === 0 && (
                      <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />
                    )}
                  </button>

                  {assessmentState.batches.length > 1 && (
                    <div className="px-3 py-1.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-[11.5px] text-amber-800 font-medium flex items-center justify-between">
                      <span className="truncate">{assessmentState.batches.length} Batches Selected</span>
                      <Check className="w-3.5 h-3.5 text-amber-700 shrink-0 ml-2" />
                    </div>
                  )}

                  <div className="my-1 border-t border-slate-100" />

                  {/* Grouped Batches by Class / Grade */}
                  {Object.entries(groupedDesktopBatches).map(([groupName, bList]) => (
                    <div key={groupName} className="space-y-0.5">
                      <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {groupName}
                      </div>
                      {bList.map((b) => {
                        const isSelected = assessmentState.batches.includes(b.name);
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setAssessmentState((prev) => ({ ...prev, batches: [b.name] }));
                              setIsBatchDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] text-left transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-50/90 text-indigo-900 font-bold'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-900 font-medium'
                            }`}
                          >
                            <span className="truncate">{b.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Sub Header Bar: Title & Utility Buttons ──────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-[17px] sm:text-[19px] font-extrabold text-slate-800 flex items-center gap-2">
            Assessment Builder <Sparkles className="w-4.5 h-4.5 text-indigo-600 fill-indigo-600" />
          </h1>
          <p className="text-[11.5px] sm:text-[12px] text-slate-500">Create high-quality tests in less than 2 minutes</p>
        </div>

        {/* Utility Actions: Horizontally scrollable row on mobile */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          {/* Quick Generate (in 2 min) */}
          <button
            onClick={() => setIsQuickGenerateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-xs whitespace-nowrap flex-shrink-0 cursor-pointer active:scale-95"
            title="Quick Generate in 2 minutes"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
            <span>Quick Generate (in 2 min)</span>
          </button>

          <button
            onClick={() => setIsTemplatesOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[12px] font-bold rounded-xl transition-colors shadow-2xs whitespace-nowrap flex-shrink-0 cursor-pointer"
          >
            <FolderKanban className="w-4 h-4 text-indigo-600" />
            <span className="hidden xs:inline">Template Library</span>
            <span className="xs:hidden">Templates</span>
          </button>

          <button
            onClick={() => setIsDraftsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-bold rounded-xl transition-colors shadow-2xs whitespace-nowrap flex-shrink-0 cursor-pointer"
          >
            <FileCheck className="w-4 h-4 text-slate-500" /> Drafts ({blueprintsList.length})
          </button>

          <button
            onClick={() => setIsQuestionBankOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-200 bg-white hover:bg-indigo-50 text-indigo-700 text-[12px] font-bold rounded-xl transition-colors shadow-2xs whitespace-nowrap flex-shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" /> Bank
          </button>

          <button
            onClick={() => showToast('AIOS Assessment Help Center')}
            className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={() => setTeacherNav('today')}
            className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 8-Step Wizard Stepper Header Bar ────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 flex-shrink-0">
        {/* Mobile Compact Stepper (sm:hidden) */}
        <div className="sm:hidden space-y-2">
          {/* Horizontal dot/pill track */}
          <div className="flex items-center justify-between gap-1">
            {STEP_NAMES.map((step) => {
              const isActive = currentStep === step.num;
              const isCompleted = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => handleNextStep(step.num)}
                  aria-label={`Step ${step.num}: ${step.label}`}
                  className={`flex items-center justify-center transition-all ${
                    isActive
                      ? 'w-7 h-7 rounded-full bg-indigo-600 text-white font-black text-[12px] shadow-sm'
                      : isCompleted
                      ? 'w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-[10px]'
                      : 'w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-[10px]'
                  }`}
                >
                  {isCompleted ? '✓' : step.num}
                </button>
              );
            })}
          </div>

          {/* Label + Progress bar row */}
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-[12px] font-bold text-slate-800">
              Step {currentStep} of 8: <span className="text-indigo-600 font-extrabold">{STEP_NAMES[currentStep - 1]?.label}</span>
            </span>
            <div className="flex items-center gap-2">
              <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="text-[11px] font-extrabold text-slate-600">{progressPct}%</span>
            </div>
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
                    <span className="text-[12.5px] whitespace-nowrap">
                      {step.num === 4 && (assessmentState.paperFormat === 'THEORY' || assessmentState.paperFormat === 'HYBRID')
                        ? 'Sections'
                        : step.label}
                    </span>
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
      <div className="flex-1 flex overflow-hidden relative">
        {/* Active Step Workspace Content (Scrollable, full width) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3.5 sm:px-6 py-4 sm:py-6 pb-20 sm:pb-6 custom-scrollbar min-w-0">
          {currentStep === 1 && (
            <Step1Details
              state={assessmentState}
              onChange={updateState}
              availableBatches={realBatches.map((b) => ({ id: b.id, name: b.name }))}
              onNext={() => handleNextStep(2)}
              onSubjectSelect={(newSubjectId) => setTeacherCtx({ ...teacherCtx, subjectId: newSubjectId })}
              onSaveDraft={handleSaveDraft}
              isSavingDraft={isSavingDraft}
              onOpenAiAssistant={() => setIsAiModalOpen(true)}
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

          {currentStep === 3 && !contextSubject && subjectsWithSyllabus.length > 1 && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <label className="block text-[12.5px] font-bold text-amber-900 mb-2">
                Which subject is this paper for?
              </label>
              <select
                value={activeSubject?.id ?? ''}
                onChange={(e) => changeSubject(e.target.value)}
                className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-[13px] font-semibold text-slate-800"
              >
                <option value="">Select a subject...</option>
                {subjectsWithSyllabus.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
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

          {currentStep === 4 && assessmentState.paperFormat !== 'OMR' ? (
            <Step4SectionBuilder
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(5)}
              onBack={() => setCurrentStep(3)}
            />
          ) : currentStep === 4 ? (
            <Step4Planning
              state={assessmentState}
              onChange={updateState}
              onNext={() => handleNextStep(5)}
              onPrev={() => setCurrentStep(3)}
              chapters={chaptersTree}
            />
          ) : null}

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
              onNext={() => handleNextStep(8)}
              onPrev={() => setCurrentStep(6)}
              state={assessmentState}
              paperId={reviewPaperId}
              isGenerating={isGeneratingReview}
              generationError={generationError}
              onRetryGeneration={() => void generateReviewPaper()}
            />
          )}

          {currentStep === 8 && (
            <Step8Generate
              state={assessmentState}
              reviewPaperId={reviewPaperId}
              onPrev={() => setCurrentStep(7)}
              onPublishSuccess={() => setTeacherNav('assessments')}
              onPublish={handlePublish}
              isPublishing={isPublishing}
              publishError={publishError}
              onSaveDraft={handleSaveDraft}
              isSavingDraft={isSavingDraft}
            />
          )}
        </div>

        {/* Live Summary Side Panel (Desktop xl: only, NEVER on mobile/tablet!) */}
        <div className="hidden xl:block h-full flex-shrink-0">
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
      </div>

      {/* Simple Floating Arrow Handle on Right Edge (Mobile & Tablet: xl:hidden) */}
      <button
        type="button"
        onClick={() => setIsSummaryDrawerOpen(true)}
        aria-label="Open Assessment Summary"
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 xl:hidden flex items-center justify-center w-6 sm:w-7 h-12 sm:h-14 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-l-xl shadow-md cursor-pointer active:scale-95 transition-all focus:outline-none"
      >
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>

      {/* Summary Slide-In Drawer for Mobile & Tablet (xl:hidden) */}
      <div
        className={`fixed inset-0 z-50 xl:hidden transition-all duration-300 ${
          isSummaryDrawerOpen ? 'pointer-events-auto visible' : 'pointer-events-none invisible delay-300'
        }`}
      >
        {/* Dark translucent backdrop */}
        <div
          onClick={() => setIsSummaryDrawerOpen(false)}
          className={`absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-out ${
            isSummaryDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Drawer container with rounded left corners */}
        <div
          className={`absolute top-0 right-0 bottom-0 w-[88vw] max-w-[390px] sm:w-[440px] md:w-[460px] bg-white rounded-l-2xl sm:rounded-l-3xl shadow-2xl overflow-hidden flex flex-col transform transition-transform duration-300 ease-out ${
            isSummaryDrawerOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <AssessmentSummaryPanel
            state={assessmentState}
            totalQuestions={totalQuestions}
            difficultyMix={{ easyPct, medPct, hardPct }}
            estimatedTime={estimatedTime}
            qualityScore={qualityScore}
            availableQuestionsCount={availableQuestionsCount}
            onOpenAiAssistant={() => {
              setIsSummaryDrawerOpen(false);
              setIsAiModalOpen(true);
            }}
            isDrawer={true}
            onClose={() => setIsSummaryDrawerOpen(false)}
          />
        </div>
      </div>

      {/* ── Sticky Apple-Level Unified Global Footer (Steps 1 to 7) ──── */}
      {currentStep < 8 && (
        <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3.5 sm:px-6 py-2.5 sm:py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] flex-shrink-0 pb-[max(12px,env(safe-area-inset-bottom))] transition-all">
          {/* Mobile Actions Row (sm:hidden) */}
          <div className="flex sm:hidden items-center justify-between gap-2 w-full">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-3.5 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px] rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-1 min-h-[46px] cursor-pointer active:scale-95"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSavingDraft}
              className="px-3 py-2.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[12px] rounded-2xl shadow-xs transition-colors flex items-center justify-center gap-1.5 min-h-[46px] disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>{isSavingDraft ? '…' : 'Draft'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleNextStep(Math.min(8, currentStep + 1))}
              disabled={!canAdvance(currentStep).valid}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] xs:text-[13.5px] rounded-2xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-h-[46px] cursor-pointer active:scale-95"
            >
              Next: {
                currentStep === 3 && (assessmentState.paperFormat === 'THEORY' || assessmentState.paperFormat === 'HYBRID')
                  ? 'Sections'
                  : (STEP_NAMES[currentStep]?.label || 'Next')
              } →
            </button>
          </div>

          {/* Desktop Actions Row (hidden sm:flex) */}
          <div className="hidden sm:flex items-center justify-between gap-3 w-full">
            {/* Desktop Progress */}
            <div className="flex items-center gap-4 w-64 xl:w-72">
              <span className="text-[12px] font-bold text-slate-600 whitespace-nowrap">Progress</span>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full bg-indigo-600 transition-all duration-300"
                />
              </div>
              <span className="text-[12px] font-extrabold text-indigo-700 whitespace-nowrap">
                {progressPct}%
              </span>
            </div>

            {/* Desktop Actions */}
            <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-[13px] font-bold rounded-xl transition-colors min-h-[44px] flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
              )}

              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSavingDraft}
                className="px-4 py-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 text-[13px] font-bold rounded-xl transition-colors disabled:opacity-50 min-h-[44px] flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Save className="w-4 h-4 text-slate-500" />
                {isSavingDraft ? 'Saving...' : 'Save Draft'}
              </button>

              <button
                type="button"
                onClick={() => handleNextStep(Math.min(8, currentStep + 1))}
                disabled={!canAdvance(currentStep).valid}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13.5px] rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] cursor-pointer active:scale-95"
              >
                Next: {
                  currentStep === 3 && (assessmentState.paperFormat === 'THEORY' || assessmentState.paperFormat === 'HYBRID')
                    ? 'Sections'
                    : (STEP_NAMES[currentStep]?.label || 'Next')
                } →
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Quick Generate Modal */}
      <QuickGenerateModal
        isOpen={isQuickGenerateOpen}
        onClose={() => setIsQuickGenerateOpen(false)}
        subjects={subjects}
        batches={realBatches}
        onGenerate={handleQuickGenerate}
        isGenerating={isGeneratingReview}
      />
    </div>
  );
}
