'use client';

import { useState, useEffect } from 'react';
import { BarChart3, ChevronRight, TrendingUp, ChevronDown } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export function StudentProgress() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const data = d.detailedProgress;

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Progress</h2>
              <p className="text-[12px] text-slate-500">Track your growth and improvement.</p>
            </div>
          </div>
          <button className="text-[14px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1">
            Detailed Analytics <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          {['JEE (Main)', 'All Subjects', 'Last 6 Tests'].map((filter) => (
            <button key={filter} className="px-4 py-2 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors flex items-center gap-2">
              {filter} <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 flex-1 mb-8">
          {/* Left: Line Chart */}
          <div className="flex flex-col h-full min-h-[300px]">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6">Score Trend</h3>
            <div className="flex-1 w-full relative">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.scoreTrend} margin={{ top: 20, right: 20, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="test" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} 
                      dy={10} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }} 
                      domain={[0, 100]}
                      ticks={[0, 25, 50, 75, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      cursor={{ stroke: '#e2e8f0', strokeWidth: 2, strokeDasharray: '4 4' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="#6366f1" 
                      strokeWidth={3} 
                      dot={{ fill: '#6366f1', strokeWidth: 2, r: 4, stroke: '#fff' }} 
                      activeDot={{ r: 6, strokeWidth: 0 }} 
                      animationDuration={1500}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Right: Progress Bars */}
          <div className="flex flex-col justify-center h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6">Subject Wise Improvement</h3>
            <div className="space-y-6">
              {data.subjectWise.map((subject, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-bold text-slate-700">{subject.subject}</span>
                    <div className="flex items-center gap-6">
                      <span className="text-[12px] font-bold text-indigo-600 flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md">
                        <TrendingUp className="w-3 h-3" /> {subject.improvement}%
                      </span>
                      <span className="text-[16px] font-black text-slate-800 min-w-[3ch] text-right">{subject.currentScore}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-[6px]">
                    <div className={`h-[6px] rounded-full ${subject.color} transition-all duration-1000`} style={{ width: `${subject.currentScore}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 pt-6 mt-auto">
          <div className="p-4">
            <p className="text-[12px] font-bold text-slate-400 mb-1">Tests Attempted</p>
            <p className="text-[28px] font-black text-indigo-600">{data.summaryStats.testsAttempted}</p>
          </div>
          <div className="p-4 border-l border-slate-100">
            <p className="text-[12px] font-bold text-slate-400 mb-1">Average Score</p>
            <div className="flex items-end gap-2">
              <p className="text-[28px] font-black text-slate-800 leading-none">{data.summaryStats.averageScore}%</p>
              <span className="text-[12px] font-bold text-emerald-500 flex items-center gap-0.5 mb-1 bg-emerald-50 px-1.5 py-0.5 rounded">
                <TrendingUp className="w-3 h-3" /> {data.summaryStats.averageScoreImprovement}%
              </span>
            </div>
          </div>
          <div className="p-4 border-l border-slate-100">
            <p className="text-[12px] font-bold text-slate-400 mb-1">Highest Score</p>
            <p className="text-[28px] font-black text-slate-800">{data.summaryStats.highestScore}%</p>
          </div>
          <div className="p-4 border-l border-slate-100">
            <p className="text-[12px] font-bold text-slate-400 mb-1">Rank Improvement</p>
            <div className="flex items-end gap-2">
              <span className="text-[28px] font-black text-emerald-500 leading-none flex items-center gap-1">
                <TrendingUp className="w-6 h-6" /> {data.summaryStats.rankImprovement}
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-400 mt-1">Compared to last test</p>
          </div>
        </div>

      </div>
    </div>
  );
}
