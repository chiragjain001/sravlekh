'use client';
// ─── CurriculumManager — Subjects → Chapters → Topics ─────────────────────────
// The only place in the app that creates/edits the curriculum hierarchy other
// entities (Questions, Blueprints) depend on. Real API from day one — no mock
// layer to migrate later.

import { useState } from 'react';
import {
  Plus, ChevronRight, ChevronDown, Pencil, Archive, Check, X, BookOpen, Loader2,
} from 'lucide-react';
import {
  useSubjects,
  useCreateSubject, useUpdateSubject, useArchiveSubject,
  useCreateChapter, useUpdateChapter, useArchiveChapter,
  useCreateTopic, useUpdateTopic, useArchiveTopic,
} from '@/hooks/useApi';
import { SkeletonTable } from '@/components/ui/foundation';
import { EmptyState } from '@/components/ui/foundation';
import { ConfirmDialog } from '@/components/ui/foundation';

interface TopicItem { id: string; name: string; order: number }
interface ChapterItem { id: string; name: string; order: number; topics: TopicItem[] }
interface SubjectItem { id: string; name: string; code: string | null; chapters: ChapterItem[] }

type ArchiveTarget = { kind: 'subject' | 'chapter' | 'topic'; id: string; name: string } | null;

export function CurriculumManager() {
  // isPending, not isLoading — isLoading is false during the gap between retry
  // attempts (fetchStatus flips to 'paused'), which would fall through to the
  // empty state instead of the loading skeleton while a failing request retries.
  const { data: subjects, isPending, isError } = useSubjects();
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [addingSubject, setAddingSubject] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ArchiveTarget>(null);

  const createSubject = useCreateSubject();
  const archiveSubject = useArchiveSubject();
  const archiveChapter = useArchiveChapter();
  const archiveTopic = useArchiveTopic();

  function toggleSubject(id: string) {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleChapter(id: string) {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    const { kind, id } = archiveTarget;
    const mutation = kind === 'subject' ? archiveSubject : kind === 'chapter' ? archiveChapter : archiveTopic;
    mutation.mutate({ id }, { onSuccess: () => setArchiveTarget(null) });
  }

  if (isPending) {
    return (
      <div className="p-6">
        <SkeletonTable rows={4} cols={1} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="Couldn't load the curriculum"
          description="Something went wrong fetching subjects. Try refreshing the page."
        />
      </div>
    );
  }

  const subjectList: SubjectItem[] = subjects ?? [];

  return (
    <div className="p-6 space-y-4 max-w-[1100px] mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Curriculum</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Subjects, chapters, and topics — used across question authoring, blueprints, and mastery tracking.
          </p>
        </div>
        <button
          onClick={() => setAddingSubject(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-[12.5px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Subject
        </button>
      </div>

      {addingSubject && (
        <InlineCreateForm
          placeholder="Subject name (e.g. Physics)"
          isPending={createSubject.isPending}
          onCancel={() => setAddingSubject(false)}
          onSubmit={(name) =>
            createSubject.mutate({ name }, { onSuccess: () => setAddingSubject(false) })
          }
        />
      )}

      {subjectList.length === 0 && !addingSubject && (
        <EmptyState
          icon={<BookOpen className="w-6 h-6" />}
          title="No subjects yet"
          description="Add your institute's first subject to start building the curriculum."
          action={{ label: 'Add Subject', onClick: () => setAddingSubject(true) }}
        />
      )}

      <div className="space-y-2">
        {subjectList.map((subject) => (
          <SubjectRow
            key={subject.id}
            subject={subject}
            isExpanded={expandedSubjects.has(subject.id)}
            onToggle={() => toggleSubject(subject.id)}
            expandedChapters={expandedChapters}
            onToggleChapter={toggleChapter}
            onArchive={() => setArchiveTarget({ kind: 'subject', id: subject.id, name: subject.name })}
            onArchiveChapter={(ch) => setArchiveTarget({ kind: 'chapter', id: ch.id, name: ch.name })}
            onArchiveTopic={(t) => setArchiveTarget({ kind: 'topic', id: t.id, name: t.name })}
          />
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title={`Archive "${archiveTarget?.name}"?`}
        description="It will be hidden from lists everywhere, but any questions or mastery data already linked to it are kept — nothing is deleted."
        confirmLabel="Archive"
        variant="danger"
        isLoading={archiveSubject.isPending || archiveChapter.isPending || archiveTopic.isPending}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}

// ── Subject row ────────────────────────────────────────────────────────────

function SubjectRow({
  subject, isExpanded, onToggle, expandedChapters, onToggleChapter, onArchive, onArchiveChapter, onArchiveTopic,
}: {
  subject: SubjectItem;
  isExpanded: boolean;
  onToggle: () => void;
  expandedChapters: Set<string>;
  onToggleChapter: (id: string) => void;
  onArchive: () => void;
  onArchiveChapter: (chapter: ChapterItem) => void;
  onArchiveTopic: (topic: TopicItem) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [addingChapter, setAddingChapter] = useState(false);
  const updateSubject = useUpdateSubject();
  const createChapter = useCreateChapter();

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3">
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {isEditing ? (
          <InlineEditForm
            initialValue={subject.name}
            isPending={updateSubject.isPending}
            onCancel={() => setIsEditing(false)}
            onSubmit={(name) =>
              updateSubject.mutate({ id: subject.id, name }, { onSuccess: () => setIsEditing(false) })
            }
          />
        ) : (
          <>
            <span className="flex-1 text-[13.5px] font-bold text-slate-900">{subject.name}</span>
            {subject.code && (
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                {subject.code}
              </span>
            )}
            <span className="text-[11px] text-slate-400">{subject.chapters.length} chapters</span>
            <RowActions
              onAdd={() => setAddingChapter(true)}
              addLabel="Add chapter"
              onEdit={() => setIsEditing(true)}
              onArchive={onArchive}
            />
          </>
        )}
      </div>

      {isExpanded && (
        <div className="pl-9 pr-4 pb-3 space-y-1.5 border-t border-slate-50">
          {addingChapter && (
            <div className="pt-2">
              <InlineCreateForm
                placeholder="Chapter name (e.g. Kinematics)"
                isPending={createChapter.isPending}
                onCancel={() => setAddingChapter(false)}
                onSubmit={(name) =>
                  createChapter.mutate(
                    { subjectId: subject.id, name },
                    { onSuccess: () => setAddingChapter(false) },
                  )
                }
              />
            </div>
          )}
          {subject.chapters.length === 0 && !addingChapter && (
            <p className="text-[12px] text-slate-400 py-2">No chapters yet.</p>
          )}
          {subject.chapters.map((chapter) => (
            <ChapterRow
              key={chapter.id}
              chapter={chapter}
              isExpanded={expandedChapters.has(chapter.id)}
              onToggle={() => onToggleChapter(chapter.id)}
              onArchive={() => onArchiveChapter(chapter)}
              onArchiveTopic={onArchiveTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Chapter row ────────────────────────────────────────────────────────────

function ChapterRow({
  chapter, isExpanded, onToggle, onArchive, onArchiveTopic,
}: {
  chapter: ChapterItem;
  isExpanded: boolean;
  onToggle: () => void;
  onArchive: () => void;
  onArchiveTopic: (topic: TopicItem) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [addingTopic, setAddingTopic] = useState(false);
  const updateChapter = useUpdateChapter();
  const createTopic = useCreateTopic();

  return (
    <div className="rounded-lg bg-slate-50/60">
      <div className="flex items-center gap-2 px-2 py-2">
        <button onClick={onToggle} className="text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {isEditing ? (
          <InlineEditForm
            initialValue={chapter.name}
            isPending={updateChapter.isPending}
            onCancel={() => setIsEditing(false)}
            onSubmit={(name) =>
              updateChapter.mutate({ id: chapter.id, name }, { onSuccess: () => setIsEditing(false) })
            }
          />
        ) : (
          <>
            <span className="flex-1 text-[13px] font-semibold text-slate-700">{chapter.name}</span>
            <span className="text-[11px] text-slate-400">{chapter.topics.length} topics</span>
            <RowActions
              onAdd={() => setAddingTopic(true)}
              addLabel="Add topic"
              onEdit={() => setIsEditing(true)}
              onArchive={onArchive}
            />
          </>
        )}
      </div>

      {isExpanded && (
        <div className="pl-8 pr-2 pb-2 space-y-1">
          {addingTopic && (
            <InlineCreateForm
              placeholder="Topic name (e.g. Projectile Motion)"
              isPending={createTopic.isPending}
              onCancel={() => setAddingTopic(false)}
              onSubmit={(name) =>
                createTopic.mutate({ chapterId: chapter.id, name }, { onSuccess: () => setAddingTopic(false) })
              }
            />
          )}
          {chapter.topics.length === 0 && !addingTopic && (
            <p className="text-[11.5px] text-slate-400 py-1.5">No topics yet.</p>
          )}
          {chapter.topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} onArchive={() => onArchiveTopic(topic)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Topic row ──────────────────────────────────────────────────────────────

function TopicRow({ topic, onArchive }: { topic: TopicItem; onArchive: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const updateTopic = useUpdateTopic();

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-1">
        <InlineEditForm
          initialValue={topic.name}
          isPending={updateTopic.isPending}
          onCancel={() => setIsEditing(false)}
          onSubmit={(name) =>
            updateTopic.mutate({ id: topic.id, name }, { onSuccess: () => setIsEditing(false) })
          }
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1 group">
      <span className="flex-1 text-[12.5px] text-slate-600">{topic.name}</span>
      <button
        onClick={() => setIsEditing(true)}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 transition-opacity"
        aria-label="Edit topic"
      >
        <Pencil className="w-3 h-3" />
      </button>
      <button
        onClick={onArchive}
        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
        aria-label="Archive topic"
      >
        <Archive className="w-3 h-3" />
      </button>
    </div>
  );
}

// ── Shared bits ────────────────────────────────────────────────────────────

function RowActions({
  onAdd, addLabel, onEdit, onArchive,
}: { onAdd: () => void; addLabel: string; onEdit: () => void; onArchive: () => void }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={onAdd}
        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
        aria-label={addLabel}
        title={addLabel}
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onEdit}
        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
        aria-label="Edit"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onArchive}
        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
        aria-label="Archive"
      >
        <Archive className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function InlineCreateForm({
  placeholder, isPending, onSubmit, onCancel,
}: { placeholder: string; isPending: boolean; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className="flex items-center gap-2"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 text-[12.5px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
      />
      <button
        type="submit"
        disabled={!value.trim() || isPending}
        className="p-1.5 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button type="button" onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

function InlineEditForm({
  initialValue, isPending, onSubmit, onCancel,
}: { initialValue: string; isPending: boolean; onSubmit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initialValue);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim() && value.trim() !== initialValue) onSubmit(value.trim());
        else onCancel();
      }}
      className="flex-1 flex items-center gap-2"
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 px-3 py-1.5 text-[12.5px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
      />
      <button
        type="submit"
        disabled={isPending}
        className="p-1.5 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      </button>
      <button type="button" onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}
