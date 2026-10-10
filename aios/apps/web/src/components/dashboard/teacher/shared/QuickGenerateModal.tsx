'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Zap,
  Loader2,
  BookOpen,
  Check,
  Search,
  Users,
  ChevronDown,
  Sparkles,
  Plus,
  Minus,
} from 'lucide-react';
import { useMyTeacherProfile } from '@/hooks/useApi';

interface QuickGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: any[];
  batches: any[];
  onGenerate: (data: {
    batchId?: string;
    batchIds: string[];
    subjectId: string;
    chapterIds: string[];
    title: string;
    questionCount: number;
  }) => void;
  isGenerating?: boolean;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolves a clean, human-friendly, and collision-free label for a batch inside a class group.
 * Ensures:
 * 1. Standard class sections (e.g. "Class 11 - Section A") display as "Section A".
 * 2. Specialized or custom batches (e.g. "JEE Mains 2026 - Batch Alpha") preserve their
 *    distinctive name and never get collapsed into a generic "Section A".
 * 3. ZERO duplicate labels within the same class group — collisions are automatically disambiguated.
 */
export function getBatchDisplayLabel(
  batch: { id: string; name: string; section?: string; classYear?: string },
  groupName: string,
  groupBatches: { id: string; name: string; section?: string; classYear?: string }[]
): string {
  const name = (batch.name || '').trim();
  const section = (batch.section || '').trim();

  // Test if batch name is standard class & section format:
  // e.g. "Class 11 - Section A", "Class 11 Section A", "Class 11 - A", "Section A", or "A"
  const cleanGroup = groupName.replace(/^(class|grade|standard|year)\s+/i, '').trim();
  const classPrefixRegex = new RegExp(
    `^(?:${escapeRegExp(groupName)}|Class\\s+${cleanGroup}|Grade\\s+${cleanGroup})\\s*[-–—:]?\\s*`,
    'i'
  );

  const isDirectClassMatch = classPrefixRegex.test(name);
  const remainder = isDirectClassMatch ? name.replace(classPrefixRegex, '').trim() : name;
  const sectionMatch = remainder.match(/^(?:section\s+)?([A-Za-z0-9]+)$/i);

  let candidate = '';
  if (sectionMatch && sectionMatch[1]) {
    candidate = `Section ${sectionMatch[1].toUpperCase()}`;
  } else if (isDirectClassMatch && remainder) {
    candidate = remainder;
  } else if (!isDirectClassMatch) {
    // Custom specialty batch (e.g. "JEE Mains 2026 - Batch Alpha")
    // Keep its distinctive name so it NEVER masquerades as a generic section!
    candidate = name;
  } else {
    candidate = section ? `Section ${section.toUpperCase()}` : name;
  }

  // Collision detection: Check if any other batch in this group evaluates to the same candidate
  const hasCollision = groupBatches.some((other) => {
    if (other.id === batch.id) return false;
    const otherName = (other.name || '').trim();
    const otherDirect = classPrefixRegex.test(otherName);
    const otherRemainder = otherDirect ? otherName.replace(classPrefixRegex, '').trim() : otherName;
    const otherMatch = otherRemainder.match(/^(?:section\s+)?([A-Za-z0-9]+)$/i);
    let otherCandidate = '';
    if (otherMatch && otherMatch[1]) {
      otherCandidate = `Section ${otherMatch[1].toUpperCase()}`;
    } else if (otherDirect && otherRemainder) {
      otherCandidate = otherRemainder;
    } else if (!otherDirect) {
      otherCandidate = otherName;
    } else {
      otherCandidate = other.section ? `Section ${other.section.toUpperCase()}` : otherName;
    }
    return otherCandidate.toLowerCase() === candidate.toLowerCase();
  });

  if (hasCollision) {
    // If collision exists, use the full distinctive batch name
    if (name && name.toLowerCase() !== candidate.toLowerCase()) {
      return name;
    }
    if (section && !candidate.toLowerCase().includes(section.toLowerCase())) {
      return `${name} (${section.toUpperCase()})`;
    }
  }

  return candidate;
}

export function QuickGenerateModal({
  isOpen,
  onClose,
  subjects,
  batches,
  onGenerate,
  isGenerating,
}: QuickGenerateModalProps) {
  const { data: profile } = useMyTeacherProfile();

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [questionCount, setQuestionCount] = useState<number>(10);

  // Dropdown popover states
  const [showBatchDropdown, setShowBatchDropdown] = useState(false);
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [batchSearch, setBatchSearch] = useState('');

  const batchDropdownRef = useRef<HTMLDivElement>(null);
  const subjectDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click or ESC key
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target as Node)) {
        setShowBatchDropdown(false);
      }
      if (subjectDropdownRef.current && !subjectDropdownRef.current.contains(e.target as Node)) {
        setShowSubjectDropdown(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBatchDropdown(false);
        setShowSubjectDropdown(false);
      }
    };

    if (showBatchDropdown || showSubjectDropdown) {
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showBatchDropdown, showSubjectDropdown]);

  // Teacher's assigned subjects: derived from teacherProfile.subjectIds + batch assignments
  const teacherAssignedSubjects = useMemo(() => {
    const profileSubjectIds: string[] = Array.isArray(profile?.subjectIds) ? profile.subjectIds : [];

    const batchAssignments = profile?.batchAssignments ?? [];
    const batchSubjectIds = batchAssignments
      .filter((a: any) => !a.removedAt && a.subjectId)
      .map((a: any) => a.subjectId as string);

    const allAssignedIds = Array.from(new Set([...profileSubjectIds, ...batchSubjectIds]));

    if (allAssignedIds.length > 0) {
      const matched = subjects.filter((s: any) => allAssignedIds.includes(s.id));
      if (matched.length > 0) return matched;
    }

    // Fallback: Subjects with curriculum or all subjects
    const withCurriculum = subjects.filter((s: any) => (s.chapters ?? []).length > 0);
    return withCurriculum.length > 0 ? withCurriculum : subjects;
  }, [profile, subjects]);

  // Auto-select first assigned subject and default batch if available
  useEffect(() => {
    if (isOpen && teacherAssignedSubjects.length > 0 && !subjectId) {
      const first = teacherAssignedSubjects[0];
      setSubjectId(first.id);
      setTitle(`${first.name} Quick Quiz`);
      if (Array.isArray(first.chapters) && first.chapters.length > 0) {
        setChapterIds(first.chapters.slice(0, 2).map((c: any) => c.id));
      }
    }
  }, [isOpen, teacherAssignedSubjects, subjectId]);

  // Filter batches to those assigned or available
  const teacherBatches = useMemo(() => {
    if (profile?.batchAssignments && profile.batchAssignments.length > 0) {
      const assignedIds = new Set(
        profile.batchAssignments
          .filter((a: any) => !a.removedAt)
          .map((a: any) => a.batchId || a.batch?.id)
          .filter(Boolean)
      );
      const assigned = batches.filter((b) => assignedIds.has(b.id));
      if (assigned.length > 0) return assigned;
    }
    return batches;
  }, [profile, batches]);

  // Group batches by Class / Grade
  const groupedBatches = useMemo(() => {
    // 1. Deduplicate teacherBatches by ID
    const seenIds = new Set<string>();
    const uniqueBatches = teacherBatches.filter((b) => {
      if (!b?.id || seenIds.has(b.id)) return false;
      seenIds.add(b.id);
      return true;
    });

    const groups: Record<string, typeof teacherBatches> = {};
    uniqueBatches.forEach((b) => {
      let groupName = b.classYear || '';
      if (!groupName) {
        const match = b.name.match(/^(Class \d+|Grade \d+|Standard \d+|Year \d+)/i);
        groupName = match && match[1] ? match[1] : 'Other Classes';
      }
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName]!.push(b);
    });

    // 2. In each group, deduplicate if two batches have identical name & section,
    // and sort so standard sections (Section A, B, C...) come first, followed by specialty batches!
    const cleanedGroups: Record<string, typeof teacherBatches> = {};
    Object.entries(groups).forEach(([groupName, list]) => {
      const seenKeys = new Set<string>();
      const deduped = list.filter((b) => {
        const key = `${(b.name || '').trim().toLowerCase()}:::${(b.section || '').trim().toLowerCase()}`;
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      deduped.sort((a, b) => {
        const labelA = getBatchDisplayLabel(a, groupName, deduped);
        const labelB = getBatchDisplayLabel(b, groupName, deduped);
        const isStdA = /^Section\s+[A-Za-z0-9]+$/i.test(labelA);
        const isStdB = /^Section\s+[A-Za-z0-9]+$/i.test(labelB);
        if (isStdA && !isStdB) return -1;
        if (!isStdA && isStdB) return 1;
        return labelA.localeCompare(labelB, undefined, { numeric: true });
      });

      cleanedGroups[groupName] = deduped;
    });

    return cleanedGroups;
  }, [teacherBatches]);

  // Filtered grouped batches by search query
  const filteredGroupedBatches = useMemo(() => {
    if (!batchSearch.trim()) return groupedBatches;
    const term = batchSearch.toLowerCase();
    const result: Record<string, typeof teacherBatches> = {};

    Object.entries(groupedBatches).forEach(([groupName, batchesInGroup]) => {
      const groupMatches = groupName.toLowerCase().includes(term);
      const matching = batchesInGroup.filter(
        (b) =>
          groupMatches ||
          b.name.toLowerCase().includes(term) ||
          (b.section && b.section.toLowerCase().includes(term)) ||
          getBatchDisplayLabel(b, groupName, batchesInGroup).toLowerCase().includes(term)
      );
      if (matching.length > 0) {
        result[groupName] = matching;
      }
    });

    return result;
  }, [groupedBatches, batchSearch]);

  // Selected batches summary display text
  const selectedBatchesDisplayText = useMemo(() => {
    if (selectedBatchIds.length === 0) return 'Select Classes & Sections...';

    const selectedBatches = teacherBatches.filter((b) => selectedBatchIds.includes(b.id));
    if (selectedBatches.length === 1) return selectedBatches[0].name;

    const displayParts: string[] = [];
    const accountedIds = new Set<string>();

    Object.entries(groupedBatches).forEach(([groupName, batchesInGroup]) => {
      const groupBatchIds = batchesInGroup.map((b) => b.id);
      const allChecked =
        groupBatchIds.length > 0 &&
        groupBatchIds.every((id) => selectedBatchIds.includes(id));

      if (allChecked) {
        displayParts.push(groupName);
        groupBatchIds.forEach((id) => accountedIds.add(id));
      } else {
        const selectedInGroup = batchesInGroup.filter((b) => selectedBatchIds.includes(b.id));
        if (selectedInGroup.length > 0) {
          const sectionLabels = selectedInGroup.map((b) =>
            getBatchDisplayLabel(b, groupName, batchesInGroup).replace(/^Section\s+/i, 'Sec ')
          );
          displayParts.push(`${groupName} (${sectionLabels.join(', ')})`);
          selectedInGroup.forEach((b) => accountedIds.add(b.id));
        }
      }
    });

    const leftover = selectedBatches.filter((b) => !accountedIds.has(b.id));
    if (leftover.length > 0) {
      displayParts.push(...leftover.map((b) => b.name));
    }

    return displayParts.join(', ');
  }, [selectedBatchIds, teacherBatches, groupedBatches]);

  if (!isOpen) return null;

  const activeSubject = subjects.find((s) => s.id === subjectId) || teacherAssignedSubjects.find((s) => s.id === subjectId);
  const chapters: any[] = activeSubject?.chapters ?? [];

  const handleSubjectChange = (newSubId: string) => {
    setSubjectId(newSubId);
    setShowSubjectDropdown(false);
    const chosen = subjects.find((s) => s.id === newSubId);
    if (chosen) {
      setTitle(`${chosen.name} Quick Quiz`);
      if (Array.isArray(chosen.chapters) && chosen.chapters.length > 0) {
        setChapterIds(chosen.chapters.slice(0, 2).map((c: any) => c.id));
      } else {
        setChapterIds([]);
      }
    }
  };

  const handleGenerate = () => {
    if (selectedBatchIds.length === 0) {
      alert('Please select at least one Class / Section.');
      return;
    }
    if (!subjectId) {
      alert('Please select a Subject.');
      return;
    }
    if (chapterIds.length === 0) {
      alert('Please select at least one Chapter.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter an Assessment Title.');
      return;
    }
    if (questionCount <= 0) {
      alert('Please specify a valid question count.');
      return;
    }

    onGenerate({
      batchId: selectedBatchIds[0] || '',
      batchIds: selectedBatchIds,
      subjectId,
      chapterIds,
      title: title.trim(),
      questionCount,
    });
  };

  const toggleChapter = (id: string) => {
    setChapterIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const selectAllChapters = () => {
    if (chapterIds.length === chapters.length) {
      setChapterIds([]);
    } else {
      setChapterIds(chapters.map((c: any) => c.id));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl relative border border-slate-200/90 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close modal"
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors z-10 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-3.5 border-b border-slate-100 flex-shrink-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <Zap className="w-5 h-5 fill-indigo-600/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] sm:text-[18px] font-bold text-slate-800 tracking-tight">
                Quick Generate
              </h3>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                AI Fast Track
              </span>
            </div>
            <p className="text-[12px] sm:text-[12.5px] text-slate-500 mt-0.5">
              Create an AI-curated paper in 2 minutes with zero friction
            </p>
          </div>
        </div>

        {/* Modal Body */}
        <div className="space-y-4 pt-3.5 overflow-y-auto custom-scrollbar flex-1 pr-1">
          {/* Assessment Title */}
          <div>
            <label className="block text-[12px] font-bold text-slate-700 mb-1.5">
              Assessment Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chapter 3 Weekly Quiz"
              className="w-full min-h-[46px] px-4 py-2.5 bg-slate-50/70 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-2xl text-[13px] sm:text-[13.5px] font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            />
          </div>

          {/* Multiple Class & Section Selection (Apple / iOS Hierarchical Multi-Select) */}
          <div ref={batchDropdownRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12px] font-bold text-slate-700 block">
                Class & Section <span className="text-rose-500">*</span>
              </label>
              {selectedBatchIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBatchIds([])}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Clear All ({selectedBatchIds.length})
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setShowBatchDropdown(!showBatchDropdown);
                setShowSubjectDropdown(false);
              }}
              aria-expanded={showBatchDropdown}
              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between transition-all select-none ${
                showBatchDropdown
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs text-slate-800'
                  : selectedBatchIds.length > 0
                  ? 'bg-white border-indigo-200/90 hover:border-indigo-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
                  : 'bg-slate-50/70 hover:bg-slate-100/80 active:bg-slate-100 border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2 flex-1">
                <Users
                  className={`w-4 h-4 flex-shrink-0 ${
                    selectedBatchIds.length > 0 ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                {selectedBatchIds.length > 0 ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[11px] rounded-full border border-indigo-100 flex-shrink-0">
                      {selectedBatchIds.length}{' '}
                      {selectedBatchIds.length === 1 ? 'Section' : 'Sections'}
                    </span>
                    <span className="text-[13px] font-semibold text-slate-800 truncate">
                      {selectedBatchesDisplayText}
                    </span>
                  </div>
                ) : (
                  <span className="text-[13px] font-medium text-slate-400">
                    Select Classes & Sections...
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                  showBatchDropdown ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </button>

            {/* Apple / iOS Multi-Select Popover */}
            {showBatchDropdown && (
              <div className="absolute z-40 w-full mt-2 bg-white/98 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl p-2.5 max-h-72 overflow-y-auto animate-fadein space-y-2 custom-scrollbar">
                {/* Search & Select All Bar */}
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={batchSearch}
                      onChange={(e) => setBatchSearch(e.target.value)}
                      placeholder="Search class or section..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-medium outline-none focus:border-indigo-400 focus:bg-white transition-colors"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = teacherBatches.map((b) => b.id);
                      const allSelected = allIds.every((id) => selectedBatchIds.includes(id));
                      setSelectedBatchIds(allSelected ? [] : allIds);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {teacherBatches.every((b) => selectedBatchIds.includes(b.id))
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>
                </div>

                {/* Grouped Classes & Sections List */}
                {Object.keys(filteredGroupedBatches).length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-[12px]">
                    No classes or sections found.
                  </div>
                ) : (
                  Object.entries(filteredGroupedBatches).map(([groupName, batchesInGroup]) => {
                    const allInGroupChecked = batchesInGroup.every((b) =>
                      selectedBatchIds.includes(b.id)
                    );

                    return (
                      <div
                        key={groupName}
                        className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 space-y-1.5"
                      >
                        {/* Class Header with Select All toggle */}
                        <div className="flex items-center justify-between px-1.5 py-1">
                          <span className="text-[12px] font-extrabold text-slate-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                            {groupName}
                            <span className="text-[10.5px] font-semibold text-slate-400">
                              ({batchesInGroup.length})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              let newIds: string[];
                              if (allInGroupChecked) {
                                newIds = selectedBatchIds.filter(
                                  (id) => !batchesInGroup.some((b) => b.id === id)
                                );
                              } else {
                                const toAdd = batchesInGroup
                                  .map((b) => b.id)
                                  .filter((id) => !selectedBatchIds.includes(id));
                                newIds = [...selectedBatchIds, ...toAdd];
                              }
                              setSelectedBatchIds(newIds);
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            {allInGroupChecked ? 'Deselect Class' : 'Select Class'}
                          </button>
                        </div>

                        {/* Section Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {batchesInGroup.map((b) => {
                            const isChecked = selectedBatchIds.includes(b.id);
                            return (
                              <div
                                key={b.id}
                                onClick={() => {
                                  const newIds = isChecked
                                    ? selectedBatchIds.filter((id) => id !== b.id)
                                    : [...selectedBatchIds, b.id];
                                  setSelectedBatchIds(newIds);
                                }}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-[12.5px] font-semibold cursor-pointer transition-all select-none ${
                                  isChecked
                                    ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-2xs'
                                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100/70 hover:border-slate-300'
                                }`}
                              >
                                <div
                                  className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                                    isChecked
                                      ? 'bg-indigo-600 text-white shadow-2xs'
                                      : 'border border-slate-300 bg-white'
                                  }`}
                                >
                                  {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                {(() => {
                                  const itemLabel = getBatchDisplayLabel(b, groupName, batchesInGroup);
                                  const isStandardSection = /^Section\s+[A-Za-z0-9]+$/i.test(itemLabel);
                                  return (
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <span className="truncate">{itemLabel}</span>
                                      {!isStandardSection && (
                                        <span className="text-[9.5px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/60 font-bold flex-shrink-0">
                                          Special
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Teacher Assigned Subjects (Apple / iOS Custom Dropdown) */}
          <div ref={subjectDropdownRef} className="relative">
            <label className="text-[12px] font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
              <span>
                Subject <span className="text-rose-500">*</span>
              </span>
              {teacherAssignedSubjects.length > 0 &&
                profile?.subjectIds &&
                profile.subjectIds.length > 0 && (
                  <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Assigned to You
                  </span>
                )}
            </label>

            <button
              type="button"
              onClick={() => {
                setShowSubjectDropdown(!showSubjectDropdown);
                setShowBatchDropdown(false);
              }}
              aria-expanded={showSubjectDropdown}
              className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between transition-all select-none ${
                showSubjectDropdown
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs text-slate-800'
                  : subjectId
                  ? 'bg-white border-indigo-200/90 hover:border-indigo-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
                  : 'bg-slate-50/70 hover:bg-slate-100/80 active:bg-slate-100 border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <BookOpen
                  className={`w-4 h-4 flex-shrink-0 ${
                    subjectId ? 'text-indigo-600' : 'text-slate-400'
                  }`}
                />
                <span
                  className={`text-[13px] font-semibold truncate ${
                    activeSubject ? 'text-slate-800' : 'text-slate-400'
                  }`}
                >
                  {activeSubject ? activeSubject.name : 'Select subject...'}
                </span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
                  showSubjectDropdown ? 'rotate-180 text-indigo-600' : ''
                }`}
              />
            </button>

            {/* Subject iOS Dropdown Menu */}
            {showSubjectDropdown && (
              <div className="absolute z-40 w-full mt-2 bg-white/98 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl p-1.5 max-h-60 overflow-y-auto animate-fadein custom-scrollbar">
                {teacherAssignedSubjects.map((s: any) => {
                  const isSelected = s.id === subjectId;
                  const isAssigned =
                    Array.isArray(profile?.subjectIds) && profile.subjectIds.includes(s.id);

                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSubjectChange(s.id)}
                      className={`px-3 py-2.5 rounded-xl text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-700 font-bold'
                          : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{s.name}</span>
                        {isAssigned && (
                          <span className="text-[9.5px] px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 font-bold">
                            Assigned
                          </span>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chapters Selection */}
          {subjectId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-bold text-slate-700 block">
                  Select Chapters <span className="text-rose-500">*</span>
                </label>
                {chapters.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllChapters}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                  >
                    {chapterIds.length === chapters.length ? 'Deselect All' : 'Select All'} (
                    {chapterIds.length}/{chapters.length})
                  </button>
                )}
              </div>

              <div className="max-h-44 overflow-y-auto bg-slate-50/70 border border-slate-200/90 rounded-2xl p-2 space-y-1.5 custom-scrollbar">
                {chapters.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">
                    No chapters found for this subject.
                  </p>
                ) : (
                  chapters.map((c: any) => {
                    const isSelected = chapterIds.includes(c.id);
                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleChapter(c.id)}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all select-none ${
                          isSelected
                            ? 'bg-indigo-50 border border-indigo-200 text-indigo-950 font-semibold shadow-2xs'
                            : 'bg-white border border-slate-100 text-slate-700 hover:border-slate-200'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <span className="text-[12.5px] truncate flex-1">{c.name}</span>
                        {typeof c.totalQuestions === 'number' && (
                          <span className="text-[10px] font-bold text-slate-400">
                            {c.totalQuestions} Qs
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Question Count & Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-slate-700 block">
                Number of Questions (MCQ)
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                Est. time: ~{questionCount * 2} mins
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Stepper */}
              <div className="flex items-center border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuestionCount((prev) => Math.max(5, prev - 5))}
                  className="p-3 text-slate-600 hover:bg-slate-200/60 active:bg-slate-200 transition-colors cursor-pointer"
                  aria-label="Decrease questions"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-14 text-center bg-transparent text-[14px] font-bold text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQuestionCount((prev) => Math.min(100, prev + 5))}
                  className="p-3 text-slate-600 hover:bg-slate-200/60 active:bg-slate-200 transition-colors cursor-pointer"
                  aria-label="Increase questions"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Preset Chips */}
              <div className="flex items-center gap-1.5 flex-1">
                {[10, 20, 30, 45].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuestionCount(preset)}
                    className={`flex-1 py-2 text-[12px] font-bold rounded-xl border transition-all cursor-pointer ${
                      questionCount === preset
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Generate Action Button */}
        <button
          onClick={handleGenerate}
          disabled={
            isGenerating ||
            selectedBatchIds.length === 0 ||
            !subjectId ||
            chapterIds.length === 0 ||
            !title.trim()
          }
          className="w-full min-h-[48px] flex-shrink-0 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-[13.5px] rounded-2xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed mt-4 cursor-pointer"
        >
          {isGenerating ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Zap className="w-5 h-5 fill-white" />
          )}
          {isGenerating ? 'Generating Paper with AI...' : 'Generate Paper in 2 Min'}
        </button>
      </div>
    </div>
  );
}

