'use client';

import { useState, useMemo } from 'react';
import { X, BookOpen, Send } from 'lucide-react';
import { useBatches, useStudents, useSubjects, useCreateAssignment } from '@/hooks/useApi';

interface CreateAssignmentModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  defaultBatchId?: string;
}

export function CreateAssignmentModal({ onClose, onSuccess, defaultBatchId }: CreateAssignmentModalProps) {
  const { data: batchesResp } = useBatches();
  const batches: any[] = batchesResp?.data ?? batchesResp ?? [];
  const { data: subjectsResp } = useSubjects();
  const subjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];
  const createAssignment = useCreateAssignment();

  const [batchId, setBatchId] = useState(defaultBatchId ?? '');
  const [topicId, setTopicId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: studentsResp } = useStudents(batchId ? { batchId, limit: 100 } : undefined);
  const studentCount = studentsResp?.meta?.total ?? 0;

  const topics = useMemo(
    () => subjects.flatMap((s: any) => (s.chapters ?? []).flatMap((c: any) => (c.topics ?? []).map((t: any) => ({ id: t.id, label: `${s.name} — ${c.name} — ${t.name}` })))),
    [subjects],
  );

  const isValid = !!batchId && !!topicId && !!title.trim() && !!dueDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const students = studentsResp?.data ?? [];
      if (students.length === 0) {
        setError('This batch has no enrolled students yet.');
        return;
      }

      // One real Assignment row per student — the schema's batchId-wide row
      // has only a single submissionUrl/gradedMarks, so it can't track each
      // student's submission independently. Creating one per student (the
      // same pattern the auto-generated weak-topic assignments already use)
      // is what actually gives each student their own real submission/grade.
      await Promise.all(
        students.map((s: any) =>
          createAssignment.mutateAsync({ batchId, studentProfileId: s.id, topicId, title: title.trim(), description: description.trim() || undefined, dueDate: new Date(dueDate).toISOString() }),
        ),
      );

      onSuccess?.();
      onClose();
    } catch (err) {
      setError('Failed to create assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-800">Create Assignment</h2>
              <p className="text-[12px] text-slate-500">Assigns to every student currently in the batch</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Target Batch *</label>
            <select required value={batchId} onChange={e => setBatchId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
              <option value="">Select a batch…</option>
              {batches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name} ({b._count?.students ?? 0} students)</option>
              ))}
            </select>
            {batchId && <p className="text-[11px] text-slate-400 mt-1">{studentCount} student{studentCount !== 1 ? 's' : ''} will receive this assignment.</p>}
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Topic *</label>
            <select required value={topicId} onChange={e => setTopicId(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30">
              <option value="">Select a topic…</option>
              {topics.map((t: any) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Assignment Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Rotational Motion Practice Set"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Instructions (Optional)</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Add instructions for students…"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Due Date *</label>
            <input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
          </div>

          {error && <p className="text-[12.5px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={!isValid || isSubmitting}
              className="flex-1 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-xs disabled:opacity-50 flex items-center justify-center gap-2">
              <Send className="w-4 h-4" /> {isSubmitting ? 'Publishing…' : 'Publish Assignment'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
