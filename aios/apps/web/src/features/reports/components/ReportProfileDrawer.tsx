'use client';
// ─── Report Profile Drawer ───────────────────────────────────────────────────

import React from 'react';
import { X, FileText, Download, Calendar, HardDrive, CheckCircle2 } from 'lucide-react';
import type { ReportItem } from '../types/reports.types';
import { useDownloadReport } from '../hooks/useReports';

interface ReportProfileDrawerProps {
  report:  ReportItem | null;
  onClose: () => void;
}

export function ReportProfileDrawer({ report, onClose }: ReportProfileDrawerProps) {
  const isOpen = !!report;
  const downloadMutation = useDownloadReport();

  if (!isOpen || !report) return null;

  async function handleDownload() {
    if (!report) return;
    await downloadMutation.mutateAsync(report.id);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 line-clamp-1">{report.title}</h3>
              <p className="text-xs text-slate-500">{report.category} · {report.generatedDate}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">FORMAT</span>
              <span className="font-bold text-blue-600 text-xs">{report.format} Document</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">FILE SIZE</span>
              <span className="font-bold text-slate-800 text-xs">{report.fileSize}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">Report Summary & Scope</h4>
            <p className="text-slate-700 leading-relaxed">
              This report provides aggregated metrics and analytical breakdowns for <strong>{report.title}</strong> across the specified institute reporting period.
            </p>
          </div>

          <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-blue-900">Total Downloads</span>
              <span className="font-bold text-blue-600 text-sm">{report.downloadsText}</span>
            </div>
            <p className="text-[11px] text-blue-700">Audit logs record all admin download requests for compliance.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={handleDownload}
            disabled={downloadMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download Report
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
