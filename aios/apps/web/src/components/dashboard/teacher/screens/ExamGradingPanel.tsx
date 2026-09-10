'use client';
// ─── v1 Exam grading — closes the audit's Critical Risk 06: an Exam could be
// created and unlocked but nothing in the app could ever score it
// (createAnswerSheet/gradeAnswerSheet were real, tested, and completely
// unreachable). Per-student, per-question marks entry against the exam's
// linked (non-personalized) paper — mirrors exactly what
// ExamsService.gradeAnswerSheet expects.

import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, Users, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { useExam, usePaper, useStudents, useExamResults, useCreateAnswerSheet, useGradeAnswerSheet } from '@/hooks/useApi';

interface ExamGradingPanelProps {
  examId: string;
  batchId: string;
  onClose: () => void;
}

interface PaperItem { questionId: string; marks: number; question: { id: string; content: string; marks: number } }
interface StudentRow { id: string; rollNumber?: string | null; user: { name: string } }
interface GradedStudent { studentProfileId: string; obtainedMarks: number; totalMarks: number; isFinalized: boolean }

export function ExamGradingPanel({ examId, batchId, onClose }: ExamGradingPanelProps) {
  const { data: exam, isPending: examPending } = useExam(examId);
  const paperId: string | undefined = exam?.papers?.[0]?.id;
  const { data: paper, isPending: paperPending } = usePaper(paperId ?? null);
  const { data: studentsResp, isPending: studentsPending } = useStudents({ batchId, limit: 200 });
  const { data: results } = useExamResults(examId);

  const students: StudentRow[] = studentsResp?.data ?? [];
  const gradedByStudent = useMemo(() => {
    const map = new Map<string, GradedStudent>();
    for (const s of (results?.students ?? []) as GradedStudent[]) map.set(s.studentProfileId, s);
    return map;
  }, [results]);

  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [answerSheetId, setAnswerSheetId] = useState<string | null>(null);
  const [marks, setMarks] = useState<Record<string, number>>({});

  const createAnswerSheet = useCreateAnswerSheet();
  const gradeAnswerSheet = useGradeAnswerSheet();

  const items: PaperItem[] = paper?.items ?? [];
  const totalPossible = items.reduce((sum, i) => sum + i.question.marks, 0);
  const totalEntered = items.reduce((sum, i) => sum + (marks[i.questionId] ?? 0), 0);

  useEffect(() => {
    setAnswerSheetId(null);
    setMarks({});
  }, [selectedStudentId]);

  async function openStudent(studentId: string) {
    setSelectedStudentId(studentId);
    const sheet = await createAnswerSheet.mutateAsync({ examId, studentProfileId: studentId });
    setAnswerSheetId(sheet.id);
  }

  async function handleSaveGrades() {
    if (!answerSheetId) return;
    await gradeAnswerSheet.mutateAsync({
      answerSheetId,
      responses: items.map((i) => ({ questionId: i.questionId, marksAwarded: marks[i.questionId] ?? 0 })),
    });
    setSelectedStudentId(null);
  }

  const loading = examPending || paperPending || studentsPending;
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm animate-fadein">
      <div className="flex-1 m-4 bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">Grade Students</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{exam?.title ?? 'Exam'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : !paperId ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] p-8 text-center">
            No paper is linked to this exam yet — link one from Paper Builder before grading.
          </div>
        ) : items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px] p-8 text-center">
            This exam&apos;s paper has no questions.
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 min-h-0 overflow-hidden">
            {/* Left: student roster */}
            <div className="border-r border-slate-100 overflow-y-auto bg-slate-50/40">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 pt-4 pb-2 flex items-center gap-1.5">
                <Users className="w-3 h-3" /> Students ({students.length})
              </p>
              {students.map((s) => {
                const graded = gradedByStudent.get(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => openStudent(s.id)}
                    className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 border-b border-slate-100/70 transition-colors ${selectedStudentId === s.id ? 'bg-indigo-50' : 'hover:bg-white'}`}
                  >
                    <span className="text-[12.5px] font-semibold text-slate-700 truncate">{s.user?.name ?? s.id}</span>
                    {graded?.isFinalized ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3" /> {Math.round(graded.obtainedMarks)}/{Math.round(graded.totalMarks)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">Ungraded</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: grading form */}
            <div className="lg:col-span-2 overflow-y-auto">
              {!selectedStudentId ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">Select a student to grade.</div>
              ) : !answerSheetId ? (
                <div className="h-full flex items-center justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
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
                            className="w-16 px-2 py-1 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                          />
                          <span className="text-[11px] text-slate-400 w-10">/ {item.question.marks}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
                    <p className="text-[12.5px] font-bold text-slate-700">Total: {totalEntered} / {totalPossible}</p>
                    <button
                      onClick={handleSaveGrades}
                      disabled={gradeAnswerSheet.isPending}
                      className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40"
                    >
                      {gradeAnswerSheet.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Save &amp; Finalize
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
