'use client';
// AdminStudent360 - Unified per-student cross-subject view for Admins
// Uses only real existing APIs:
//   useStudent          -> profile, batch, mastery scores, score records
//   useBatchPerformance -> avg score, rank in their batch
//   useAttendanceSummary -> attendance breakdown for this student
//   useDoubts           -> open doubts count
// No invented metrics. Admins reach this via AdminStudents StudentProfileDrawer
// or via a new "View 360" action we add to the AdminStudents list row.

import { useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, MessageCircle } from 'lucide-react';
import { useStudent, useBatchPerformance, useAttendanceSummary, useDoubts } from '@/hooks/useApi';

type Tab = 'summary' | 'mastery' | 'interventions' | 'tests' | 'attendance';

function TrendIcon({ t }: { t: number }) {
  if (t > 0.02)  return <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />;
  if (t < -0.02) return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
  return               <Minus         className="w-3.5 h-3.5 text-slate-400" />;
}

interface AdminStudent360Props {
  studentId: string;
  onClose: () => void;
}

export function AdminStudent360({ studentId, onClose }: AdminStudent360Props) {
  const [tab, setTab] = useState<Tab>('summary');

  const { data: student, isLoading } = useStudent(studentId);
  const { data: performance }        = useBatchPerformance(student?.batchId ?? null);
  const { data: attendanceSummary }  = useAttendanceSummary(
    student?.batchId ? { batchId: student.batchId } : undefined,
  );
  const { data: doubtsResp }         = useDoubts({ studentProfileId: studentId, limit: 50 });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-12 text-slate-400 text-[13px]">Loading student profile…</div>
      </div>
    );
  }

  if (!student) return null;

  const perfRow      = performance?.students?.find((s: any) => s.id === studentId);
  const avgScore     = perfRow?.avgScore ?? 0;
  const rank         = perfRow?.rank;
  const masteryScores  = student.masteryScores ?? [];
  const scoreRecords   = student.scoreRecords  ?? [];
  const doubts         = doubtsResp?.data ?? [];

  const strong  = masteryScores.filter((m: any) => m.masteryValue >= 0.75);
  const weak    = masteryScores.filter((m: any) => m.masteryValue <  0.60);

  const attBreakdown = attendanceSummary?.statusBreakdown ?? { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
  const attTotal = Object.values(attBreakdown).reduce((a: any, b: any) => a + b, 0) as number;
  const attPct   = attTotal > 0 ? Math.round((attBreakdown.PRESENT / attTotal) * 100) : null;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'summary',       label: 'Overview'      },
    { key: 'mastery',       label: 'Topic Mastery'  },
    { key: 'interventions', label: 'Interventions'  },
    { key: 'tests',         label: 'Test History'   },
    { key: 'attendance',    label: 'Attendance'     },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadein">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-[18px] font-black flex-shrink-0 ${
              weak.length > 2 ? 'bg-rose-100 text-rose-700' : avgScore >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'
            }`}>
              {(student.user?.name ?? '?').split(' ').map((n: string) => n[0]).join('')}
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-slate-800">{student.user?.name ?? 'Student'}</h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                Roll: <span className="font-semibold text-slate-700">{student.rollNumber ?? '—'}</span>
                {rank && <> · Rank <span className="font-semibold text-slate-700">#{rank}</span> in batch</>}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{student.batch?.name ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 py-2.5 bg-slate-50 border-b border-slate-100">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
                tab === t.key ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {/* ── Summary ── */}
          {tab === 'summary' && (
            <div className="space-y-4 animate-fadein">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Avg Score',        value: `${avgScore}%`,          color: avgScore >= 75 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-600' : 'text-rose-600' },
                  { label: 'Attendance',       value: attPct !== null ? `${attPct}%` : '—', color: attPct === null ? 'text-slate-400' : attPct >= 75 ? 'text-emerald-600' : 'text-rose-600' },
                  { label: 'Topics Mastered',  value: `${strong.length}/${masteryScores.length}`, color: 'text-slate-800' },
                  { label: 'Open Doubts',      value: doubts.filter((d: any) => d.status === 'OPEN').length, color: 'text-slate-800' },
                ].map((k, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
                    <p className={`text-[22px] font-black leading-tight ${k.color}`}>{k.value}</p>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {weak.length > 0 && (
                <div className="p-4 border border-rose-200 bg-rose-50/50 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-rose-800">Weak in {weak.length} topic{weak.length > 1 ? 's' : ''}</p>
                    <p className="text-[12px] text-rose-700 mt-0.5">{weak.map((m: any) => m.topic?.name ?? '').join(', ')}</p>
                  </div>
                </div>
              )}

              {avgScore >= 75 && weak.length === 0 && (
                <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] font-semibold text-emerald-800">Performing well across all tracked topics.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Topic Mastery ── */}
          {tab === 'mastery' && (
            <div className="space-y-2 animate-fadein">
              {masteryScores.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-slate-400">No mastery data yet.</p>
              ) : (
                [...masteryScores].sort((a: any, b: any) => a.masteryValue - b.masteryValue).map((m: any) => {
                  const pct = Math.round(m.masteryValue * 100);
                  return (
                    <div key={m.topicId} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <TrendIcon t={m.trend ?? 0} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-semibold text-slate-800 truncate">{m.topic?.name ?? '—'}</p>
                        <div className="mt-1.5 w-full bg-slate-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 75 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className={`text-[14px] font-black flex-shrink-0 ${pct >= 75 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Interventions & Growth Trajectory ── */}
          {tab === 'interventions' && (
            <div className="space-y-4 animate-fadein">
              {(student.interventions ?? []).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-[13px]">
                  No interventions recorded for this student yet.
                </div>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-2.5 px-4">Topic</th>
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-2.5 px-3">Type</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-2.5 px-3">Before</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-2.5 px-3">After</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-2.5 px-3">Delta</th>
                      <th className="text-right text-[11px] font-bold text-slate-500 uppercase py-2.5 px-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(student.interventions ?? []).map((i: any) => {
                      const before = i.beforeMastery != null ? Math.round(i.beforeMastery * 100) : null;
                      const after = i.afterMastery != null ? Math.round(i.afterMastery * 100) : null;
                      const delta = before != null && after != null ? after - before : null;

                      return (
                        <tr key={i.id}>
                          <td className="py-3 px-4 font-medium text-slate-800">{i.topic?.name ?? 'Topic'}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 capitalize">
                              {(i.type ?? 'EXTRA_CLASS').toLowerCase().replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-600">
                            {before != null ? `${before}%` : '—'}
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-slate-800">
                            {after != null ? `${after}%` : <span className="text-amber-600 text-[11px]">Pending</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {delta != null ? (
                              <span className={`font-black text-[12px] ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                {delta > 0 ? `+${delta}pp` : `${delta}pp`}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-400 text-[11.5px]">
                            {i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Test History ── */}
          {tab === 'tests' && (
            <div className="animate-fadein">
              {scoreRecords.length === 0 ? (
                <p className="py-10 text-center text-[13px] text-slate-400">No test history yet.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-2.5 px-4">Test</th>
                      <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-2.5 px-3 hidden sm:table-cell">Date</th>
                      <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-2.5 px-4">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {scoreRecords.map((r: any) => {
                      const pct = r.totalMarks > 0 ? Math.round((r.obtainedMarks / r.totalMarks) * 100) : 0;
                      return (
                        <tr key={r.id}>
                          <td className="py-3 px-4 font-medium text-slate-800">{r.exam?.title ?? 'Untitled'}</td>
                          <td className="py-3 px-3 text-slate-500 hidden sm:table-cell">
                            {r.exam?.scheduledDate ? new Date(r.exam.scheduledDate).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`font-black ${pct >= 75 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {r.obtainedMarks}/{r.totalMarks}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── Attendance ── */}
          {tab === 'attendance' && (
            <div className="space-y-4 animate-fadein">
              {attTotal === 0 ? (
                <p className="py-10 text-center text-[13px] text-slate-400">No attendance records for this student yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Present',  value: attBreakdown.PRESENT,  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
                      { label: 'Absent',   value: attBreakdown.ABSENT,   color: 'text-rose-600',    bg: 'bg-rose-50 border-rose-100'       },
                      { label: 'Late',     value: attBreakdown.LATE,     color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100'     },
                      { label: 'Excused',  value: attBreakdown.EXCUSED,  color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-100'     },
                    ].map((k) => (
                      <div key={k.label} className={`border rounded-xl p-4 text-center ${k.bg}`}>
                        <p className={`text-[22px] font-black leading-tight ${k.color}`}>{k.value}</p>
                        <p className="text-[10.5px] text-slate-500 mt-0.5">{k.label}</p>
                      </div>
                    ))}
                  </div>
                  {attPct !== null && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex justify-between text-[12px] font-bold text-slate-700 mb-2">
                        <span>Overall Attendance</span>
                        <span className={attPct >= 75 ? 'text-emerald-600' : 'text-rose-600'}>{attPct}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${attPct >= 75 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                          style={{ width: `${attPct}%` }}
                        />
                      </div>
                      {attPct < 75 && (
                        <p className="text-[11.5px] text-rose-600 font-semibold mt-2">Below 75% — attendance concern.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
