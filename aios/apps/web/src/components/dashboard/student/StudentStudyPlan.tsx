'use client';

import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2, Circle, Video } from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { studentData as d } from '@/lib/mock-data/student';

export function StudentStudyPlan() {
  const [dateOffset, setDateOffset] = useState(0);

  const getFormattedDate = (offset: number) => {
    const date = new Date(2025, 4, 23); // 23 May, 2025 as base
    date.setDate(date.getDate() + offset);
    const isToday = offset === 0;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate();
    const m = months[date.getMonth()];
    const y = date.getFullYear();
    const dateString = `${d} ${m}, ${y}`;
    
    return isToday ? `Today • ${dateString}` : dateString;
  };

  const handlePrevDay = () => setDateOffset(prev => prev - 1);
  const handleNextDay = () => setDateOffset(prev => prev + 1);

  // Derive mock tasks based on date offset to simulate dynamic data
  const todaysPlan = d.studyPlan;
  const simulatedPlan = todaysPlan.map((t, idx) => ({
    ...t,
    status: dateOffset < 0 ? 'done' : dateOffset === 0 ? (idx === 0 ? 'done' : idx === todaysPlan.length - 1 ? 'join' : 'pending') : 'pending'
  }));

  const tasksCompleted = simulatedPlan.filter(t => t.status === 'done').length;
  const totalTasks = simulatedPlan.length;
  const completionPercentage = Math.round((tasksCompleted / totalTasks) * 100) || 0;

  return (
    <div className="p-5 animate-fadein h-full flex flex-col">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full flex-1 flex flex-col p-6 lg:p-8">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-[19px] font-bold text-slate-800">Study Plan</h2>
          </div>
          <button className="text-[14px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
            View Full Plan
          </button>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <button onClick={handlePrevDay} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="text-[14px] font-bold text-slate-700 min-w-[150px] text-center">{getFormattedDate(dateOffset)}</p>
          <button onClick={handleNextDay} className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Timeline */}
        <div className="relative mb-10 max-w-2xl mx-auto">
          {/* Vertical Line */}
          <div className="absolute left-[84px] top-4 bottom-4 w-px bg-indigo-100" />

          <div className="space-y-6 relative">
            {simulatedPlan.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center group cursor-pointer relative z-10">
                {/* Time */}
                <div className="w-[72px] flex-shrink-0 text-right pr-4 hidden sm:block">
                  <span className="text-[13px] font-bold text-indigo-600">{item.time}</span>
                </div>

                {/* Node */}
                <div className="hidden sm:flex relative z-10 w-6 h-6 items-center justify-center bg-white">
                  <div className={`w-2.5 h-2.5 rounded-full ${item.status === 'done' ? 'bg-indigo-600' : 'bg-indigo-200 group-hover:bg-indigo-400 transition-colors'}`} />
                </div>

                {/* Content */}
                <div className="flex-1 pl-0 sm:pl-4 flex flex-col sm:flex-row sm:items-center justify-between border-l-2 sm:border-l-0 border-indigo-100 ml-4 sm:ml-0 pl-4 py-1 sm:py-0">
                  <div className="mb-2 sm:mb-0">
                    <p className="text-[14px] font-bold text-slate-800">{item.task}</p>
                    <p className="text-[12px] text-slate-500 mt-0.5 sm:hidden mb-1 font-semibold text-indigo-600">{item.time}</p>
                    <p className="text-[12px] text-slate-500">{item.subject ? item.subject : item.duration}</p>
                  </div>

                  {/* Status Indicator / Action */}
                  <div className="flex-shrink-0 mt-2 sm:mt-0 sm:ml-4">
                    {item.status === 'done' && (
                      <CheckCircle2 className="w-6 h-6 text-emerald-500 fill-emerald-50" />
                    )}
                    {item.status === 'pending' && (
                      <Circle className="w-6 h-6 text-slate-200 hidden sm:block" />
                    )}
                    {item.status === 'join' && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-[12px] font-bold transition-colors">
                        Join <Video className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Summary */}
        <div className="flex flex-col sm:flex-row items-center justify-between bg-slate-50/50 rounded-xl p-4 border border-slate-100 gap-4 sm:gap-0">
          <div className="text-center flex-1 sm:border-r border-slate-200 w-full sm:w-auto pb-4 sm:pb-0 border-b sm:border-b-0">
            <p className="text-[20px] font-bold text-slate-800">{totalTasks}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Tasks {dateOffset === 0 ? 'Today' : 'for this day'}</p>
          </div>
          <div className="text-center flex-1 sm:border-r border-slate-200 w-full sm:w-auto pb-4 sm:pb-0 border-b sm:border-b-0">
            <p className="text-[20px] font-bold text-slate-800">2h 30m</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Study Time</p>
          </div>
          <div className="flex items-center justify-center flex-1 gap-3 w-full sm:w-auto">
            <div className="relative w-10 h-10 flex-shrink-0">
              <PieChart width={40} height={40}>
                <Pie data={[{value: completionPercentage, fill: '#10b981'}, {value: 100 - completionPercentage, fill: '#e2e8f0'}]} cx={20} cy={20} innerRadius={14} outerRadius={20} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                  {[{fill: '#10b981'}, {fill: '#e2e8f0'}].map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Pie>
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold text-emerald-600">{completionPercentage}%</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Plan Completion</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
