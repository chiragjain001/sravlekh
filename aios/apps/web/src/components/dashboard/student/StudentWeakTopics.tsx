'use client';

import { useMemo, useState, useEffect } from 'react';
import { AlertCircle, MessageCircleQuestion, X, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useMyStudentProfile } from '@/hooks/useApi';
import { useDashboardStore } from '@/store/dashboard-store';

interface MasteryScore {
  id: string;
  masteryValue: number;
  trend: number;
  topic: { name: string };
  subject: { name: string };
}

function levelFor(pct: number) {
  if (pct < 40) return { label: 'High', chip: 'text-rose-700 bg-rose-50', bar: 'bg-rose-500' };
  if (pct < 70) return { label: 'Medium', chip: 'text-amber-700 bg-amber-50', bar: 'bg-amber-500' };
  return { label: 'Low', chip: 'text-emerald-700 bg-emerald-50', bar: 'bg-emerald-500' };
}

export function StudentWeakTopics() {
  const [selectedTopic, setSelectedTopic] = useState<MasteryScore | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: profile, isPending } = useMyStudentProfile();
  const { setStudentActiveNav } = useDashboardStore();
  const scores: MasteryScore[] = useMemo(() => profile?.masteryScores ?? [], [profile]);

  const weakestFirst = useMemo(() => [...scores].sort((a, b) => a.masteryValue - b.masteryValue), [scores]);

  const radarData = useMemo(() => {
    const bySubject = new Map<string, { total: number; count: number }>();
    for (const s of scores) {
      const entry = bySubject.get(s.subject.name) ?? { total: 0, count: 0 };
      entry.total += s.masteryValue * 100;
      entry.count += 1;
      bySubject.set(s.subject.name, entry);
    }
    return Array.from(bySubject.entries()).map(([subject, { total, count }]) => ({ subject, A: Math.round(total / count) }));
  }, [scores]);

  function goAskTeacher() {
    setSelectedTopic(null);
    setStudentActiveNav('Doubt Center');
  }

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Weak Topics</h2>
              <p className="text-[12px] text-slate-500">Based on your real graded exam performance.</p>
            </div>
          </div>
        </div>

        {isPending ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">Loading your mastery data…</div>
        ) : scores.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
            <AlertCircle className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-[14px] font-medium text-slate-500">No mastery data yet — this fills in once your first graded exams come back.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 mb-8 flex-1">

          {/* Left: Radar Chart */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6 text-center lg:text-left">Your Weakness Overview</h3>
            <div className="flex-1 min-h-[250px] w-full">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontWeight: 'bold' }} cursor={{ fill: '#f43f5e', opacity: 0.05 }} />
                    <Radar name="Mastery" dataKey="A" stroke="#f43f5e" strokeWidth={2.5} fill="#f43f5e" fillOpacity={0.15} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right: Top Weak Topics */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6">Top Priority Areas</h3>
            <div className="space-y-4">
              {weakestFirst.slice(0, 8).map((score) => {
                const pct = Math.round(score.masteryValue * 100);
                const level = levelFor(pct);
                return (
                  <div
                    key={score.id}
                    onClick={() => setSelectedTopic(score)}
                    className="group cursor-pointer p-3 -mx-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-[13.5px] font-bold text-slate-700 group-hover:text-rose-600 transition-colors">{score.topic.name}</span>
                        <span className="text-[11px] text-slate-400 ml-2">{score.subject.name}</span>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="text-[13px] font-bold text-slate-800">{pct}%</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${level.chip}`}>{level.label}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-[4px]">
                      <div className={`h-[4px] rounded-full ${level.bar} transition-all duration-1000`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Footer: real action, not a fake AI simulation */}
        {scores.length > 0 && (
          <div className="border rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-rose-50/50 border-rose-100/60">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-rose-100 text-rose-500">
                <MessageCircleQuestion className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[14.5px] font-bold text-slate-800">
                  {weakestFirst[0] ? `Struggling with ${weakestFirst[0].topic.name}?` : 'Need help with a topic?'}
                </p>
                <p className="text-[13px] text-slate-600 mt-1 max-w-xl">Ask your teacher directly — it goes straight to the Doubt Center.</p>
              </div>
            </div>
            <button onClick={goAskTeacher} className="whitespace-nowrap px-6 py-3 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm flex items-center gap-2 bg-rose-500 hover:bg-rose-600">
              <MessageCircleQuestion className="w-4 h-4" /> Ask a Teacher
            </button>
          </div>
        )}

        {/* Topic Detail Modal */}
        {selectedTopic && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center animate-fadein sm:p-4">
            <div className="bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative animate-slide-up">
              <button onClick={() => setSelectedTopic(null)} className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>

              {(() => {
                const pct = Math.round(selectedTopic.masteryValue * 100);
                const level = levelFor(pct);
                const TrendIcon = selectedTopic.trend > 0 ? TrendingUp : selectedTopic.trend < 0 ? TrendingDown : Minus;
                return (
                  <>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${level.chip}`}>
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <h3 className="text-[20px] font-bold text-slate-800 mb-1">{selectedTopic.topic.name}</h3>
                    <p className="text-[12px] text-slate-400 mb-4">{selectedTopic.subject.name}</p>
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-[13px] text-slate-500 font-medium">Mastery: {pct}%</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300" />
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${level.chip}`}>Priority: {level.label}</span>
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                        <TrendIcon className="w-3.5 h-3.5" /> {selectedTopic.trend > 0 ? 'Improving' : selectedTopic.trend < 0 ? 'Declining' : 'Stable'}
                      </span>
                    </div>

                    <button onClick={goAskTeacher} className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[14px] rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                      <MessageCircleQuestion className="w-4 h-4" /> Ask a Teacher About This
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
