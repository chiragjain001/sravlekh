'use client';
// ─── Audit Logs Table Component ───────────────────────────────────────────────

import React from 'react';
import { Activity, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import type { AuditLogItem, PaginatedAuditLogs } from '../types/audit-log.types';

interface AuditLogsTableProps {
  paginated:   PaginatedAuditLogs;
  onRowClick:  (log: AuditLogItem) => void;
  onPageChange: (page: number) => void;
}

export function AuditLogsTable({ paginated, onRowClick, onPageChange }: AuditLogsTableProps) {
  const { data: logs, total, page, limit, totalPages } = paginated;

  return (
    <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">System Audit Log Trail</h2>
            <p className="text-[11px] text-gray-500">Real-time log of administrative actions, user changes, and module events</p>
          </div>
        </div>
        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
          {total.toLocaleString()} Recorded Logs
        </span>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500">
            <tr>
              <th className="px-5 py-3.5 font-semibold text-gray-700">Timestamp</th>
              <th className="px-5 py-3.5 font-semibold text-gray-700">User / Operator</th>
              <th className="px-5 py-3.5 font-semibold text-gray-700">Action Performed</th>
              <th className="px-5 py-3.5 font-semibold text-gray-700">Target Module</th>
              <th className="px-5 py-3.5 font-semibold text-gray-700">Activity Details</th>
              <th className="px-5 py-3.5 font-semibold text-gray-700 text-right">IP Address</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {logs.map((log) => (
              <tr
                key={log.id}
                className="hover:bg-blue-50/30 transition-colors cursor-pointer"
                onClick={() => onRowClick(log)}
              >
                <td className="px-5 py-3.5 text-gray-500 font-medium">{log.dateTime}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-full ${log.avatarBg} text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 shadow-2xs`}>
                      {log.avatar}
                    </div>
                    <span className="font-bold text-gray-900 text-[12.5px]">{log.user}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 font-bold text-gray-800">{log.action}</td>
                <td className="px-5 py-3.5">
                  <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    {log.module}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-gray-600 font-medium max-w-sm truncate">{log.details}</td>
                <td className="px-5 py-3.5 text-right font-mono text-gray-400 text-[11px]">{log.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50/30 flex items-center justify-between text-xs text-gray-500 flex-wrap gap-3">
        <div>
          Showing <span className="font-bold text-gray-900">{((page - 1) * limit) + 1}</span> to <span className="font-bold text-gray-900">{Math.min(page * limit, total)}</span> of <span className="font-bold text-gray-900">{total.toLocaleString()}</span> entries
        </div>

        <div className="flex items-center gap-1.5">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
            {page}
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-[11px] font-medium">Rows per page:</span>
          <div className="relative">
            <select className="appearance-none py-1 pl-2.5 pr-6 text-xs font-bold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none">
              <option>10</option>
              <option>25</option>
              <option>50</option>
            </select>
            <ChevronDown className="w-3 h-3 text-gray-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>
    </div>
  );
}
