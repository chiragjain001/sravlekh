'use client';
// ─── AdminAuditLogs — tenant-scoped, real backend ──────────────────────────
// 07-SECURITY-SPECIFICATION.md: PII fields in oldValue/newValue are redacted
// server-side before this ever reaches the browser.

import { useState } from 'react';
import { Search, Shield } from 'lucide-react';
import { useAuditLogs } from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'PUBLISH', 'LOCK', 'UNLOCK', 'TRANSFER', 'ROLE_CHANGE', 'LOGIN', 'LOGIN_FAILED'];

const ACTION_STYLE: Record<string, string> = {
  CREATE: 'bg-emerald-50 text-emerald-700',
  UPDATE: 'bg-sky-50 text-sky-700',
  DELETE: 'bg-rose-50 text-rose-700',
  APPROVE: 'bg-emerald-50 text-emerald-700',
  PUBLISH: 'bg-indigo-50 text-indigo-700',
  LOCK: 'bg-orange-50 text-orange-700',
  UNLOCK: 'bg-amber-50 text-amber-700',
  ROLE_CHANGE: 'bg-violet-50 text-violet-700',
  LOGIN_FAILED: 'bg-rose-50 text-rose-700',
};

interface AuditLogRow {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
}

export function AdminAuditLogs() {
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [page, setPage] = useState(1);

  const { data, isPending, isError } = useAuditLogs({
    ...(action ? { action } : {}),
    ...(entity.trim() ? { entity: entity.trim() } : {}),
    page, pageSize: 20,
  });

  const logs: AuditLogRow[] = data?.data ?? [];
  const meta = data?.meta as { total: number; page: number; totalPages: number } | undefined;

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Audit Log</h2>
        <p className="text-xs text-slate-500 mt-0.5">Immutable, tenant-scoped record of every sensitive action. PII fields are redacted.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={entity}
            onChange={(e) => { setEntity(e.target.value); setPage(1); }}
            placeholder="Filter by entity, e.g. exams..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="">All actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {isPending && <SkeletonTable rows={8} cols={5} />}

      {isError && (
        <EmptyState icon={<Shield className="w-6 h-6" />} title="Couldn't load the audit log" description="Something went wrong. Try refreshing the page." />
      )}

      {!isPending && !isError && logs.length === 0 && (
        <EmptyState icon={<Shield className="w-6 h-6" />} title="No matching audit entries" description="Try a different filter." />
      )}

      {!isPending && !isError && logs.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Entity</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Actor</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${ACTION_STYLE[log.action] ?? 'bg-slate-100 text-slate-600'}`}>
                      {log.action.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-slate-800">{log.entity} <span className="text-slate-400">/{log.entityId}</span></td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 font-mono">{log.actorId}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">Page {meta.page} of {meta.totalPages} · {meta.total} entries</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                  Previous
                </button>
                <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
