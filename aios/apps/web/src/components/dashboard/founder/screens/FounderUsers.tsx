'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import { users, dauData } from '@/lib/mock-data/super-admin';
import {
  Search, Download, MoreHorizontal, Users as UsersIcon,
  GraduationCap, Briefcase, UserCheck, UserX, TrendingUp, TrendingDown,
  ChevronUp, ChevronDown, Shield, Activity, Cpu, Sparkles, AlertTriangle,
  Smartphone, Monitor, Tablet, ArrowRight, CheckCircle2, ShieldAlert, Clock, X, Lock, Key, Mail,
} from 'lucide-react';
import {
  LineChart as RechartsLineChart, Line as RechartsLine, BarChart as RechartsBarChart, Bar as RechartsBar, PieChart as RechartsPieChart, Pie as RechartsPie, Cell as RechartsCell,
  XAxis as RechartsXAxis, YAxis as RechartsYAxis, CartesianGrid as RechartsCartesianGrid, ResponsiveContainer as RechartsResponsiveContainer, Tooltip as RechartsTooltip,
} from 'recharts';

const ROLE_COLORS: Record<string, string> = {
  'Institute Owner': 'bg-violet-100 text-violet-700 border-violet-200',
  'Admin':           'bg-sky-100 text-sky-700 border-sky-200',
  'Teacher':         'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Student':         'bg-indigo-100 text-indigo-700 border-indigo-200',
  'Parent':          'bg-pink-100 text-pink-700 border-pink-200',
  'Support':         'bg-slate-100 text-slate-700 border-slate-200',
};

const KPI_CARDS = [
  { label: 'Total Users',       value: '45,68,932', change: '+18.6%', up: true,  color: 'indigo'  },
  { label: 'Active Users',      value: '28,74,512', change: '+21.4%', up: true,  color: 'emerald' },
  { label: 'New Users Today',   value: '8,742',     change: '+12.8%', up: true,  color: 'sky'     },
  { label: 'Teachers',          value: '2,45,870',  change: '+17.2%', up: true,  color: 'teal'    },
  { label: 'Students',          value: '38,54,632', change: '+18.7%', up: true,  color: 'blue'    },
  { label: 'Parents',           value: '3,21,456',  change: '+16.3%', up: true,  color: 'pink'    },
  { label: 'Dormant Users',     value: '1,24,816',  change: '-6.2%',  up: false, color: 'rose'    },
  { label: 'Blocked Users',     value: '3,421',     change: '-2.1%',  up: false, color: 'rose'    },
  { label: 'Verified Users',    value: '41,23,890', change: '+22.1%', up: true,  color: 'violet'  },
  { label: 'Avg. Session Time', value: '18m 42s',   change: '+6.5%',  up: true,  color: 'amber'   },
];

const ROLE_PIE = [
  { name: 'Students', value: 84.5, fill: '#6366f1' },
  { name: 'Teachers', value: 8.2,  fill: '#10b981' },
  { name: 'Parents',  value: 4.1,  fill: '#f59e0b' },
  { name: 'Admins',   value: 2.1,  fill: '#0ea5e9' },
  { name: 'Others',   value: 1.1,  fill: '#94a3b8' },
];

const DEVICE_PIE = [
  { name: 'Mobile',  value: 68, fill: '#3b82f6', icon: Smartphone },
  { name: 'Desktop', value: 27, fill: '#8b5cf6', icon: Monitor },
  { name: 'Tablet',  value: 5,  fill: '#ec4899', icon: Tablet },
];

const ENGAGEMENT_DATA = [
  { level: 'High', pct: 58, fill: '#10b981' },
  { level: 'Medium', pct: 30, fill: '#f59e0b' },
  { level: 'Low', pct: 20, fill: '#3b82f6' },
];

const FEATURE_ADOPTION = [
  { feature: 'Assessments', intensity: ['high', 'high', 'high', 'med', 'high'] },
  { feature: 'Assignments', intensity: ['high', 'high', 'med', 'high', 'high'] },
  { feature: 'Attendance', intensity: ['high', 'med', 'high', 'high', 'med'] },
  { feature: 'Communication', intensity: ['med', 'high', 'high', 'med', 'low'] },
  { feature: 'Analytics', intensity: ['high', 'med', 'med', 'low', 'med'] },
  { feature: 'AI Reports', intensity: ['med', 'high', 'med', 'low', 'low'] },
  { feature: 'Question Bank', intensity: ['high', 'high', 'high', 'med', 'low'] },
  { feature: 'Timetable', intensity: ['med', 'high', 'low', 'low', 'low'] },
];

const RECENTLY_REGISTERED = [
  { name: 'Rohan Mehta', role: 'Student', time: '10:02 AM', avatar: 'RM' },
  { name: 'Sneha Joshi', role: 'Teacher', time: '09:45 AM', avatar: 'SJ' },
  { name: 'Devansh Rai', role: 'Student', time: '09:31 AM', avatar: 'DR' },
  { name: 'Kavya Nair', role: 'Parent', time: '09:21 AM', avatar: 'KN' },
];



export function FounderUsers() {
  const [search, setSearch]             = useState('');
  const [roleFilter, setRoleFilter]     = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [vFilter, setVFilter]           = useState('All');
  const [instFilter, setInstFilter]     = useState('All');
  const [sortKey, setSortKey]           = useState('name');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('asc');
  const [page, setPage]                 = useState(1);
  const PER_PAGE = 8;

  // Modals
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [showAddUser, setShowAddUser]   = useState(false);

  const filtered = useMemo(() => {
    let rows = [...users];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.institute.toLowerCase().includes(q));
    }
    if (roleFilter !== 'All') rows = rows.filter(r => r.role === roleFilter);
    if (statusFilter !== 'All') rows = rows.filter(r => r.status === statusFilter);
    if (vFilter !== 'All') rows = rows.filter(r => r.verification === vFilter);
    if (instFilter !== 'All') rows = rows.filter(r => r.institute.includes(instFilter));
    rows.sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''; const bv = (b as any)[sortKey] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [search, roleFilter, statusFilter, vFilter, instFilter, sortKey, sortDir]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const toggleSort = (k: string) => { if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(k); setSortDir('asc'); } };

  const SortIcon = ({ k }: { k: string }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp className={`w-2.5 h-2.5 -mb-1 ${sortKey === k && sortDir === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
    </span>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Users"
        subtitle="Manage all platform users across institutes"
        rightContent={
          <div className="flex items-center gap-2">
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>All Roles</option><option>Institute Owner</option><option>Admin</option><option>Teacher</option><option>Student</option>
            </select>
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>May 2025</option><option>Apr 2025</option>
            </select>
          </div>
        }
      />

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── KPI GRID (10 High Density Cards) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {KPI_CARDS.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-3.5 hover:shadow-md hover:border-slate-300 transition-all">
              <p className="text-[11px] font-medium text-slate-500 mb-1.5 leading-tight">{k.label}</p>
              <p className="text-[18px] font-bold text-slate-800 leading-none">{k.value}</p>
              <span className={`flex items-center gap-0.5 text-[10.5px] font-semibold mt-1.5 ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{k.change}
              </span>
            </div>
          ))}
        </div>

        {/* ── FULL WIDTH USER TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by name, email or institute..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white font-medium shadow-2xs" />
              </div>

              {/* Filters */}
              <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Role: All</option>
                <option value="Institute Owner">Institute Owner</option>
                <option value="Admin">Admin</option>
                <option value="Teacher">Teacher</option>
                <option value="Student">Student</option>
                <option value="Parent">Parent</option>
              </select>

              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Status: All</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blocked">Blocked</option>
              </select>

              <select value={vFilter} onChange={e => { setVFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Verification: All</option>
                <option value="Verified">Verified</option>
                <option value="Pending">Pending</option>
              </select>

              <select value={instFilter} onChange={e => { setInstFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Institute: All</option>
                <option value="Allen">Allen</option>
                <option value="Resonance">Resonance</option>
                <option value="FIITJEE">FIITJEE</option>
                <option value="Aakash">Aakash</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
                <Download className="w-3.5 h-3.5 text-slate-500" /> Export
              </button>
              <button onClick={() => setShowAddUser(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                + Add User
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  {[
                    { key: 'name', label: 'User' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role', center: true },
                    { key: 'institute', label: 'Institute' },
                    { key: 'location', label: 'Branch / Location' },
                    { key: 'status', label: 'Status', center: true },
                    { key: 'activity', label: 'Activity', center: true },
                    { key: 'verification', label: 'Verified', center: true },
                    { key: 'lastLogin', label: 'Last Login', right: true },
                    { key: 'sessions', label: 'Sessions', right: true },
                    { key: 'usage', label: 'Usage', center: true },
                  ].map(col => (
                    <th key={col.key} onClick={() => toggleSort(col.key)}
                      className={`px-3.5 py-3 font-semibold cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap text-slate-600 ${col.right ? 'text-right' : col.center ? 'text-center' : ''}`}>
                      <span className="inline-flex items-center">{col.label}<SortIcon k={col.key} /></span>
                    </th>
                  ))}
                  <th className="px-3.5 py-3 font-semibold text-center text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-[13px]">No users found matching filters</td></tr>
                )}
                {pageRows.map(row => (
                  <tr key={row.id} onClick={() => setSelectedUser(row)} className="hover:bg-indigo-50/20 transition-colors cursor-pointer group">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-[10.5px] shrink-0 shadow-2xs">
                          {row.avatar}
                        </div>
                        <span className="font-bold text-slate-800 text-[12.5px] whitespace-nowrap group-hover:text-indigo-600 transition-colors">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-500 text-[11.5px] font-medium">{row.email}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${ROLE_COLORS[row.role] ?? 'bg-slate-100 text-slate-700'}`}>{row.role}</span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-700 font-medium whitespace-nowrap">{row.institute}</td>
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap text-[11.5px]">{row.location}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${row.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : row.status === 'Blocked' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${row.activity === 'Online' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${row.activity === 'Online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />{row.activity}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      {row.verification === 'Verified'
                        ? <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold border border-emerald-100">✓ Verified</span>
                        : <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold border border-amber-100">Pending</span>
                      }
                    </td>
                    <td className="px-3.5 py-3 text-right text-slate-500 text-[11px] whitespace-nowrap font-medium">{row.lastLogin}</td>
                    <td className="px-3.5 py-3 text-right font-semibold text-slate-800">{row.sessions}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${row.usage === 'High' ? 'bg-emerald-50 text-emerald-700' : row.usage === 'Medium' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{row.usage}</span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedUser(row); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[12px] text-slate-500">
            <span className="font-medium">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} users</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 font-medium transition-colors">‹ Prev</button>
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} onClick={() => setPage(i + 1)}
                  className={`px-2.5 py-1 rounded border font-semibold text-[11px] transition-colors ${page === i + 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'}`}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40 hover:bg-slate-50 font-medium transition-colors">Next ›</button>
            </div>
          </div>
        </div>

        {/* ── INSIGHTS & USER INTELLIGENCE PANELS (BELOW THE TABLE) ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> User Intelligence & Behavioral Analytics
              </h3>
              <p className="text-[12px] text-slate-500">Daily activity trends, role distribution, device usage, engagement stats, and security monitoring</p>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">Live Telemetry</span>
          </div>

          {/* ── ROW 1: 3 ANALYTICS CARDS (DAU, Role Dist, Device Usage) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 1. Daily Active Users */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Daily Active Users</p>
                  <p className="text-[10px] text-slate-400">7-Day DAU trend</p>
                </div>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                  28.74K
                </span>
              </div>
              <div className="h-[140px] w-full">
                <RechartsResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={dauData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <RechartsXAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsYAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <RechartsLine type="monotone" dataKey="dau" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3, fill: '#3b82f6' }} />
                  </RechartsLineChart>
                </RechartsResponsiveContainer>
              </div>
            </div>

            {/* 2. Role Distribution */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Role Distribution</p>
                  <p className="text-[10px] text-slate-400">User composition ratio</p>
                </div>
                <UsersIcon className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="flex items-center gap-4 my-auto">
                <div className="relative shrink-0">
                  <RechartsPieChart width={90} height={90}>
                    <RechartsPie data={ROLE_PIE} cx={41} cy={41} innerRadius={28} outerRadius={41} dataKey="value" strokeWidth={0}>
                      {ROLE_PIE.map((e, i) => <RechartsCell key={i} fill={e.fill} />)}
                    </RechartsPie>
                  </RechartsPieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[11px] font-bold text-slate-800 leading-none">45.6L</span>
                    <span className="text-[8px] text-slate-400 uppercase">Total</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {ROLE_PIE.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
                        <span className="text-slate-600 font-medium">{p.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{p.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Device Usage */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Device Usage</p>
                  <p className="text-[10px] text-slate-400">Platform access devices</p>
                </div>
                <Smartphone className="w-4 h-4 text-sky-500" />
              </div>
              <div className="space-y-2.5 my-auto">
                {DEVICE_PIE.map(d => {
                  const Icon = d.icon;
                  return (
                    <div key={d.name}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-600 font-medium flex items-center gap-1">
                          <Icon className="w-3.5 h-3.5 text-slate-400" /> {d.name}
                        </span>
                        <span className="font-bold text-slate-800">{d.value}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.value}%`, background: d.fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* ── ROW 2: 2 ANALYTICS CARDS (User Engagement, Feature Adoption) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 4. User Engagement (This Week) */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">User Engagement</p>
                  <p className="text-[10px] text-slate-400">Activity tier classification (This Week)</p>
                </div>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="h-[140px] w-full">
                <RechartsResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={ENGAGEMENT_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <RechartsCartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <RechartsXAxis dataKey="level" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsYAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <RechartsBar dataKey="pct" name="Engagement %" radius={[4, 4, 0, 0]} barSize={28}>
                      {ENGAGEMENT_DATA.map((e, i) => <RechartsCell key={i} fill={e.fill} />)}
                    </RechartsBar>
                  </RechartsBarChart>
                </RechartsResponsiveContainer>
              </div>
            </div>

            {/* 5. Feature Adoption Heatmap */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Feature Adoption Heatmap</p>
                  <p className="text-[10px] text-slate-400">Module usage intensity matrix</p>
                </div>
                <span className="text-[9.5px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">High Use</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 my-auto">
                {FEATURE_ADOPTION.map((fa, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px] p-1 bg-slate-50/50 rounded border border-slate-100">
                    <span className="text-slate-700 font-medium truncate max-w-[120px]">{fa.feature}</span>
                    <div className="flex gap-1">
                      {fa.intensity.map((int, idx) => (
                        <span key={idx} className={`w-3 h-3 rounded-[2px] ${int === 'high' ? 'bg-emerald-500' : int === 'med' ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── ROW 2: 3 USER SECURITY & INTELLIGENCE PANELS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 1. Recently Registered Users */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  <p className="text-[13px] font-bold text-slate-800">Recently Registered</p>
                </div>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">New Today</span>
              </div>
              <div className="space-y-2.5">
                {RECENTLY_REGISTERED.map((usr, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white flex items-center justify-center font-bold text-[9.5px] shrink-0">
                        {usr.avatar}
                      </div>
                      <div>
                        <p className="text-[11.5px] font-bold text-slate-800 leading-tight">{usr.name}</p>
                        <p className="text-[10px] text-slate-400">{usr.role}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {usr.time}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. User Security Diagnostics */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <p className="text-[13px] font-bold text-slate-800">Security & Status Alerts</p>
                </div>
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Action Needed</span>
              </div>

              <div className="space-y-2.5">
                {[
                  { label: 'Suspicious Accounts Detected', val: '12', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
                  { label: 'Inactive Users (Dormant 30d+)', val: '1,24,816', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                  { label: 'Blocked User Accounts', val: '3,421', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' },
                  { label: 'High Engagement Power Users', val: '842', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                ].map((item) => (
                  <div key={item.label} className={`flex items-center justify-between p-2.5 rounded-lg ${item.bg} border ${item.border}`}>
                    <span className="text-[11.5px] font-semibold text-slate-700">{item.label}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white ${item.color} shadow-2xs`}>{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. AI Behavioral Insights & Security Follow-ups */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-md p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <p className="text-[13px] font-bold text-white">AI User Insights</p>
                  </div>
                  <span className="text-[9.5px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">AI Guardian</span>
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">12 suspicious login attempts detected from unrecognized IP ranges.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">847 failed password reset attempts recorded in the last 24 hours.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">1.2L dormant student accounts eligible for automated re-engagement SMS.</span>
                  </div>
                </div>
              </div>

              <button className="mt-3 w-full py-2 text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 rounded-lg border border-indigo-500/40 flex items-center justify-center gap-1.5 transition-colors">
                View All Security Insights <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: USER INSPECTOR ── */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {selectedUser.avatar}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedUser.name}</h3>
                  <p className="text-[11px] text-slate-400">{selectedUser.email} • {selectedUser.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50/50 text-[12px]">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Role</span>
                  <strong className={`text-[11px] ${ROLE_COLORS[selectedUser.role]}`}>{selectedUser.role}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Status</span>
                  <strong className="text-emerald-600">{selectedUser.status}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Verification</span>
                  <strong className="text-indigo-600">{selectedUser.verification}</strong>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-800 text-[13px] border-b border-slate-100 pb-2">Account Telemetry</h4>
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <div><span className="text-slate-400 block text-[10px]">Institute Affiliation</span><strong className="text-slate-800">{selectedUser.institute}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Branch / Location</span><strong className="text-slate-800">{selectedUser.location}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Total Logged Sessions</span><strong className="text-slate-800">{selectedUser.sessions}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Usage Intensity</span><strong className="text-slate-800">{selectedUser.usage}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Last Login Time</span><strong className="text-slate-800">{selectedUser.lastLogin}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Current Activity</span><strong className="text-emerald-600">{selectedUser.activity}</strong></div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button className="px-4 py-2 border border-slate-200 text-rose-600 font-bold text-[11px] rounded-xl hover:bg-rose-50">Block Account</button>
              <button onClick={() => setSelectedUser(null)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD: ADD USER ── */}
      {showAddUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-800">+ Provision System User</h3>
              <button onClick={() => setShowAddUser(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 bg-slate-50/50 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input placeholder="e.g. Dr. Rajesh Sharma" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input placeholder="rajesh@allen.ac.in" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Role</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500">
                    <option>Teacher</option><option>Institute Owner</option><option>Admin</option><option>Student</option><option>Parent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Institute</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500">
                    <option>Allen Career Institute</option><option>Sri Chaitanya</option><option>Resonance</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setShowAddUser(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-[11px] rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={() => setShowAddUser(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Create Account</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
