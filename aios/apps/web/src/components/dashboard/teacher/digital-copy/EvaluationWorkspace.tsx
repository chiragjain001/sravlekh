'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Check,
  Bookmark,
  FileText,
  Tag,
  HelpCircle,
  User,
  Users,
  CheckCircle2,
  X,
  Plus,
  Award,
  AlertCircle,
  AlertTriangle,
  Minimize2,
  RefreshCw,
  Hand,
  CheckSquare,
  BarChart2,
  FileCheck,
  Search,
  Sparkles,
  PanelLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/auth.context';
import { useNetworkStatus } from '@/hooks/useContextUrlSync';
import {
  useDecideEvaluation,
  useExam,
  useExamResults,
  useStudents,
  usePaper,
  useGradeAnswerSheet,
} from '@/hooks/useApi';

interface EvaluationWorkspaceProps {
  examId?: string;
  initialMode?: 'student-wise' | 'question-wise';
  onExit: () => void;
}

interface StudentCopy {
  id: string;
  index: number;
  totalCopies: number;
  studentName: string;
  avatarInitials: string;
  rollNumber: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  previousScore?: string;
  attendance?: string;
}

interface QuestionItem {
  id: string;
  label: string;
  subLabel?: string;
  maxMarks: number;
  type: string;
  text: string;
  solution?: string | null;
  diagramSvg?: string;
  diagramCaption?: string;
  rubricBreakdown?: { step: string; marks: number }[];
  awardedMarks: number | null;
  mistakeTags: string[];
  isMarked: boolean;
  flaggedForReview?: boolean;
  evaluationState?: 'UNANSWERED' | 'AI_SUGGESTED' | 'MANUALLY_EVALUATED' | 'TEACHER_REVIEWED' | 'FINALIZED';
  aiSuggestion?: {
    suggestedMarks: number;
    confidence: number;
    rationale?: string;
    mistakeTag?: string;
    breakdown?: { step: string; marks: number }[];
    flags?: string[];
  } | null;
  teacherVerified?: boolean;
  awardedRubricSteps?: number[];
}

const SAMPLE_STUDENTS: StudentCopy[] = [
  { id: 'copy-21', index: 21, totalCopies: 60, studentName: 'Aanya Gupta', avatarInitials: 'AG', rollNumber: '21', status: 'COMPLETED', previousScore: '92%', attendance: '96%' },
  { id: 'copy-22', index: 22, totalCopies: 60, studentName: 'Aarush Mehta', avatarInitials: 'AM', rollNumber: '22', status: 'COMPLETED', previousScore: '85%', attendance: '92%' },
  { id: 'copy-23', index: 23, totalCopies: 60, studentName: 'Aarav Sharma', avatarInitials: 'AS', rollNumber: '23', status: 'IN_PROGRESS', previousScore: '88%', attendance: '94%' },
  { id: 'copy-24', index: 24, totalCopies: 60, studentName: 'Aditi Rao', avatarInitials: 'AR', rollNumber: '24', status: 'IN_PROGRESS', previousScore: '90%', attendance: '98%' },
  { id: 'copy-25', index: 25, totalCopies: 60, studentName: 'Ananya Verma', avatarInitials: 'AV', rollNumber: '25', status: 'IN_PROGRESS', previousScore: '78%', attendance: '89%' },
];

const INITIAL_QUESTIONS: QuestionItem[] = [
  {
    id: 'q-1',
    label: 'Q1',
    subLabel: 'Mechanics • Inertia',
    maxMarks: 2,
    type: 'Very Short Answer',
    text: 'Define inertia and state its SI unit.',
    solution: 'Inertia is the natural tendency of an object to resist changes in its state of motion or rest. Mass is the measure of inertia. Its SI unit is kilogram (kg).',
    awardedMarks: 2,
    mistakeTags: ['Correct Concept'],
    isMarked: true,
  },
  {
    id: 'q-2',
    label: 'Q2',
    subLabel: 'Dynamics • Force Types',
    maxMarks: 3,
    type: 'Short Answer',
    text: 'Differentiate between balanced and unbalanced forces with suitable diagrams.',
    solution: 'Balanced forces: Net resultant force is zero; does not change state of rest or uniform motion. Unbalanced forces: Net resultant force is non-zero; causes acceleration.',
    diagramSvg: '<svg viewBox="0 0 260 80" class="w-full max-h-24 text-slate-700" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="25" width="45" height="35" rx="4" fill="#f1f5f9" stroke="#334155" stroke-width="1.5"/><text x="42" y="47" text-anchor="middle" font-size="11" font-weight="bold" fill="#0f172a">A</text><path d="M5 42.5 L20 42.5 M15 38.5 L20 42.5 L15 46.5" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><text x="12" y="32" text-anchor="middle" font-size="9" font-weight="bold" fill="#2563eb">5N</text><path d="M80 42.5 L65 42.5 M70 38.5 L65 42.5 L70 46.5" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><text x="73" y="32" text-anchor="middle" font-size="9" font-weight="bold" fill="#2563eb">5N</text><text x="42.5" y="74" text-anchor="middle" font-size="9" fill="#64748b" font-weight="600">F_net = 0 (Balanced)</text><line x1="110" y1="15" x2="110" y2="70" stroke="#cbd5e1" stroke-dasharray="3 3"/><rect x="160" y="25" width="45" height="35" rx="4" fill="#eff6ff" stroke="#2563eb" stroke-width="1.5"/><text x="182" y="47" text-anchor="middle" font-size="11" font-weight="bold" fill="#1e3a8a">B</text><path d="M140 42.5 L160 42.5 M153 38.5 L160 42.5 L153 46.5" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/><text x="145" y="32" text-anchor="middle" font-size="9" font-weight="bold" fill="#059669">12N</text><path d="M225 42.5 L205 42.5 M212 38.5 L205 42.5 L212 46.5" stroke="#dc2626" stroke-width="1.5" stroke-linecap="round"/><text x="218" y="32" text-anchor="middle" font-size="9" font-weight="bold" fill="#dc2626">4N</text><text x="182.5" y="74" text-anchor="middle" font-size="9" fill="#2563eb" font-weight="600">F_net = 8N &rarr; (Accelerates)</text></svg>',
    diagramCaption: 'Figure 1: Balanced (F_net = 0) vs Unbalanced forces (F_net > 0)',
    awardedMarks: 3,
    mistakeTags: ['Correct Concept', 'Example Given'],
    isMarked: true,
  },
  {
    id: 'q-3',
    label: 'Q3',
    subLabel: 'Newton\'s Third Law',
    maxMarks: 5,
    type: 'Short Answer',
    text: 'State and explain Newton\'s third law of motion with a suitable example.',
    solution: 'To every action, there is an equal and opposite reaction: F_AB = - F_BA. Action and reaction forces act simultaneously on two different bodies.',
    diagramSvg: '<svg viewBox="0 0 240 75" class="w-full max-h-24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="25" y="18" width="50" height="40" rx="4" fill="#f8fafc" stroke="#1e293b" stroke-width="1.5"/><text x="50" y="42" text-anchor="middle" font-size="12" font-weight="bold" fill="#0f172a">Body A</text><rect x="165" y="18" width="50" height="40" rx="4" fill="#f8fafc" stroke="#1e293b" stroke-width="1.5"/><text x="190" y="42" text-anchor="middle" font-size="12" font-weight="bold" fill="#0f172a">Body B</text><path d="M78 30 L120 30 M113 26 L120 30 L113 34" stroke="#2563eb" stroke-width="2" stroke-linecap="round"/><text x="100" y="24" text-anchor="middle" font-size="9" font-weight="bold" fill="#2563eb">F_AB &rarr;</text><path d="M162 46 L120 46 M127 42 L120 46 L127 50" stroke="#dc2626" stroke-width="2" stroke-linecap="round"/><text x="140" y="58" text-anchor="middle" font-size="9" font-weight="bold" fill="#dc2626">&larr; F_BA</text><text x="120" y="72" text-anchor="middle" font-size="9" font-family="monospace" font-weight="bold" fill="#475569">F_AB = - F_BA</text></svg>',
    diagramCaption: 'Figure 2: Action-Reaction mutual force pair between bodies A and B',
    rubricBreakdown: [
      { step: "Correct statement of Newton's 3rd law with action-reaction principle", marks: 2.0 },
      { step: 'Mathematical formulation F_AB = -F_BA with vector notation', marks: 1.5 },
      { step: 'Real-world physical example with explanation of interacting bodies', marks: 1.5 },
    ],
    awardedMarks: 4,
    mistakeTags: ['Correct Concept', 'Example Given', 'Incomplete Explanation'],
    isMarked: true,
    evaluationState: 'AI_SUGGESTED',
    aiSuggestion: {
      suggestedMarks: 4.5,
      confidence: 0.94,
      rationale: "Correctly states Newton's 3rd Law statement and writes vector formula. Misses example of mutual pairs.",
      mistakeTag: 'Incomplete Explanation',
      flags: ['ocr_verified'],
    },
    teacherVerified: false,
  },
  {
    id: 'q-4',
    label: 'Q4',
    subLabel: 'Conservation of Linear Momentum • Recoil',
    maxMarks: 5,
    type: 'Numerical & Theory',
    text: 'A bullet of mass 20g is fired horizontally with a velocity of 150 m/s from a pistol of mass 2kg. (a) Calculate the recoil velocity of the pistol. (b) Explain why the recoil velocity is substantially less than the bullet velocity based on Newton\'s laws. (c) Why must a shooter press the gun tight against their shoulder?',
    solution: null,
    rubricBreakdown: [
      { step: 'Given values conversion (20g = 0.02kg) & momentum formula', marks: 1.5 },
      { step: 'Calculation of recoil velocity (v = -1.5 m/s)', marks: 1.5 },
      { step: 'Reasoning: inverse proportion of velocity to mass (m1v1 = -m2v2)', marks: 1.0 },
      { step: 'Shoulder bracing increases combined mass, reducing recoil kick', marks: 1.0 },
    ],
    awardedMarks: null,
    mistakeTags: [],
    isMarked: false,
    evaluationState: 'AI_SUGGESTED',
    aiSuggestion: {
      suggestedMarks: 4,
      confidence: 0.88,
      rationale: 'Accurate momentum conservation formula (m1v1 = -m2v2) and recoil calculation (-1.5 m/s). Slight brevity in shoulder bracing explanation.',
      mistakeTag: 'Incomplete Explanation',
      flags: ['ocr_verified'],
    },
    teacherVerified: false,
  },
  {
    id: 'q-5',
    label: 'Q5',
    subLabel: 'Gravitation • Altitude Variation',
    maxMarks: 5,
    type: 'Long Answer',
    text: 'Derive the expression for acceleration due to gravity (g) at an altitude h above the surface of the Earth. Hence determine the fractional decrease in the value of g when a body is raised to a height equal to the radius of the Earth (h = R).',
    solution: 'At surface: g = GM/R^2. At height h: g\' = GM/(R+h)^2 = g(1 + h/R)^(-2). For h << R, g\' ≈ g(1 - 2h/R). When h = R: g\' = GM/(2R)^2 = g/4. Fractional decrease = (g - g\')/g = 75%.',
    diagramSvg: '<svg viewBox="0 0 240 85" class="w-full max-h-28" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="65" cy="42" r="32" fill="#dbeafe" stroke="#2563eb" stroke-width="1.5"/><text x="65" y="46" text-anchor="middle" font-size="10" font-weight="bold" fill="#1e40af">Earth (M)</text><line x1="65" y1="42" x2="97" y2="42" stroke="#1e40af" stroke-width="1.5" stroke-dasharray="2 2"/><text x="81" y="37" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e40af">R</text><circle cx="180" cy="42" r="8" fill="#fef3c7" stroke="#d97706" stroke-width="1.5"/><text x="180" y="45" text-anchor="middle" font-size="7" font-weight="bold" fill="#92400e">m</text><line x1="97" y1="42" x2="172" y2="42" stroke="#ea580c" stroke-width="1.5"/><text x="134" y="37" text-anchor="middle" font-size="9" font-weight="bold" fill="#ea580c">Height (h)</text><text x="120" y="76" text-anchor="middle" font-size="9" font-family="monospace" font-weight="bold" fill="#334155">g\' = GM / (R + h)²</text></svg>',
    diagramCaption: 'Figure 3: Variation of gravitational field at altitude h above Earth surface',
    rubricBreakdown: [
      { step: 'Expression for g at Earth surface (g = GM/R²)', marks: 1.0 },
      { step: 'Derivation of g\' at altitude h (g\' = GM/(R+h)²)', marks: 1.5 },
      { step: 'Binomial approximation for h << R: g\' ≈ g(1 - 2h/R)', marks: 1.5 },
      { step: 'Calculation at h = R (g\' = g/4, decrease = 75%)', marks: 1.0 },
    ],
    awardedMarks: null,
    mistakeTags: [],
    isMarked: false,
    evaluationState: 'UNANSWERED',
    teacherVerified: false,
  },
];

// Curated compact diagnostic tags
const STRENGTH_TAGS = ['Correct Concept', 'Example Given', 'Clear Steps'];
const MISTAKE_TAGS = ['Incomplete Explanation', 'Concept Error', 'Formula Error', 'Calculation Error', 'Unit Missing', 'Careless Mistake'];

export function EvaluationWorkspace({
  examId = 'exam-1',
  onExit,
}: EvaluationWorkspaceProps) {
  const { user } = useAuth();
  const isOnline = useNetworkStatus();

  // Dynamic API queries connected to backend database
  const { data: examData } = useExam(examId || null);
  const { data: examResults } = useExamResults(examId || null);
  const batchId = examData?.batchId;
  const { data: studentsResp } = useStudents(batchId ? { batchId, limit: 100 } : undefined);
  const paperId = examData?.papers?.[0]?.id;
  const { data: paperData } = usePaper(paperId ?? null);

  // Dynamic Student list derived from API with SAMPLE_STUDENTS fallback
  const studentsList: StudentCopy[] = useMemo(() => {
    if (Array.isArray(examResults?.students) && examResults.students.length > 0) {
      const totalCount = examResults.students.length;
      return examResults.students.map((st: any, idx: number) => {
        const studentName = st.name || `Student ${idx + 1}`;
        const initials = studentName
          .split(' ')
          .filter(Boolean)
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'ST';
        const roll = st.rollNumber ? String(st.rollNumber) : String(idx + 1);
        const isFin = st.isFinalized ?? false;
        const pct = st.percentage != null ? `${Math.round(st.percentage)}%` : undefined;
        return {
          id: st.studentProfileId || `st-${idx + 1}`,
          index: idx + 1,
          totalCopies: totalCount,
          studentName,
          avatarInitials: initials,
          rollNumber: roll,
          status: isFin ? ('COMPLETED' as const) : ('IN_PROGRESS' as const),
          previousScore: pct,
          attendance: st.participationStatus === 'ABSENT' ? 'Absent' : 'Present',
        };
      });
    }

    const roster = studentsResp?.data ?? [];
    if (Array.isArray(roster) && roster.length > 0) {
      const totalCount = roster.length;
      return roster.map((st: any, idx: number) => {
        const studentName = st.user?.name || `Student ${idx + 1}`;
        const initials = studentName
          .split(' ')
          .filter(Boolean)
          .map((n: string) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'ST';
        const roll = st.rollNumber ? String(st.rollNumber) : String(idx + 1);
        return {
          id: st.id || `st-${idx + 1}`,
          index: idx + 1,
          totalCopies: totalCount,
          studentName,
          avatarInitials: initials,
          rollNumber: roll,
          status: 'IN_PROGRESS' as const,
          attendance: 'Present',
        };
      });
    }

    return SAMPLE_STUDENTS;
  }, [examResults?.students, studentsResp?.data]);

  // Student State
  const [studentIndex, setStudentIndex] = useState(2);
  const currentStudent: StudentCopy = (studentsList[studentIndex] ?? studentsList[0] ?? SAMPLE_STUDENTS[0])!;

  // Questions State
  const [questions, setQuestions] = useState<QuestionItem[]>(INITIAL_QUESTIONS);
  const [questionIndex, setQuestionIndex] = useState(2); // Index 2 = Q3 (a)
  const currentQuestion: QuestionItem = (questions[questionIndex] ?? questions[0] ?? INITIAL_QUESTIONS[0])!;

  // Dynamically load questions from linked paper if available
  useEffect(() => {
    if (paperData?.items && paperData.items.length > 0) {
      const dynamicQs: QuestionItem[] = paperData.items.map((item: any, idx: number) => {
        const q = item.question;
        return {
          id: item.questionId ?? q?.id ?? `q-${idx + 1}`,
          label: `Q${idx + 1}`,
          subLabel: q?.topic?.name ?? undefined,
          maxMarks: item.marks || q?.marks || 5,
          type: q?.type || 'Subjective',
          text: q?.content || q?.text || `Question ${idx + 1}`,
          solution: q?.solution || null,
          diagramSvg: q?.diagramSvg || undefined,
          diagramCaption: q?.diagramCaption || undefined,
          rubricBreakdown: q?.rubricBreakdown || undefined,
          awardedMarks: null,
          mistakeTags: [],
          isMarked: false,
        };
      });
      setQuestions(dynamicQs);
    }
  }, [paperData?.items]);

  // Dynamic Exam Metadata
  const examTitle = examData?.title ?? 'Mid-Term Examination';
  const examClass = examData?.batch?.name ?? 'Class 10A';
  const examSubject = examData?.blueprint?.subject?.name ?? 'Physics';
  const totalCopiesCount = examData?.batch?.studentCount ?? studentsList[0]?.totalCopies ?? studentsList.length;
  const checkedCopiesCount = useMemo(() => {
    if (examResults?.students) {
      return examResults.students.filter((s: any) => s.isFinalized).length;
    }
    return studentsList.filter((s) => s.status === 'COMPLETED').length;
  }, [examResults?.students, studentsList]);
  const remainingCopiesCount = Math.max(0, totalCopiesCount - checkedCopiesCount);

  // Document Canvas State
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 6;
  const [zoomLevel, setZoomLevel] = useState(115);
  const [rotation, setRotation] = useState(0);
  const [isThumbnailsOpen, setIsThumbnailsOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canvasTool, setCanvasTool] = useState<'pointer' | 'hand'>('pointer');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  // Canvas viewport container ref
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Active Marking State for Current Question
  const [awardedMarks, setAwardedMarks] = useState<number | null>(currentQuestion.awardedMarks);
  const [selectedTags, setSelectedTags] = useState<string[]>(currentQuestion.mistakeTags);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showAddCustomTag, setShowAddCustomTag] = useState(false);
  const [isFlagged, setIsFlagged] = useState(currentQuestion.flaggedForReview ?? false);
  const [awardedRubricSteps, setAwardedRubricSteps] = useState<number[]>([]);

  // Adaptive Question Card: expanded view for long questions & diagrams
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);

  // Evaluator Personal Reference Notes (persisted in sessionStorage across student copies)
  const [evaluatorNotes, setEvaluatorNotes] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = sessionStorage.getItem(`aios_eval_ref_notes_${examId}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateEvaluatorNotes = (qId: string, notes: string) => {
    setEvaluatorNotes((prev) => {
      const next = { ...prev, [qId]: notes };
      try {
        sessionStorage.setItem(`aios_eval_ref_notes_${examId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Reset card expansion when changing questions
  useEffect(() => {
    setIsQuestionExpanded(false);
  }, [questionIndex]);

  // Keyboard Feedback HUD Pill
  const [shortcutFeedback, setShortcutFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showShortcutFeedback = useCallback((msg: string) => {
    if (typeof window === 'undefined') return;
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setShortcutFeedback(msg);
    feedbackTimeoutRef.current = setTimeout(() => {
      setShortcutFeedback(null);
    }, 1500);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  // Browser Native Fullscreen (Fn + F11 / F11 API)
  const handleToggleFullscreen = useCallback(() => {
    if (typeof document === 'undefined') return;

    const doc = document as any;
    const docEl = document.documentElement as any;

    const isFs = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (!isFs) {
      const requestFs =
        docEl.requestFullscreen ||
        docEl.webkitRequestFullscreen ||
        docEl.mozRequestFullScreen ||
        docEl.msRequestFullscreen;

      if (typeof requestFs === 'function') {
        try {
          const res = requestFs.call(docEl);
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        } catch {}
      }
      setIsFullscreen(true);
      showShortcutFeedback('Full Screen Mode Enabled (Fn + F11)');
    } else {
      const exitFs =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;

      if (typeof exitFs === 'function') {
        try {
          const res = exitFs.call(doc);
          if (res && typeof res.catch === 'function') {
            res.catch(() => {});
          }
        } catch {}
      }
      setIsFullscreen(false);
      showShortcutFeedback('Exited Full Screen Mode');
    }
  }, [showShortcutFeedback]);

  // Clean Exit Workspace ensuring Fullscreen is exited
  const handleExit = useCallback(() => {
    if (typeof document !== 'undefined') {
      const doc = document as any;
      if (
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement
      ) {
        try {
          const exitFs =
            doc.exitFullscreen ||
            doc.webkitExitFullscreen ||
            doc.mozCancelFullScreen;
          exitFs?.call(doc);
        } catch {}
      }
    }
    onExit();
  }, [onExit]);

  // Sync state with native browser fullscreen changes (e.g. user pressed Fn + F11 or Esc)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const onFullscreenChange = () => {
      const doc = document as any;
      const isFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      setIsFullscreen(isFs);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    document.addEventListener('mozfullscreenchange', onFullscreenChange);
    document.addEventListener('MSFullscreenChange', onFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      document.removeEventListener('mozfullscreenchange', onFullscreenChange);
      document.removeEventListener('MSFullscreenChange', onFullscreenChange);
    };
  }, []);

  // Keyboard Cheatsheet Modal State
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Mutations
  const decideEvaluationMutation = useDecideEvaluation();

  // Autosave & Network State
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'offline' | 'error'>('saved');
  const [lastSavedTimestamp, setLastSavedTimestamp] = useState<string>('Just now');
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, []);

  // Active Slide-Over Drawer
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'blueprint' | 'questions' | 'students' | 'analytics' | 'shortcuts'>('none');
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // Draft Key in SessionStorage for zero-data-loss recovery
  const draftKey = useMemo(() => {
    return `aios_eval_draft_${examId}_${currentStudent.id}_${currentQuestion.id}`;
  }, [examId, currentStudent.id, currentQuestion.id]);

  // Load from draft or sync when switching question or student
  useEffect(() => {
    const savedDraft = sessionStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setAwardedMarks(parsed.marks);
        setSelectedTags(parsed.tags ?? []);
        setAwardedRubricSteps(parsed.rubricSteps ?? []);
        setSaveStatus(parsed.isSynced ? 'saved' : 'offline');
        setLastSavedTimestamp(parsed.isSynced ? 'All changes saved' : 'Restored from local draft');
        return;
      } catch {}
    }

    setAwardedMarks(currentQuestion.awardedMarks);
    setSelectedTags(currentQuestion.mistakeTags);
    setAwardedRubricSteps(currentQuestion.awardedRubricSteps ?? []);
    setIsFlagged(currentQuestion.flaggedForReview ?? false);
    setSaveStatus('saved');
    setLastSavedTimestamp('Just now');
  }, [draftKey, currentQuestion]);

  // Fit to container width
  const handleFitWidth = useCallback(() => {
    if (canvasContainerRef.current) {
      const containerWidth = canvasContainerRef.current.clientWidth;
      const availableWidth = Math.max(320, containerWidth - 48);
      const computedZoom = Math.round((availableWidth / 750) * 100);
      const clamped = Math.min(160, Math.max(60, computedZoom));
      setZoomLevel(clamped);
      setRotation(0);
      showShortcutFeedback(`Fitted to width (${clamped}%)`);
    } else {
      setZoomLevel(100);
      setRotation(0);
    }
  }, [showShortcutFeedback]);

  // Fit to container height (fit entire page)
  const handleFitPage = useCallback(() => {
    if (canvasContainerRef.current) {
      const containerHeight = canvasContainerRef.current.clientHeight;
      const availableHeight = Math.max(400, containerHeight - 64);
      const computedZoom = Math.round((availableHeight / 1000) * 100);
      const clamped = Math.min(150, Math.max(50, computedZoom));
      setZoomLevel(clamped);
      setRotation(0);
      showShortcutFeedback(`Fitted page (${clamped}%)`);
    } else {
      setZoomLevel(85);
    }
  }, [showShortcutFeedback]);

  // Trigger autosave debounced
  const triggerAutosave = useCallback((newMarks: number | null, newTags: string[]) => {
    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    setSaveStatus('saving');

    const draftData = {
      marks: newMarks,
      tags: newTags,
      rubricSteps: awardedRubricSteps,
      updatedAt: new Date().toISOString(),
      isSynced: false,
    };
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {}

    if (!isOnline) {
      setSaveStatus('offline');
      setLastSavedTimestamp('Cached locally (Offline)');
      return;
    }

    autosaveTimeoutRef.current = setTimeout(async () => {
      try {
        if (typeof window === 'undefined') return;
        if (currentQuestion.id && !currentQuestion.id.startsWith('q-') && !currentQuestion.id.startsWith('mock-')) {
          await decideEvaluationMutation.mutateAsync({
            responseId: currentQuestion.id,
            decision: 'ADJUST',
            marksAwarded: newMarks ?? 0,
            mistakeTagType: newTags[0] ?? undefined,
          });
        }
        if (typeof window === 'undefined') return;

        draftData.isSynced = true;
        try {
          sessionStorage.setItem(draftKey, JSON.stringify(draftData));
        } catch {}

        setQuestions((prev) =>
          prev.map((q, idx) =>
            idx === questionIndex
              ? {
                  ...q,
                  awardedMarks: newMarks,
                  mistakeTags: newTags,
                  isMarked: newMarks !== null,
                  flaggedForReview: isFlagged,
                  awardedRubricSteps,
                }
              : q
          )
        );
        setSaveStatus('saved');
        setLastSavedTimestamp(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        if (typeof window === 'undefined') return;
        setSaveStatus('error');
        setLastSavedTimestamp('Save failed — changes cached locally');
      }
    }, 400);
  }, [draftKey, isOnline, currentQuestion.id, decideEvaluationMutation, questionIndex, isFlagged, awardedRubricSteps]);

  // Network sync listener (handles offline caching and automatic reconnect flush)
  useEffect(() => {
    const handleOnline = () => {
      toast.success('Network reconnected. Synchronizing evaluation draft...');
      setSaveStatus('saved');
      setLastSavedTimestamp('Synced on reconnect');
      triggerAutosave(awardedMarks, selectedTags);
    };
    const handleOffline = () => {
      setSaveStatus('offline');
      setLastSavedTimestamp('Offline — cached locally');
      toast.error('Network disconnected. Edits will be saved to local draft.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [awardedMarks, selectedTags, triggerAutosave]);

  // Protect unsaved changes before leaving
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'saving' || saveStatus === 'error') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus]);

  // Accept AI suggestion per 28-DIGITAL-COPY-UX-SPECIFICATION §2
  const handleAcceptAiSuggestion = useCallback(() => {
    if (!currentQuestion.aiSuggestion) return;
    const ai = currentQuestion.aiSuggestion;
    const newTags = ai.mistakeTag && !selectedTags.includes(ai.mistakeTag)
      ? [...selectedTags, ai.mistakeTag]
      : selectedTags;

    setAwardedMarks(ai.suggestedMarks);
    if (newTags !== selectedTags) {
      setSelectedTags(newTags);
    }

    setQuestions((prev) =>
      prev.map((q, idx) =>
        idx === questionIndex
          ? {
              ...q,
              awardedMarks: ai.suggestedMarks,
              mistakeTags: newTags,
              isMarked: true,
              teacherVerified: true,
              evaluationState: 'TEACHER_REVIEWED',
            }
          : q
      )
    );

    triggerAutosave(ai.suggestedMarks, newTags);
    toast.success(`Score accepted: ${ai.suggestedMarks}/${currentQuestion.maxMarks}`, { id: 'ai-accept-toast' });
    showShortcutFeedback(`AI Score Accepted: ${ai.suggestedMarks} marks (Shift+A)`);
  }, [currentQuestion, selectedTags, questionIndex, triggerAutosave, showShortcutFeedback]);

  // Toggle Rubric Criterion Step per 26 §5 & 28 §2
  const handleToggleRubricStep = useCallback((stepIdx: number) => {
    const nextSteps = awardedRubricSteps.includes(stepIdx)
      ? awardedRubricSteps.filter((i) => i !== stepIdx)
      : [...awardedRubricSteps, stepIdx];

    setAwardedRubricSteps(nextSteps);

    const steps = currentQuestion.rubricBreakdown || [];
    const sum = steps.reduce((acc, step, idx) => (nextSteps.includes(idx) ? acc + step.marks : acc), 0);
    const clampedSum = Math.min(currentQuestion.maxMarks, Math.round(sum * 10) / 10);

    setAwardedMarks(clampedSum);
    triggerAutosave(clampedSum, selectedTags);
    showShortcutFeedback(`Rubric: ${clampedSum} / ${currentQuestion.maxMarks}`);
  }, [awardedRubricSteps, currentQuestion, selectedTags, triggerAutosave, showShortcutFeedback]);

  // Set marks handler
  const handleSetMarks = useCallback((val: number | null) => {
    if (val !== null) {
      if (val < 0) val = 0;
      if (val > currentQuestion.maxMarks) val = currentQuestion.maxMarks;
    }
    setAwardedMarks(val);
    triggerAutosave(val, selectedTags);
    if (val !== null) {
      showShortcutFeedback(`Awarded ${val} / ${currentQuestion.maxMarks} marks`);
    }
  }, [currentQuestion.maxMarks, selectedTags, triggerAutosave, showShortcutFeedback]);

  // Fractional increment/decrement (+0.5, -0.5)
  const handleIncrementFraction = useCallback((delta: number) => {
    const current = awardedMarks ?? 0;
    const next = Math.max(0, Math.min(currentQuestion.maxMarks, Math.round((current + delta) * 10) / 10));
    handleSetMarks(next);
  }, [awardedMarks, currentQuestion.maxMarks, handleSetMarks]);

  // Toggle tag
  const handleToggleTag = useCallback((tag: string) => {
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(nextTags);
    triggerAutosave(awardedMarks, nextTags);
    showShortcutFeedback(nextTags.includes(tag) ? `+ Tag: ${tag}` : `- Removed: ${tag}`);
  }, [selectedTags, awardedMarks, triggerAutosave, showShortcutFeedback]);

  // Add custom tag
  const handleAddCustomTag = useCallback(() => {
    if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
      const nextTags = [...selectedTags, customTagInput.trim()];
      setSelectedTags(nextTags);
      setCustomTagInput('');
      setShowAddCustomTag(false);
      triggerAutosave(awardedMarks, nextTags);
      toast.success(`Tag added: "${customTagInput.trim()}"`);
    }
  }, [customTagInput, selectedTags, awardedMarks, triggerAutosave]);

  // Toggle flag for review
  const handleToggleFlag = useCallback(() => {
    const next = !isFlagged;
    setIsFlagged(next);
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === questionIndex ? { ...q, flaggedForReview: next } : q))
    );
    showShortcutFeedback(next ? '🚩 Flagged for review' : '✓ Unflagged');
  }, [isFlagged, questionIndex, showShortcutFeedback]);

  // Save & Next Action
  const handleSaveAndNext = useCallback(() => {
    const updated = questions.map((q, idx) =>
      idx === questionIndex
        ? {
            ...q,
            awardedMarks: awardedMarks !== null ? awardedMarks : 0,
            mistakeTags: selectedTags,
            isMarked: true,
            flaggedForReview: isFlagged,
          }
        : q
    );
    setQuestions(updated);
    toast.success(`Marks saved for ${currentQuestion.label}!`, { id: 'save-toast', duration: 1200 });

    if (questionIndex < questions.length - 1) {
      setQuestionIndex((prev) => prev + 1);
      showShortcutFeedback(`Next Question: ${questions[questionIndex + 1]?.label}`);
    } else {
      if (studentIndex < studentsList.length - 1) {
        setStudentIndex((prev) => prev + 1);
        setQuestionIndex(0);
        toast(`Completed ${currentStudent.studentName}. Loaded next copy.`, { icon: '👏' });
        showShortcutFeedback(`Loaded student ${studentsList[studentIndex + 1]?.studentName}`);
      } else {
        toast.success('All copies in this batch evaluated!');
        showShortcutFeedback('Batch Complete! 🎉');
      }
    }
  }, [questions, questionIndex, awardedMarks, selectedTags, isFlagged, currentQuestion.label, studentIndex, studentsList, currentStudent.studentName, showShortcutFeedback]);

  // Previous Question
  const handlePreviousQuestion = useCallback(() => {
    if (questionIndex > 0) {
      setQuestionIndex((prev) => prev - 1);
      showShortcutFeedback(`Previous: ${questions[questionIndex - 1]?.label}`);
    }
  }, [questionIndex, questions, showShortcutFeedback]);

  // Next Question
  const handleNextQuestion = useCallback(() => {
    if (questionIndex < questions.length - 1) {
      setQuestionIndex((prev) => prev + 1);
      showShortcutFeedback(`Next: ${questions[questionIndex + 1]?.label}`);
    }
  }, [questionIndex, questions, showShortcutFeedback]);

  // Previous Student
  const handlePreviousStudent = useCallback(() => {
    if (studentIndex > 0) {
      const prev = studentsList[studentIndex - 1];
      setStudentIndex((s) => s - 1);
      if (prev) {
        toast(`Loaded ${prev.studentName}`, { icon: '👤' });
        showShortcutFeedback(`Student: ${prev.studentName}`);
      }
    }
  }, [studentIndex, studentsList, showShortcutFeedback]);

  // Next Student
  const handleNextStudent = useCallback(() => {
    if (studentIndex < studentsList.length - 1) {
      const next = studentsList[studentIndex + 1];
      setStudentIndex((s) => s + 1);
      if (next) {
        toast(`Loaded ${next.studentName}`, { icon: '👤' });
        showShortcutFeedback(`Student: ${next.studentName}`);
      }
    }
  }, [studentIndex, studentsList, showShortcutFeedback]);

  // Drag-to-pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (canvasTool !== 'hand' || !canvasContainerRef.current) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: canvasContainerRef.current.scrollLeft,
      scrollTop: canvasContainerRef.current.scrollTop,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasContainerRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    canvasContainerRef.current.scrollLeft = dragStart.scrollLeft - dx;
    canvasContainerRef.current.scrollTop = dragStart.scrollTop - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Keyboard navigation listener (strictly handles shortcuts without focus conflict)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputActive = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Escape always works
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
          return;
        }
        if (activeDrawer !== 'none') {
          setActiveDrawer('none');
          return;
        }
        handleExit();
        return;
      }

      // Do not trigger shortcuts when typing in an input
      if (isInputActive) {
        if (e.key === 'Enter') {
          // Allow enter inside custom tag
          return;
        }
        return;
      }

      // Accept AI Suggestion: Shift+A or y/Y
      if (((e.key === 'A' || e.key === 'a') && e.shiftKey) || e.key === 'y' || e.key === 'Y') {
        if (currentQuestion.aiSuggestion && !currentQuestion.teacherVerified) {
          e.preventDefault();
          handleAcceptAiSuggestion();
          return;
        }
      }

      // Fast mark assignment: 0 to 9
      if (e.key >= '0' && e.key <= '9') {
        const val = parseInt(e.key, 10);
        if (val <= currentQuestion.maxMarks) {
          e.preventDefault();
          handleSetMarks(val);
        } else {
          e.preventDefault();
          showShortcutFeedback(`Max marks for ${currentQuestion.label} is ${currentQuestion.maxMarks}`);
        }
        return;
      }

      // Fractional mark increments: . or + or = or ArrowUp
      if (e.key === '.' || e.key === '+' || e.key === '=' || e.key === 'ArrowUp') {
        e.preventDefault();
        handleIncrementFraction(0.5);
        return;
      }

      // Fractional mark decrements: - or _ or ArrowDown
      if (e.key === '-' || e.key === '_' || e.key === 'ArrowDown') {
        e.preventDefault();
        handleIncrementFraction(-0.5);
        return;
      }

      // Flag / Bookmark question: M or m
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleFlag();
        return;
      }

      // Enter: Save and Next
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveAndNext();
        return;
      }

      // Left Arrow / A: Previous Question
      if ((e.key === 'ArrowLeft' && !e.shiftKey) || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        handlePreviousQuestion();
        return;
      }

      // Right Arrow / D: Next Question
      if ((e.key === 'ArrowRight' && !e.shiftKey) || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        handleNextQuestion();
        return;
      }

      // Shift + Right / ] / N: Next Student
      if ((e.key === 'ArrowRight' && e.shiftKey) || e.key === ']' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        handleNextStudent();
        return;
      }

      // Shift + Left / [ / B: Previous Student
      if ((e.key === 'ArrowLeft' && e.shiftKey) || e.key === '[' || e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        handlePreviousStudent();
        return;
      }

      // PageUp / W / Alt+Left / Alt+Up: Previous booklet page
      if (
        e.key === 'PageUp' ||
        e.key === 'w' ||
        e.key === 'W' ||
        (e.altKey && e.key === 'ArrowLeft') ||
        (e.altKey && e.key === 'ArrowUp')
      ) {
        e.preventDefault();
        setCurrentPage((p) => {
          const next = Math.max(1, p - 1);
          showShortcutFeedback(`Page ${next} of ${totalPages} (W)`);
          return next;
        });
        return;
      }

      // PageDown / S / Alt+Right / Alt+Down: Next booklet page
      if (
        e.key === 'PageDown' ||
        e.key === 's' ||
        e.key === 'S' ||
        (e.altKey && e.key === 'ArrowRight') ||
        (e.altKey && e.key === 'ArrowDown')
      ) {
        e.preventDefault();
        setCurrentPage((p) => {
          const next = Math.min(totalPages, p + 1);
          showShortcutFeedback(`Page ${next} of ${totalPages} (S)`);
          return next;
        });
        return;
      }

      // F key: Fit Width
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (e.shiftKey) {
          handleFitPage();
        } else {
          handleFitWidth();
        }
        return;
      }

      // R key: Rotate
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setRotation((r) => (r + 90) % 360);
        showShortcutFeedback('Rotated 90°');
        return;
      }

      // P key: Toggle Pages sidebar
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsThumbnailsOpen((prev) => !prev);
        showShortcutFeedback(isThumbnailsOpen ? 'Pages Collapsed' : 'Pages Expanded');
        return;
      }

      // H key: Toggle Hand tool
      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        setCanvasTool((prev) => (prev === 'pointer' ? 'hand' : 'pointer'));
        showShortcutFeedback(canvasTool === 'pointer' ? 'Hand Pan Tool Active' : 'Pointer Active');
        return;
      }

      // F11: Toggle Fullscreen (Fn + F11)
      if (e.key === 'F11') {
        e.preventDefault();
        handleToggleFullscreen();
        return;
      }

      // ? key: Shortcuts Modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentQuestion,
    handleSetMarks,
    handleAcceptAiSuggestion,
    handleIncrementFraction,
    handleSaveAndNext,
    handlePreviousQuestion,
    handleNextQuestion,
    handlePreviousStudent,
    handleNextStudent,
    handleFitWidth,
    handleFitPage,
    handleToggleFullscreen,
    handleExit,
    isThumbnailsOpen,
    canvasTool,
    totalPages,
    showShortcutFeedback,
    showShortcutsModal,
    activeDrawer,
  ]);

  // Aggregate student score
  const totalAwardedSoFar = useMemo(() => {
    return questions.reduce((sum, q) => sum + (q.awardedMarks ?? 0), 0);
  }, [questions]);

  const maxPossibleMarks = useMemo(() => {
    return questions.reduce((sum, q) => sum + q.maxMarks, 0);
  }, [questions]);

  // Filtered students for roster drawer
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return studentsList;
    const q = studentSearchQuery.toLowerCase();
    return studentsList.filter(
      (s) => s.studentName.toLowerCase().includes(q) || s.rollNumber.includes(q)
    );
  }, [studentsList, studentSearchQuery]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col overflow-hidden select-none font-sans animate-fadein">
      {/* ── 1. Top Distraction-Free Header (Without Student/Question-wise toggle) ─ */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={handleExit}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
            title="Return to Evaluation Desk (Esc)"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* AIOS Brand pill */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-xs shadow-xs tracking-tight">
              AIOS
            </div>
            <div className="hidden sm:block h-4 w-[1px] bg-slate-200" />
          </div>

          {/* Exam metadata */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">{examTitle}</span>
              <span className="px-2 py-0.5 rounded text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex-shrink-0">
                {examClass}
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-600 flex-shrink-0">
                {examSubject}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">
              {checkedCopiesCount} / {totalCopiesCount} copies checked • {remainingCopiesCount} remaining
            </p>
          </div>
        </div>

        {/* Right Tools & Exit */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Keyboard Shortcuts (?)"
          >
            <HelpCircle className="w-4 h-4 text-blue-600" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="px-1 text-[9px] font-mono bg-slate-100 border border-slate-200 rounded text-slate-500">?</kbd>
          </button>

          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <span>Exit</span>
            <kbd className="hidden sm:inline px-1 py-0.5 text-[9px] font-mono bg-white text-slate-400 rounded border border-slate-200">Esc</kbd>
          </button>
        </div>
      </header>

      {/* ── 2. Student Context Sub-Header ────────────────────────────────────── */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-20 text-xs shadow-2xs">
        {/* Prev Student */}
        <button
          onClick={handlePreviousStudent}
          disabled={studentIndex === 0}
          className="flex items-center gap-1 text-slate-600 font-semibold hover:text-slate-900 disabled:opacity-30 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Previous Student</span>
          <kbd className="hidden md:inline text-[9px] font-mono text-slate-400 bg-slate-50 px-1 border rounded">[</kbd>
        </button>

        {/* Current Student Profile Bar */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-slate-800 text-xs sm:text-sm flex-shrink-0">
            {currentStudent.index} / {totalCopiesCount}
          </span>

          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
            {currentStudent.avatarInitials}
          </div>

          <div className="min-w-0 truncate">
            <span className="font-bold text-slate-900 text-xs sm:text-sm">{currentStudent.studentName}</span>
            <span className="hidden md:inline text-slate-400 ml-2 font-mono">Roll No. {currentStudent.rollNumber}</span>
          </div>

          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex-shrink-0 ${
            currentStudent.status === 'COMPLETED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {currentStudent.status === 'COMPLETED' ? 'Completed' : 'In Progress'}
          </span>

          <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 pl-2 border-l border-slate-200">
            <span>Score:</span>
            <span className="font-mono font-bold text-blue-600">{totalAwardedSoFar} / {maxPossibleMarks}</span>
          </div>
        </div>

        {/* Next Student */}
        <button
          onClick={handleNextStudent}
          disabled={studentIndex === studentsList.length - 1}
          className="flex items-center gap-1 text-blue-600 font-bold hover:text-blue-700 disabled:opacity-30 transition-colors flex-shrink-0"
        >
          <span className="hidden sm:inline">Next Student</span>
          <kbd className="hidden md:inline px-1 py-0.5 text-[9px] font-mono bg-blue-50 text-blue-600 rounded border border-blue-200">Shift &rarr;</kbd>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── 3. Main Split View ──────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Left: Page Thumbnails Strip ────────────────────────────────────── */}
        {isThumbnailsOpen ? (
          <aside className="w-24 sm:w-28 bg-slate-100 border-r border-slate-200 flex flex-col flex-shrink-0 z-10 transition-all">
            <div className="p-2 border-b border-slate-200 flex items-center justify-between text-slate-700 text-[11px] font-bold">
              <div className="flex items-center gap-1.5 min-w-0">
                <PanelLeft className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span className="whitespace-nowrap">Pages ({totalPages})</span>
              </div>
              <button
                onClick={() => {
                  setIsThumbnailsOpen(false);
                  showShortcutFeedback('Pages Collapsed (P)');
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                title="Collapse page strip (P)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-none">
              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isSelected = currentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-full aspect-[3/4] rounded-lg border-2 overflow-hidden flex flex-col items-center justify-between p-1 bg-white transition-all ${
                      isSelected
                        ? 'border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                        : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <div className="w-full h-full bg-slate-50 border border-slate-100 rounded flex flex-col p-1 text-[7px] text-slate-400 overflow-hidden leading-tight select-none pointer-events-none">
                      <div className="w-full h-1 bg-slate-200 rounded mb-1" />
                      <div className="w-4/5 h-1 bg-slate-200 rounded mb-1" />
                      <div className="w-full h-1 bg-slate-200 rounded mb-1" />
                      <div className="w-3/5 h-1 bg-slate-200 rounded" />
                    </div>
                    <span
                      className={`text-[10px] font-bold mt-0.5 ${
                        isSelected ? 'text-blue-600' : 'text-slate-500'
                      }`}
                    >
                      {pageNum}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        ) : (
          /* ── Left: Slim Collapsed Rail with Dedicated Expand Button & Page Numbers ── */
          <aside className="w-9 sm:w-10 bg-slate-800 border-r border-slate-700/80 flex flex-col items-center py-2 flex-shrink-0 z-20 select-none shadow-sm transition-all">
            <button
              onClick={() => {
                setIsThumbnailsOpen(true);
                showShortcutFeedback('Pages Expanded (P)');
              }}
              className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-xs hover:scale-105"
              title="Expand page thumbnails (P)"
            >
              <ChevronRight className="w-4 h-4 text-white" />
            </button>

            <div className="mt-3 flex-1 flex flex-col items-center space-y-1.5 w-full">
              <span
                onClick={() => {
                  setIsThumbnailsOpen(true);
                  showShortcutFeedback('Pages Expanded (P)');
                }}
                className="text-[8.5px] font-black text-slate-400 hover:text-blue-300 tracking-wider uppercase [writing-mode:vertical-lr] my-1 cursor-pointer select-none"
              >
                Pages ({totalPages})
              </span>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                const isSelected = currentPage === pageNum;
                return (
                  <button
                    key={pageNum}
                    onClick={() => {
                      setCurrentPage(pageNum);
                      showShortcutFeedback(`Page ${pageNum} of ${totalPages}`);
                    }}
                    className={`w-6 h-6 rounded-md text-[10px] font-mono font-bold flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs ring-1 ring-white/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                    title={`Jump to Page ${pageNum}`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* ── Center: Answer Sheet Canvas ───────────────────────────────────── */}
        <main className="flex-1 bg-slate-900/95 flex flex-col min-w-0 overflow-hidden relative select-none">
          {/* ── Document Canvas Control Bar (Docked at Top, Zero Overlap with Copy) ── */}
          <div className="h-10 bg-slate-800/95 border-b border-slate-700/80 px-3 sm:px-4 flex items-center justify-between text-xs text-white flex-shrink-0 z-20 shadow-sm backdrop-blur-md">
            {/* Left: Pages Strip Toggle + Page Navigator */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Pages Sidebar Toggle Button */}
              <button
                onClick={() => {
                  const next = !isThumbnailsOpen;
                  setIsThumbnailsOpen(next);
                  showShortcutFeedback(next ? 'Pages Expanded (P)' : 'Pages Collapsed (P)');
                }}
                className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs ${
                  isThumbnailsOpen
                    ? 'bg-slate-700/80 text-slate-200 hover:text-white hover:bg-slate-600 border border-slate-600/70'
                    : 'bg-blue-600/90 hover:bg-blue-600 text-white border border-blue-500/80 hover:shadow-blue-500/25'
                }`}
                title="Toggle page thumbnails (P)"
              >
                <PanelLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pages</span>
                <span className="text-[10px] font-mono opacity-80">({totalPages})</span>
                {isThumbnailsOpen ? (
                  <ChevronLeft className="w-3 h-3 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-blue-200" />
                )}
              </button>

              <div className="w-[1px] h-4 bg-slate-700" />

              {/* Page Navigator with visible shortcut hints */}
              <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const next = Math.max(1, currentPage - 1);
                  setCurrentPage(next);
                  showShortcutFeedback(`Page ${next} of ${totalPages} (W)`);
                }}
                disabled={currentPage === 1}
                className="px-1.5 py-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                title="Previous Page (W, PageUp, or Alt+←)"
              >
                <ChevronLeft className="w-4 h-4" />
                <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] font-mono bg-slate-700/80 text-slate-300 rounded border border-slate-600 font-semibold">
                  W
                </kbd>
              </button>

              <div className="flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-900/70 border border-slate-700 shadow-2xs">
                <span className="text-white font-bold">Page {currentPage}</span>
                <span className="text-slate-400">/ {totalPages}</span>
              </div>

              <button
                onClick={() => {
                  const next = Math.min(totalPages, currentPage + 1);
                  setCurrentPage(next);
                  showShortcutFeedback(`Page ${next} of ${totalPages} (S)`);
                }}
                disabled={currentPage === totalPages}
                className="px-1.5 py-1 rounded hover:bg-slate-700 disabled:opacity-30 text-slate-300 hover:text-white transition-colors flex items-center gap-1"
                title="Next Page (S, PageDn, or Alt+→)"
              >
                <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] font-mono bg-slate-700/80 text-slate-300 rounded border border-slate-600 font-semibold">
                  S
                </kbd>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center: Zoom Controls & Presets */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 bg-slate-900/60 border border-slate-700 rounded-lg p-0.5">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Zoom Out (-)"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs font-semibold w-12 text-center text-slate-200">
                  {zoomLevel}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                  className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  title="Zoom In (+)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="w-[1px] h-4 bg-slate-700" />

              {/* Fit Controls */}
              <button
                onClick={handleFitWidth}
                className="text-slate-300 hover:text-white transition-colors font-medium px-2 py-1 rounded hover:bg-slate-700 text-xs flex items-center gap-1"
                title="Fit Width (F)"
              >
                <span>Fit Width</span>
              </button>

              <button
                onClick={handleFitPage}
                className="text-slate-300 hover:text-white transition-colors font-medium px-2 py-1 rounded hover:bg-slate-700 text-xs hidden sm:flex items-center gap-1"
                title="Fit Entire Page (Shift + F)"
              >
                <span>Fit Page</span>
              </button>

              <div className="w-[1px] h-4 bg-slate-700" />

              {/* Rotate */}
              <button
                onClick={() => {
                  setRotation((r) => (r + 90) % 360);
                  showShortcutFeedback('Rotated 90°');
                }}
                className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700 text-xs"
                title="Rotate Page 90° (R)"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Rotate</span>
              </button>
            </div>

            {/* Right: Interaction Tools */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const next = canvasTool === 'pointer' ? 'hand' : 'pointer';
                  setCanvasTool(next);
                  showShortcutFeedback(next === 'hand' ? 'Hand Pan Tool Active' : 'Pointer Active');
                }}
                className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 font-medium transition-colors ${
                  canvasTool === 'hand' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Pan Tool (H) — click & drag paper"
              >
                <Hand className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{canvasTool === 'hand' ? 'Hand Pan' : 'Select'}</span>
              </button>

              <div className="w-[1px] h-4 bg-slate-700" />

              <button
                onClick={handleToggleFullscreen}
                className={`transition-colors p-1.5 rounded ${
                  isFullscreen
                    ? 'text-blue-400 hover:text-blue-300 bg-slate-700/80 hover:bg-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title={isFullscreen ? 'Exit Full Screen (Fn + F11 / Esc)' : 'Full Screen Mode (Fn + F11 / F11)'}
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* High-Resolution Answer Sheet Paper Viewport (100% Unobstructed, Zero Overlap) */}
          <div
            ref={canvasContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`flex-1 overflow-auto p-4 sm:p-8 flex items-start justify-center ${
              canvasTool === 'hand' ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
          >
            <div
              className="bg-[#faf9f6] text-slate-900 rounded-sm shadow-2xl relative transition-transform duration-150 origin-top mb-12"
              style={{
                width: `${750 * (zoomLevel / 100)}px`,
                minHeight: `${1000 * (zoomLevel / 100)}px`,
                transform: `rotate(${rotation}deg)`,
                fontFamily: 'serif',
                backgroundImage: 'repeating-linear-gradient(#faf9f6 0px, #faf9f6 27px, #e2e8f0 28px)',
              }}
            >
              {/* Paper Margins */}
              <div className="absolute left-14 sm:left-16 top-0 bottom-0 w-[1.5px] bg-rose-300/80 pointer-events-none" />
              <div className="p-6 sm:p-8 pl-16 sm:pl-20 pt-8 sm:pt-10 text-[14px] sm:text-[15px] leading-[28px] text-slate-800">
                {/* Header Page Number stamp */}
                <div className="text-right text-xs font-mono text-slate-400 mb-2">
                  Page {currentPage} of {totalPages} • Roll {currentStudent.rollNumber}
                </div>

                {/* Hand-written Q3 Response */}
                <div className="space-y-4">
                  <p className="font-semibold text-slate-900 underline text-base">
                    Q3. Newton&apos;s Third Law of Motion:
                  </p>
                  <p className="indent-4 text-slate-800 font-sans tracking-wide">
                    According to Newton&apos;s third law, for every action there is an equal and opposite reaction.
                    If object A exerts a force on object B, then object B also exerts an equal force on object A
                    in the opposite direction.
                  </p>

                  <p className="font-medium text-slate-900 mt-2">Force Pair &amp; Action-Reaction Diagram:</p>

                  {/* Physics block diagram */}
                  <div className="my-6 border border-slate-300 bg-white/80 p-4 rounded max-w-md mx-auto text-center font-sans text-xs shadow-2xs">
                    <div className="flex items-center justify-center gap-10 my-3">
                      <div className="w-16 h-14 border-2 border-slate-800 bg-slate-50 flex items-center justify-center font-bold text-sm shadow-2xs">
                        A
                      </div>
                      <div className="flex flex-col items-center gap-1 font-mono font-bold text-slate-700">
                        <span>F_AB &rarr;</span>
                        <span className="text-blue-600">&larr; F_BA</span>
                      </div>
                      <div className="w-16 h-14 border-2 border-slate-800 bg-slate-50 flex items-center justify-center font-bold text-sm shadow-2xs">
                        B
                      </div>
                    </div>
                    <p className="font-mono text-xs font-bold text-slate-700 mt-2">
                      F_AB = - F_BA
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      These forces are equal in magnitude but opposite in direction and act on two different bodies.
                    </p>
                  </div>

                  <p className="font-medium text-slate-900 mt-2">Example &amp; Recoil Explanation:</p>
                  <p className="indent-4 text-slate-800 font-sans tracking-wide">
                    When a gun fires a bullet, the gun exerts a forward force on the bullet, so the bullet moves
                    forward. At the same time, the bullet exerts an equal and opposite reaction force on the gun, which
                    causes the gun to recoil backward.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ── Right: Streamlined, Zero-Clutter Grading Dock ─────────────────── */}
        <aside className="w-80 sm:w-88 lg:w-96 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 z-10 shadow-lg">
          {/* Question Switcher Tab */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between text-xs bg-slate-50/70 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePreviousQuestion}
                disabled={questionIndex === 0}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 transition-colors"
                title="Previous Question (← or A)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white border border-slate-200 shadow-2xs">
                <span className="font-black text-slate-900 text-xs sm:text-sm tracking-tight">{currentQuestion.label}</span>
                <span className="text-slate-400 text-xs font-semibold">of {questions.length}</span>
              </div>

              <button
                onClick={handleNextQuestion}
                disabled={questionIndex === questions.length - 1}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 disabled:opacity-30 transition-colors"
                title="Next Question (→ or D)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              {currentQuestion.isMarked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                  <Check className="w-3.5 h-3.5 text-emerald-600" /> Marked ({currentQuestion.awardedMarks} pts)
                </span>
              )}

              <button
                onClick={handleToggleFlag}
                className={`p-1.5 rounded-lg transition-colors ${
                  isFlagged ? 'bg-amber-100 text-amber-700' : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                }`}
                title={isFlagged ? 'Flagged for coordinator review (Press M to toggle)' : 'Flag for review (M)'}
              >
                <Bookmark className={`w-4 h-4 ${isFlagged ? 'fill-amber-600 text-amber-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Scrollable Container with balanced luxury spacing */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-none">
            {/* Question Info Card (Adaptive layout for long text & diagrams) */}
            <div className="bg-gradient-to-br from-slate-50/90 via-white to-blue-50/20 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-600 text-white shadow-2xs">
                    {currentQuestion.label}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                    {currentQuestion.maxMarks} marks
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    {currentQuestion.type}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {currentQuestion.solution ? (
                    <button
                      onClick={() => setActiveDrawer('blueprint')}
                      className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                      title="Model answer stored in DB — Click to inspect"
                    >
                      <FileText className="w-3 h-3 text-emerald-600" />
                      <span>Model Ans</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveDrawer('blueprint')}
                      className="text-[10.5px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                      title="No answer in DB — Click for step-wise rubric & personal notes"
                    >
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>No DB Ans</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveDrawer('blueprint')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Expand Full Blueprint (Question, Diagram & Solution Key)"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Adaptive Question Text: automatically scrolls or expands without pushing controls off-screen */}
              <div className="relative">
                <div
                  className={`text-[13px] sm:text-[13.5px] text-slate-800 leading-relaxed font-medium transition-all ${
                    isQuestionExpanded ? 'max-h-64 overflow-y-auto pr-1' : 'max-h-24 overflow-y-auto pr-1'
                  }`}
                >
                  <p>{currentQuestion.text}</p>
                </div>

                {currentQuestion.text.length > 110 && (
                  <button
                    onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
                    className="mt-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition-colors"
                  >
                    <span>{isQuestionExpanded ? 'Show Less' : 'Show Full Question'}</span>
                    {isQuestionExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              {/* Diagram Card: cleanly scaled and proportioned */}
              {currentQuestion.diagramSvg && (
                <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-2xs">
                  <div
                    className="w-full flex items-center justify-center max-h-28 overflow-hidden cursor-pointer"
                    onClick={() => setActiveDrawer('blueprint')}
                    title="Click to view full-resolution blueprint diagram"
                    dangerouslySetInnerHTML={{ __html: currentQuestion.diagramSvg }}
                  />
                  {currentQuestion.diagramCaption && (
                    <div className="flex items-center justify-between mt-1 pt-1 border-t border-slate-100 text-[10px] text-slate-500 font-medium">
                      <span className="italic truncate">{currentQuestion.diagramCaption}</span>
                      <button
                        onClick={() => setActiveDrawer('blueprint')}
                        className="text-blue-600 hover:underline flex-shrink-0 ml-1.5 font-semibold"
                      >
                        Inspect
                      </button>
                    </div>
                  )}
                </div>
              )}

              {currentQuestion.subLabel && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span className="text-slate-400">Topic:</span>
                  <span className="font-semibold text-slate-700">{currentQuestion.subLabel}</span>
                </div>
              )}
            </div>

            {/* ── AI Suggestion Review Card (Visible & Distinct per 28-DIGITAL-COPY-UX §2) ── */}
            {currentQuestion.aiSuggestion && (
              <div className="bg-gradient-to-br from-purple-50/90 via-indigo-50/60 to-white border-2 border-purple-300/80 rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>AI Suggestion:</span>
                    <span className="font-extrabold text-purple-700 bg-white px-2 py-0.5 rounded-md border border-purple-200">
                      {currentQuestion.aiSuggestion.suggestedMarks} / {currentQuestion.maxMarks} marks
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {currentQuestion.teacherVerified && (
                      <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Teacher Verified
                      </span>
                    )}
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 font-mono">
                      {Math.round(currentQuestion.aiSuggestion.confidence * 100)}% conf
                    </span>
                  </div>
                </div>

                {currentQuestion.aiSuggestion.rationale && (
                  <p className="text-[11.5px] text-purple-900/90 bg-white/70 p-2.5 rounded-xl border border-purple-100 leading-relaxed">
                    {currentQuestion.aiSuggestion.rationale}
                  </p>
                )}

                <p className="text-[10.5px] text-purple-800/80 italic">
                  Non-terminal recommendation: Does not become an official mark until accepted or adjusted by a human teacher.
                </p>

                <div className="flex items-center gap-2 pt-1 border-t border-purple-200/60">
                  {currentQuestion.teacherVerified ? (
                    <div className="flex-1 py-1.5 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Teacher Verified</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleAcceptAiSuggestion}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-[0.99]"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Accept AI Suggestion</span>
                      <kbd className="hidden sm:inline px-1 py-0.2 text-[9px] font-mono bg-purple-500 rounded text-purple-100">
                        Shift+A
                      </kbd>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleSetMarks(currentQuestion.aiSuggestion?.suggestedMarks ?? 0);
                      showShortcutFeedback('Adjust marks below');
                    }}
                    className="px-3 py-2 bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    Adjust
                  </button>
                </div>
              </div>
            )}

            {/* ── Step-Wise Rubric Scoring Criteria Card (per 26 §5 & 28 §2) ── */}
            {currentQuestion.rubricBreakdown && currentQuestion.rubricBreakdown.length > 0 && (
              <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 tracking-tight">
                    <CheckSquare className="w-4 h-4 text-blue-600" />
                    <span>Rubric Criteria Breakdown</span>
                  </div>
                  <span className="text-[10.5px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {currentQuestion.rubricBreakdown.length} steps
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Total score is derived from the criteria below. Click criteria to award or deduct step marks:
                </p>

                <div className="space-y-1.5 pt-1">
                  {currentQuestion.rubricBreakdown.map((step, idx) => {
                    const isAwarded = awardedRubricSteps.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleToggleRubricStep(idx)}
                        aria-label={`Toggle rubric step: ${step.step}`}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                          isAwarded
                            ? 'bg-blue-50/80 border-blue-300 text-blue-900 font-medium shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100/60'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 text-xs border ${
                            isAwarded
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isAwarded && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="leading-snug">{step.step}</p>
                        </div>
                        <span
                          className={`text-[11px] font-bold shrink-0 font-mono px-1.5 py-0.5 rounded ${
                            isAwarded ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          +{step.marks}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Award Marks Card ────────────────────────────────────────── */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 tracking-tight">
                  <Award className="w-4 h-4 text-blue-600" />
                  <span>Award Marks</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    aria-label="+0.5"
                    onClick={() => handleIncrementFraction(0.5)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-0.5"
                    title="Add half mark (+0.5 or Up Arrow)"
                  >
                    <span>+0.5</span>
                    <kbd className="text-[8px] font-mono text-blue-400">↑</kbd>
                  </button>
                  <button
                    aria-label="-0.5"
                    onClick={() => handleIncrementFraction(-0.5)}
                    className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors flex items-center gap-0.5"
                    title="Subtract half mark (-0.5 or Down Arrow)"
                  >
                    <span>-0.5</span>
                    <kbd className="text-[8px] font-mono text-slate-400">↓</kbd>
                  </button>
                  <span className="text-[11px] text-slate-400 ml-1 font-medium">Quick Marks</span>
                </div>
              </div>

              {/* Row 1: Direct Score Input Stepper */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">Question Score</span>
                  {awardedRubricSteps.length > 0 && (
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      Derived from Rubric
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 bg-white border-2 border-slate-200 focus-within:border-blue-500 rounded-lg px-2.5 py-1 shadow-2xs transition-colors">
                  <input
                    type="number"
                    min="0"
                    max={currentQuestion.maxMarks}
                    step="0.5"
                    value={awardedMarks !== null ? awardedMarks : ''}
                    placeholder="—"
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      handleSetMarks(val);
                    }}
                    className="w-14 text-center text-lg font-black text-blue-600 outline-none bg-transparent"
                  />
                  <span className="text-xs font-bold text-slate-400">/ {currentQuestion.maxMarks}</span>
                </div>
              </div>

              {/* Row 2: Tactile Quick Marks Pill Row (Full Width, never truncated) */}
              <div className="flex items-center gap-1.5 w-full">
                {Array.from({ length: currentQuestion.maxMarks + 1 }).map((_, m) => {
                  const isSelected = awardedMarks === m;
                  return (
                    <button
                      key={m}
                      aria-label={`Mark ${m}`}
                      onClick={() => handleSetMarks(m)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/25 scale-[1.02]'
                          : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>

              {/* Shortcut reminder */}
              <div className="pt-0.5 flex items-center justify-between text-[10.5px] text-slate-400">
                <span>Keyboard: <kbd className="font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded border text-[9.5px]">0-{currentQuestion.maxMarks}</kbd></span>
                <span><kbd className="font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded border text-[9.5px]">↑ / ↓</kbd> for ±0.5</span>
              </div>
            </div>

            {/* ── Performance Tags Card ──────────────────────────────────── */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-900 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Performance Tags</span>
                </div>
                <button
                  onClick={() => setShowAddCustomTag(!showAddCustomTag)}
                  className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" /> Custom Tag
                </button>
              </div>

              {/* Add Custom Tag Input */}
              {showAddCustomTag && (
                <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200 animate-in fade-in">
                  <input
                    type="text"
                    placeholder="Enter custom tag name..."
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddCustomTag();
                    }}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleAddCustomTag}
                    className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              )}

              {/* Categorized Tag Chips */}
              <div className="space-y-2.5">
                {/* Strengths */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-emerald-700/80">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Strengths</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STRENGTH_TAGS.map((tag) => {
                      const isChecked = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => handleToggleTag(tag)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            isChecked
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs font-bold'
                              : 'bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 border border-transparent'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Common Gaps / Diagnostic Mistakes */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase text-rose-700/80">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    <span>Common Gaps</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {MISTAKE_TAGS.map((tag) => {
                      const isChecked = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => handleToggleTag(tag)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                            isChecked
                              ? 'bg-rose-50 text-rose-800 border border-rose-300 shadow-2xs font-bold'
                              : 'bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-transparent'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3 text-rose-600 flex-shrink-0" />}
                          <span>{tag}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Question Jump Card ───────────────────────────────────────── */}
            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <span className="font-bold text-slate-800">Questions in Paper</span>
                <span className="font-mono text-blue-600 font-bold">
                  {questions.filter((q) => q.isMarked).length} of {questions.length} evaluated
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${(questions.filter((q) => q.isMarked).length / questions.length) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-1.5 pt-0.5">
                {questions.map((q, idx) => {
                  const isCurrent = questionIndex === idx;
                  const isAiSuggested = q.evaluationState === 'AI_SUGGESTED' && !q.teacherVerified;
                  const isReviewed = q.teacherVerified || q.evaluationState === 'TEACHER_REVIEWED';

                  return (
                    <button
                      key={q.id}
                      aria-label={`Jump to Question ${idx + 1}`}
                      onClick={() => setQuestionIndex(idx)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all text-center relative ${
                        isCurrent
                          ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/30'
                          : isReviewed
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80 hover:bg-emerald-100'
                          : isAiSuggested
                          ? 'bg-purple-50 text-purple-700 border border-purple-300 hover:bg-purple-100'
                          : q.isMarked
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>Q{idx + 1}</span>
                      {isAiSuggested && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-500 ring-2 ring-white" title="AI Suggestion" />
                      )}
                      {q.flaggedForReview && (
                        <span className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" title="Flagged for review" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Status Legend */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium pt-1 border-t border-slate-200/50">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" /> Unanswered
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" /> AI Suggested
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Verified
                </span>
              </div>
            </div>

            {/* ── Copy Total Score Mini-Card ─────────────────────────────────── */}
            <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 border border-blue-100/90 rounded-2xl p-3.5 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Student Copy Total</span>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">{currentStudent.studentName}</p>
              </div>
              <div className="text-right">
                <div className="text-base font-black text-blue-700 font-mono">
                  {totalAwardedSoFar} <span className="text-xs text-blue-500 font-semibold">/ {maxPossibleMarks}</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400">
                  {maxPossibleMarks > 0 ? Math.round((totalAwardedSoFar / maxPossibleMarks) * 100) : 0}% marks
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Primary Action Bar */}
          <div className="p-4 border-t border-slate-200 bg-white/95 backdrop-blur-xs flex items-center gap-2.5 flex-shrink-0">
            <button
              onClick={handlePreviousQuestion}
              disabled={questionIndex === 0}
              className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 disabled:opacity-30 transition-all shadow-2xs flex items-center justify-center gap-1.5"
            >
              <span>&larr; Prev Question</span>
              <kbd className="hidden sm:inline px-1 py-0.5 text-[9px] font-mono text-slate-400 bg-slate-50 rounded border">&larr;</kbd>
            </button>

            <button
              onClick={handleSaveAndNext}
              className="flex-[2] py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 hover:shadow-blue-500/25 active:scale-[0.99]"
            >
              <span>Save &amp; Next</span>
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-blue-500/80 text-white rounded">Enter</kbd>
            </button>
          </div>
        </aside>

        {/* ── Rightmost Functional Rail (Secondary Drawers) ──────────────────── */}
        <div className="w-11 sm:w-12 bg-white border-l border-slate-200 flex flex-col items-center py-3 space-y-3 sm:space-y-4 flex-shrink-0 z-20">
          <button
            onClick={() => setActiveDrawer(activeDrawer === 'blueprint' ? 'none' : 'blueprint')}
            className={`p-2 rounded-xl transition-colors ${
              activeDrawer === 'blueprint' ? 'bg-blue-50 text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Question Blueprint & Model Solution"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'questions' ? 'none' : 'questions')}
            className={`p-2 rounded-xl transition-colors ${
              activeDrawer === 'questions' ? 'bg-blue-50 text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Question Grid & Paper Overview"
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'students' ? 'none' : 'students')}
            className={`p-2 rounded-xl transition-colors ${
              activeDrawer === 'students' ? 'bg-blue-50 text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="All Students Roster & Jump List"
          >
            <Users className="w-4 h-4" />
          </button>

          <button
            onClick={() => setActiveDrawer(activeDrawer === 'analytics' ? 'none' : 'analytics')}
            className={`p-2 rounded-xl transition-colors ${
              activeDrawer === 'analytics' ? 'bg-blue-50 text-blue-600 shadow-2xs' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            title="Batch Mistake Analytics"
          >
            <BarChart2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            title="Keyboard Shortcuts Cheat Sheet (?)"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        {/* ── Slide-Over Side Drawer for Rightmost Rail Icons ─────────────────── */}
        {activeDrawer !== 'none' && (
          <div className="absolute inset-y-0 right-11 sm:right-12 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl z-30 flex flex-col animate-in slide-in-from-right duration-150">
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                {activeDrawer === 'blueprint' && <FileText className="w-4 h-4 text-blue-600" />}
                {activeDrawer === 'questions' && <CheckSquare className="w-4 h-4 text-blue-600" />}
                {activeDrawer === 'students' && <Users className="w-4 h-4 text-blue-600" />}
                {activeDrawer === 'analytics' && <BarChart2 className="w-4 h-4 text-blue-600" />}

                <span className="font-extrabold text-slate-800 text-xs sm:text-sm">
                  {activeDrawer === 'blueprint' && 'Model Solution & Blueprint'}
                  {activeDrawer === 'questions' && 'Paper Question Overview'}
                  {activeDrawer === 'students' && 'All Students Roster (60)'}
                  {activeDrawer === 'analytics' && 'Batch Mistake Analytics'}
                </span>
              </div>

              <button
                onClick={() => setActiveDrawer('none')}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                title="Close drawer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              {/* Drawer 1: Blueprint & Solution */}
              {activeDrawer === 'blueprint' && (
                <div className="space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Question</span>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                        {currentQuestion.label} • {currentQuestion.maxMarks} marks
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium p-2.5 bg-slate-50 rounded-xl border border-slate-200 leading-relaxed text-xs">
                      {currentQuestion.text}
                    </p>

                    {/* High-Resolution Diagram Preview */}
                    {currentQuestion.diagramSvg && (
                      <div className="mt-2.5 p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
                        <div
                          className="w-full flex items-center justify-center max-h-48 overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: currentQuestion.diagramSvg }}
                        />
                        {currentQuestion.diagramCaption && (
                          <p className="text-[11px] text-center text-slate-500 font-medium mt-2 italic">
                            {currentQuestion.diagramCaption}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Model Answer Handling: Either Official Answer from DB OR Missing Answer Workflow */}
                  {currentQuestion.solution ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Official Model Answer</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Stored in Database
                        </span>
                      </div>
                      <p className="text-slate-700 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl leading-relaxed font-sans text-xs">
                        {currentQuestion.solution}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Alert: Answer Not Stored in DB */}
                      <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>No Answer Stored in Database</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          This question does not have a pre-stored model answer in the system. Use the step-wise evaluation guide below, or enter your personal reference key.
                        </p>
                      </div>

                      {/* Step-Wise Rubric Distribution */}
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {currentQuestion.rubricBreakdown ? 'Step-Wise Mark Distribution' : 'Recommended Step Rubric'}
                        </span>
                        <div className="mt-1.5 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/60 shadow-2xs">
                          {currentQuestion.rubricBreakdown ? (
                            currentQuestion.rubricBreakdown.map((r, i) => (
                              <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                                <span className="text-slate-700 font-medium pr-2">{r.step}</span>
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0">
                                  {r.marks}m
                                </span>
                              </div>
                            ))
                          ) : (
                            <>
                              <div className="p-2.5 flex items-center justify-between text-xs">
                                <span className="text-slate-700 font-medium">Concept, Formula &amp; Given Data</span>
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0">
                                  {(currentQuestion.maxMarks * 0.4).toFixed(1)}m
                                </span>
                              </div>
                              <div className="p-2.5 flex items-center justify-between text-xs">
                                <span className="text-slate-700 font-medium">Derivation / Calculation Steps / Diagram</span>
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0">
                                  {(currentQuestion.maxMarks * 0.4).toFixed(1)}m
                                </span>
                              </div>
                              <div className="p-2.5 flex items-center justify-between text-xs">
                                <span className="text-slate-700 font-medium">Final Answer, Statement &amp; SI Unit</span>
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex-shrink-0">
                                  {(currentQuestion.maxMarks * 0.2).toFixed(1)}m
                                </span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Evaluator Reference Key (Saved across copies) */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Teacher Reference Notes
                          </span>
                          <span className="text-[9.5px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Saved across copies
                          </span>
                        </div>
                        <textarea
                          value={evaluatorNotes[currentQuestion.id] || ''}
                          onChange={(e) => handleUpdateEvaluatorNotes(currentQuestion.id, e.target.value)}
                          placeholder="Type or paste your reference key or marking criteria for this question..."
                          className="w-full p-2.5 text-xs text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-sans leading-relaxed resize-none shadow-2xs"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 space-y-1.5 text-slate-500">
                    <div className="flex justify-between">
                      <span>Maximum Marks:</span>
                      <span className="font-bold text-slate-800">{currentQuestion.maxMarks} marks</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Question Type:</span>
                      <span className="font-semibold text-slate-800">{currentQuestion.type}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Drawer 2: Questions Grid */}
              {activeDrawer === 'questions' && (
                <div className="space-y-3">
                  <p className="text-slate-500 text-[11px]">Jump to any question in this student&apos;s answer copy:</p>
                  <div className="space-y-2">
                    {questions.map((q, idx) => (
                      <div
                        key={q.id}
                        onClick={() => {
                          setQuestionIndex(idx);
                          setActiveDrawer('none');
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          questionIndex === idx
                            ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{q.label}</span>
                            <span className="text-[10px] text-slate-400">{q.subLabel}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-[200px] mt-0.5">{q.text}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {q.isMarked ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              {q.awardedMarks} / {q.maxMarks}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Unmarked
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drawer 3: Students Roster */}
              {activeDrawer === 'students' && (
                <div className="space-y-3">
                  {/* Search Bar */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search student or roll number..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                    {filteredStudents.map((s, idx) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setStudentIndex(idx);
                          setActiveDrawer('none');
                          toast(`Loaded ${s.studentName}`, { icon: '👤' });
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          studentIndex === idx
                            ? 'border-blue-500 bg-blue-50/50 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {s.avatarInitials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-xs">{s.studentName}</p>
                            <p className="text-[10px] text-slate-400 font-mono">Roll No. {s.rollNumber}</p>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            s.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {s.status === 'COMPLETED' ? 'Checked' : 'In Progress'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Drawer 4: Analytics */}
              {activeDrawer === 'analytics' && (
                <div className="space-y-3">
                  <p className="font-bold text-slate-800">Frequently Identified Gaps (Class 10A)</p>
                  <p className="text-slate-500 text-[11px]">
                    Aggregate mistake frequency across 40 checked copies in this examination.
                  </p>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-semibold text-rose-700">Incomplete Explanation</span>
                      <span className="font-mono text-xs font-bold text-slate-700">18 students (45%)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-semibold text-amber-700">Unit Missing</span>
                      <span className="font-mono text-xs font-bold text-slate-700">12 students (30%)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-semibold text-blue-700">Calculation Error</span>
                      <span className="font-mono text-xs font-bold text-slate-700">7 students (17%)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="font-semibold text-emerald-700">Correct Concept</span>
                      <span className="font-mono text-xs font-bold text-slate-700">32 students (80%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Sticky Bottom Autosave & Keyboard Shortcuts Bar ──────────────── */}
      <footer className="h-10 bg-white border-t border-slate-200 px-4 sm:px-6 flex items-center justify-between text-xs flex-shrink-0 z-20">
        {/* Autosave Status */}
        <div data-testid="autosave-status" className="flex items-center gap-2 min-w-0">
          {saveStatus === 'saved' ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
              <span className="text-slate-600 text-[11px] font-medium truncate">
                All changes saved <span className="text-slate-400">({lastSavedTimestamp})</span>
              </span>
            </>
          ) : saveStatus === 'saving' ? (
            <>
              <RefreshCw className="w-3 h-3 text-amber-500 animate-spin flex-shrink-0" />
              <span className="text-amber-600 text-[11px] font-medium truncate">Saving evaluation...</span>
            </>
          ) : saveStatus === 'offline' ? (
            <>
              <AlertCircle className="w-3 h-3 text-amber-500 flex-shrink-0" />
              <span className="text-amber-700 text-[11px] font-medium truncate">Offline — Saved to local draft</span>
            </>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-3 h-3 text-rose-500 flex-shrink-0" />
              <span className="text-rose-600 text-[11px] font-medium truncate">Save failed — cached locally</span>
              <button
                type="button"
                onClick={() => triggerAutosave(awardedMarks, selectedTags)}
                className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Real-time Keyboard Shortcuts Reference Strip */}
        <div className="hidden lg:flex items-center gap-3 xl:gap-4 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">0-9</kbd>
            <span>Marks</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-blue-50 text-blue-700 rounded border border-blue-200 font-bold">W / S</kbd>
            <span className="font-semibold text-slate-700">Turn Page</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">. / +</kbd>
            <span>+0.5</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">Enter</kbd>
            <span>Save &amp; Next</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">&larr; / &rarr;</kbd>
            <span>Prev / Next Q</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">Shift + &rarr;</kbd>
            <span>Next Student</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">F</kbd>
            <span>Fit</span>
          </div>

          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 text-slate-700 rounded border border-slate-200">Esc</kbd>
            <span>Exit</span>
          </div>
        </div>

        {/* Shortcut Helper Button */}
        <div className="flex items-center">
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>All Shortcuts (?)</span>
          </button>
        </div>
      </footer>

      {/* ── 5. Instant Keyboard Feedback Visual HUD ─────────────────────────── */}
      {shortcutFeedback && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-14 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-2xl border border-slate-700/80 backdrop-blur-md animate-in fade-in zoom-in-95 pointer-events-none"
        >
          {shortcutFeedback}
        </div>
      )}

      {/* ── 6. Full Keyboard Shortcuts Cheat Sheet Modal ─────────────────────── */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-extrabold text-slate-900 text-sm">Keyboard Shortcuts Cheat Sheet</h3>
              </div>
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <p className="text-slate-600 leading-relaxed">
                Check answer copies with maximum speed. All shortcuts execute without needing to click or refocus buttons:
              </p>

              <div className="space-y-2 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Assign Marks (0 to Max)</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">0 - 9</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between bg-blue-50/50">
                  <span className="text-blue-900 font-bold">Turn Copy Page (Prev / Next)</span>
                  <kbd className="px-2 py-0.5 font-mono bg-blue-100 text-blue-800 border border-blue-200 rounded font-bold">W / S or PageUp / PageDn or Alt + &larr; / &rarr;</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Add / Subtract Half Mark</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">&uarr; / &darr; or + / -</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Flag / Bookmark for Review</span>
                  <kbd className="px-2 py-0.5 font-mono bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold">M</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Save &amp; Advance to Next Question</span>
                  <kbd className="px-2 py-0.5 font-mono bg-blue-50 text-blue-700 border border-blue-200 rounded font-bold">Enter</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Previous / Next Question</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">&larr; / &rarr; or A / D</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Previous / Next Student Copy</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">Shift + &larr; / &rarr; or [ / ]</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Auto-Fit Canvas Width</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">F</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Rotate Page 90°</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">R</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Toggle Pages Strip</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">P</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Toggle Hand Pan Tool</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">H</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between bg-blue-50/50">
                  <span className="text-blue-900 font-bold">Toggle Full Screen Mode</span>
                  <kbd className="px-2 py-0.5 font-mono bg-blue-100 text-blue-800 border border-blue-200 rounded font-bold">F11 / Fn + F11</kbd>
                </div>

                <div className="p-2.5 flex items-center justify-between">
                  <span className="text-slate-700 font-medium">Close Drawer / Exit Workspace</span>
                  <kbd className="px-2 py-0.5 font-mono bg-slate-100 border border-slate-200 rounded font-bold text-slate-800">Esc</kbd>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowShortcutsModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
