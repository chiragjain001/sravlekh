'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, MessageCircle,
  StickyNote, Save, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { useStudent, useBatchPerformance, useDoubts } from '@/hooks/useApi';

const TABS = ['Performance', 'Topic Mastery', 'Tests', 'Doubts', 'Notes'] as const;
type Tab = typeof TABS[number];

const statusColor = (s: string) => ({
  excellent: 'bg-emerald-100 text-emerald-700',
  average:   'bg-amber-100 text-amber-700',
  weak:      'bg-rose-100 text-rose-700',
}[s] ?? 'bg-slate-100 text-slate-500');

function TrendIcon({ t }: { t: number }) {
  if (t > 0.02) return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (t < -0.02) return <TrendingDown className="w-3.5 h-3.5 text-rose-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

const noteKey = (studentId: string) => `aios_teacher_note_${studentId}`;

export function StudentProfile({ studentId }: { studentId: string }) {
  const [tab, setTab] = useState<Tab>('Performance');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: student, isLoading } = useStudent(studentId);
  const { data: performance } = useBatchPerformance(student?.batchId ?? null);
  const { data: doubtsResp } = useDoubts(tab === 'Doubts' ? { studentProfileId: studentId } : undefined);

  useEffect(() => {
    setNote(localStorage.getItem(noteKey(studentId)) ?? '');
  }, [studentId]);

  const handleSaveNote = () => {
    localStorage.setItem(noteKey(studentId), note);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (isLoading) {
    return <div className="py-16 text-center text-slate-400 text-[13px] animate-fadein">Loading student profile…</div>;
  }
  if (!student) return null;

  const perfRow = performance?.students?.find((s: any) => s.id === studentId);
  const status = perfRow?.status ?? 'unscored';
  const avgScore = perfRow?.avgScore ?? 0;
  const rank = perfRow?.rank;
  const masteryScores = student.masteryScores ?? [];
  const scoreRecords = student.scoreRecords ?? [];
  const doubts = doubtsResp?.data ?? [];

  const strong  = masteryScores.filter((m: any) => m.masteryValue >= 0.75);
  const average = masteryScores.filter((m: any) => m.masteryValue >= 0.6 && m.masteryValue < 0.75);
  const weak    = masteryScores.filter((m: any) => m.masteryValue < 0.6);

  return (
    <div className="space-y-6 animate-fadein">
      {/* ── Student Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 p-5 border border-slate-100 rounded-2xl bg-white">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-black flex-shrink-0 ${
          status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
          status === 'weak'      ? 'bg-rose-100 text-rose-700'       :
                                    'bg-indigo-100 text-indigo-700'
        }`}>
          {(student.user?.name ?? '?').split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[20px] font-bold text-slate-800">{student.user?.name ?? 'Unknown Student'}</h2>
            {status !== 'unscored' && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg capitalize ${statusColor(status)}`}>{status}</span>
            )}
          </div>
          <p className="text-[13px] text-slate-500 mt-1">
            Roll: <span className="font-semibold text-slate-700">{student.rollNumber ?? '—'}</span>
            {rank && <>&nbsp;·&nbsp; Rank: <span className="font-semibold text-slate-700">#{rank}</span></>}
          </p>
        </div>
        <div className="flex gap-4 flex-shrink-0 text-center">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-3">
            <p className={`text-[22px] font-black leading-tight ${avgScore >= 75 ? 'text-emerald-600' : avgScore >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{avgScore}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Overall Avg</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-3">
            <p className="text-[22px] font-black text-slate-800 leading-tight">{perfRow?.lastTestScore ?? '—'}{perfRow?.lastTestMax ? `/${perfRow.lastTestMax}` : ''}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Last Test</p>
          </div>
        </div>
      </div>

      {(status === 'weak' || status === 'average') && weak.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13.5px] font-bold text-amber-800">
                {(student.user?.name ?? 'Student').split(' ')[0]} is consistently weak in {weak.map((t: any) => t.topic.name).join(', ')}.
              </p>
              <p className="text-[12px] text-amber-700 mt-1">Recommend assigning targeted practice before the next test.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[13px] font-bold rounded-xl transition-all ${
              tab === t ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Performance' && (
        <div className="animate-fadein grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Average Score', value: `${avgScore}%`, sub: 'All tests combined' },
            { label: 'Last Test', value: perfRow?.lastTestScore != null ? `${perfRow.lastTestScore}/${perfRow.lastTestMax}` : '—', sub: 'Most recent test' },
            { label: 'Batch Rank', value: rank ? `#${rank}` : '—', sub: 'Current standing' },
            { label: 'Topics Mastered', value: strong.length, sub: `of ${masteryScores.length} topics` },
          ].map((k, i) => (
            <div key={i} className="card border border-slate-100 rounded-2xl p-5">
              <p className="text-[11px] font-medium text-slate-500 mb-1">{k.label}</p>
              <p className="text-[22px] font-black text-slate-800 leading-tight">{k.value}</p>
              <p className="text-[10px] text-slate-400 mt-1">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'Topic Mastery' && (
        <div className="animate-fadein space-y-5">
          {masteryScores.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-400">No topic data yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Strong', count: strong.length, color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                  { label: 'Average', count: average.length, color: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                  { label: 'Weak', count: weak.length, color: 'bg-rose-50 border-rose-100', text: 'text-rose-700' },
                ].map(k => (
                  <div key={k.label} className={`border rounded-2xl p-4 text-center ${k.color}`}>
                    <p className={`text-[24px] font-black leading-tight ${k.text}`}>{k.count}</p>
                    <p className={`text-[11px] font-bold ${k.text} opacity-80`}>{k.label} Topics</p>
                  </div>
                ))}
              </div>

              {([
                { label: 'Strong Topics', list: strong, cls: { text: 'text-emerald-600', dot: 'bg-emerald-500', border: 'border-emerald-100', bg: 'bg-emerald-50/40', barBg: 'bg-emerald-100', bar: 'bg-emerald-500', value: 'text-emerald-600' } },
                { label: 'Average Topics', list: average, cls: { text: 'text-amber-600', dot: 'bg-amber-500', border: 'border-amber-100', bg: 'bg-amber-50/40', barBg: 'bg-amber-100', bar: 'bg-amber-500', value: 'text-amber-600' } },
                { label: 'Weak Topics — Needs Focus', list: weak, cls: { text: 'text-rose-600', dot: 'bg-rose-500', border: 'border-rose-200', bg: 'bg-rose-50/50', barBg: 'bg-rose-100', bar: 'bg-rose-500', value: 'text-rose-600' } },
              ] as const).map(({ label, list, cls }) => (
                list.length > 0 && (
                  <div key={label}>
                    <p className={`text-[11px] font-bold ${cls.text} uppercase tracking-wider mb-2 flex items-center gap-1`}>
                      <span className={`w-2 h-2 rounded-full ${cls.dot} inline-block`} /> {label}
                    </p>
                    <div className="space-y-2">
                      {list.map((m: any) => (
                        <div key={m.topicId} className={`border ${cls.border} ${cls.bg} rounded-xl p-4`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                              <TrendIcon t={m.trend} />
                              <p className="text-[13.5px] font-bold text-slate-800">{m.topic.name}</p>
                              <span className="text-[10px] text-slate-400">{m.sampleCount} responses</span>
                            </div>
                            <span className={`text-[16px] font-black ${cls.value}`}>{Math.round(m.masteryValue * 100)}%</span>
                          </div>
                          <div className={`w-full ${cls.barBg} rounded-full h-2`}>
                            <div className={`h-2 rounded-full ${cls.bar} transition-all`} style={{ width: `${Math.round(m.masteryValue * 100)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </>
          )}
        </div>
      )}

      {tab === 'Tests' && (
        <div className="animate-fadein card border border-slate-100 rounded-2xl overflow-hidden">
          {scoreRecords.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-400">No test history yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Test</th>
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden sm:table-cell">Date</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {scoreRecords.map((r: any) => (
                  <tr key={r.id} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-5 font-semibold text-slate-800">{r.exam?.title ?? 'Untitled Exam'}</td>
                    <td className="py-3.5 px-3 text-slate-500 hidden sm:table-cell">{r.exam?.scheduledDate ? new Date(r.exam.scheduledDate).toLocaleDateString() : '—'}</td>
                    <td className="py-3.5 px-5 text-center">
                      <span className={`font-black ${(r.obtainedMarks / r.totalMarks) >= 0.75 ? 'text-emerald-600' : (r.obtainedMarks / r.totalMarks) >= 0.6 ? 'text-amber-600' : 'text-rose-600'}`}>
                        {r.obtainedMarks}/{r.totalMarks}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'Doubts' && (
        <div className="animate-fadein space-y-3">
          {doubts.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-semibold">No doubts from this student.</p>
            </div>
          ) : (
            doubts.map((d: any) => (
              <div key={d.id} className={`border rounded-2xl p-5 ${d.status === 'OPEN' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold text-indigo-600">{d.subject?.name}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${d.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{d.status}</span>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">{d.content}</p>
                <p className="text-[11px] text-slate-400 mt-2">{new Date(d.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'Notes' && (
        <div className="animate-fadein space-y-4">
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <StickyNote className="w-4 h-4" />
            <span>Private notes — saved on this device only, not shared with student or admin.</span>
          </div>
          <textarea
            rows={8}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={`Add your private notes about ${(student.user?.name ?? 'this student').split(' ')[0]}...`}
            className="w-full px-4 py-3 border border-slate-200 rounded-2xl text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 leading-relaxed"
          />
          <button
            onClick={handleSaveNote}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-[13px] font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            {saved ? <><CheckCircle2 className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Note</>}
          </button>
        </div>
      )}
    </div>
  );
}
