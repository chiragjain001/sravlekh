'use client';

import React from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  BookOpen,
  FileText,
  Layers,
  HelpCircle,
  Zap,
  Sparkles,
  Info,
  Edit2,
  ChevronDown,
  ArrowRight,
  Settings,
  Bookmark,
  X,
  Check,
  Search,
  Users,
} from 'lucide-react';
import { AssessmentState, PaperFormat } from '../AssessmentSummaryPanel';
import { useMyTeacherProfile, useSubjects } from '@/hooks/useApi';
import { DatePicker } from '@/components/ui/DatePicker';
import { getBatchDisplayLabel } from '../../shared/QuickGenerateModal';

interface Step1DetailsProps {
  state: AssessmentState;
  onChange: (updates: Partial<AssessmentState>) => void;
  availableBatches: { id: string; name: string; classYear?: string; section?: string }[];
  onNext: () => void;
  onSubjectSelect?: (subjectId: string) => void;
  onSaveDraft?: () => void;
  isSavingDraft?: boolean;
  onOpenAiAssistant?: () => void;
}

const ASSESSMENT_TYPES = [
  { id: 'School Examination', icon: <FileText className="w-5 h-5 text-indigo-500" />, label: 'School Examination', desc: 'Unit test, half yearly, yearly etc.' },
  { id: 'Practice Test', icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, label: 'Practice Test', desc: 'For revision and practice' },
  { id: 'Homework / Assignment', icon: <Zap className="w-5 h-5 text-amber-500" />, label: 'Homework / Assignment', desc: 'Classwork or homework' },
  { id: 'Custom Assessment', icon: <Layers className="w-5 h-5 text-purple-500" />, label: 'Custom Assessment', desc: 'Create your own format' },
];

const PAPER_FORMAT_OPTIONS: { id: PaperFormat; icon: React.ReactNode; label: string; desc: string }[] = [
  { id: 'THEORY', icon: <FileText className="w-5 h-5 text-indigo-500" />, label: 'Theory / Descriptive', desc: 'Subjective questions with written answers' },
  { id: 'OMR',    icon: <Layers className="w-5 h-5 text-rose-500" />, label: 'OMR / Objective', desc: 'MCQs, assertion-reason etc.' },
  { id: 'HYBRID', icon: <BookOpen className="w-5 h-5 text-emerald-500" />, label: 'Hybrid Paper', desc: 'Both MCQ and descriptive questions' },
];

const BOARDS         = ['CBSE', 'ICSE', 'State Board', 'IB', 'Cambridge', 'JEE', 'NEET', 'Other'];
const LANGUAGES      = ['English', 'Hindi', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Other'];
const ACADEMIC_YEARS = ['2024-25', '2025-26', '2026-27'];

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// iOS-style switch toggle component with smooth transition and 44px touch target
function IosSwitch({
  checked,
  onChange,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// Apple / iOS-style custom dropdown with smooth popover, checkmark, and zero-overflow positioning
interface IosSelectOption {
  value: string;
  label: string;
}

function IosSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  ariaLabel,
}: {
  value: string;
  onChange: (val: string) => void;
  options: (string | IosSelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const normalizedOptions: IosSelectOption[] = React.useMemo(() => {
    return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel || placeholder}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={`w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between transition-all select-none ${
          disabled
            ? 'bg-slate-100/60 border-slate-200/60 text-slate-400 cursor-not-allowed opacity-75'
            : isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs text-slate-800'
            : 'bg-slate-50/70 hover:bg-slate-100/80 active:bg-slate-100 border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
        }`}
      >
        <span
          className={`text-[13px] sm:text-[13.5px] truncate pr-2 ${
            selectedOption ? 'font-semibold text-slate-800' : 'font-medium text-slate-400'
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-indigo-600' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-40 w-full mt-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-1.5 max-h-56 overflow-y-auto animate-fadein">
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`px-3 py-2 rounded-xl text-[13px] flex items-center justify-between cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-100/70 hover:text-slate-900 font-medium active:bg-slate-200/50'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0 ml-2" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Step1Details({
  state,
  onChange,
  availableBatches,
  onNext,
  onSubjectSelect,
  onSaveDraft,
  isSavingDraft = false,
  onOpenAiAssistant,
}: Step1DetailsProps) {
  const { data: profile } = useMyTeacherProfile();
  const { data: subjectsResp } = useSubjects();
  const subjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];
  const [showTitleDropdown, setShowTitleDropdown] = React.useState(false);
  const [showBatchDropdown, setShowBatchDropdown] = React.useState(false);
  const [batchSearch, setBatchSearch] = React.useState('');
  const batchDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close batch dropdown on outside click or ESC
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target as Node)) {
        setShowBatchDropdown(false);
        setBatchSearch('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowBatchDropdown(false);
        setBatchSearch('');
      }
    };

    if (showBatchDropdown) {
      document.addEventListener('pointerdown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showBatchDropdown]);

  // Ensure default Session ('2025-26') and Medium ('English') are set
  React.useEffect(() => {
    const updates: Partial<AssessmentState> = {};
    if (!state.academicYear) updates.academicYear = '2025-26';
    if (!state.language) updates.language = 'English';
    if (Object.keys(updates).length > 0) {
      onChange(updates);
    }
  }, [state.academicYear, state.language, onChange]);

  // Teacher's assigned subjects: derived from teacherProfile.subjectIds + batch assignments
  const teacherAssignedSubjects = React.useMemo(() => {
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

    // Fallback: If no explicit assignment in DB, show all subjects with chapters or all subjects
    const withCurriculum = subjects.filter((s: any) => (s.chapters ?? []).length > 0);
    return withCurriculum.length > 0 ? withCurriculum : subjects;
  }, [profile, subjects]);

  // Auto-align subject with the teacher's assigned subject if currently unassigned or placeholder
  React.useEffect(() => {
    if (teacherAssignedSubjects.length > 0) {
      const isCurrentValid = teacherAssignedSubjects.some((s: any) => s.name === state.subject || s.id === state.subject);
      if (!isCurrentValid || !state.subject || state.subject === 'General') {
        const first = teacherAssignedSubjects[0];
        onChange({
          subject: first.name,
          exam: `${first.name} Assessment`,
          title: !state.title || state.title.startsWith('General') ? `${first.name} Weekly Test` : state.title,
        });
        if (onSubjectSelect) onSubjectSelect(first.id);
      }
    }
  }, [teacherAssignedSubjects, state.subject, state.title, onChange, onSubjectSelect]);

  // Batches: Prioritize batches assigned to teacher in profile
  const teacherBatches = React.useMemo(() => {
    if (profile?.batchAssignments && profile.batchAssignments.length > 0) {
      const assignedIds = new Set(
        profile.batchAssignments
          .filter((a: any) => !a.removedAt)
          .map((a: any) => a.batchId || a.batch?.id)
          .filter(Boolean)
      );
      const assigned = availableBatches.filter((b) => assignedIds.has(b.id));
      if (assigned.length > 0) return assigned;
    }
    return availableBatches;
  }, [profile, availableBatches]);

  // Group batches by Class / Grade
  const groupedBatches = React.useMemo(() => {
    // 1. Deduplicate by ID
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
  const filteredGroupedBatches = React.useMemo(() => {
    if (!batchSearch.trim()) return groupedBatches;
    const term = batchSearch.toLowerCase();
    const result: Record<string, typeof teacherBatches> = {};

    Object.entries(groupedBatches).forEach(([groupName, batches]) => {
      const groupMatches = groupName.toLowerCase().includes(term);
      const matching = batches.filter(
        (b) =>
          groupMatches ||
          b.name.toLowerCase().includes(term) ||
          (b.section && b.section.toLowerCase().includes(term)) ||
          getBatchDisplayLabel(b, groupName, batches).toLowerCase().includes(term)
      );
      if (matching.length > 0) {
        result[groupName] = matching;
      }
    });

    return result;
  }, [groupedBatches, batchSearch]);

  const selectedBatchesDisplayText = React.useMemo(() => {
    if (state.batches.length === 0) return 'Select Classes & Sections...';

    const displayParts: string[] = [];
    const unaccountedBatches = [...state.batches];

    Object.entries(groupedBatches).forEach(([groupName, batchesInGroup]) => {
      const allChecked = batchesInGroup.length > 0 && batchesInGroup.every((b) => state.batches.includes(b.name));
      if (allChecked) {
        displayParts.push(groupName);
        batchesInGroup.forEach((b) => {
          const idx = unaccountedBatches.indexOf(b.name);
          if (idx > -1) unaccountedBatches.splice(idx, 1);
        });
      } else {
        const selectedInGroup = batchesInGroup.filter((b) => state.batches.includes(b.name));
        if (selectedInGroup.length > 0) {
          const sectionLabels = selectedInGroup.map((b) =>
            getBatchDisplayLabel(b, groupName, batchesInGroup).replace(/^Section\s+/i, 'Sec ')
          );
          displayParts.push(`${groupName} (${sectionLabels.join(', ')})`);
          selectedInGroup.forEach((b) => {
            const idx = unaccountedBatches.indexOf(b.name);
            if (idx > -1) unaccountedBatches.splice(idx, 1);
          });
        }
      }
    });

    displayParts.push(...unaccountedBatches);
    return displayParts.join(', ');
  }, [state.batches, groupedBatches]);

  const suggestedTitles = React.useMemo(() => {
    const subject = state.subject || 'Subject';
    
    switch (state.type) {
      case 'School Examination':
        return [
          `${subject} Half Yearly Examination`,
          `${subject} Annual Examination`,
          `${subject} Pre-Board Examination`,
          `${subject} Unit Test`
        ];
      case 'Practice Test':
        return [
          `${subject} Practice Test`,
          `${subject} Chapter Test`,
          `${subject} Mock Test`,
          `${subject} Grand Test`
        ];
      case 'Homework / Assignment':
        return [
          `${subject} Daily Practice Paper (DPP)`,
          `${subject} Weekend Assignment`,
          `${subject} Holiday Homework`
        ];
      case 'Custom Assessment':
      default:
        return [
          `${subject} Assessment`,
          `${subject} Revision Test`,
          `${subject} Scholarship Test`
        ];
    }
  }, [state.type, state.subject]);

  const canProceed = state.type !== '' && state.batches.length > 0 && state.title.trim() !== '' && state.duration > 0;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadein pb-8">
      {/* 1. Assessment Details Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[13px] sm:text-[14px] font-extrabold shadow-xs">
              1
            </span>
            <h2 className="text-[18px] sm:text-[20px] font-extrabold text-slate-800 tracking-tight">
              Assessment Details
            </h2>
          </div>
          <p className="text-[12px] sm:text-[13px] text-slate-500 pl-9 sm:pl-11 mt-0.5">
            Let's start with the basic information. Tell us what kind of paper you want to create.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenAiAssistant}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[12px] font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
        >
          <HelpCircle className="w-4 h-4" /> Need Help?
        </button>
      </div>

      {/* 2. Assessment Type (2-column responsive grid on mobile) */}
      <div className="space-y-3">
        <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800">Assessment Type</h3>
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {ASSESSMENT_TYPES.map((type) => {
            const isSelected = state.type === type.id;
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => onChange({ type: type.id })}
                className={`flex flex-col sm:flex-row items-start gap-2.5 sm:gap-3.5 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all relative cursor-pointer min-h-[82px] sm:min-h-[88px] ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 sm:p-2.5 rounded-xl flex-shrink-0 ${isSelected ? 'bg-white shadow-xs text-indigo-600' : 'bg-slate-50 text-slate-600'}`}>
                  {type.icon}
                </div>
                <div className="pt-0.5 min-w-0 pr-4">
                  <h4 className={`text-[13px] sm:text-[14px] font-bold leading-tight truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                    {type.label}
                  </h4>
                  <p className="text-[11px] sm:text-[12px] text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2 leading-tight">
                    {type.desc}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-indigo-600">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 fill-indigo-600 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Paper Format (2-column on mobile with 3rd item full-width, 3-column on tablet) */}
      <div className="space-y-3">
        <h3 className="text-[14px] sm:text-[15px] font-bold text-slate-800">Paper Format</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
          {PAPER_FORMAT_OPTIONS.map((fmt, idx) => {
            const isSelected = state.paperFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => onChange({ paperFormat: fmt.id })}
                className={`flex flex-col sm:flex-row items-start gap-2.5 sm:gap-3 p-3 sm:p-4 rounded-2xl border-2 text-left transition-all relative cursor-pointer ${
                  idx === 2 ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 shadow-xs ring-1 ring-indigo-500/20'
                    : 'border-slate-200/80 bg-white hover:border-slate-300'
                }`}
              >
                <div className={`p-2 rounded-xl flex-shrink-0 ${isSelected ? 'bg-white shadow-xs' : 'bg-slate-50'}`}>
                  {fmt.icon}
                </div>
                <div className="pt-0.5 min-w-0 pr-4">
                  <h4 className={`text-[12.5px] sm:text-[13.5px] font-bold leading-tight truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                    {fmt.label}
                  </h4>
                  <p className="text-[11px] sm:text-[11.5px] text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-2 leading-tight">
                    {fmt.desc}
                  </p>
                </div>
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 text-indigo-600">
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 fill-indigo-600 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Basic Information */}
      <div className="space-y-3">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4 sm:space-y-5">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <FileText className="w-4 h-4 text-indigo-600" />
            <h3 className="text-[14.5px] sm:text-[15.5px] font-extrabold text-slate-800">Basic Information</h3>
          </div>

          {/* Paper Title (Full width with quick clear & suggestions) */}
          <div>
            <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
              Paper Title <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={state.title}
                onChange={(e) => onChange({ title: e.target.value })}
                onFocus={() => setShowTitleDropdown(true)}
                onClick={() => setShowTitleDropdown(true)}
                onBlur={() => setTimeout(() => setShowTitleDropdown(false), 200)}
                placeholder="e.g. General Weekly Test"
                className="w-full min-h-[46px] px-3.5 pr-14 bg-slate-50/70 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 rounded-2xl text-[13px] sm:text-[13.5px] font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {state.title && (
                  <button
                    type="button"
                    onClick={() => onChange({ title: '' })}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    aria-label="Clear title"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowTitleDropdown(!showTitleDropdown)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Show suggested titles"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showTitleDropdown ? 'rotate-180 text-indigo-600' : ''}`} />
                </button>
              </div>

              {showTitleDropdown && (
                <div className="absolute z-20 w-full mt-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl overflow-hidden max-h-48 overflow-y-auto animate-fadein p-1">
                  {suggestedTitles.map((title, idx) => (
                    <div
                      key={idx}
                      className="px-3.5 py-2.5 text-[12.5px] text-slate-700 hover:bg-indigo-50/70 hover:text-indigo-900 rounded-xl cursor-pointer border-b border-slate-50 last:border-0 font-medium transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange({ title });
                        setShowTitleDropdown(false);
                      }}
                    >
                      {title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Class / Grade & Section (Multi-Select Dropdown) */}
          <div ref={batchDropdownRef} className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-bold text-slate-700 block">
                Class & Section <span className="text-rose-500">*</span>
              </label>
              {state.batches.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange({ batches: [] })}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                >
                  Clear All ({state.batches.length})
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowBatchDropdown(!showBatchDropdown)}
              aria-expanded={showBatchDropdown}
              className={`w-full min-h-[48px] px-3.5 py-2.5 rounded-2xl border text-left flex items-center justify-between transition-all select-none ${
                showBatchDropdown
                  ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white shadow-xs text-slate-800'
                  : state.batches.length > 0
                  ? 'bg-white border-indigo-200/90 hover:border-indigo-400 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
                  : 'bg-slate-50/70 hover:bg-slate-100/80 active:bg-slate-100 border-slate-200/90 text-slate-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2 flex-1 flex-wrap sm:flex-nowrap">
                <Users className={`w-4 h-4 flex-shrink-0 ${state.batches.length > 0 ? 'text-indigo-600' : 'text-slate-400'}`} />
                {state.batches.length > 0 ? (
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[11px] rounded-full border border-indigo-100 flex-shrink-0">
                      {state.batches.length} {state.batches.length === 1 ? 'Section' : 'Sections'}
                    </span>
                    <span className="text-[13px] sm:text-[13.5px] font-semibold text-slate-800 truncate">
                      {selectedBatchesDisplayText}
                    </span>
                  </div>
                ) : (
                  <span className="text-[13px] sm:text-[13.5px] font-medium text-slate-400">
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
              <div className="absolute z-40 w-full mt-2 bg-white/98 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-2xl p-2.5 max-h-80 overflow-y-auto animate-fadein space-y-2 custom-scrollbar">
                {/* Search & Global Actions Bar */}
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
                      const allNames = teacherBatches.map((b) => b.name);
                      const allSelected = allNames.every((n) => state.batches.includes(n));
                      onChange({ batches: allSelected ? [] : allNames });
                    }}
                    className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {teacherBatches.every((b) => state.batches.includes(b.name)) ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Grouped Classes & Sections List */}
                {Object.keys(filteredGroupedBatches).length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-[12.5px]">
                    No classes or sections matching "{batchSearch}".
                  </div>
                ) : (
                  Object.entries(filteredGroupedBatches).map(([groupName, batchesInGroup]) => {
                    const allInGroupChecked = batchesInGroup.every((b) => state.batches.includes(b.name));

                    return (
                      <div key={groupName} className="rounded-xl border border-slate-100 bg-slate-50/50 p-2 space-y-1.5">
                        {/* Class Header with Select All toggle */}
                        <div className="flex items-center justify-between px-1.5 py-1">
                          <span className="text-[12px] font-extrabold text-slate-700 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                            {groupName}
                            <span className="text-[10.5px] font-semibold text-slate-400">({batchesInGroup.length})</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              let newBatches: string[];
                              if (allInGroupChecked) {
                                newBatches = state.batches.filter((n) => !batchesInGroup.some((b) => b.name === n));
                              } else {
                                const toAdd = batchesInGroup.map((b) => b.name).filter((n) => !state.batches.includes(n));
                                newBatches = [...state.batches, ...toAdd];
                              }
                              onChange({ batches: newBatches });
                            }}
                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                          >
                            {allInGroupChecked ? 'Deselect Class' : 'Select Class'}
                          </button>
                        </div>

                        {/* Section Options */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {batchesInGroup.map((b) => {
                            const isChecked = state.batches.includes(b.name);
                            return (
                              <div
                                key={b.id}
                                onClick={() => {
                                  const newBatches = isChecked
                                    ? state.batches.filter((n) => n !== b.name)
                                    : [...state.batches, b.name];
                                  onChange({ batches: newBatches });
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

          {/* Form Fields: Structured for Apple/iOS clarity & zero overflow */}
          <div className="space-y-3.5 sm:space-y-4.5">
            {/* Row 1: Subject (full on mobile, 50% on sm) & Board / Curriculum (full on mobile, 50% on sm) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4.5">
              <div>
                <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5 flex items-center justify-between">
                  <span>
                    Subject <span className="text-rose-500">*</span>
                  </span>
                  {teacherAssignedSubjects.length > 0 && profile?.subjectIds && profile.subjectIds.length > 0 && (
                    <span className="text-[10.5px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      Assigned to You
                    </span>
                  )}
                </label>
                <IosSelect
                  value={
                    teacherAssignedSubjects.find((s: any) => s.name === state.subject || s.id === state.subject)?.id ||
                    subjects.find((s: any) => s.name === state.subject)?.id ||
                    ''
                  }
                  onChange={(newId) => {
                    const newSub = subjects.find((s: any) => s.id === newId);
                    if (newSub) {
                      onChange({
                        subject: newSub.name,
                        exam: `${newSub.name} Assessment`,
                        title:
                          state.title.startsWith('General') || state.title.includes('Assessment') || state.title.includes('Test')
                            ? `${newSub.name} Weekly Test`
                            : state.title,
                      });
                    }
                    if (onSubjectSelect) onSubjectSelect(newId);
                  }}
                  options={teacherAssignedSubjects.map((s) => ({ value: s.id, label: s.name }))}
                  placeholder={teacherAssignedSubjects.length === 0 ? 'Loading subjects...' : 'Select Subject...'}
                  disabled={teacherAssignedSubjects.length === 0}
                  ariaLabel="Subject"
                />
              </div>

              <div>
                <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
                  Board / Curriculum <span className="text-rose-500">*</span>
                </label>
                <IosSelect
                  value={state.board}
                  onChange={(board) => onChange({ board })}
                  options={BOARDS}
                  placeholder="Select Board..."
                  ariaLabel="Board / Curriculum"
                />
              </div>
            </div>

            {/* Row 2: Session & Medium (Fixed defaults: 2025-26 & English) - 2 columns on all devices */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4.5">
              <div>
                <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
                  Session <span className="text-rose-500">*</span>
                </label>
                <IosSelect
                  value={state.academicYear || '2025-26'}
                  onChange={(academicYear) => onChange({ academicYear })}
                  options={ACADEMIC_YEARS}
                  placeholder="2025-26"
                  ariaLabel="Academic Session"
                />
              </div>

              <div>
                <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
                  Medium (Language) <span className="text-rose-500">*</span>
                </label>
                <IosSelect
                  value={state.language || 'English'}
                  onChange={(language) => onChange({ language })}
                  options={LANGUAGES}
                  placeholder="English"
                  ariaLabel="Medium of Examination"
                />
              </div>
            </div>

            {/* Row 3: Exam Date (full on mobile, 50% on sm) & Duration (full on mobile, 50% on sm) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4.5">
              <div>
                <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
                  Exam Date <span className="text-rose-500">*</span>
                </label>
                <DatePicker
                  value={state.dueDate}
                  minDate={todayIsoDate()}
                  onChange={(d) => onChange({ dueDate: d })}
                  placeholder="Select date"
                  quickPresets={true}
                  align="left"
                />
              </div>

              <div>
                <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
                  Duration (Minutes)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 120"
                    value={state.duration || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      onChange({ duration: val ? parseInt(val, 10) : 0 });
                    }}
                    className="w-full min-h-[46px] px-3.5 pr-9 bg-slate-50/70 hover:bg-slate-100/80 focus:bg-white border border-slate-200/90 focus:border-indigo-500 rounded-2xl text-[13px] sm:text-[13.5px] font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all"
                  />
                  <Clock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Total Marks */}
          <div className="pt-1">
            <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
              Total Marks
            </label>
            <div className="relative max-w-full sm:max-w-xs">
              <input
                type="text"
                inputMode="numeric"
                placeholder="---"
                value={state.totalMarks || ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  onChange({ totalMarks: val ? parseInt(val, 10) : 0 });
                }}
                className="w-full min-h-[44px] p-2.5 pr-8 bg-white border border-slate-200 rounded-xl text-[13px] font-medium text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <Edit2 className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* Additional Instructions */}
          <div className="pt-2">
            <label className="text-[12.5px] font-bold text-slate-700 block mb-1.5">
              Additional Instructions (Optional)
            </label>
            <textarea
              rows={2}
              value={state.instructions}
              onChange={(e) => onChange({ instructions: e.target.value })}
              placeholder="e.g. focus on application based questions, include diagrams, follow latest CBSE pattern..."
              className="w-full p-3 bg-white border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-y min-h-[76px] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* 5. Smart Paper Settings / Additional Options (Horizontal Rows with iOS switches) */}
      <div className="space-y-3">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
            <Settings className="w-4 h-4 text-indigo-600" />
            <h3 className="text-[14.5px] sm:text-[15.5px] font-extrabold text-slate-800">Additional Options</h3>
          </div>

          {/* Shuffle Questions */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
            <div className="flex items-start gap-3 min-w-0 pr-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-[13px] font-bold text-slate-800 leading-tight">Shuffle Questions</h4>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-tight">
                  Randomize question order for each student
                </p>
              </div>
            </div>
            <IosSwitch
              checked={state.shuffleQuestions}
              onChange={(checked) => onChange({ shuffleQuestions: checked })}
              aria-label="Toggle Shuffle Questions"
            />
          </div>

          {/* Shuffle Options (OMR/Hybrid only) */}
          {state.paperFormat !== 'THEORY' && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3 min-w-0 pr-3">
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 flex-shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-800 leading-tight">Shuffle Options</h4>
                  <p className="text-[11.5px] text-slate-500 mt-0.5 leading-tight">
                    Randomize options order
                  </p>
                </div>
              </div>
              <IosSwitch
                checked={state.shuffleOptions}
                onChange={(checked) => onChange({ shuffleOptions: checked })}
                aria-label="Toggle Shuffle Options"
              />
            </div>
          )}

          {/* Negative Marking (OMR/Hybrid only) */}
          {state.paperFormat !== 'THEORY' && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 transition-colors">
              <div className="flex items-start gap-3 min-w-0 pr-3">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600 flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-800 leading-tight flex items-center gap-1.5">
                    Negative Marking
                    <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded">
                      -1 per wrong
                    </span>
                  </h4>
                  <p className="text-[11.5px] text-slate-500 mt-0.5 leading-tight">
                    Enable negative marking for objective questions
                  </p>
                </div>
              </div>
              <IosSwitch
                checked={state.negativeMarking !== 'None'}
                onChange={(checked) =>
                  onChange({ negativeMarking: checked ? '-1 for each wrong answer' : 'None' })
                }
                aria-label="Toggle Negative Marking"
              />
            </div>
          )}
        </div>
      </div>

      {/* 6. AI Teacher Intent (Optional) */}
      <div className="bg-gradient-to-br from-indigo-50/60 to-purple-50/40 border border-indigo-100 rounded-2xl p-4 sm:p-5 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-[13.5px] font-bold text-indigo-950">AI Teacher Intent (Optional)</h4>
            <p className="text-[11px] text-indigo-700/80">Guide the AI to tailor question tone and focus</p>
          </div>
        </div>
        <textarea
          rows={2}
          value={state.teacherIntent}
          onChange={(e) => onChange({ teacherIntent: e.target.value })}
          placeholder="e.g. Focus on HOTS questions, avoid pure memory."
          className="w-full p-3 bg-white border border-indigo-200/90 rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 min-h-[72px] transition-colors"
        />
      </div>

      {/* 7. Need Help / AI Suggestions Contextual Card */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 border border-amber-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-start gap-2.5">
          <span className="text-lg">💡</span>
          <div>
            <h4 className="text-[13px] font-extrabold text-amber-950">Need Help?</h4>
            <p className="text-[11.5px] text-amber-800/90 mt-0.5 max-w-lg">
              Tell us what kind of paper you want and AI will suggest the best structure, topic mix and question types.
            </p>
          </div>
        </div>
        {onOpenAiAssistant && (
          <button
            type="button"
            onClick={onOpenAiAssistant}
            className="w-full sm:w-auto px-4 py-2 bg-white hover:bg-amber-100/60 border border-amber-300 text-amber-900 text-[12px] font-bold rounded-xl transition-colors shadow-2xs flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Generate with AI</span>
          </button>
        )}
      </div>

    </div>
  );
}

