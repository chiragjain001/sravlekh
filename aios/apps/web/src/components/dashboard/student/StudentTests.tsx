'use client';

import { useEffect, useMemo, useState } from 'react';
import { FileText, ChevronRight, Search, BarChart3, X, Calendar, MapPin, Clock } from 'lucide-react';
import { useExams, useMyStudentProfile } from '@/hooks/useApi';

interface Exam {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledDate: string | null;
  durationMinutes: number | null;
  venue: string | null;
  batch?: { name: string };
  blueprint?: { totalMarks: number };
}
interface ScoreRecord {
  id: string;
  percentage: number;
  rank: number | null;
  createdAt: string;
  exam?: { id: string; title: string; scheduledDate: string | null; type: string } | null;
}

function useCountdown(target: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const mins = Math.floor((diff / (1000 * 60)) % 60);
  return { days, hours, mins };
}

export function StudentTests() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState<ScoreRecord | null>(null);

  const { data: examsResp, isPending: examsPending } = useExams();
  const exams: Exam[] = useMemo(() => examsResp?.data ?? [], [examsResp]);
  const { data: profile, isPending: profilePending } = useMyStudentProfile();
  const scoreRecords: ScoreRecord[] = useMemo(() => profile?.scoreRecords ?? [], [profile]);

  const nextTest = useMemo(() => {
    const upcoming = exams
      .filter((e) => e.scheduledDate && new Date(e.scheduledDate).getTime() >= Date.now())
      .sort((a, b) => new Date(a.scheduledDate!).getTime() - new Date(b.scheduledDate!).getTime());
    return upcoming[0] ?? null;
  }, [exams]);

  const countdown = useCountdown(nextTest?.scheduledDate ?? null);

  const filteredTests = scoreRecords.filter((r) => (r.exam?.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">My Tests</h2>
              <p className="text-[12px] text-slate-500">Your real exam schedule and results.</p>
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Search past tests..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {/* Left Column: Upcoming Test */}
          <div className="flex flex-col gap-6">
            <h3 className="text-[14px] font-bold text-slate-800">Upcoming Test</h3>
            {examsPending ? (
              <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
            ) : nextTest ? (
              <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <FileText className="w-24 h-24 text-indigo-500" />
                </div>
                <div className="relative z-10">
                  <h4 className="text-[16px] font-bold text-indigo-700 mb-1">{nextTest.title}</h4>
                  <p className="text-[12px] text-slate-500 mb-0.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> {new Date(nextTest.scheduledDate!).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {nextTest.venue && <p className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {nextTest.venue}</p>}
                  {nextTest.durationMinutes && <p className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-0.5"><Clock className="w-3.5 h-3.5" /> {nextTest.durationMinutes} minutes</p>}

                  {countdown && (
                    <div className="flex items-center gap-4 my-6 bg-white/40 p-4 rounded-xl border border-white/50 backdrop-blur-sm inline-flex">
                      {[{ val: countdown.days, label: 'DAYS' }, { val: countdown.hours, label: 'HRS' }, { val: countdown.mins, label: 'MINS' }].map((item, idx) => (
                        <div key={idx} className="flex items-center">
                          <div className="text-center min-w-[36px]">
                            <span className="text-3xl font-black text-indigo-600 font-mono tracking-tight">{String(item.val).padStart(2, '0')}</span>
                            <p className="text-[9px] font-bold text-indigo-400/80 mt-0.5 uppercase tracking-wider">{item.label}</p>
                          </div>
                          {idx < 2 && <span className="text-2xl font-bold text-indigo-300/50 mx-3 -mt-4">:</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-[11.5px] text-slate-500 bg-white/60 rounded-lg px-3 py-2">
                    Online self-attempt isn&apos;t available in AIOS yet — this exam will be conducted in person / on paper. Ask your teacher for details.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 text-center text-slate-400 text-[13px]">
                No upcoming test scheduled for your batch right now.
              </div>
            )}
          </div>

          {/* Right Column: Past Tests (real ScoreRecords) */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6 flex justify-between items-center">
              Past Tests
              <span className="text-[11px] font-normal text-slate-400">{filteredTests.length} tests found</span>
            </h3>

            <div className="space-y-3">
              {profilePending ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}</div>
              ) : filteredTests.length > 0 ? filteredTests.map((test) => (
                <div
                  key={test.id}
                  onClick={() => setSelectedTest(test)}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{test.exam?.title ?? 'Exam'}</p>
                      <p className="text-[11.5px] text-slate-500 mt-0.5">{new Date(test.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[15px] font-black text-indigo-600">{Math.round(test.percentage)}%</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <FileText className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-[13px] font-medium">{searchQuery ? `No past tests found matching "${searchQuery}"` : 'No graded tests yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Test Detail Modal — real data only */}
        {selectedTest && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center animate-fadein sm:p-4">
            <div className="bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative animate-slide-up">
              <button onClick={() => setSelectedTest(null)} className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>

              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>

              <h3 className="text-[20px] font-bold text-slate-800 mb-1">{selectedTest.exam?.title ?? 'Exam'}</h3>
              <p className="text-[13px] text-slate-500 mb-6 font-medium">Graded on {new Date(selectedTest.createdAt).toLocaleDateString()}</p>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Score</p>
                  <p className="text-[32px] font-black text-indigo-600">{Math.round(selectedTest.percentage)}%</p>
                </div>
                {selectedTest.rank != null && (
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rank</p>
                    <p className="text-[24px] font-bold text-slate-700">#{selectedTest.rank}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
