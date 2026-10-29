'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  X,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Check,
  RefreshCw,
  Sparkles,
  GraduationCap,
} from 'lucide-react';
import {
  useDownloadBulkTeacherTemplate,
  useValidateBulkTeachers,
  useCommitBulkTeachers,
  useDownloadBulkTeacherErrorReport,
} from '../hooks/useTeachers';
import { useBatches, useSubjects } from '@/hooks/useApi';

interface BulkEnrollTeachersDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StagedTeacherRow {
  rowNumber: number;
  isValid: boolean;
  data: {
    name: string;
    email: string;
    qualification?: string;
    subjectName?: string;
    subjectId?: string;
    batchName?: string;
    batchId?: string;
  };
  errors: string[];
}

type Step = 'upload' | 'review' | 'success';

export function BulkEnrollTeachersDialog({ isOpen, onClose }: BulkEnrollTeachersDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [stagedRows, setStagedRows] = useState<StagedTeacherRow[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'errors'>('all');
  const [templateVerified, setTemplateVerified] = useState(false);
  const [importResult, setImportResult] = useState<{
    enrolledCount: number;
    failedCount: number;
    failedRows: any[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: batchesResp } = useBatches();
  const batches = useMemo(() => batchesResp?.data || [], [batchesResp]);

  const { data: subjectsResp } = useSubjects();
  const subjects = useMemo(() => {
    if (Array.isArray(subjectsResp)) return subjectsResp;
    if (subjectsResp && Array.isArray((subjectsResp as any).data)) return (subjectsResp as any).data;
    return [];
  }, [subjectsResp]);

  const downloadTemplateMutation = useDownloadBulkTeacherTemplate();
  const validateMutation = useValidateBulkTeachers();
  const commitMutation = useCommitBulkTeachers();
  const downloadErrorMutation = useDownloadBulkTeacherErrorReport();

  const handleClose = () => {
    setStep('upload');
    setFile(null);
    setStagedRows([]);
    setFilterMode('all');
    setImportResult(null);
    onClose();
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    if (!selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert('Please upload an Excel (.xlsx) spreadsheet file.');
      return;
    }
    setFile(selectedFile);

    try {
      const res = await validateMutation.mutateAsync(selectedFile);
      setStagedRows(res.rows || []);
      setTemplateVerified(res.templateVerified);
      setStep('review');
    } catch {
      // error handled by react-query/toast
    }
  };

  // Inline correction handlers
  const updateRowField = (index: number, field: keyof StagedTeacherRow['data'], value: string) => {
    setStagedRows((prev) => {
      const updated = [...prev];
      const target = { ...updated[index] };
      const currentData = { ...target.data, [field]: value } as StagedTeacherRow['data'];

      if (field === 'batchName') {
        const matched = batches.find((b: any) => b.name?.toLowerCase() === value.toLowerCase());
        currentData.batchId = matched ? matched.id : undefined;
      }

      if (field === 'subjectName') {
        const matched = subjects.find((s: any) => s.name?.toLowerCase() === value.toLowerCase());
        currentData.subjectId = matched ? matched.id : undefined;
      }

      target.data = currentData;

      // Re-evaluate client-side validation
      const errs: string[] = [];
      if (!currentData.name?.trim()) errs.push('Teacher name is required');
      if (!currentData.email?.trim()) {
        errs.push('Email is required');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentData.email.trim())) {
        errs.push('Invalid email address format');
      }

      target.errors = errs;
      target.isValid = errs.length === 0;
      updated[index] = target as StagedTeacherRow;
      return updated;
    });
  };

  const removeRow = (index: number) => {
    setStagedRows((prev) => prev.filter((_, i) => i !== index));
  };

  const validRows = useMemo(() => stagedRows.filter((r) => r.isValid), [stagedRows]);
  const errorRows = useMemo(() => stagedRows.filter((r) => !r.isValid), [stagedRows]);

  const displayedRows = useMemo(() => {
    if (filterMode === 'valid') return validRows;
    if (filterMode === 'errors') return errorRows;
    return stagedRows;
  }, [filterMode, stagedRows, validRows, errorRows]);

  const handleCommit = async () => {
    if (validRows.length === 0) return;
    try {
      const payload = validRows.map((r) => ({
        name: r.data.name.trim(),
        email: r.data.email.trim(),
        qualification: r.data.qualification?.trim() || undefined,
        subjectName: r.data.subjectName?.trim() || undefined,
        subjectId: r.data.subjectId || undefined,
        batchName: r.data.batchName?.trim() || undefined,
        batchId: r.data.batchId || undefined,
      }));

      const res = await commitMutation.mutateAsync(payload);
      setImportResult({
        enrolledCount: res.enrolledCount,
        failedCount: res.failedCount || errorRows.length,
        failedRows: [
          ...(res.failedRows || []),
          ...errorRows.map((er) => ({
            rowNumber: er.rowNumber,
            name: er.data.name,
            email: er.data.email,
            reason: er.errors.join('; '),
          })),
        ],
      });
      setStep('success');
    } catch {
      // error handled by mutation
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                Bulk Faculty Onboarding
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800">
                  Smart Excel
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Onboard teachers, assign subjects and batches in one secure spreadsheet
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body content based on step */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' && (
            <div className="space-y-6 max-w-3xl mx-auto py-2">
              {/* Step 1: Download Template */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-50/60 via-teal-50/30 to-transparent dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-transparent border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Step 1 • Get Current Template
                    </span>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Download Dynamic Faculty Template (.xlsx)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      This official template contains in-cell dropdowns populated with your institute&apos;s active subjects and classes. It includes an anti-tamper security watermark.
                    </p>
                  </div>
                  <button
                    onClick={() => downloadTemplateMutation.mutate()}
                    disabled={downloadTemplateMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/80 border border-emerald-200 dark:border-emerald-800 shadow-sm transition shrink-0 active:scale-95"
                  >
                    {downloadTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                    ) : (
                      <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Step 2: Upload Area */}
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Step 2 • Upload Filled Sheet
                </span>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 bg-slate-50/50 hover:bg-emerald-50/20 dark:bg-slate-900/40 dark:hover:bg-emerald-950/10 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
                    }}
                  />
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <div className="h-16 w-16 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-105 group-hover:shadow-lg transition-transform">
                      {validateMutation.isPending ? (
                        <Loader2 className="h-8 w-8 animate-spin" />
                      ) : (
                        <Upload className="h-8 w-8" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        {validateMutation.isPending
                          ? 'Validating faculty sheet against institute records...'
                          : 'Click to select or drag & drop your Excel file here'}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Supports .xlsx, .xls spreadsheets (up to 10 MB)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {/* Summary KPIs & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {file?.name}
                    </span>
                  </div>
                  {templateVerified ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <Check className="h-3 w-3" /> Official Template
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      External Spreadsheet
                    </span>
                  )}
                </div>

                {/* Filter toggle pills */}
                <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                      filterMode === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    All ({stagedRows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('valid')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      filterMode === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Valid ({validRows.length})
                  </button>
                  <button
                    onClick={() => setFilterMode('errors')}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                      filterMode === 'errors'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-600 dark:text-slate-400 hover:text-rose-600'
                    }`}
                  >
                    <AlertCircle className="h-3 w-3" />
                    Errors ({errorRows.length})
                  </button>
                </div>
              </div>

              {/* Interactive Staging Table */}
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[460px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold z-10 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2.5 w-12 text-center">#</th>
                        <th className="px-3 py-2.5 w-16 text-center">Status</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Teacher Name *</th>
                        <th className="px-3 py-2.5 min-w-[180px]">Email Address *</th>
                        <th className="px-3 py-2.5 min-w-[130px]">Qualification</th>
                        <th className="px-3 py-2.5 min-w-[140px]">Primary Subject</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Initial Batch</th>
                        <th className="px-3 py-2.5 min-w-[150px]">Issues / Notes</th>
                        <th className="px-3 py-2.5 w-12 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400">
                            No rows match the selected filter.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row, idx) => {
                          const realIdx = stagedRows.findIndex((r) => r.rowNumber === row.rowNumber);
                          return (
                            <tr
                              key={row.rowNumber}
                              className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                                !row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                              }`}
                            >
                              <td className="px-3 py-2 text-center font-mono text-slate-400">
                                {row.rowNumber}
                              </td>
                              <td className="px-3 py-2 text-center">
                                {row.isValid ? (
                                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                                    <Check className="h-3.5 w-3.5" />
                                  </span>
                                ) : (
                                  <span
                                    title={row.errors.join('; ')}
                                    className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 cursor-help"
                                  >
                                    <AlertCircle className="h-3.5 w-3.5" />
                                  </span>
                                )}
                              </td>
                              {/* Teacher Name */}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.data.name}
                                  onChange={(e) => updateRowField(realIdx, 'name', e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded-md bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition"
                                />
                              </td>
                              {/* Email Address */}
                              <td className="px-3 py-2">
                                <input
                                  type="email"
                                  value={row.data.email}
                                  onChange={(e) => updateRowField(realIdx, 'email', e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded-md bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition"
                                />
                              </td>
                              {/* Qualification */}
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={row.data.qualification || ''}
                                  placeholder="e.g. M.Sc, B.Ed"
                                  onChange={(e) => updateRowField(realIdx, 'qualification', e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded-md bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition"
                                />
                              </td>
                              {/* Subject */}
                              <td className="px-3 py-2">
                                <select
                                  value={row.data.subjectName || ''}
                                  onChange={(e) => updateRowField(realIdx, 'subjectName', e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded-md bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition"
                                >
                                  <option value="">(None / General)</option>
                                  {subjects.map((s: any) => (
                                    <option key={s.id} value={s.name}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              {/* Batch */}
                              <td className="px-3 py-2">
                                <select
                                  value={row.data.batchName || ''}
                                  onChange={(e) => updateRowField(realIdx, 'batchName', e.target.value)}
                                  className="w-full px-2 py-1 text-xs rounded-md bg-transparent border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 focus:ring-1 focus:ring-emerald-500 transition"
                                >
                                  <option value="">(Unassigned)</option>
                                  {batches.map((b: any) => (
                                    <option key={b.id} value={b.name}>
                                      {b.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              {/* Issues / Notes */}
                              <td className="px-3 py-2 text-rose-600 dark:text-rose-400 font-medium">
                                {row.errors.length > 0 ? row.errors.join('; ') : '—'}
                              </td>
                              {/* Action */}
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => removeRow(realIdx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded transition"
                                  title="Remove row"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'success' && importResult && (
            <div className="py-8 text-center space-y-6 max-w-lg mx-auto animate-in zoom-in-95 duration-200">
              <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-xl shadow-emerald-500/10">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Bulk Faculty Onboarding Complete!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Teacher profiles have been created, batch and subject assignments connected, and temporary login credentials initialized.
                </p>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/40">
                  <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                    {importResult.enrolledCount}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Successfully Onboarded
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40">
                  <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">
                    {importResult.failedCount}
                  </p>
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    Skipped / Failed
                  </p>
                </div>
              </div>

              {importResult.failedCount > 0 && (
                <div className="pt-2">
                  <button
                    onClick={() => downloadErrorMutation.mutate(importResult.failedRows)}
                    disabled={downloadErrorMutation.isPending}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 transition"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download Failed Teachers Error Sheet</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 transition"
              >
                Cancel
              </button>
              <div className="text-xs text-slate-400">
                Download template → Fill rows → Upload
              </div>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Upload
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  Ready to onboard: <strong>{validRows.length}</strong> valid teacher(s)
                </span>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={validRows.length === 0 || commitMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-500/20 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none"
                >
                  {commitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>Commit {validRows.length} Teacher(s)</span>
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
