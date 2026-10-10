'use client';

import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  FileText,
} from 'lucide-react';
import {
  useSubjects,
  useCreateSubject,
  useUpdateSubject,
  useArchiveSubject,
} from '@/hooks/useApi';
import { ConfirmDialog } from '@/components/ui/foundation';

interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
  chapters?: Array<{ id: string; name: string }>;
  createdAt?: string;
}

export function AdminSubjectsView() {
  const { data: rawSubjects, isLoading } = useSubjects();
  const subjects: SubjectItem[] = useMemo(() => {
    return Array.isArray(rawSubjects) ? rawSubjects : (rawSubjects?.data ?? []);
  }, [rawSubjects]);

  const createMutation = useCreateSubject();
  const updateMutation = useUpdateSubject();
  const archiveMutation = useArchiveSubject();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SubjectItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SubjectItem | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formError, setFormError] = useState('');

  const openCreateModal = () => {
    setEditTarget(null);
    setFormName('');
    setFormCode('');
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (subject: SubjectItem) => {
    setEditTarget(subject);
    setFormName(subject.name);
    setFormCode(subject.code ?? '');
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Subject name is required');
      return;
    }

    try {
      if (editTarget) {
        await updateMutation.mutateAsync({
          id: editTarget.id,
          name: formName.trim(),
          code: formCode.trim() || undefined,
        });
      } else {
        await createMutation.mutateAsync({
          name: formName.trim(),
          code: formCode.trim() || undefined,
        });
      }
      setModalOpen(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  const handleArchive = async () => {
    if (!deleteTarget) return;
    try {
      await archiveMutation.mutateAsync({ id: deleteTarget.id });
      setDeleteTarget(null);
    } catch {
      // Handled by toast
    }
  };

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.code && s.code.toLowerCase().includes(q)),
    );
  }, [subjects, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── Top Bar / Action Bar ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <BookOpen className="w-4 h-4" />
            </span>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
              Institute Curriculum & Subjects
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure the academic disciplines taught at your institute. These subjects are directly available during teacher onboarding, exam blueprinting, and question bank tagging.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all cursor-pointer shrink-0 active:scale-95"
        >
          <Plus className="w-3.5 h-3.5" />
          Add New Subject
        </button>
      </div>

      {/* ── Search & Metrics Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/60">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subjects by name or code…"
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 font-semibold text-slate-700">
            {subjects.length} Total Subjects
          </span>
          {searchQuery && (
            <span className="text-[11px] text-slate-400">
              Showing {filteredSubjects.length} matches
            </span>
          )}
        </div>
      </div>

      {/* ── Subjects Grid ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-32 bg-slate-100 rounded-2xl animate-pulse border border-slate-200/50"
            />
          ))}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            {searchQuery ? 'No matching subjects found' : 'No subjects added yet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
            {searchQuery
              ? 'Try adjusting your search query or clear the filter.'
              : 'Add academic subjects like Physics, Mathematics, or Hindi so teachers can be assigned to them.'}
          </p>
          {!searchQuery && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add First Subject
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubjects.map((sub) => {
            const chapterCount = sub.chapters?.length ?? 0;
            return (
              <div
                key={sub.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100/70 border border-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                        {sub.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {sub.name}
                        </h4>
                        {sub.code ? (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 mt-0.5">
                            {sub.code}
                          </span>
                        ) : (
                          <span className="text-[10.5px] text-slate-400">
                            Standard Subject
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEditModal(sub)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Edit Subject"
                        aria-label={`Edit ${sub.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(sub)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Archive Subject"
                        aria-label={`Archive ${sub.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3 h-3 text-slate-400" />
                      {chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                      <CheckCircle2 className="w-2.5 h-2.5" /> Active
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-slate-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center shadow-sm shadow-emerald-200">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                    {editTarget ? 'Edit Subject' : 'Add New Subject'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {editTarget
                      ? `Editing ${editTarget.name}`
                      : 'Define subject name and optional code'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Subject Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => {
                    setFormName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  placeholder="e.g. Mathematics, Physics, Hindi, Computer Science"
                  required
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-800 placeholder-slate-400 transition-all"
                />
                {formError && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    {formError}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Subject Code (Optional)
                </label>
                <input
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="e.g. MATH-101, PHY-202"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-50/70 border border-slate-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 text-slate-800 placeholder-slate-400 transition-all uppercase"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Unique identifier used in report cards and curriculum exports.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm shadow-emerald-200 transition-all cursor-pointer disabled:opacity-60"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {editTarget ? 'Update Subject' : 'Create Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Archive Confirmation Dialog ─────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Archive Subject: ${deleteTarget?.name ?? ''}`}
        description="Are you sure you want to archive this subject? Existing exam scores and curriculum history will be preserved, but new tests cannot be created for archived subjects."
        confirmLabel="Archive Subject"
        variant="danger"
        isLoading={archiveMutation.isPending}
        onConfirm={handleArchive}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
