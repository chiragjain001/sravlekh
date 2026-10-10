'use client';

import React, { useState, useMemo, useEffect } from 'react';
import axios from 'axios';
import {
  X,
  BookOpen,
  Send,
  Check,
  CheckSquare,
  Square,
  Users,
  Layers,
  Sparkles,
  FileText,
  AlertCircle,
  Loader2,
  Search,
  Calendar as CalendarIcon,
  HelpCircle,
  Bookmark,
  Edit3,
  GraduationCap,
} from 'lucide-react';
import {
  useBatches,
  useSubjects,
  useMyTeacherProfile,
  useCreateAssignmentsForBatch,
} from '@/hooks/useApi';
import { DatePicker } from '@/components/ui/DatePicker';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
import { MarqueeText } from '@/components/ui/MarqueeText';

function extractMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: { message?: string } } | undefined;
    return data?.error?.message ?? data?.message ?? fallback;
  }
  return fallback;
}

function getBatchClassYear(b: any): string {
  if (b.classYear && String(b.classYear).trim()) {
    const cy = String(b.classYear).trim();
    return cy.toLowerCase().startsWith('class') ? cy : `Class ${cy}`;
  }
  const name = b.name || '';
  const classMatch = name.match(/Class\s*(\d+[A-Za-z]?)/i);
  if (classMatch) return `Class ${classMatch[1]}`;
  const thMatch = name.match(/(\d+)(?:st|nd|rd|th)/i);
  if (thMatch) return `Class ${thMatch[1]}`;
  if (name.includes('-')) return name.split('-')[0]!.trim();
  return name.trim() || 'Class 10';
}

function getBatchSectionName(b: any): string {
  if (b.section && String(b.section).trim()) {
    return String(b.section).trim();
  }
  const name = b.name || '';
  if (name.includes('-')) {
    return name.split('-').slice(1).join('-').trim();
  }
  return name.trim();
}

const INSTRUCTION_TEMPLATES = [
  {
    icon: <BookOpen className="w-3.5 h-3.5 text-indigo-600" />,
    label: 'Textbook Exercises',
    text: 'Complete all questions and numericals from the back-of-chapter textbook exercises in your notebook.',
  },
  {
    icon: <FileText className="w-3.5 h-3.5 text-amber-600" />,
    label: 'Practice Problems',
    text: 'Solve the assigned problem set. Write neat step-by-step solutions for submission.',
  },
  {
    icon: <Edit3 className="w-3.5 h-3.5 text-emerald-600" />,
    label: 'Read & Notes',
    text: 'Read the chapter thoroughly and prepare summary notes with key definitions and formulas.',
  },
  {
    icon: <HelpCircle className="w-3.5 h-3.5 text-blue-600" />,
    label: 'Doubt Worksheet',
    text: 'Attempt all chapter problems and highlight questions where you faced difficulty for class review.',
  },
];

interface CreateAssignmentModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  defaultBatchId?: string;
}

export function CreateAssignmentModal({
  onClose,
  onSuccess,
  defaultBatchId,
}: CreateAssignmentModalProps) {
  // ── Data Fetching ──────────────────────────────────────────────────────────
  const { data: batchesResp, isLoading: batchesLoading } = useBatches();
  const allBatches: any[] = batchesResp?.data ?? batchesResp ?? [];

  const { data: profile, isLoading: profileLoading } = useMyTeacherProfile();

  const { data: subjectsResp, isLoading: subjectsLoading } = useSubjects();
  const allSubjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];

  const createAssignments = useCreateAssignmentsForBatch();

  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>(
    defaultBatchId ? [defaultBatchId] : []
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [chapterSearch, setChapterSearch] = useState<string>('');

  const [title, setTitle] = useState<string>('');
  const [hasUserEditedTitle, setHasUserEditedTitle] = useState(false);
  const [description, setDescription] = useState<string>('');

  const [dueDate, setDueDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 1. Teacher-Specific Batches & Class Grouping ─────────────────────────
  const availableBatches = useMemo(() => {
    if (!profile) return allBatches;
    const teacherBatchIds = new Set(
      (profile.batchAssignments ?? [])
        .filter((a: any) => !a.removedAt)
        .map((a: any) => a.batchId)
    );
    if (teacherBatchIds.size === 0) return allBatches;
    return allBatches.filter((b: any) => teacherBatchIds.has(b.id));
  }, [allBatches, profile]);

  // Group teacher's batches by Class (e.g. "Class 10" -> [Section A, Section B])
  const batchesByClass = useMemo(() => {
    const map = new Map<string, any[]>();
    availableBatches.forEach((b: any) => {
      const cls = getBatchClassYear(b);
      if (!map.has(cls)) map.set(cls, []);
      map.get(cls)!.push(b);
    });
    return map;
  }, [availableBatches]);

  const teacherClasses = useMemo(() => Array.from(batchesByClass.keys()), [batchesByClass]);

  const [activeClass, setActiveClass] = useState<string>('');

  // When opening: if defaultBatchId provided, set activeClass to its class & select it
  useEffect(() => {
    if (defaultBatchId) {
      const bObj = availableBatches.find((b: any) => b.id === defaultBatchId);
      if (bObj) {
        const cls = getBatchClassYear(bObj);
        setActiveClass(cls);
        setSelectedBatchIds([defaultBatchId]);
        return;
      }
    }

    if (teacherClasses.length > 0 && (!activeClass || !teacherClasses.includes(activeClass))) {
      const firstCls = teacherClasses[0]!;
      setActiveClass(firstCls);
      const secs = batchesByClass.get(firstCls) || [];
      if (secs.length > 0) {
        setSelectedBatchIds([secs[0]!.id]);
      }
    }
  }, [defaultBatchId, availableBatches, teacherClasses, batchesByClass]);

  // When teacher switches activeClass, reset selected batches to that class only
  const handleClassChange = (newCls: string) => {
    setActiveClass(newCls);
    const secs = batchesByClass.get(newCls) || [];
    if (secs.length > 0) {
      setSelectedBatchIds([secs[0]!.id]);
    } else {
      setSelectedBatchIds([]);
    }
  };

  // Only sections of activeClass are displayed
  const currentClassSections = useMemo(() => {
    return batchesByClass.get(activeClass) || [];
  }, [batchesByClass, activeClass]);

  // Total student count across selected sections of activeClass
  const totalStudents = useMemo(() => {
    return currentClassSections
      .filter((b: any) => selectedBatchIds.includes(b.id))
      .reduce((sum: number, b: any) => sum + (b._count?.students ?? 0), 0);
  }, [currentClassSections, selectedBatchIds]);

  // ── 2. Teacher-Specific Subjects ──────────────────────────────────────────
  const availableSubjects = useMemo(() => {
    if (!profile) return allSubjects;

    // First collect teacher's assigned subject IDs
    const teacherSubjectIds = new Set<string>();
    if (Array.isArray(profile.subjectIds)) {
      profile.subjectIds.forEach((id: string) => teacherSubjectIds.add(id));
    }

    // Also check batch assignments for subject linkage
    (profile.batchAssignments ?? []).forEach((ba: any) => {
      if (ba.subjectId && !ba.removedAt) {
        // If specific batches are selected, only include subjects taught for those batches
        if (selectedBatchIds.length === 0 || selectedBatchIds.includes(ba.batchId)) {
          teacherSubjectIds.add(ba.subjectId);
        }
      }
    });

    if (teacherSubjectIds.size === 0) return allSubjects;
    return allSubjects.filter((s: any) => teacherSubjectIds.has(s.id));
  }, [allSubjects, profile, selectedBatchIds]);

  // Pre-select subject if only one available
  useEffect(() => {
    if (availableSubjects.length === 1 && availableSubjects[0] && !selectedSubjectId) {
      setSelectedSubjectId(availableSubjects[0].id);
    } else if (
      selectedSubjectId &&
      !availableSubjects.some((s: any) => s.id === selectedSubjectId)
    ) {
      // If previous subject is no longer in available list, reset it
      setSelectedSubjectId(availableSubjects[0]?.id ?? '');
    }
  }, [availableSubjects, selectedSubjectId]);

  // ── 3. Chapter Selection ──────────────────────────────────────────────────
  const activeSubject = useMemo(() => {
    return availableSubjects.find((s: any) => s.id === selectedSubjectId) ?? null;
  }, [availableSubjects, selectedSubjectId]);

  const availableChapters = useMemo(() => {
    if (!activeSubject) return [];
    return activeSubject.chapters ?? [];
  }, [activeSubject]);

  const filteredChapters = useMemo(() => {
    if (!chapterSearch.trim()) return availableChapters;
    const query = chapterSearch.toLowerCase();
    return availableChapters.filter((c: any) =>
      c.name.toLowerCase().includes(query)
    );
  }, [availableChapters, chapterSearch]);

  const selectedChapters = useMemo(() => {
    return availableChapters.filter((c: any) => selectedChapterIds.includes(c.id));
  }, [availableChapters, selectedChapterIds]);

  // Clear chapter selections when subject changes
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setSelectedChapterIds([]);
    setChapterSearch('');
  };

  // ── Auto-Title Suggestion ─────────────────────────────────────────────────
  useEffect(() => {
    if (activeSubject && selectedChapters.length > 0 && !hasUserEditedTitle) {
      const names = selectedChapters.map((c: any) => c.name).join(', ');
      const conciseNames = names.length > 35 ? names.slice(0, 32) + '…' : names;
      setTitle(`${activeSubject.name}: ${conciseNames} — Homework`);
    }
  }, [activeSubject, selectedChapters, hasUserEditedTitle]);

  // ── Toggle Helpers ────────────────────────────────────────────────────────
  const toggleBatch = (id: string) => {
    setSelectedBatchIds(prev =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter(b => b !== id)
          : prev
        : [...prev, id]
    );
  };

  const selectAllBatches = () => {
    if (selectedBatchIds.length === currentClassSections.length) {
      if (currentClassSections.length > 0) {
        setSelectedBatchIds([currentClassSections[0]!.id]);
      }
    } else {
      setSelectedBatchIds(currentClassSections.map((b: any) => b.id));
    }
  };

  const toggleChapter = (id: string) => {
    setSelectedChapterIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const selectAllChapters = () => {
    if (selectedChapterIds.length === availableChapters.length) {
      setSelectedChapterIds([]);
    } else {
      setSelectedChapterIds(availableChapters.map((c: any) => c.id));
    }
  };

  // ── Validation & Submission ───────────────────────────────────────────────
  const isValid =
    selectedBatchIds.length > 0 &&
    !!selectedSubjectId &&
    selectedChapterIds.length > 0 &&
    !!title.trim() &&
    !!dueDate;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setError(null);
    setIsSubmitting(true);

    try {
      // Find the first topic from the selected chapter(s) for database schema requirement
      let topicId: string | undefined = undefined;
      for (const chId of selectedChapterIds) {
        const ch = availableChapters.find((c: any) => c.id === chId);
        if (ch && ch.topics && ch.topics.length > 0 && ch.topics[0]) {
          topicId = ch.topics[0].id;
          break;
        }
      }

      await createAssignments.mutateAsync({
        batchIds: selectedBatchIds,
        chapterIds: selectedChapterIds,
        topicId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: new Date(dueDate).toISOString(),
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(extractMessage(err, 'Failed to create assignment. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isInitialLoading = (batchesLoading || profileLoading || subjectsLoading) && availableBatches.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── Modal Header (Apple-inspired clean bar) ─────────────────────── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 flex-shrink-0 bg-white z-10 relative">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] sm:text-[17px] font-bold text-slate-900 leading-tight truncate">
                Create Assignment
              </h2>
              <p className="text-[11.5px] sm:text-[12px] text-slate-500 truncate">
                Quickly assign homework & chapter exercises to your classes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors flex-shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Form Body (Smooth scrollable content with roomy element spacing) ── */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 sm:p-6 flex flex-col gap-5 sm:gap-6">
          {isInitialLoading ? (
            <div className="space-y-4 py-8">
              <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-1/3" />
              <div className="flex gap-2">
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse flex-1" />
                <div className="h-10 bg-slate-100 rounded-xl animate-pulse flex-1" />
              </div>
              <div className="h-4 bg-slate-100 rounded-lg animate-pulse w-1/4 mt-4" />
              <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <>
              {/* ── 1. Target Class & Sections ───────────────────────────── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Class & Sections <span className="text-rose-500">*</span>
                  </label>
                  {currentClassSections.length > 1 && (
                    <button
                      type="button"
                      onClick={selectAllBatches}
                      className="text-[11.5px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                    >
                      {selectedBatchIds.length === currentClassSections.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                  )}
                </div>

                {/* Class selector pills (if teacher teaches multiple classes) */}
                {teacherClasses.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                    {teacherClasses.map((cls) => {
                      const isAct = cls === activeClass;
                      return (
                        <button
                          key={cls}
                          type="button"
                          onClick={() => handleClassChange(cls)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 ${
                            isAct
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200/80 text-slate-600'
                          }`}
                        >
                          {cls}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sections of the selected class ONLY — compact, 1-tap multi-select chips */}
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  {currentClassSections.length === 0 ? (
                    <span className="text-xs text-amber-600">No sections found for {activeClass}.</span>
                  ) : (
                    currentClassSections.map((b: any) => {
                      const isSelected = selectedBatchIds.includes(b.id);
                      const sectionName = getBatchSectionName(b);
                      const studentCount = b._count?.students ?? 0;

                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleBatch(b.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none flex items-center gap-2 border ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs ring-1 ring-indigo-500/20'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span>Section {sectionName}</span>
                        </button>
                      );
                    })
                  )}
                </div>

                {selectedBatchIds.length > 0 && (
                  <p className="text-[11px] text-slate-500 font-medium pt-0.5">
                    {selectedBatchIds.length} section{selectedBatchIds.length > 1 ? 's' : ''} selected of {activeClass}
                  </p>
                )}
              </div>

              {/* ── 2. Teacher-Specific Subject ───────────────────────────── */}
              <div className="space-y-2">
                <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  Subject <span className="text-rose-500">*</span>
                  <span className="text-[10.5px] font-normal text-slate-400">
                    (Your assigned subjects)
                  </span>
                </label>

                {availableSubjects.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">
                    No curriculum subjects assigned to you for the selected class.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {availableSubjects.map((s: any) => {
                      const isSelected = selectedSubjectId === s.id;
                      const chapterCount = (s.chapters ?? []).length;

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSubjectChange(s.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12.5px] font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate max-w-[160px]">{s.name}</span>
                          <span className={`text-[10.5px] px-1.5 py-0.2 rounded-md ${
                            isSelected ? 'bg-white/20 text-slate-100' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {chapterCount} ch
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── 3. Multi-Chapter Selection ────────────────────────────── */}
              {selectedSubjectId && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                      Select Chapters <span className="text-rose-500">*</span>
                      {selectedChapterIds.length > 0 && (
                        <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          {selectedChapterIds.length} selected
                        </span>
                      )}
                    </label>

                    {availableChapters.length > 1 && (
                      <button
                        type="button"
                        onClick={selectAllChapters}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        {selectedChapterIds.length === availableChapters.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </button>
                    )}
                  </div>

                  {/* Optional quick chapter search if > 4 chapters */}
                  {availableChapters.length > 4 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search chapter name…"
                        value={chapterSearch}
                        onChange={e => setChapterSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                      />
                    </div>
                  )}

                  {availableChapters.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-500 text-center">
                      No chapters added under this subject yet.
                    </div>
                  ) : filteredChapters.length === 0 ? (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] text-slate-500 text-center">
                      No matching chapters found.
                    </div>
                  ) : (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar bg-slate-50/70 border border-slate-200/80 rounded-2xl p-2 space-y-1">
                      {filteredChapters.map((c: any, index: number) => {
                        const isSelected = selectedChapterIds.includes(c.id);

                        return (
                          <div
                            key={c.id}
                            onClick={() => toggleChapter(c.id)}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer transition-all border ${
                              isSelected
                                ? 'bg-white border-indigo-200 text-indigo-900 shadow-2xs font-semibold'
                                : 'border-transparent hover:bg-white/80 text-slate-700'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${
                              isSelected ? 'bg-indigo-600 text-white' : 'border border-slate-300 text-transparent'
                            }`}>
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>

                            <span className="text-[11px] font-bold text-slate-400 w-6 flex-shrink-0">
                              #{index + 1}
                            </span>

                            <div className="flex-1 min-w-0">
                              <span className="text-[12.5px] truncate block" title={c.name}>
                                {c.name}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── 4. Title & Quick Instruction Templates ────────────────── */}
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-[12px] font-bold text-slate-700 mb-1.5">
                    Assignment Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    value={title}
                    onChange={e => {
                      setTitle(e.target.value);
                      setHasUserEditedTitle(true);
                    }}
                    placeholder="e.g. Physics: Laws of Motion — Homework"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
                  />
                </div>

                {/* 1-Tap Quick Instruction Style Presets (Teacher-friendly) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-600" />
                      Instructions (Optional)
                    </label>
                    <span className="text-[11px] text-slate-400">1-tap presets available below</span>
                  </div>

                  <textarea
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Add guidelines for students, e.g. 'Solve Q1 to Q10 in your homework notebook and bring tomorrow'…"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all"
                  />

                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {INSTRUCTION_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setDescription(tpl.text)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border border-slate-200/60 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>{tpl.icon}</span>
                        <span>{tpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── 5. Modern Due Date (Shared DatePicker) ───────────────── */}
              <div className="pt-1 border-t border-slate-100">
                <DatePicker
                  label="Due Date"
                  required
                  value={dueDate}
                  onChange={setDueDate}
                  minDate={new Date().toISOString().split('T')[0]}
                  placeholder="Select assignment due date…"
                  quickPresets={true}
                  placement="top"
                />
              </div>

              {/* Error display */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-[12.5px] font-semibold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </form>

        {/* ── Modal Footer (Sticky bottom action bar) ─────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0 z-10 relative">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-[13px] font-bold rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
            className="flex-1 sm:flex-initial sm:min-w-[190px] py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-bold rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Publishing…</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Publish Assignment</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
