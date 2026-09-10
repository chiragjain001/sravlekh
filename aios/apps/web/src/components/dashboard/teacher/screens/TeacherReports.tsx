'use client';

import { useState } from 'react';
import { FileText, Loader2, ExternalLink } from 'lucide-react';
import { useBatches, useStudents, useReportsList, useRequestReport, useReport } from '@/hooks/useApi';

const REPORT_TYPES: { id: string; name: string; desc: string; color: string; needsStudent: boolean }[] = [
  { id: 'BATCH_REPORT', name: 'Batch Performance Report', desc: 'Roster-wide performance summary for a selected batch.', color: 'indigo', needsStudent: false },
  { id: 'PROGRESS_CARD', name: 'Student Progress Card', desc: 'Individual student performance and mastery — for parent-teacher meetings.', color: 'sky', needsStudent: true },
  { id: 'IMPROVEMENT_SHEET', name: 'Improvement Sheet', desc: 'A single student\'s scores and weak topics for a targeted follow-up.', color: 'amber', needsStudent: true },
];

const colorMap: Record<string, string> = {
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  sky:    'bg-sky-50 text-sky-600 border-sky-100',
  amber:  'bg-amber-50 text-amber-600 border-amber-100',
};

function ReportRow({ report }: { report: any }) {
  const { data: polled } = useReport(report.id, { poll: report.status === 'QUEUED' || report.status === 'PROCESSING' });
  const current = polled ?? report;

  return (
    <tr className="hover:bg-slate-50/50 transition-colors">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
            <FileText className="w-4 h-4" />
          </div>
          <p className="font-semibold text-slate-800">{current.type.replace(/_/g, ' ')}</p>
        </div>
      </td>
      <td className="py-4 px-3 text-center">
        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
          current.status === 'COMPLETE' ? 'bg-emerald-100 text-emerald-700' :
          current.status === 'FAILED'   ? 'bg-rose-100 text-rose-700' :
                                           'bg-amber-100 text-amber-700'
        }`}>{current.status}</span>
      </td>
      <td className="py-4 px-3 text-center text-slate-500 hidden md:table-cell">{new Date(current.createdAt).toLocaleString()}</td>
      <td className="py-4 px-5 text-right">
        {current.status === 'COMPLETE' && current.fileUrl ? (
          <a href={current.fileUrl} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 text-white text-[11.5px] font-bold rounded-xl hover:bg-slate-900 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> View Report
          </a>
        ) : current.status === 'FAILED' ? (
          <span className="text-[12px] text-rose-500 font-semibold">Generation failed</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 font-semibold">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {current.status === 'PROCESSING' ? 'Processing…' : 'Queued…'}
          </span>
        )}
      </td>
    </tr>
  );
}

export function TeacherReports() {
  const { data: batchesResp } = useBatches();
  const batches: any[] = batchesResp?.data ?? batchesResp ?? [];
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const { data: studentsResp } = useStudents(selectedBatch ? { batchId: selectedBatch, limit: 200 } : undefined);
  const students = studentsResp?.data ?? [];

  const requestReport = useRequestReport();
  const { data: reportsResp, isLoading } = useReportsList({ limit: 50 });
  const reports = reportsResp?.data ?? [];

  const handleGenerate = (typeId: string, needsStudent: boolean) => {
    if (!selectedBatch) return;
    if (needsStudent && !selectedStudent) return;
    requestReport.mutate({
      type: typeId,
      scope: { batchId: selectedBatch, studentId: needsStudent ? selectedStudent : undefined },
      format: 'PDF',
    });
  };

  return (
    <div className="p-6 animate-fadein space-y-8">
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Reports</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Generate and download performance reports for your batches and students.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Batch *</label>
          <select value={selectedBatch} onChange={e => { setSelectedBatch(e.target.value); setSelectedStudent(''); }}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
            <option value="">Select a batch…</option>
            {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target Student (for student reports)</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} disabled={!selectedBatch}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:opacity-50">
            <option value="">Select a student…</option>
            {students.map((s: any) => <option key={s.id} value={s.id}>{s.user?.name ?? s.rollNumber ?? s.id}{s.rollNumber ? ` (Roll ${s.rollNumber})` : ''}</option>)}
          </select>
        </div>
      </div>

      <div>
        <h2 className="text-[15px] font-bold text-slate-800 mb-1">Generate Report</h2>
        <p className="text-[12.5px] text-slate-500 mb-4">Reports are generated as a downloadable data file (JSON) queued in the background.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORT_TYPES.map(rt => {
            const disabled = !selectedBatch || (rt.needsStudent && !selectedStudent) || requestReport.isPending;
            return (
              <div key={rt.id} className="card border border-slate-100 rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${colorMap[rt.color]}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-slate-800 leading-tight">{rt.name}</p>
                    <p className="text-[11.5px] text-slate-500 mt-1 leading-snug">{rt.desc}</p>
                  </div>
                </div>
                <button onClick={() => handleGenerate(rt.id, rt.needsStudent)} disabled={disabled}
                  className="w-full py-2.5 text-[12.5px] font-bold rounded-xl flex items-center justify-center gap-2 transition-all bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed">
                  <ExternalLink className="w-3.5 h-3.5" /> Generate Report
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-[15px] font-bold text-slate-800 mb-1">Generated Reports</h2>
        <p className="text-[12.5px] text-slate-500 mb-4">Reports you've requested — status updates automatically.</p>
        <div className="card border border-slate-100 rounded-2xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Report</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Status</th>
                <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden md:table-cell">Requested</th>
                <th className="text-right py-3 px-5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-[13px]">Loading reports…</td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={4} className="py-12 text-center text-slate-400 text-[13px]">No reports generated yet.</td></tr>
              ) : (
                reports.map((r: any) => <ReportRow key={r.id} report={r} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
