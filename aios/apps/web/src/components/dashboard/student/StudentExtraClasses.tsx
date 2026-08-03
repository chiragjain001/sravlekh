'use client';

import { useState } from 'react';
import { BookOpen, ChevronRight, PlayCircle, Atom, FileDigit, FlaskConical, Presentation, Users, CheckCircle2 } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';

const iconMap = {
  'atom': Atom,
  'function': FileDigit,
  'flask': FlaskConical,
};

export function StudentExtraClasses() {
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [joiningClass, setJoiningClass] = useState<number | null>(null);

  const handleJoin = (id: number) => {
    setJoiningClass(id);
    setTimeout(() => {
      setJoiningClass(null);
      alert('Joined class successfully!');
    }, 1500);
  };

  const filteredClasses = d.extraClasses.filter(c => {
    if (activeTab === 'Upcoming') return c.status === 'upcoming';
    if (activeTab === 'Joined') return c.status === 'joined';
    return false; // completed logic here
  });

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-[19px] font-bold text-slate-800">Extra Classes</h2>
              <p className="text-[12px] text-slate-500">Personalized extra classes for your weak topics.</p>
            </div>
          </div>
          <button className="text-[14px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1">
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-slate-100 mb-6">
          {['Upcoming (3)', 'Joined (8)', 'Completed (12)'].map((tab) => {
            const baseTab = tab.split(' ')[0] as string;
            const isActive = activeTab === baseTab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(baseTab)}
                className={`pb-3 text-[13.5px] font-bold transition-all relative ${
                  isActive ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab}
                {isActive && (
                  <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-emerald-500 rounded-t-full animate-fadein" />
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar pr-2 mb-6">
          {filteredClasses.length > 0 ? filteredClasses.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap] || BookOpen;
            const isJoining = joiningClass === item.id;
            const subjectColor = item.subject === 'Physics' ? 'text-indigo-600 bg-indigo-50' : 
                                 item.subject === 'Mathematics' ? 'text-blue-600 bg-blue-50' : 
                                 'text-emerald-600 bg-emerald-50';

            return (
              <div key={item.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-slate-100 rounded-2xl hover:border-emerald-100 hover:bg-emerald-50/20 transition-all cursor-pointer group gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform ${subjectColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[15px] font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">{item.title}</h4>
                    <p className="text-[12.5px] text-slate-500 mt-0.5">
                      {item.subject} • By <span className="font-semibold text-slate-600">{item.teacher}</span>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-left sm:text-right">
                    <p className="text-[13px] font-bold text-slate-800">{item.date}</p>
                    <p className="text-[11.5px] font-medium text-slate-400">{item.time}</p>
                  </div>
                  {item.status === 'upcoming' ? (
                    <button 
                      onClick={() => handleJoin(item.id)}
                      disabled={isJoining}
                      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[13px] font-bold rounded-xl transition-all shadow-sm shadow-emerald-200 disabled:opacity-70 w-24 flex items-center justify-center"
                    >
                      {isJoining ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        'Join'
                      )}
                    </button>
                  ) : (
                    <button className="px-6 py-2 bg-slate-100 text-slate-500 text-[13px] font-bold rounded-xl transition-all cursor-not-allowed flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Joined
                    </button>
                  )}
                </div>
              </div>
            );
          }) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-10">
              <BookOpen className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-[14px] font-medium text-slate-500">No classes found.</p>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-6 mt-auto">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100/50">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Presentation className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[20px] font-black text-emerald-700 leading-none">{d.extraClassStats.joined}</p>
              <p className="text-[12px] font-medium text-emerald-600/80 mt-1">Extra Classes Joined</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/50">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-[20px] font-black text-indigo-700 leading-none">{d.extraClassStats.topicsCovered}</p>
              <p className="text-[12px] font-medium text-indigo-600/80 mt-1">Topics Covered</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-[20px] font-black text-blue-700 leading-none">{d.extraClassStats.totalHours} hrs</p>
              <p className="text-[12px] font-medium text-blue-600/80 mt-1">Total Learning Time</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
