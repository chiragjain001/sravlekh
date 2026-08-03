'use client';

import { Trophy, Target, TrendingUp, AlertTriangle } from 'lucide-react';

export function StudentPerformance() {
  // Hardcoded for the student client demo to look impressive
  const masteryData = [
    { topic: 'Kinematics', score: 85, status: 'HEALTHY' },
    { topic: 'Laws of Motion', score: 78, status: 'HEALTHY' },
    { topic: 'Thermodynamics', score: 42, status: 'CRITICAL' },
    { topic: 'Optics', score: 60, status: 'WARNING' },
    { topic: 'Electromagnetism', score: 92, status: 'HEALTHY' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-navy-900">Performance Analytics</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card bg-gradient-to-br from-teal-50 to-white border-teal-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-100 rounded-lg text-teal-700"><Trophy className="w-5 h-5" /></div>
            <h3 className="font-semibold text-navy-900">Overall Rank</h3>
          </div>
          <p className="text-3xl font-bold text-teal-700">42 <span className="text-sm font-normal text-teal-600/70">/ 1250</span></p>
        </div>
        
        <div className="card bg-gradient-to-br from-indigo-50 to-white border-indigo-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-700"><Target className="w-5 h-5" /></div>
            <h3 className="font-semibold text-navy-900">Avg. Test Score</h3>
          </div>
          <p className="text-3xl font-bold text-indigo-700">76%</p>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-white border-purple-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-700"><TrendingUp className="w-5 h-5" /></div>
            <h3 className="font-semibold text-navy-900">Improvement</h3>
          </div>
          <p className="text-3xl font-bold text-purple-700">+12% <span className="text-sm font-normal text-purple-600/70">this month</span></p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-bold text-navy-900 mb-4">Topic Mastery</h3>
        <div className="space-y-4">
          {masteryData.map((data, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-medium text-navy-900 flex items-center gap-1">
                  {data.status === 'CRITICAL' && <AlertTriangle className="w-3.5 h-3.5 text-error" />}
                  {data.topic}
                </span>
                <span className="text-sm text-navy-500 font-medium">{data.score}%</span>
              </div>
              <div className="h-2 w-full bg-navy-50 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    data.status === 'CRITICAL' ? 'bg-error' : 
                    data.status === 'WARNING' ? 'bg-warning' : 'bg-teal-500'
                  }`}
                  style={{ width: `${data.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
