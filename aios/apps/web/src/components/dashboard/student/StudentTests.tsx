'use client';

import { useState, useEffect } from 'react';
import { FileText, ChevronRight, Search, BarChart3, TrendingUp, X, CheckCircle2 } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

export function StudentTests() {
  const [timeLeft, setTimeLeft] = useState({
    days: d.nextTest.daysLeft,
    hours: d.nextTest.hoursLeft,
    mins: d.nextTest.minsLeft,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTest, setSelectedTest] = useState<typeof d.recentTests[0] | null>(null);
  
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { days, hours, mins } = prev;
        if (mins > 0) {
          mins--;
        } else {
          if (hours > 0) {
            hours--;
            mins = 59;
          } else {
            if (days > 0) {
              days--;
              hours = 23;
              mins = 59;
            }
          }
        }
        return { days, hours, mins };
      });
    }, 60000); // update every minute

    return () => clearInterval(timer);
  }, []);

  const filteredTests = d.recentTests.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Mock trend data
  const trendData = d.progressData.slice(-4);

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">My Tests</h2>
              <p className="text-[12px] text-slate-500">Track your performance and upcoming mocks.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1 overflow-y-auto custom-scrollbar pr-2">
          {/* Left Column: Upcoming Test & Trend */}
          <div className="flex flex-col gap-6">
            <h3 className="text-[14px] font-bold text-slate-800">Upcoming Test</h3>
            <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <FileText className="w-24 h-24 text-indigo-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-[16px] font-bold text-indigo-700 mb-1">{d.nextTest.name}</h4>
                    <p className="text-[12px] text-slate-500 mb-0.5">{d.nextTest.date}</p>
                    <p className="text-[12px] text-slate-400 font-medium bg-white/60 inline-block px-2 py-0.5 rounded-md mt-1">{d.nextTest.syllabus} Mock</p>
                  </div>
                  <span className="bg-white text-indigo-600 text-[10px] font-bold px-2 py-1 rounded-lg shadow-sm">MANDATORY</span>
                </div>

                <div className="flex items-center gap-4 my-6 bg-white/40 p-4 rounded-xl border border-white/50 backdrop-blur-sm inline-flex">
                  {[
                    { val: String(timeLeft.days).padStart(2, '0'), label: 'DAYS' },
                    { val: String(timeLeft.hours).padStart(2, '0'), label: 'HRS' },
                    { val: String(timeLeft.mins).padStart(2, '0'), label: 'MINS' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center">
                      <div className="text-center min-w-[36px]">
                        <span className="text-3xl font-black text-indigo-600 font-mono tracking-tight">{item.val}</span>
                        <p className="text-[9px] font-bold text-indigo-400/80 mt-0.5 uppercase tracking-wider">{item.label}</p>
                      </div>
                      {idx < 2 && <span className="text-2xl font-bold text-indigo-300/50 mx-3 -mt-4">:</span>}
                    </div>
                  ))}
                </div>

                <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm shadow-indigo-200">
                  Join Test Lobby
                </button>
              </div>
            </div>

            {/* Micro Trend */}
            <h3 className="text-[14px] font-bold text-slate-800 mt-2">Recent Trend</h3>
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold text-slate-700 mb-1 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-emerald-500"/> Trajectory is UP</p>
                <p className="text-[11px] text-slate-500">You improved by 8% over the last 3 tests.</p>
              </div>
              <div className="w-24 h-12">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Recent Tests List */}
          <div className="flex flex-col h-full">
            <h3 className="text-[14px] font-bold text-slate-800 mb-6 flex justify-between items-center">
              Past Tests
              <span className="text-[11px] font-normal text-slate-400">{filteredTests.length} tests found</span>
            </h3>
            
            <div className="space-y-3">
              {filteredTests.length > 0 ? filteredTests.map((test, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setSelectedTest(test)}
                  className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100 cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl ${test.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <FileText className={`w-5 h-5 ${test.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-[14px] font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{test.name}</p>
                      <p className="text-[11.5px] text-slate-500 mt-0.5">{test.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-[15px] font-black ${test.color}`}>{test.score}%</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <FileText className="w-10 h-10 mb-2 opacity-20" />
                  <p className="text-[13px] font-medium">No past tests found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Test Analytics Modal */}
        {selectedTest && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center animate-fadein sm:p-4">
            <div className="bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl w-full max-w-lg p-6 sm:p-8 relative animate-slide-up h-[85vh] sm:h-auto overflow-y-auto">
              <button 
                onClick={() => setSelectedTest(null)}
                className="absolute top-6 right-6 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              
              <h3 className="text-[20px] font-bold text-slate-800 mb-1">{selectedTest.name}</h3>
              <p className="text-[13px] text-slate-500 mb-6 font-medium">Taken on {selectedTest.date}</p>
              
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Overall Score</p>
                  <p className={`text-[32px] font-black ${selectedTest.color}`}>{selectedTest.score}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Percentile</p>
                  <p className="text-[24px] font-bold text-slate-700">92nd</p>
                </div>
              </div>
              
              <h4 className="text-[14px] font-bold text-slate-800 mb-4">Subject Breakdown</h4>
              <div className="space-y-4 mb-8">
                {[
                  { name: 'Physics', score: Math.min(100, selectedTest.score + 5), color: 'bg-indigo-500' },
                  { name: 'Chemistry', score: Math.max(0, selectedTest.score - 8), color: 'bg-emerald-500' },
                  { name: 'Mathematics', score: selectedTest.score + 2, color: 'bg-amber-500' },
                ].map(s => (
                  <div key={s.name}>
                    <div className="flex justify-between text-[12px] font-bold mb-1.5">
                      <span className="text-slate-600">{s.name}</span>
                      <span className="text-slate-800">{s.score}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className={`h-full rounded-full ${s.color} transition-all duration-1000`} style={{ width: `${s.score}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              
              <button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[14px] rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> View Detailed Solutions
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
