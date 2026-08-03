'use client';

import { useState, useEffect } from 'react';
import { studentData as d } from '@/lib/mock-data/student';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { AlertCircle, TrendingUp } from 'lucide-react';

function OverallDonut({ score }: { score: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  const data = [
    { value: score,       fill: '#6366f1' },
    { value: 100 - score, fill: '#f1f5f9' },
  ];
  return (
    <div className="relative w-36 h-36 flex-shrink-0">
      {mounted && (
        <PieChart width={144} height={144}>
          <Pie data={data} cx={68} cy={68} innerRadius={48} outerRadius={66} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
        </PieChart>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center -ml-2 -mt-2">
        <span className="text-[22px] font-bold text-slate-800">{score}%</span>
        <span className="text-[10px] text-slate-500">Overall Score</span>
      </div>
    </div>
  );
}

function ProgressChart({ data }: { data: typeof d.progressData }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return <div className="w-full h-[140px]" />;
  
  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -28, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} domain={[50, 90]} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={2.5} dot={{ fill: '#6366f1', r: 3 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StudentOverview() {
  return (
    <div className="p-5 space-y-5 animate-fadein">
      {/* ── Row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card">
          <p className="section-title">Overall Performance</p>
          <div className="flex items-center gap-5">
            <OverallDonut score={d.user.overallScore} />
            <div className="flex-1 space-y-2.5">
              {d.subjectScores.map((s) => (
                <div key={s.subject}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="text-slate-600">{s.subject}</span>
                    <span className="font-semibold text-slate-800">{s.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${s.score}%`, backgroundColor: s.color }} />
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                <TrendingUp className="w-3 h-3" /> {d.user.scoreChange}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Weak Topics</p>
            <span className="view-all-link">View All Weak Topics →</span>
          </div>
          <div className="space-y-2">
            {d.weakTopics.slice(0, 4).map((t) => (
              <div key={t.topic} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                  <span className="text-[12.5px] text-slate-700">{t.topic}</span>
                </div>
                <span className={`chip ${t.level === 'High' ? 'chip-high' : 'chip-medium'}`}>{t.level}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-0">
          <p className="text-[12px] font-semibold text-indigo-200 mb-1">Next Test</p>
          <p className="text-[15px] font-bold mb-1">{d.nextTest.name}</p>
          <p className="text-[11.5px] text-indigo-200 mb-0.5">{d.nextTest.date}</p>
          <p className="text-[11px] text-indigo-300 mb-4">Syllabus: {d.nextTest.syllabus}</p>
          <div className="flex gap-3 mb-5">
            {[{ val: d.nextTest.daysLeft, label: 'Days' }, { val: d.nextTest.hoursLeft, label: 'Hrs' }, { val: d.nextTest.minsLeft, label: 'Mins' }].map((c) => (
              <div key={c.label} className="text-center">
                <div className="bg-white/20 rounded-lg px-3 py-2 min-w-[44px]">
                  <span className="text-[20px] font-bold leading-none">{String(c.val).padStart(2, '0')}</span>
                </div>
                <p className="text-[10px] text-indigo-300 mt-1">{c.label}</p>
              </div>
            ))}
          </div>
          <button className="w-full bg-white text-indigo-700 font-semibold text-[13px] py-2 rounded-lg hover:bg-indigo-50 transition-colors">
            View Test Details
          </button>
        </div>
      </div>

      {/* ── Row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <p className="section-title">AI Recommended for You</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {d.aiRecommendations.map((rec) => (
              <div key={rec.topic} className="border border-slate-100 rounded-xl p-3.5 hover:shadow-card-hover transition-shadow">
                <p className="text-[10.5px] text-slate-500 uppercase tracking-wide font-semibold mb-1">{rec.type}</p>
                <p className="text-[13px] font-semibold text-slate-800 mb-0.5">{rec.topic}</p>
                <p className="text-[11px] text-slate-500 mb-3">{rec.detail}</p>
                <button className={`w-full text-[12px] font-semibold py-1.5 rounded-lg transition-colors ${rec.btnColor}`}>{rec.btnText}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Study Plan Today</p>
            <span className="text-[11px] text-slate-400">All ↓</span>
          </div>
          <div className="space-y-2">
            {d.studyPlan.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-slate-50 last:border-0">
                <div className="flex-shrink-0 w-[70px]">
                  <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5">{s.time}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-slate-700 truncate">{s.task}</p>
                  {(s.duration || s.subject) && <p className="text-[10.5px] text-slate-400">{s.duration || s.subject}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 3 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Recent Tests</p>
            <span className="view-all-link">View All</span>
          </div>
          <div className="space-y-2">
            {d.recentTests.map((t) => (
              <div key={t.name} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white ${t.color === 'emerald' ? 'bg-emerald-500' : t.color === 'amber' ? 'bg-amber-500' : 'bg-rose-500'}`}>
                    {t.score}
                  </div>
                  <div>
                    <p className="text-[12.5px] font-medium text-slate-700">{t.name}</p>
                    <p className="text-[11px] text-slate-400">{t.date}</p>
                  </div>
                </div>
                <span className={`text-[13px] font-bold ${t.score >= 80 ? 'text-emerald-600' : t.score >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>{t.score}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <p className="section-title mb-0">Progress Over Time</p>
            <span className="text-[11px] text-slate-400">All ↓</span>
          </div>
          <ProgressChart data={d.progressData} />
        </div>
      </div>
    </div>
  );
}
