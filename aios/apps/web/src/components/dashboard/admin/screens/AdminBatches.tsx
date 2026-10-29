'use client';
// ─── AdminBatches — Batches & Cohorts ─────────────────────────────────────────
// Real CRUD + client-side search/filter/sort/pagination (the list endpoint has
// no server-side pagination — institute batch counts are small) + archive +
// CSV export. Every value flows through apps/api/src/batches.

import React, { useState, useEffect } from 'react';
import {
  Plus, Search, Download, Trash2, RefreshCw,
  Layers, BarChart2, List, Filter, X, SlidersHorizontal, BookOpen,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useBatchesList, useCreateBatch, useUpdateBatch, useDeleteBatch, useBulkDeleteBatches } from '@/features/batches/hooks/useBatches';
import { useBatches as useAllBatchesRaw } from '@/hooks/useApi';
import { BatchesTable } from '@/features/batches/components/BatchesTable';
import { BatchProfileDrawer } from '@/features/batches/components/BatchProfileDrawer';
import { CreateBatchDialog } from '@/features/batches/components/CreateBatchDialog';
import { DeleteBatchDialog } from '@/features/batches/components/DeleteBatchDialog';
import { BulkImportBatchesDialog } from '@/features/batches/components/BulkImportBatchesDialog';
import { BatchesAnalyticsPanel } from '@/features/batches/components/BatchesAnalyticsPanel';
import { AdminSubjectsView } from '@/components/dashboard/admin/curriculum/AdminSubjectsView';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
import { TablePagination } from '@/components/ui/TablePagination';

import type { BatchListItem, GetBatchesParams, SortDirection, BatchSortField, CreateBatchInput, UpdateBatchInput } from '@/features/batches/types/batch.types';

type MainTab = 'list' | 'curriculum' | 'analytics';

function toCsv(batches: BatchListItem[]): string {
  const header = ['Name', 'Class Year', 'Section', 'Academic Year', 'Students', 'Teachers', 'Status'];
  const rows = batches.map((b) => [b.name, b.classYear ?? '', b.section ?? '', b.academicYear ?? '', String(b.studentCount), String(b.teacherCount), b.isActive ? 'Active' : 'Archived']);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function AdminBatches() {
  const [tab, setTab] = useState<MainTab>('list');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // 280ms debounce so user typing is instant locally and avoids multi-request network lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 280);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [classYearFilter, setClassYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<BatchSortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [viewId, setViewId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<BatchListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BatchListItem[] | null>(null);

  const params: GetBatchesParams = {
    page, pageSize,
    search: debouncedSearch || undefined,
    classYear: classYearFilter || undefined,
    isActive: statusFilter ? statusFilter === 'active' : undefined,
    sortBy, sortDir,
  };

  const { data, isPending, isFetching } = useBatchesList(params);
  const createMutation = useCreateBatch();
  const updateMutation = useUpdateBatch();
  const deleteMutation = useDeleteBatch();
  const bulkDeleteMutation = useBulkDeleteBatches();

  const batches = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Class Year filter options must come from the full institute batch list,
  // not the current page — otherwise the dropdown's own contents shift
  // depending on which page happens to be showing (audit-flagged Medium bug).
  const { data: allBatchesResp } = useAllBatchesRaw();
  const allBatches: { classYear?: string }[] = allBatchesResp?.data ?? allBatchesResp ?? [];
  const classYears = Array.from(new Set(allBatches.map((b) => b.classYear).filter(Boolean))) as string[];

  const classYearOptions = [
    { value: '', label: 'All Class Years' },
    ...classYears.map((c) => ({ value: c, label: `Class ${c}` })),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'active', label: 'Active', badge: 'Active' },
    { value: 'archived', label: 'Archived', badge: 'Archived' },
  ];

  function handleSort(col: BatchSortField) {
    if (col === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  function handleSelectAll() {
    if (batches.every((b) => selected.has(b.id))) setSelected(new Set());
    else setSelected(new Set(batches.map((b) => b.id)));
  }
  function handleSelectOne(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleCreate(input: CreateBatchInput | UpdateBatchInput) {
    await createMutation.mutateAsync(input as CreateBatchInput);
  }
  async function handleEdit(input: CreateBatchInput | UpdateBatchInput) {
    await updateMutation.mutateAsync(input as UpdateBatchInput);
    setEditTarget(null);
  }
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const ids = deleteTarget.map((b) => b.id);
    if (ids.length === 1 && ids[0]) await deleteMutation.mutateAsync(ids[0]);
    else if (ids.length > 1) await bulkDeleteMutation.mutateAsync(ids);
    setSelected(new Set());
    setDeleteTarget(null);
  }

  function handleExport() {
    const rows = selected.size > 0 ? batches.filter((b) => selected.has(b.id)) : batches;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'batches.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} batch(es) from the current page`);
  }

  function handleClearFilters() {
    setClassYearFilter('');
    setStatusFilter('');
    setSearchInput('');
    setDebouncedSearch('');
    setPage(1);
  }
  const activeFilters = [classYearFilter, statusFilter].filter(Boolean).length;

  function openEdit(b: BatchListItem) { setEditTarget(b); setCreateOpen(true); }
  const deleteLoading = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <div className="flex flex-col min-h-full w-full bg-[#f8fafc]">
      <div className="px-3 sm:px-4 lg:px-6 pt-3.5 sm:pt-5 pb-3 sm:pb-4 w-full bg-white border-b border-slate-100">
        <div className="w-full max-w-[1700px] mx-auto space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs flex-shrink-0">
                  <Layers className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <span className="truncate">Batches &amp; Cohorts</span>
              </h1>
              <p className="text-[11px] sm:text-[13px] text-slate-500 mt-0.5 ml-9 sm:ml-11.5">Manage cohorts, sections, and academic sessions</p>
            </div>

            {tab === 'list' && (
              <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 sm:h-9.5 px-3 sm:px-4 text-xs sm:text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100/80 border border-slate-200/90 rounded-xl shadow-2xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
                  <span>Export {selected.size > 0 ? `(${selected.size})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBulkImportOpen(true)}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-9 sm:h-9.5 px-3 sm:px-4 text-xs sm:text-[13px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/80 active:bg-indigo-200/60 border border-indigo-200/70 rounded-xl shadow-2xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
                  title="Bulk setup batches via dynamic Excel template"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                  <span className="whitespace-nowrap">Bulk Import</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setEditTarget(null); setCreateOpen(true); }}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-9.5 px-4 sm:px-5 text-xs sm:text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl shadow-xs shadow-indigo-500/20 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Batch</span>
                </button>
              </div>
            )}
          </div>

          {/* iOS-Style Segmented Navigation Tabs */}
          <div className="w-full sm:w-auto inline-flex">
            <div
              role="tablist"
              aria-label="Batch view selection"
              className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-2xs"
            >
              {(['list', 'curriculum', 'analytics'] as MainTab[]).map((t) => {
                const isActive = tab === t;
                const Icon = t === 'list' ? List : t === 'curriculum' ? BookOpen : BarChart2;
                const label = t === 'list' ? 'Batch List' : t === 'curriculum' ? 'Subjects & Curriculum' : 'Analytics';
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(t)}
                    className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-[12.5px] font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.98] ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs ring-1 ring-black/[0.04]'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? (t === 'curriculum' ? 'text-emerald-600' : 'text-indigo-600') : 'text-slate-400'}`} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-2.5 sm:px-4 lg:px-6 py-3 sm:py-5 w-full max-w-[1700px] mx-auto space-y-3 sm:space-y-4">
        {tab === 'analytics' ? (
          <BatchesAnalyticsPanel />
        ) : tab === 'curriculum' ? (
          <AdminSubjectsView />
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-3 md:p-3.5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 min-w-[160px]">
                  {isFetching ? (
                    <RefreshCw className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-500 animate-spin pointer-events-none" />
                  ) : (
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  )}
                  <input
                    type="text"
                    placeholder="Search batch name, section…"
                    className="w-full pl-10 pr-8 h-9 text-xs md:text-sm bg-slate-50/80 hover:bg-slate-100/60 focus:bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 placeholder:text-slate-400"
                    value={searchInput}
                    onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => { setSearchInput(''); setDebouncedSearch(''); setPage(1); }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowFilter((v) => !v)}
                  className={`h-9 px-3.5 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl border transition-all flex-shrink-0 cursor-pointer ${
                    showFilter || activeFilters > 0
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeFilters > 0 && (
                    <span className="bg-indigo-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                      {activeFilters}
                    </span>
                  )}
                </button>

                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(batches.filter((b) => selected.has(b.id)))}
                    className="h-9 flex items-center justify-center gap-1.5 px-3.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-all cursor-pointer flex-shrink-0 ml-auto sm:ml-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Archive ({selected.size})
                  </button>
                )}
              </div>

              {showFilter && (
                <div className="pt-3 border-t border-slate-100 space-y-2.5 animate-fadein">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Filter Batches</span>
                      {activeFilters > 0 && (
                        <span className="text-[11px] font-medium text-slate-400">({activeFilters} active)</span>
                      )}
                    </div>
                    {activeFilters > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        className="text-xs text-rose-600 font-bold hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <X className="w-3 h-3" /> Reset Filters
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    <AppleDropdown
                      label="Class Year"
                      placeholder="All Class Years"
                      size="sm"
                      themeColor="indigo"
                      value={classYearFilter}
                      onChange={(val) => { setClassYearFilter(val); setPage(1); }}
                      options={classYearOptions}
                      searchable={classYears.length > 5}
                    />

                    <AppleDropdown
                      label="Account Status"
                      placeholder="All Statuses"
                      size="sm"
                      themeColor="indigo"
                      value={statusFilter}
                      onChange={(val) => { setStatusFilter(val); setPage(1); }}
                      options={statusOptions}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-opacity duration-200 ${isFetching ? 'opacity-85' : 'opacity-100'}`}>
              <BatchesTable
                batches={batches}
                loading={isPending}
                selectedIds={selected}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                onSelectOne={handleSelectOne}
                onView={(b) => setViewId(b.id)}
                onEdit={openEdit}
                onDelete={(b) => setDeleteTarget([b])}
              />

              {!isPending && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(sz) => { setPageSize(sz as any); setPage(1); }}
                  itemLabel="batches"
                  themeColor="indigo"
                />
              )}
            </div>
          </>
        )}
      </div>

      <BatchProfileDrawer
        batchId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => { const b = batches.find((x) => x.id === id); if (b) { openEdit(b); setViewId(null); } }}
      />

      <CreateBatchDialog
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        editTarget={editTarget}
        onSubmit={editTarget ? handleEdit : handleCreate}
      />

      <BulkImportBatchesDialog
        isOpen={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
      />

      <DeleteBatchDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        batchNames={deleteTarget?.map((b) => b.name) ?? []}
        loading={deleteLoading}
      />
    </div>
  );
}
