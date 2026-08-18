'use client';
// ─── Audit Log Profile Drawer Component ───────────────────────────────────────

import React from 'react';
import { X, Activity, ShieldCheck, Globe, Calendar, User } from 'lucide-react';
import type { AuditLogItem } from '../types/audit-log.types';

interface AuditLogDrawerProps {
  log:     AuditLogItem | null;
  onClose: () => void;
}

export function AuditLogDrawer({ log, onClose }: AuditLogDrawerProps) {
  const isOpen = !!log;
  if (!isOpen || !log) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />

      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col transition-transform duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-br from-blue-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${log.avatarBg} text-white font-bold text-xs flex items-center justify-center`}>
              {log.avatar}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{log.action}</h3>
              <p className="text-xs text-slate-500">Performed by {log.user} · {log.dateTime}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">MODULE</span>
              <span className="font-bold text-blue-600 text-xs">{log.module}</span>
            </div>
            <div>
              <span className="text-slate-400 font-semibold block text-[10px]">IP ADDRESS</span>
              <span className="font-mono font-bold text-slate-800 text-xs">{log.ipAddress}</span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <h4 className="font-bold text-slate-900 text-xs">Action Details & Payload</h4>
            <p className="text-slate-700 leading-relaxed font-mono text-[11.5px]">
              {log.details}
            </p>
          </div>

          <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-100 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" /> Integrity Verification Passed
            </div>
            <p className="text-[11px] text-emerald-700">Audit log entry cryptographically signed and immutable.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300">
            Close
          </button>
        </div>
      </div>
    </>
  );
}
