'use client';
// ─── QuestionBankManager — Question authoring, review, and approval ───────────
// Shared by Teacher (author/edit) and Admin (author/edit/approve/archive)
// dashboards. Real API from day one.

import { useState } from 'react';
import { Plus, Search, CheckCircle2, Archive, Pencil, BookOpen, Loader2, ClipboardList, X, HelpCircle } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useQuestions, useSubjects,
  useCreateQuestion, useUpdateQuestion, useApproveQuestion, useArchiveQuestion,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui/foundation';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
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
  EASY: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200/80',
  HARD: 'bg-rose-50 text-rose-700 border-rose-200/80',
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
    <div className="p-3.5 sm:p-5 md:p-6 space-y-4 sm:space-y-5 max-w-[1300px] mx-auto w-full min-w-0 animate-fadein">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100/90 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0 mt-0.5 sm:mt-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-[19px] sm:text-[22px] font-bold text-slate-900 tracking-tight">Question Bank</h2>
            <p className="text-[12px] sm:text-[13px] text-slate-500 mt-0.5 leading-snug">
              {canApprove ? 'Author, review, and approve questions for use in papers.' : 'Author questions for use in papers — an admin approves them before use.'}
            </p>
          </div>
        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-[13px] font-bold rounded-xl transition-all shadow-sm cursor-pointer whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> Add Question
        </button>
      </div>

      {/* Filter and Search Bar with AppleDropdown */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question content..."
            className="w-full pl-10 pr-9 py-2.5 text-[13px] bg-white border border-slate-200/90 rounded-2xl placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all shadow-2xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:gap-2.5">
          <div className="w-full sm:w-48">
            <AppleDropdown
              value={subjectFilter}
              onChange={(val) => { setSubjectFilter(val); setPage(1); }}
              options={[
                { value: '', label: 'All Subjects' },
                ...subjects.map((s: { id: string; name: string }) => ({ value: s.id, label: s.name })),
              ]}
              placeholder="All Subjects"
              searchable={subjects.length > 5}
            />
          </div>
          <div className="w-full sm:w-44">
            <AppleDropdown
              value={approvalFilter}
              onChange={(val) => { setApprovalFilter(val as '' | 'true' | 'false'); setPage(1); }}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'true', label: 'Approved', badge: 'Approved' },
                { value: 'false', label: 'Pending approval', badge: 'Pending' },
              ]}
              placeholder="All Statuses"
            />
          </div>
        </div>
      </div>

      {isPending && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3.5 bg-white border border-slate-200/80 rounded-xl text-slate-600 text-[13px]">
            <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="font-medium">Loading questions and syllabus topics from server...</span>
          </div>
          <SkeletonTable rows={6} cols={5} />
        </div>
      )}

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
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Mobile Native Question Cards (block sm:hidden) */}
          <div className="block sm:hidden divide-y divide-slate-100">
            {visibleQuestions.map((q) => (
              <div key={q.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                {/* Badges Row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {q.subject?.name && (
                      <span className="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100/80 text-[10.5px] font-bold text-indigo-700">
                        {q.subject.name}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-[10.5px] font-bold text-slate-600">
                      {q.type.replace(/_/g, ' ')}
                    </span>
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border ${DIFFICULTY_STYLE[q.difficulty]}`}>
                      {q.difficulty}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full ${q.isApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/70' : 'bg-slate-100 text-slate-500 border border-slate-200/70'}`}>
                    {q.isApproved ? 'Approved' : 'Pending'}
                  </span>
                </div>

                {/* Question Content */}
                <p className="text-[13.5px] font-semibold text-slate-800 leading-relaxed line-clamp-3 break-words">
                  {q.content}
                </p>

                {/* Metadata & Actions Footer */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <div className="text-[11.5px] text-slate-500 font-medium">
                    <span>{q.topic?.name ?? 'General Topic'}</span>
                    <span className="mx-1.5 text-slate-300">•</span>
                    <span className="font-bold text-slate-700">{q.marks} Mark{q.marks === 1 ? '' : 's'}</span>
                    {q.negativeMarks > 0 && <span className="text-rose-500 ml-1 font-bold">(-{q.negativeMarks})</span>}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setEditTarget(q); setFormOpen(true); }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-[11.5px] font-bold rounded-xl transition-colors cursor-pointer"
                      title="Edit question"
                    >
                      <Pencil className="w-3.5 h-3.5 text-slate-500" /> Edit
                    </button>
                    {RUBRIC_ELIGIBLE_TYPES.includes(q.type) && (
                      <button
                        type="button"
                        onClick={() => setRubricTarget(q)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 text-indigo-700 text-[11.5px] font-bold rounded-xl transition-colors cursor-pointer"
                        title="Rubric"
                      >
                        <ClipboardList className="w-3.5 h-3.5 text-indigo-600" /> Rubric
                      </button>
                    )}
                    {canApprove && !q.isApproved && (
                      <button
                        type="button"
                        onClick={() => approveQuestion.mutate(q.id)}
                        disabled={approveQuestion.isPending}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11.5px] font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-40"
                        title="Approve question"
                      >
                        {approveQuestion.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Approve
                      </button>
                    )}
                    {canApprove && (
                      <button
                        type="button"
                        onClick={() => setArchiveTarget(q)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Archive"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Question</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Topic</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Difficulty</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Marks</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visibleQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-[13px] text-slate-800 max-w-[320px] truncate" title={q.content}>
                      {q.content}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{q.topic?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-[11.5px] text-slate-600">{q.type.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${DIFFICULTY_STYLE[q.difficulty]}`}>
                        {q.difficulty}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 font-semibold">{q.marks}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border ${q.isApproved ? 'bg-emerald-50 text-emerald-700 border-emerald-200/70' : 'bg-slate-100 text-slate-500 border-slate-200/70'}`}>
                        {q.isApproved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditTarget(q); setFormOpen(true); }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          aria-label="Edit question"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {RUBRIC_ELIGIBLE_TYPES.includes(q.type) && (
                          <button
                            type="button"
                            onClick={() => setRubricTarget(q)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            aria-label="Rubric"
                            title="Rubric"
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canApprove && !q.isApproved && (
                          <button
                            type="button"
                            onClick={() => approveQuestion.mutate(q.id)}
                            disabled={approveQuestion.isPending}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40 cursor-pointer"
                            aria-label="Approve question"
                            title="Approve"
                          >
                            {approveQuestion.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {canApprove && (
                          <button
                            type="button"
                            onClick={() => setArchiveTarget(q)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
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
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-slate-50/50">
              <span className="text-[11.5px] text-slate-500 font-medium">
                Page {meta.page} of {meta.totalPages} · {meta.total} questions
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3.5 py-1.5 text-[11.5px] font-bold border border-slate-200 bg-white rounded-xl disabled:opacity-40 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-3.5 py-1.5 text-[11.5px] font-bold border border-slate-200 bg-white rounded-xl disabled:opacity-40 hover:bg-slate-50 active:scale-[0.98] transition-all cursor-pointer"
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
