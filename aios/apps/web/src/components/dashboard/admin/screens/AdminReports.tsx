'use client';
// ─── AdminReports — Reports & Analytics ────────────────────────────────────
// Real backend: generation is a queued async job (QUEUED -> PROCESSING ->
// COMPLETE/FAILED). The list auto-polls in-flight reports every 2s until they
// settle. Generated files are structured JSON data pulled from real records,
// not a rendered PDF/Excel — see ReportGenerationProcessor for why.

import { useState } from 'react';
import { Plus, FileText, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { useReportsList, useRequestReport, useBatches } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const REPORT_TYPES = ['REPORT_CARD', 'PROGRESS_CARD', 'CLASS_REPORT', 'CHAPTER_REPORT', 'TEACHER_REPORT', 'BATCH_REPORT', 'IMPROVEMENT_SHEET'];

const STATUS_STYLE: Record<string, string> = {
  QUEUED: 'bg-slate-100 text-slate-600',
  PROCESSING: 'bg-amber-50 text-amber-700',
  COMPLETE: 'bg-emerald-50 text-emerald-700',
  FAILED: 'bg-rose-50 text-rose-700',
};

interface ReportRow {
  id: string;
  type: string;
  format: string;
  status: string;
  fileUrl?: string | null;
  createdAt: string;
}

export function AdminReports() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isPending, isError, refetch, isFetching } = useReportsList(undefined);
  const reports: ReportRow[] = data?.data ?? [];

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">Generate report cards, progress cards, and class/batch summaries — generation runs in the background.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Generate Report
          </button>
        </div>
      </div>

      {isPending && <SkeletonTable rows={6} cols={4} />}

      {isError && (
        <EmptyState icon={<FileText className="w-6 h-6" />} title="Couldn't load reports" description="Something went wrong. Try refreshing the page." />
      )}

      {!isPending && !isError && reports.length === 0 && (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="No reports generated yet"
          description="Generate a report card, progress card, or class summary to get started."
          action={{ label: 'Generate Report', onClick: () => setCreateOpen(true) }}
        />
      )}

      {!isPending && !isError && reports.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Format</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Requested</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">File</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">{r.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{r.format}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[r.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {(r.status === 'QUEUED' || r.status === 'PROCESSING') && <Loader2 className="w-3 h-3 animate-spin" />}
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'COMPLETE' && r.fileUrl ? (
                      <a href={r.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                        <ExternalLink className="w-3.5 h-3.5" /> View Report
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateReportDialog isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

// ─── Generate Report ────────────────────────────────────────────────────────

function CreateReportDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: batches } = useBatches();
  const requestReport = useRequestReport();

  const [type, setType] = useState(REPORT_TYPES[0]);
  const [batchId, setBatchId] = useState('');
  const [format, setFormat] = useState('PDF');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  if (!isOpen) return null;

  function reset() {
    setType(REPORT_TYPES[0]); setBatchId(''); setFormat('PDF'); setDateFrom(''); setDateTo('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestReport.mutate(
      {
        type,
        format,
        scope: {
          ...(batchId ? { batchId } : {}),
          ...(dateFrom ? { dateFrom: new Date(dateFrom).toISOString() } : {}),
          ...(dateTo ? { dateTo: new Date(dateTo).toISOString() } : {}),
        },
      },
      { onSuccess: () => { reset(); onClose(); } },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-[14px] font-bold text-slate-900">Generate Report</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                {REPORT_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">Format</label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-slate-700 mb-1">Batch</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white">
              <option value="">No batch scope</option>
              {(batches ?? []).map((b: { id: string; name: string }) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-slate-700 mb-1">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[12px] font-semibold text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={requestReport.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {requestReport.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
