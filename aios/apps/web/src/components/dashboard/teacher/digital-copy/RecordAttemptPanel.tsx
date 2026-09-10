'use client';
// ─── Structured attempt entry for OMR / MANUAL_GRID / CSV_IMPORT deliveries —
// closes the audit's "3 of 4 in-scope capture provider types have no UI path
// to ever create an Attempt" finding. POST /attempts is real and already
// tested; this is the missing UI in front of it. Same manual per-question
// marks-entry shape as v1's ExamGradingPanel, against a v2 AssessmentDelivery
// instead of a v1 Exam.

import { useEffect, useState } from 'react';
import { X, Loader2, Users, ListChecks } from 'lucide-react';
import { usePaper, useStudents, useCreateAttempt } from '@/hooks/useApi';

interface RecordAttemptPanelProps {
  deliveryId: string;
  batchId: string;
  paperId: string;
  captureProviderId: string;
  assessmentTitle?: string;
  onClose: () => void;
}

interface PaperItem { questionId: string; question: { id: string; content: string; marks: number } }
interface StudentRow { id: string; user: { name: string } }

export function RecordAttemptPanel({ deliveryId, batchId, paperId, captureProviderId, assessmentTitle, onClose }: RecordAttemptPanelProps) {
  const { data: paper, isPending: paperPending } = usePaper(paperId);
  const { data: studentsResp, isPending: studentsPending } = useStudents({ batchId, limit: 200 });
  const students: StudentRow[] = studentsResp?.data ?? [];
  const items: PaperItem[] = paper?.items ?? [];

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());
  const createAttempt = useCreateAttempt();

  useEffect(() => setMarks({}), [selectedStudentId]);

  const totalPossible = items.reduce((sum, i) => sum + i.question.marks, 0);
  const totalEntered = items.reduce((sum, i) => sum + (marks[i.questionId] ?? 0), 0);

  async function handleSave() {
    if (!selectedStudentId) return;
    await createAttempt.mutateAsync({
      assessmentDeliveryId: deliveryId,
      studentProfileId: selectedStudentId,
      captureProviderId,
      responses: items.map((i) => ({ questionId: i.questionId, marksAwarded: marks[i.questionId] ?? 0, isCorrect: (marks[i.questionId] ?? 0) >= i.question.marks })),
    });
    setRecordedIds((prev) => new Set(prev).add(selectedStudentId));
    setSelectedStudentId(null);
  }

  const loading = paperPending || studentsPending;
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm animate-fadein">
      <div className="flex-1 m-4 bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <ListChecks className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">Record Attempts</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{assessmentTitle ?? 'Structured-entry assessment'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] p-8 text-center">This paper has no questions.</div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 min-h-0 overflow-hidden">
            <div className="border-r border-slate-100 overflow-y-auto bg-slate-50/40">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-4 pb-2 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Students ({students.length})
              </p>
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStudentId(s.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100/70 transition-colors ${selectedStudentId === s.id ? 'bg-emerald-50' : 'hover:bg-white'}`}
                >
                  <span className="text-[12.5px] font-semibold text-slate-700 truncate">{s.user?.name ?? s.id}</span>
                  <span className={`text-[10px] font-bold flex-shrink-0 ${recordedIds.has(s.id) ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {recordedIds.has(s.id) ? 'Recorded' : 'Not yet'}
                  </span>
                </button>
              ))}
            </div>

            <div className="lg:col-span-2 overflow-y-auto">
              {!selectedStudentId ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">Select a student to record their attempt.</div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="p-4 space-y-4 flex-1">
                    <p className="text-[13px] font-bold text-slate-800">{selectedStudent?.user?.name ?? 'Unknown Student'}</p>
                    {items.map((item) => (
                      <div key={item.questionId} className="flex items-start gap-3 border border-slate-100 rounded-xl p-3">
                        <p className="flex-1 text-[12.5px] text-slate-700">{item.question.content}</p>
                        <div className="flex-shrink-0 flex items-center gap-1.5">
                          <input
                            type="number" min={0} max={item.question.marks} step="0.5"
                            value={marks[item.questionId] ?? 0}
                            onChange={(e) => setMarks((m) => ({ ...m, [item.questionId]: Number(e.target.value) }))}
                            className="w-16 px-2 py-1 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                          />
                          <span className="text-[11px] text-slate-400 w-10">/ {item.question.marks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
                    <p className="text-[12.5px] font-bold text-slate-700">Total: {totalEntered} / {totalPossible}</p>
                    <button
                      onClick={handleSave}
                      disabled={createAttempt.isPending}
                      className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white text-[13px] font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40"
                    >
                      {createAttempt.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save Attempt
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
