'use client';

import { useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, MessageCircle,
  ClipboardList, BookOpen, StickyNote, Save, CheckCircle2, AlertTriangle,
} from 'lucide-react';

interface Student  { id: string; name: string; rollNo: string; avgScore: number; lastTestScore: number; lastTestMax: number; status: string; rank: number }
interface Mastery  { topic: string; mastery: number; attempts: number; trend: string }
interface TestHist { testId: string; testName: string; date: string; score: number; maxScore: number; rankInBatch: number }
interface Doubt    { id: string; topic: string; question: string; askedAt: string; status: string }

const TABS = ['Performance', 'Topic Mastery', 'Tests', 'Doubts', 'Notes'] as const;
type Tab = typeof TABS[number];

const statusColor = (s: string) => ({
  excellent: 'bg-emerald-100 text-emerald-700',
  good:      'bg-sky-100 text-sky-700',
  average:   'bg-amber-100 text-amber-700',
  weak:      'bg-rose-100 text-rose-700',
}[s] ?? 'bg-slate-100 text-slate-500');

function TrendIcon({ t }: { t: string }) {
  if (t === 'up')   return <TrendingUp   className="w-3.5 h-3.5 text-emerald-500" />;
  if (t === 'down') return <TrendingDown className="w-3.5 h-3.5 text-rose-500"    />;
  return                   <Minus        className="w-3.5 h-3.5 text-slate-400"   />;
}

export function StudentProfile({ student, topicMastery, testHistory, doubts }: {
  student:      Student;
  topicMastery: Mastery[];
  testHistory:  TestHist[];
  doubts:       Doubt[];
}) {
  const [tab,   setTab]   = useState<Tab>('Performance');
  const [note,  setNote]  = useState('');
  const [saved, setSaved] = useState(false);

  if (!student) return null;

  const handleSaveNote = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fadein">

      {/* ── Student Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 p-5 border border-slate-100 rounded-2xl bg-white">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-[22px] font-black flex-shrink-0 ${
          student.status === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
          student.status === 'weak'      ? 'bg-rose-100 text-rose-700'       :
                                           'bg-indigo-100 text-indigo-700'
        }`}>
          {student.name.split(' ').map((n: string) => n[0]).join('')}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-[20px] font-bold text-slate-800">{student.name}</h2>
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg capitalize ${statusColor(student.status)}`}>
              {student.status}
            </span>
          </div>
          <p className="text-[13px] text-slate-500 mt-1">
            Roll: <span className="font-semibold text-slate-700">{student.rollNo}</span>
            &nbsp;·&nbsp; Rank: <span className="font-semibold text-slate-700">#{student.rank}</span>
          </p>
        </div>
        <div className="flex gap-4 flex-shrink-0 text-center">
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-3">
            <p className={`text-[22px] font-black leading-tight ${
              student.avgScore >= 75 ? 'text-emerald-600' :
              student.avgScore >= 60 ? 'text-amber-600'   : 'text-rose-600'
            }`}>{student.avgScore}%</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Overall Avg</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-xl px-5 py-3">
            <p className="text-[22px] font-black text-slate-800 leading-tight">{student.lastTestScore}/{student.lastTestMax}</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Last Test</p>
          </div>
        </div>
      </div>

      {/* ── AI Insight (contextual, only for weak students) ──────────────────── */}
      {(student.status === 'weak' || student.status === 'average') && topicMastery.length > 0 && (
        <div className="border border-amber-200 bg-amber-50/60 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[13.5px] font-bold text-amber-800">
                {student.name.split(' ')[0]} is consistently weak in{' '}
                {topicMastery.filter(t => t.mastery < 60).map(t => t.topic).join(', ') || 'some topics'}.
              </p>
              <p className="text-[12px] text-amber-700 mt-1">Recommend assigning targeted practice before the next test.</p>
              <button className="mt-3 px-4 py-1.5 bg-amber-500 text-white text-[12px] font-bold rounded-xl hover:bg-amber-600 transition-colors">
                Assign Practice Set
              </button>
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

      {/* ── Performance Tab ─────────────────────────────────────────────────── */}
      {tab === 'Performance' && (
        <div className="animate-fadein space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Average Score',    value: `${student.avgScore}%`,                 sub: 'All tests combined' },
              { label: 'Last Test',        value: `${student.lastTestScore}/${student.lastTestMax}`, sub: 'Most recent test' },
              { label: 'Batch Rank',       value: `#${student.rank}`,                     sub: 'Current standing' },
              { label: 'Topics Mastered',  value: topicMastery.filter(t => t.mastery >= 75).length, sub: `of ${topicMastery.length} topics` },
            ].map((k, i) => (
              <div key={i} className="card border border-slate-100 rounded-2xl p-5">
                <p className="text-[11px] font-medium text-slate-500 mb-1">{k.label}</p>
                <p className="text-[22px] font-black text-slate-800 leading-tight">{k.value}</p>
                <p className="text-[10px] text-slate-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Topic Mastery Tab ───────────────────────────────────────────────── */}
      {tab === 'Topic Mastery' && (
        <div className="animate-fadein space-y-5">
          {topicMastery.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-400">No topic data yet.</p>
          ) : (
            <>
              {/* Overview strip */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Strong',  count: topicMastery.filter(t => t.mastery >= 75).length, color: 'bg-emerald-50 border-emerald-100', text: 'text-emerald-700' },
                  { label: 'Average', count: topicMastery.filter(t => t.mastery >= 60 && t.mastery < 75).length, color: 'bg-amber-50 border-amber-100', text: 'text-amber-700' },
                  { label: 'Weak',    count: topicMastery.filter(t => t.mastery < 60).length,  color: 'bg-rose-50 border-rose-100',    text: 'text-rose-700' },
                ].map(k => (
                  <div key={k.label} className={`border rounded-2xl p-4 text-center ${k.color}`}>
                    <p className={`text-[24px] font-black leading-tight ${k.text}`}>{k.count}</p>
                    <p className={`text-[11px] font-bold ${k.text} opacity-80`}>{k.label} Topics</p>
                  </div>
                ))}
              </div>

              {/* Strong topics */}
              {topicMastery.filter(t => t.mastery >= 75).length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Strong Topics
                  </p>
                  <div className="space-y-2">
                    {topicMastery.filter(t => t.mastery >= 75).map(t => (
                      <div key={t.topic} className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <TrendIcon t={t.trend} />
                            <p className="text-[13.5px] font-bold text-slate-800">{t.topic}</p>
                            <span className="text-[10px] text-slate-400">{t.attempts} tests</span>
                          </div>
                          <span className="text-[16px] font-black text-emerald-600">{t.mastery}%</span>
                        </div>
                        <div className="w-full bg-emerald-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${t.mastery}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Average topics */}
              {topicMastery.filter(t => t.mastery >= 60 && t.mastery < 75).length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Average Topics
                  </p>
                  <div className="space-y-2">
                    {topicMastery.filter(t => t.mastery >= 60 && t.mastery < 75).map(t => (
                      <div key={t.topic} className="border border-amber-100 bg-amber-50/40 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <TrendIcon t={t.trend} />
                            <p className="text-[13.5px] font-bold text-slate-800">{t.topic}</p>
                            <span className="text-[10px] text-slate-400">{t.attempts} tests</span>
                          </div>
                          <span className="text-[16px] font-black text-amber-600">{t.mastery}%</span>
                        </div>
                        <div className="w-full bg-amber-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${t.mastery}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak topics */}
              {topicMastery.filter(t => t.mastery < 60).length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Weak Topics — Needs Focus
                  </p>
                  <div className="space-y-2">
                    {topicMastery.filter(t => t.mastery < 60).map(t => (
                      <div key={t.topic} className="border border-rose-200 bg-rose-50/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2.5">
                            <TrendIcon t={t.trend} />
                            <p className="text-[13.5px] font-bold text-slate-800">{t.topic}</p>
                            <span className="text-[10px] text-slate-400">{t.attempts} tests</span>
                          </div>
                          <span className="text-[16px] font-black text-rose-600">{t.mastery}%</span>
                        </div>
                        <div className="w-full bg-rose-100 rounded-full h-2">
                          <div className="h-2 rounded-full bg-rose-500 transition-all" style={{ width: `${t.mastery}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tests Tab ───────────────────────────────────────────────────────── */}
      {tab === 'Tests' && (
        <div className="animate-fadein card border border-slate-100 rounded-2xl overflow-hidden">
          {testHistory.length === 0 ? (
            <p className="py-10 text-center text-[13px] text-slate-400">No test history yet.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-5">Test</th>
                  <th className="text-left text-[11px] font-bold text-slate-500 uppercase py-3 px-3 hidden sm:table-cell">Date</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-3">Score</th>
                  <th className="text-center text-[11px] font-bold text-slate-500 uppercase py-3 px-5 hidden md:table-cell">Rank in Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {testHistory.map(t => (
                  <tr key={t.testId} className="hover:bg-slate-50/50">
                    <td className="py-3.5 px-5 font-semibold text-slate-800">{t.testName}</td>
                    <td className="py-3.5 px-3 text-slate-500 hidden sm:table-cell">{t.date}</td>
                    <td className="py-3.5 px-3 text-center">
                      <span className={`font-black ${
                        (t.score / t.maxScore) >= 0.75 ? 'text-emerald-600' :
                        (t.score / t.maxScore) >= 0.60 ? 'text-amber-600'   : 'text-rose-600'
                      }`}>{t.score}/{t.maxScore}</span>
                    </td>
                    <td className="py-3.5 px-5 text-center text-slate-500 hidden md:table-cell">#{t.rankInBatch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Doubts Tab ──────────────────────────────────────────────────────── */}
      {tab === 'Doubts' && (
        <div className="animate-fadein space-y-3">
          {doubts.length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-[13px] font-semibold">No doubts from this student.</p>
            </div>
          ) : (
            doubts.map(d => (
              <div key={d.id} className={`border rounded-2xl p-5 ${d.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold text-indigo-600">{d.topic}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                    d.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{d.status}</span>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed">{d.question}</p>
                <p className="text-[11px] text-slate-400 mt-2">{d.askedAt}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Notes Tab ───────────────────────────────────────────────────────── */}
      {tab === 'Notes' && (
        <div className="animate-fadein space-y-4">
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <StickyNote className="w-4 h-4" />
            <span>Private notes — only visible to you. Not shared with student or admin.</span>
          </div>
          <textarea
            rows={8}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder={`Add your private notes about ${student.name.split(' ')[0]}...\n\ne.g. "Grasps concepts fast but skips derivation steps. Needs to practice writing full solutions."`}
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
