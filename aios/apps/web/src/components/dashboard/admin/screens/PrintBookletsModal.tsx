'use client';

import React, { useState } from 'react';
import {
  X,
  Printer,
  Download,
  Plus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ShieldCheck,
  QrCode,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useBookletPrintRuns,
  useCreateBookletPrintRun,
  downloadBookletPrintRunPdf,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';

interface PrintBookletsModalProps {
  exam: {
    id: string;
    title: string;
    batch?: { name: string };
    assessmentDeliveryId?: string | null;
  };
  onClose: () => void;
}

export function PrintBookletsModal({ exam, onClose }: PrintBookletsModalProps) {
  const { user } = useAuth();
  const deliveryId = exam.assessmentDeliveryId;

  const { data: printRunsData, isLoading: loadingRuns } = useBookletPrintRuns(deliveryId);
  const createPrintRunMutation = useCreateBookletPrintRun(deliveryId);

  const [count, setCount] = useState<number>(40);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const printRuns = Array.isArray(printRunsData)
    ? printRunsData
    : (printRunsData as any)?.data || [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveryId || count < 1) return;

    try {
      const res = await createPrintRunMutation.mutateAsync({ count });
      const start = res?.startSerial ?? '0001';
      const end = res?.endSerial ?? count;
      toast.success(`Successfully generated ${count} booklets (#${start} – #${end}).`);
    } catch {
      toast.error('Failed to generate print run. Please verify assessment delivery status and retry.');
    }
  };

  const handleDownload = async (printRunId: string, startSerial: number, endSerial: number) => {
    if (!user?.instituteId || !deliveryId) {
      toast.error('Missing institute or delivery context for download.');
      return;
    }
    setDownloadingId(printRunId);
    try {
      toast.loading(`Preparing PDF booklet covers #${startSerial} – #${endSerial}...`, { id: 'dl-booklet' });
      const filename = `booklet-covers-${exam.title.replace(/[^a-zA-Z0-9_-]/g, '_')}-${startSerial}-${endSerial}.pdf`;
      await downloadBookletPrintRunPdf(user.instituteId, deliveryId, printRunId, filename);
      toast.success(`Downloaded booklet covers (${endSerial - startSerial + 1} sheets).`, { id: 'dl-booklet' });
    } catch {
      toast.error('Failed to download booklet PDF. Please retry.', { id: 'dl-booklet' });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-md animate-fadein"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-booklets-heading"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 id="print-booklets-heading" className="text-base font-bold text-slate-900 dark:text-white">
                Print Answer Sheet Booklets
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {exam.title} {exam.batch?.name ? `• ${exam.batch.name}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close booklet printing modal"
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {!deliveryId ? (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Digital Delivery Sync Pending</p>
                <p className="mt-0.5 opacity-90">
                  This examination has not yet been linked to a digital assessment delivery. Advancing the exam or re-saving will provision the canonical delivery.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Generate Print Run Box */}
              <form onSubmit={handleCreate} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5 text-indigo-600" /> Generate New Print Run
                  </h3>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> HMAC-Signed QR &amp; Bubble Grid
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
                  <div className="flex-1 w-full">
                    <label htmlFor="booklet-count-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Number of Booklets to Generate
                    </label>
                    <input
                      id="booklet-count-input"
                      type="number"
                      min={1}
                      max={500}
                      value={count}
                      onChange={(e) => setCount(parseInt(e.target.value, 10) || 1)}
                      className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-hidden transition-all"
                      required
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      Tip: Include 5–10 extra copies for replacements or damaged sheets.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={createPrintRunMutation.isPending || count < 1}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap min-h-[34px]"
                  >
                    {createPrintRunMutation.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}
                    <span>{createPrintRunMutation.isPending ? 'Generating...' : 'Generate Booklets'}</span>
                  </button>
                </div>
              </form>

              {/* Best Practice Print Guidelines Notice */}
              <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/50 flex items-start gap-2.5 text-xs text-blue-900 dark:text-blue-300">
                <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Printing Best Practices for Reliable Optical Scanning:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] text-blue-800 dark:text-blue-300">
                    <li>Print on standard A4 75–80 GSM paper at <strong>100% scale (Actual Size)</strong>. Do not use &ldquo;Fit to Page&rdquo;.</li>
                    <li>Ensure four-corner fiducial alignment marks and booklet header QR codes are unclipped and sharp.</li>
                  </ul>
                </div>
              </div>

              {/* Existing Print Runs */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5" /> Generated Print Runs ({printRuns.length})
                </h3>

                {loadingRuns ? (
                  <div className="p-8 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <p className="text-xs">Loading generated print runs...</p>
                  </div>
                ) : printRuns.length === 0 ? (
                  <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <QrCode className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-xs font-medium">No print runs generated yet</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      Generate a batch of serialized booklet covers above to print PDF answer sheets before the exam.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {printRuns.map((run: any) => (
                      <div
                        key={run.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                            #{run.startSerial}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {run.count} Booklets
                              </span>
                              <span className="px-1.5 py-0.5 rounded-sm text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                                Serials: #{String(run.startSerial).padStart(4, '0')} – #{String(run.endSerial).padStart(4, '0')}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              Created {new Date(run.createdAt).toLocaleDateString()} at {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownload(run.id, run.startSerial, run.endSerial)}
                          disabled={downloadingId === run.id}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 border border-indigo-200/80 dark:border-indigo-800/50"
                        >
                          {downloadingId === run.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>{downloadingId === run.id ? 'Downloading...' : 'Download PDF'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
