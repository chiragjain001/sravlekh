'use client';
// ─── Delete Batch Confirmation Dialog ─────────────────────────────────────────

import React from 'react';
import { AlertTriangle, Loader2, X, Trash2 } from 'lucide-react';

interface DeleteBatchDialogProps {
  isOpen:     boolean;
  onClose:    () => void;
  onConfirm:  () => Promise<void>;
  batchNames: string[];
  loading?:   boolean;
}

export function DeleteBatchDialog({
  isOpen, onClose, onConfirm, batchNames, loading = false,
}: DeleteBatchDialogProps) {
  if (!isOpen) return null;

  const isBulk = batchNames.length > 1;
  const title  = isBulk ? `Archive ${batchNames.length} Batches` : `Archive ${batchNames[0]}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-rose-100">
        <div className="flex items-center justify-between p-5 border-b border-rose-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100 text-xs text-rose-800 font-medium">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <span>
              {isBulk
                ? `Archiving ${batchNames.length} batches will mark their cohorts as completed/archived.`
                : `Archiving ${batchNames[0]} will mark the cohort as completed/archived.`}
            </span>
          </div>

          <p className="text-[11px] text-slate-400">Historical performance data and student records remain preserved.</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={onConfirm} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? 'Archiving…' : 'Yes, Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}
