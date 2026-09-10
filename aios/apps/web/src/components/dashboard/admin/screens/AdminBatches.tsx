'use client';
// ─── AdminBatches — Batches & Cohorts ─────────────────────────────────────────
// Real CRUD + client-side search/filter/sort/pagination (the list endpoint has
// no server-side pagination — institute batch counts are small) + archive +
// CSV export. Every value flows through apps/api/src/batches.

import React, { useState, useDeferredValue } from 'react';
import {
  Plus, Search, Download, Trash2, RefreshCw,
  Layers, BarChart2, List, Filter, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useBatchesList, useCreateBatch, useUpdateBatch, useDeleteBatch, useBulkDeleteBatches, useBatchesStats } from '@/features/batches/hooks/useBatches';
import { useBatches as useAllBatchesRaw } from '@/hooks/useApi';
import { BatchesTable } from '@/features/batches/components/BatchesTable';
import { BatchProfileDrawer } from '@/features/batches/components/BatchProfileDrawer';
import { CreateBatchDialog } from '@/features/batches/components/CreateBatchDialog';
import { DeleteBatchDialog } from '@/features/batches/components/DeleteBatchDialog';
import { BatchesAnalyticsPanel } from '@/features/batches/components/BatchesAnalyticsPanel';

import type { BatchListItem, GetBatchesParams, SortDirection, BatchSortField, CreateBatchInput, UpdateBatchInput } from '@/features/batches/types/batch.types';

const PAGE_SIZES = [10, 20, 50] as const;

type MainTab = 'list' | 'analytics';

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-black text-slate-900">{value}</span></div>
    </div>
  );
}

function toCsv(batches: BatchListItem[]): string {
  const header = ['Name', 'Class Year', 'Section', 'Academic Year', 'Students', 'Teachers', 'Status'];
  const rows = batches.map((b) => [b.name, b.classYear ?? '', b.section ?? '', b.academicYear ?? '', String(b.studentCount), String(b.teacherCount), b.isActive ? 'Active' : 'Archived']);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function AdminBatches() {
  const [tab, setTab] = useState<MainTab>('list');
  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);

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
  const [deleteTarget, setDeleteTarget] = useState<BatchListItem[] | null>(null);

  const params: GetBatchesParams = {
    page, pageSize,
    search: deferredSearch || undefined,
    classYear: classYearFilter || undefined,
    isActive: statusFilter ? statusFilter === 'active' : undefined,
    sortBy, sortDir,
  };

  const { data, isPending, isFetching, refetch } = useBatchesList(params);
  const { data: stats } = useBatchesStats();
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

  function handleClearFilters() { setClassYearFilter(''); setStatusFilter(''); setSearchInput(''); setPage(1); }
  const activeFilters = [classYearFilter, statusFilter].filter(Boolean).length;

  function openEdit(b: BatchListItem) { setEditTarget(b); setCreateOpen(true); }
  const deleteLoading = deleteMutation.isPending || bulkDeleteMutation.isPending;

  return (
    <div className="flex flex-col min-h-full bg-[#f8fafc]">
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-3 max-w-[1700px] mx-auto">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Batches & Cohorts</h1>
            <p className="text-xs text-slate-500 mt-0.5">Manage cohorts, sections, and academic sessions</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => refetch()} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-colors" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-indigo-500' : ''}`} />
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> Export {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
            <button onClick={() => { setEditTarget(null); setCreateOpen(true); }} className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm shadow-indigo-200 transition-colors">
              <Plus className="w-4 h-4" /> Create Batch
            </button>
          </div>
        </div>

        <div className="flex gap-1 mt-4 max-w-[1700px] mx-auto">
          {(['list', 'analytics'] as MainTab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${tab === t ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
              {t === 'list' ? <List className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
              {t === 'list' ? 'Batch List' : 'Analytics'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 max-w-[1700px] mx-auto w-full space-y-5">
        {tab === 'analytics' ? (
          <BatchesAnalyticsPanel />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Total Batches" value={stats?.total ?? '—'} />
              <StatCard label="Active" value={stats?.active ?? '—'} />
              <StatCard label="Archived" value={stats?.inactive ?? '—'} />
              <StatCard label="Top Batch Size" value={stats?.byEnrollment?.[0]?.studentCount ?? '—'} />
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder="Search batch name, section…" className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white" value={searchInput} onChange={(e) => { setSearchInput(e.target.value); setPage(1); }} />
                  {searchInput && <button onClick={() => setSearchInput('')} className="absolute right-2.5 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" /></button>}
                </div>

                <button onClick={() => setShowFilter((v) => !v)} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${showFilter || activeFilters > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  <Filter className="w-3.5 h-3.5" /> Filters {activeFilters > 0 && <span className="bg-indigo-600 text-white rounded-full w-4 h-4 text-[9px] flex items-center justify-center">{activeFilters}</span>}
                </button>

                {selected.size > 0 && (
                  <button onClick={() => setDeleteTarget(batches.filter((b) => selected.has(b.id)))} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors ml-auto">
                    <Trash2 className="w-3.5 h-3.5" /> Archive ({selected.size})
                  </button>
                )}
              </div>

              {showFilter && (
                <div className="flex items-center gap-3 flex-wrap mt-3 pt-3 border-t border-slate-100">
                  <select value={classYearFilter} onChange={(e) => { setClassYearFilter(e.target.value); setPage(1); }} className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer">
                    <option value="">Class Year: All</option>
                    {classYears.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer">
                    <option value="">Status: All</option>
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                  {activeFilters > 0 && <button onClick={handleClearFilters} className="text-xs text-rose-500 font-bold hover:text-rose-700 flex items-center gap-1"><X className="w-3 h-3" /> Clear All</button>}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
              <BatchesTable
                batches={batches} loading={isPending} selectedIds={selected} sortBy={sortBy} sortDir={sortDir}
                onSort={handleSort} onSelectAll={handleSelectAll} onSelectOne={handleSelectOne}
                onView={(b) => setViewId(b.id)} onEdit={openEdit} onDelete={(b) => setDeleteTarget([b])}
              />

              {!isPending && totalItems > 0 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 bg-slate-50/60 text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of <span className="font-bold text-slate-700">{totalItems}</span> batches</span>
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) as any); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
                      {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / page</option>)}
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = i + 1;
                      return <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600'}`}>{p}</button>;
                    })}
                    <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BatchProfileDrawer
        batchId={viewId} onClose={() => setViewId(null)}
        onEdit={(id) => { const b = batches.find((x) => x.id === id); if (b) { openEdit(b); setViewId(null); } }}
      />

      <CreateBatchDialog isOpen={createOpen} onClose={() => { setCreateOpen(false); setEditTarget(null); }} editTarget={editTarget} onSubmit={editTarget ? handleEdit : handleCreate} />

      <DeleteBatchDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} batchNames={deleteTarget?.map((b) => b.name) ?? []} loading={deleteLoading} />
    </div>
  );
}
