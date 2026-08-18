'use client';

import { useState, useMemo } from 'react';
import { 
  X, CheckCircle2, Clock, FileText, Download, Eye, Send, 
  Search, AlertCircle, FileCheck, ArrowRight, UserCheck, UserX, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { students as allStudents } from '@/lib/mock-data/teacher';

export interface AssignmentDetailModalProps {
  assignment: {
    id: string;
    title: string;
    batchId: string;
    dueDate: string;
    totalStudents: number;
    submitted: number;
    status: string;
  };
  onClose: () => void;
}

interface StudentSubmission {
  studentId: string;
  name: string;
  rollNo: string;
  submitted: boolean;
  submittedAt?: string;
  fileName?: string;
  fileSize?: string;
  grade?: string;
  feedback?: string;
}

export function AssignmentDetailModal({ assignment, onClose }: AssignmentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'submitted' | 'pending'>('submitted');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState<StudentSubmission | null>(null);
  const [currentGrade, setCurrentGrade] = useState('');
  const [reminderSent, setReminderSent] = useState(false);

  // Generate deterministic student submission status based on mock student roster
  const initialSubmissions: StudentSubmission[] = useMemo(() => {
    const batchStudents = allStudents.filter(s => s.batchId === assignment.batchId);
    const pool = batchStudents.length > 0 ? batchStudents : allStudents;

    return pool.map((s, idx) => {
      const isSubmitted = idx < Math.min(assignment.submitted, pool.length);
      return {
        studentId: s.id,
        name: s.name,
        rollNo: s.rollNo,
        submitted: isSubmitted,
        submittedAt: isSubmitted ? `7 May 2025, 04:${(10 + idx * 7) % 60} PM` : undefined,
        fileName: isSubmitted ? `${s.name.replace(/\s+/g, '_')}_${assignment.id}.pdf` : undefined,
        fileSize: isSubmitted ? `${(1.2 + (idx * 0.4)).toFixed(1)} MB` : undefined,
        grade: isSubmitted && idx % 2 === 0 ? `${45 - idx}/50` : undefined,
      };
    });
  }, [assignment]);

  const [submissions, setSubmissions] = useState<StudentSubmission[]>(initialSubmissions);

  const handleSelectSubmission = (sub: StudentSubmission) => {
    setSelectedSubmission(sub);
    setCurrentGrade(sub.grade || '');
  };

  const handleSaveGrade = () => {
    if (!selectedSubmission) return;
    setSubmissions(prev =>
      prev.map(s => s.studentId === selectedSubmission.studentId ? { ...s, grade: currentGrade } : s)
    );
    setSelectedSubmission(prev => prev ? { ...prev, grade: currentGrade } : null);
    toast.success(`Grade saved for ${selectedSubmission.name}`);
  };

  // Separate submitted and non-submitted lists, sorted alphabetically A-Z
  const submittedList = useMemo(() => {
    return submissions
      .filter(s => s.submitted)
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [submissions, searchTerm]);

  const pendingList = useMemo(() => {
    return submissions
      .filter(s => !s.submitted)
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.rollNo.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [submissions, searchTerm]);

  const handleSendReminder = () => {
    setReminderSent(true);
    setTimeout(() => setReminderSent(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
      {/* 70% Viewport Modal */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[70vw] h-[70vh] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between bg-slate-50/80 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                Batch {assignment.batchId}
              </span>
              <span className="text-[12px] font-medium text-slate-400">Due: {assignment.dueDate}</span>
            </div>
            <h2 className="text-[18px] font-bold text-slate-800 leading-tight">{assignment.title}</h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Header Controls & Search */}
        <div className="px-6 py-3 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white flex-shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('submitted')}
              className={`flex items-center gap-2 px-4 py-1.5 text-[12.5px] font-bold rounded-lg transition-all ${
                activeTab === 'submitted' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              Submitted ({submittedList.length})
            </button>

            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-2 px-4 py-1.5 text-[12.5px] font-bold rounded-lg transition-all ${
                activeTab === 'pending' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserX className="w-3.5 h-3.5 text-rose-500" />
              Not Submitted ({pendingList.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search student..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent text-[12px] outline-none w-full placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {/* ── SUBMITTED STUDENTS TAB ────────────────────────────────────────────── */}
          {activeTab === 'submitted' && (
            submittedList.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-[13px] font-semibold">No submitted assignments match your search.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {submittedList.map(s => (
                  <div
                    key={s.studentId}
                    className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs transition-all flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 font-black text-[13px] flex items-center justify-center flex-shrink-0">
                        {s.name.split(' ').map(n => n[0]).join('')}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-bold text-slate-800">{s.name}</p>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                            Submitted
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-500 mt-0.5">
                          Roll: {s.rollNo} · {s.submittedAt}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Uploaded File Badge */}
                      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-[12px] font-medium text-slate-700">
                        <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="truncate max-w-[140px]">{s.fileName}</span>
                        <span className="text-[10px] text-slate-400">({s.fileSize})</span>
                      </div>

                      {/* Open File Preview CTA */}
                      <button
                        onClick={() => handleSelectSubmission(s)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View File
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ── NOT SUBMITTED STUDENTS TAB ────────────────────────────────────────── */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {/* Reminder Banner */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-rose-900">
                      {pendingList.length} Students Pending Submission
                    </p>
                    <p className="text-[11.5px] text-rose-700">
                      Send a instant push notification reminder to all non-submitting students.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSendReminder}
                  disabled={reminderSent}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[12px] font-bold rounded-xl transition-all flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  {reminderSent ? 'Reminders Sent!' : 'Nudge All Non-Submitters'}
                </button>
              </div>

              {pendingList.length === 0 ? (
                <div className="py-16 text-center text-emerald-600 font-semibold text-[13px]">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  Great news! All students in this batch have submitted their assignment.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {pendingList.map(s => (
                    <div
                      key={s.studentId}
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 font-black text-[13px] flex items-center justify-center flex-shrink-0">
                          {s.name.split(' ').map(n => n[0]).join('')}
                        </div>

                        <div>
                          <p className="text-[14px] font-bold text-slate-800">{s.name}</p>
                          <p className="text-[11.5px] text-slate-500 mt-0.5">Roll: {s.rollNo}</p>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold px-3 py-1 bg-rose-100 text-rose-700 rounded-lg">
                        Not Submitted
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11.5px] text-slate-500 flex-shrink-0">
          <span>Total Batch Roster: {submissions.length} Students</span>
          <span className="font-semibold text-slate-700">
            Submission Rate: {Math.round((assignment.submitted / Math.max(assignment.totalStudents, 1)) * 100)}%
          </span>
        </div>
      </div>

      {/* ── SUBMITTED STUDENT FILE PREVIEW MODAL ────────────────────────────────────── */}
      {selectedSubmission && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Preview Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-[12px] flex items-center justify-center">
                  {selectedSubmission.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h3 className="text-[15px] font-bold">{selectedSubmission.name}'s Submission</h3>
                  <p className="text-[11px] text-slate-400">Uploaded {selectedSubmission.submittedAt}</p>
                </div>
              </div>

              <button
                onClick={() => setSelectedSubmission(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Document Render Mock Window */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex-1 space-y-4 flex flex-col items-center">
              <div className="bg-white border border-slate-300 shadow-md rounded-xl p-8 w-full max-w-lg min-h-[320px] flex flex-col justify-between text-slate-700">
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <span className="font-bold text-[13px] text-slate-800">{selectedSubmission.fileName}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">{selectedSubmission.fileSize}</span>
                  </div>

                  {/* Document preview simulation */}
                  <div className="space-y-2 py-4 text-[12px] text-slate-500">
                    <p className="font-bold text-slate-800 text-[14px]">Assignment Solutions & Hand-written Answers</p>
                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                    <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                    <div className="h-2 bg-slate-200 rounded w-4/6"></div>
                    <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl my-4 text-indigo-900 text-[11.5px] font-medium">
                      <p className="font-bold text-indigo-800 mb-1">Student Comments / Notes:</p>
                      "Respected Sir, I have attached all 15 NCERT numerical solutions for Rotational Motion as requested."
                    </div>
                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                    <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Page 1 of 3 (PDF Verified)</span>
                </div>
              </div>
            </div>

            {/* Footer Action Bar */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-slate-600">Marks / Grade:</span>
                <input
                  type="text"
                  placeholder="e.g. 45/50"
                  value={currentGrade}
                  onChange={e => setCurrentGrade(e.target.value)}
                  className="w-24 px-3 py-1.5 border border-slate-300 rounded-xl text-[12.5px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
                <button
                  onClick={handleSaveGrade}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-xl transition-all shadow-2xs"
                >
                  Save Grade
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedSubmission(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 text-[12px] font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    toast.success(`Downloading ${selectedSubmission.fileName}…`, {
                      icon: '📄',
                    });
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[12px] font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
