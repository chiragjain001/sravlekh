'use client';

import { useState } from 'react';
import { 
  Search, ChevronDown, Calendar, Bell, 
  UserCheck, Download, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Users, AlertTriangle, CalendarDays, Activity, CheckCircle2, XCircle, Clock, ShieldAlert, Sparkles, Filter, Layers
} from 'lucide-react';
import { 
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

// --- Mock Data ---
const attendanceTrendData = [
  { date: '17 May', Overall: 82, Present: 78, Absent: 12 },
  { date: '18 May', Overall: 85, Present: 84, Absent: 10 },
  { date: '19 May', Overall: 78, Present: 78, Absent: 14 },
  { date: '20 May', Overall: 88, Present: 85, Absent: 8 },
  { date: '21 May', Overall: 84, Present: 82, Absent: 11 },
  { date: '23 May', Overall: 92, Present: 89, Absent: 7 },
];

const batchAttendanceList = [
  { batch: 'JEE 2025 Star', program: 'JEE', present: '94%', absent: '4%', leave: '2%', status: 'Excellent', color: 'emerald' },
  { batch: 'NEET 2025 Target', program: 'NEET', present: '92%', absent: '6%', leave: '2%', status: 'Good', color: 'emerald' },
  { batch: 'Foundation 11A', program: 'Class 11', present: '91%', absent: '7%', leave: '2%', status: 'Good', color: 'blue' },
  { batch: 'JEE 2026 Early', program: 'JEE', present: '89%', absent: '8%', leave: '3%', status: 'Average', color: 'indigo' },
  { batch: 'Foundation 11B', program: 'Class 11', present: '87%', absent: '10%', leave: '3%', status: 'Needs Attention', color: 'amber' },
];

const atRiskStudents = [
  { student: 'Rohan Mehta', rollNo: 'STU-1082', batch: 'JEE 2025 Star', attendance: '62%', lastAbsent: '22 May 2025', riskLevel: 'High' },
  { student: 'Ananya Singh', rollNo: 'STU-1140', batch: 'NEET 2025 Target', attendance: '64%', lastAbsent: '21 May 2025', riskLevel: 'High' },
  { student: 'Kunal Sharma', rollNo: 'STU-1021', batch: 'Foundation 11A', attendance: '66%', lastAbsent: '20 May 2025', riskLevel: 'Medium' },
  { student: 'Ishika Patel', rollNo: 'STU-1198', batch: 'JEE 2026 Early', attendance: '68%', lastAbsent: '22 May 2025', riskLevel: 'Medium' },
  { student: 'Manav Jain', rollNo: 'STU-1055', batch: 'Foundation 11B', attendance: '70%', lastAbsent: '19 May 2025', riskLevel: 'Moderate' },
];

const todaySummaryData = [
  { name: 'Present Students', value: 2864, color: '#10b981', percent: '90%', lightBg: 'bg-emerald-50', textColor: 'text-emerald-700', border: 'border-emerald-200' },
  { name: 'Absent Students', value: 248, color: '#ef4444', percent: '8%', lightBg: 'bg-rose-50', textColor: 'text-rose-700', border: 'border-rose-200' },
  { name: 'Approved Leave', value: 78, color: '#f59e0b', percent: '2%', lightBg: 'bg-amber-50', textColor: 'text-amber-700', border: 'border-amber-200' },
];

const heatmapBatches = [
  { name: 'JEE 2025 Star', code: 'J25-S' },
  { name: 'NEET 2025 Target', code: 'N25-T' },
  { name: 'Foundation 11A', code: 'F11-A' },
  { name: 'JEE 2026 Early', code: 'J26-E' },
  { name: 'Foundation 11B', code: 'F11-B' },
];

export function AdminAttendance() {
  const [search, setSearch] = useState('');
  const [activeModal, setActiveModal] = useState<'batchList' | 'todaySummary' | 'atRisk' | 'heatmapCalendar' | null>(null);

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full bg-slate-50/40 min-h-screen">
      
      {/* ── HEADER WITH GRADIENT BRAND BADGE ── */}
      <div className="flex items-center justify-between pb-5 border-b border-slate-200/80 bg-white p-5 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-500/20">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Attendance Intelligence Console</h1>
              <span className="px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs">
                Live Audit
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Real-time attendance tracking, biometric sync, and intervention analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs text-slate-600 font-semibold shadow-xs">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer shadow-xs transition-colors">
            <Bell className="w-4 h-4 text-slate-600" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-rose-500 to-red-600 rounded-full text-white text-[9px] font-extrabold flex items-center justify-center shadow-xs">
              4
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── STAT CARDS WITH VIBRANT COLOR PALETTE & GRADIENT ACCENTS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { 
              label: 'Overall Attendance Rate', value: '92.4%', trend: '+4.2%', trendUp: true, 
              gradient: 'from-emerald-50 to-teal-50/50', border: 'border-emerald-200/70',
              iconBg: 'bg-emerald-500 text-white shadow-emerald-500/20', icon: CheckCircle2,
              valueColor: 'text-emerald-900', badgeColor: 'bg-emerald-100 text-emerald-800'
            },
            { 
              label: 'Students Present Today', value: '2,864', trend: '+142 vs Yesterday', trendUp: true, 
              gradient: 'from-blue-50 to-indigo-50/50', border: 'border-blue-200/70',
              iconBg: 'bg-blue-600 text-white shadow-blue-500/20', icon: UserCheck,
              valueColor: 'text-blue-900', badgeColor: 'bg-blue-100 text-blue-800'
            },
            { 
              label: 'Absent Today', value: '248', trend: '-18 vs Yesterday', trendUp: false, 
              gradient: 'from-rose-50 to-red-50/50', border: 'border-rose-200/70',
              iconBg: 'bg-rose-500 text-white shadow-rose-500/20', icon: XCircle,
              valueColor: 'text-rose-900', badgeColor: 'bg-rose-100 text-rose-800'
            },
            { 
              label: 'Approved Medical Leave', value: '78', trend: '+4 Approved', trendUp: true, 
              gradient: 'from-amber-50 to-yellow-50/50', border: 'border-amber-200/70',
              iconBg: 'bg-amber-500 text-white shadow-amber-500/20', icon: Clock,
              valueColor: 'text-amber-900', badgeColor: 'bg-amber-100 text-amber-800'
            },
            { 
              label: 'At-Risk Students (<75%)', value: '112', trend: '-5 Actioned', trendUp: true, 
              gradient: 'from-purple-50 to-violet-50/50', border: 'border-purple-200/70',
              iconBg: 'bg-purple-600 text-white shadow-purple-500/20', icon: ShieldAlert,
              valueColor: 'text-purple-900', badgeColor: 'bg-purple-100 text-purple-800'
            },
          ].map((stat, i) => {
            const StatIcon = stat.icon;
            return (
              <div 
                key={i} 
                className={`bg-gradient-to-br ${stat.gradient} rounded-2xl p-4.5 border ${stat.border} shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11.5px] font-bold text-slate-600 uppercase tracking-wide">{stat.label}</span>
                  <div className={`w-8 h-8 rounded-xl ${stat.iconBg} flex items-center justify-center shadow-md`}>
                    <StatIcon className="w-4 h-4" />
                  </div>
                </div>
                
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={`text-2xl font-black tracking-tight ${stat.valueColor}`}>{stat.value}</span>
                </div>
                
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold flex items-center gap-1 ${stat.badgeColor}`}>
                    {stat.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {stat.trend}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── CONTROLS & FILTERING BAR WITH ACCENT BUTTONS ── */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-3 rounded-2xl border border-slate-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by student name, roll number, or batch..."
                className="pl-9 pr-3 py-2 w-full text-xs font-medium border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 text-slate-700 bg-slate-50/50 focus:bg-white transition-all"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {['Batch Cohort', 'Program (JEE/NEET)', 'Date Range', 'Risk Level'].map((filter) => (
              <div key={filter} className="relative">
                <select className="appearance-none py-2 pl-3.5 pr-8 text-xs font-bold border border-slate-200 rounded-xl bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:border-blue-500 cursor-pointer shadow-2xs">
                  <option value="">{filter}</option>
                  <option value="1">All Active Batches</option>
                  <option value="2">At-Risk Only (&lt;75%)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2.5">
            <button className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs">
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export Excel
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 transition-all cursor-pointer">
              <UserCheck className="w-4 h-4" /> Mark Biometric Attendance
            </button>
          </div>
        </div>

        {/* ── TOP 3-COLUMN SPLIT WITH VIBRANT CARDS ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Card 1: Attendance Trend Overview (4 Cols) */}
          <div className="xl:col-span-4 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Attendance Trend</h3>
                    <p className="text-[11px] text-slate-500">6-Day cohort presence tracking (%)</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  92.4% Average
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold mb-4 bg-slate-50/80 p-2 rounded-xl border border-slate-100 justify-center">
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block shadow-xs" /> Overall Attendance
                </span>
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block shadow-xs" /> Present %
                </span>
              </div>

              <div className="h-52 -ml-3 -mb-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                    <defs>
                      <linearGradient id="overallGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02}/>
                      </linearGradient>
                      <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }} domain={[50, 100]} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', fontWeight: 600 }} />
                    <Area type="monotone" dataKey="Overall" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#overallGradient)" dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#ffffff' }} />
                    <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">Consistent 90%+ target across star cohorts</span>
              <button 
                onClick={() => setActiveModal('todaySummary')}
                className="text-xs font-extrabold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer hover:underline"
              >
                Full Analytics <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card 2: Attendance by Batch (5 Cols) */}
          <div className="xl:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Attendance by Batch Cohort</h3>
                    <p className="text-[11px] text-slate-500">Live breakdown across active academic streams</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  5 Batches Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-600 border-y border-slate-100 font-extrabold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Batch Name</th>
                      <th className="py-2.5 px-3">Program</th>
                      <th className="py-2.5 px-3 text-emerald-700">Present %</th>
                      <th className="py-2.5 px-3 text-rose-600">Absent %</th>
                      <th className="py-2.5 px-3 text-amber-600">Leave %</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchAttendanceList.map((row, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                        <td className="py-3 px-3 font-bold text-slate-900">{row.batch}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                            {row.program}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-black text-emerald-600 bg-emerald-50/40 rounded-lg">{row.present}</td>
                        <td className="py-3 px-3 font-bold text-rose-600">{row.absent}</td>
                        <td className="py-3 px-3 font-bold text-amber-600">{row.leave}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
                            row.color === 'emerald' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            row.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            row.color === 'indigo' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Tracking 1,672 enrolled students total</span>
              <button 
                onClick={() => setActiveModal('batchList')} 
                className="text-xs font-extrabold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
              >
                View All Batches →
              </button>
            </div>
          </div>

          {/* Card 3: Today's Summary Donut & Cards (3 Cols) */}
          <div className="xl:col-span-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Today's Headcount</h3>
                  <p className="text-[11px] text-slate-500">23 May live audit summary</p>
                </div>
              </div>

              <div className="flex items-center my-2">
                <div className="w-1/2 h-36 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={todaySummaryData}
                        innerRadius={42}
                        outerRadius={60}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {todaySummaryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] text-slate-400 font-bold uppercase">Total</span>
                    <span className="text-base font-black text-slate-900 leading-tight">3,190</span>
                  </div>
                </div>

                <div className="w-1/2 space-y-2 pl-1">
                  {todaySummaryData.map((item, idx) => (
                    <div key={idx} className={`p-2 rounded-xl border ${item.border} ${item.lightBg}`}>
                      <div className="text-[10px] font-bold text-slate-600">{item.name}</div>
                      <div className={`text-xs font-black ${item.textColor} flex items-center justify-between mt-0.5`}>
                        <span>{item.value.toLocaleString()}</span>
                        <span className="text-[10px] font-extrabold">{item.percent}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setActiveModal('todaySummary')} 
                className="w-full text-center text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer"
              >
                View Detailed Headcount Report →
              </button>
            </div>
          </div>

        </div>

        {/* ── BOTTOM 2-COLUMN SPLIT: STUDENTS AT RISK & MONTHLY HEATMAP ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Card 4: Students at Risk (<75%) (5 Cols) */}
          <div className="xl:col-span-5 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center font-bold">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Students at Risk (Attendance &lt; 75%)</h3>
                    <p className="text-[11px] text-slate-500">Requires academic intervention &amp; parent alerts</p>
                  </div>
                </div>
                <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                  112 Students Total
                </span>
              </div>

              {/* Alert Callout Banner */}
              <div className="mb-4 p-3 rounded-xl bg-gradient-to-r from-rose-500/10 via-red-500/5 to-amber-500/10 border border-rose-200/80 flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs text-rose-900 font-bold">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>5 students crossed critical threshold (&lt;65%) this week</span>
                </div>
                <button 
                  onClick={() => setActiveModal('atRisk')}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-[10.5px] rounded-lg shadow-xs transition-colors shrink-0"
                >
                  Send Parents SMS
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-600 border-y border-slate-100 font-extrabold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Batch</th>
                      <th className="py-2.5 px-3 text-rose-600">Attendance %</th>
                      <th className="py-2.5 px-3">Last Absent</th>
                      <th className="py-2.5 px-3 text-center">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atRiskStudents.map((st, i) => (
                      <tr key={i} className="hover:bg-rose-50/20 transition-colors">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-slate-900 block">{st.student}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{st.rollNo}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">{st.batch}</td>
                        <td className="py-2.5 px-3 font-black text-rose-600 bg-rose-50/50 rounded-lg">{st.attendance}</td>
                        <td className="py-2.5 px-3 text-slate-500 font-medium">{st.lastAbsent}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                            st.riskLevel === 'High' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                            st.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-800 border-amber-200' :
                            'bg-yellow-100 text-yellow-800 border-yellow-200'
                          }`}>
                            {st.riskLevel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">Automated SMS notifications trigger on 3 consecutive absents</span>
              <button 
                onClick={() => setActiveModal('atRisk')} 
                className="text-xs font-extrabold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer flex items-center gap-1"
              >
                View Full Risk Directory →
              </button>
            </div>
          </div>

          {/* Card 5: Attendance Heatmap (This Month) (7 Cols) */}
          <div className="xl:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center font-bold">
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Attendance Heatmap Matrix (May 2025)</h3>
                    <p className="text-[11px] text-slate-500">Daily density matrix tracking batch-level presence rates</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                    23 Days Tracked
                  </span>
                </div>
              </div>

              {/* Heatmap Grid Matrix */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center text-[10.5px] text-slate-500 font-bold pl-32 gap-1.5">
                  {Array.from({ length: 23 }).map((_, d) => (
                    <div key={d} className="w-3.5 text-center font-mono">{d + 1}</div>
                  ))}
                </div>
                {heatmapBatches.map((batch, bIdx) => (
                  <div key={bIdx} className="flex items-center text-xs">
                    <div className="w-32 pr-2">
                      <span className="text-xs font-bold text-slate-800 truncate block">{batch.name}</span>
                      <span className="text-[9.5px] text-slate-400 font-mono block">{batch.code}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 23 }).map((_, day) => {
                        const d = day + 1;
                        let bg = 'bg-emerald-500 hover:bg-emerald-600';
                        let title = `Day ${d}: 95% Present`;
                        if (d === 9 || d === 10) {
                          bg = bIdx === 0 ? 'bg-emerald-400' : bIdx === 2 || bIdx === 4 ? 'bg-amber-400 hover:bg-amber-500' : 'bg-emerald-500';
                        } else if (d === 18) {
                          bg = bIdx === 3 ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500';
                        } else if (d === 20) {
                          bg = bIdx === 2 ? 'bg-amber-500' : bIdx === 4 ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500';
                        } else if (d === 22) {
                          bg = bIdx === 1 ? 'bg-emerald-400' : 'bg-emerald-500';
                        }
                        return (
                          <div 
                            key={day} 
                            title={title}
                            className={`w-3.5 h-5 rounded-md ${bg} transition-transform hover:scale-125 cursor-pointer shadow-2xs`} 
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4 text-[11px] text-slate-600 font-bold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500 inline-block shadow-xs"/> ≥ 90%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-400 inline-block shadow-xs"/> 75% - 89%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-400 inline-block shadow-xs"/> 50% - 74%</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-rose-500 inline-block shadow-xs"/> &lt; 50%</span>
              </div>
              <button 
                onClick={() => setActiveModal('heatmapCalendar')} 
                className="text-xs font-extrabold text-indigo-600 hover:text-indigo-700 hover:underline cursor-pointer flex items-center gap-1"
              >
                View Full Heatmap Calendar →
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* ── OVERLAP MODALS ── */}

      {/* 1. Batch List Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'batchList'}
        onClose={() => setActiveModal(null)}
        title="Batch-wise Attendance Scorecard"
        subtitle="Detailed breakdown of present, absent, and leave ratios across all active cohorts"
        icon={Users}
        badgeText="5 Batches Tracked"
      >
        <div className="space-y-3">
          {batchAttendanceList.map((b, idx) => (
            <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/70 flex justify-between items-center hover:bg-slate-100/60 transition-colors">
              <div>
                <h4 className="text-xs font-bold text-slate-900">{b.batch}</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">Absent Rate: {b.absent} • Leave Rate: {b.leave} • Program: {b.program}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-600">Status: {b.status}</span>
                <span className="text-sm font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">{b.present} Present</span>
              </div>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 2. Today Summary Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'todaySummary'}
        onClose={() => setActiveModal(null)}
        title="Today's Attendance Breakdown Report"
        subtitle="Detailed head-count metrics and biometric sync logs for 23 May 2025"
        icon={UserCheck}
        badgeText="92.4% Attendance Rate"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <span className="text-xs font-bold text-emerald-700 block">Present Students</span>
              <span className="text-2xl font-black text-emerald-900 mt-1 block">2,864</span>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">90% of Total Enrolled</span>
            </div>
            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200">
              <span className="text-xs font-bold text-rose-700 block">Absent Students</span>
              <span className="text-2xl font-black text-rose-900 mt-1 block">248</span>
              <span className="text-[11px] text-rose-600 font-semibold mt-1 block">8% Unexcused Absences</span>
            </div>
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
              <span className="text-xs font-bold text-amber-700 block">Approved Leave</span>
              <span className="text-2xl font-black text-amber-900 mt-1 block">78</span>
              <span className="text-[11px] text-amber-600 font-semibold mt-1 block">2% Medical / Pre-approved</span>
            </div>
          </div>
        </div>
      </AdminOverlapModal>

      {/* 3. At Risk Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'atRisk'}
        onClose={() => setActiveModal(null)}
        title="Students with Attendance Below 75%"
        subtitle="Full risk list requiring administrative warning letters & parent meetings"
        icon={AlertTriangle}
        badgeText="112 At-Risk"
        badgeColor="bg-rose-50 text-rose-600 border-rose-200"
      >
        <div className="space-y-3">
          {atRiskStudents.map((s, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 flex justify-between items-center hover:bg-rose-50/30 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-slate-900">{s.student}</h4>
                  <span className="text-[10px] text-slate-500 font-mono">({s.rollNo})</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.batch} • Last Absent: {s.lastAbsent}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-extrabold text-rose-700 bg-rose-100 px-3 py-1 rounded-full border border-rose-200">{s.attendance} Attendance</span>
                <button className="px-3 py-1 bg-rose-600 text-white font-bold text-xs rounded-lg hover:bg-rose-700 transition-colors">Send Alert</button>
              </div>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

      {/* 4. Heatmap Calendar Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'heatmapCalendar'}
        onClose={() => setActiveModal(null)}
        title="Full Institute Attendance Heatmap Calendar"
        subtitle="Monthly day-by-day attendance density map across all 48 batches"
        icon={CalendarDays}
        badgeText="May 2025"
      >
        <div className="space-y-3">
          {heatmapBatches.map((b, idx) => (
            <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-slate-900 block">{b.name}</span>
                <span className="text-[11px] text-slate-500 font-mono">Code: {b.code}</span>
              </div>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">≥ 90% Monthly Density</span>
            </div>
          ))}
        </div>
      </AdminOverlapModal>

    </div>
  );
}
