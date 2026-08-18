'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  institutes, institutesGrowthData, planDistribution,
} from '@/lib/mock-data/super-admin';
import {
  Search, Download, Filter, MoreHorizontal, ShieldAlert,
  TrendingUp, TrendingDown, Building2, Users, GraduationCap,
  DollarSign, AlertTriangle, Activity, ChevronUp, ChevronDown,
  Sparkles, CheckCircle2, AlertCircle, ArrowRight, MapPin, Layers, Award, X, Mail, Phone, ExternalLink, Key,
} from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, AreaChart, Area,
} from 'recharts';

const PLAN_COLORS: Record<string, string> = {
  Enterprise: 'bg-violet-100 text-violet-700 border-violet-200',
  Premium:    'bg-sky-100 text-sky-700 border-sky-200',
  Standard:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  Trial:      'bg-amber-100 text-amber-700 border-amber-200',
};

const STATUS_COLORS: Record<string, string> = {
  Active:    'text-emerald-600 bg-emerald-50 border-emerald-200',
  Trial:     'text-amber-600 bg-amber-50 border-amber-200',
  Inactive:  'text-rose-600 bg-rose-50 border-rose-200',
  Suspended: 'text-rose-700 bg-rose-100 border-rose-300',
};
const STATUS_DOT: Record<string, string> = {
  Active:    'bg-emerald-500',
  Trial:     'bg-amber-500',
  Inactive:  'bg-rose-500',
  Suspended: 'bg-rose-700',
};

const KPI_CARDS = [
  { label: 'Total Institutes',      value: '2,842',     change: '+12.4%', up: true,  icon: Building2,      color: 'indigo'  },
  { label: 'Active Institutes',     value: '2,287',     change: '+15.6%', up: true,  icon: Activity,       color: 'emerald' },
  { label: 'Trial Institutes',      value: '312',       change: '-8.2%',  up: false, icon: AlertTriangle,  color: 'amber'   },
  { label: 'Enterprise Customers',  value: '243',       change: '+18.7%', up: true,  icon: Building2,      color: 'violet'  },
  { label: 'New This Month',        value: '156',       change: '+22.3%', up: true,  icon: TrendingUp,     color: 'sky'     },
  { label: 'Churn Risk',            value: '67',        change: '-3.4%',  up: false, icon: AlertTriangle,  color: 'rose'    },
  { label: 'Avg. Health Score',     value: '78/100',    change: '+6 pts', up: true,  icon: Activity,       color: 'teal'    },
  { label: 'Total Students',        value: '28,45,632', change: '+17.4%', up: true,  icon: GraduationCap,  color: 'blue'    },
  { label: 'Total Teachers',        value: '2,45,870',  change: '+14.8%', up: true,  icon: Users,          color: 'cyan'    },
  { label: 'Avg. Daily Active',     value: '6,78,342',  change: '+19.8%', up: true,  icon: Activity,       color: 'indigo'  },
  { label: 'Platform Adoption',     value: '74%',       change: '+8.2%',  up: true,  icon: TrendingUp,     color: 'emerald' },
  { label: 'Revenue / Institute',   value: '₹17,146',   change: '+13.5%', up: true,  icon: DollarSign,     color: 'violet'  },
];

const GEOGRAPHIC_DATA = [
  { state: 'Rajasthan (Kota/Jaipur)', count: '842', pct: 30, color: 'bg-indigo-500' },
  { state: 'Telangana & AP (Hyd/Vijay)', count: '620', pct: 22, color: 'bg-violet-500' },
  { state: 'Delhi-NCR (Delhi/Noida)', count: '480', pct: 17, color: 'bg-sky-500' },
  { state: 'Uttar Pradesh (Lucknow/Kan)', count: '380', pct: 13, color: 'bg-emerald-500' },
  { state: 'Other States', count: '520', pct: 18, color: 'bg-slate-400' },
];

const TOP_REVENUE_INSTITUTES = [
  { name: 'Allen Career Institute', revenue: '₹48,75,000', growth: '+18%', rank: 1 },
  { name: 'Sri Chaitanya', revenue: '₹41,20,000', growth: '+20%', rank: 2 },
  { name: 'Resonance Delhi', revenue: '₹36,20,000', growth: '+22%', rank: 3 },
  { name: 'FIITJEE Noida', revenue: '₹31,80,000', growth: '+16%', rank: 4 },
  { name: 'Aakash Institute', revenue: '₹21,75,000', growth: '+12%', rank: 5 },
];

export function FounderInstitutes() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [stateFilter, setStateFilter] = useState('All');
  const [examFilter, setExamFilter] = useState('All');
  const [sortKey, setSortKey] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  // Modal State
  const [selectedInst, setSelectedInst] = useState<any | null>(null);
  const [showAddModal, setShowAddModal]   = useState(false);

  const filtered = useMemo(() => {
    let rows = [...institutes];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q) || r.city.toLowerCase().includes(q));
    }
    if (planFilter !== 'All') rows = rows.filter(r => r.plan === planFilter);
    if (statusFilter !== 'All') rows = rows.filter(r => r.status === statusFilter);
    if (stateFilter !== 'All') rows = rows.filter(r => r.state === stateFilter);
    if (examFilter !== 'All') rows = rows.filter(r => r.examType.includes(examFilter));
    rows.sort((a, b) => {
      const av = (a as any)[sortKey] ?? '';
      const bv = (b as any)[sortKey] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [search, planFilter, statusFilter, stateFilter, examFilter, sortKey, sortDir]);

  const pages = Math.ceil(filtered.length / PER_PAGE);
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }: { k: string }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp className={`w-2.5 h-2.5 -mb-1 ${sortKey === k && sortDir === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
    </span>
  );

  const atRisk = institutes.filter(i => i.churnRisk || i.health < 75);

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Institutes"
        subtitle="Manage and monitor all coaching institutes on the platform"
        rightContent={
          <div className="flex items-center gap-2">
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 bg-white shadow-2xs font-medium">
              <option>All Institutes</option>
            </select>
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 bg-white shadow-2xs font-medium">
              <option>May 2025</option><option>Apr 2025</option><option>Mar 2025</option>
            </select>
          </div>
        }
      />

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── KPI Grid (12 High Density Cards) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {KPI_CARDS.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-3.5 hover:shadow-md hover:border-slate-300 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-medium text-slate-500 leading-tight">{k.label}</span>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center bg-${k.color}-50 shrink-0`}>
                    <Icon className={`w-3.5 h-3.5 text-${k.color}-600`} />
                  </div>
                </div>
                <p className="text-[18px] font-bold text-slate-800 leading-none">{k.value}</p>
                <span className={`flex items-center gap-0.5 text-[11px] font-semibold mt-1.5 ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {k.change}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── FULL WIDTH INSTITUTES TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search Institute by name, owner or city..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white font-medium shadow-2xs"
                />
              </div>

              {/* Filters */}
              <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Plan: All</option>
                <option value="Enterprise">Enterprise</option>
                <option value="Premium">Premium</option>
                <option value="Standard">Standard</option>
                <option value="Trial">Trial</option>
              </select>

              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Status: All</option>
                <option value="Active">Active</option>
                <option value="Trial">Trial</option>
                <option value="Inactive">Inactive</option>
              </select>

              <select value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">State: All</option>
                <option value="Rajasthan">Rajasthan</option>
                <option value="Delhi">Delhi</option>
                <option value="UP">UP</option>
                <option value="Bihar">Bihar</option>
                <option value="Telangana">Telangana</option>
              </select>

              <select value={examFilter} onChange={e => { setExamFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Exam: All</option>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="Foundation">Foundation</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
                <Download className="w-3.5 h-3.5 text-slate-500" /> Export
              </button>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                + Add Institute
              </button>
            </div>
          </div>

          {/* Full Width Table Container */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  {[
                    { key: 'name', label: 'Institute' },
                    { key: 'owner', label: 'Owner' },
                    { key: 'city', label: 'Location' },
                    { key: 'plan', label: 'Plan', center: true },
                    { key: 'students', label: 'Students', right: true },
                    { key: 'teachers', label: 'Teachers', right: true },
                    { key: 'revenue', label: 'Revenue', right: true },
                    { key: 'health', label: 'Health Score', center: true },
                    { key: 'status', label: 'Status', center: true },
                    { key: 'renewal', label: 'Renewal Date', right: true },
                    { key: 'lastLogin', label: 'Last Active', right: true },
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
                  <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-[13px]">No institutes found matching filters</td></tr>
                )}
                {pageRows.map(row => (
                  <tr key={row.id} onClick={() => setSelectedInst(row)} className="hover:bg-indigo-50/20 transition-colors cursor-pointer group">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs">
                          {row.avatar}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-[12.5px] whitespace-nowrap group-hover:text-indigo-600 transition-colors">{row.name}</p>
                          <p className="text-[10px] font-medium text-slate-400">{row.examType}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-slate-700 font-medium whitespace-nowrap">{row.owner}</td>
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap text-[11.5px]">{row.city}, <span className="text-slate-400">{row.state}</span></td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${PLAN_COLORS[row.plan] ?? ''}`}>{row.plan}</span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-semibold text-slate-800">{row.students}</td>
                    <td className="px-3.5 py-3 text-right font-medium text-slate-600">{row.teachers}</td>
                    <td className="px-3.5 py-3 text-right font-bold text-slate-800">{row.revenue}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${row.health >= 90 ? 'bg-emerald-50 text-emerald-700' : row.health >= 80 ? 'bg-indigo-50 text-indigo-700' : row.health >= 70 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        {row.health}/100
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_COLORS[row.status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[row.status]}`} />{row.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right text-slate-500 whitespace-nowrap text-[11px] font-medium">{row.renewal}</td>
                    <td className="px-3.5 py-3 text-right text-slate-400 whitespace-nowrap text-[11px]">{row.lastLogin}</td>
                    <td className="px-3.5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedInst(row); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
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
            <span className="font-medium">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} institutes</span>
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

        {/* ── INSIGHTS & ANALYTICS PANELS (BELOW THE TABLE) ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Institute Intelligence & Analytics
              </h3>
              <p className="text-[12px] text-slate-500">Deep platform insights, regional distribution, top revenue generators, and AI action items</p>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">Live Diagnostics</span>
          </div>

          {/* ── ROW 1: 4 ANALYTICS CARDS (Growth, Geographic, Plan Dist, Top Revenue) ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            
            {/* 1. Institute Growth Trend */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Institute Growth Trend</p>
                  <p className="text-[10px] text-slate-400">Monthly new institute onboarding</p>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  2,842 Total
                </span>
              </div>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={institutesGrowthData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Area type="monotone" dataKey="institutes" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#growthGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">MoM Growth Rate</span>
                <span className="font-bold text-emerald-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" /> +12.4%</span>
              </div>
            </div>

            {/* 2. Geographic Distribution */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Geographic Distribution</p>
                  <p className="text-[10px] text-slate-400">Top states by institute presence</p>
                </div>
                <MapPin className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="space-y-2.5">
                {GEOGRAPHIC_DATA.map(g => (
                  <div key={g.state} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-medium text-slate-700 truncate max-w-[180px]">{g.state}</span>
                      <span className="font-bold text-slate-800">{g.count} <span className="text-[9.5px] font-normal text-slate-400">({g.pct}%)</span></span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full ${g.color} rounded-full`} style={{ width: `${g.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Plan Distribution */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Plan Distribution</p>
                  <p className="text-[10px] text-slate-400">Subscribed plan breakdown</p>
                </div>
                <Layers className="w-4 h-4 text-violet-500" />
              </div>
              <div className="flex items-center gap-4 my-auto">
                <div className="relative shrink-0">
                  <PieChart width={90} height={90}>
                    <Pie data={planDistribution} cx={41} cy={41} innerRadius={28} outerRadius={41} dataKey="value" strokeWidth={0}>
                      {planDistribution.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[11px] font-bold text-slate-800 leading-none">2,842</span>
                    <span className="text-[8px] text-slate-400 uppercase">Total</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {planDistribution.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
                        <span className="text-slate-600 font-medium">{p.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{p.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Top Revenue Institutes */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Top Revenue Institutes</p>
                  <p className="text-[10px] text-slate-400">Highest grossing platforms</p>
                </div>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <div className="space-y-2">
                {TOP_REVENUE_INSTITUTES.map((inst) => (
                  <div key={inst.rank} className="flex items-center justify-between text-[11px] p-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 font-bold text-[9px] flex items-center justify-center shrink-0">{inst.rank}</span>
                      <span className="font-semibold text-slate-700 truncate max-w-[130px]">{inst.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-800 block leading-tight">{inst.revenue}</span>
                      <span className="text-[9.5px] font-semibold text-emerald-600">{inst.growth}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── ROW 2: 3 INTELLIGENCE & RISK PANELS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 1. Top Growing Institutes */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <p className="text-[13px] font-bold text-slate-800">Top Growing Institutes</p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">High MoM</span>
              </div>
              <div className="space-y-3">
                {institutes.slice(0, 4).map((inst, i) => (
                  <div key={i} onClick={() => setSelectedInst(inst)} className="flex items-center justify-between p-2 rounded-lg bg-slate-50/70 border border-slate-100 hover:bg-slate-100/80 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                        {inst.avatar}
                      </div>
                      <div>
                        <p className="text-[11.5px] font-bold text-slate-800 leading-tight">{inst.name}</p>
                        <p className="text-[10px] text-slate-400">{inst.students} Students</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                      {inst.profit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. At Risk & Status Monitor */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <p className="text-[13px] font-bold text-slate-800">At Risk Institutes</p>
                </div>
                <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Action Needed</span>
              </div>
              
              <div className="space-y-2 mb-3">
                {atRisk.slice(0, 3).map((inst, i) => (
                  <div key={i} onClick={() => setSelectedInst(inst)} className="flex items-center justify-between p-2 rounded-lg bg-rose-50/40 border border-rose-100 cursor-pointer hover:bg-rose-100/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-rose-100 text-rose-700 font-bold text-[9px] flex items-center justify-center shrink-0">{inst.avatar}</div>
                      <span className="text-[11px] font-bold text-slate-800 truncate max-w-[130px]">{inst.name}</span>
                    </div>
                    <span className="text-[9.5px] font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full">
                      High Risk ({inst.health} Score)
                    </span>
                  </div>
                ))}
              </div>

              {/* Status Badges Grid */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100 text-[10.5px]">
                  <span className="text-slate-600 font-medium">Inactive Inst.</span>
                  <span className="font-bold text-slate-800">126</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-amber-50/50 rounded border border-amber-100 text-[10.5px]">
                  <span className="text-amber-700 font-medium">Trial Ending</span>
                  <span className="font-bold text-amber-800">34</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-sky-50/50 rounded border border-sky-100 text-[10.5px]">
                  <span className="text-sky-700 font-medium">Pending KYC</span>
                  <span className="font-bold text-sky-800">26</span>
                </div>
                <div className="flex items-center justify-between p-1.5 bg-rose-50/50 rounded border border-rose-100 text-[10.5px]">
                  <span className="text-rose-700 font-medium">Pending Pay.</span>
                  <span className="font-bold text-rose-800">18</span>
                </div>
              </div>
            </div>

            {/* 3. AI Suggested Follow-ups */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-md p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <p className="text-[13px] font-bold text-white">AI Suggested Follow-ups</p>
                  </div>
                  <span className="text-[9.5px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">Auto AI</span>
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">Reach out to 67 at-risk institutes experiencing dropped attendance.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">32 trials likely to convert to Enterprise plan in next 7 days.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">14 payment renewals overdue by more than 15 days.</span>
                  </div>
                </div>
              </div>

              <button className="mt-3 w-full py-2 text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 rounded-lg border border-indigo-500/40 flex items-center justify-center gap-1.5 transition-colors">
                View All Insights <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: INSTITUTE INSPECTOR ── */}
      {selectedInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {selectedInst.avatar}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedInst.name}</h3>
                  <p className="text-[11px] text-slate-400">{selectedInst.city}, {selectedInst.state} • {selectedInst.examType}</p>
                </div>
              </div>
              <button onClick={() => setSelectedInst(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 bg-slate-50/50 text-[12px]">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Plan Tier</span>
                  <strong className={`text-[12px] ${PLAN_COLORS[selectedInst.plan]}`}>{selectedInst.plan}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Status</span>
                  <strong className="text-emerald-600">{selectedInst.status}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Health Score</span>
                  <strong className="text-indigo-600">{selectedInst.health}/100</strong>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-800 text-[13px] border-b border-slate-100 pb-2">Administrative Profile</h4>
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <div><span className="text-slate-400 block text-[10px]">Owner / Director</span><strong className="text-slate-800">{selectedInst.owner}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Contract Revenue</span><strong className="text-slate-800">{selectedInst.revenue}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Total Enrolled Students</span><strong className="text-slate-800">{selectedInst.students}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Teaching Staff</span><strong className="text-slate-800">{selectedInst.teachers}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Renewal Due Date</span><strong className="text-slate-800">{selectedInst.renewal}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Last Admin Login</span><strong className="text-slate-800">{selectedInst.lastLogin}</strong></div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button className="px-4 py-2 border border-slate-200 text-rose-600 font-bold text-[11px] rounded-xl hover:bg-rose-50">Suspend Access</button>
              <button onClick={() => setSelectedInst(null)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Profile</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD: ADD INSTITUTE ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-800">+ Onboard New Institute</h3>
              <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 bg-slate-50/50 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institute Name</label>
                <input placeholder="e.g. Vibrant Academy Kota" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Director Name</label>
                  <input placeholder="Owner Name" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City / Location</label>
                  <input placeholder="Kota, Rajasthan" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Plan Tier</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500">
                    <option>Enterprise</option><option>Premium</option><option>Standard</option><option>Trial</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Exam Type</label>
                  <input placeholder="JEE & NEET" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-[11px] rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={() => setShowAddModal(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Provision Institute</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
