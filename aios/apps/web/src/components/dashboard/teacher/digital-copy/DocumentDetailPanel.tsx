'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ScanEye, UserCheck, RefreshCw, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import {
  useDocument, usePageImageUrl, useCreatePageRegion, useUpdatePageRegion,
  useTriggerOcr, useConfirmIdentity, useStudents, useQuestions, useReprocessDocument,
} from '@/hooks/useApi';
import { PageImageViewer, ViewerRegion } from './PageImageViewer';
import { AiConfidenceBadge } from '@/components/shared/AiConfidenceBadge';

const STATUS_STYLE: Record<string, string> = {
  UPLOADED: 'bg-slate-100 text-slate-600',
  PAGE_PROCESSING: 'bg-amber-100 text-amber-700',
  IDENTITY_PENDING: 'bg-rose-100 text-rose-700',
  REGION_MAPPING: 'bg-indigo-100 text-indigo-700',
  READY_FOR_EVALUATION: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

export function DocumentDetailPanel({ documentId, batchId, subjectId, onClose }: {
  documentId: string;
  batchId: string;
  subjectId: string;
  onClose: () => void;
}) {
  const { data: doc, isLoading, isError, refetch } = useDocument(documentId, { poll: true });
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [drawMode, setDrawMode] = useState(false);
  const [newRegionType, setNewRegionType] = useState<'QUESTION_ANSWER' | 'ROLL_NUMBER_FIELD' | 'HEADER' | 'MARGIN' | 'SIGNATURE'>('QUESTION_ANSWER');
  const [studentPickerValue, setStudentPickerValue] = useState('');

  const createRegion = useCreatePageRegion();
  const updateRegion = useUpdatePageRegion();
  const triggerOcr = useTriggerOcr();
  const confirmIdentity = useConfirmIdentity();
  const reprocess = useReprocessDocument();

  const { data: studentsResp } = useStudents({ batchId, limit: 200 });
  const students = studentsResp?.data ?? [];
  const { data: questionsResp } = useQuestions({ subjectId, limit: 200 });
  const subjectiveQuestions = (questionsResp?.data ?? []).filter((q: any) => ['SHORT_ANSWER', 'LONG_ANSWER', 'PASSAGE_BASED'].includes(q.type));

  const page = doc?.pages?.[pageIndex];
  const pageImage = page?.images?.[0];
  const { data: imageResp, isLoading: imageLoading } = usePageImageUrl(documentId, pageImage?.id ?? null);

  const regions: ViewerRegion[] = useMemo(
    () => (pageImage?.regions ?? []).map((r: any) => ({
      id: r.id,
      boundingBox: r.boundingBox,
      regionType: r.regionType,
      questionId: r.questionId,
      label: r.regionType === 'QUESTION_ANSWER'
        ? (r.questionId ? (subjectiveQuestions.find((q: any) => q.id === r.questionId)?.content.slice(0, 24) ?? 'Mapped') : 'Unmapped')
        : r.regionType.replace(/_/g, ' '),
    })),
    [pageImage, subjectiveQuestions],
  );
  const selectedRegion = pageImage?.regions?.find((r: any) => r.id === selectedRegionId);

  const identityResolution = doc?.identityResolution;
  const isIdentityResolved = identityResolution?.status === 'MANUALLY_CONFIRMED' || identityResolution?.status === 'AUTO_RESOLVED';

  const handleDrawRegion = (box: { x: number; y: number; width: number; height: number }) => {
    if (!pageImage) return;
    createRegion.mutate({ pageImageId: pageImage.id, documentId, boundingBox: box, regionType: newRegionType });
  };

  const handleConfirmIdentity = () => {
    if (!identityResolution || !studentPickerValue) return;
    confirmIdentity.mutate({ resolutionId: identityResolution.id, studentProfileId: studentPickerValue }, { onSuccess: () => refetch() });
  };

  if (isLoading) {
    return <div className="py-16 text-center text-slate-400 text-[13px] animate-fadein">Loading document…</div>;
  }
  if (isError || !doc) {
    return (
      <div className="py-16 text-center animate-fadein">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
        <p className="text-[13px] font-semibold text-slate-600 mb-3">Couldn't load this document.</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-slate-900 text-white text-[12px] font-bold rounded-xl">Retry</button>
      </div>
    );
  }

  const totalOcrRegions = (pageImage?.regions ?? []).filter((r: any) => r.regionType === 'QUESTION_ANSWER' && r.questionId).length;
  const ocrDoneRegions = (pageImage?.regions ?? []).filter((r: any) => r.ocrBlocks?.some((b: any) => b.results?.length)).length;

  return (
    <div className="space-y-4 animate-fadein">
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-500 hover:text-indigo-600">
          <ChevronLeft className="w-4 h-4" /> Back to documents
        </button>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase ${STATUS_STYLE[doc.status] ?? 'bg-slate-100 text-slate-600'}`}>{doc.status.replace(/_/g, ' ')}</span>
      </div>

      {/* Identity resolution */}
      <div className={`p-4 rounded-2xl border ${isIdentityResolved ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'}`}>
        <div className="flex items-center gap-2 mb-2">
          <UserCheck className={`w-4 h-4 ${isIdentityResolved ? 'text-emerald-600' : 'text-rose-600'}`} />
          <p className="text-[13px] font-bold text-slate-800">Student Identity</p>
          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded ${isIdentityResolved ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {identityResolution?.status.replace(/_/g, ' ')}
          </span>
        </div>
        {isIdentityResolved ? (
          <p className="text-[12.5px] text-emerald-800">
            Confirmed as {students.find((s: any) => s.id === identityResolution?.resolvedStudentProfileId)?.user?.name ?? identityResolution?.resolvedStudentProfileId}
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <select value={studentPickerValue} onChange={e => setStudentPickerValue(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-[12.5px] bg-white">
              <option value="">Select the student this booklet belongs to…</option>
              {students.map((s: any) => <option key={s.id} value={s.id}>{s.user?.name ?? s.id}{s.rollNumber ? ` (Roll ${s.rollNumber})` : ''}</option>)}
            </select>
            <button onClick={handleConfirmIdentity} disabled={!studentPickerValue || confirmIdentity.isPending}
              className="px-4 py-2 bg-rose-600 text-white text-[12px] font-bold rounded-xl hover:bg-rose-700 disabled:opacity-40">
              {confirmIdentity.isPending ? 'Confirming…' : 'Confirm'}
            </button>
          </div>
        )}
      </div>

      {/* Page navigator + viewer */}
      {doc.pages?.length > 0 && page && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setPageIndex((i) => Math.max(0, i - 1))} disabled={pageIndex === 0} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[12.5px] font-bold text-slate-700">Page {page.pageNumber} of {doc.pages.length}</span>
                <button onClick={() => setPageIndex((i) => Math.min(doc.pages.length - 1, i + 1))} disabled={pageIndex >= doc.pages.length - 1} className="p-1.5 border border-slate-200 rounded-lg disabled:opacity-30 hover:bg-slate-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select value={newRegionType} onChange={e => setNewRegionType(e.target.value as any)} className="text-[11px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
                  <option value="QUESTION_ANSWER">Question Answer</option>
                  <option value="ROLL_NUMBER_FIELD">Roll Number Field</option>
                  <option value="HEADER">Header</option>
                  <option value="SIGNATURE">Signature</option>
                  <option value="MARGIN">Margin</option>
                </select>
                <button onClick={() => setDrawMode((d) => !d)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${drawMode ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {drawMode ? 'Drawing… (click to stop)' : '+ Mark Region'}
                </button>
              </div>
            </div>

            {imageLoading ? (
              <div className="h-[560px] flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : imageResp?.url ? (
              <PageImageViewer
                imageUrl={imageResp.url}
                regions={regions}
                selectedRegionId={selectedRegionId}
                onSelectRegion={setSelectedRegionId}
                onDrawRegion={drawMode ? handleDrawRegion : undefined}
                drawEnabled={drawMode}
              />
            ) : (
              <div className="h-[560px] flex items-center justify-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl text-[13px]">
                No image uploaded for this page.
              </div>
            )}
          </div>

          {/* Region list / mapping review */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-bold text-slate-700">Regions on this page</p>
              <button onClick={() => refetch()} className="p-1.5 text-slate-400 hover:text-indigo-600">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {(pageImage?.regions ?? []).length === 0 && (
                <p className="text-[12px] text-slate-400 py-4 text-center border border-dashed border-slate-200 rounded-xl">No regions marked yet. Use "+ Mark Region" and drag on the image.</p>
              )}
              {(pageImage?.regions ?? []).map((r: any) => {
                const latestOcr = r.ocrBlocks?.[0]?.results?.[0];
                return (
                  <div key={r.id} onClick={() => setSelectedRegionId(r.id)}
                    className={`p-2.5 border rounded-xl cursor-pointer ${selectedRegionId === r.id ? 'border-indigo-300 bg-indigo-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{r.regionType.replace(/_/g, ' ')}</span>
                      {latestOcr && <AiConfidenceBadge confidence={latestOcr.confidence} label="OCR" />}
                    </div>
                    {r.regionType === 'QUESTION_ANSWER' && (
                      <select
                        value={r.questionId ?? ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateRegion.mutate({ regionId: r.id, documentId, questionId: e.target.value })}
                        className="w-full mt-1 text-[11.5px] px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="">Unmapped — select a question…</option>
                        {subjectiveQuestions.map((q: any) => <option key={q.id} value={q.id}>{q.content.slice(0, 40)}…</option>)}
                      </select>
                    )}
                    {latestOcr?.extractedText && (
                      <p className={`mt-1.5 text-[11px] leading-relaxed ${latestOcr.confidence < 0.5 ? 'bg-rose-50 text-rose-800 px-1.5 py-1 rounded' : latestOcr.confidence < 0.85 ? 'underline decoration-amber-400 decoration-2 text-slate-700' : 'text-slate-700'}`}>
                        {latestOcr.extractedText}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* OCR trigger */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-bold text-slate-700">OCR Extraction</p>
                <span className="text-[11px] text-slate-500">{ocrDoneRegions}/{totalOcrRegions} done</span>
              </div>
              <button
                onClick={() => triggerOcr.mutate({ documentId })}
                disabled={triggerOcr.isPending || totalOcrRegions === 0}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-900 text-white text-[12px] font-bold rounded-xl hover:bg-slate-800 disabled:opacity-40"
              >
                {triggerOcr.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanEye className="w-3.5 h-3.5" />}
                {totalOcrRegions === 0 ? 'Map a question region first' : 'Run OCR on mapped regions'}
              </button>
            </div>

            {doc.status === 'FAILED' && (
              <button onClick={() => reprocess.mutate({ documentId, fromStage: 'VALIDATE' })} className="w-full flex items-center justify-center gap-2 py-2 border border-amber-300 text-amber-700 text-[12px] font-bold rounded-xl hover:bg-amber-50">
                <RefreshCw className="w-3.5 h-3.5" /> Retry Processing
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
