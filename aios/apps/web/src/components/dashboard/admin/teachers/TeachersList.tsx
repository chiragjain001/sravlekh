'use client';

import { useState } from 'react';
import { Plus, Search, Download, Upload, ChevronDown, Calendar, Bell, SlidersHorizontal, Award, UserCheck, FileCheck, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

// --- Mock Data ---
const teachersData = [
  { id: 1, name: 'Rahul Verma', avatar: 'RV', subject: 'Physics', batches: 4, classes: 18, evaluation: 1, performance: '82%', workload: 85, availability: 'Available', role: 'Teacher' },
  { id: 2, name: 'Pooja Sharma', avatar: 'PS', subject: 'Chemistry', batches: 3, classes: 15, evaluation: 0, performance: '89%', workload: 70, availability: 'Available', role: 'Teacher' },
  { id: 3, name: 'Amit Singh', avatar: 'AS', subject: 'Mathematics', batches: 5, classes: 20, evaluation: 2, performance: '78%', workload: 95, availability: 'Busy', role: 'Teacher' },
  { id: 4, name: 'Neha Gupta', avatar: 'NG', subject: 'Biology', batches: 3, classes: 14, evaluation: 0, performance: '84%', workload: 65, availability: 'Available', role: 'Admin' },
  { id: 5, name: 'Sunidhi Mehta', avatar: 'SM', subject: 'Physical Edu.', batches: 2, classes: 10, evaluation: 1, performance: '86%', workload: 50, availability: 'Available', role: 'Teacher' },
  { id: 6, name: 'Vikram Rao', avatar: 'VR', subject: 'English', batches: 2, classes: 8, evaluation: 0, performance: '79%', workload: 40, availability: 'Available', role: 'Teacher' },
  { id: 7, name: 'Anjali Nair', avatar: 'AN', subject: 'Inorganic Chem.', batches: 2, classes: 9, evaluation: 1, performance: '81%', workload: 45, availability: 'Available', role: 'Teacher' },
  { id: 8, name: 'Devendra Pal', avatar: 'DP', subject: 'Maths', batches: 4, classes: 16, evaluation: 2, performance: '77%', workload: 80, availability: 'Busy', role: 'Teacher' },
];

const subjectCoverageData = [
  { name: 'Physics', value: 30, color: '#3b82f6' },
  { name: 'Chemistry', value: 25, color: '#10b981' },
  { name: 'Maths', value: 20, color: '#f59e0b' },
  { name: 'Biology', value: 15, color: '#8b5cf6' },
  { name: 'English', value: 10, color: '#64748b' },
];

export function TeachersList() {
  const [search, setSearch] = useState('');

  return (
    <div className="bg-white min-h-screen text-[#1e293b] p-6 space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Teachers</h1>
          <p className="text-xs text-gray-500 mt-0.5">Faculty management, scheduling, and workload optimization</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              4
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Teachers', value: '96', trend: '+4%', trendUp: true, color: 'text-green-500' },
            { label: 'Active Today', value: '88', trend: '91%', trendUp: true, color: 'text-green-500' },
            { label: 'Avg Workload', value: '18.4 h', trend: '+1.2h', trendUp: true, color: 'text-blue-500' },
            { label: 'Pending Appraisals', value: '5', trend: '-2', trendUp: false, color: 'text-amber-500' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-md transition-shadow">
              <h3 className="text-xs font-medium text-gray-500">{stat.label}</h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
                <span className={`text-[10px] font-bold ${stat.color} flex items-center`}>
                  {stat.trendUp ? '↑' : '↓'} {stat.trend}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Full-Width Controls Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2.5 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search teachers by name or subject..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {['Subject', 'Branch', 'Availability'].map((filter) => (
              <div key={filter} className="relative">
                <select className="appearance-none py-1.5 pl-3 pr-8 text-xs font-medium border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer outline-none">
                  <option value="">{filter}</option>
                  <option value="1">Option 1</option>
                  <option value="2">Option 2</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Download className="w-3.5 h-3.5 text-gray-500" /> Import
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap">
              <Upload className="w-3.5 h-3.5 text-gray-500" /> Export
            </button>
            <button className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Add Teacher
            </button>
          </div>
        </div>

        {/* ── FULL WIDTH TEACHER TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Teacher</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Subject</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Assigned Batches</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Weekly Classes</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Pending Evaluation</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Avg Student Performance</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700 w-36">Workload</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Availability</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {teachersData.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://ui-avatars.com/api/?name=${teacher.name}&background=f8fafc&color=475569&size=32`} alt={teacher.name} className="w-7 h-7 rounded-full shadow-2xs" />
                        <div>
                          <span className="font-bold text-gray-900 text-[12.5px] block">{teacher.name}</span>
                          {teacher.role === 'Admin' && <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded mt-0.5 inline-block uppercase border border-blue-100">Admin</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 font-semibold">{teacher.subject}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{teacher.batches} Batches</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{teacher.classes} hrs/wk</td>
                    <td className="px-5 py-3 text-rose-500 font-bold">{teacher.evaluation > 0 ? `${teacher.evaluation} Pending` : '—'}</td>
                    <td className="px-5 py-3 font-bold text-emerald-600">{teacher.performance}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${teacher.workload > 85 ? 'bg-red-500' : teacher.workload > 60 ? 'bg-blue-500' : 'bg-emerald-500'}`} 
                            style={{ width: `${teacher.workload}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-gray-600 font-bold w-8">{teacher.workload}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${teacher.availability === 'Available' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className={`text-[11.5px] font-bold ${teacher.availability === 'Available' ? 'text-emerald-700' : 'text-rose-700'}`}>{teacher.availability}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors">View Profile</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CARDS SET BELOW THE TABLE WITH PROPER SIZE AND SPACING ── */}
        <div className="space-y-6 pt-2">

          {/* Row 1: Workload Heatmap & Subject Coverage (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Workload Heatmap */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-blue-500" /> Weekly Workload Heatmap
                </h3>
                <p className="text-[11px] text-gray-400 mb-4">Class load distribution across shifts</p>

                <div className="flex flex-col gap-2.5 my-auto">
                  <div className="flex text-[10px] font-bold text-gray-400 pl-24">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="flex-1 text-center">{day}</div>
                    ))}
                  </div>
                  {[
                    { time: '8 AM - 12 PM', blocks: [1, 2, 3, 2, 1, 0] },
                    { time: '12 PM - 4 PM', blocks: [2, 3, 4, 3, 2, 1] },
                    { time: '4 PM - 8 PM', blocks: [1, 1, 2, 1, 1, 0] },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-24 text-[10px] font-bold text-gray-500 text-right pr-2 uppercase">{row.time}</div>
                      {row.blocks.map((level, j) => (
                        <div 
                          key={j} 
                          className={`flex-1 h-6 rounded-[4px] transition-all hover:scale-105 ${
                            level === 0 ? 'bg-gray-100' :
                            level === 1 ? 'bg-emerald-300' :
                            level === 2 ? 'bg-amber-400' :
                            level === 3 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`} 
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-gray-100 flex items-center justify-center gap-6 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-gray-100" /> Low</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-emerald-300" /> Normal</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-amber-400" /> Medium</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-orange-500" /> High</div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-[3px] bg-red-500" /> Overload</div>
              </div>
            </div>

            {/* Subject Coverage */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Subject Distribution & Coverage</h3>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-4">Faculty Strength by Department</p>
              </div>

              <div className="flex items-center gap-6 my-auto">
                <div className="w-36 h-36 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={subjectCoverageData}
                        innerRadius={42}
                        outerRadius={62}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {subjectCoverageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[14px] font-bold text-gray-800">96</span>
                    <span className="text-[9px] text-gray-400 uppercase font-semibold">Faculty</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5">
                  {subjectCoverageData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 font-semibold">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: Performance, Replacement Requests & Pending Approvals (3 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* 1. Faculty Performance Ranking */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-500" /> Faculty Performance Ranking
                  </h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Top Stars</span>
                </div>
                <div className="space-y-3">
                  {[
                    { rank: 1, name: 'Pooja Sharma', subject: 'Chemistry', score: '89%' },
                    { rank: 2, name: 'Sunidhi Mehta', subject: 'Physical Edu.', score: '86%' },
                    { rank: 3, name: 'Neha Gupta', subject: 'Biology', score: '84%' },
                  ].map((faculty) => (
                    <div key={faculty.rank} className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center text-white ${
                          faculty.rank === 1 ? 'bg-amber-400' : faculty.rank === 2 ? 'bg-slate-400' : 'bg-amber-600'
                        }`}>{faculty.rank}</span>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{faculty.name}</p>
                          <p className="text-[10px] text-gray-500">{faculty.subject}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">{faculty.score}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View All Rankings →
              </button>
            </div>

            {/* 2. Replacement Requests */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-orange-500" /> Replacement Requests
                  </h3>
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">2 Pending</span>
                </div>
                <div className="space-y-3">
                  {[
                    { role: 'Physics Teacher', batch: 'JEE 2025 Star', initials: 'PT' },
                    { role: 'Chemistry Teacher', batch: 'NEET 2025 Target', initials: 'CT' },
                  ].map((req, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-orange-100 bg-orange-50/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-xs">
                          {req.initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{req.role}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{req.batch}</p>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors">Review</button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View All Requests →
              </button>
            </div>

            {/* 3. Pending Paper Approvals */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-purple-500" /> Pending Paper Approvals
                  </h3>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">2 Papers</span>
                </div>
                <div className="space-y-3">
                  {[
                    { test: 'JEE Main Mock 08', teacher: 'Rahul Verma', initials: 'RM' },
                    { test: 'NEET Unit Test 04', teacher: 'Pooja Sharma', initials: 'PU' },
                  ].map((paper, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-purple-100 bg-purple-50/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                          {paper.initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{paper.test}</p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{paper.teacher}</p>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors">Approve</button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View All Approvals →
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
