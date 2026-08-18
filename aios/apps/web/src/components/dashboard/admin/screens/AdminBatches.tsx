'use client';
// ─── AdminBatches — Enterprise Batches Module ─────────────────────────────────
// Full CRUD + Search + Filter + Sort + Pagination + Bulk Operations + Drawer + Analytics

import React, { useState, useCallback, useDeferredValue } from 'react';
import {
  Plus, Search, Download, Upload, Trash2, RefreshCw,
  Layers, BarChart2, List, Filter, X, ChevronLeft, ChevronRight,
  AlertTriangle, Loader2, Award, CalendarDays, Bell,
} from 'lucide-react';

import {
  useBatchesList,
  useCreateBatch,
  useUpdateBatch,
  useDeleteBatch,
  useBulkDeleteBatches,
  useExportBatches,
} from '@/features/batches/hooks/useBatches';
import { BatchesTable }          from '@/features/batches/components/BatchesTable';
import { BatchProfileDrawer }    from '@/features/batches/components/BatchProfileDrawer';
import { CreateBatchDialog }     from '@/features/batches/components/CreateBatchDialog';
import { DeleteBatchDialog }     from '@/features/batches/components/DeleteBatchDialog';
import { BatchesAnalyticsPanel } from '@/features/batches/components/BatchesAnalyticsPanel';

import type { BatchListItem, GetBatchesParams, SortDirection, CreateBatchInput, UpdateBatchInput, BatchProgram } from '@/features/batches/types/batch.types';

const PAGE_SIZES   = [10, 20, 50] as const;
const PROGRAMS: BatchProgram[] = ['JEE', 'NEET', 'Class 11', 'Class 12', 'Foundation'];
const TARGET_YEARS = ['2025', '2026', '2027', '2024-25'];

type MainTab = 'list' | 'analytics';

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

function StatCard({ label, value, sub, colorClass }: { label: string; value: string | number; sub?: string; colorClass: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900">{value}</span>
        {sub && <span className={`text-[11px] font-bold ${colorClass}`}>{sub}</span>}
      </div>
    </div>
  );
}

export function AdminBatches() {
  const [tab,          setTab]          = useState<MainTab>('list');
  const [searchInput,  setSearchInput]  = useState('');
  const deferredSearch                 = useDeferredValue(searchInput);

  // Filters
  const [programFilter,   setProgramFilter]   = useState<BatchProgram | ''>('');
  const [targetYearFilter,setTargetYearFilter]= useState('');
  const [showFilter,      setShowFilter]      = useState(false);

  // Table state
  const [page,     setPage]     = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy,   setSortBy]   = useState<keyof BatchListItem>('name');
  const [sortDir,  setSortDir]  = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Drawer & Dialog state
  const [viewId,       setViewId]       = useState<string | null>(null);
  const [editTarget,   setEditTarget]   = useState<BatchListItem | null>(null);
  const [createOpen,   setCreateOpen]   = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BatchListItem[] | null>(null);

  const { toast, show: showToast } = useToast();

  const params: GetBatchesParams = {
    page, pageSize,
    search:     deferredSearch,
    program:    programFilter    || undefined,
    targetYear: targetYearFilter || undefined,
    sortBy, sortDir,
  };

  const { data, isLoading, isFetching, refetch } = useBatchesList(params);
  const createMutation     = useCreateBatch();
  const updateMutation     = useUpdateBatch();
  const deleteMutation     = useDeleteBatch();
  const bulkDeleteMutation = useBulkDeleteBatches();
  const exportMutation     = useExportBatches();

  const batches    = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleSort(col: keyof BatchListItem) {
    if (col === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
    setPage(1);
  }

  function handleSelectAll() {
    if (batches.every((b) => selected.has(b.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(batches.map((b) => b.id)));
    }
  }

  function handleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate(input: CreateBatchInput | UpdateBatchInput) {
    await createMutation.mutateAsync(input as CreateBatchInput);
    showToast('New batch created successfully');
  }

  async function handleEdit(input: CreateBatchInput | UpdateBatchInput) {
    await updateMutation.mutateAsync(input as UpdateBatchInput);
    showToast('Batch parameters updated');
    setEditTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const ids = deleteTarget.map((b) => b.id);
    if (ids.length === 1 && ids[0]) {
      await deleteMutation.mutateAsync(ids[0]);
    } else if (ids.length > 1) {
      await bulkDeleteMutation.mutateAsync(ids);
    }
    setSelected(new Set());
    setDeleteTarget(null);
    showToast(`${ids.length} batch(es) archived`);
  }

  async function handleExport() {
    const ids = selected.size > 0 ? Array.from(selected) : undefined;
    const csv = await exportMutation.mutateAsync(ids);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'batches.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${ids?.length ?? totalItems} batch records`);
  }

  function handleClearFilters() {
    setProgramFilter(''); setTargetYearFilter('');
    setSearchInput(''); setPage(1);
  }

  const activeFilters = [programFilter, targetYearFilter].filter(Boolean).length;
  const deleteLoading = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <div className="flex flex-col min-h-full bg-[#f8fafc]">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-[1700px] mx-auto">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" /> Batches & Cohorts Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">Cohort allocation, mentor tracking, and syllabus progress</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={handleExport}
              disabled={exportMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {exportMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Export {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
            <button
              onClick={() => { setEditTarget(null); setCreateOpen(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm shadow-blue-200"
            >
              <Plus className="w-4 h-4" /> Create Batch
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mt-4 max-w-[1700px] mx-auto">
          {(['list', 'analytics'] as MainTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === t ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              {t === 'list' ? <List className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
              {t === 'list' ? 'Active Batches' : 'Cohort Analytics'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-6 max-w-[1700px] mx-auto w-full space-y-5">
        {tab === 'analytics' ? (
          <BatchesAnalyticsPanel />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total Batches"     value="48"    sub="↑6%"           colorClass="text-emerald-600" />
              <StatCard label="Active Cohorts"    value="42"    sub="87.5% active"  colorClass="text-blue-600" />
              <StatCard label="Avg Capacity Fill" value="88%"   sub="+3%"           colorClass="text-indigo-600" />
              <StatCard label="Upcoming Batches"  value="6"     sub="Next 30 days"  colorClass="text-purple-600" />
            </div>

            {/* Search + Filter */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search batch name, code, mentor…"
                    className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    value={searchInput}
                    onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
                  />
                  {searchInput && (
                    <button onClick={() => setSearchInput('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowFilter((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                    showFilter || activeFilters > 0
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Filters {activeFilters > 0 && <span className="bg-blue-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{activeFilters}</span>}
                </button>

                {selected.size > 0 && (
                  <button
                    onClick={() => setDeleteTarget(batches.filter((b) => selected.has(b.id)))}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Archive ({selected.size})
                  </button>
                )}
              </div>

              {showFilter && (
                <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100">
                  <select
                    value={programFilter} onChange={(e) => { setProgramFilter(e.target.value as any); setPage(1); }}
                    className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Program: All</option>
                    {PROGRAMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>

                  <select
                    value={targetYearFilter} onChange={(e) => { setTargetYearFilter(e.target.value); setPage(1); }}
                    className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">Target Year: All</option>
                    {TARGET_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>

                  {activeFilters > 0 && (
                    <button onClick={handleClearFilters} className="text-xs text-rose-500 font-bold flex items-center gap-1">
                      <X className="w-3 h-3" /> Clear All
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <BatchesTable
                batches={batches}
                loading={isLoading}
                selectedIds={selected}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                onSelectOne={handleSelectOne}
                onView={(b) => setViewId(b.id)}
                onEdit={(b) => { setEditTarget(b); setCreateOpen(true); }}
                onDelete={(b) => setDeleteTarget([b])}
              />

              {!isLoading && totalItems > 0 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>
                      {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of{' '}
                      <span className="font-bold text-slate-700">{totalItems}</span> batches
                    </span>
                    <select
                      value={pageSize}
                      onChange={(e) => { setPageSize(Number(e.target.value) as any); setPage(1); }}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
                    >
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
                      <button
                        key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-bold ${
                          page === p ? 'bg-blue-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Drawer */}
      <BatchProfileDrawer
        batchId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => {
          const b = batches.find((x) => x.id === id);
          if (b) { setEditTarget(b); setCreateOpen(true); setViewId(null); }
        }}
      />

      {/* Create / Edit Modal */}
      <CreateBatchDialog
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        editTarget={editTarget}
        onSubmit={editTarget ? handleEdit : handleCreate}
      />

      {/* Archive / Delete Confirmation */}
      <DeleteBatchDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        batchNames={deleteTarget?.map((b) => b.name) ?? []}
        loading={deleteLoading}
      />

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
