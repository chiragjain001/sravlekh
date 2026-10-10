'use client';

import React, { useState } from 'react';
import {
  Send,
  Save,
  CheckCircle2,
  Printer,
  Sparkles,
  Award,
  Users,
  Clock,
  Globe,
  Radio,
  BookOpen,
  Calendar,
  Search,
  Building2,
  FileCheck,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { AssessmentState } from '../AssessmentSummaryPanel';
import { usePaper, useExams, useSubmitCandidatePaper } from '@/hooks/useApi';
import { PrintableQuestionPaper } from '../../shared/PrintableQuestionPaper';

interface Step8GenerateProps {
  state: AssessmentState;
  reviewPaperId: string | null;
  onPrev: () => void;
  onPublishSuccess: () => void;
  onPublish: () => Promise<void>;
  isPublishing: boolean;
  publishError: string | null;
  onSaveDraft: () => void;
  isSavingDraft: boolean;
}

export function Step8Generate({
  state,
  reviewPaperId,
  onPrev,
  onPublishSuccess,
  onPublish,
  isPublishing,
  publishError,
  onSaveDraft,
  isSavingDraft,
}: Step8GenerateProps) {
  const [published, setPublished] = useState(false);
  const [submittedCandidate, setSubmittedCandidate] = useState(false);
  const [submissionTarget, setSubmissionTarget] = useState<'direct' | 'official_exam'>(
    state.type === 'School Examination' ? 'official_exam' : 'direct',
  );
  const [publishMode, setPublishMode] = useState<'online' | 'live' | 'offline'>('online');
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [examSearch, setExamSearch] = useState('');
  const [candidateSubmitError, setCandidateSubmitError] = useState<string | null>(null);

  const { data: paperDetail } = usePaper(reviewPaperId || '');
  const { data: examsResp, isLoading: isExamsLoading } = useExams();
  const exams: any[] = React.useMemo(() => examsResp?.data ?? examsResp ?? [], [examsResp]);
  const submitCandidatePaper = useSubmitCandidatePaper();

  // Active / eligible exams for candidate paper submission
  const eligibleExams = React.useMemo(() => {
    return exams.filter((e: any) => {
      if (e.status === 'LOCKED' || e.status === 'EVALUATING') return false;
      if (examSearch) {
        const q = examSearch.toLowerCase();
        const matchesTitle = e.title?.toLowerCase().includes(q);
        const matchesSub = e.subject?.name?.toLowerCase().includes(q);
        const matchesBatch = e.batch?.name?.toLowerCase().includes(q);
        return matchesTitle || matchesSub || matchesBatch;
      }
      return true;
    });
  }, [exams, examSearch]);

  const selectedExam = React.useMemo(() => {
    return exams.find((e: any) => e.id === selectedExamId);
  }, [exams, selectedExamId]);

  const handlePublish = async () => {
    try {
      await onPublish();
      setPublished(true);
    } catch {
      // publishError rendered by parent
    }
  };

  const handleSubmitCandidate = async () => {
    if (!selectedExamId) {
      setCandidateSubmitError('Please select the official exam to submit this candidate paper to.');
      return;
    }
    if (!reviewPaperId) {
      setCandidateSubmitError('Question paper is missing. Please go back to Step 7 and review.');
      return;
    }
    setCandidateSubmitError(null);
    try {
      await submitCandidatePaper.mutateAsync({
        examId: selectedExamId,
        paperId: reviewPaperId,
      });
      setSubmittedCandidate(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Failed to submit candidate paper';
      setCandidateSubmitError(msg);
    }
  };

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white rounded-3xl border border-emerald-200 shadow-lg text-center space-y-4 animate-fadein">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-[20px] sm:text-[22px] font-bold text-slate-800">
          Assessment Successfully Generated & Published! 🎉
        </h2>
        <p className="text-[13px] sm:text-[13.5px] text-slate-600 max-w-md">
          <b>{state.title}</b> has been published to <b>{state.batches.join(', ')}</b> for exam <b>{state.exam}</b>.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
          <button
            onClick={onPublishSuccess}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] rounded-xl shadow-md transition-all cursor-pointer"
          >
            Return to Dashboard
          </button>
          {paperDetail && (
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print / Export Paper
            </button>
          )}
        </div>

        {/* Hidden printable version */}
        {paperDetail && (
          <div className="hidden print:block bg-white">
            <PrintableQuestionPaper
              exam={{ title: state.title, durationMinutes: state.duration }}
              paper={paperDetail}
              batchLabel={state.batches.join(', ')}
            />
          </div>
        )}
      </div>
    );
  }

  if (submittedCandidate) {
    const targetTitle = selectedExam?.title || 'the selected official exam';
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white rounded-3xl border border-indigo-200 shadow-lg text-center space-y-4 animate-fadein">
        <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-md">
          <FileCheck className="w-10 h-10" />
        </div>
        <h2 className="text-[20px] sm:text-[22px] font-bold text-slate-800">
          Candidate Paper Submitted for Official Review! 🎉
        </h2>
        <p className="text-[13px] sm:text-[13.5px] text-slate-600 max-w-lg leading-relaxed">
          Your question paper has been submitted to Admin for <b>{targetTitle}</b>. Multiple teachers may submit
          candidate papers for this examination. Admin will review all candidate papers together and select the single
          official paper.
        </p>
        <p className="text-[12px] text-slate-500 font-medium">
          You will receive an in-app notification once Admin reviews and selects the official paper.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4">
          <button
            onClick={onPublishSuccess}
            className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[13px] rounded-xl shadow-md transition-all cursor-pointer"
          >
            Return to Dashboard
          </button>
          {paperDetail && (
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[13px] rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Print / Export Paper
            </button>
          )}
        </div>

        {/* Hidden printable version */}
        {paperDetail && (
          <div className="hidden print:block bg-white">
            <PrintableQuestionPaper
              exam={{ title: targetTitle, durationMinutes: state.duration }}
              paper={paperDetail}
              batchLabel={state.batches.join(', ')}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadein">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            8
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Finalize & Dispatch Paper</h2>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Choose whether to submit this paper for official institute exam review or publish directly for routine class tests.
        </p>
      </div>

      {/* Target Workflow Switcher: Direct Publish vs Submit as Candidate Paper */}
      <div className="bg-slate-50/80 p-1.5 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row gap-1.5">
        <button
          type="button"
          onClick={() => setSubmissionTarget('official_exam')}
          className={`flex-1 py-3 px-4 rounded-xl text-left transition-all cursor-pointer ${
            submissionTarget === 'official_exam'
              ? 'bg-white text-indigo-950 shadow-sm border border-indigo-200/60 ring-2 ring-indigo-500/10'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Building2 className={`w-4 h-4 ${submissionTarget === 'official_exam' ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span className="text-[13px] font-bold">Submit to Official Exam (Admin Review)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-extrabold border border-indigo-200">
              Recommended for Major Exams
            </span>
          </div>
          <p className="text-[11.5px] text-slate-500 leading-relaxed">
            Unit Tests, Half Yearly, Annual Exams. Multiple teachers submit papers; Admin reviews and selects one official paper.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSubmissionTarget('direct')}
          className={`flex-1 py-3 px-4 rounded-xl text-left transition-all cursor-pointer ${
            submissionTarget === 'direct'
              ? 'bg-white text-indigo-950 shadow-sm border border-indigo-200/60 ring-2 ring-indigo-500/10'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Send className={`w-4 h-4 ${submissionTarget === 'direct' ? 'text-emerald-600' : 'text-slate-400'}`} />
            <span className="text-[13px] font-bold">Direct Publish (Class / Routine Test)</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-extrabold border border-emerald-200">
              Low-Stakes
            </span>
          </div>
          <p className="text-[11.5px] text-slate-500 leading-relaxed">
            Weekly test, chapter quiz, practice test, or homework. Directly creates and schedules without Admin paper selection.
          </p>
        </button>
      </div>

      {/* Official Exam Selection View */}
      {submissionTarget === 'official_exam' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-[15px] font-bold text-slate-800">Select Scheduled Institute Exam</h3>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Pick the exam awaiting candidate paper submissions.
              </p>
            </div>
            {eligibleExams.length > 3 && (
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter exams..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-xl outline-none focus:border-indigo-500 bg-slate-50/50"
                />
              </div>
            )}
          </div>

          {isExamsLoading ? (
            <div className="py-8 text-center text-slate-400 text-[12.5px]">Loading institute exams...</div>
          ) : eligibleExams.length === 0 ? (
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-amber-900 text-center space-y-2">
              <AlertCircle className="w-6 h-6 mx-auto text-amber-600" />
              <p className="text-[13px] font-bold">No Active Official Exams Awaiting Candidate Papers</p>
              <p className="text-[12px] text-amber-700 max-w-md mx-auto">
                No scheduled institute exams currently match. You can switch to "Direct Publish" to run a routine test,
                or request Admin to schedule the official examination first.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
              {eligibleExams.map((e: any) => {
                const isSelected = selectedExamId === e.id;
                const dateStr = e.scheduledDate ? new Date(e.scheduledDate).toLocaleDateString() : 'Date TBD';
                const candidateCount = e._count?.candidatePapers ?? (Array.isArray(e.candidatePapers) ? e.candidatePapers.length : 0);

                return (
                  <div
                    key={e.id}
                    onClick={() => setSelectedExamId(e.id)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2 select-none ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 ring-4 ring-indigo-600/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600 tracking-wider">
                          {e.type || 'EXAM'}
                        </span>
                        <h4 className="text-[13.5px] font-bold text-slate-800 mt-1 truncate">{e.title}</h4>
                      </div>
                      <input
                        type="radio"
                        name="selectedExam"
                        checked={isSelected}
                        onChange={() => setSelectedExamId(e.id)}
                        className="w-4 h-4 text-indigo-600 mt-1 cursor-pointer"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-slate-500 pt-1 border-t border-slate-100">
                      <span>{e.subject?.name ?? 'Subject N/A'}</span>
                      <span>·</span>
                      <span>{e.batch?.name ?? 'Batch N/A'}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {dateStr}
                      </span>
                    </div>

                    <div className="text-[10.5px] text-indigo-700 font-semibold bg-indigo-50/60 px-2 py-1 rounded-lg flex items-center justify-between">
                      <span>Candidate Submissions:</span>
                      <span className="font-bold">{candidateCount} paper{candidateCount !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {candidateSubmitError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[12.5px] font-semibold text-rose-800">
              {candidateSubmitError}
            </div>
          )}
        </div>
      )}

      {/* Direct Delivery Mode Selection (for routine / direct publish) */}
      {submissionTarget === 'direct' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-[15px] font-bold text-slate-800">Select Assessment Delivery Mode</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Online App/Web */}
            <div
              onClick={() => setPublishMode('online')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2.5 ${
                publishMode === 'online'
                  ? 'border-indigo-600 bg-indigo-50/40 ring-4 ring-indigo-600/10'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <Globe className="w-5 h-5" />
                </div>
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'online'}
                  onChange={() => setPublishMode('online')}
                  className="w-4 h-4 text-indigo-600"
                />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-slate-800">Digital Online Mode</h4>
                <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                  App & Web portal delivery with automatic timer, auto-grading, and AI analytics report.
                </p>
              </div>
            </div>

            {/* Live Exam */}
            <div
              onClick={() => setPublishMode('live')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2.5 ${
                publishMode === 'live'
                  ? 'border-rose-500 bg-rose-50/40 ring-4 ring-rose-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                  <Radio className="w-5 h-5 animate-pulse" />
                </div>
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'live'}
                  onChange={() => setPublishMode('live')}
                  className="w-4 h-4 text-rose-600"
                />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-slate-800">Live Classroom Test</h4>
                <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                  Proctored real-time countdown test with live teacher dashboard & live leaderboard.
                </p>
              </div>
            </div>

            {/* Offline Print */}
            <div
              onClick={() => setPublishMode('offline')}
              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all space-y-2.5 ${
                publishMode === 'offline'
                  ? 'border-amber-600 bg-amber-50/40 ring-4 ring-amber-600/10'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <input
                  type="radio"
                  name="publishMode"
                  checked={publishMode === 'offline'}
                  onChange={() => setPublishMode('offline')}
                  className="w-4 h-4 text-amber-600"
                />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-slate-800">
                  {state.paperFormat === 'THEORY' ? 'Printable PDF' : 'Printable PDF & OMR'}
                </h4>
                <p className="text-[11.5px] text-slate-500 mt-1 leading-relaxed">
                  {state.paperFormat === 'THEORY'
                    ? 'Generate high-resolution printable PDF question paper with spaced lines for student answers.'
                    : 'Generate high-resolution printable PDF question paper and downloadable OMR sheets.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Card */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 uppercase tracking-wider">
              {submissionTarget === 'official_exam' ? 'Ready for Candidate Review' : 'Ready to Dispatch'}
            </span>
            <h3 className="text-[18px] font-bold text-white mt-1">{state.title || 'Physics Test'}</h3>
          </div>

          <div className="text-right">
            <span className="text-[12px] font-bold text-amber-400 block">{state.totalMarks} Marks</span>
            <span className="text-[11px] text-slate-400">{state.duration} Minutes</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 text-[12px]">
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Paper Format</span>
            <span className="font-bold text-white text-[13px] capitalize block truncate">
              {state.paperFormat.toLowerCase()}
            </span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden">
            <span className="text-slate-400 text-[10px] uppercase font-bold block truncate">
              {submissionTarget === 'official_exam' ? 'Target Official Exam' : 'Target Exam'}
            </span>
            <span className="font-bold text-white text-[13px] block truncate">
              {submissionTarget === 'official_exam' && selectedExam ? selectedExam.title : state.exam}
            </span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden">
            <span className="text-slate-400 text-[10px] uppercase font-bold block truncate">Assigned Batches</span>
            <span className="font-bold text-white text-[13px] block truncate" title={state.batches.join(', ')}>
              {state.batches.join(', ')}
            </span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden">
            <span className="text-slate-400 text-[10px] uppercase font-bold block truncate">Delivery Strategy</span>
            <span className="font-bold text-indigo-300 text-[13px] capitalize block truncate">{state.strategy}</span>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/60 overflow-hidden">
            <span className="text-slate-400 text-[10px] uppercase font-bold block truncate">Paper Sets</span>
            <span className="font-bold text-white text-[13px] block truncate">{state.paperSetsCount} Variants</span>
          </div>
        </div>
      </div>

      {/* Publish error */}
      {publishError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-[12.5px] font-semibold text-rose-800">
          {publishError}
        </div>
      )}

      {/* Action Buttons Row — responsive across mobile & desktop */}
      <div className="pt-4 border-t border-slate-200">
        {/* Mobile (sm:hidden) */}
        <div className="flex sm:hidden flex-col gap-2.5 w-full">
          <div className="flex items-center gap-2.5 w-full">
            <button
              type="button"
              onClick={onPrev}
              disabled={isPublishing || submitCandidatePaper.isPending}
              className="flex-1 px-4 py-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[13px] rounded-2xl transition-colors min-h-[46px] flex items-center justify-center shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
            >
              ← Back to Preview
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSavingDraft || isPublishing || submitCandidatePaper.isPending}
              className="flex-1 px-4 py-3 border border-slate-300 hover:bg-slate-50 bg-white text-slate-700 font-bold text-[12.5px] rounded-2xl transition-colors flex items-center justify-center gap-1.5 min-h-[46px] shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4 text-slate-500" />
              {isSavingDraft ? 'Saving…' : 'Save Draft'}
            </button>
          </div>

          {submissionTarget === 'official_exam' ? (
            <button
              type="button"
              onClick={handleSubmitCandidate}
              disabled={submitCandidatePaper.isPending || !selectedExamId}
              className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[48px] cursor-pointer active:scale-95"
            >
              <Building2 className="w-4 h-4" />
              {submitCandidatePaper.isPending ? 'Submitting to Admin…' : 'Submit Candidate Paper for Review'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing}
              className="w-full px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold text-[14px] rounded-2xl shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px] cursor-pointer active:scale-95"
            >
              <Send className="w-4 h-4" />
              {isPublishing ? 'Publishing…' : 'Generate & Publish Now'}
            </button>
          )}
        </div>

        {/* Desktop (hidden sm:flex) */}
        <div className="hidden sm:flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrev}
            disabled={isPublishing || submitCandidatePaper.isPending}
            className="px-6 py-2.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-bold text-[13px] rounded-xl transition-colors min-h-[44px] flex items-center shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
          >
            ← Back to Preview
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={isSavingDraft || isPublishing || submitCandidatePaper.isPending}
              className="px-5 py-2.5 border border-slate-300 hover:bg-slate-50 bg-white text-slate-700 font-bold text-[12.5px] rounded-xl transition-colors flex items-center gap-1.5 min-h-[44px] shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4 text-slate-500" />
              {isSavingDraft ? 'Saving…' : 'Save Draft'}
            </button>

            {submissionTarget === 'official_exam' ? (
              <button
                type="button"
                onClick={handleSubmitCandidate}
                disabled={submitCandidatePaper.isPending || !selectedExamId}
                className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold text-[13.5px] rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50 min-h-[44px] cursor-pointer active:scale-95"
              >
                <Building2 className="w-4 h-4" />
                {submitCandidatePaper.isPending ? 'Submitting to Admin…' : 'Submit Candidate Paper for Review'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-bold text-[13.5px] rounded-xl shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-60 min-h-[44px] cursor-pointer active:scale-95"
              >
                <Send className="w-4 h-4" />
                {isPublishing ? 'Publishing…' : 'Generate & Publish Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
