'use client';
// ─── Delete Confirmation Dialog ────────────────────────────────────────────────
// Used for single and bulk delete operations.
// Never uses browser confirm(). Always shows explicit confirmation.

import React from 'react';
import { AlertTriangle, Loader2, X, Trash2 } from 'lucide-react';

interface DeleteStudentDialogProps {
  isOpen:       boolean;
  onClose:      () => void;
  onConfirm:    () => Promise<void>;
  studentNames: string[];   // 1 item = single delete, multiple = bulk
  loading?:     boolean;
}

export function DeleteStudentDialog({
  isOpen, onClose, onConfirm, studentNames, loading = false,
}: DeleteStudentDialogProps) {
  if (!isOpen) return null;

  const isBulk  = studentNames.length > 1;
  const title   = isBulk ? `Remove ${studentNames.length} Students` : `Remove ${studentNames[0]}`;
  const message = isBulk
    ? `You are about to remove ${studentNames.length} students from the system. This action will deactivate their accounts and revoke access.`
    : `You are about to remove ${studentNames[0]} from the system. Their account will be deactivated and access revoked.`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-rose-100"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-desc"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-rose-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-rose-600" />
            </div>
            <h3 id="delete-dialog-title" className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="flex gap-3 p-4 bg-rose-50 rounded-xl border border-rose-100">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <p id="delete-dialog-desc" className="text-xs text-rose-800 font-medium leading-relaxed">
              {message}
            </p>
          </div>

          {isBulk && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {studentNames.map((n, i) => (
                <div key={i} className="text-xs text-slate-600 px-3 py-1.5 bg-slate-50 rounded-lg font-medium">
                  {n}
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            This is a soft-delete. Student data is retained for audit purposes.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-60 shadow-sm shadow-rose-200 transition-colors"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {loading ? 'Removing…' : 'Yes, Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
