'use client';

import { useState } from 'react';
import {
  ChevronRight, ChevronLeft, Check, Sparkles,
  Plus, Minus, Eye, RotateCcw,
} from 'lucide-react';
import { questions, teacherProfile, classes, subjects } from '@/lib/mock-data/teacher';

// ─── Step config ─────────────────────────────────────────────────────────────
const STEPS = ['Context', 'Blueprint', 'Questions', 'Preview & Publish'] as const;
type Step = 0 | 1 | 2 | 3;

const EXAM_TYPES   = ['JEE Main', 'JEE Advanced', 'NEET', 'Board', 'Unit Test', 'Chapter Test'];
const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
const BATCHES_MAP: Record<string, string[]> = {
  '11': ['11A', '11B', '11C'],
  '12': ['12A', '12B', '12C'],
};
const CHAPTERS_MAP: Record<string, string[]> = {
  physics: ['Rotational Motion', 'Work, Power, Energy', 'Thermodynamics', 'Modern Physics', 'Electrostatics'],
};

export function TeacherPaperBuilder() {
  const [step,          setStep]          = useState<Step>(0);
  const [classId,       setClassId]       = useState('');
  const [batchIds,      setBatchIds]      = useState<string[]>([]);
  const [examType,      setExamType]      = useState('');
  const [totalMarks,    setTotalMarks]    = useState('50');
  const [duration,      setDuration]      = useState('60');
  const [blueprint,     setBlueprint]     = useState<Record<string, Record<string, number>>>({});
  const [selectedQIds,  setSelectedQIds]  = useState<string[]>([]);
  const [published,     setPublished]     = useState(false);

  const myClasses   = classes.filter(c => teacherProfile.assignments.some(a => a.classId === c.id));
  const mySubject   = subjects[0] ?? { id: 'physics', label: 'Physics' };
  const chapters    = CHAPTERS_MAP[mySubject.id] ?? [];
  const batchList   = BATCHES_MAP[classId] ?? [];

  const toggleBatch = (b: string) =>
    setBatchIds(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);

  const setBlueprintVal = (chapter: string, diff: string, val: number) =>
    setBlueprint(prev => ({ ...prev, [chapter]: { ...(prev[chapter] ?? {}), [diff]: Math.max(0, val) } }));

  const getBlueprintTotal = (chapter: string) =>
    DIFFICULTIES.reduce((acc, d) => acc + (blueprint[chapter]?.[d] ?? 0), 0);

  const totalQuestions = chapters.reduce((acc, ch) => acc + getBlueprintTotal(ch), 0);

  const toggleQ = (id: string) =>
    setSelectedQIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const canNextStep0 = classId && batchIds.length > 0 && examType && totalMarks && duration;
  const canNextStep1 = totalQuestions > 0;

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] animate-fadein gap-4">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <h2 className="text-[20px] font-bold text-slate-800">Paper Published!</h2>
        <p className="text-[13px] text-slate-500">Assigned to {batchIds.join(', ')} · {examType}</p>
        <button onClick={() => { setPublished(false); setStep(0); setClassId(''); setBatchIds([]); setExamType(''); setBlueprint({}); setSelectedQIds([]); }}
          className="mt-2 px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors">
          Create Another Paper
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fadein space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Paper Builder</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">Build and publish test papers for your batches step by step.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[12.5px] font-bold transition-all ${
              step === i ? 'bg-indigo-600 text-white shadow-sm' :
              step > i   ? 'text-emerald-600 bg-emerald-50'      :
                           'text-slate-400 bg-slate-50'
            }`}>
              {step > i ? <Check className="w-3.5 h-3.5" /> : <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px]">{i+1}</span>}
              <span className="hidden sm:block">{s}</span>
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="w-4 h-4 text-slate-300 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── STEP 0: Context ─────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="max-w-lg space-y-5 animate-fadein">
          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-2">Class *</label>
            <div className="flex gap-3">
              {myClasses.map(c => (
                <button key={c.id} onClick={() => { setClassId(c.id); setBatchIds([]); }}
                  className={`px-6 py-2.5 rounded-xl text-[13px] font-bold border transition-all ${
                    classId === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-700 hover:border-indigo-300'
                  }`}>{c.label}</button>
              ))}
            </div>
          </div>

          {classId && (
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-2">Assign to Batches *</label>
              <div className="flex flex-wrap gap-2">
                {batchList.map(b => (
                  <button key={b} onClick={() => toggleBatch(b)}
                    className={`px-5 py-2 rounded-xl text-[13px] font-bold border transition-all ${
                      batchIds.includes(b) ? 'bg-indigo-50 text-indigo-700 border-indigo-300' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}>{b} {batchIds.includes(b) && <Check className="w-3 h-3 inline ml-1" />}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-2">Subject</label>
            <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[13px] text-slate-600 font-semibold">
              {mySubject.label} (auto-set)
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-bold text-slate-600 mb-2">Exam Type *</label>
            <div className="flex flex-wrap gap-2">
              {EXAM_TYPES.map(et => (
                <button key={et} onClick={() => setExamType(et)}
                  className={`px-4 py-2 rounded-xl text-[12.5px] font-bold border transition-all ${
                    examType === et ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>{et}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-2">Total Marks *</label>
              <input type="number" value={totalMarks} onChange={e => setTotalMarks(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-2">Duration (min) *</label>
              <input type="number" value={duration} onChange={e => setDuration(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-400/30" />
            </div>
          </div>

          <button disabled={!canNextStep0} onClick={() => setStep(1)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Next: Blueprint <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── STEP 1: Blueprint ───────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5 animate-fadein">
          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl text-[13px] text-indigo-800 flex items-start gap-2">
            <Sparkles className="w-4 h-4 mt-0.5 text-indigo-500 flex-shrink-0" />
            <p>Set the number of questions per topic and difficulty. <strong>AI Tip:</strong> Add more Rotational Motion questions — 18 students are weak in this topic.</p>
          </div>

          <div className="card border border-slate-100 rounded-2xl overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Chapter</th>
                  {DIFFICULTIES.map(d => (
                    <th key={d} className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-4">{d}</th>
                  ))}
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {chapters.map(ch => (
                  <tr key={ch} className="hover:bg-slate-50/40">
                    <td className="py-4 px-5 font-semibold text-slate-800">{ch}</td>
                    {DIFFICULTIES.map(d => (
                      <td key={d} className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => setBlueprintVal(ch, d, (blueprint[ch]?.[d] ?? 0) - 1)}
                            className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
                            <Minus className="w-3 h-3 text-slate-500" />
                          </button>
                          <span className="w-6 text-center font-bold text-slate-800">{blueprint[ch]?.[d] ?? 0}</span>
                          <button onClick={() => setBlueprintVal(ch, d, (blueprint[ch]?.[d] ?? 0) + 1)}
                            className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition-colors">
                            <Plus className="w-3 h-3 text-slate-500" />
                          </button>
                        </div>
                      </td>
                    ))}
                    <td className="py-4 px-5 text-center">
                      <span className={`font-black text-[15px] ${getBlueprintTotal(ch) > 0 ? 'text-indigo-600' : 'text-slate-300'}`}>
                        {getBlueprintTotal(ch)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t border-slate-100">
                  <td colSpan={4} className="py-3 px-5 text-[12px] font-bold text-slate-600">Total Questions</td>
                  <td className="py-3 px-5 text-center text-[16px] font-black text-indigo-600">{totalQuestions}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(0)} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button disabled={!canNextStep1} onClick={() => setStep(2)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Next: Select Questions <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Questions ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-4 animate-fadein">
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-slate-600">{selectedQIds.length} questions selected</p>
            <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-50 text-indigo-700 text-[12.5px] font-bold rounded-xl hover:bg-indigo-100 transition-colors border border-indigo-100">
              <Sparkles className="w-3.5 h-3.5" /> AI Auto-Select
            </button>
          </div>

          <div className="card border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="py-3 px-5 w-10" />
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Question</th>
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden sm:table-cell">Topic</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Type</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Diff</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Used</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {questions.map(q => {
                  const sel = selectedQIds.includes(q.id);
                  return (
                    <tr key={q.id} onClick={() => toggleQ(q.id)}
                      className={`cursor-pointer transition-colors ${sel ? 'bg-indigo-50/40' : 'hover:bg-slate-50/40'}`}>
                      <td className="py-3.5 px-5">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          sel ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                        }`}>
                          {sel && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </td>
                      <td className="py-3.5 px-3">
                        <p className="text-[12.5px] font-semibold text-slate-800">{q.id}</p>
                        <p className="text-[11px] text-slate-500">{q.source}</p>
                      </td>
                      <td className="py-3.5 px-3 hidden sm:table-cell">
                        <p className="text-[12px] font-semibold text-slate-700">{q.chapter}</p>
                        <p className="text-[11px] text-slate-500">{q.topic}</p>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          q.type === 'mcq' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                        }`}>{q.type}</span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                          q.difficulty === 'hard'   ? 'bg-rose-100 text-rose-700'     :
                          q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700'   :
                                                      'bg-emerald-100 text-emerald-700'
                        }`}>{q.difficulty}</span>
                      </td>
                      <td className="py-3.5 px-5 text-center text-slate-500">{q.usedCount}×</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button disabled={selectedQIds.length === 0} onClick={() => setStep(3)}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              Preview Paper <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Preview & Publish ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-6 animate-fadein">
          <div className="border border-slate-100 rounded-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-slate-800">{examType} — {mySubject.label}</h2>
                <p className="text-[13px] text-slate-500 mt-0.5">
                  Class {classId} · Batches: {batchIds.join(', ')} · {totalMarks} Marks · {duration} mins
                </p>
              </div>
              <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-slate-600 text-[12px] font-bold rounded-xl hover:bg-slate-50">
                <Eye className="w-3.5 h-3.5" /> Full Preview
              </button>
            </div>
            <div className="border-t border-slate-100 pt-4 space-y-2">
              {questions.filter(q => selectedQIds.includes(q.id)).map((q, i) => (
                <div key={q.id} className="flex items-center gap-3 py-2">
                  <span className="text-[12px] text-slate-400 w-5 text-right">{i+1}.</span>
                  <div className="flex-1">
                    <span className="text-[12.5px] font-semibold text-slate-700">[{q.id}]</span>
                    <span className="text-[12.5px] text-slate-600 ml-2">{q.chapter} → {q.topic}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                      q.difficulty === 'hard'   ? 'bg-rose-100 text-rose-700'     :
                      q.difficulty === 'medium' ? 'bg-amber-100 text-amber-700'   :
                                                  'bg-emerald-100 text-emerald-700'
                    }`}>{q.difficulty}</span>
                    <button className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 text-slate-600 text-[13px] font-bold rounded-xl hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => setPublished(true)}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white text-[13px] font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-sm">
              <Check className="w-4 h-4" /> Publish Paper
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
