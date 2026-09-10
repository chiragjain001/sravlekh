'use client';
// ─── Sibling to CreateDigitalAssessmentModal, for the other 3 in-scope
// capture types (OMR / MANUAL_GRID / CSV_IMPORT — PHOTO_CAPTURE_OBJECTIVE
// too, though nothing generates that provider type yet). Unlike the photo-
// capture path, these have no document-upload step — scoring is direct,
// structured marks entry against a paper the teacher already generated, so
// (unlike the photo-capture flow) a paper must be picked up front.

import { useState } from 'react';
import { X, ListChecks } from 'lucide-react';
import { useBatches, useSubjects, usePapers, useCaptureProviders, useEvaluationPolicies, useCreateAssessment, useCreateAssessmentDelivery } from '@/hooks/useApi';

interface CreateStructuredAssessmentModalProps {
  onClose: () => void;
  onCreated: (assessmentId: string, deliveryId: string) => void;
}

const ASSESSMENT_KINDS = ['COACHING_TEST', 'SCHOOL_THEORY_EXAM', 'PRACTICE_TEST', 'DIAGNOSTIC', 'HOMEWORK_GRADED'];
const STAKES_LEVELS = ['GRADED', 'PRACTICE', 'DIAGNOSTIC_ONLY'];

export function CreateStructuredAssessmentModal({ onClose, onCreated }: CreateStructuredAssessmentModalProps) {
  const { data: batches = [] } = useBatches();
  const { data: subjects = [] } = useSubjects();
  const { data: papers = [] } = usePapers();
  const { data: captureProvidersResp } = useCaptureProviders();
  const { data: evaluationPoliciesResp } = useEvaluationPolicies();
  const captureProviders = (captureProvidersResp ?? []).filter((cp: any) => cp.type !== 'PHOTO_CAPTURE_SUBJECTIVE');
  const evaluationPolicies = evaluationPoliciesResp ?? [];
  const generatedPapers = papers.filter((p) => !p.isPersonalized);

  const createAssessment = useCreateAssessment();
  const createDelivery = useCreateAssessmentDelivery();

  const [title, setTitle] = useState('');
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [paperId, setPaperId] = useState('');
  const [assessmentKind, setAssessmentKind] = useState(ASSESSMENT_KINDS[0]!);
  const [stakesLevel, setStakesLevel] = useState(STAKES_LEVELS[0]!);
  const [captureProviderId, setCaptureProviderId] = useState('');
  const [evaluationPolicyId, setEvaluationPolicyId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isValid = !!title.trim() && !!batchId && !!subjectId && !!paperId && !!captureProviderId && !!evaluationPolicyId;
  const isSubmitting = createAssessment.isPending || createDelivery.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setError(null);
    try {
      const assessment = await createAssessment.mutateAsync({
        title: title.trim(),
        assessmentKind,
        stakesLevel,
        subjectIds: [subjectId],
        paperId,
        totalMarks: 100,
      });
      const delivery = await createDelivery.mutateAsync({
        assessmentId: assessment.id,
        batchId,
        captureProviderId,
        evaluationPolicyId,
      });
      onCreated(assessment.id, delivery.id);
    } catch {
      setError('Failed to create the assessment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-slate-800">New Structured-Entry Assessment</h2>
              <p className="text-[12px] text-slate-500">OMR / manual grid / CSV import — marks entered directly per question, no scans</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {captureProviders.length === 0 && (
          <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            No OMR/manual-grid/CSV-import provider is configured for your institute yet — ask your admin to add one.
          </p>
        )}
        {generatedPapers.length === 0 && (
          <p className="text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            No generated paper exists yet — build one from Paper Builder first, then come back here.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Title *</label>
            <input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly OMR Test — Kinematics"
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-emerald-400/30" />
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Paper *</label>
            <select required value={paperId} onChange={e => setPaperId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
              <option value="">Select a generated paper…</option>
              {generatedPapers.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Batch *</label>
              <select required value={batchId} onChange={e => setBatchId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
                <option value="">Select…</option>
                {batches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Subject *</label>
              <select required value={subjectId} onChange={e => setSubjectId(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
                <option value="">Select…</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Assessment Kind</label>
              <select value={assessmentKind} onChange={e => setAssessmentKind(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
                {ASSESSMENT_KINDS.map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Stakes Level</label>
              <select value={stakesLevel} onChange={e => setStakesLevel(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
                {STAKES_LEVELS.map(k => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Capture Provider *</label>
            <select required value={captureProviderId} onChange={e => setCaptureProviderId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
              <option value="">Select…</option>
              {captureProviders.map((cp: any) => <option key={cp.id} value={cp.id}>{cp.type} ({cp.id.slice(0, 8)})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Evaluation Policy *</label>
            <select required value={evaluationPolicyId} onChange={e => setEvaluationPolicyId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-[13px] bg-white">
              <option value="">Select…</option>
              {evaluationPolicies.map((ep: any) => <option key={ep.id} value={ep.id}>{ep.name}</option>)}
            </select>
          </div>

          {error && <p className="text-[12.5px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={!isValid || isSubmitting}
              className="flex-1 py-2.5 bg-emerald-600 text-white text-[13px] font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50">
              {isSubmitting ? 'Creating…' : 'Create & Continue'}
            </button>
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
