'use client';
// ─── Rubric Authoring Dialog — 26-RUBRIC-EVALUATION-SPECIFICATION.md, Phase 9 ──
// Attaches/re-versions a rubric for a subjective question. Extends the same
// dialog shell/field style as QuestionFormDialog.tsx.

import { useEffect, useState } from 'react';
import { X, ClipboardList, Plus, Trash2, Loader2 } from 'lucide-react';
import { useRubric, useCreateRubric, useUpdateRubric } from '@/hooks/useApi';

type ScoringMode = 'CRITERION_ADDITIVE' | 'STEP_WISE' | 'HOLISTIC_WITH_GUIDANCE';

const SCORING_MODES: { value: ScoringMode; label: string; hint: string }[] = [
  { value: 'CRITERION_ADDITIVE', label: 'Criterion Additive', hint: 'Sum of criterion marks (most common)' },
  { value: 'STEP_WISE', label: 'Step-Wise', hint: 'Later steps can depend on an earlier step being correct' },
  { value: 'HOLISTIC_WITH_GUIDANCE', label: 'Holistic with Guidance', hint: 'A single mark, guided by descriptive bands — bands don’t need to sum to the question’s marks' },
];

interface CriterionForm {
  description: string;
  maxMarks: number;
  keywordHints: string;
  dependsOnCriterionIndex: number | '';
}

const emptyCriterion = (): CriterionForm => ({ description: '', maxMarks: 0, keywordHints: '', dependsOnCriterionIndex: '' });

interface RubricEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  questionId: string;
  questionMarks: number;
  questionContent: string;
}

export function RubricEditorDialog({ isOpen, onClose, questionId, questionMarks, questionContent }: RubricEditorDialogProps) {
  const { data: rubric, isPending: isLoadingRubric } = useRubric(isOpen ? questionId : undefined);
  const createRubric = useCreateRubric();
  const updateRubric = useUpdateRubric();
  const isSaving = createRubric.isPending || updateRubric.isPending;

  const [name, setName] = useState('');
  const [scoringMode, setScoringMode] = useState<ScoringMode>('CRITERION_ADDITIVE');
  const [criteria, setCriteria] = useState<CriterionForm[]>([emptyCriterion()]);

  useEffect(() => {
    if (!isOpen) return;
    if (rubric) {
      const latest = rubric.versions?.[0];
      const rows: { id: string; description: string; maxMarks: number; keywordHints?: string[]; dependsOnCriterionId?: string | null }[] = latest?.criteria ?? [];
      setName(rubric.name ?? '');
      setScoringMode(rubric.scoringMode ?? 'CRITERION_ADDITIVE');
      setCriteria(
        rows.length
          ? rows.map((c) => ({
              description: c.description,
              maxMarks: c.maxMarks,
              keywordHints: (c.keywordHints ?? []).join(', '),
              dependsOnCriterionIndex: c.dependsOnCriterionId
                ? rows.findIndex((r) => r.id === c.dependsOnCriterionId)
                : '',
            }))
          : [emptyCriterion()],
      );
    } else if (!isLoadingRubric) {
      setName(`${questionContent.slice(0, 40)}${questionContent.length > 40 ? '…' : ''} — rubric`);
      setScoringMode('CRITERION_ADDITIVE');
      setCriteria([emptyCriterion()]);
    }
  }, [isOpen, rubric, isLoadingRubric, questionContent]);

  if (!isOpen) return null;

  const isEditMode = !!rubric;
  const sum = criteria.reduce((total, c) => total + (Number.isFinite(c.maxMarks) ? c.maxMarks : 0), 0);
  const needsReconciliation = scoringMode !== 'HOLISTIC_WITH_GUIDANCE';
  const reconciles = !needsReconciliation || Math.abs(sum - questionMarks) < 1e-6;
  const canSubmit = name.trim() && criteria.length > 0 && criteria.every((c) => c.description.trim()) && reconciles;

  function update(index: number, patch: Partial<CriterionForm>) {
    setCriteria((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function addCriterion() {
    setCriteria((rows) => [...rows, emptyCriterion()]);
  }
  function removeCriterion(index: number) {
    setCriteria((rows) =>
      rows
        .filter((_, i) => i !== index)
        // Dropping a row shifts every later index — clear any dependency that pointed at it or past it, rather than silently pointing at the wrong criterion.
        .map((r) => (r.dependsOnCriterionIndex !== '' && r.dependsOnCriterionIndex >= index ? { ...r, dependsOnCriterionIndex: '' } : r)),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    const payloadCriteria = criteria.map((c) => ({
      description: c.description.trim(),
      maxMarks: c.maxMarks,
      keywordHints: c.keywordHints.trim() ? c.keywordHints.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
      dependsOnCriterionIndex: c.dependsOnCriterionIndex === '' ? undefined : c.dependsOnCriterionIndex,
    }));

    if (isEditMode) {
      updateRubric.mutate(
        { rubricId: rubric.id, questionId, scoringMode, criteria: payloadCriteria },
        { onSuccess: onClose },
      );
    } else {
      createRubric.mutate(
        { questionId, name: name.trim(), scoringMode, criteria: payloadCriteria },
        { onSuccess: onClose },
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rubric-dialog-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 id="rubric-dialog-title" className="text-sm font-bold text-slate-900">
                {isEditMode ? 'Edit Rubric' : 'Attach Rubric'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isEditMode ? 'Saving creates a new version — every past evaluation stays traceable to the version it used' : `Question worth ${questionMarks} marks`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors" aria-label="Close dialog">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoadingRubric ? (
          <div className="p-10 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Rubric Name<span className="text-rose-500 ml-0.5">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Photosynthesis explanation — 5 mark rubric"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Scoring Mode</label>
                <div className="grid grid-cols-1 gap-2">
                  {SCORING_MODES.map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-start gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${scoringMode === m.value ? 'border-indigo-400 bg-indigo-50/50' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <input type="radio" name="scoringMode" checked={scoringMode === m.value} onChange={() => setScoringMode(m.value)} className="mt-0.5 accent-indigo-600" />
                      <span>
                        <span className="block text-xs font-semibold text-slate-800">{m.label}</span>
                        <span className="block text-[11px] text-slate-500">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    {scoringMode === 'HOLISTIC_WITH_GUIDANCE' ? 'Scoring Bands' : 'Criteria'}
                  </label>
                  <button type="button" onClick={addCriterion} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700">
                    <Plus className="w-3 h-3" /> Add {scoringMode === 'HOLISTIC_WITH_GUIDANCE' ? 'band' : 'criterion'}
                  </button>
                </div>
                <div className="space-y-2">
                  {criteria.map((c, i) => (
                    <div key={i} className="p-2.5 border border-slate-200 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 w-5">{i + 1}.</span>
                        <input
                          value={c.description}
                          onChange={(e) => update(i, { description: e.target.value })}
                          placeholder="e.g. Correctly identifies chlorophyll's role"
                          className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.5"
                          value={c.maxMarks}
                          onChange={(e) => update(i, { maxMarks: Number(e.target.value) })}
                          placeholder="Marks"
                          className="w-20 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        <button type="button" onClick={() => removeCriterion(i)} className="p-1.5 text-slate-400 hover:text-rose-600" aria-label="Remove criterion">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pl-7">
                        <input
                          value={c.keywordHints}
                          onChange={(e) => update(i, { keywordHints: e.target.value })}
                          placeholder="Keyword hints, comma-separated (optional — signal for AI evaluation, never auto pass/fail)"
                          className="flex-1 px-3 py-1.5 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                        {scoringMode === 'STEP_WISE' && criteria.length > 1 && (
                          <select
                            value={c.dependsOnCriterionIndex}
                            onChange={(e) => update(i, { dependsOnCriterionIndex: e.target.value === '' ? '' : Number(e.target.value) })}
                            className="w-40 px-2 py-1.5 text-[11px] border border-slate-200 rounded-lg bg-white text-slate-700"
                          >
                            <option value="">No dependency</option>
                            {criteria.map((other, j) =>
                              j === i ? null : (
                                <option key={j} value={j}>
                                  Depends on #{j + 1}
                                </option>
                              ),
                            )}
                          </select>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {needsReconciliation && (
                  <p className={`mt-2 text-[11px] font-semibold ${reconciles ? 'text-emerald-600' : 'text-rose-600'}`}>
                    Criteria total: {sum} / {questionMarks} marks{!reconciles && ' — must reconcile exactly before saving'}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/50">
              <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-white transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit || isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditMode ? 'Save New Version' : 'Attach Rubric'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
