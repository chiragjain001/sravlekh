'use client';
// ─── AdminAuditLogs — Audit Logs & Activity History Console ─────────────────
// Service layer backed implementation with TanStack Query hooks, profile drawers & analytics.

import React, { useState, useCallback } from 'react';
import {
  Search, ChevronDown, Calendar, Bell,
  Download, RefreshCw, ShieldAlert, FileText,
} from 'lucide-react';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

import {
  useAuditLogs,
  useExportAuditLogs,
} from '@/features/audit-logs/hooks/useAuditLogs';
import { AuditLogsTable }       from '@/features/audit-logs/components/AuditLogsTable';
import { AuditLogDrawer }       from '@/features/audit-logs/components/AuditLogDrawer';
import { AuditAnalyticsPanel }  from '@/features/audit-logs/components/AuditAnalyticsPanel';

import type {
  AuditLogItem,
  GetAuditLogsParams,
} from '@/features/audit-logs/types/audit-log.types';

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-bold transition-all
      ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
      {type === 'success' ? '✓' : '✗'} {msg}
    </div>
  );
}

export function AdminAuditLogs() {
  const [search, setSearch]             = useState('');
  const [userFilter, setUserFilter]     = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage]                 = useState(1);

  // Drawers & Modals
  const [selectedLog, setSelectedLog]     = useState<AuditLogItem | null>(null);
  const [activeModal, setActiveModal]     = useState<'securityLog' | null>(null);

  const { toast, show: showToast } = useToast();

  const params: GetAuditLogsParams = {
    user:   userFilter   || undefined,
    module: moduleFilter || undefined,
    action: actionFilter || undefined,
    search,
    page,
    limit: 10,
  };

  const { data: paginatedLogs, isLoading, refetch } = useAuditLogs(params);
  const exportMutation = useExportAuditLogs();

  async function handleExport() {
    await exportMutation.mutateAsync();
    showToast('Audit log exported to CSV');
  }

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Logs &amp; Activity History</h1>
          <p className="text-xs text-gray-500 mt-0.5">Track all administrative actions, system modifications, and security events</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              4
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Full-Width Controls Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2.5 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by user, action, module or details..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            {/* Filter: All Users */}
            <div className="relative">
              <select
                value={userFilter}
                onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Users</option>
                <option value="Neha Malhotra">Neha Malhotra</option>
                <option value="Rahul Verma">Rahul Verma</option>
                <option value="Priya Sharma">Priya Sharma</option>
                <option value="System Bot">System Bot</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Filter: All Modules */}
            <div className="relative">
              <select
                value={moduleFilter}
                onChange={(e) => { setModuleFilter(e.target.value); setPage(1); }}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Modules</option>
                <option value="Students">Students</option>
                <option value="Batches">Batches</option>
                <option value="Academics">Academics</option>
                <option value="Attendance">Attendance</option>
                <option value="Exams">Exams</option>
                <option value="Finance">Finance</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" /> Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export Audit Log
            </button>
          </div>
        </div>

        {/* ── AUDIT LOGS TABLE SET TO FULL WIDTH CARD ── */}
        {paginatedLogs ? (
          <AuditLogsTable
            paginated={paginatedLogs}
            onRowClick={(log) => setSelectedLog(log)}
            onPageChange={(p) => setPage(p)}
          />
        ) : (
          <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />
        )}

        {/* ── OTHER CARDS SET BELOW THE AUDIT TRAIL TABLE ── */}
        <AuditAnalyticsPanel
          onOpenSecurityLog={() => setActiveModal('securityLog')}
        />
      </div>

      {/* Profile Drawer */}
      <AuditLogDrawer
        log={selectedLog}
        onClose={() => setSelectedLog(null)}
      />

      {/* ── OVERLAP MODAL: Security Log ── */}
      <AdminOverlapModal
        isOpen={activeModal === 'securityLog'}
        onClose={() => setActiveModal(null)}
        title="Security Audit &amp; Access Alert Log"
        subtitle="Detailed trace of authentication failures, permission changes, and security events"
        icon={ShieldAlert}
        badgeText="12 Security Alerts"
        badgeColor="bg-rose-50 text-rose-600 border-rose-100"
      >
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-rose-900">Failed Login Attempt (IP: 192.168.1.105)</h4>
              <p className="text-[11px] text-rose-700">Invalid password attempt for account admin@aios.edu.in</p>
            </div>
            <span className="text-xs font-bold text-rose-600">23 May, 10:14 AM</span>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-amber-900">User Permission Modified</h4>
              <p className="text-[11px] text-amber-700">Super Admin Neha Malhotra modified RBAC role for Rahul Verma</p>
            </div>
            <span className="text-xs font-bold text-amber-600">22 May, 07:30 PM</span>
          </div>
        </div>
      </AdminOverlapModal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
