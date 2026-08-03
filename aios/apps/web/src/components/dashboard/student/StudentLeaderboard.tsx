'use client';

import { useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react';
import { studentData as d } from '@/lib/mock-data/student';

export function StudentLeaderboard() {
  const [activeTab, setActiveTab] = useState('Overall');

  const top3 = activeTab === 'Overall' ? d.leaderboardTop3 : d.classLeaderboardTop3;
  const list = activeTab === 'Overall' ? d.leaderboardList : d.classLeaderboardList;

  return (
    <div className="p-5 animate-fadein h-full">
      <div className="card shadow-sm border border-slate-100 rounded-2xl w-full h-full p-6 lg:p-8 flex flex-col">
        
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-[22px] font-bold text-slate-800">Leaderboard</h2>
          <p className="text-[13px] text-slate-500">Compete, improve and achieve your best!</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 border-b border-slate-100 mb-8">
          {['Overall', 'Class'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-[14px] font-bold transition-all relative ${
                activeTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-indigo-600 rounded-t-full animate-fadein" />
              )}
            </button>
          ))}
        </div>

        {/* Top 3 Podium & Trophy Graphic */}
        <div className="flex flex-col lg:flex-row justify-between items-end gap-10 mb-8 px-4 animate-fadein" key={activeTab}>
          <div className="flex items-end justify-center gap-4 flex-1">
            {top3.map((winner) => {
              const isFirst = winner.rank === 1;
              const isSecond = winner.rank === 2;
              
              // Heights and styles based on rank
              const heightClass = isFirst ? 'h-48' : isSecond ? 'h-40' : 'h-36';
              const borderClass = isFirst ? 'border-amber-400 shadow-amber-200/50 shadow-xl z-10' : 
                                  isSecond ? 'border-slate-300' : 'border-orange-200';
              const textClass = isFirst ? 'text-amber-600' : isSecond ? 'text-slate-600' : 'text-orange-600';
              
              return (
                <div key={winner.rank} className={`flex flex-col items-center justify-end w-32 sm:w-40 bg-white border ${borderClass} rounded-2xl p-4 relative transition-all duration-500 hover:-translate-y-2 cursor-pointer ${heightClass} ${isFirst ? '-mt-4' : ''}`}>
                  
                  {/* Rank Badge */}
                  <div className={`absolute -top-4 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-[14px] shadow-md border-2 border-white ${
                    isFirst ? 'bg-amber-500' : isSecond ? 'bg-slate-400' : 'bg-orange-500'
                  }`}>
                    {winner.rank}
                  </div>

                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${(winner as any).isCurrentUser ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <span className="text-[14px] font-bold">{winner.initials}</span>
                  </div>
                  
                  {/* Info */}
                  <p className="text-[13px] font-bold text-slate-800 text-center leading-tight truncate w-full">{winner.name}</p>
                  <p className={`text-[12px] font-black mt-1 ${textClass}`}>{winner.points} PTS</p>
                  
                  {/* Extra icon for 1st */}
                  {isFirst && <Trophy className="w-5 h-5 text-amber-500 mt-2" />}
                </div>
              );
            })}
          </div>
          
          {/* Decorative Trophy on the right */}
          <div className="hidden lg:flex flex-col items-center justify-center w-48 h-48 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100/50">
            <Trophy className="w-20 h-20 text-indigo-500 mb-2 drop-shadow-md" />
            <div className="w-24 h-4 bg-indigo-200/50 rounded-full blur-md mt-2"></div>
          </div>
        </div>

        {/* List (Rank 1-10) */}
        <div className="flex-1 overflow-auto mb-6">
          <div className="space-y-1 pr-2 animate-slide-up" key={activeTab + "-list"}>
            {[...top3].sort((a, b) => a.rank - b.rank).concat(list as any).map((user) => (
              <div 
                key={user.rank} 
                className={`flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer hover:scale-[1.01] ${
                  (user as any).isCurrentUser ? 'bg-indigo-50 border border-indigo-100 shadow-sm' : 'hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-4 w-1/2">
                  <span className={`w-6 text-center text-[13px] font-bold ${(user as any).isCurrentUser ? 'text-indigo-600' : 'text-slate-500'}`}>
                    {user.rank}
                  </span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${(user as any).isCurrentUser ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-600'}`}>
                    <span className="text-[11px] font-bold">{user.initials}</span>
                  </div>
                  <span className={`text-[13.5px] font-semibold truncate ${(user as any).isCurrentUser ? 'text-indigo-900' : 'text-slate-700'}`}>
                    {user.name}
                  </span>
                </div>
                
                <div className="flex items-center justify-end gap-6 w-1/2">
                  <span className={`text-[13px] font-bold ${(user as any).isCurrentUser ? 'text-indigo-700' : 'text-slate-600'}`}>
                    {user.points} PTS
                  </span>
                  <div className="w-8 flex justify-end">
                    {(user as any).trend === 'up' && <span className="flex items-center text-emerald-500 text-[11px] font-bold"><TrendingUp className="w-3 h-3 mr-0.5"/> {(user as any).trendValue}</span>}
                    {(user as any).trend === 'down' && <span className="flex items-center text-rose-500 text-[11px] font-bold"><TrendingDown className="w-3 h-3 mr-0.5"/> {(user as any).trendValue}</span>}
                    {((user as any).trend === 'flat' || !(user as any).trend) && <span className="flex items-center text-slate-400 text-[11px] font-bold"><Minus className="w-3 h-3"/></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <button className="w-full py-3 border border-indigo-200 text-indigo-700 font-bold text-[13px] rounded-xl hover:bg-indigo-600 hover:text-white transition-all hover:shadow-md flex items-center justify-center gap-2">
          View Full Leaderboard <ExternalLink className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
