'use client';
// ─── QuestionBankManager — Question authoring, review, and approval ───────────
// Shared by Teacher (author/edit) and Admin (author/edit/approve/archive)
// dashboards. Real API from day one.

import { useState } from 'react';
import { Plus, Search, CheckCircle2, Archive, Pencil, BookOpen, Loader2, ClipboardList } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useQuestions, useSubjects,
  useCreateQuestion, useUpdateQuestion, useApproveQuestion, useArchiveQuestion,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui/foundation';
import { QuestionFormDialog, type QuestionFormValue, type QuestionType, type DifficultyLevel, type QuestionOption } from './QuestionFormDialog';
import { RubricEditorDialog } from './RubricEditorDialog';

// 26-RUBRIC-EVALUATION-SPECIFICATION.md §2: rubrics only apply to these types — objective questions never require one.
const RUBRIC_ELIGIBLE_TYPES: QuestionType[] = ['SHORT_ANSWER', 'LONG_ANSWER', 'PASSAGE_BASED'];

interface QuestionListItem {
  id: string;
  type: QuestionType;
  difficulty: DifficultyLevel;
  marks: number;
  negativeMarks: number;
  content: string;
  options?: QuestionOption[] | null;
  solution?: string | null;
  sourceRef?: string | null;
  subjectId: string;
  chapterId: string;
  topicId: string;
  isApproved: boolean;
  subject?: { name: string };
  topic?: { name: string };
}

const DIFFICULTY_STYLE: Record<string, string> = {
  EASY: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HARD: 'bg-rose-50 text-rose-700',
};

export function QuestionBankManager() {
  const { user } = useAuth();
  const canApprove = user?.role === 'ADMIN' || user?.role === 'FOUNDER';

  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<QuestionListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<QuestionListItem | null>(null);
  const [rubricTarget, setRubricTarget] = useState<QuestionListItem | null>(null);

  const { data: subjectsData } = useSubjects();
  const subjects = subjectsData ?? [];

  const { data, isPending, isError } = useQuestions({
    page,
    limit: 20,
    ...(subjectFilter ? { subjectId: subjectFilter } : {}),
    ...(approvalFilter ? { isApproved: approvalFilter } : {}),
  });

  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const approveQuestion = useApproveQuestion();
  const archiveQuestion = useArchiveQuestion();

  const questions: QuestionListItem[] = data?.data ?? [];
  const meta = data?.meta as { total: number; page: number; limit: number; totalPages: number } | undefined;

  const visibleQuestions = search.trim()
    ? questions.filter((q) => q.content.toLowerCase().includes(search.trim().toLowerCase()))
    : questions;

  function handleSubmit(value: QuestionFormValue) {
    if (editTarget) {
      updateQuestion.mutate({ id: editTarget.id, ...value }, { onSuccess: () => closeForm() });
    } else {
      createQuestion.mutate(value, { onSuccess: () => closeForm() });
    }
  }
  function closeForm() {
    setFormOpen(false);
    setEditTarget(null);
  }
  function confirmArchive() {
    if (!archiveTarget) return;
    archiveQuestion.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) });
  }

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Question Bank</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {canApprove ? 'Author, review, and approve questions for use in papers.' : 'Author questions for use in papers — an admin approves them before use.'}
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Question
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question content..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="">All subjects</option>
          {subjects.map((s: { id: string; name: string }) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={approvalFilter}
          onChange={(e) => { setApprovalFilter(e.target.value as '' | 'true' | 'false'); setPage(1); }}
          className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="">All statuses</option>
          <option value="true">Approved</option>
          <option value="false">Pending approval</option>
        </select>
      </div>

      {isPending && <SkeletonTable rows={6} cols={5} />}

      {isError && (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="Couldn't load the question bank"
          description="Something went wrong fetching questions. Try refreshing the page."
        />
      )}

      {!isPending && !isError && visibleQuestions.length === 0 && (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No questions yet"
          description="Add your first question to start building the bank."
          action={{ label: 'Add Question', onClick: () => { setEditTarget(null); setFormOpen(true); } }}
        />
      )}

      {!isPending && !isError && visibleQuestions.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Question</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Topic</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Difficulty</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Marks</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleQuestions.map((q) => (
                <tr key={q.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-[12.5px] text-slate-800 max-w-[320px] truncate">{q.content}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{q.topic?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[11.5px] text-slate-600">{q.type.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${DIFFICULTY_STYLE[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-600">{q.marks}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${q.isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {q.isApproved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditTarget(q); setFormOpen(true); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                        aria-label="Edit question"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {RUBRIC_ELIGIBLE_TYPES.includes(q.type) && (
                        <button
                          onClick={() => setRubricTarget(q)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          aria-label="Rubric"
                          title="Rubric"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canApprove && !q.isApproved && (
                        <button
                          onClick={() => approveQuestion.mutate(q.id)}
                          disabled={approveQuestion.isPending}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors disabled:opacity-40"
                          aria-label="Approve question"
                          title="Approve"
                        >
                          {approveQuestion.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {canApprove && (
                        <button
                          onClick={() => setArchiveTarget(q)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          aria-label="Archive question"
                          title="Archive"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Page {meta.page} of {meta.totalPages} · {meta.total} questions
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-3 py-1.5 text-[11px] font-semibold border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <QuestionFormDialog
        isOpen={formOpen}
        onClose={closeForm}
        subjects={subjects}
        editTarget={editTarget}
        isPending={createQuestion.isPending || updateQuestion.isPending}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title="Archive this question?"
        description="It will be hidden from the bank and can no longer be added to new papers, but any papers or scores it's already part of are kept — nothing is deleted."
        confirmLabel="Archive"
        variant="danger"
        isLoading={archiveQuestion.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />

      {rubricTarget && (
        <RubricEditorDialog
          isOpen={!!rubricTarget}
          onClose={() => setRubricTarget(null)}
          questionId={rubricTarget.id}
          questionMarks={rubricTarget.marks}
          questionContent={rubricTarget.content}
        />
      )}
    </div>
  );
}
