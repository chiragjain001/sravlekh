'use client';

import React, { useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Info,
} from 'lucide-react';
import { AssessmentState, PaperSection } from '../AssessmentSummaryPanel';
import {
  THEORY_SECTION_TEMPLATES,
  computeSectionsTotal,
  computeSectionsTotalQuestions,
} from '@/lib/assessment-blueprint';

// ── Props ──────────────────────────────────────────────────────────────────────
interface Step4SectionBuilderProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  onNext: () => void;
  onBack: () => void;
}

// ── Question Type options the teacher can pick per-section ──────────────────
const SECTION_QUESTION_TYPES = [
  { value: 'Very Short Answer', label: 'Very Short Answer (VSA)' },
  { value: 'Short Answer',      label: 'Short Answer (SA)' },
  { value: 'Long Answer',       label: 'Long Answer (LA)' },
  { value: 'Essay',             label: 'Essay' },
  { value: 'Case Based',        label: 'Case / Source Based' },
  { value: 'MCQ',               label: 'MCQ' },
  { value: 'Fill in the Blank', label: 'Fill in the Blank' },
  { value: 'True/False',        label: 'True / False' },
  { value: 'Match the Following', label: 'Match the Following' },
  { value: 'Diagram Based',     label: 'Diagram Based' },
  { value: 'Numerical',         label: 'Numerical' },
  { value: 'HOTS',              label: 'HOTS / Competency' },
];

// ── Template labels for UI ─────────────────────────────────────────────────
const TEMPLATE_LABELS: Record<string, { label: string; desc: string }> = {
  cbse_class10_80m: { label: 'CBSE Class 10 (80 marks)', desc: '5 sections, standard board pattern' },
  cbse_class12_70m: { label: 'CBSE Class 12 (70 marks)', desc: '4 sections, board exam pattern' },
  unit_test_25m:    { label: 'Unit Test (25 marks)',      desc: '3 sections, quick classroom test' },
};

let nextId = 1;
function makeId(): string {
  return `sec_${Date.now()}_${nextId++}`;
}

function createBlankSection(name?: string): PaperSection {
  return {
    id: makeId(),
    name: name || `Section ${String.fromCharCode(65)}`,
    instructions: 'Answer all questions.',
    questionType: 'Short Answer',
    questionCount: 5,
    marksPerQuestion: 2,
    internalChoice: false,
    attemptRequired: 5,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Step4SectionBuilder({ state, onChange, onNext, onBack }: Step4SectionBuilderProps) {
  const sections = state.sections;

  // Helper to update sections array without overwriting target totalMarks
  const setSections = useCallback(
    (updater: (prev: PaperSection[]) => PaperSection[]) => {
      const next = updater(sections);
      onChange({ sections: next });
    },
    [sections, onChange],
  );

  // Add a new blank section with auto-named letter
  const addSection = () => {
    setSections((prev) => {
      const letter = String.fromCharCode(65 + prev.length);
      return [...prev, createBlankSection(`Section ${letter}`)];
    });
  };

  // Remove a section by id
  const removeSection = (id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  // Duplicate a section
  const duplicateSection = (id: string) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx === -1) return prev;
      const src = prev[idx];
      if (!src) return prev;
      const clone: PaperSection = { ...src, id: makeId(), name: `${src.name} (copy)` };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  // Move section up/down
  const moveSection = (id: string, dir: -1 | 1) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const swapIdx = idx + dir;
      if (idx < 0 || swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      const a = next[idx];
      const b = next[swapIdx];
      if (!a || !b) return prev;
      next[idx] = b;
      next[swapIdx] = a;
      return next;
    });
  };

  // Update a single field of a section
  const updateField = (id: string, field: keyof PaperSection, value: unknown) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const updated = { ...s, [field]: value };
        // Auto-update instructions based on internal choice
        if (field === 'internalChoice') {
          if (value === true) {
            updated.instructions = `Answer any ${updated.attemptRequired} questions out of ${updated.questionCount}.`;
          } else {
            updated.instructions = 'Answer all questions.';
            updated.attemptRequired = updated.questionCount;
          }
        }
        
        if (field === 'attemptRequired') {
          updated.instructions = `Answer any ${value} questions out of ${updated.questionCount}.`;
        }

        // If changing questionCount, ensure attemptRequired stays valid
        if (field === 'questionCount') {
          const newCount = value as number;
          if (!updated.internalChoice) {
            updated.attemptRequired = newCount;
            updated.instructions = 'Answer all questions.';
          } else {
            if (updated.attemptRequired > newCount) updated.attemptRequired = newCount;
            updated.instructions = `Answer any ${updated.attemptRequired} questions out of ${newCount}.`;
          }
        }
        return updated;
      }),
    );
  };

  // Apply a template
  const applyTemplate = (templateKey: string) => {
    const template = THEORY_SECTION_TEMPLATES[templateKey];
    if (!template) return;
    const newSections: PaperSection[] = template.map((t) => ({
      id: makeId(),
      name: t.name,
      instructions: t.instructions,
      questionType: t.questionType,
      questionCount: t.questionCount,
      marksPerQuestion: t.marksPerQuestion,
      internalChoice: false,
      attemptRequired: t.questionCount,
    }));
    const total = computeSectionsTotal(newSections);
    onChange({ sections: newSections, totalMarks: total });
  };

  // Derived stats
  const sectionsTotalMarks = useMemo(() => computeSectionsTotal(sections), [sections]);
  const totalQuestions = useMemo(() => computeSectionsTotalQuestions(sections), [sections]);
  const targetMarks = state.totalMarks > 0 ? state.totalMarks : sectionsTotalMarks;

  // Auto-sync state.totalMarks if currently 0 or unset but sections have marks
  React.useEffect(() => {
    if (sectionsTotalMarks > 0 && (!state.totalMarks || state.totalMarks === 0)) {
      onChange({ totalMarks: sectionsTotalMarks });
    }
  }, [sectionsTotalMarks, state.totalMarks, onChange]);

  const canProceed = sections.length > 0 && sectionsTotalMarks > 0;

  const handleNext = () => {
    if (sectionsTotalMarks > 0 && state.totalMarks !== sectionsTotalMarks) {
      onChange({ totalMarks: sectionsTotalMarks });
    }
    onNext();
  };

  return (
    <div className="space-y-6 animate-fadein">
      {/* ── Step Heading ── */}
      <div>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-[13px] font-extrabold">
            4
          </span>
          <h2 className="text-[18px] font-bold text-slate-800">Section Builder</h2>
          <span className="text-[10.5px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
            {state.paperFormat}
          </span>
        </div>
        <p className="text-[12.5px] text-slate-500 pl-9">
          Define sections for your paper — each section has its own question type, marks, and count
        </p>
      </div>

      {/* ── Quick-Fill Templates ── */}
      <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-600" />
          <span className="text-[12.5px] font-bold text-violet-900">Suggest Structure</span>
          <span className="text-[10.5px] text-violet-500 font-medium">— apply a standard template to start</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(TEMPLATE_LABELS).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => applyTemplate(key)}
              className="flex-1 min-w-[140px] px-3 py-2 bg-white border border-violet-200 rounded-xl text-left hover:border-violet-400 hover:shadow-sm transition-all group"
            >
              <p className="text-[12px] font-bold text-slate-800 group-hover:text-violet-700">{meta.label}</p>
              <p className="text-[10.5px] text-slate-500 hidden sm:block">{meta.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Live Stats Bar ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
          <p className="text-[22px] font-extrabold text-indigo-700">{sections.length}</p>
          <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Sections</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-xs">
          <p className="text-[22px] font-extrabold text-slate-800">{totalQuestions}</p>
          <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Questions</p>
        </div>
        <div className={`border rounded-xl p-3 text-center shadow-xs ${sectionsTotalMarks > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
          <p className={`text-[22px] font-extrabold ${sectionsTotalMarks > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>{sectionsTotalMarks}</p>
          <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Total Marks</p>
        </div>
      </div>

      {/* ── Section Cards ── */}
      <div className="space-y-4">
        {sections.map((sec, idx) => {
          const sectionMarks = sec.marksPerQuestion * (sec.internalChoice ? sec.attemptRequired : sec.questionCount);
          return (
            <div
              key={sec.id}
              className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
            >
              {/* Section Header */}
              <div className="flex items-center justify-between bg-slate-50 px-3 sm:px-4 py-2.5 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                  <Layers className="w-4 h-4 text-violet-500 shrink-0" />
                  <input
                    type="text"
                    value={sec.name}
                    onChange={(e) => updateField(sec.id, 'name', e.target.value)}
                    className="text-[13px] sm:text-[13.5px] font-bold text-slate-800 bg-transparent border-none focus:outline-none focus:ring-0 min-w-0 flex-1 truncate"
                  />
                  <span className="text-[10px] sm:text-[10.5px] font-bold text-indigo-600 bg-indigo-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-indigo-100 shrink-0 whitespace-nowrap">
                    {sectionMarks}m
                  </span>
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                  <button onClick={() => moveSection(sec.id, -1)} disabled={idx === 0} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
                    <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button onClick={() => moveSection(sec.id, 1)} disabled={idx === sections.length - 1} className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center">
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button onClick={() => duplicateSection(sec.id)} className="p-1.5 rounded hover:bg-slate-200 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center" title="Duplicate">
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  </button>
                  <button onClick={() => removeSection(sec.id)} className="p-1.5 rounded hover:bg-rose-100 text-rose-500 transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center" title="Remove">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Section Body */}
              <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                {/* Question Type */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Question Type</label>
                  <select
                    value={sec.questionType}
                    onChange={(e) => updateField(sec.id, 'questionType', e.target.value)}
                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold text-slate-800 focus:outline-none focus:border-violet-500 min-h-[44px]"
                  >
                    {SECTION_QUESTION_TYPES.map((qt) => (
                      <option key={qt.value} value={qt.value}>{qt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Question Count */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Questions</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="---"
                    value={sec.questionCount || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      updateField(sec.id, 'questionCount', val ? parseInt(val, 10) : 0);
                    }}
                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-violet-500 min-h-[44px]"
                  />
                </div>

                {/* Marks per Question */}
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1">Marks Each</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="---"
                    value={sec.marksPerQuestion || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      updateField(sec.id, 'marksPerQuestion', val ? parseInt(val, 10) : 0);
                    }}
                    className="w-full p-3 sm:p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-800 focus:outline-none focus:border-violet-500 min-h-[44px]"
                  />
                </div>

                {/* Internal Choice Toggle + Attempt Count */}
                <div className="sm:col-span-2 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer min-h-[40px]">
                    <input
                      type="checkbox"
                      checked={sec.internalChoice}
                      onChange={(e) => updateField(sec.id, 'internalChoice', e.target.checked)}
                      className="w-5 h-5 text-violet-600 rounded focus:ring-violet-500"
                    />
                    <span className="text-[11.5px] font-semibold text-slate-700">Internal Choice</span>
                    <Info className="w-3 h-3 text-slate-400" />
                  </label>
                  {sec.internalChoice && (
                    <div className="flex items-center gap-2 animate-fadein">
                      <span className="text-[11px] text-slate-500 font-medium">Attempt</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="---"
                        value={sec.attemptRequired || ''}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          const num = val ? parseInt(val, 10) : 0;
                          updateField(sec.id, 'attemptRequired', Math.min(sec.questionCount, num));
                        }}
                        className="w-16 p-1.5 bg-violet-50 border border-violet-200 rounded-lg text-[12px] font-bold text-violet-800 text-center focus:outline-none min-h-[40px]"
                      />
                      <span className="text-[11px] text-slate-500 font-medium">of {sec.questionCount}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Instructions */}
              <div className="px-4 pb-3">
                <input
                  type="text"
                  value={sec.instructions}
                  onChange={(e) => updateField(sec.id, 'instructions', e.target.value)}
                  placeholder="Section instructions (e.g. 'Answer all questions')"
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-600 focus:outline-none focus:border-violet-400"
                />
              </div>
            </div>
          );
        })}

        {/* Add Section Button */}
        <button
          type="button"
          onClick={addSection}
          className="w-full py-3 border-2 border-dashed border-violet-300 bg-violet-50/40 rounded-2xl text-violet-700 font-bold text-[13px] flex items-center justify-center gap-2 hover:bg-violet-50 hover:border-violet-400 transition-all"
        >
          <Plus className="w-4 h-4" />
          Add Section
        </button>
      </div>

      {/* ── Validation / Hints ── */}
      {sections.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <p className="text-[11.5px] font-medium text-amber-800">
            No sections defined yet. Add sections or apply a template above to define your paper structure.
          </p>
        </div>
      )}

      {sections.length > 0 && (
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 border rounded-xl ${sectionsTotalMarks === targetMarks ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-center gap-2">
            {sectionsTotalMarks === targetMarks ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            )}
            <p className={`text-[11.5px] font-medium ${sectionsTotalMarks === targetMarks ? 'text-emerald-800' : 'text-amber-800'}`}>
              {sectionsTotalMarks === targetMarks ? (
                <span><strong>Perfect!</strong> Sections total matches your target {targetMarks} marks.</span>
              ) : sectionsTotalMarks > targetMarks ? (
                <span><strong>Notice:</strong> Sections total ({sectionsTotalMarks} marks) exceeds the earlier target ({targetMarks} marks).</span>
              ) : (
                <span><strong>Notice:</strong> Sections total ({sectionsTotalMarks} marks) falls short of the target ({targetMarks} marks).</span>
              )}
            </p>
          </div>
          {sectionsTotalMarks !== targetMarks && (
            <button
              type="button"
              onClick={() => onChange({ totalMarks: sectionsTotalMarks })}
              className="text-[11px] font-bold px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 rounded-lg border border-slate-200 shadow-2xs whitespace-nowrap cursor-pointer transition-colors self-end sm:self-auto"
            >
              Update Target to {sectionsTotalMarks}m
            </button>
          )}
        </div>
      )}

      {/* ── Section Summary Card ── */}
      <div className="bg-emerald-50/70 border border-emerald-100 p-3.5 rounded-2xl space-y-1">
        <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-[12px]">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Section Summary</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-snug">
          {sections.length} section{sections.length !== 1 ? 's' : ''} &middot;{' '}
          {totalQuestions} questions &middot; {sectionsTotalMarks} / {targetMarks} marks
        </p>
      </div>
    </div>
  );
}
