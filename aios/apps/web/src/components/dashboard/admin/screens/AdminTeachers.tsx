'use client';
// ─── AdminTeachers — Faculty Roster ───────────────────────────────────────────
// Real CRUD + search/filter/sort/pagination + archive + CSV export + batch
// assignment. Every value flows through apps/api/src/teachers.

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Download, Trash2,
  Users, BarChart2, List, Filter, X, ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useTeachersList, useCreateTeacher, useUpdateTeacher, useDeleteTeacher, useBulkDeleteTeachers } from '@/features/teachers/hooks/useTeachers';
import { useSubjects } from '@/hooks/useApi';
import { TeachersTable } from '@/features/teachers/components/TeachersTable';
import { TeacherProfileDrawer } from '@/features/teachers/components/TeacherProfileDrawer';
import { CreateTeacherDialog } from '@/features/teachers/components/CreateTeacherDialog';
import { DeleteTeacherDialog } from '@/features/teachers/components/DeleteTeacherDialog';
import { TeachersAnalyticsPanel } from '@/features/teachers/components/TeachersAnalyticsPanel';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
import { TablePagination } from '@/components/ui/TablePagination';

import type { TeacherListItem, GetTeachersParams, SortDirection, TeacherSortField, CreateTeacherInput, UpdateTeacherInput, TeacherAccountStatus } from '@/features/teachers/types/teacher.types';

const PAGE_SIZES = [10, 20, 50] as const;
const STATUS_OPTIONS: TeacherAccountStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'];

type MainTab = 'list' | 'analytics';


function toCsv(teachers: TeacherListItem[]): string {
  const header = ['Name', 'Email', 'Qualification', 'Subjects', 'Batches', 'Status', 'Joined'];
  const rows = teachers.map((t) => [
    t.name, t.email, t.qualification ?? '', String(t.subjectIds.length), t.batchAssignments.map((a) => a.batchName).join('; '),
    t.status, new Date(t.joinedOn).toLocaleDateString(),
  ]);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function AdminTeachers() {
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

  const [subjectFilter, setSubjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<TeacherSortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [viewId, setViewId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<TeacherListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeacherListItem[] | null>(null);

  const { data: subjectsData } = useSubjects();
  const subjects: { id: string; name: string }[] = subjectsData?.data ?? subjectsData ?? [];

  const params: GetTeachersParams = {
    page, pageSize,
    search: debouncedSearch || undefined,
    subjectId: subjectFilter || undefined,
    status: (statusFilter || undefined) as TeacherAccountStatus | undefined,
    sortBy, sortDir,
  };

  const { data, isPending, isFetching, refetch } = useTeachersList(params);
  const createMutation = useCreateTeacher();
  const updateMutation = useUpdateTeacher();
  const deleteMutation = useDeleteTeacher();
  const bulkDeleteMutation = useBulkDeleteTeachers();

  const teachers = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleSort(col: TeacherSortField) {
    if (col === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  function handleSelectAll() {
    if (teachers.every((t) => selected.has(t.id))) setSelected(new Set());
    else setSelected(new Set(teachers.map((t) => t.id)));
  }
  function handleSelectOne(id: string) {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleCreate(input: CreateTeacherInput | UpdateTeacherInput) {
    await createMutation.mutateAsync(input as CreateTeacherInput);
  }
  async function handleEdit(input: CreateTeacherInput | UpdateTeacherInput) {
    await updateMutation.mutateAsync(input as UpdateTeacherInput);
    setEditTarget(null);
  }
  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const ids = deleteTarget.map((t) => t.id);
    if (ids.length === 1 && ids[0]) await deleteMutation.mutateAsync(ids[0]);
    else if (ids.length > 1) await bulkDeleteMutation.mutateAsync(ids);
    setSelected(new Set());
    setDeleteTarget(null);
  }

  function handleExport() {
    const rows = selected.size > 0 ? teachers.filter((t) => selected.has(t.id)) : teachers;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'teachers.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} teacher(s) from the current page`);
  }

  function handleClearFilters() { setSubjectFilter(''); setStatusFilter(''); setSearchInput(''); setPage(1); }
  const activeFilters = [subjectFilter, statusFilter].filter(Boolean).length;

  function openEdit(t: TeacherListItem) { setEditTarget(t); setCreateOpen(true); }
  const deleteLoading = deleteMutation.isPending || bulkDeleteMutation.isPending;

  const subjectOptions = [
    { value: '', label: 'All Subjects' },
    ...subjects.map((s) => ({
      value: s.id,
      label: s.name,
      sublabel: (s as any).code ?? undefined,
    })),
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    ...STATUS_OPTIONS.map((s) => ({
      value: s,
      label: s.charAt(0) + s.slice(1).toLowerCase(),
      badge: s === 'ACTIVE' ? 'Active' : s === 'INACTIVE' ? 'Inactive' : undefined,
    })),
  ];



  return (
    <div className="flex flex-col min-h-full w-full bg-[#f8fafc]">
      <div className="px-3 sm:px-4 lg:px-6 pt-3.5 sm:pt-5 pb-3 sm:pb-4 w-full bg-white border-b border-slate-100">
        <div className="w-full max-w-[1700px] mx-auto space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shadow-2xs flex-shrink-0">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <span className="truncate">Faculty Directory</span>
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-1 ml-10.5 sm:ml-11.5">Manage teachers, subjects, and batch assignments</p>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-2 h-9 sm:h-9.5 px-3.5 sm:px-4 text-xs sm:text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100/80 border border-slate-200/90 rounded-xl shadow-2xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export</span>
                {selected.size > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 text-[10px] font-bold rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200/60">
                    {selected.size}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { setEditTarget(null); setCreateOpen(true); }}
                className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-9.5 px-4 sm:px-4.5 text-xs sm:text-[13px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 rounded-xl shadow-xs shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span className="whitespace-nowrap">Add Teacher</span>
              </button>
            </div>
          </div>

          <div className="w-full sm:w-auto inline-flex">
            <div
              role="tablist"
              aria-label="Faculty view selection"
              className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-2xs"
            >
              {(['list', 'analytics'] as MainTab[]).map((t) => {
                const isActive = tab === t;
                const Icon = t === 'list' ? List : BarChart2;
                const label = t === 'list' ? 'Faculty List' : 'Analytics';
                return (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTab(t)}
                    className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-[12.5px] font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.98] ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-xs ring-1 ring-black/[0.04]'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-white/40'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
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
          <TeachersAnalyticsPanel />
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-3 md:p-3.5 space-y-3">
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 min-w-[160px]">
                  {isFetching ? (
                    <RefreshCw className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 animate-spin pointer-events-none" />
                  ) : (
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  )}
                  <input
                    type="text"
                    placeholder="Search name, email…"
                    className="w-full pl-10 pr-8 h-9 text-xs md:text-sm bg-slate-50/80 hover:bg-slate-100/60 focus:bg-white border border-slate-200/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder:text-slate-400"
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
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {activeFilters > 0 && (
                    <span className="bg-emerald-600 text-white rounded-full w-4 h-4 text-[10px] flex items-center justify-center font-bold">
                      {activeFilters}
                    </span>
                  )}
                </button>

                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(teachers.filter((t) => selected.has(t.id)))}
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
                      <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Filter Faculty</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <AppleDropdown
                      size="sm"
                      themeColor="emerald"
                      label="Subject"
                      value={subjectFilter}
                      onChange={(val) => { setSubjectFilter(val); setPage(1); }}
                      placeholder="All Subjects"
                      searchable
                      options={subjectOptions}
                    />
                    <AppleDropdown
                      size="sm"
                      themeColor="emerald"
                      label="Status"
                      value={statusFilter}
                      onChange={(val) => { setStatusFilter(val); setPage(1); }}
                      placeholder="All Statuses"
                      options={statusOptions}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-opacity duration-200 ${isFetching ? 'opacity-85' : 'opacity-100'}`}>
              <TeachersTable
                teachers={teachers} loading={isPending} selectedIds={selected} sortBy={sortBy} sortDir={sortDir}
                onSort={handleSort} onSelectAll={handleSelectAll} onSelectOne={handleSelectOne}
                onView={(t) => setViewId(t.id)} onEdit={openEdit} onDelete={(t) => setDeleteTarget([t])}
              />

              {!isPending && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(sz) => { setPageSize(sz as any); setPage(1); }}
                  itemLabel="teachers"
                  themeColor="emerald"
                />
              )}
            </div>
          </>
        )}
      </div>

      <TeacherProfileDrawer
        teacherId={viewId} onClose={() => setViewId(null)}
        onEdit={(id) => { const t = teachers.find((x) => x.id === id); if (t) { openEdit(t); setViewId(null); } }}
      />

      <CreateTeacherDialog isOpen={createOpen} onClose={() => { setCreateOpen(false); setEditTarget(null); }} editTarget={editTarget} onSubmit={editTarget ? handleEdit : handleCreate} />

      <DeleteTeacherDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} teacherNames={deleteTarget?.map((t) => t.name) ?? []} loading={deleteLoading} />
    </div>
  );
}
