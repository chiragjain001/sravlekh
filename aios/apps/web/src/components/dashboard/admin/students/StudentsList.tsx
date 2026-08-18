'use client';

import { useState } from 'react';
import { Plus, Search, Download, Upload, ChevronDown, Calendar, Bell, SlidersHorizontal, AlertTriangle, UserX, TrendingUp } from 'lucide-react';
import { 
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

// --- Mock Data ---
const studentsData = [
  { id: 1, name: 'Ayush Singh', roll: 'AOS24001', batch: 'JEE 2025 Star', program: 'JEE', attendance: '92%', score: '78%', weakTopics: 3, fees: 'Paid', contact: '9876543210', risk: 'Low', activity: 'Today', avatar: 'AS' },
  { id: 2, name: 'Krisha Sharma', roll: 'AOS24002', batch: 'NEET 2025 Target', program: 'NEET', attendance: '89%', score: '84%', weakTopics: 2, fees: 'Paid', contact: '9876543211', risk: 'Low', activity: 'Yesterday', avatar: 'KS' },
  { id: 3, name: 'Rohan Verma', roll: 'AOS24003', batch: 'Foundation 11A', program: '11th', attendance: '65%', score: '42%', weakTopics: 6, fees: 'Due', contact: '9876543212', risk: 'High', activity: '2 days ago', avatar: 'RV' },
  { id: 4, name: 'Megha Jain', roll: 'AOS24004', batch: 'JEE 2026 Early', program: 'JEE', attendance: '95%', score: '88%', weakTopics: 1, fees: 'Paid', contact: '9876543213', risk: 'Low', activity: 'Today', avatar: 'MJ' },
  { id: 5, name: 'Aditya Patel', roll: 'AOS24005', batch: 'NEET 2025 Target', program: 'NEET', attendance: '72%', score: '58%', weakTopics: 4, fees: 'Partial', contact: '9876543214', risk: 'Medium', activity: '3 days ago', avatar: 'AP' },
  { id: 6, name: 'Vanaya Gupta', roll: 'AOS24006', batch: 'Foundation 11A', program: '11th', attendance: '58%', score: '35%', weakTopics: 7, fees: 'Due', contact: '9876543215', risk: 'High', activity: '4 days ago', avatar: 'VG' },
  { id: 7, name: 'Vivaan Mehta', roll: 'AOS24007', batch: 'JEE 2025 Star', program: 'JEE', attendance: '90%', score: '82%', weakTopics: 2, fees: 'Paid', contact: '9876543216', risk: 'Low', activity: 'Yesterday', avatar: 'VM' },
  { id: 8, name: 'Ishita Rawat', roll: 'AOS24008', batch: 'NEET 2025 Target', program: 'NEET', attendance: '83%', score: '76%', weakTopics: 3, fees: 'Paid', contact: '9876543217', risk: 'Medium', activity: 'Today', avatar: 'IR' },
];

const weakTopicData = [
  { name: 'Rahul Verma (Phys)', value: 30, color: '#3b82f6' },
  { name: 'Amit Singh (Maths)', value: 25, color: '#ef4444' },
  { name: 'Pooja Sharma (Chem)', value: 20, color: '#10b981' },
  { name: 'Meera Joshi (Bio)', value: 15, color: '#8b5cf6' },
  { name: 'Others', value: 10, color: '#f59e0b' },
];

const growthData = [
  { month: 'Jan', students: 950 },
  { month: 'Feb', students: 1020 },
  { month: 'Mar', students: 1100 },
  { month: 'Apr', students: 1180 },
  { month: 'May', students: 1240 },
  { month: 'Jun', students: 1284 },
];

const feesData = [
  { name: 'Paid', value: 974, color: '#10b981' },
  { name: 'Partial', value: 146, color: '#f59e0b' },
  { name: 'Overdue', value: 164, color: '#ef4444' },
];

export function StudentsList() {
  const [search, setSearch] = useState('');

  return (
    <div className="bg-white min-h-screen text-[#1e293b] p-6 space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Students</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage and monitor all student information across programs</p>
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
            { label: 'Total Students', value: '1,284', trend: '+7%', trendUp: true, color: 'text-green-500' },
            { label: 'Active Students', value: '1,142', trend: '-5%', trendUp: false, color: 'text-red-500' },
            { label: 'At-Risk Students', value: '86', trend: '+12%', trendUp: true, color: 'text-red-500' },
            { label: 'New Admissions', value: '126', trend: '+15%', trendUp: true, color: 'text-green-500' },
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
                placeholder="Search students by name, roll no..."
                className="pl-8 pr-3 py-1.5 w-full text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-gray-700 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {['Program', 'Batch', 'Branch', 'Status'].map((filter) => (
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
              <Plus className="w-3.5 h-3.5" /> Add Student
            </button>
          </div>
        </div>

        {/* ── FULL WIDTH STUDENT TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-gray-50/70 border-b border-gray-100 text-gray-500">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Student Name</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Roll No.</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Batch</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Program</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Attendance</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Avg Score</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Weak Topics</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Fees Status</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Parent Contact</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Performance</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-700">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {studentsData.map((student) => (
                  <tr key={student.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://ui-avatars.com/api/?name=${student.name}&background=eff6ff&color=2563eb&size=32`} alt={student.name} className="w-7 h-7 rounded-full shadow-2xs" />
                        <span className="font-bold text-gray-900 text-[12.5px]">{student.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-medium">{student.roll}</td>
                    <td className="px-5 py-3 text-blue-600 font-semibold">{student.batch}</td>
                    <td className="px-5 py-3 text-indigo-600 font-semibold">{student.program}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{student.attendance}</td>
                    <td className="px-5 py-3 font-bold text-gray-900">{student.score}</td>
                    <td className="px-5 py-3 text-gray-600 font-medium">{student.weakTopics}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full flex items-center w-fit ${
                        student.fees === 'Paid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        student.fees === 'Partial' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${student.fees === 'Paid' ? 'bg-emerald-500' : student.fees === 'Partial' ? 'bg-amber-500' : 'bg-red-500'}`}></span>
                        {student.fees}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-blue-600 font-medium">{student.contact}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 text-[10.5px] font-bold rounded-full ${
                        student.risk === 'Low' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        student.risk === 'Medium' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                        'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {student.risk === 'Low' ? 'High' : student.risk === 'Medium' ? 'Medium' : 'Low'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400 text-[11px] font-medium">{student.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── CARDS SET BELOW THE TABLE WITH PROPER SIZE AND SPACING ── */}
        <div className="space-y-6 pt-2">
          
          {/* Row 1: 3 Column Charts & Distribution Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* 1. Student Growth Trend */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-500" /> Student Growth Trend
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">Last 6 Months Enrollment</p>
                </div>
                <div className="text-right">
                  <span className="text-base font-bold text-gray-900 block leading-tight">1,284</span>
                  <span className="text-[10px] font-medium text-gray-400">Total Enrolled</span>
                </div>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={growthData} margin={{ top: 5, right: 15, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} dy={5} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="students" 
                      stroke="#10b981" 
                      strokeWidth={2.5} 
                      dot={{ r: 3, fill: '#10b981' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Fee Status Distribution */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Fee Status Distribution</h3>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-4">Collection Breakdown</p>
              </div>
              
              <div className="flex items-center gap-4 my-auto">
                <div className="w-28 h-28 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={feesData}
                        innerRadius={36}
                        outerRadius={52}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {feesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[12px] font-bold text-gray-800">1,284</span>
                    <span className="text-[8px] text-gray-400 uppercase font-semibold">Total</span>
                  </div>
                </div>
                <div className="flex-1 space-y-2.5">
                  {feesData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.value} <span className="text-gray-400 text-[10px] font-normal">({(item.value / 1284 * 100).toFixed(0)}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Teacher-wise Gap Distribution */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Teacher Performance Distribution</h3>
                <p className="text-[11px] text-gray-400 mt-0.5 mb-4">Teacher-wise Academic Gaps</p>
              </div>
              <div className="flex items-center gap-4 my-auto">
                <div className="w-28 h-28 relative shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={weakTopicData}
                        innerRadius={36}
                        outerRadius={52}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {weakTopicData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {weakTopicData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[11px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-gray-600 font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Row 2: 2 Column Action Panels (Intervention & Absentees) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Students Needing Intervention */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" /> Students Needing Intervention
                  </h3>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">86 At-Risk</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Rohan Verma', batch: 'Foundation 11A', initials: 'RV', color: 'bg-red-100 text-red-600', border: 'border-red-100 bg-red-50/30' },
                    { name: 'Vanaya Gupta', batch: 'Foundation 11A', initials: 'VG', color: 'bg-red-100 text-red-600', border: 'border-red-100 bg-red-50/30' },
                    { name: 'Aditya Patel', batch: 'NEET 2025 Target', initials: 'AP', color: 'bg-amber-100 text-amber-600', border: 'border-amber-100 bg-amber-50/30' },
                  ].map((student, idx) => (
                    <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border ${student.border}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${student.color}`}>
                          {student.initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{student.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{student.batch}</p>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors">View Profile</button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View All Intervention Students (86) →
              </button>
            </div>

            {/* Recent Absentees */}
            <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <UserX className="w-4 h-4 text-amber-500" /> Recent Absentees
                  </h3>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Today</span>
                </div>
                <div className="space-y-3">
                  {[
                    { name: 'Siddharth Rao', batch: 'JEE 2025 Star', initials: 'SR' },
                    { name: 'Pooja Nair', batch: 'NEET 2025 Target', initials: 'PN' },
                    { name: 'Devanshi Yadav', batch: 'Foundation 11A', initials: 'DY' },
                  ].map((student, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-slate-50/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {student.initials}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-900">{student.name}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">{student.batch}</p>
                        </div>
                      </div>
                      <button className="px-3 py-1 bg-white border border-gray-200 text-blue-600 text-[11px] font-bold rounded-lg hover:bg-blue-50 transition-colors">View Profile</button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="w-full mt-4 text-center text-xs text-blue-600 font-bold hover:underline">
                View All Absentees →
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
