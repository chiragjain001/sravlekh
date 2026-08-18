'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import { subscriptions, revenueData, revenueByPlan, churnData } from '@/lib/mock-data/super-admin';
import {
  Search, Download, MoreHorizontal, DollarSign,
  TrendingUp, TrendingDown, ChevronUp, ChevronDown, ArrowRight,
  CreditCard, ShieldAlert, Sparkles, PieChart as PieIcon, MapPin,
  Calendar, Layers, CheckCircle2, AlertTriangle, RefreshCw, X, FileText, Check,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';

const KPI_CARDS = [
  { label: 'Monthly Revenue',  value: '₹1.48 Cr',  change: '+21.6%', up: true,  color: 'violet'  },
  { label: 'Annual Revenue',   value: '₹17.62 Cr', change: '+34.8%', up: true,  color: 'indigo'  },
  { label: 'MRR',              value: '₹1.48 Cr',  change: '+21.6%', up: true,  color: 'emerald' },
  { label: 'ARR',              value: '₹17.62 Cr', change: '+24.8%', up: true,  color: 'sky'     },
  { label: 'Renewals',         value: '243',        change: '+18.7%', up: true,  color: 'blue'    },
  { label: 'Expired Plans',    value: '32',         change: '-12.2%', up: false, color: 'rose'    },
  { label: 'Trial Plans',      value: '312',        change: '+8.2%',  up: true,  color: 'amber'   },
  { label: 'Conversion Rate',  value: '24.6%',      change: '+4.3%',  up: true,  color: 'teal'    },
  { label: 'ARPU',             value: '₹17,146',    change: '+13.5%', up: true,  color: 'indigo'  },
  { label: 'Lifetime Value',   value: '₹2.14L',     change: '+15.7%', up: true,  color: 'violet'  },
  { label: 'Outstanding',      value: '₹28.45L',    change: '-5.2%',  up: false, color: 'rose'    },
  { label: 'Collection Rate',  value: '93.2%',      change: '+3.6%',  up: true,  color: 'emerald' },
];

const STATUS_STYLES: Record<string, string> = {
  Paid:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  Overdue: 'bg-rose-50 text-rose-700 border-rose-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Free:    'bg-slate-100 text-slate-500 border-slate-200',
};

const PLAN_COLORS: Record<string, string> = {
  Enterprise: 'text-violet-600 font-bold',
  Premium:    'text-sky-600 font-bold',
  Standard:   'text-emerald-600 font-bold',
  Trial:      'text-amber-600 font-bold',
};

const REVENUE_BY_PLAN_FULL = [
  { name: 'Enterprise', pct: 48, val: '₹8.45 Cr', fill: '#8b5cf6' },
  { name: 'Premium',    pct: 28, val: '₹4.93 Cr', fill: '#0ea5e9' },
  { name: 'Standard',   pct: 16, val: '₹2.81 Cr', fill: '#10b981' },
  { name: 'Basic',      pct: 6,  val: '₹1.05 Cr', fill: '#f59e0b' },
  { name: 'Trial',      pct: 2,  val: '₹0.38 Cr', fill: '#ef4444' },
];

const REGIONAL_REVENUE = [
  { state: 'Maharashtra', rev: '₹4.82 Cr', pct: 27, color: 'bg-indigo-500' },
  { state: 'Delhi NCR', rev: '₹3.95 Cr', pct: 22, color: 'bg-violet-500' },
  { state: 'Rajasthan (Kota)', rev: '₹3.42 Cr', pct: 19, color: 'bg-sky-500' },
  { state: 'Telangana', rev: '₹2.85 Cr', pct: 16, color: 'bg-emerald-500' },
  { state: 'Karnataka', rev: '₹2.58 Cr', pct: 16, color: 'bg-amber-500' },
];

export function FounderSubscriptions() {
  const [search, setSearch]             = useState('');
  const [planFilter, setPlanFilter]     = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cycleFilter, setCycleFilter]   = useState('All');
  const [sortKey, setSortKey]           = useState('institute');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('asc');
  const [page, setPage]                 = useState(1);
  const PER_PAGE = 8;

  // Modals
  const [selectedSub, setSelectedSub]   = useState<any | null>(null);
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);

  const filtered = useMemo(() => {
    let rows = [...subscriptions];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.institute.toLowerCase().includes(q) || r.invoice.toLowerCase().includes(q));
    }
    if (planFilter !== 'All') rows = rows.filter(r => r.plan === planFilter);
    if (statusFilter !== 'All') rows = rows.filter(r => r.status === statusFilter);
    if (cycleFilter !== 'All') rows = rows.filter(r => r.billing === cycleFilter);
    rows.sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''; const bv = (b as any)[sortKey] ?? '';
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return rows;
  }, [search, planFilter, statusFilter, cycleFilter, sortKey, sortDir]);

  const pages    = Math.ceil(filtered.length / PER_PAGE);
  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (k: string) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  };
  const SortIcon = ({ k }: { k: string }) => (
    <span className="ml-1 inline-flex flex-col">
      <ChevronUp className={`w-2.5 h-2.5 -mb-1 ${sortKey === k && sortDir === 'asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
    </span>
  );

  // SVG Gauge for payment success rate
  const successRate = 93.2;
  const circumference = 2 * Math.PI * 38;
  const dashOffset = circumference * (1 - successRate / 100);

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Subscriptions"
        subtitle="Manage subscriptions, billing and revenue operations"
        rightContent={
          <div className="flex items-center gap-2">
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>May 2025</option><option>Apr 2025</option><option>Q1 2025</option>
            </select>
          </div>
        }
      />

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── KPI GRID (12 High Density Cards) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
          {KPI_CARDS.map(k => (
            <div key={k.label} className={`bg-white rounded-xl border shadow-2xs p-3.5 hover:shadow-md hover:border-slate-300 transition-all ${k.label === 'Outstanding' ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/80'}`}>
              <p className="text-[11px] font-medium text-slate-500 mb-1 leading-tight">{k.label}</p>
              <p className="text-[17px] font-bold text-slate-800 leading-none">{k.value}</p>
              <span className={`flex items-center gap-0.5 text-[10.5px] font-semibold mt-1.5 ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {k.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{k.change}
              </span>
            </div>
          ))}
        </div>

        {/* ── FULL WIDTH SUBSCRIPTIONS TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative min-w-[220px] max-w-sm flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search Institute or invoice number..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 bg-white font-medium shadow-2xs" />
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
                <option value="All">Payment Status: All</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Pending">Pending</option>
                <option value="Free">Free</option>
              </select>

              <select value={cycleFilter} onChange={e => { setCycleFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Billing: All</option>
                <option value="Annual">Annual</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
                <Download className="w-3.5 h-3.5 text-slate-500" /> Export
              </button>
              <button onClick={() => setShowCreateInvoice(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                + Create Invoice
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  {[
                    { key: 'institute', label: 'Institute' },
                    { key: 'plan', label: 'Plan', center: true },
                    { key: 'seats', label: 'Seats', right: true },
                    { key: 'storage', label: 'Storage', right: true },
                    { key: 'price', label: 'Contract Price', right: true },
                    { key: 'renewal', label: 'Renewal Date', right: true },
                    { key: 'billing', label: 'Billing Cycle' },
                    { key: 'status', label: 'Payment Status', center: true },
                    { key: 'autoRenewal', label: 'Auto-Renew', center: true },
                    { key: 'invoice', label: 'Last Invoice' },
                    { key: 'outstanding', label: 'Outstanding', right: true },
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
                  <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-[13px]">No subscriptions found matching filters</td></tr>
                )}
                {pageRows.map(row => (
                  <tr key={row.id} onClick={() => setSelectedSub(row)} className="hover:bg-indigo-50/20 transition-colors cursor-pointer group">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                          {row.institute.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-800 text-[12.5px] whitespace-nowrap group-hover:text-indigo-600 transition-colors">{row.institute}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[11px] ${PLAN_COLORS[row.plan]}`}>{row.plan}</span>
                    </td>
                    <td className="px-3.5 py-3 text-right font-medium text-slate-700">{row.seats}</td>
                    <td className="px-3.5 py-3 text-right text-slate-500">{row.storage}</td>
                    <td className="px-3.5 py-3 text-right font-bold text-slate-800">{row.price}</td>
                    <td className="px-3.5 py-3 text-right text-slate-500 whitespace-nowrap font-medium text-[11px]">{row.renewal}</td>
                    <td className="px-3.5 py-3 text-slate-600 font-medium">{row.billing}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[row.status] ?? ''}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10.5px] font-bold ${row.autoRenewal === 'ON' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {row.autoRenewal}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-indigo-600 font-semibold text-[11px] hover:underline whitespace-nowrap">{row.invoice}</td>
                    <td className={`px-3.5 py-3 text-right font-bold ${row.outstanding !== '₹0' ? 'text-rose-600' : 'text-slate-400'}`}>
                      {row.outstanding}
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedSub(row); }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
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
            <span className="font-medium">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} subscriptions</span>
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

        {/* ── REVENUE INTELLIGENCE & ANALYTICS PANELS (BELOW THE TABLE) ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Revenue Intelligence & Financial Analytics
              </h3>
              <p className="text-[12px] text-slate-500">MRR/ARR trends, plan distributions, churn analysis, collection metrics, and renewal forecasts</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Live Billing Sync</span>
          </div>

          {/* ── ROW 1: 3 REVENUE CARDS (Revenue by Month, Revenue by Plan, Churn Rate Trend) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 1. Revenue by Month */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Revenue by Month</p>
                  <p className="text-[10px] text-slate-400">MRR Progression (₹ Cr)</p>
                </div>
                <DollarSign className="w-4 h-4 text-violet-500" />
              </div>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="mrr" name="MRR (Cr)" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Revenue by Plan */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Revenue by Plan</p>
                  <p className="text-[10px] text-slate-400">ARR share breakdown</p>
                </div>
                <Layers className="w-4 h-4 text-sky-500" />
              </div>
              <div className="flex items-center gap-4 my-auto">
                <div className="relative shrink-0">
                  <PieChart width={86} height={86}>
                    <Pie data={REVENUE_BY_PLAN_FULL} cx={39} cy={39} innerRadius={26} outerRadius={39} dataKey="pct" strokeWidth={0}>
                      {REVENUE_BY_PLAN_FULL.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                    <span className="text-[10.5px] font-bold text-slate-800 leading-none">17.6Cr</span>
                    <span className="text-[7.5px] text-slate-400 uppercase">ARR</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5">
                  {REVENUE_BY_PLAN_FULL.map(p => (
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

            {/* 3. Churn Rate Trend */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Churn Rate Trend</p>
                  <p className="text-[10px] text-slate-400">Monthly churn rate %</p>
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">2.8% Low</span>
              </div>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={churnData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="rate" name="Churn %" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* ── ROW 2: 3 REVENUE CARDS (Renewal Trend, Payment Success Rate, State Revenue) ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 4. Renewal Trend */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Renewal Trend</p>
                  <p className="text-[10px] text-slate-400">Monthly renewal volume</p>
                </div>
                <RefreshCw className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="h-[140px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Line type="monotone" dataKey="mrr" name="Renewal Cr" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 5. Payment Success Rate Gauge */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col items-center justify-between">
              <div className="flex items-center justify-between w-full mb-1">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">Payment Success Rate</p>
                  <p className="text-[10px] text-slate-400">Auto-collection performance</p>
                </div>
                <CreditCard className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="relative w-24 h-24 my-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#10b981" strokeWidth="10"
                    strokeDasharray={circumference} strokeDashoffset={dashOffset} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[18px] font-bold text-slate-800 leading-tight">{successRate}%</span>
                  <span className="text-[8.5px] text-slate-400 uppercase font-semibold">Success</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-600 font-semibold bg-emerald-50 text-emerald-700 px-3 py-0.5 rounded-full border border-emerald-100">
                93.2% Auto-collected
              </span>
            </div>

            {/* 6. Regional / State Revenue */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-bold text-slate-800">State Revenue Leaderboard</p>
                  <p className="text-[10px] text-slate-400">Top state collections</p>
                </div>
                <MapPin className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="space-y-2 my-auto">
                {REGIONAL_REVENUE.map(r => (
                  <div key={r.state} className="space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">{r.state}</span>
                      <span className="font-bold text-slate-800">{r.rev}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full ${r.color} rounded-full`} style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── ROW 2: 3 REVENUE INTELLIGENCE & FORECAST PANELS ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* 1. Revenue Intelligence & Alerts */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <p className="text-[13px] font-bold text-slate-800">Revenue Intelligence</p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Billing Radar</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Expiring Soon (30d)', val: '45', color: 'text-amber-600 bg-amber-50 border-amber-100' },
                  { label: 'Trials Ending Soon', val: '34', color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                  { label: 'High-Value Customers', val: '128', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                  { label: 'Overdue Payments', val: '18', color: 'text-rose-600 bg-rose-50 border-rose-100' },
                ].map(item => (
                  <div key={item.label} className={`flex items-center justify-between p-2 rounded-lg ${item.color} border`}>
                    <span className="text-[11px] font-semibold text-slate-700">{item.label}</span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white shadow-2xs">{item.val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Renewal Forecast */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-500" />
                  <p className="text-[13px] font-bold text-slate-800">Renewal Forecast</p>
                </div>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Predictive</span>
              </div>
              
              <div className="space-y-2.5 my-auto">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[11.5px] text-slate-600 font-medium">Forecast Next Month</span>
                  <span className="text-[14px] font-bold text-slate-800">₹4.23 Cr</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[11.5px] text-slate-600 font-medium">Forecast Next Quarter</span>
                  <span className="text-[14px] font-bold text-slate-800">₹1.78 Cr</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-indigo-50/50 rounded-lg border border-indigo-100">
                  <span className="text-[11.5px] text-indigo-700 font-semibold">Forecast Next Year</span>
                  <span className="text-[14px] font-bold text-indigo-900">₹5.32 Cr</span>
                </div>
              </div>

              <button className="mt-2 text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1">
                View Full Revenue Forecast <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* 3. AI Billing & Revenue Recommendations */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-md p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <p className="text-[13px] font-bold text-white">AI Billing Insights</p>
                  </div>
                  <span className="text-[9.5px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">Auto Recover</span>
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">18 invoices overdue (&gt;15d). Auto dunning reminders scheduled.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">34 trial accounts ready for auto-upgrade outreach.</span>
                  </div>
                  <div className="flex items-start gap-2 bg-slate-800/80 p-2 rounded-lg border border-slate-700/60">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-slate-200">67 accounts with Auto-Renew OFF; recommend 10% discount prompt.</span>
                  </div>
                </div>
              </div>

              <button className="mt-3 w-full py-2 text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 rounded-lg border border-indigo-500/40 flex items-center justify-center gap-1.5 transition-colors">
                Run Automated Billing Audit <ArrowRight className="w-3 h-3" />
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: SUBSCRIPTION DETAILS ── */}
      {selectedSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{selectedSub.institute}</h3>
                  <p className="text-[11px] text-slate-400">Invoice #{selectedSub.invoice} • {selectedSub.plan} Plan</p>
                </div>
              </div>
              <button onClick={() => setSelectedSub(null)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50/50 text-[12px]">
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Payment Status</span>
                  <strong className="text-emerald-600">{selectedSub.status}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Billing Cycle</span>
                  <strong className="text-indigo-600">{selectedSub.billing}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Auto-Renew</span>
                  <strong className="text-slate-800">{selectedSub.autoRenewal}</strong>
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
                <h4 className="font-bold text-slate-800 text-[13px] border-b border-slate-100 pb-2">Contract Financial Breakdown</h4>
                <div className="grid grid-cols-2 gap-4 text-slate-600">
                  <div><span className="text-slate-400 block text-[10px]">Annual Contract Price</span><strong className="text-slate-800">{selectedSub.price}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Outstanding Balance</span><strong className={selectedSub.outstanding !== '₹0' ? 'text-rose-600' : 'text-slate-800'}>{selectedSub.outstanding}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Allocated Student Seats</span><strong className="text-slate-800">{selectedSub.seats} Seats</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Storage Allocation</span><strong className="text-slate-800">{selectedSub.storage}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Renewal Due Date</span><strong className="text-slate-800">{selectedSub.renewal}</strong></div>
                  <div><span className="text-slate-400 block text-[10px]">Payment Gateway</span><strong className="text-slate-800">Razorpay Auto-Debit</strong></div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-between">
              <button className="px-4 py-2 border border-slate-200 text-indigo-600 font-bold text-[11px] rounded-xl hover:bg-indigo-50">Download Tax Invoice</button>
              <button onClick={() => setSelectedSub(null)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Window</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD: CREATE INVOICE ── */}
      {showCreateInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-800">+ Generate Enterprise Invoice</h3>
              <button onClick={() => setShowCreateInvoice(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 bg-slate-50/50 text-[12px]">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Institute</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500">
                  <option>Allen Career Institute</option><option>Sri Chaitanya</option><option>Resonance Delhi</option><option>FIITJEE Noida</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Invoice Amount (₹)</label>
                  <input placeholder="e.g. 450000" className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Billing Term</label>
                  <select className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-indigo-500">
                    <option>Annual</option><option>Quarterly</option><option>Monthly</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex items-center justify-end gap-2">
              <button onClick={() => setShowCreateInvoice(false)} className="px-4 py-2 border border-slate-200 text-slate-600 font-bold text-[11px] rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={() => setShowCreateInvoice(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Issue Invoice</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
