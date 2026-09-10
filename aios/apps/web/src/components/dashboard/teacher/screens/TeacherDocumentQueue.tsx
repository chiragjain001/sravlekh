'use client';

import { useState } from 'react';
import { Plus, UploadCloud, FileStack, ChevronRight, ArrowRight, AlertTriangle, CheckCircle2, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import {
  useAssessments, useAssessment, useAssessmentDelivery, useUpdateAssessmentDeliveryStatus,
  useCreateDocumentBundle, useDocumentsForBundle,
} from '@/hooks/useApi';
import { nextExamStatus } from '@/lib/exam-status';
import { CreateDigitalAssessmentModal } from '../digital-copy/CreateDigitalAssessmentModal';
import { CreateStructuredAssessmentModal } from '../digital-copy/CreateStructuredAssessmentModal';
import { RecordAttemptPanel } from '../digital-copy/RecordAttemptPanel';
import { UploadBookletModal } from '../digital-copy/UploadBookletModal';
import { DocumentDetailPanel } from '../digital-copy/DocumentDetailPanel';

const DOC_STATUS_STYLE: Record<string, string> = {
  UPLOADED: 'bg-slate-100 text-slate-600',
  PAGE_PROCESSING: 'bg-amber-100 text-amber-700',
  IDENTITY_PENDING: 'bg-rose-100 text-rose-700',
  REGION_MAPPING: 'bg-indigo-100 text-indigo-700',
  READY_FOR_EVALUATION: 'bg-emerald-100 text-emerald-700',
  FAILED: 'bg-rose-100 text-rose-700',
};

export function TeacherDocumentQueue() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStructuredModal, setShowStructuredModal] = useState(false);
  const [showRecordAttempts, setShowRecordAttempts] = useState(false);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  const { data: assessments = [], isLoading: assessmentsLoading, refetch: refetchAssessments } = useAssessments();
  const { data: assessmentDetail } = useAssessment(selectedAssessmentId);
  const deliveryId = assessmentDetail?.deliveries?.[0]?.id ?? null;
  const { data: delivery, refetch: refetchDelivery } = useAssessmentDelivery(deliveryId);
  const updateStatus = useUpdateAssessmentDeliveryStatus();
  const createBundle = useCreateDocumentBundle();
  const { data: documents = [], isLoading: documentsLoading, refetch: refetchDocuments } = useDocumentsForBundle(bundleId);

  const subjectId = assessmentDetail?.subjectIds?.[0];
  const batchId = delivery?.batchId;

  const handleCreated = (newAssessmentId: string) => {
    setShowCreateModal(false);
    refetchAssessments();
    setBundleId(null);
    // useAssessment() fetches this assessment directly by id, so selecting it
    // works immediately without waiting on the list query to refetch.
    setSelectedAssessmentId(newAssessmentId);
  };

  const handleStructuredCreated = (newAssessmentId: string) => {
    setShowStructuredModal(false);
    refetchAssessments();
    setSelectedAssessmentId(newAssessmentId);
  };

  const handleEnsureBundle = async () => {
    if (bundleId) { setShowUploadModal(true); return; }
    if (!deliveryId) return;
    const bundle = await createBundle.mutateAsync({ assessmentDeliveryId: deliveryId });
    setBundleId(bundle.id);
    setShowUploadModal(true);
  };

  const nextStatus = delivery ? nextExamStatus(delivery.status) : null;
  const canAdvance = nextStatus && (nextStatus !== 'APPROVED' || user?.role === 'ADMIN' || user?.role === 'FOUNDER');

  if (activeDocumentId && batchId && subjectId) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <DocumentDetailPanel
          documentId={activeDocumentId}
          batchId={batchId}
          subjectId={subjectId}
          onClose={() => { setActiveDocumentId(null); refetchDocuments(); }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto animate-fadein">
      {showCreateModal && <CreateDigitalAssessmentModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      {showStructuredModal && <CreateStructuredAssessmentModal onClose={() => setShowStructuredModal(false)} onCreated={handleStructuredCreated} />}
      {showUploadModal && bundleId && (
        <UploadBookletModal bundleId={bundleId} onClose={() => setShowUploadModal(false)} onUploaded={() => { refetchDocuments(); }} />
      )}
      {showRecordAttempts && delivery && batchId && (
        <RecordAttemptPanel
          deliveryId={delivery.id}
          batchId={batchId}
          paperId={assessmentDetail?.paper?.id}
          captureProviderId={delivery.captureProviderId}
          assessmentTitle={assessmentDetail?.title}
          onClose={() => setShowRecordAttempts(false)}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-slate-800">Assessments &amp; Answer Sheets</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Scanned booklets, or direct structured marks entry (OMR/manual grid/CSV) — no scans needed for the latter.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> New Digital Assessment
          </button>
          <button onClick={() => setShowStructuredModal(true)} className="flex items-center gap-2 px-4 py-2.5 border border-emerald-200 text-emerald-700 text-[13px] font-bold rounded-xl hover:bg-emerald-50">
            <ListChecks className="w-4 h-4" /> New Structured-Entry Assessment
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Digital Assessment</label>
        {assessmentsLoading ? (
          <p className="text-[13px] text-slate-400">Loading…</p>
        ) : assessments.length === 0 ? (
          <p className="text-[13px] text-slate-500">No digital-copy assessments yet — create one to get started.</p>
        ) : (
          <select
            value={selectedAssessmentId ?? ''}
            onChange={(e) => { setSelectedAssessmentId(e.target.value || null); setBundleId(null); }}
            className="w-full max-w-md px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white"
          >
            <option value="">Select an assessment…</option>
            {assessments.map((a: any) => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select>
        )}
      </div>

      {selectedAssessmentId && delivery && (
        <>
          {/* Status stepper */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-bold text-slate-500">Delivery Status:</span>
              <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-700">{delivery.status}</span>
            </div>
            {nextStatus ? (
              <button
                onClick={() => updateStatus.mutate({ deliveryId: delivery.id, status: nextStatus, version: delivery.version }, { onSuccess: () => refetchDelivery() })}
                disabled={!canAdvance || updateStatus.isPending}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 text-white text-[11.5px] font-bold rounded-xl hover:bg-slate-800 disabled:opacity-40"
                title={!canAdvance ? 'Requires admin approval' : undefined}
              >
                Advance to {nextStatus} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="text-[11.5px] text-slate-400">Final stage reached</span>
            )}
            {nextStatus === 'APPROVED' && !canAdvance && (
              <span className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Only an admin can approve this delivery</span>
            )}
          </div>

          {delivery.captureProvider?.type && delivery.captureProvider.type !== 'PHOTO_CAPTURE_SUBJECTIVE' ? (
            /* Structured-entry types (OMR/MANUAL_GRID/CSV_IMPORT) — no scans,
               marks are entered directly. */
            <div className="p-8 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[15px] font-bold text-slate-800">Structured-Entry Assessment</h2>
                <p className="text-[12.5px] text-slate-500 mt-1">Capture mode: {delivery.captureProvider.type.replace(/_/g, ' ')} — record each student&apos;s marks directly, no document upload needed.</p>
              </div>
              <button
                onClick={() => setShowRecordAttempts(true)}
                disabled={!assessmentDetail?.paper?.id}
                title={!assessmentDetail?.paper?.id ? 'This assessment has no linked paper' : undefined}
                className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-[13px] font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-40"
              >
                <ListChecks className="w-4 h-4" /> Record Attempts
              </button>
            </div>
          ) : (
          <>
          {/* Upload + document list */}
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-800">Uploaded Booklets</h2>
            <button onClick={handleEnsureBundle} disabled={createBundle.isPending} className="flex items-center gap-1.5 px-3.5 py-2 border border-indigo-200 text-indigo-700 text-[12px] font-bold rounded-xl hover:bg-indigo-50">
              <UploadCloud className="w-3.5 h-3.5" /> Upload Booklet
            </button>
          </div>

          {documentsLoading ? (
            <p className="text-[13px] text-slate-400 py-8 text-center">Loading documents…</p>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center bg-white border-2 border-dashed border-slate-200 rounded-2xl">
              <FileStack className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-[13px] font-semibold text-slate-600">No booklets uploaded yet for this assessment.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden divide-y divide-slate-50">
              {documents.map((d: any) => (
                <button key={d.id} onClick={() => setActiveDocumentId(d.id)} className="w-full flex items-center justify-between gap-4 p-4 hover:bg-slate-50/50 text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 flex-shrink-0">
                      <FileStack className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800">
                        {d.identityResolution?.status === 'MANUALLY_CONFIRMED' ? 'Booklet — identity confirmed' : 'Booklet — awaiting identity confirmation'}
                      </p>
                      <p className="text-[11.5px] text-slate-500 mt-0.5">{d.pages?.length ?? 0} pages · Uploaded {new Date(d.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase ${DOC_STATUS_STYLE[d.status] ?? 'bg-slate-100 text-slate-600'}`}>{d.status.replace(/_/g, ' ')}</span>
                    {d.status === 'READY_FOR_EVALUATION' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
          </>
          )}
        </>
      )}
    </div>
  );
}
