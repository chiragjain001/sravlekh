'use client';
// ─── Generate Report Dialog Component ────────────────────────────────────────

import React, { useState } from 'react';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import type { ReportCategory, GenerateReportInput } from '../types/reports.types';

const CATEGORIES: ReportCategory[] = [
  'Academic Reports',
  'Student Reports',
  'Financial Reports',
  'Faculty Reports',
  'Operational Reports',
];

interface GenerateReportDialogProps {
  isOpen:   boolean;
  onClose:  () => void;
  onSubmit: (input: GenerateReportInput) => Promise<void>;
}

export function GenerateReportDialog({ isOpen, onClose, onSubmit }: GenerateReportDialogProps) {
  const [title, setTitle]       = useState('');
  const [category, setCategory] = useState<ReportCategory>('Academic Reports');
  const [dateRange, setDateRange] = useState('01 Apr 2025 - 23 May 2025');
  const [format, setFormat]     = useState<'PDF' | 'CSV' | 'XLSX'>('PDF');
  const [loading, setLoading]   = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await onSubmit({
        title,
        category,
        dateRange,
        format,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Generate Custom Institute Report</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Configure metrics, cohort parameters, and document export format</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Report Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Term 1 Complete Academic Evaluation"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Report Category *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ReportCategory)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white text-xs"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Reporting Date Range</label>
              <input
                type="text"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 mb-1">Export Format</label>
              <div className="flex items-center gap-3">
                {(['PDF', 'CSV', 'XLSX'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setFormat(fmt)}
                    className={`px-4 py-2 rounded-lg border font-bold text-xs transition-all cursor-pointer ${
                      format === fmt
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {fmt} Document
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? 'Compiling…' : 'Generate & Download'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
