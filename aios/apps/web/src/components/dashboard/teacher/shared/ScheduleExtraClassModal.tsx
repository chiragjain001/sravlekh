'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2,
  X,
  Video,
  MapPin,
  Clock,
  Sparkles,
  BookOpen,
  Link as LinkIcon,
  Loader2,
  Users,
  Target,
  GraduationCap,
  Calendar as CalendarIcon,
  Activity,
  Zap,
  FileText,
  Layers,
  CheckSquare,
  Square,
  ChevronDown,
  Check,
} from 'lucide-react';
import {
  useBatches,
  useCreateTimetableSlot,
  useMyTeacherProfile,
  useSubjects,
} from '@/hooks/useApi';
import { useAuth } from '@/contexts/auth.context';
import { DEFAULT_STUDENT_ENROLLED_SUBJECTS } from '@/lib/student-subjects';
import { DatePicker } from '@/components/ui/DatePicker';
import { AppleDropdown } from '@/components/ui/AppleDropdown';
import { TimePicker } from '@/components/ui/TimePicker';

export interface ScheduleExtraClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBatchId?: string;
  initialTopic?: string;
  onScheduled?: () => void;
}

const TOPIC_PRESETS = [
  { label: 'Doubt Resolution', icon: <Target className="w-3.5 h-3.5 text-indigo-600" />, text: 'Doubt Resolution & Problem Solving' },
  { label: 'Concept Revision', icon: <BookOpen className="w-3.5 h-3.5 text-emerald-600" />, text: 'Core Concept Revision & Practice' },
  { label: 'Exam Prep', icon: <GraduationCap className="w-3.5 h-3.5 text-amber-600" />, text: 'Exam Preparation & Model Questions' },
  { label: 'Formula Drills', icon: <Zap className="w-3.5 h-3.5 text-blue-600" />, text: 'Formula Drills & Numerical Practice' },
  { label: 'Homework Review', icon: <FileText className="w-3.5 h-3.5 text-purple-600" />, text: 'Homework & Assignment Discussion' },
];

const ROOM_PRESETS = ['Room 204', 'Physics Lab', 'Chemistry Lab', 'Auditorium', 'Library Hall'];

const TIME_PRESETS = ['15:00', '16:00', '16:30', '17:00', '18:00'];

const DURATION_OPTIONS = [
  { label: '30m', value: '30' },
  { label: '45m', value: '45' },
  { label: '60m', value: '60' },
  { label: '90m', value: '90' },
  { label: '2h', value: '120' },
];

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

export function ScheduleExtraClassModal({
  isOpen,
  onClose,
  initialBatchId = '',
  initialTopic = '',
  onScheduled,
}: ScheduleExtraClassModalProps) {
  const { user } = useAuth();
  const { data: batchesResp } = useBatches();
  const allBatches: any[] = batchesResp?.data ?? batchesResp ?? [];

  const { data: profile } = useMyTeacherProfile();
  const { data: subjectsResp } = useSubjects();
  const allSubjects: any[] = subjectsResp?.data ?? subjectsResp ?? [];

  const createSlot = useCreateTimetableSlot();

  const [done, setDone] = useState(false);

  // ── Scoped Batches for Teacher ─────────────────────────────────────────────
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

  // Determine active open class
  const [activeClass, setActiveClass] = useState<string>('');
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);

  // ── Scoped Subjects for Teacher ────────────────────────────────────────────
  const availableSubjects = useMemo(() => {
    if (!profile) {
      if (allSubjects.length > 0) return allSubjects.map((s: any) => s.name || s);
      return DEFAULT_STUDENT_ENROLLED_SUBJECTS;
    }

    const teacherSubjectIds = new Set<string>();
    if (Array.isArray(profile.subjectIds)) {
      profile.subjectIds.forEach((id: string) => teacherSubjectIds.add(id));
    }
    (profile.batchAssignments ?? []).forEach((ba: any) => {
      if (ba.subjectId && !ba.removedAt) teacherSubjectIds.add(ba.subjectId);
    });

    if (teacherSubjectIds.size > 0 && allSubjects.length > 0) {
      const filtered = allSubjects
        .filter((s: any) => teacherSubjectIds.has(s.id))
        .map((s: any) => s.name);
      if (filtered.length > 0) return filtered;
    }

    if (allSubjects.length > 0) return allSubjects.map((s: any) => s.name);
    return DEFAULT_STUDENT_ENROLLED_SUBJECTS;
  }, [allSubjects, profile]);

  const [form, setForm] = useState({
    subject: 'Physics',
    topic: initialTopic,
    isRemedial: true,
    mode: 'OFFLINE' as 'OFFLINE' | 'ONLINE',
    date: '',
    time: '16:30',
    duration: '60',
    room: 'Room 204',
    onlinePlatform: 'Google Meet',
    meetingUrl: '',
    prepNotes: '',
  });

  // ── Initialize Active Class & Sections ────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setDone(false);

      // 1. Identify which Class is open
      const initialBatchObj = availableBatches.find((b: any) => b.id === initialBatchId);
      const targetClass = initialBatchObj
        ? getBatchClassYear(initialBatchObj)
        : teacherClasses[0] || 'Class 10';

      setActiveClass(targetClass);

      // 2. Sections of that open class ONLY
      const classSections = batchesByClass.get(targetClass) || [];
      if (initialBatchId) {
        setSelectedBatchIds([initialBatchId]);
      } else if (classSections.length > 0) {
        // Pre-select first section or all if 1
        setSelectedBatchIds([classSections[0]!.id]);
      } else {
        setSelectedBatchIds([]);
      }

      // 3. Subject detection
      let initialSub = availableSubjects[0] || 'Physics';
      if (initialTopic) {
        const lower = initialTopic.toLowerCase();
        const found = availableSubjects.find((s: string) => lower.includes(s.toLowerCase()));
        if (found) initialSub = found;
      }

      setForm({
        subject: initialSub,
        topic: initialTopic,
        isRemedial: true,
        mode: 'OFFLINE',
        date: new Date().toISOString().slice(0, 10),
        time: '16:30',
        duration: '60',
        room: 'Room 204',
        onlinePlatform: 'Google Meet',
        meetingUrl: '',
        prepNotes: '',
      });
    }
  }, [isOpen, initialBatchId, initialTopic, availableBatches, batchesByClass, teacherClasses, availableSubjects]);

  // When active class changes, restrict selected batches to that class's sections
  const handleClassChange = (newClass: string) => {
    setActiveClass(newClass);
    const sections = batchesByClass.get(newClass) || [];
    if (sections.length > 0) {
      setSelectedBatchIds([sections[0]!.id]);
    } else {
      setSelectedBatchIds([]);
    }
  };

  // Only sections of active class are displayed
  const currentClassSections = useMemo(() => {
    return batchesByClass.get(activeClass) || [];
  }, [batchesByClass, activeClass]);

  // Toggle a single section
  const toggleSection = (batchId: string) => {
    setSelectedBatchIds((prev) => {
      if (prev.includes(batchId)) {
        if (prev.length === 1) return prev; // Keep at least 1 section selected
        return prev.filter((id) => id !== batchId);
      } else {
        return [...prev, batchId];
      }
    });
  };

  const selectAllSections = () => {
    if (selectedBatchIds.length === currentClassSections.length) {
      if (currentClassSections.length > 0) {
        setSelectedBatchIds([currentClassSections[0]!.id]);
      }
    } else {
      setSelectedBatchIds(currentClassSections.map((b: any) => b.id));
    }
  };

  // Total students in selected sections
  const totalStudents = useMemo(() => {
    return currentClassSections
      .filter((b: any) => selectedBatchIds.includes(b.id))
      .reduce((sum: number, b: any) => sum + (b._count?.students ?? 0), 0);
  }, [currentClassSections, selectedBatchIds]);

  // ── Computed 12-Hour Time Window Preview ───────────────────────────────────
  const timeWindowDisplay = useMemo(() => {
    if (!form.time) return '';
    try {
      const parts = form.time.split(':');
      const h = parseInt(parts[0] ?? '', 10);
      const m = parseInt(parts[1] ?? '', 10);
      if (isNaN(h) || isNaN(m)) return '';
      const startMins = h * 60 + m;
      const endMins = startMins + Number(form.duration);
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;

      const formatH = (hour: number) => {
        const period = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return { h12, period };
      };
      const s = formatH(h);
      const e = formatH(endH);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${s.h12}:${pad(m)} ${s.period} – ${e.h12}:${pad(endM)} ${e.period}`;
    } catch {
      return '';
    }
  }, [form.time, form.duration]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBatchIds.length === 0 || !form.topic || !form.date || !form.time) return;

    const startTime = new Date(`${form.date}T${form.time}:00`);
    const endTime = new Date(startTime.getTime() + Number(form.duration) * 60_000);

    const prefix = `${form.subject}: `;
    const cleanTitle = form.topic.toLowerCase().startsWith(form.subject.toLowerCase())
      ? form.topic
      : `${prefix}${form.topic}`;

    let roomRefValue: string | undefined;
    if (form.mode === 'ONLINE') {
      const url =
        form.meetingUrl.trim() ||
        `https://meet.google.com/aio-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
      roomRefValue = url.startsWith('http') ? url : `https://${url}`;
    } else {
      roomRefValue = form.room.trim() || 'Room 204, Academic Block';
    }

    try {
      await createSlot.mutateAsync({
        batchIds: selectedBatchIds,
        batchId: selectedBatchIds[0],
        type: form.isRemedial ? 'REMEDIAL' : 'EXTRA_CLASS',
        title: cleanTitle,
        teacherUserId: user?.id,
        roomRef: roomRefValue,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });
      setDone(true);
      onScheduled?.();
      setTimeout(() => {
        setDone(false);
        onClose();
      }, 1400);
    } catch {
      // Handled by mutation toast
    }
  };

  const subjectOptions = availableSubjects.map((sub: string) => ({
    value: sub,
    label: sub,
  }));

  const classOptions = teacherClasses.map((cls: string) => ({
    value: cls,
    label: cls,
    badge: `${batchesByClass.get(cls)?.length || 0} sections`,
  }));

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadein">
      <div className="bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh] sm:max-h-[88vh]">
        {/* ── Sticky Modal Header (Apple Style) ─────────────────────────── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white z-10 relative">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex items-center justify-center text-indigo-600 flex-shrink-0 shadow-2xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] sm:text-[17px] font-bold text-slate-900 leading-tight truncate">
                Schedule Session
              </h2>
              <p className="text-[11.5px] sm:text-[12px] text-slate-500 truncate">
                Configure remedial or extra class for {activeClass || 'your batch'}
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

        {done ? (
          /* ── Celebratory Success Confirmation ─────────────────────────── */
          <div className="flex flex-col items-center justify-center py-16 px-6 gap-3.5 text-center flex-1">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 animate-bounce shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <div>
              <p className="text-[17px] font-bold text-slate-900">Session Scheduled Successfully!</p>
              <p className="text-[12.5px] text-slate-500 max-w-xs mt-1">
                Published to student timetable and notifications feed.
              </p>
            </div>
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200/70 rounded-2xl text-[12px] text-slate-700 space-y-1 w-full max-w-sm text-left">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Class & Sections:</span>
                <span className="font-bold text-slate-800">
                  {activeClass} ({selectedBatchIds.length} section{selectedBatchIds.length > 1 ? 's' : ''})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Subject:</span>
                <span className="font-bold text-indigo-600">{form.subject}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Time:</span>
                <span className="font-bold text-slate-800">{timeWindowDisplay || form.time}</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Scrollable Form Body with Guaranteed Element Spacing ────── */}
            <form
              id="schedule-session-form"
              onSubmit={handleSubmit}
              className="px-5 sm:px-6 py-6 flex flex-col gap-5 sm:gap-6 overflow-y-auto custom-scrollbar flex-1"
            >
              {/* 1. Target Class & Sections */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Class & Sections <span className="text-rose-500">*</span>
                  </label>
                  {currentClassSections.length > 1 && (
                    <button
                      type="button"
                      onClick={selectAllSections}
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

                {/* Sections of the active class ONLY — compact, 1-tap multi-select chips */}
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
                          onClick={() => toggleSection(b.id)}
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

              {/* 2. Subject Selector */}
              <div>
                <AppleDropdown
                  label="Subject"
                  required
                  value={form.subject}
                  onChange={(val) => setForm((p) => ({ ...p, subject: val }))}
                  options={subjectOptions}
                  icon={<GraduationCap className="w-3.5 h-3.5" />}
                  themeColor="indigo"
                  placement="bottom"
                />
              </div>

              {/* 3. Session Purpose (Sleek Apple Segmented Switcher) */}
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-indigo-600" />
                  Session Purpose
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, isRemedial: true }))}
                    className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      form.isRemedial
                        ? 'bg-white shadow-xs text-rose-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span className="text-[13px]">Remedial Class</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, isRemedial: false }))}
                    className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      !form.isRemedial
                        ? 'bg-white shadow-xs text-indigo-700 font-bold'
                        : 'text-slate-600 hover:text-slate-900 font-semibold'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <span className="text-[13px]">Extra Class</span>
                  </button>
                </div>
              </div>

              {/* 4. Topic / Agenda with Single-Row Scrollable Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[12px] font-bold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    Topic / Agenda <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">1-tap presets</span>
                </div>
                <input
                  required
                  value={form.topic}
                  onChange={(e) => setForm((p) => ({ ...p, topic: e.target.value }))}
                  placeholder="e.g. Rotational Dynamics — Torque Problems & Doubt Clearing"
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-white transition-all shadow-2xs"
                />

                {/* Single-Row Horizontal Scroll for Clean, Uncluttered Presets */}
                <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto custom-scrollbar pb-1">
                  {TOPIC_PRESETS.map((tpl) => (
                    <button
                      key={tpl.label}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, topic: tpl.text }))}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 border border-slate-200/60 transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                      {tpl.icon}
                      <span>{tpl.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Delivery Mode: Offline vs Online Live */}
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-2">
                  Delivery Mode
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, mode: 'OFFLINE' }))}
                    className={`flex items-center justify-center gap-2 py-2.5 text-[12.5px] font-bold rounded-xl transition-all cursor-pointer ${
                      form.mode === 'OFFLINE'
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Offline Classroom</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, mode: 'ONLINE' }))}
                    className={`flex items-center justify-center gap-2 py-2.5 text-[12.5px] font-bold rounded-xl transition-all cursor-pointer ${
                      form.mode === 'ONLINE'
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Online Live Meeting</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Venue / Meeting Input */}
              {form.mode === 'OFFLINE' ? (
                <div className="p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-2">
                  <label className="block text-[11.5px] font-bold text-slate-600">
                    Classroom / Venue Reference
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={form.room}
                      onChange={(e) => setForm((p) => ({ ...p, room: e.target.value }))}
                      placeholder="e.g. Room 204, Ramanujan Wing"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[12.5px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                    />
                  </div>
                  {/* Single-Row Horizontal Scroll for Room Chips */}
                  <div className="flex items-center gap-1.5 pt-1 overflow-x-auto custom-scrollbar pb-0.5">
                    {ROOM_PRESETS.map((rm) => (
                      <button
                        key={rm}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, room: rm }))}
                        className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex-shrink-0 ${
                          form.room === rm
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200 font-bold'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {rm}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11.5px] font-bold text-purple-900">
                      Live Meeting Link (Google Meet / Zoom)
                    </label>
                    <div className="flex gap-1.5">
                      {['Google Meet', 'Zoom', 'Custom'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, onlinePlatform: p }))}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-colors cursor-pointer ${
                            form.onlinePlatform === p
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-purple-700 border-purple-200'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <LinkIcon className="w-4 h-4 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      value={form.meetingUrl}
                      onChange={(e) => setForm((p) => ({ ...p, meetingUrl: e.target.value }))}
                      placeholder="https://meet.google.com/xyz-abcd-efg"
                      className="w-full pl-9 pr-3.5 py-2 bg-white border border-purple-200/80 rounded-xl text-[12.5px] text-purple-900 focus:outline-none focus:ring-2 focus:ring-purple-400/30"
                    />
                  </div>

                  {!form.meetingUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          meetingUrl: `https://meet.google.com/aio-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`,
                        }))
                      }
                      className="text-[11px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-generate demo meeting link
                    </button>
                  )}
                </div>
              )}

              {/* 6. Date & Time (Responsive 2-Column Grid with Roomy Gaps) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <DatePicker
                    label="Session Date"
                    required
                    value={form.date}
                    onChange={(d) => setForm((p) => ({ ...p, date: d }))}
                    minDate={new Date().toISOString().split('T')[0]}
                    placeholder="Select date…"
                    quickPresets={true}
                    placement="top"
                  />
                </div>

                <div>
                  <TimePicker
                    label="Start Time"
                    required
                    value={form.time}
                    onChange={(t) => setForm((p) => ({ ...p, time: t }))}
                    placement="top"
                    align="right"
                    quickPresets={true}
                  />
                </div>
              </div>

              {/* 7. Duration & Calculated Window Banner */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-bold text-slate-700">Duration</label>
                  <span className="text-[11.5px] font-bold text-indigo-600">
                    {form.duration} minutes
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, duration: opt.value }))}
                      className={`py-2 text-[12px] font-bold rounded-xl border transition-all cursor-pointer text-center ${
                        form.duration === opt.value
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs scale-[1.02]'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Helpful Session Window Banner */}
                {timeWindowDisplay && (
                  <div className="mt-2.5 px-3.5 py-2.5 bg-indigo-50/70 border border-indigo-100/80 rounded-xl text-[12px] text-indigo-900 flex items-center justify-between">
                    <span className="font-semibold text-indigo-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Session Window:
                    </span>
                    <span className="font-bold">{timeWindowDisplay}</span>
                  </div>
                )}
              </div>
            </form>

            {/* ── Sticky Modal Footer (Pinned at bottom on all devices, Solid Opaque) ──── */}
            <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-slate-100 bg-white flex-shrink-0 z-10 relative">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 text-[13px] font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="schedule-session-form"
                disabled={
                  createSlot.isPending || selectedBatchIds.length === 0 || !form.topic || !form.date || !form.time
                }
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-[13px] font-bold rounded-xl shadow-md hover:shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {createSlot.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Scheduling…</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Schedule Session</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
