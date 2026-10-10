'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  MessageCircleQuestion,
  Plus,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Send,
  Check,
  Filter,
  CheckCircle2,
  Clock,
  User,
  CornerDownRight,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { useDoubts, useCreateDoubt, useMyStudentProfile, useSubjects } from '@/hooks/useApi';
import {
  isStudentClassSubject,
  filterStudentClassSubjects,
  DEFAULT_STUDENT_ENROLLED_SUBJECTS,
} from '@/lib/student-subjects';

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'text-rose-600 bg-rose-50 border-rose-200/70',
  ASSIGNED: 'text-amber-600 bg-amber-50 border-amber-200/70',
  ANSWERED: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  RESOLVED: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  CLOSED: 'text-slate-600 bg-slate-100 border-slate-200/70',
  ESCALATED: 'text-rose-700 bg-rose-100 border-rose-200/70',
};

interface Doubt {
  id: string;
  subjectId: string;
  subject?: { id?: string; name: string };
  content: string;
  status: string;
  assignedTeacher?: { name: string } | null;
  responseText?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  urgency?: number;
}

function getSubjectTheme(subjectName?: string) {
  const name = subjectName?.toLowerCase() ?? '';
  if (name.includes('physic')) {
    return {
      badge: 'bg-blue-50 text-blue-700 border-blue-200/70',
      dot: 'bg-blue-500',
    };
  }
  if (name.includes('chem')) {
    return {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      dot: 'bg-emerald-500',
    };
  }
  if (name.includes('math')) {
    return {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/70',
      dot: 'bg-indigo-500',
    };
  }
  if (name.includes('bio')) {
    return {
      badge: 'bg-rose-50 text-rose-700 border-rose-200/70',
      dot: 'bg-rose-500',
    };
  }
  return {
    badge: 'bg-purple-50 text-purple-700 border-purple-200/70',
    dot: 'bg-purple-500',
  };
}

function formatDoubtDate(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDoubtDateTime(dateStr?: string | null) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function StudentDoubtCenter() {
  const [activeTab, setActiveTab] = useState<'My Doubts' | 'Answered'>('My Doubts');
  const [selectedSubject, setSelectedSubject] = useState<'ALL' | string>('ALL');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New doubt modal state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newUrgency, setNewUrgency] = useState<number>(1);

  // Detail / Counter-doubt modal state
  const [selectedDoubt, setSelectedDoubt] = useState<Doubt | null>(null);
  const [counterDoubtText, setCounterDoubtText] = useState('');
  const [counterDoubtSuccess, setCounterDoubtSuccess] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useMyStudentProfile();
  const { data: subjectsResp } = useSubjects();
  const rawSubjects: { id: string; name: string }[] = subjectsResp ?? [];
  // Restrict subjects to the student's enrolled class subjects (Physics, Chemistry, Mathematics for JEE)
  const subjects = useMemo(() => filterStudentClassSubjects(rawSubjects), [rawSubjects]);
  const { data: doubtsResp, isPending } = useDoubts();
  const rawDoubts: Doubt[] = doubtsResp?.data ?? [];
  // Filter doubts to only those relevant to student's class curriculum
  const doubts: Doubt[] = useMemo(
    () => rawDoubts.filter((d) => !d.subject?.name || isStudentClassSubject(d.subject.name)),
    [rawDoubts],
  );
  const createDoubt = useCreateDoubt();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setIsNewModalOpen(false);
        setSelectedDoubt(null);
        setCounterDoubtSuccess(false);
        setCounterDoubtText('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check if a doubt has been answered by the teacher
  const isDoubtAnswered = (doubt: Doubt) => {
    return (
      doubt.status === 'ANSWERED' ||
      doubt.status === 'RESOLVED' ||
      doubt.status === 'CLOSED' ||
      Boolean(doubt.responseText && doubt.responseText.trim().length > 0)
    );
  };

  // Segregate pending doubts from answered doubts
  const pendingDoubts = useMemo(() => doubts.filter((d) => !isDoubtAnswered(d)), [doubts]);
  const answeredDoubts = useMemo(() => doubts.filter((d) => isDoubtAnswered(d)), [doubts]);

  // Aggregate available subjects and their counts for student's class
  const availableSubjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const s of subjects) {
      if (s?.name && isStudentClassSubject(s.name)) {
        map.set(s.name.toLowerCase(), { id: s.id, name: s.name, count: 0 });
      }
    }
    // Guarantee all enrolled class subjects appear in the filter
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      const key = sub.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { id: key, name: sub, count: 0 });
      }
    }
    for (const d of doubts) {
      const sName = d.subject?.name;
      if (sName && isStudentClassSubject(sName)) {
        const key = sName.toLowerCase();
        const existing = map.get(key) ?? { id: d.subjectId, name: sName, count: 0 };
        existing.count += 1;
        map.set(key, existing);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [subjects, doubts]);

  // Filter doubts for the active tab based on subject and search query
  const baseDoubts = activeTab === 'Answered' ? answeredDoubts : pendingDoubts;

  const filteredDoubts = useMemo(() => {
    return baseDoubts.filter((doubt) => {
      // Subject filter
      if (selectedSubject !== 'ALL') {
        const sName = doubt.subject?.name?.toLowerCase();
        if (sName !== selectedSubject.toLowerCase()) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchContent = doubt.content?.toLowerCase().includes(q);
        const matchResponse = doubt.responseText?.toLowerCase().includes(q);
        const matchSubject = doubt.subject?.name?.toLowerCase().includes(q);
        const matchTeacher = doubt.assignedTeacher?.name?.toLowerCase().includes(q);
        if (!matchContent && !matchResponse && !matchSubject && !matchTeacher) {
          return false;
        }
      }
      return true;
    });
  }, [baseDoubts, selectedSubject, searchQuery]);

  // Subject dropdown label
  const currentLabel =
    selectedSubject === 'ALL'
      ? availableSubjects.length > 0
        ? `All Subjects (${availableSubjects.length})`
        : 'All Subjects'
      : selectedSubject;

  // Submit new doubt
  async function handleAskDoubt() {
    if (!profile?.id || !newSubjectId || !newContent.trim()) return;
    await createDoubt.mutateAsync({
      studentProfileId: profile.id,
      data: {
        subjectId: newSubjectId,
        content: newContent.trim(),
        urgency: newUrgency,
      },
    });
    setNewContent('');
    setNewSubjectId('');
    setIsNewModalOpen(false);
  }

  // Submit counter-doubt / follow-up
  async function handleSendCounterDoubt() {
    if (!profile?.id || !selectedDoubt || !counterDoubtText.trim()) return;
    const originalSnippet =
      selectedDoubt.content.length > 70
        ? `${selectedDoubt.content.slice(0, 70)}...`
        : selectedDoubt.content;

    const followUpContent = `[Follow-up to: "${originalSnippet}"]\n\n${counterDoubtText.trim()}`;

    await createDoubt.mutateAsync({
      studentProfileId: profile.id,
      data: {
        subjectId: selectedDoubt.subjectId,
        content: followUpContent,
        urgency: 2,
      },
    });
    setCounterDoubtSuccess(true);
    setCounterDoubtText('');
  }

  return (
    <div className="p-3 sm:p-5 md:p-6 pb-28 sm:pb-8 animate-fadein min-h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-3xl w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 bg-white relative">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <MessageCircleQuestion className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[19px] sm:text-[20px] font-bold text-slate-800">Doubt Center</h2>
              <p className="text-[12px] sm:text-[12.5px] text-slate-500">
                Ask questions, review teacher answers, and send follow-ups.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (selectedSubject !== 'ALL') {
                const found = subjects.find((s) => s.name.toLowerCase() === selectedSubject.toLowerCase());
                if (found) setNewSubjectId(found.id);
              } else if (subjects[0]) {
                setNewSubjectId(subjects[0].id);
              }
              setIsNewModalOpen(true);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[13px] font-bold rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Doubt
          </button>
        </div>

        {/* Tabs & Controls Toolbar */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-4">
          {/* Tabs */}
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar border-b border-slate-100 lg:border-b-0 pb-2 lg:pb-0">
            <button
              onClick={() => setActiveTab('My Doubts')}
              className={`pb-2.5 text-[13.5px] font-bold transition-all relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'My Doubts' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>My Doubts</span>
              <span
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold transition-colors ${
                  activeTab === 'My Doubts'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {pendingDoubts.length}
              </span>
              {activeTab === 'My Doubts' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-indigo-600 rounded-t-full animate-fadein" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('Answered')}
              className={`pb-2.5 text-[13.5px] font-bold transition-all relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'Answered' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>Answered</span>
              <span
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold transition-colors ${
                  activeTab === 'Answered'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {answeredDoubts.length}
              </span>
              {activeTab === 'Answered' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-indigo-600 rounded-t-full animate-fadein" />
              )}
            </button>
          </div>

          {/* Right Toolbar: Subject Selector & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Custom Apple-Style Dropdown */}
            <div className="relative w-full sm:w-auto" ref={dropdownRef}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="w-full sm:w-[220px] flex items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-100/70 hover:bg-slate-200/60 active:scale-[0.98] text-slate-800 text-[12.5px] font-bold rounded-2xl border border-slate-200/60 transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{currentLabel}</span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {selectedSubject !== 'ALL' && (
                  <button
                    onClick={() => setSelectedSubject('ALL')}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                    title="Reset to All Subjects"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Floating Popover */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[250px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl p-1.5 z-50 animate-fadein">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 py-1.5">
                    Filter by Subject
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSubject('ALL');
                      setDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                      selectedSubject === 'ALL'
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      All Subjects
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">
                        {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''}
                      </span>
                      {selectedSubject === 'ALL' && <Check className="w-4 h-4 text-rose-600" />}
                    </div>
                  </button>

                  <div className="h-px bg-slate-100 my-1" />

                  {availableSubjects.map((sub) => {
                    const isSel = selectedSubject.toLowerCase() === sub.name.toLowerCase();
                    return (
                      <button
                        key={sub.id || sub.name}
                        type="button"
                        onClick={() => {
                          setSelectedSubject(sub.name);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[12.5px] transition-colors cursor-pointer ${
                          isSel
                            ? 'bg-rose-50 text-rose-700 font-bold'
                            : 'text-slate-700 hover:bg-slate-100/80 font-medium'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                          <span className="truncate">{sub.name}</span>
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {sub.count > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700">
                              {sub.count} {sub.count === 1 ? 'doubt' : 'doubts'}
                            </span>
                          )}
                          {isSel && <Check className="w-4 h-4 text-rose-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <input
                type="text"
                placeholder="Search doubts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl text-[12.5px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>


        {/* Doubts List */}
        <div className="space-y-3.5 flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2 mb-4">
          {isPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredDoubts.length > 0 ? (
            filteredDoubts.map((doubt) => {
              const theme = getSubjectTheme(doubt.subject?.name);
              const isResolved = isDoubtAnswered(doubt);

              return (
                <div
                  key={doubt.id}
                  onClick={() => {
                    setSelectedDoubt(doubt);
                    setCounterDoubtText('');
                    setCounterDoubtSuccess(false);
                  }}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/20 active:scale-[0.99] transition-all cursor-pointer group gap-4 shadow-2xs bg-white"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div
                      className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold mt-0.5 border flex-shrink-0 ${theme.badge}`}
                    >
                      {doubt.subject?.name ?? 'General'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-2">
                        {doubt.content}
                      </h4>

                      <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-400 mt-1">
                        <span>Asked {formatDoubtDate(doubt.createdAt)}</span>
                        <span>•</span>
                        <span className="font-medium text-slate-500">
                          {isResolved
                            ? `Answered by ${doubt.assignedTeacher?.name ?? 'Teacher'}`
                            : doubt.assignedTeacher?.name
                            ? `Assigned to ${doubt.assignedTeacher.name}`
                            : 'Awaiting teacher'}
                        </span>
                      </div>

                      {/* Snippet preview for answered doubt */}
                      {isResolved && doubt.responseText && (
                        <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/80 border border-emerald-100/80 flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <p className="text-[12px] text-emerald-900 line-clamp-2 font-medium">
                            {doubt.responseText}
                          </p>
                        </div>
                      )}

                      {/* Pending notice */}
                      {!isResolved && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 border border-amber-200/70 text-[11.5px] font-medium text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending response from teacher</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right side status badge and action prompt */}
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span
                      className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                        STATUS_STYLE[doubt.status] ?? 'text-slate-600 bg-slate-100'
                      }`}
                    >
                      {doubt.status}
                    </span>

                    <div className="flex items-center gap-1 text-[12.5px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      <span>{isResolved ? 'View Answer' : 'Details'}</span>
                      <ChevronRight className="w-4 h-4 text-indigo-500" />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 px-4 text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center mb-3">
                <MessageCircleQuestion className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-[15px] font-bold text-slate-700 mb-1">
                {activeTab === 'My Doubts' ? 'No Pending Doubts' : 'No Answered Doubts Yet'}
              </h3>
              <p className="text-[12.5px] text-slate-500 max-w-sm mb-4">
                {activeTab === 'My Doubts'
                  ? selectedSubject !== 'ALL'
                    ? `No open doubts found for ${selectedSubject}. All your questions may have been answered!`
                    : 'You do not have any pending doubts. All your questions have been resolved or you have not asked one yet.'
                  : selectedSubject !== 'ALL'
                  ? `No answered doubts for ${selectedSubject} yet.`
                  : 'Once a teacher answers your question, it will appear here with the full explanation and follow-up options.'}
              </p>
              {activeTab === 'My Doubts' && (
                <button
                  onClick={() => setIsNewModalOpen(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Ask a Doubt
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── DETAIL & COUNTER-DOUBT MODAL ───────────────────────── */}
        {selectedDoubt && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadein">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-up border border-slate-100">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                      getSubjectTheme(selectedDoubt.subject?.name).badge
                    }`}
                  >
                    {selectedDoubt.subject?.name ?? 'General'}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      STATUS_STYLE[selectedDoubt.status] ?? 'text-slate-600 bg-slate-100'
                    }`}
                  >
                    {selectedDoubt.status}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setSelectedDoubt(null);
                    setCounterDoubtText('');
                    setCounterDoubtSuccess(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body - Scrollable */}
              <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                {/* Question Block */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[12px] font-bold text-slate-700">Your Question</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {formatDoubtDateTime(selectedDoubt.createdAt)}
                    </span>
                  </div>
                  <div className="p-3.5 sm:p-4 bg-slate-50/90 rounded-2xl border border-slate-200/70 text-[13.5px] text-slate-800 font-medium leading-relaxed break-words min-w-0 max-w-full overflow-hidden">
                    {selectedDoubt.content}
                  </div>
                </div>

                {/* Teacher's Response (if answered) */}
                {selectedDoubt.responseText ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[12px] font-bold text-emerald-800">
                          Teacher&apos;s Answer • {selectedDoubt.assignedTeacher?.name ?? 'Teacher'}
                        </span>
                      </div>
                      {selectedDoubt.resolvedAt && (
                        <span className="text-[11px] text-slate-400">
                          {formatDoubtDateTime(selectedDoubt.resolvedAt)}
                        </span>
                      )}
                    </div>
                    <div className="p-4 sm:p-5 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 rounded-2xl border border-emerald-200/80 text-[13.5px] sm:text-[14px] text-slate-800 font-normal leading-relaxed shadow-2xs whitespace-pre-wrap break-words min-w-0 max-w-full overflow-hidden">
                      {selectedDoubt.responseText}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-[12.5px] text-amber-800 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <span>
                      This doubt is currently waiting for a response from your teacher. You will be able
                      to read the answer here as soon as it is resolved.
                    </span>
                  </div>
                )}

                {/* Counter-Doubt / Follow-up Section */}
                {selectedDoubt.responseText && (
                  <div className="pt-3 border-t border-slate-100">
                    {counterDoubtSuccess ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadein">
                        <div className="flex items-center gap-2.5 text-emerald-800 text-[13px] font-bold">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                          <span>Counter-doubt submitted! It is now tracked in &quot;My Doubts&quot;.</span>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedDoubt(null);
                            setCounterDoubtText('');
                            setCounterDoubtSuccess(false);
                            setActiveTab('My Doubts');
                          }}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          Go to My Doubts <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="w-4 h-4 text-indigo-600" />
                          <span className="text-[13px] font-bold text-slate-800">
                            Still have questions? Ask a Counter-Doubt / Follow-up
                          </span>
                        </div>
                        <p className="text-[12px] text-slate-500">
                          If anything is still unclear, ask a follow-up directly. It will be sent to the
                          teacher linked to this doubt.
                        </p>
                        <textarea
                          rows={3}
                          value={counterDoubtText}
                          onChange={(e) => setCounterDoubtText(e.target.value)}
                          placeholder="Type your follow-up or counter-doubt here..."
                          className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
                        />
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                          <span className="text-[11px] text-slate-400">
                            Auto-tagged as high-priority follow-up
                          </span>
                          <button
                            onClick={handleSendCounterDoubt}
                            disabled={createDoubt.isPending || !counterDoubtText.trim()}
                            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[12.5px] font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                          >
                            {createDoubt.isPending ? (
                              <>
                                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                Ask Counter-Doubt
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── ASK NEW DOUBT MODAL ───────────────────────── */}
        {isNewModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadein">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-slate-100 flex flex-col max-h-[92vh]">
              <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600">
                    <MessageCircleQuestion className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[16px] font-bold text-slate-800">Ask a New Doubt</h3>
                    <p className="text-[11.5px] text-slate-500">
                      Submit your question to your subject teacher.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsNewModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-white rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                <div>
                  <label className="block text-[12.5px] font-bold text-slate-700 mb-2">
                    Select Subject
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((sub) => {
                      const isSel = newSubjectId === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => setNewSubjectId(sub.id)}
                          className={`px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all border cursor-pointer ${
                            isSel
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {sub.name}
                        </button>
                      );
                    })}
                    {subjects.length === 0 && (
                      <p className="text-[12px] text-slate-400">No subjects set up for your institute yet.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-bold text-slate-700 mb-1.5">
                    Urgency
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewUrgency(1)}
                      className={`py-2 px-3 rounded-xl text-[12px] font-bold border transition-all cursor-pointer ${
                        newUrgency === 1
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Normal
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewUrgency(2)}
                      className={`py-2 px-3 rounded-xl text-[12px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        newUrgency === 2
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> High Priority
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12.5px] font-bold text-slate-700 mb-1.5">
                    Describe your doubt
                  </label>
                  <textarea
                    rows={4}
                    value={newContent}
                    onChange={(e) => setNewContent(e.target.value)}
                    placeholder="E.g., I don't understand how to calculate the moment of inertia for a hollow cylinder..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNewModalOpen(false)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 font-bold text-[12.5px] rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAskDoubt}
                    disabled={createDoubt.isPending || !newSubjectId || !newContent.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-[12.5px] font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    {createDoubt.isPending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Ask Teacher
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
