'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import {
  BookOpen,
  Clock,
  MapPin,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Video,
  ExternalLink,
  Filter,
  ChevronDown,
  Check,
  X,
  Search,
  Sparkles,
  AlertCircle,
  ArrowRight,
  User,
} from 'lucide-react';
import { useTimetable, useMyStudentProfile } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';
import { isStudentClassSubject, DEFAULT_STUDENT_ENROLLED_SUBJECTS } from '@/lib/student-subjects';
import { MarqueeText } from '@/components/ui/MarqueeText';

interface Slot {
  id: string;
  type: string;
  title: string;
  roomRef?: string | null;
  startTime: string;
  endTime: string;
  batch?: { name: string };
}

function extractSubject(title?: string): string {
  if (!title) return 'General';
  const lower = title.toLowerCase();
  if (lower.includes('physic')) return 'Physics';
  if (lower.includes('chem')) return 'Chemistry';
  if (lower.includes('math')) return 'Mathematics';
  return 'General';
}

function getSubjectBadge(subject: string) {
  switch (subject) {
    case 'Physics':
      return {
        badge: 'bg-blue-50 text-blue-700 border-blue-200/80',
        dot: 'bg-blue-500',
      };
    case 'Chemistry':
      return {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        dot: 'bg-emerald-500',
      };
    case 'Mathematics':
      return {
        badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        dot: 'bg-indigo-500',
      };
    default:
      return {
        badge: 'bg-slate-100 text-slate-700 border-slate-200',
        dot: 'bg-slate-500',
      };
  }
}

function isLiveNow(startTimeStr: string, endTimeStr: string): boolean {
  const now = Date.now();
  const start = new Date(startTimeStr).getTime();
  const end = new Date(endTimeStr).getTime();
  return now >= start && now <= end;
}

function getGoogleCalendarUrl(slot: Slot): string {
  const start = new Date(slot.startTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
  const end = new Date(slot.endTime).toISOString().replace(/-|:|\.\d\d\d/g, '');
  const title = encodeURIComponent(slot.title);
  const location = encodeURIComponent(slot.roomRef || 'Classroom / Online');
  const details = encodeURIComponent(
    `AIOS Extra/Remedial Session: ${slot.title}.\nPlease check your dashboard for preparation notes.`,
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&location=${location}&details=${details}`;
}

export function StudentExtraClasses() {
  const [activeTab, setActiveTab] = useState<'Upcoming' | 'Past'>('Upcoming');
  const [selectedSubject, setSelectedSubject] = useState<'ALL' | string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: profile } = useMyStudentProfile();
  const { data: slotsResp, isPending } = useTimetable();
  const { setStudentActiveNav } = useDashboardStore();

  const slots: Slot[] = useMemo(() => {
    const raw = slotsResp?.data ?? slotsResp ?? [];
    return Array.isArray(raw) ? raw : [];
  }, [slotsResp]);

  // Click outside listener for custom subject dropdown
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

  // Escape listener for modal and dropdown
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setSelectedSlot(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filter only REMEDIAL and EXTRA_CLASS slots
  const extraSlots = useMemo(() => {
    return slots.filter((s) => s.type === 'REMEDIAL' || s.type === 'EXTRA_CLASS');
  }, [slots]);

  const now = Date.now();

  const upcomingSlots = useMemo(() => {
    return extraSlots
      .filter((s) => new Date(s.endTime).getTime() >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [extraSlots, now]);

  const pastSlots = useMemo(() => {
    return extraSlots
      .filter((s) => new Date(s.endTime).getTime() < now)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [extraSlots, now]);

  // Available subjects for the dropdown (only student's enrolled class subjects)
  const availableSubjects = useMemo(() => {
    const map = new Map<string, number>();
    for (const sub of DEFAULT_STUDENT_ENROLLED_SUBJECTS) {
      map.set(sub, 0);
    }
    for (const slot of extraSlots) {
      const sub = extractSubject(slot.title);
      if (isStudentClassSubject(sub)) {
        map.set(sub, (map.get(sub) ?? 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [extraSlots]);

  // Filter current active list by subject and search
  const currentBaseList = activeTab === 'Upcoming' ? upcomingSlots : pastSlots;

  const filteredSlots = useMemo(() => {
    return currentBaseList.filter((slot) => {
      const sub = extractSubject(slot.title);
      if (selectedSubject !== 'ALL' && sub.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = slot.title.toLowerCase().includes(q);
        const matchRoom = slot.roomRef?.toLowerCase().includes(q);
        const matchSub = sub.toLowerCase().includes(q);
        if (!matchTitle && !matchRoom && !matchSub) return false;
      }
      return true;
    });
  }, [currentBaseList, selectedSubject, searchQuery]);

  const batchName = profile?.batch?.name ?? 'Class 11 - JEE Batch Alpha';

  return (
    <div className="p-3 sm:p-5 md:p-6 pb-28 sm:pb-8 animate-fadein min-h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-3xl w-full flex-1 flex flex-col p-4 sm:p-6 lg:p-8 bg-white relative">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-6 border-b border-slate-100 mb-6 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[19px] sm:text-[20px] font-bold text-slate-800">
                  Extra &amp; Remedial Classes
                </h2>
                <span className="hidden md:inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  {batchName}
                </span>
              </div>
              <p className="text-[12px] sm:text-[12.5px] text-slate-500">
                Special concept problem-solving, doubt clearing &amp; remedial sessions scheduled by your teachers.
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar: Tabs, Subject Filter Dropdown & Search */}
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-4">
          {/* Tabs */}
          <div className="flex items-center gap-6 sm:gap-8 overflow-x-auto no-scrollbar border-b border-slate-100 lg:border-b-0 pb-2 lg:pb-0">
            <button
              onClick={() => setActiveTab('Upcoming')}
              className={`pb-2.5 text-[13.5px] font-bold transition-all relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'Upcoming' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>Upcoming</span>
              <span
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold transition-colors ${
                  activeTab === 'Upcoming'
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {upcomingSlots.length}
              </span>
              {activeTab === 'Upcoming' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-indigo-600 rounded-t-full animate-fadein" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('Past')}
              className={`pb-2.5 text-[13.5px] font-bold transition-all relative whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                activeTab === 'Past' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span>Past Sessions</span>
              <span
                className={`px-2 py-0.5 text-[11px] rounded-full font-bold transition-colors ${
                  activeTab === 'Past'
                    ? 'bg-slate-200 text-slate-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {pastSlots.length}
              </span>
              {activeTab === 'Past' && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-indigo-600 rounded-t-full animate-fadein" />
              )}
            </button>
          </div>

          {/* Right Toolbar: Subject Selector & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
            {/* Apple-Style Subject Dropdown */}
            <div className="relative w-full sm:w-auto" ref={dropdownRef}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDropdownOpen((prev) => !prev)}
                  className="w-full sm:w-[220px] flex items-center justify-between gap-2.5 px-3.5 py-2 bg-slate-100/70 hover:bg-slate-200/60 active:scale-[0.98] text-slate-800 text-[12.5px] font-bold rounded-2xl border border-slate-200/60 transition-all shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">
                      {selectedSubject === 'ALL'
                        ? availableSubjects.length > 0
                          ? `All Subjects (${availableSubjects.length})`
                          : 'All Subjects'
                        : selectedSubject}
                    </span>
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
                    title="Reset filter"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Popover */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 sm:left-auto sm:right-0 mt-2 w-full sm:w-[240px] bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-2xl p-1.5 z-50 animate-fadein">
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
                        key={sub.name}
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
                              {sub.count} {sub.count === 1 ? 'class' : 'classes'}
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
                placeholder="Search topic or room..."
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


        {/* Sessions List */}
        <div className="space-y-3.5 flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-0.5 sm:pr-2 mb-4 w-full max-w-full">
          {isPending ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const subName = extractSubject(slot.title);
              const theme = getSubjectBadge(subName);
              const isRemedial = slot.type === 'REMEDIAL';
              const startDate = new Date(slot.startTime);
              const endDate = new Date(slot.endTime);
              const isLive = isLiveNow(slot.startTime, slot.endTime);

              const durationMins = Math.round((endDate.getTime() - startDate.getTime()) / 60_000);
              const isOnline = Boolean(
                slot.roomRef &&
                  (slot.roomRef.toLowerCase().includes('http') ||
                    slot.roomRef.toLowerCase().includes('meet.') ||
                    slot.roomRef.toLowerCase().includes('zoom')),
              );

              return (
                <div
                  key={slot.id}
                  onClick={() => setSelectedSlot(slot)}
                  className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-3.5 sm:p-5 border border-slate-100 rounded-2xl hover:border-indigo-200 hover:bg-indigo-50/20 active:scale-[0.99] transition-all cursor-pointer group gap-3.5 sm:gap-4 shadow-2xs bg-white w-full max-w-full overflow-hidden"
                >
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0 w-full max-w-full overflow-hidden">
                    {/* Date Block */}
                    <div className="w-14 h-14 sm:w-14 sm:h-14 rounded-2xl bg-slate-100/80 border border-slate-200/60 flex flex-col items-center justify-center flex-shrink-0 group-hover:border-indigo-200 group-hover:bg-indigo-50/60 transition-colors">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                        {startDate.toLocaleDateString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-[18px] sm:text-[20px] font-black text-slate-800 leading-none mt-0.5">
                        {startDate.getDate()}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase">
                        {startDate.toLocaleDateString(undefined, { weekday: 'short' })}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 w-full max-w-full overflow-hidden">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold border ${theme.badge}`}
                        >
                          {subName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${
                            isRemedial
                              ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                          }`}
                        >
                          {isRemedial ? 'Remedial Session' : 'Extra Class'}
                        </span>
                        {isLive && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live Now
                          </span>
                        )}
                      </div>

                      <div className="mb-1 w-full max-w-full overflow-hidden">
                        <MarqueeText
                          text={slot.title}
                          className="text-[14px] sm:text-[14.5px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] sm:text-[12px] text-slate-500 mt-1.5 min-w-0">
                        <span className="flex items-center gap-1.5 font-medium text-slate-600 flex-shrink-0">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {startDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} –{' '}
                          {endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{' '}
                          <span className="text-slate-400">({durationMins}m)</span>
                        </span>

                        {slot.roomRef && (
                          <span className="flex items-center gap-1.5 font-medium min-w-0 truncate">
                            {isOnline ? (
                              <>
                                <Video className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                <span className="text-purple-700 font-semibold truncate">Online Meeting</span>
                              </>
                            ) : (
                              <>
                                <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="text-slate-600 truncate">{slot.roomRef}</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Action Prompts */}
                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-shrink-0 pt-2.5 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    {isOnline && isLive && slot.roomRef ? (
                      <a
                        href={slot.roomRef.replace(/^Online:\s*/i, '')}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-[12px] font-bold flex items-center gap-1.5 shadow-2xs transition-all"
                      >
                        Join Live <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ) : (
                      <div className="flex items-center gap-1 text-[12.5px] font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                        <span>Details</span>
                        <ArrowRight className="w-4 h-4 text-indigo-500" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 px-4 text-center">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 flex items-center justify-center mb-3">
                {activeTab === 'Upcoming' ? (
                  <CalendarClock className="w-7 h-7 text-slate-400" />
                ) : (
                  <CalendarCheck className="w-7 h-7 text-slate-400" />
                )}
              </div>
              <h3 className="text-[15px] font-bold text-slate-700 mb-1">
                {activeTab === 'Upcoming'
                  ? 'No Upcoming Extra Classes Scheduled'
                  : 'No Past Extra Classes'}
              </h3>
              <p className="text-[12.5px] text-slate-500 max-w-sm mb-4">
                {activeTab === 'Upcoming'
                  ? 'Your batch is all caught up! When a teacher schedules a remedial or revision session for weak areas, it will appear here.'
                  : 'Past remedial and extra sessions conducted for your batch will be archived here.'}
              </p>
              {activeTab === 'Upcoming' && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={() => setStudentActiveNav('Weak Topics')}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12px] font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Check Weak Topics <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setStudentActiveNav('Doubt Center')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    Ask Teacher in Doubt Center <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SESSION DETAIL MODAL ───────────────────────── */}
        {selectedSlot && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fadein">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-slide-up border border-slate-100">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                      getSubjectBadge(extractSubject(selectedSlot.title)).badge
                    }`}
                  >
                    {extractSubject(selectedSlot.title)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold border uppercase tracking-wider ${
                      selectedSlot.type === 'REMEDIAL'
                        ? 'bg-rose-50 text-rose-700 border-rose-200/80'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200/80'
                    }`}
                  >
                    {selectedSlot.type === 'REMEDIAL' ? 'Remedial Session' : 'Extra Class'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedSlot(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
                <div>
                  <div className="mb-2">
                    <MarqueeText
                      text={selectedSlot.title}
                      className="text-[17px] font-bold text-slate-800"
                    />
                  </div>
                  <p className="text-[12px] text-slate-500">
                    Scheduled for <strong>{selectedSlot.batch?.name ?? batchName}</strong>
                  </p>
                </div>

                {/* Timing & Venue Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                      <Clock className="w-3 h-3" /> Timing
                    </span>
                    <p className="text-[13px] font-bold text-slate-800">
                      {new Date(selectedSlot.startTime).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}{' '}
                      –{' '}
                      {new Date(selectedSlot.endTime).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {new Date(selectedSlot.startTime).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mb-1">
                      {selectedSlot.roomRef?.includes('http') || selectedSlot.roomRef?.includes('meet.') ? (
                        <Video className="w-3 h-3 text-purple-600" />
                      ) : (
                        <MapPin className="w-3 h-3" />
                      )}{' '}
                      Location / Mode
                    </span>
                    <p className="text-[13px] font-bold text-slate-800 truncate">
                      {selectedSlot.roomRef ?? 'Offline Classroom'}
                    </p>
                    <p className="text-[11.5px] text-slate-500 mt-0.5">
                      {selectedSlot.roomRef?.includes('http') || selectedSlot.roomRef?.includes('meet.')
                        ? 'Online Live Video Meeting'
                        : 'On-Campus Classroom Session'}
                    </p>
                  </div>
                </div>

                {/* Preparation Guide */}
                <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <div className="text-[12.5px] text-indigo-900 leading-relaxed">
                    <strong className="block mb-1">Session Preparation Tip:</strong>
                    This session is designed to address identified weak areas and test mistakes. Please
                    bring your solved notes and test sheets for discussion.
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  {selectedSlot.roomRef &&
                    (selectedSlot.roomRef.includes('http') || selectedSlot.roomRef.includes('meet.')) && (
                      <a
                        href={selectedSlot.roomRef.replace(/^Online:\s*/i, '')}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Video className="w-4 h-4" /> Join Live Meeting Room
                      </a>
                    )}

                  <a
                    href={getGoogleCalendarUrl(selectedSlot)}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" /> Add to Google Calendar / Remind Me
                  </a>

                  <button
                    onClick={() => {
                      setSelectedSlot(null);
                      setStudentActiveNav('Weak Topics');
                    }}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[12.5px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Review Related Weak Topics <ArrowRight className="w-3.5 h-3.5" />
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
