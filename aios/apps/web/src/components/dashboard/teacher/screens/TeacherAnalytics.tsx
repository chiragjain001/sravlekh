'use client';

import { BarChart2, TrendingUp, Users, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { batches, batchWeakTopics } from '@/lib/mock-data/teacher';

export function TeacherAnalytics() {
  const avgOverallScore = Math.round(batches.reduce((acc, b) => acc + b.avgScore, 0) / batches.length);
  const totalStrength = batches.reduce((acc, b) => acc + b.strength, 0);

  const topBatch = [...batches].sort((a, b) => b.avgScore - a.avgScore)[0];
  const weakBatch = [...batches].sort((a, b) => a.avgScore - b.avgScore)[0];

  return (
    <div className="p-6 animate-fadein space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-[22px] font-bold text-slate-800">Global Analytics</h1>
        <p className="text-[13px] text-slate-500 mt-0.5">High-level performance insights across all your assigned classes and batches.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Target className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-semibold text-slate-500">Overall Average</span>
          </div>
          <p className="text-[28px] font-black text-slate-800">{avgOverallScore}%</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center text-sky-500">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-semibold text-slate-500">Total Students</span>
          </div>
          <p className="text-[28px] font-black text-slate-800">{totalStrength}</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-semibold text-emerald-800">Top Batch</span>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-[28px] font-black text-emerald-700">{topBatch?.label || 'N/A'}</p>
            <p className="text-[14px] font-bold text-emerald-600 mb-1.5">{topBatch?.avgScore || 0}% Avg</p>
          </div>
        </div>

        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span className="text-[13px] font-semibold text-rose-800">Needs Attention</span>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-[28px] font-black text-rose-700">{weakBatch?.label || 'N/A'}</p>
            <p className="text-[14px] font-bold text-rose-600 mb-1.5">{weakBatch?.avgScore || 0}% Avg</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">Batch Performance Comparison</h3>
          <div className="space-y-4">
            {batches.map(b => (
              <div key={b.id}>
                <div className="flex justify-between text-[13px] font-semibold mb-1">
                  <span className="text-slate-700">Batch {b.label}</span>
                  <span className="text-slate-900">{b.avgScore}%</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full ${
                      b.avgScore >= 75 ? 'bg-emerald-500' :
                      b.avgScore >= 60 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${b.avgScore}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h3 className="text-[15px] font-bold text-slate-800 mb-4">Global Weak Topics (Across All Batches)</h3>
          <p className="text-[12.5px] text-slate-500 mb-4">Aggregated from recent test performance analysis.</p>
          <div className="space-y-3">
            {/* Mocked aggregation from batchWeakTopics */}
            {[
              { topic: 'Rotational Motion', weak: 45, impact: 'High' },
              { topic: 'Thermodynamics', weak: 28, impact: 'Medium' },
              { topic: 'Optics', weak: 15, impact: 'Low' },
            ].map(wt => (
              <div key={wt.topic} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50">
                <div>
                  <p className="text-[13.5px] font-bold text-slate-800">{wt.topic}</p>
                  <p className="text-[11.5px] text-slate-500">{wt.weak} students struggling across batches</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                  wt.impact === 'High' ? 'bg-rose-100 text-rose-700' :
                  wt.impact === 'Medium' ? 'bg-amber-100 text-amber-700' :
                  'bg-sky-100 text-sky-700'
                }`}>
                  {wt.impact} Impact
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
