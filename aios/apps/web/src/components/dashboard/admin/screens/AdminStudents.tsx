'use client';
// ─── AdminStudents — Students Roster ──────────────────────────────────────────
// Real CRUD + search/filter/sort/pagination + archive + CSV export.
// Every value flows through apps/api/src/students — no invented fields.

import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, Download, Trash2,
  Users, BarChart2, List, Filter, X, ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useStudentsList, useCreateStudent, useUpdateStudent, useDeleteStudent, useBulkDeleteStudents } from '@/features/students/hooks/useStudents';
import { useBatches } from '@/hooks/useApi';
import { StudentsTable } from '@/features/students/components/StudentsTable';
import { StudentProfileDrawer } from '@/features/students/components/StudentProfileDrawer';
import { CreateStudentDialog } from '@/features/students/components/CreateStudentDialog';
import { DeleteStudentDialog } from '@/features/students/components/DeleteStudentDialog';
import { BulkEnrollStudentsDialog } from '@/features/students/components/BulkEnrollStudentsDialog';
import { StudentsAnalyticsPanel } from '@/features/students/components/StudentsAnalyticsPanel';
import { STUDENT_TAG_VALUES } from '@/features/students/types/student.types';
import { AdminStudent360 } from '@/components/dashboard/admin/screens/AdminStudent360';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
import { TablePagination } from '@/components/ui/TablePagination';

import type { StudentListItem, GetStudentsParams, SortDirection, StudentSortField, CreateStudentInput, UpdateStudentInput, StudentAccountStatus } from '@/features/students/types/student.types';

const PAGE_SIZES = [10, 20, 50] as const;
const STATUS_OPTIONS: StudentAccountStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'];

type MainTab = 'list' | 'analytics';


function toCsv(students: StudentListItem[]): string {
  const header = ['Name', 'Email', 'Roll No', 'Batch', 'Status', 'Tags', 'Guardian', 'Guardian Phone', 'Admitted'];
  const rows = students.map((s) => [
    s.name, s.email, s.rollNumber ?? '', s.batchLabel, s.status, s.tags.join('; '),
    s.guardianName ?? '', s.guardianPhone ?? '', new Date(s.admissionDate).toLocaleDateString(),
  ]);
  return [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function AdminStudents() {
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

  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [sortBy, setSortBy] = useState<StudentSortField>('name');
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [viewId, setViewId] = useState<string | null>(null);
  const [view360Id, setView360Id] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<StudentListItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentListItem[] | null>(null);

  const { data: batchesResp } = useBatches();

  const params: GetStudentsParams = {
    page, pageSize,
    search: debouncedSearch || undefined,
    batchId: batchFilter || undefined,
    status: (statusFilter || undefined) as StudentAccountStatus | undefined,
    tags: tagFilter ? [tagFilter] : undefined,
    sortBy, sortDir,
  };

  const { data, isPending, isFetching, refetch } = useStudentsList(params);
  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const deleteMutation = useDeleteStudent();
  const bulkDeleteMutation = useBulkDeleteStudents();

  const students = data?.data ?? [];
  const totalItems = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleSort(col: StudentSortField) {
    if (col === sortBy) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  }

  function handleSelectAll() {
    if (students.every((s) => selected.has(s.id))) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.id)));
  }
  function handleSelectOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate(input: CreateStudentInput | UpdateStudentInput) {
    await createMutation.mutateAsync(input as CreateStudentInput);
  }

  async function handleEdit(input: CreateStudentInput | UpdateStudentInput) {
    await updateMutation.mutateAsync(input as UpdateStudentInput);
    setEditTarget(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    const ids = deleteTarget.map((s) => s.id);
    if (ids.length === 1 && ids[0]) await deleteMutation.mutateAsync(ids[0]);
    else if (ids.length > 1) await bulkDeleteMutation.mutateAsync(ids);
    setSelected(new Set());
    setDeleteTarget(null);
  }

  function handleExport() {
    const rows = selected.size > 0 ? students.filter((s) => selected.has(s.id)) : students;
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} student(s) from the current page`);
  }

  function handleClearFilters() {
    setBatchFilter(''); setStatusFilter(''); setTagFilter('');
    setSearchInput(''); setPage(1);
  }

  const activeFilters = [batchFilter, statusFilter, tagFilter].filter(Boolean).length;

  function openEdit(s: StudentListItem) {
    setEditTarget(s);
    setCreateOpen(true);
  }

  const deleteLoading = deleteMutation.isPending || bulkDeleteMutation.isPending;

  const batchOptions = [
    { value: '', label: 'All Batches' },
    ...((batchesResp?.data ?? batchesResp ?? []) as any[]).map((b: any) => ({
      value: String(b.id),
      label: String(b.name),
      sublabel: b.code || undefined,
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

  const tagOptions = [
    { value: '', label: 'All Tags' },
    ...STUDENT_TAG_VALUES.map((t) => ({
      value: t,
      label: t.replace(/-/g, ' '),
    })),
  ];



  return (
    <div className="flex flex-col min-h-full w-full bg-[#f8fafc]">
      <div className="px-3 sm:px-4 lg:px-6 pt-3.5 sm:pt-5 pb-3 sm:pb-4 w-full bg-white border-b border-slate-100">
        <div className="w-full max-w-[1700px] mx-auto space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs flex-shrink-0">
                  <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                </div>
                <span className="truncate">Students Directory</span>
              </h1>
              <p className="text-[11px] sm:text-[13px] text-slate-500 mt-0.5 ml-9 sm:ml-11.5">Manage enrollment, batches, and roster data</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center justify-center gap-1.5 sm:gap-2 h-9 sm:h-9.5 px-3 sm:px-4 text-xs sm:text-[13px] font-semibold text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100/80 border border-slate-200/90 rounded-xl shadow-2xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export</span>
                {selected.size > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 text-[10px] font-bold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200/60">
                    {selected.size}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setBulkImportOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-9.5 px-3 sm:px-4 text-xs sm:text-[13px] font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100/80 active:bg-indigo-200/60 border border-indigo-200/70 rounded-xl shadow-2xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
                title="Bulk enroll students via dynamic Excel template"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                <span className="whitespace-nowrap">Bulk Import</span>
              </button>
              <button
                type="button"
                onClick={() => { setEditTarget(null); setCreateOpen(true); }}
                className="inline-flex items-center justify-center gap-1.5 h-9 sm:h-9.5 px-3.5 sm:px-4.5 text-xs sm:text-[13px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 rounded-xl shadow-xs shadow-indigo-600/20 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-white" />
                <span className="whitespace-nowrap">Enroll Student</span>
              </button>
            </div>
          </div>

          <div className="w-full sm:w-auto inline-flex">
            <div
              role="tablist"
              aria-label="Student view selection"
              className="w-full sm:w-auto grid grid-cols-2 sm:inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200/60 shadow-2xs"
            >
              {(['list', 'analytics'] as MainTab[]).map((t) => {
                const isActive = tab === t;
                const Icon = t === 'list' ? List : BarChart2;
                const label = t === 'list' ? 'Student List' : 'Analytics';
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
                    <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
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
          <StudentsAnalyticsPanel />
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
                    placeholder="Search name, roll no, email…"
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
                    onClick={() => setDeleteTarget(students.filter((s) => selected.has(s.id)))}
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
                      <span>Filter Students</span>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <AppleDropdown
                      size="sm"
                      label="Batch"
                      value={batchFilter}
                      onChange={(val) => { setBatchFilter(val); setPage(1); }}
                      placeholder="All Batches"
                      searchable
                      options={batchOptions}
                    />
                    <AppleDropdown
                      size="sm"
                      label="Status"
                      value={statusFilter}
                      onChange={(val) => { setStatusFilter(val); setPage(1); }}
                      placeholder="All Statuses"
                      options={statusOptions}
                    />
                    <AppleDropdown
                      size="sm"
                      label="Tag"
                      value={tagFilter}
                      onChange={(val) => { setTagFilter(val); setPage(1); }}
                      placeholder="All Tags"
                      searchable
                      options={tagOptions}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={`bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden transition-opacity duration-200 ${isFetching ? 'opacity-85' : 'opacity-100'}`}>
              <StudentsTable
                students={students}
                loading={isPending}
                selectedIds={selected}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={handleSort}
                onSelectAll={handleSelectAll}
                onSelectOne={handleSelectOne}
                onView={(s) => setViewId(s.id)}
                onView360={(s) => setView360Id(s.id)}
                onEdit={openEdit}
                onDelete={(s) => setDeleteTarget([s])}
              />

              {!isPending && (
                <TablePagination
                  page={page}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPageSizeChange={(sz) => { setPageSize(sz as any); setPage(1); }}
                  itemLabel="students"
                  themeColor="indigo"
                />
              )}
            </div>
          </>
        )}
      </div>

      <StudentProfileDrawer
        studentId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(id) => {
          const s = students.find((x) => x.id === id);
          if (s) { openEdit(s); setViewId(null); }
        }}
      />

      {view360Id && (
        <AdminStudent360 studentId={view360Id} onClose={() => setView360Id(null)} />
      )}
      <CreateStudentDialog
        isOpen={createOpen}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        editTarget={editTarget}
        onSubmit={editTarget ? handleEdit : handleCreate}
      />

      <DeleteStudentDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        studentNames={deleteTarget?.map((s) => s.name) ?? []}
        loading={deleteLoading}
      />

      {bulkImportOpen && (
        <BulkEnrollStudentsDialog
          isOpen={bulkImportOpen}
          onClose={() => setBulkImportOpen(false)}
        />
      )}

    </div>
  );
}
