'use client';
// ─── AdminExams — Enterprise Exams & Assessments Console ──────────────────────
// Full CRUD + Search + Filter + Sort + Pagination + Drawer + Modals + Analytics

import React, { useState, useCallback, useDeferredValue } from 'react';
import {
  Plus, Search, Download, Upload, ChevronDown, Calendar, Bell,
  AlertTriangle, CheckCircle2, Clock, FileText, Users, Award, SlidersHorizontal,
  ArrowUpRight, Copy, Layers, TrendingUp, RefreshCw, X, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

import {
  useExamsList,
  useCreateExam,
  useUpdateExam,
  useDeleteExam,
  useBulkDeleteExams,
  useExportExams,
  useExamsAnalytics,
} from '@/features/exams/hooks/useExams';
import { ExamsTable }          from '@/features/exams/components/ExamsTable';
import { ExamProfileDrawer }    from '@/features/exams/components/ExamProfileDrawer';
import { CreateExamDialog }     from '@/features/exams/components/CreateExamDialog';
import { DeleteExamDialog }     from '@/features/exams/components/DeleteExamDialog';
import { ExamsAnalyticsPanel }  from '@/features/exams/components/ExamsAnalyticsPanel';

import type {
  ExamListItem,
  GetExamsParams,
  SortDirection,
  CreateExamInput,
  UpdateExamInput,
  ExamType,
  ExamStatus,
} from '@/features/exams/types/exam.types';

const PAGE_SIZES = [10, 20, 50] as const;
const EXAM_TYPES: ExamType[] = ['Mock Test', 'Part Test', 'Subjective', 'Weekly Test', 'DPP Test'];
const STATUSES: ExamStatus[] = ['Upcoming', 'In-Progress', 'Evaluation Pending', 'Completed', 'Cancelled'];

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

export function AdminExams() {
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch                = useDeferredValue(searchInput);

  // Filters
  const [typeFilter,   setTypeFilter]   = useState<ExamType | ''>('');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | ''>('');
  const [batchFilter,  setBatchFilter]  = useState('');

  // Table state
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy,   setSortBy]   = useState<keyof ExamListItem>('date');
  const [sortDir,  setSortDir]  = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drawer & Dialog state
  const [viewId,       setViewId]       = useState<string | null>(null);
  const [editTarget,   setEditTarget]   = useState<ExamListItem | null>(null);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExamListItem[] | null>(null);

  // Overlap Modals
  const [activeModal, setActiveModal]   = useState<'examDetail' | 'passRateReport' | 'meritList' | 'alerts' | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamListItem | null>(null);

  const { toast, show: showToast } = useToast();

  const params: GetExamsParams = {
    page, pageSize,
    search: deferredSearch,
    type:   typeFilter   || undefined,
    status: statusFilter || undefined,
    batch:  batchFilter  || undefined,
    sortBy, sortDir,
  };

  const { data, isLoading, isFetching, refetch } = useExamsList(params);
  const { data: analytics }                       = useExamsAnalytics();

  const createMutation     = useCreateExam();
  const updateMutation     = useUpdateExam();
  const deleteMutation     = useDeleteExam();
  const bulkDeleteMutation = useBulkDeleteExams();
  const exportMutation     = useExportExams();

  const exams      = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleSort(col: keyof ExamListItem) {
    if (col === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleSelectAll() {
    if (exams.every((e) => selected.has(e.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exams.map((e) => e.id)));
    }
  }

  function handleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate(input: CreateExamInput | UpdateExamInput) {
    await createMutation.mutateAsync(input as CreateExamInput);
    showToast('New exam scheduled successfully');
  }

  async function handleEdit(input: CreateExamInput | UpdateExamInput) {
    await updateMutation.mutateAsync(input as UpdateExamInput);
    showToast('Exam schedule updated');
    setEditTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const ids = deleteTarget.map((e) => e.id);
    if (ids.length === 1 && ids[0]) {
      await deleteMutation.mutateAsync(ids[0]);
    } else if (ids.length > 1) {
      await bulkDeleteMutation.mutateAsync(ids);
    }
    setSelected(new Set());
    setDeleteTarget(null);
    showToast(`${ids.length} exam(s) cancelled`);
  }

  async function handleExport() {
    const ids = selected.size > 0 ? Array.from(selected) : undefined;
    const csv = await exportMutation.mutateAsync(ids);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'exams.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${ids?.length ?? totalItems} exam records`);
  }

  const deleteLoading = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Exams &amp; Assessments Console</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage schedules, test distribution, and grading status across cohorts</p>
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
        {/* Metric Cards (5 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Total Exams',        value: analytics?.totalExams        ?? '45',  trend: '+8%',  trendUp: true,  color: 'text-green-500' },
            { label: 'Upcoming Exams',     value: analytics?.upcomingExams     ?? '12',  trend: '-20%', trendUp: false, color: 'text-rose-500' },
            { label: 'Completed Exams',    value: analytics?.completedExams    ?? '28',  trend: '+5%',  trendUp: true,  color: 'text-green-500' },
            { label: 'Evaluation Pending', value: analytics?.evaluationPending ?? '18',  trend: '+12%', trendUp: true,  color: 'text-amber-500' },
            { label: 'Avg Pass Percentage',value: `${analytics?.avgPassPercentage ?? 78}%`, trend: '+6%', trendUp: true, color: 'text-blue-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
              <h3 className="text-xs font-medium text-gray-500">{stat.label}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                <span className={`text-[10px] font-bold ${stat.color} flex items-center`}>
                  {stat.trendUp ? '↑' : '↓'} {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Full-Width Controls Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2.5 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search exams by name or code..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={searchInput}
                onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
              />
            </div>

            <div className="relative">
              <select
                value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as any); setPage(1); }}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none"
              >
                <option value="">Exam Type: All</option>
                {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as any); setPage(1); }}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none"
              >
                <option value="">Status: All</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {selected.size > 0 && (
              <button
                onClick={() => setDeleteTarget(exams.filter((e) => selected.has(e.id)))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
              >
                Cancel ({selected.size})
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap"
            >
              {exportMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 text-gray-500" />}
              Export {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
            <button
              onClick={() => { setEditTarget(null); setCreateOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" /> Schedule Exam
            </button>
          </div>
        </div>

        {/* ── UPCOMING EXAMS TABLE CARD ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Upcoming &amp; Active Exams</h2>
                <p className="text-[11px] text-gray-500">Scheduled assessment timeline and candidate registrations</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              {totalItems} Scheduled Exams
            </span>
          </div>

          <ExamsTable
            exams={exams}
            loading={isLoading}
            selectedIds={selected}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            onSelectAll={handleSelectAll}
            onSelectOne={handleSelectOne}
            onView={(e) => { setSelectedExam(e); setActiveModal('examDetail'); setViewId(e.id); }}
            onEdit={(e) => { setEditTarget(e); setCreateOpen(true); }}
            onDelete={(e) => setDeleteTarget([e])}
          />

          {!isLoading && totalItems > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-slate-50/60 text-xs text-gray-500">
              <div className="flex items-center gap-3">
                <span>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of{' '}
                  <span className="font-bold text-gray-700">{totalItems}</span> exams
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value) as any); setPage(1); }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold ${
                      page === p ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── ANALYTICS CARDS (BELOW TABLE) ── */}
        <ExamsAnalyticsPanel
          onOpenPassRateReport={() => setActiveModal('passRateReport')}
          onOpenMeritList={() => setActiveModal('meritList')}
          onOpenAlerts={() => setActiveModal('alerts')}
        />
      </div>

      {/* Profile Drawer */}
      <ExamProfileDrawer
        examId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => {
          const e = exams.find((x) => x.id === id);
          if (e) { setEditTarget(e); setCreateOpen(true); setViewId(null); }
        }}
      />

      {/* Schedule / Edit Modal */}
      <CreateExamDialog
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        editTarget={editTarget}
        onSubmit={editTarget ? handleEdit : handleCreate}
      />

      {/* Delete / Cancel Dialog */}
      <DeleteExamDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        examNames={deleteTarget?.map((e) => e.name) ?? []}
        loading={deleteLoading}
      />

      {/* ── OVERLAP MODALS ── */}

      {/* 1. Exam Detail Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'examDetail' && !!selectedExam}
        onClose={() => { setActiveModal(null); setSelectedExam(null); }}
        title={`Exam Details: ${selectedExam?.name}`}
        subtitle={`Code: ${selectedExam?.code} • Batch: ${selectedExam?.batch}`}
        icon={FileText}
        badgeText={selectedExam?.type}
      >
        {selectedExam && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400 font-medium block">Scheduled Date</span>
                <span className="text-base font-bold text-slate-900">{selectedExam.date}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Duration</span>
                <span className="text-base font-bold text-slate-900">{selectedExam.duration}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Registered Candidates</span>
                <span className="text-base font-bold text-blue-600">{selectedExam.students} Students</span>
              </div>
            </div>
          </div>
        )}
      </AdminOverlapModal>

      {/* 2. Pass Rate Report Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'passRateReport'}
        onClose={() => setActiveModal(null)}
        title="Pass Rate & Performance Diagnostics Report"
        subtitle="Month-over-month pass percentage analysis"
        icon={TrendingUp}
        badgeText={`${analytics?.avgPassPercentage ?? 78}% Overall Pass Rate`}
      >
        <div className="space-y-3">
          {(analytics?.passPercentageTrend ?? [
            { month: 'Jan', passRate: 62 },
            { month: 'Feb', passRate: 65 },
            { month: 'Mar', passRate: 70 },
            { month: 'Apr', passRate: 74 },
            { month: 'May', passRate: 78 },
          ]).map((p, idx) => (
            <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-900">{p.month} 2025</span>
              <span className="text-xs font-bold text-blue-600">{p.passRate}% Pass Rate</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 3. Merit List Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'meritList'}
        onClose={() => setActiveModal(null)}
        title="Full Institute Student Merit List"
        subtitle="Ranked list of top performers across all recent exams"
        icon={Award}
        badgeText="Top Performers"
      >
        <div className="space-y-3">
          {(analytics?.topPerformers ?? [
            { rank: 1, name: 'Arjun Mehta', score: '92.6%' },
            { rank: 2, name: 'Riya Sharma', score: '91.2%' },
            { rank: 3, name: 'Karan Singh', score: '89.8%' },
          ]).map((s) => (
            <div key={s.rank} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">#{s.rank}</span>
                <span className="text-xs font-bold text-slate-900">{s.name}</span>
              </div>
              <span className="text-xs font-bold text-emerald-600">{s.score}</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 4. Operational Alerts Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'alerts'}
        onClose={() => setActiveModal(null)}
        title="Exam Operational Alerts Console"
        subtitle="Action items for invigilation, grading, and answer key uploads"
        icon={AlertTriangle}
        badgeText="Action Items"
        badgeColor="bg-amber-50 text-amber-600 border-amber-100"
      >
        <div className="space-y-3">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
            <div>
              <h4 className="text-xs font-bold text-slate-900">18 Evaluations Pending Grade Publish</h4>
              <p className="text-[11px] text-slate-500">Requires lead invigilator signature before publishing</p>
            </div>
            <button className="px-3 py-1 bg-blue-600 text-white font-bold text-xs rounded-lg">Publish Results</button>
          </div>
        </div>
      </AdminOverlapModal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
