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
  Users,
  Info,
} from 'lucide-react';
import {
  useDownloadBulkStudentTemplate,
  useValidateBulkStudents,
  useCommitBulkStudents,
  useDownloadBulkErrorReport,
} from '../hooks/useStudents';
import { useBatches } from '@/hooks/useApi';

interface BulkEnrollStudentsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StagedStudentRow {
  rowNumber: number;
  isValid: boolean;
  data: {
    name: string;
    email: string;
    rollNumber?: string;
    batchId?: string;
    batchName?: string;
    dateOfBirth?: string;
    gender?: string;
    guardianName?: string;
    guardianPhone?: string;
    guardianEmail?: string;
    address?: string;
    tags?: string[];
  };
  errors: string[];
}

type Step = 'upload' | 'review' | 'success';

export function BulkEnrollStudentsDialog({ isOpen, onClose }: BulkEnrollStudentsDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [stagedRows, setStagedRows] = useState<StagedStudentRow[]>([]);
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

  const downloadTemplateMutation = useDownloadBulkStudentTemplate();
  const validateMutation = useValidateBulkStudents();
  const commitMutation = useCommitBulkStudents();
  const downloadErrorMutation = useDownloadBulkErrorReport();

  // Reset state on close
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
      alert('Please upload an Excel (.xlsx) or CSV spreadsheet file.');
      return;
    }
    setFile(selectedFile);

    try {
      const result = await validateMutation.mutateAsync(selectedFile);
      setStagedRows(result.rows || []);
      setTemplateVerified(result.templateVerified || false);
      setStep('review');
    } catch {
      // Error handled by hook toast
    }
  };

  // Inline Row Edits in the Web Staging Grid
  const updateRowField = (rowNumber: number, field: string, value: string) => {
    setStagedRows((prev) =>
      prev.map((row) => {
        if (row.rowNumber !== rowNumber) return row;

        const updatedData = { ...row.data, [field]: value };

        // Re-evaluate basic validity locally
        const newErrors = [...row.errors];
        if (field === 'name') {
          const idx = newErrors.findIndex((e) => e.includes('Full Name'));
          if (value.trim().length >= 2 && idx >= 0) newErrors.splice(idx, 1);
          else if (value.trim().length < 2 && idx < 0) newErrors.push('Full Name is required (minimum 2 characters).');
        }

        if (field === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          const idx = newErrors.findIndex((e) => e.includes('email format'));
          if (emailRegex.test(value.trim()) && idx >= 0) newErrors.splice(idx, 1);
          else if (!emailRegex.test(value.trim()) && idx < 0) newErrors.push(`Invalid email format: '${value}'.`);
        }

        if (field === 'batchId') {
          const b = batches.find((item: any) => item.id === value);
          if (b) {
            updatedData.batchName = b.name;
            const idx = newErrors.findIndex((e) => e.includes('Batch'));
            if (idx >= 0) newErrors.splice(idx, 1);
          }
        }

        return {
          ...row,
          data: updatedData,
          errors: newErrors,
          isValid: newErrors.length === 0,
        };
      }),
    );
  };

  const validRows = useMemo(() => stagedRows.filter((r) => r.isValid), [stagedRows]);
  const errorRows = useMemo(() => stagedRows.filter((r) => !r.isValid), [stagedRows]);

  const displayedRows = useMemo(() => {
    if (filterMode === 'valid') return validRows;
    if (filterMode === 'errors') return errorRows;
    return stagedRows;
  }, [stagedRows, validRows, errorRows, filterMode]);

  const handleCommit = async () => {
    if (validRows.length === 0) return;

    try {
      const payload = validRows.map((r) => ({
        name: r.data.name,
        email: r.data.email,
        rollNumber: r.data.rollNumber,
        batchId: r.data.batchId,
        batchName: r.data.batchName,
        dateOfBirth: r.data.dateOfBirth,
        gender: r.data.gender,
        guardianName: r.data.guardianName,
        guardianPhone: r.data.guardianPhone,
        guardianEmail: r.data.guardianEmail,
        address: r.data.address,
        tags: r.data.tags,
      }));

      const res = await commitMutation.mutateAsync(payload);
      setImportResult({
        enrolledCount: res.enrolledCount,
        failedCount: res.failedCount + errorRows.length,
        failedRows: [
          ...(res.failedRows || []),
          ...errorRows.map((r) => ({
            rowNumber: r.rowNumber,
            data: r.data,
            errors: r.errors,
          })),
        ],
      });
      setStep('success');
    } catch {
      // Error handled by hook toast
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs animate-fadein">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]">
        {/* ── Modal Header with iOS Stepper ───────────────────────────────── */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Bulk Student Enrollment
              </h2>
              <p className="text-xs text-slate-500">
                Dynamic Excel template import with live batch validation
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step Indicator Bar ────────────────────────────────────────── */}
        <div className="px-6 py-2.5 bg-slate-100/60 border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'upload'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-emerald-500 text-white'
              }`}
            >
              {step !== 'upload' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '1'}
            </span>
            <span className={`font-semibold ${step === 'upload' ? 'text-slate-900' : 'text-slate-500'}`}>
              Upload &amp; Template
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'review'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : step === 'success'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {step === 'success' ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : '2'}
            </span>
            <span className={`font-semibold ${step === 'review' ? 'text-slate-900' : 'text-slate-500'}`}>
              Review &amp; Staging
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                step === 'success'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </span>
            <span className={`font-semibold ${step === 'success' ? 'text-slate-900' : 'text-slate-500'}`}>
              Enrollment Summary
            </span>
          </div>
        </div>

        {/* ── Modal Body By Step ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
          {/* STEP 1: UPLOAD & TEMPLATE INGEST */}
          {step === 'upload' && (
            <div className="space-y-6 max-w-3xl mx-auto">
              {/* Template Download Card */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-600/20">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Step 1: Download Smart Excel Template
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                      Generated on the fly with live batches for your institute embedded directly into Excel dropdowns.
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2.5 py-0.5 rounded-full">
                        <Sparkles className="w-3 h-3" /> Live Batches Embedded
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-white/80 px-2 py-0.5 rounded-full border border-slate-200/60">
                        Anti-Tamper Signed
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => downloadTemplateMutation.mutate()}
                  disabled={downloadTemplateMutation.isPending}
                  className="w-full sm:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl transition-all shadow-sm shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                >
                  {downloadTemplateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>Download .xlsx Template</span>
                </button>
              </div>

              {/* Upload Drop Zone */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Step 2: Upload Filled Excel (.xlsx) Spreadsheet
                </label>

                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all duration-200 ${
                    validateMutation.isPending
                      ? 'border-indigo-400 bg-indigo-50/20'
                      : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50/70'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelected(e.target.files[0])}
                  />

                  {validateMutation.isPending ? (
                    <div className="flex flex-col items-center justify-center space-y-3 py-6">
                      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                      <p className="text-sm font-bold text-slate-800">
                        Validating student records against institute database...
                      </p>
                      <p className="text-xs text-slate-400">
                        Checking signatures, duplicate emails, roll numbers, and batch scopes.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2 py-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600 mb-2">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        Drag and drop your filled Excel file here, or{' '}
                        <span className="text-indigo-600 underline">browse computer</span>
                      </p>
                      <p className="text-xs text-slate-400">
                        Supports .xlsx, .xls, and .csv formats (Max: 10MB)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tips & Instructions */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2 text-xs text-slate-600">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-indigo-600" /> Helpful Enrollment Tips
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-500 pl-1">
                  <li>Use the native in-cell dropdown in Excel for the <strong>Batch / Class</strong> column to avoid typos.</li>
                  <li>Emails must be unique per student across your institute.</li>
                  <li>You can preview, verify, and correct any row directly in your browser before committing.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: REVIEW & STAGING GRID */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Header Stats & Filter Tabs */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 sm:p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-center gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                      File Uploaded
                    </span>
                    <span className="font-bold text-slate-900 truncate max-w-[200px] block">
                      {file?.name}
                    </span>
                  </div>

                  {templateVerified && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Signature Verified
                    </span>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200/80 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
                      filterMode === 'all'
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All ({stagedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('valid')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                      filterMode === 'valid'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Ready ({validRows.length})
                  </button>
                  {errorRows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFilterMode('errors')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                        filterMode === 'errors'
                          ? 'bg-rose-600 text-white'
                          : 'text-rose-600 hover:text-rose-800'
                      }`}
                    >
                      <AlertCircle className="w-3 h-3" /> Errors ({errorRows.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Interactive Staging Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50/90 sticky top-0 z-10 border-b border-slate-200">
                      <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="px-3.5 py-3 w-12 text-center">Status</th>
                        <th className="px-3.5 py-3 w-12 text-center">Row</th>
                        <th className="px-3.5 py-3 min-w-[160px]">Full Name *</th>
                        <th className="px-3.5 py-3 min-w-[200px]">Email Address *</th>
                        <th className="px-3.5 py-3 min-w-[100px]">Roll No</th>
                        <th className="px-3.5 py-3 min-w-[180px]">Batch / Class *</th>
                        <th className="px-3.5 py-3 min-w-[220px]">Validation Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayedRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                            No students match the current filter.
                          </td>
                        </tr>
                      ) : (
                        displayedRows.map((row) => (
                          <tr
                            key={row.rowNumber}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              !row.isValid ? 'bg-rose-50/30' : ''
                            }`}
                          >
                            <td className="px-3.5 py-2.5 text-center">
                              {row.isValid ? (
                                <span className="inline-flex w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 items-center justify-center">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex w-5 h-5 rounded-full bg-rose-100 text-rose-600 items-center justify-center">
                                  <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-center font-mono text-slate-400 text-[11px]">
                              #{row.rowNumber}
                            </td>
                            <td className="px-3.5 py-2">
                              <input
                                type="text"
                                value={row.data.name}
                                onChange={(e) => updateRowField(row.rowNumber, 'name', e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                              />
                            </td>
                            <td className="px-3.5 py-2">
                              <input
                                type="text"
                                value={row.data.email}
                                onChange={(e) => updateRowField(row.rowNumber, 'email', e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                              />
                            </td>
                            <td className="px-3.5 py-2">
                              <input
                                type="text"
                                value={row.data.rollNumber || ''}
                                onChange={(e) => updateRowField(row.rowNumber, 'rollNumber', e.target.value)}
                                placeholder="Roll no"
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                              />
                            </td>
                            <td className="px-3.5 py-2">
                              <select
                                value={row.data.batchId || ''}
                                onChange={(e) => updateRowField(row.rowNumber, 'batchId', e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                              >
                                <option value="">Select Batch...</option>
                                {batches.map((b: any) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name} {b.section ? `(${b.section})` : ''}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3.5 py-2">
                              {row.errors.length > 0 ? (
                                <div className="space-y-1">
                                  {row.errors.map((err, i) => (
                                    <span
                                      key={i}
                                      className="inline-block text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200/80 px-2 py-0.5 rounded-md mr-1"
                                    >
                                      {err}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[11px] font-semibold text-emerald-600">
                                  Verified clean
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: ENROLLMENT SUCCESS & SUMMARY */}
          {step === 'success' && importResult && (
            <div className="py-8 px-4 max-w-xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Enrollment Completed Successfully!
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enrolled student profiles have been added to your institute roster and assigned to their batches.
                </p>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Enrolled
                  </span>
                  <p className="text-2xl font-black text-emerald-600 mt-0.5">
                    {importResult.enrolledCount}
                  </p>
                </div>
                <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-2xs">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Skipped / Errors
                  </span>
                  <p className={`text-2xl font-black mt-0.5 ${importResult.failedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                    {importResult.failedCount}
                  </p>
                </div>
              </div>

              {/* Error Remediation Sheet Button */}
              {importResult.failedCount > 0 && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-left space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    {importResult.failedCount} Student Record(s) could not be enrolled
                  </div>
                  <p className="text-[11.5px] text-rose-700">
                    Download the error report containing only the failed students and the exact reasons. You can fix them and re-upload directly.
                  </p>
                  <button
                    type="button"
                    onClick={() => downloadErrorMutation.mutate(importResult.failedRows)}
                    disabled={downloadErrorMutation.isPending}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-[0.98] rounded-xl transition-all shadow-xs cursor-pointer"
                  >
                    {downloadErrorMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Download Error Report (.xlsx)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Modal Footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3">
          {step === 'review' ? (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-xl transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Upload Another File</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommit}
                  disabled={validRows.length === 0 || commitMutation.isPending}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-sm shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {commitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Enroll {validRows.length} Student(s)</span>
                </button>
              </div>
            </>
          ) : step === 'success' ? (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto px-6 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
