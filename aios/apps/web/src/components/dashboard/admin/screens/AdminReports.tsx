'use client';
// ─── AdminReports — Official Reports Studio ─────────────────────────────────
// Asynchronous report generation engine powered by BullMQ & StorageService:
// - Dynamic context-aware scope validation (prevents empty/unscoped job submission)
// - Student, Batch, and Faculty report generation workflows
// - Real-time job lifecycle tracking (QUEUED -> PROCESSING -> COMPLETE / FAILED)
// - Format-honest outputs: Print-ready HTML document or CSV spreadsheet
// - Secure signed download URLs re-minted dynamically per read

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, FileText, Loader2, ExternalLink,
  Search, CheckCircle2, Clock, AlertCircle, RotateCcw,
  Users, BookOpen, Layers, Sparkles, Filter, X,
  Download, Printer
} from 'lucide-react';
import {
  useReportsList,
  useRequestReport,
  useRetryReport,
  useBatches,
  useStudents,
  useTeachers,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';
import { DatePicker } from '@/components/ui/DatePicker';
import { AppleDropdown, AppleDropdownOption } from '@/components/ui/AppleDropdown';

// ── Types & Constants ───────────────────────────────────────────────────────

export const REPORT_CONFIGS = {
  REPORT_CARD: {
    label: 'Student Report Card',
    category: 'student' as const,
    description: 'Comprehensive academic transcript with marks, percentages, and topic mastery.',
  },
  PROGRESS_CARD: {
    label: 'Student Progress Card',
    category: 'student' as const,
    description: 'Diagnostic performance card with mastery trends, gap remediations, and assignments.',
  },
  CLASS_REPORT: {
    label: 'Class Summary Report',
    category: 'batch' as const,
    description: 'Cohort performance summary, class averages, and intervention outcomes.',
  },
  BATCH_REPORT: {
    label: 'Comprehensive Batch Report',
    category: 'batch' as const,
    description: 'Full student roster breakdown with exam counts and assignment completion rates.',
  },
  CHAPTER_REPORT: {
    label: 'Chapter & Topic Mastery Report',
    category: 'batch' as const,
    description: 'Curriculum-level mastery metrics and struggling learner distributions.',
  },
  IMPROVEMENT_SHEET: {
    label: 'Remediation & Improvement Sheet',
    category: 'batch' as const,
    description: 'Tracks students below mastery thresholds and targeted learning gap resolutions.',
  },
  TEACHER_REPORT: {
    label: 'Faculty Evaluation Report',
    category: 'teacher' as const,
    description: 'Teacher course assignments, evaluated exam cohorts, and curriculum coverage.',
  },
} as const;

export type ReportTypeKey = keyof typeof REPORT_CONFIGS;

const DEFAULT_STATUS_INFO = { label: 'Queued', badge: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock };

const STATUS_CONFIG: Record<
  string,
  { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  QUEUED:     { label: 'Queued',     badge: 'bg-slate-100 text-slate-700 border-slate-200', icon: Clock },
  PROCESSING: { label: 'Processing', badge: 'bg-amber-50 text-amber-700 border-amber-200', icon: Loader2 },
  COMPLETE:   { label: 'Completed',  badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  FAILED:     { label: 'Failed',     badge: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertCircle },
};

interface ReportRow {
  id: string;
  type: string;
  format: string;
  status: string;
  scope: Record<string, any>;
  fileUrl?: string | null;
  createdAt: string;
}

// ── Context-Aware Create Report Dialog ──────────────────────────────────────

function CreateReportDialog({
  isOpen,
  initialBatchId,
  onClose,
}: {
  isOpen: boolean;
  initialBatchId?: string;
  onClose: () => void;
}) {
  const { data: batchesData } = useBatches();
  const batches: { id: string; name: string }[] = useMemo(() => {
    return batchesData?.data ?? batchesData ?? [];
  }, [batchesData]);

  const [type, setType] = useState<ReportTypeKey>('REPORT_CARD');
  const [selectedBatchId, setSelectedBatchId] = useState<string>(initialBatchId ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [format, setFormat] = useState<string>('EXCEL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const requestReport = useRequestReport();

  // Load students for student reports (filtered by selectedBatchId if chosen)
  const currentCategory = REPORT_CONFIGS[type]?.category ?? 'batch';
  const { data: studentsData, isPending: studentsPending } = useStudents(
    selectedBatchId ? { batchId: selectedBatchId } : undefined
  );
  const studentsList: any[] = useMemo(() => {
    return studentsData?.data ?? studentsData ?? [];
  }, [studentsData]);

  // Load teachers for teacher reports
  const { data: teachersData, isPending: teachersPending } = useTeachers();
  const teachersList: any[] = useMemo(() => {
    return teachersData?.data ?? teachersData ?? [];
  }, [teachersData]);

  // Set default initial batch when dialog opens
  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatchId(initialBatchId);
    } else if (batches.length > 0 && batches[0] && !selectedBatchId) {
      setSelectedBatchId(batches[0].id);
    }
  }, [initialBatchId, batches]);

  if (!isOpen) return null;

  // Validation rules
  const isStudentScopeValid = currentCategory !== 'student' || !!selectedStudentId;
  const isBatchScopeValid   = currentCategory !== 'batch'   || !!selectedBatchId;
  const isTeacherScopeValid = currentCategory !== 'teacher' || !!selectedTeacherId;
  const isFormValid = isStudentScopeValid && isBatchScopeValid && isTeacherScopeValid;

  function resetForm() {
    setType('REPORT_CARD');
    setSelectedStudentId('');
    setSelectedTeacherId('');
    setDateFrom('');
    setDateTo('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid) return;

    const scopePayload: Record<string, string> = {};
    if (currentCategory === 'student') {
      scopePayload.studentId = selectedStudentId;
    } else if (currentCategory === 'batch') {
      scopePayload.batchId = selectedBatchId;
    } else if (currentCategory === 'teacher') {
      scopePayload.teacherId = selectedTeacherId;
    }

    if (dateFrom) scopePayload.dateFrom = new Date(dateFrom).toISOString();
    if (dateTo) scopePayload.dateTo = new Date(dateTo).toISOString();

    requestReport.mutate(
      {
        type,
        format,
        scope: scopePayload,
      },
      {
        onSuccess: () => {
          resetForm();
          onClose();
        },
      }
    );
  }

  // Find entity labels for summary preview
  const selectedStudentObj = studentsList.find((s) => s.id === selectedStudentId);
  const selectedStudentName = selectedStudentObj?.user?.name ?? selectedStudentObj?.name;
  const selectedBatchName = batches.find((b) => b.id === selectedBatchId)?.name;
  const selectedTeacherObj = teachersList.find((t) => t.id === selectedTeacherId);
  const selectedTeacherName = selectedTeacherObj?.user?.name ?? selectedTeacherObj?.name;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fadein" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-[16px] font-extrabold text-slate-900">Generate Academic Report</h3>
            <p className="text-xs text-slate-500 mt-0.5">Asynchronous generation with verified data scoping</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto flex-1">
          {/* Report Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Report Type &amp; Purpose
            </label>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as ReportTypeKey);
                setSelectedStudentId('');
                setSelectedTeacherId('');
              }}
              className="w-full px-3.5 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <optgroup label="Student Transcripts &amp; Cards">
                <option value="REPORT_CARD">{REPORT_CONFIGS.REPORT_CARD.label}</option>
                <option value="PROGRESS_CARD">{REPORT_CONFIGS.PROGRESS_CARD.label}</option>
              </optgroup>
              <optgroup label="Class &amp; Batch Reports">
                <option value="CLASS_REPORT">{REPORT_CONFIGS.CLASS_REPORT.label}</option>
                <option value="BATCH_REPORT">{REPORT_CONFIGS.BATCH_REPORT.label}</option>
                <option value="CHAPTER_REPORT">{REPORT_CONFIGS.CHAPTER_REPORT.label}</option>
                <option value="IMPROVEMENT_SHEET">{REPORT_CONFIGS.IMPROVEMENT_SHEET.label}</option>
              </optgroup>
              <optgroup label="Faculty Reports">
                <option value="TEACHER_REPORT">{REPORT_CONFIGS.TEACHER_REPORT.label}</option>
              </optgroup>
            </select>
            <p className="text-[11.5px] text-slate-400 mt-1">
              {REPORT_CONFIGS[type]?.description}
            </p>
          </div>

          {/* Contextual Scope Inputs */}
          {currentCategory === 'student' && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Users className="w-4 h-4 text-indigo-600" /> Student Target Scope <span className="text-rose-500">*</span>
              </div>

              {/* Optional Batch Filter to Narrow Students */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Filter by Class/Batch (Optional)</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => {
                    setSelectedBatchId(e.target.value);
                    setSelectedStudentId('');
                  }}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">All Batches</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              {/* Student Selector */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Student <span className="text-rose-500">*</span></label>
                {studentsPending ? (
                  <div className="h-9 bg-slate-200/60 rounded-lg animate-pulse" />
                ) : (
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800"
                    required
                  >
                    <option value="">Choose student...</option>
                    {studentsList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.user?.name ?? s.name} {s.rollNumber ? `(Roll: ${s.rollNumber})` : ''} {s.batch?.name ? `— ${s.batch.name}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                {!selectedStudentId && (
                  <p className="text-[11px] text-amber-600 mt-1">Student selection is required for this report.</p>
                )}
              </div>
            </div>
          )}

          {currentCategory === 'batch' && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Layers className="w-4 h-4 text-indigo-600" /> Target Batch Scope <span className="text-rose-500">*</span>
              </div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Batch</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800"
                required
              >
                <option value="">Choose batch...</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              {!selectedBatchId && (
                <p className="text-[11px] text-amber-600 mt-1">Batch selection is required for this report.</p>
              )}
            </div>
          )}

          {currentCategory === 'teacher' && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <BookOpen className="w-4 h-4 text-violet-600" /> Target Faculty Scope <span className="text-rose-500">*</span>
              </div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Select Teacher</label>
              {teachersPending ? (
                <div className="h-9 bg-slate-200/60 rounded-lg animate-pulse" />
              ) : (
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-800"
                  required
                >
                  <option value="">Choose faculty member...</option>
                  {teachersList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user?.name ?? t.name} {t.employeeId ? `(Emp ID: ${t.employeeId})` : ''}
                    </option>
                  ))}
                </select>
              )}
              {!selectedTeacherId && (
                <p className="text-[11px] text-amber-600 mt-1">Teacher selection is required for this report.</p>
              )}
            </div>
          )}

          {/* Format & Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Output Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2.5 text-xs font-semibold border border-slate-200 rounded-xl bg-white text-slate-800"
              >
                <option value="EXCEL">Department Excel Workbook (.xlsx) — Multi-Sheet with Formulas</option>
                <option value="HTML">Printable Official Stationery (HTML / Save as PDF)</option>
                <option value="CSV">Raw Tabular Export (CSV)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Reporting Window (Optional)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" quickPresets={false} />
                <DatePicker value={dateTo} onChange={setDateTo} minDate={dateFrom || undefined} placeholder="To" quickPresets={false} />
              </div>
            </div>
          </div>

          {/* Live Configuration Summary Preview */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-600 space-y-1">
            <span className="font-bold text-slate-800 uppercase tracking-wider text-[10.5px]">Configuration Summary:</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] mt-1">
              <span>Type: <strong>{REPORT_CONFIGS[type]?.label}</strong></span>
              <span>
                Format:{' '}
                <strong>
                  {format === 'EXCEL'
                    ? 'Excel Workbook (.xlsx)'
                    : format === 'CSV'
                    ? 'CSV Spreadsheet'
                    : 'Printable Stationery (HTML)'}
                </strong>
              </span>
              <span>
                Target:{' '}
                <strong>
                  {currentCategory === 'student'
                    ? selectedStudentName ?? 'None'
                    : currentCategory === 'batch'
                    ? selectedBatchName ?? 'None'
                    : selectedTeacherName ?? 'None'}
                </strong>
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid || requestReport.isPending}
              className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {requestReport.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enqueue Generation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main AdminReports Screen ────────────────────────────────────────────────

export function AdminReports({
  initialBatchId,
}: {
  initialBatchId?: string;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const { data, isPending, isError, refetch, isFetching } = useReportsList(undefined);
  const retryMutation = useRetryReport();

  const rawReports: ReportRow[] = data?.data ?? [];

  // Polling check: if any report is in-flight, refetch every 2.5s
  const hasInFlight = useMemo(() => {
    return rawReports.some((r) => r.status === 'QUEUED' || r.status === 'PROCESSING');
  }, [rawReports]);

  useEffect(() => {
    if (!hasInFlight) return;
    const interval = setInterval(() => {
      refetch();
    }, 2500);
    return () => clearInterval(interval);
  }, [hasInFlight, refetch]);

  // Statistics counters
  const stats = useMemo(() => {
    const total = rawReports.length;
    const inProgress = rawReports.filter((r) => r.status === 'QUEUED' || r.status === 'PROCESSING').length;
    const completed = rawReports.filter((r) => r.status === 'COMPLETE').length;
    const failed = rawReports.filter((r) => r.status === 'FAILED').length;
    return { total, inProgress, completed, failed };
  }, [rawReports]);

  // AppleDropdown options
  const statusOptions: AppleDropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'COMPLETE', label: 'Completed', badge: 'Ready' },
    { value: 'PROCESSING', label: 'Processing', badge: 'Active' },
    { value: 'QUEUED', label: 'Queued', badge: 'Queued' },
    { value: 'FAILED', label: 'Failed', badge: 'Failed' },
  ], []);

  const typeOptions: AppleDropdownOption[] = useMemo(() => [
    { value: 'ALL', label: 'All Report Types' },
    ...Object.entries(REPORT_CONFIGS).map(([k, v]) => ({
      value: k,
      label: v.label,
      badge: v.category === 'student' ? 'Student' : v.category === 'batch' ? 'Cohort' : 'Faculty',
    })),
  ], []);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return rawReports.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const cfg = (REPORT_CONFIGS as Record<string, any>)[r.type];
        const label = cfg?.label?.toLowerCase() ?? '';
        const matchesType = r.type.toLowerCase().includes(query) || label.includes(query);
        const matchesId = r.id.toLowerCase().includes(query);
        if (!matchesType && !matchesId) return false;
      }
      return true;
    });
  }, [rawReports, statusFilter, typeFilter, searchQuery]);

  return (
    <div className="p-6 space-y-6 max-w-[1700px] mx-auto w-full animate-fadein">
      {/* ── Top Header Bar ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-extrabold text-slate-900 tracking-tight">Reports Studio</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Asynchronous generation workspace for transcripts, progress cards, cohort summaries, and CSV data.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Generate Report
          </button>
        </div>
      </div>

      {/* ── Quick KPI Status Tiles ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-3.5">
        <div className="bg-white p-3.5 sm:p-4 border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Reports</span>
          <p className="text-2xl font-black text-slate-900 mt-1">{stats.total}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <Loader2 className={`w-3.5 h-3.5 ${stats.inProgress > 0 ? 'animate-spin' : ''}`} /> In Progress
          </span>
          <p className="text-2xl font-black text-amber-600 mt-1">{stats.inProgress}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ready to View
          </span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white p-3.5 sm:p-4 border border-slate-200/80 rounded-2xl shadow-xs">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> Generation Failed
          </span>
          <p className="text-2xl font-black text-rose-600 mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* ── Search & Filter Toolbar ───────────────────────────────────────── */}
      <div className="bg-white p-3 sm:p-3.5 border border-slate-200/80 rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="w-full md:max-w-xs lg:max-w-sm relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search reports by title or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9.5 pr-8 py-2 text-xs border border-slate-200/90 rounded-xl bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          <div className="w-full sm:w-[160px] md:w-[170px]">
            <AppleDropdown
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
              options={statusOptions}
              placeholder="All Statuses"
              size="sm"
              themeColor="indigo"
            />
          </div>

          <div className="w-full sm:w-[210px] md:w-[230px]">
            <AppleDropdown
              value={typeFilter}
              onChange={(val) => setTypeFilter(val)}
              options={typeOptions}
              placeholder="All Types"
              size="sm"
              themeColor="indigo"
              searchable
            />
          </div>

          {(statusFilter !== 'ALL' || typeFilter !== 'ALL' || searchQuery.trim() !== '') && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setTypeFilter('ALL');
                setSearchQuery('');
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 active:bg-slate-200 rounded-xl transition-colors cursor-pointer w-full sm:w-auto"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Table & State Handling ────────────────────────────────────────── */}
      {isPending && <SkeletonTable rows={6} cols={5} />}

      {isError && (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Couldn't load reports"
          description="Failed to connect to the report services. Check connection and retry."
          action={{ label: 'Retry', onClick: () => refetch() }}
        />
      )}

      {!isPending && !isError && rawReports.length === 0 && (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No reports generated yet"
          description="Generate a student transcript, progress card, or cohort summary to get started."
          action={{ label: 'Generate Report', onClick: () => setCreateOpen(true) }}
        />
      )}

      {!isPending && !isError && rawReports.length > 0 && filteredReports.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-xs text-slate-400">
          No reports matching your search and filter criteria.
        </div>
      )}

      {!isPending && !isError && filteredReports.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3.5 whitespace-nowrap">Report Title</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Format</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3.5 whitespace-nowrap">Requested At</th>
                  <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((r) => {
                  const cfg = (REPORT_CONFIGS as Record<string, any>)[r.type];
                  const label = cfg?.label ?? r.type.replace(/_/g, ' ');
                  const statusInfo = STATUS_CONFIG[r.status] ?? DEFAULT_STATUS_INFO;
                  const StatusIcon = statusInfo.icon;
                  const isProcessing = r.status === 'QUEUED' || r.status === 'PROCESSING';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{label}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">#{r.id.slice(-8)}</div>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {r.format === 'EXCEL' ? 'Excel (.xlsx)' : r.format === 'CSV' ? 'CSV Data' : 'HTML Stationery'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.badge}`}>
                          <StatusIcon className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {new Date(r.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {r.status === 'COMPLETE' && r.fileUrl ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {r.format === 'EXCEL' || r.format === 'CSV' ? (
                              <a
                                href={r.fileUrl}
                                download
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100/80 rounded-xl transition-colors shadow-sm"
                                title={`Download ${r.format === 'EXCEL' ? 'Excel Workbook' : 'CSV Spreadsheet'}`}
                              >
                                <Download className="w-3.5 h-3.5" /> Download {r.format === 'EXCEL' ? 'Excel' : 'CSV'}
                              </a>
                            ) : (
                              <>
                                <a
                                  href={r.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-colors"
                                  title="Open printable view and printout"
                                >
                                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Printout
                                </a>
                                <a
                                  href={r.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100/60 rounded-xl transition-colors"
                                  title="Open document"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" /> View
                                </a>
                              </>
                            )}
                          </div>
                        ) : r.status === 'FAILED' ? (
                          <button
                            onClick={() => retryMutation.mutate(r.id)}
                            disabled={retryMutation.isPending}
                            className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg"
                          >
                            <RotateCcw className="w-3 h-3" /> Retry
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Generating...</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Dialog ────────────────────────────────────────────────────────── */}
      <CreateReportDialog
        isOpen={createOpen}
        initialBatchId={initialBatchId}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
