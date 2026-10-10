'use client';

import React, { useState } from 'react';
import {
  List,
  Search,
  ShieldCheck,
  Clock,
  ArrowRight,
  Filter,
  User,
  Activity,
} from 'lucide-react';
import { usePermissionAuditTrail } from '@/hooks/useApi';

export function PermissionAuditTrailView() {
  const { data: auditLogs, isLoading } = usePermissionAuditTrail();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = (auditLogs ?? []).filter((log) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.actorName?.toLowerCase().includes(q) ||
      log.actorEmail?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.entity?.toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-2xl border border-slate-200/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail by administrator, action, or entity…"
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
          />
        </div>

        <span className="text-xs font-semibold text-slate-500 self-start sm:self-auto">
          {filteredLogs.length} audit events logged
        </span>
      </div>

      {/* Audit Log Entries List */}
      {filteredLogs.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
          {filteredLogs.map((log) => {
            const isCreate = log.action === 'CREATE';
            const isDelete = log.action === 'DELETE';
            const isUpdate = log.action === 'UPDATE';

            return (
              <div key={log.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        isCreate
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : isDelete
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="text-xs font-bold text-slate-900">{log.entity}</span>
                    <span className="text-[11px] text-slate-400">· ID: {log.entityId}</span>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">{log.actorName}</span>
                  <span className="text-slate-400">({log.actorEmail})</span>
                  <span>performed this security operation</span>
                </div>

                {/* Diff inspection */}
                {(log.newValue || log.oldValue) && (
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/50 text-[11px] font-mono text-slate-700 overflow-x-auto max-h-24">
                    {log.newValue ? (
                      <div>
                        <span className="text-emerald-700 font-bold">New Value: </span>
                        {typeof log.newValue === 'object'
                          ? JSON.stringify(log.newValue)
                          : String(log.newValue)}
                      </div>
                    ) : null}
                    {log.oldValue ? (
                      <div className="mt-0.5">
                        <span className="text-rose-700 font-bold">Old Value: </span>
                        {typeof log.oldValue === 'object'
                          ? JSON.stringify(log.oldValue)
                          : String(log.oldValue)}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Activity className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Audit Events Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No audit log entries match your search query.'
              : 'Audit entries will be recorded whenever permissions or roles are granted, modified, or revoked.'}
          </p>
        </div>
      )}
    </div>
  );
}
