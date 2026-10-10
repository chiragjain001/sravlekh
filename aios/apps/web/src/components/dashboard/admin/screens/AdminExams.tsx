'use client';

// ─── AdminExams — Unified Examination Operations & Lifecycle Console ─────────
// Single Source of Truth for the entire examination lifecycle:
// Setup → Candidate Paper Submissions → Review / Selection → Approval → Scheduling → Publishing → Ongoing → Evaluation → Locked.

import React, { useState, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  ArrowRight,
  ArrowLeft,
  Unlock,
  ClipboardList,
  X,
  Loader2,
  Trash2,
  Zap,
  FileText,
  CheckCircle2,
  Printer,
  Eye,
  Clock,
  Calendar,
  Building2,
  Users,
  BookOpen,
  AlertCircle,
  Filter,
  Check,
  ChevronRight,
  Send,
  MessageSquare,
  Award,
  Sparkles,
  Lock,
  Globe,
} from 'lucide-react';
import { AppleDropdown, AppleDropdownOption } from '@/components/ui/AppleDropdown';
import { useAuth } from '@/contexts/auth.context';
import {
  useExams,
  useBatches,
  useSubjects,
  useCreateExam,
  useUpdateExamStatus,
  useUnlockExam,
  useDeleteExam,
  useCandidatePapers,
  useSelectOfficialPaper,
  useRejectCandidatePaper,
  useRequestPaperChanges,
  usePaper,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';
import { DatePicker } from '@/components/ui/DatePicker';
import { PrintableQuestionPaper } from '@/components/dashboard/teacher/shared/PrintableQuestionPaper';

type ExamStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ONGOING' | 'EVALUATING' | 'LOCKED';

const EXAM_TYPES = [
  'UNIT_TEST',
  'CHAPTER_TEST',
  'WEEKLY_TEST',
  'MONTHLY_TEST',
  'MOCK_TEST',
  'REVISION_TEST',
  'PRE_BOARD',
  'SUBJECT_TEST',
  'PRACTICE_TEST',
];

// Major high-stakes exams requiring administrative candidate paper review & approval
const MAJOR_EXAM_TYPES = new Set(['MOCK_TEST', 'PRE_BOARD', 'MONTHLY_TEST', 'SUBJECT_TEST']);

// Low-stakes types where admins can Quick Publish
const LOW_STAKES_TYPES = new Set(['UNIT_TEST', 'CHAPTER_TEST', 'WEEKLY_TEST', 'PRACTICE_TEST']);

const NEXT_STATUS: Record<ExamStatus, ExamStatus | null> = {
  DRAFT: 'REVIEW',
  REVIEW: 'APPROVED',
  APPROVED: 'PUBLISHED',
  PUBLISHED: 'ONGOING',
  ONGOING: 'EVALUATING',
  EVALUATING: 'LOCKED',
  LOCKED: null,
};

const STATUS_STYLE: Record<ExamStatus, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700 border-slate-200', dot: 'bg-slate-400', label: 'Draft' },
  REVIEW: { bg: 'bg-amber-50', text: 'text-amber-800 border-amber-200', dot: 'bg-amber-500', label: 'In Review' },
  APPROVED: { bg: 'bg-sky-50', text: 'text-sky-800 border-sky-200', dot: 'bg-sky-500', label: 'Approved' },
  PUBLISHED: { bg: 'bg-indigo-50', text: 'text-indigo-800 border-indigo-200', dot: 'bg-indigo-500', label: 'Published' },
  ONGOING: { bg: 'bg-violet-50', text: 'text-violet-800 border-violet-200', dot: 'bg-violet-500', label: 'Ongoing' },
  EVALUATING: { bg: 'bg-orange-50', text: 'text-orange-800 border-orange-200', dot: 'bg-orange-500', label: 'Evaluating' },
  LOCKED: { bg: 'bg-emerald-50', text: 'text-emerald-800 border-emerald-200', dot: 'bg-emerald-500', label: 'Locked' },
};

function getActionConfig(status: ExamStatus, next: ExamStatus | null): {
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
} {
  if (status === 'DRAFT' || status === 'REVIEW') {
    return {
      label: 'Approve Exam',
      shortLabel: 'Approve',
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100',
    };
  }
  if (status === 'APPROVED') {
    return {
      label: 'Publish Schedule',
      shortLabel: 'Publish',
      icon: <Send className="w-3.5 h-3.5" />,
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100',
    };
  }
  if (status === 'PUBLISHED') {
    return {
      label: 'Start Evaluation',
      shortLabel: 'Evaluate',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100',
    };
  }
  if (status === 'ONGOING') {
    return {
      label: 'Upload Copies / Grade',
      shortLabel: 'Grade',
      icon: <ClipboardList className="w-3.5 h-3.5" />,
      color: 'text-purple-700 bg-purple-50 hover:bg-purple-100',
    };
  }
  if (status === 'EVALUATING') {
    return {
      label: 'Finalize & Lock Results',
      shortLabel: 'Lock',
      icon: <Lock className="w-3.5 h-3.5" />,
      color: 'text-slate-700 bg-slate-100 hover:bg-slate-200',
    };
  }
  return {
    label: `Advance to ${next || 'Next'}`,
    shortLabel: next || 'Advance',
    icon: <ArrowRight className="w-3.5 h-3.5" />,
    color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100',
  };
}

interface CandidatePaper {
  id: string;
  title: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';
  format?: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  createdByUserId: string;
  creator?: { id: string; name: string; email: string };
  totalQuestions?: number;
  totalMarks?: number;
}

interface ExamRow {
  id: string;
  title: string;
  type: string;
  status: ExamStatus;
  version: number;
  scheduledDate?: string | null;
  durationMinutes?: number | null;
  venue?: string | null;
  batch?: { id: string; name: string; classYear?: string; section?: string };
  blueprint?: { id: string; name: string; totalMarks: number; subject?: { id: string; name: string } };
  papers?: CandidatePaper[];
}

export function AdminExams() {
  const { user } = useAuth();
  const canApprove = user?.role === 'ADMIN' || user?.role === 'FOUNDER';

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('ALL');

  // Modals & Drawers
  const [createOpen, setCreateOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<ExamRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExamRow | null>(null);
  const [reviewExamTarget, setReviewExamTarget] = useState<ExamRow | null>(null);
  const [previewPaperId, setPreviewPaperId] = useState<string | null>(null);
  const [printPaperTarget, setPrintPaperTarget] = useState<{ exam: ExamRow; paperId: string } | null>(null);

  // Queries & Mutations
  const { data: examsRaw, isPending, isError, refetch } = useExams();
  const { data: batches = [] } = useBatches();
  const updateStatus = useUpdateExamStatus();
  const deleteExam = useDeleteExam();

  const exams: ExamRow[] = useMemo(() => {
    if (Array.isArray(examsRaw)) return examsRaw;
    if (Array.isArray((examsRaw as any)?.data)) return (examsRaw as any).data;
    return [];
  }, [examsRaw]);

  // Status Metrics
  const metrics = useMemo(() => {
    const total = exams.length;
    const pendingReview = exams.filter(
      (e) => e.status === 'REVIEW' || (e.papers && e.papers.some((p) => p.status === 'SUBMITTED')),
    ).length;
    const approved = exams.filter((e) => e.status === 'APPROVED').length;
    const published = exams.filter((e) => e.status === 'PUBLISHED').length;
    const evaluating = exams.filter((e) => e.status === 'EVALUATING').length;
    const locked = exams.filter((e) => e.status === 'LOCKED').length;
    return { total, pendingReview, approved, published, evaluating, locked };
  }, [exams]);

  // Filtered List
  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      // Search
      const q = search.trim().toLowerCase();
      if (q) {
        const titleMatch = e.title.toLowerCase().includes(q);
        const subMatch = (e.blueprint?.subject?.name || '').toLowerCase().includes(q);
        const batchMatch = (e.batch?.name || '').toLowerCase().includes(q);
        if (!titleMatch && !subMatch && !batchMatch) return false;
      }
      // Batch
      if (selectedBatchId !== 'ALL' && e.batch?.id !== selectedBatchId) return false;

      // Status
      if (statusFilter === 'PENDING_REVIEW') {
        return e.status === 'REVIEW' || (e.papers && e.papers.some((p) => p.status === 'SUBMITTED'));
      }
      if (statusFilter === 'SCHEDULED') {
        return e.status === 'APPROVED' || e.status === 'PUBLISHED';
      }
      if (statusFilter !== 'ALL' && e.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [exams, search, statusFilter, selectedBatchId]);

  const batchOptions: AppleDropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Batches' },
    ...batches.map((b: any) => ({
      value: b.id,
      label: b.name,
      sublabel: b.classYear ? `${b.classYear}${b.section ? ` · Sec ${b.section}` : ''}` : undefined,
    })),
  ], [batches]);

  const statusOptions: AppleDropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'PENDING_REVIEW', label: 'Pending Review', badge: metrics.pendingReview > 0 ? String(metrics.pendingReview) : undefined },
    { value: 'APPROVED', label: 'Approved', badge: metrics.approved > 0 ? String(metrics.approved) : undefined },
    { value: 'PUBLISHED', label: 'Published', badge: metrics.published > 0 ? String(metrics.published) : undefined },
    { value: 'ONGOING', label: 'Ongoing' },
    { value: 'EVALUATING', label: 'Evaluating', badge: metrics.evaluating > 0 ? String(metrics.evaluating) : undefined },
    { value: 'LOCKED', label: 'Locked' },
    { value: 'DRAFT', label: 'Draft' },
  ], [metrics]);

  function handleAdvance(exam: ExamRow) {
    const next = NEXT_STATUS[exam.status];
    if (!next) return;
    updateStatus.mutate({ examId: exam.id, status: next, version: exam.version });
  }

  function handleQuickPublish(exam: ExamRow) {
    updateStatus.mutate({ examId: exam.id, status: 'PUBLISHED', version: exam.version });
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-4 sm:space-y-6 max-w-[1550px] mx-auto w-full animate-fadein">
      {/* ── Top Bar / Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-[19px] sm:text-[21px] font-bold text-slate-900 tracking-tight">Exams</h1>
              <p className="text-[12px] sm:text-[13px] text-slate-500">
                Single source of truth for the complete examination lifecycle.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[13px] font-bold rounded-xl shadow-sm shadow-indigo-600/20 transition-all cursor-pointer min-h-[42px]"
        >
          <Plus className="w-4 h-4" /> Schedule Exam
        </button>
      </div>

      {/* ── KPI Lifecycle Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL'
              ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Exams</span>
          <span className="text-[18px] sm:text-[20px] font-extrabold text-slate-900 mt-0.5 block">{metrics.total}</span>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING_REVIEW')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING_REVIEW'
              ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">Pending Review</span>
            {metrics.pendingReview > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
          </div>
          <span className="text-[18px] sm:text-[20px] font-extrabold text-amber-900 mt-0.5 block">{metrics.pendingReview}</span>
        </button>

        <button
          onClick={() => setStatusFilter('APPROVED')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'APPROVED'
              ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-sky-700 uppercase tracking-wider block">Approved</span>
          <span className="text-[18px] sm:text-[20px] font-extrabold text-sky-900 mt-0.5 block">{metrics.approved}</span>
        </button>

        <button
          onClick={() => setStatusFilter('PUBLISHED')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PUBLISHED'
              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider block">Published</span>
          <span className="text-[18px] sm:text-[20px] font-extrabold text-indigo-900 mt-0.5 block">{metrics.published}</span>
        </button>

        <button
          onClick={() => setStatusFilter('EVALUATING')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'EVALUATING'
              ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-orange-700 uppercase tracking-wider block">Evaluating</span>
          <span className="text-[18px] sm:text-[20px] font-extrabold text-orange-900 mt-0.5 block">{metrics.evaluating}</span>
        </button>

        <button
          onClick={() => setStatusFilter('LOCKED')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'LOCKED'
              ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200/80 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Locked</span>
          <span className="text-[18px] sm:text-[20px] font-extrabold text-emerald-900 mt-0.5 block">{metrics.locked}</span>
        </button>
      </div>

      {/* ── Search, Batch Filter, and Status Filter (Apple / iOS Modern Design) ── */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3 bg-white p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exams by title, subject, or batch..."
            className="w-full pl-10 pr-8 py-2.5 text-xs sm:text-[13px] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50/50 min-h-[42px]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Modern iOS / Apple Dropdowns: side-by-side grid on mobile, inline on desktop */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 min-w-0 w-full lg:w-auto">
          <div className="min-w-0 w-full sm:w-[190px]">
            <AppleDropdown
              value={selectedBatchId}
              onChange={(val) => setSelectedBatchId(val)}
              options={batchOptions}
              placeholder="All Batches"
              size="sm"
            />
          </div>
          <div className="min-w-0 w-full sm:w-[170px]">
            <AppleDropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={statusOptions}
              placeholder="All Statuses"
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* ── Loading / Error / Empty States ── */}
      {isPending && <SkeletonTable rows={6} cols={6} />}

      {isError && (
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-rose-500" />}
          title="Couldn't load exams"
          description="Something went wrong while connecting to the server. Check your connection and try again."
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      )}

      {!isPending && !isError && filteredExams.length === 0 && (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8 text-slate-400" />}
          title="No exams found"
          description={
            search || statusFilter !== 'ALL' || selectedBatchId !== 'ALL'
              ? 'No exams match your current filters. Try resetting your search or filter options.'
              : 'Schedule an official exam to open candidate paper submissions for teachers.'
          }
          action={{ label: 'Schedule Exam', onClick: () => setCreateOpen(true) }}
        />
      )}

      {/* ── Exams Content (Desktop Table & Mobile Stacked Cards) ── */}
      {!isPending && !isError && filteredExams.length > 0 && (
        <div>
          {/* Desktop Table (hidden on mobile/tablet) */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75">
                    <th className="px-5 py-3 font-bold text-slate-600 uppercase tracking-wide">Exam Details</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Batch & Subject</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Exam Type</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Schedule</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Candidate Papers</th>
                    <th className="px-4 py-3 font-bold text-slate-600 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 font-bold text-slate-600 uppercase tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExams.map((exam) => {
                    const next = NEXT_STATUS[exam.status];
                    const approvalBlocked = next === 'APPROVED' && !canApprove;
                    const papers = exam.papers || [];
                    const submittedCount = papers.filter((p) => p.status === 'SUBMITTED').length;
                    const officialPaper = papers.find((p) => p.status === 'APPROVED');
                    const isMajor = MAJOR_EXAM_TYPES.has(exam.type);

                    return (
                      <tr key={exam.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Exam Details */}
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-[13.5px] text-slate-900 leading-snug">{exam.title}</div>
                          {exam.venue && (
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              <span>{exam.venue}</span>
                            </div>
                          )}
                        </td>

                        {/* Batch & Subject */}
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-slate-800">{exam.batch?.name ?? '—'}</div>
                          <div className="text-[11px] text-indigo-600 font-medium">
                            {exam.blueprint?.subject?.name ?? 'General'}
                          </div>
                        </td>

                        {/* Exam Type */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[10.5px] ${
                              isMajor ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {exam.type.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Schedule */}
                        <td className="px-4 py-3.5">
                          <div className="text-slate-700 font-medium flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {exam.scheduledDate ? new Date(exam.scheduledDate).toLocaleDateString() : 'Unscheduled'}
                          </div>
                          {exam.durationMinutes && (
                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {exam.durationMinutes} mins
                            </div>
                          )}
                        </td>

                        {/* Candidate Papers */}
                        <td className="px-4 py-3.5">
                          {officialPaper ? (
                            <button
                              onClick={() => setReviewExamTarget(exam)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200/90 hover:bg-emerald-100/80 font-bold text-[11.5px] transition-all cursor-pointer shadow-2xs group"
                              title="Click to view candidate papers, preview questions, and manage official paper"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                              <span>Official Paper ({papers.length})</span>
                              <ChevronRight className="w-3 h-3 text-emerald-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : submittedCount > 0 ? (
                            <button
                              onClick={() => setReviewExamTarget(exam)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 font-bold text-[11.5px] transition-all cursor-pointer shadow-2xs group"
                              title="Click to review candidate papers and select official paper"
                            >
                              <FileText className="w-3.5 h-3.5 text-amber-600 group-hover:scale-110 transition-transform" />
                              <span>Review Papers ({submittedCount})</span>
                              <ChevronRight className="w-3 h-3 text-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                            </button>
                          ) : (
                            <button
                              onClick={() => setReviewExamTarget(exam)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 font-medium text-[11px] transition-colors cursor-pointer"
                              title="Open candidate papers drawer"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <span>0 Papers</span>
                            </button>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${STATUS_STYLE[exam.status].bg} ${STATUS_STYLE[exam.status].text}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[exam.status].dot}`} />
                            {STATUS_STYLE[exam.status].label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Quick Publish for low-stakes */}
                            {canApprove &&
                              LOW_STAKES_TYPES.has(exam.type) &&
                              (exam.status === 'DRAFT' || exam.status === 'REVIEW' || exam.status === 'APPROVED') && (
                                <button
                                  onClick={() => handleQuickPublish(exam)}
                                  disabled={updateStatus.isPending}
                                  title="Quick Publish (Admin shortcut)"
                                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                  <span>Publish</span>
                                </button>
                              )}

                            {/* Advance Status */}
                            {next && (() => {
                              const actionConfig = getActionConfig(exam.status, next);
                              return (
                                <button
                                  onClick={() => handleAdvance(exam)}
                                  disabled={approvalBlocked || updateStatus.isPending}
                                  title={approvalBlocked ? 'Only admins can approve an exam' : actionConfig.label}
                                  className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer disabled:opacity-40 ${actionConfig.color}`}
                                >
                                  {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : actionConfig.icon}
                                  <span>{actionConfig.shortLabel}</span>
                                </button>
                              );
                            })()}

                            {/* Unlock */}
                            {exam.status === 'LOCKED' && canApprove && (
                              <button
                                onClick={() => setUnlockTarget(exam)}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                              >
                                <Unlock className="w-3.5 h-3.5" /> Unlock
                              </button>
                            )}

                            {/* Delete (DRAFT only) */}
                            {['DRAFT', 'REVIEW'].includes(exam.status) && (
                              <button
                                onClick={() => setDeleteTarget(exam)}
                                title="Delete this draft exam"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile & Tablet Card Layout (hidden on lg screens) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:hidden gap-3.5">
            {filteredExams.map((exam) => {
              const next = NEXT_STATUS[exam.status];
              const approvalBlocked = next === 'APPROVED' && !canApprove;
              const papers = exam.papers || [];
              const submittedCount = papers.filter((p) => p.status === 'SUBMITTED').length;
              const officialPaper = papers.find((p) => p.status === 'APPROVED');
              const isMajor = MAJOR_EXAM_TYPES.has(exam.type);
              const actionConfig = getActionConfig(exam.status, next);

              return (
                <div
                  key={exam.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wider mb-1 ${
                            isMajor ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {exam.type.replace(/_/g, ' ')}
                        </span>
                        <h3 className="font-bold text-[15px] text-slate-900 leading-snug">{exam.title}</h3>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex-shrink-0 ${STATUS_STYLE[exam.status].bg} ${STATUS_STYLE[exam.status].text}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLE[exam.status].dot}`} />
                        {STATUS_STYLE[exam.status].label}
                      </span>
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Batch</span>
                        <span className="font-medium text-slate-800">{exam.batch?.name ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Subject</span>
                        <span className="font-medium text-indigo-600">{exam.blueprint?.subject?.name ?? 'General'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Scheduled</span>
                        <span>{exam.scheduledDate ? new Date(exam.scheduledDate).toLocaleDateString() : 'Unscheduled'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Venue</span>
                        <span className="truncate block">{exam.venue || 'Institute Hall'}</span>
                      </div>
                    </div>

                    {/* ── Candidate Papers (Mobile / Tablet) ── */}
                    <div className="pt-2 border-t border-slate-100">
                      {officialPaper ? (
                        <button
                          type="button"
                          onClick={() => setReviewExamTarget(exam)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-200 text-emerald-950 transition-all cursor-pointer text-left shadow-2xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[13px] text-emerald-950 truncate block">
                                {officialPaper.title || 'Official Paper Selected'}
                              </span>
                              <p className="text-[11px] text-emerald-700 font-medium truncate mt-0.5">
                                {officialPaper.creator?.name || 'Teacher'} · {officialPaper.totalQuestions ?? 0} Questions · {officialPaper.totalMarks ?? 0} Marks
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 shrink-0 ml-2 bg-emerald-200/60 px-2.5 py-1.5 rounded-lg group-hover:bg-emerald-200 transition-colors">
                            <span>Manage & PDF</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      ) : submittedCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => setReviewExamTarget(exam)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 transition-all cursor-pointer text-left shadow-2xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-[13px] text-amber-950 block truncate">
                                {submittedCount} Candidate Paper{submittedCount !== 1 ? 's' : ''} Submitted
                              </span>
                              <p className="text-[11px] text-amber-700 font-medium truncate mt-0.5">
                                Review submissions & select official paper
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800 shrink-0 ml-2 bg-amber-200/60 px-2.5 py-1.5 rounded-lg group-hover:bg-amber-200 transition-colors">
                            <span>Review ({submittedCount})</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </button>
                      ) : (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11.5px] font-medium">
                          <span className="flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-slate-400" />
                            No candidate papers submitted yet
                          </span>
                          <button
                            type="button"
                            onClick={() => setReviewExamTarget(exam)}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            View (0)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    {next && (
                      <button
                        onClick={() => handleAdvance(exam)}
                        disabled={approvalBlocked || updateStatus.isPending}
                        className={`flex-1 py-2 text-[12px] font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-40 min-h-[42px] ${actionConfig.color}`}
                      >
                        {updateStatus.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : actionConfig.icon}
                        <span>{actionConfig.label}</span>
                      </button>
                    )}

                    {exam.status === 'LOCKED' && canApprove && (
                      <button
                        onClick={() => setUnlockTarget(exam)}
                        className="flex-1 py-2 text-[12px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[42px]"
                      >
                        <Unlock className="w-3.5 h-3.5" /> Unlock
                      </button>
                    )}

                    {['DRAFT', 'REVIEW'].includes(exam.status) && (
                      <button
                        onClick={() => setDeleteTarget(exam)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center"
                        title="Delete exam"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Dialogs & Drawers ── */}
      <CreateExamModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
      <UnlockExamModal exam={unlockTarget} onClose={() => setUnlockTarget(null)} />

      {/* Candidate Papers Review Drawer / Modal */}
      {reviewExamTarget && (
        <CandidatePapersDrawer
          exam={reviewExamTarget}
          onClose={() => setReviewExamTarget(null)}
          onPreviewPaper={(paperId) => setPreviewPaperId(paperId)}
          onPrintPaper={(paperId) => setPrintPaperTarget({ exam: reviewExamTarget, paperId })}
        />
      )}

      {/* Question Paper Preview Modal */}
      {previewPaperId && (
        <PaperPreviewModal
          exam={reviewExamTarget}
          paperId={previewPaperId}
          onClose={() => setPreviewPaperId(null)}
        />
      )}

      {/* Printable Hidden Paper Component for Print / Export */}
      {printPaperTarget && (
        <PrintPaperTrigger
          exam={printPaperTarget.exam}
          paperId={printPaperTarget.paperId}
          onDone={() => setPrintPaperTarget(null)}
        />
      )}

      {/* Delete Exam Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <Trash2 className="w-5 h-5" />
              </div>
              <h2 className="text-[16px] font-bold text-slate-800">Delete this exam?</h2>
            </div>
            <p className="text-[13px] text-slate-600">
              <b>{deleteTarget.title}</b> is currently in <b>{deleteTarget.status}</b> stage. Deleting it will detach candidate papers, and no students have been graded against it yet.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={async () => {
                  await deleteExam.mutateAsync(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                disabled={deleteExam.isPending}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[13px] font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteExam.isPending ? 'Deleting…' : 'Delete Exam'}
              </button>
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Candidate Papers Review Drawer / Modal ──────────────────────────────────

function CandidatePapersDrawer({
  exam,
  onClose,
  onPreviewPaper,
  onPrintPaper,
}: {
  exam: ExamRow;
  onClose: () => void;
  onPreviewPaper: (paperId: string) => void;
  onPrintPaper: (paperId: string) => void;
}) {
  const { data: papers = [], isPending, refetch } = useCandidatePapers(exam.id);
  const selectOfficialPaper = useSelectOfficialPaper();
  const rejectPaper = useRejectCandidatePaper();
  const requestChanges = useRequestPaperChanges();

  // Sub-dialogs
  const [confirmSelectPaper, setConfirmSelectPaper] = useState<CandidatePaper | null>(null);
  const [selectComment, setSelectComment] = useState('');
  const [rejectPaperTarget, setRejectPaperTarget] = useState<CandidatePaper | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [changesTarget, setChangesTarget] = useState<CandidatePaper | null>(null);
  const [changesFeedback, setChangesFeedback] = useState('');

  const handleSelectOfficial = async () => {
    if (!confirmSelectPaper) return;
    await selectOfficialPaper.mutateAsync({
      examId: exam.id,
      paperId: confirmSelectPaper.id,
      comment: selectComment.trim() || undefined,
    });
    setConfirmSelectPaper(null);
    setSelectComment('');
    refetch();
  };

  const handleReject = async () => {
    if (!rejectPaperTarget) return;
    await rejectPaper.mutateAsync({
      examId: exam.id,
      paperId: rejectPaperTarget.id,
      reason: rejectReason.trim() || undefined,
    });
    setRejectPaperTarget(null);
    setRejectReason('');
    refetch();
  };

  const handleRequestChanges = async () => {
    if (!changesTarget || !changesFeedback.trim()) return;
    await requestChanges.mutateAsync({
      examId: exam.id,
      paperId: changesTarget.id,
      feedback: changesFeedback.trim(),
    });
    setChangesTarget(null);
    setChangesFeedback('');
    refetch();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[10px] font-extrabold uppercase tracking-wide">
                Candidate Paper Management
              </span>
              <span className="text-slate-400 text-xs">·</span>
              <span className="text-slate-500 text-xs font-semibold">{exam.batch?.name}</span>
            </div>
            <h2 className="text-[17px] sm:text-[19px] font-bold text-slate-900 mt-0.5">{exam.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 text-xs text-indigo-900 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[13px] text-indigo-950">Multiple Teachers → One Official Paper</p>
              <p className="text-slate-600 mt-0.5 leading-relaxed">
                Teachers submit candidate papers created from their Paper Builder. Review each submission, preview questions and rubrics, download printable PDFs, and select <b>one candidate paper</b> as the official examination paper.
              </p>
            </div>
          </div>

          {isPending ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <p className="text-xs">Fetching candidate submissions...</p>
            </div>
          ) : papers.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-[15px] text-slate-800">No Candidate Papers Submitted Yet</h3>
              <p className="text-xs text-slate-500 max-w-md">
                This exam is now open for submissions. Teachers assigned to <b>{exam.batch?.name || 'this batch'}</b> can generate and submit their candidate papers through the Teacher Paper Builder.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {papers.map((paper: CandidatePaper) => {
                const isOfficial = paper.status === 'APPROVED';
                const isPendingReview = paper.status === 'SUBMITTED';
                const isRejected = paper.status === 'ARCHIVED';

                return (
                  <div
                    key={paper.id}
                    className={`rounded-2xl border p-4 sm:p-5 transition-all ${
                      isOfficial
                        ? 'border-emerald-300 bg-emerald-50/30 ring-2 ring-emerald-500/10'
                        : isPendingReview
                        ? 'border-amber-200 bg-white hover:border-amber-300 shadow-2xs'
                        : isRejected
                        ? 'border-slate-200 bg-slate-50/70 opacity-80'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-[15px] text-slate-900">{paper.title}</h4>
                          {isOfficial && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Official Paper
                            </span>
                          )}
                          {isPendingReview && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold">
                              Pending Review
                            </span>
                          )}
                          {isRejected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10.5px] font-semibold">
                              Not Selected
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 sm:gap-4 text-xs text-slate-500 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1 text-slate-700 font-medium">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {paper.creator?.name || 'Teacher'}
                          </span>
                          <span>·</span>
                          <span>{paper.totalQuestions ?? 0} Questions</span>
                          <span>·</span>
                          <span className="font-semibold text-slate-800">{paper.totalMarks ?? 0} Marks</span>
                          {paper.submittedAt && (
                            <>
                              <span>·</span>
                              <span>Submitted {new Date(paper.submittedAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions for this candidate paper */}
                      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap pt-2 sm:pt-0 border-t sm:border-0 border-slate-100">
                        <button
                          onClick={() => onPreviewPaper(paper.id)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>

                        <button
                          onClick={() => onPrintPaper(paper.id)}
                          className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Print / Download PDF"
                        >
                          <Printer className="w-3.5 h-3.5" /> PDF
                        </button>

                        {!isOfficial && (
                          <button
                            onClick={() => setConfirmSelectPaper(paper)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Check className="w-3.5 h-3.5" /> Select This Paper
                          </button>
                        )}

                        {!isOfficial && isPendingReview && (
                          <button
                            onClick={() => setRejectPaperTarget(paper)}
                            className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                            title="Reject candidate paper"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Select Official Paper Confirmation Dialog */}
      {confirmSelectPaper && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">Confirm Official Paper Selection</h3>
                <p className="text-xs text-slate-500">Teacher: {confirmSelectPaper.creator?.name || 'Teacher'}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to select <b>"{confirmSelectPaper.title}"</b> as the official examination paper?
            </p>
            <ul className="text-[11.5px] text-slate-500 list-disc list-inside space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <li>This paper will be marked <b>Official / Approved</b>.</li>
              <li>Other submitted papers will be marked unselected.</li>
              <li>The approved teacher will receive an approval notification.</li>
              <li>Non-selected teachers will receive a status notification.</li>
            </ul>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Optional Review Feedback / Note
              </label>
              <textarea
                value={selectComment}
                onChange={(e) => setSelectComment(e.target.value)}
                placeholder="e.g. Well-balanced difficulty and syllabus coverage..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 h-20"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={handleSelectOfficial}
                disabled={selectOfficialPaper.isPending}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {selectOfficialPaper.isPending ? 'Confirming…' : 'Confirm & Select Official Paper'}
              </button>
              <button
                onClick={() => setConfirmSelectPaper(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Candidate Paper Dialog */}
      {rejectPaperTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <X className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">Reject Candidate Paper</h3>
                <p className="text-xs text-slate-500">Teacher: {rejectPaperTarget.creator?.name || 'Teacher'}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Rejecting "{rejectPaperTarget.title}". The teacher will receive a private notification with your feedback.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                Rejection Reason (Sent to teacher)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Too many questions outside the term syllabus..."
                className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400 h-20"
              />
            </div>

            <div className="flex gap-2.5 pt-1">
              <button
                onClick={handleReject}
                disabled={rejectPaper.isPending}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                {rejectPaper.isPending ? 'Rejecting…' : 'Reject Paper'}
              </button>
              <button
                onClick={() => setRejectPaperTarget(null)}
                className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Paper Preview Modal ──────────────────────────────────────────────────────

function PaperPreviewModal({
  exam,
  paperId,
  onClose,
}: {
  exam?: ExamRow | null;
  paperId: string;
  onClose: () => void;
}) {
  const { data: paper, isPending } = usePaper(paperId);
  const batchLabel = exam?.batch?.name || paper?.batch?.name || (paper?.exam as any)?.batch?.name || 'Class';
  const effectiveExam = exam || paper?.exam || undefined;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/75 backdrop-blur-md animate-fadein">
      <div className="bg-slate-50 rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[94vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Back to Candidate Papers"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="h-5 w-px bg-slate-200 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-[15px] sm:text-[16px] text-slate-900 truncate">
                  {paper?.title || effectiveExam?.title || 'Examination Question Paper'}
                </h3>
                {paper?.status === 'APPROVED' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> Official Paper
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-slate-500 truncate">
                {paper?.blueprint?.subject?.name || effectiveExam?.subject?.name || 'Subject'} · {batchLabel} · {paper?.items?.length || 0} Questions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => window.print()}
              disabled={isPending || !paper}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Print or Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print / PDF</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Canvas (Identical to School Exam Paper in Teacher Dashboard) */}
        <div className="p-3 sm:p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar bg-slate-100/90 flex justify-center">
          {isPending ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 m-auto">
              <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
              <p className="text-xs font-semibold">Loading official question paper & instructions…</p>
            </div>
          ) : !paper?.items || paper.items.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md m-auto">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="font-bold text-slate-800 text-sm">No Questions Found</h4>
              <p className="text-xs text-slate-500 mt-1">This candidate paper contains no question items yet.</p>
            </div>
          ) : (
            <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden self-start">
              <PrintableQuestionPaper
                exam={effectiveExam}
                paper={paper}
                batchLabel={batchLabel}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Hidden Printable Paper Trigger ──────────────────────────────────────────

function PrintPaperTrigger({ exam, paperId, onDone }: { exam: ExamRow; paperId: string; onDone: () => void }) {
  const { data: paper, isPending } = usePaper(paperId);

  React.useEffect(() => {
    if (!isPending && paper) {
      setTimeout(() => {
        window.print();
        onDone();
      }, 300);
    }
  }, [isPending, paper, onDone]);

  if (isPending || !paper) {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm text-white">
        <div className="flex items-center gap-2 bg-slate-900 p-4 rounded-2xl shadow-xl">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-xs font-bold">Preparing high-resolution PDF print...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden print:block fixed inset-0 z-[9999] bg-white">
      <PrintableQuestionPaper exam={exam} paper={paper} batchLabel={exam.batch?.name || 'Class'} />
    </div>
  );
}

// ─── Create / Schedule Exam Modal (Admin creates official exam) ─────────────

function CreateExamModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: batches = [] } = useBatches();
  const { data: subjectsRaw = [] } = useSubjects();
  const subjects: any[] = useMemo(() => {
    if (Array.isArray(subjectsRaw)) return subjectsRaw;
    if (Array.isArray((subjectsRaw as any)?.data)) return (subjectsRaw as any).data;
    return [];
  }, [subjectsRaw]);

  const examTypeOptions: AppleDropdownOption[] = useMemo(
    () =>
      EXAM_TYPES.map((t) => ({
        value: t,
        label: t.replace(/_/g, ' '),
        badge: MAJOR_EXAM_TYPES.has(t) ? 'Major' : undefined,
      })),
    [],
  );

  const subjectOptions: AppleDropdownOption[] = useMemo(
    () =>
      subjects.map((s: any) => ({
        value: s.id,
        label: s.name,
        sublabel: s.code || undefined,
      })),
    [subjects],
  );

  const batchSelectOptions: AppleDropdownOption[] = useMemo(
    () =>
      batches.map((b: any) => ({
        value: b.id,
        label: b.name,
        sublabel: b.classYear ? `${b.classYear}${b.section ? ` · Sec ${b.section}` : ''}` : undefined,
      })),
    [batches],
  );

  const createExam = useCreateExam();

  const [title, setTitle] = useState('');
  const [type, setType] = useState<string>(EXAM_TYPES[0] || 'UNIT_TEST');
  const [subjectId, setSubjectId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('10:00');
  const [durationMinutes, setDurationMinutes] = useState(180);
  const [totalMarks, setTotalMarks] = useState(100);
  const [venue, setVenue] = useState('Exam Hall 1');
  const [deliveryMode, setDeliveryMode] = useState<'OFFLINE_PRINT' | 'DIGITAL_ONLINE'>('OFFLINE_PRINT');
  const [instructions, setInstructions] = useState('');

  if (!isOpen) return null;

  function reset() {
    setTitle('');
    setType(EXAM_TYPES[0] || 'UNIT_TEST');
    setSubjectId('');
    setBatchId('');
    setScheduledDate('');
    setStartTime('10:00');
    setDurationMinutes(180);
    setTotalMarks(100);
    setVenue('Exam Hall 1');
    setDeliveryMode('OFFLINE_PRINT');
    setInstructions('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !batchId || !subjectId) return;

    let fullDateIso: string | undefined = undefined;
    if (scheduledDate) {
      const timePart = startTime ? `${startTime}:00` : '10:00:00';
      fullDateIso = new Date(`${scheduledDate}T${timePart}`).toISOString();
    }

    createExam.mutate(
      {
        title: title.trim(),
        type,
        subjectId,
        batchId,
        totalMarks: Number(totalMarks) || 100,
        durationMinutes: Number(durationMinutes) || 180,
        scheduledDate: fullDateIso,
        venue: venue.trim() || undefined,
        deliveryMode,
        instructions: instructions.trim() || undefined,
        status: 'DRAFT',
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadein" role="dialog" aria-modal="true">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] border border-slate-200">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0 bg-slate-50/70">
          <div>
            <h3 className="text-[16px] font-bold text-slate-900">Schedule Official Exam</h3>
            <p className="text-xs text-slate-500">Create an institutional exam and open candidate paper submissions</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1 text-xs">
          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Exam Title <span className="text-rose-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Physics Half Yearly Examination 2026"
              required
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>

          {/* Exam Type & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Exam Type <span className="text-rose-500">*</span>
              </label>
              <AppleDropdown
                value={type}
                onChange={(val) => setType(val)}
                options={examTypeOptions}
                placeholder="Select exam type"
                size="sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Subject <span className="text-rose-500">*</span>
              </label>
              <AppleDropdown
                value={subjectId}
                onChange={(val) => setSubjectId(val)}
                options={subjectOptions}
                placeholder="Select subject"
                size="sm"
                searchable
              />
            </div>
          </div>

          {/* Target Batch */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Class / Batch <span className="text-rose-500">*</span>
            </label>
            <AppleDropdown
              value={batchId}
              onChange={(val) => setBatchId(val)}
              options={batchSelectOptions}
              placeholder="Select a class / batch"
              size="sm"
              searchable
            />
          </div>

          {/* Schedule Date & Start Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Scheduled Date
              </label>
              <DatePicker
                value={scheduledDate}
                onChange={(d) => setScheduledDate(d)}
                placeholder="Pick date"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white min-h-[42px]"
              />
            </div>
          </div>

          {/* Duration & Total Marks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Duration (Minutes)
              </label>
              <input
                type="number"
                min="1"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Total Marks
              </label>
              <input
                type="number"
                min="1"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white min-h-[42px]"
              />
            </div>
          </div>

          {/* Venue & Delivery Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Venue
              </label>
              <input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Hall 1 / Room 102"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white min-h-[42px]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
                Delivery Mode
              </label>
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl min-h-[42px] border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setDeliveryMode('OFFLINE_PRINT')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    deliveryMode === 'OFFLINE_PRINT'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="truncate">Offline Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryMode('DIGITAL_ONLINE')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    deliveryMode === 'DIGITAL_ONLINE'
                      ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="truncate">Digital Online</span>
                </button>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">
              Special Instructions
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Calculators not allowed. Section A is compulsory..."
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 h-16 bg-white"
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={createExam.isPending || !title.trim() || !batchId || !subjectId}
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {createExam.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Schedule Exam</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Unlock Exam Modal (Secure Admin Unlock with Reason) ─────────────────────

function UnlockExamModal({ exam, onClose }: { exam: ExamRow | null; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const unlock = useUnlockExam();

  if (!exam) return null;

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) return;
    unlock.mutate(
      { examId: exam!.id, reason: reason.trim(), version: exam!.version },
      {
        onSuccess: () => {
          setReason('');
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadein">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 border border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <Unlock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Unlock Exam</h3>
            <p className="text-xs text-slate-500">Reopen evaluated exam for correction</p>
          </div>
        </div>

        <p className="text-xs text-slate-600">
          Unlocking <b>{exam.title}</b> allows teachers to re-grade answer sheets. Every unlock is audited and requires an institutional justification.
        </p>

        <form onSubmit={handleUnlock} className="space-y-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
              Reason for unlocking (min 10 characters) <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Student re-checking request approved by Principal..."
              required
              rows={3}
              className="w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            {reason.trim().length > 0 && reason.trim().length < 10 && (
              <p className="text-[11px] text-rose-500 mt-1">{10 - reason.trim().length} more characters required</p>
            )}
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="submit"
              disabled={reason.trim().length < 10 || unlock.isPending}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
            >
              {unlock.isPending ? 'Unlocking…' : 'Unlock for Re-evaluation'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
