'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  Search, Download, Plus, Sparkles, Clock, ShieldAlert,
  CheckCircle2, AlertTriangle, ArrowRight, Layers, Cpu,
  BarChart3, Activity, Users, Settings, Sliders, Play, Pause,
  RotateCcw, Eye, ChevronUp, ChevronDown, Check, X, Filter, FileText, Globe, Key, Wifi, Database, Server, RefreshCw
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, PieChart, Pie, Cell,
} from 'recharts';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: 'Healthy' | 'Warning' | 'Critical';
  env: 'Production' | 'Staging';
  version: string;
  healthScore: number;
  apiRequestsToday: string;
  failedRequests: string;
  avgResponseTime: string;
  lastSync: string;
  owner: string;
  iconBg: string;
  apiKeyMasked: string;
  webhookUrl: string;
}

const INTEGRATIONS_MOCK: IntegrationItem[] = [
  { id: 'INT-501', name: 'OpenAI', category: 'AI Provider', status: 'Healthy', env: 'Production', version: 'v1.2.0', healthScore: 98, apiRequestsToday: '2,45,678', failedRequests: '245', avgResponseTime: '420 ms', lastSync: '23 May 10:30 AM', owner: 'AI Team', iconBg: 'bg-emerald-50 text-emerald-600', apiKeyMasked: 'sk_live_9012...84a', webhookUrl: 'https://api.aios.co.in/webhooks/openai' },
  { id: 'INT-502', name: 'Razorpay', category: 'Payment Gateway', status: 'Healthy', env: 'Production', version: 'v2.5.1', healthScore: 99, apiRequestsToday: '1,24,563', failedRequests: '89', avgResponseTime: '180 ms', lastSync: '23 May 10:28 AM', owner: 'Finance Team', iconBg: 'bg-sky-50 text-sky-600', apiKeyMasked: 'rzp_live_4412...92b', webhookUrl: 'https://api.aios.co.in/webhooks/razorpay' },
  { id: 'INT-503', name: 'WhatsApp Cloud', category: 'Communication', status: 'Warning', env: 'Production', version: 'v3.1.0', healthScore: 86, apiRequestsToday: '3,45,219', failedRequests: '4,531', avgResponseTime: '620 ms', lastSync: '23 May 10:25 AM', owner: 'Comm. Team', iconBg: 'bg-amber-50 text-amber-600', apiKeyMasked: 'eaab_live_8812...12c', webhookUrl: 'https://api.aios.co.in/webhooks/whatsapp' },
  { id: 'INT-504', name: 'AWS S3', category: 'Storage', status: 'Healthy', env: 'Production', version: 'v2.3.4', healthScore: 97, apiRequestsToday: '45,678', failedRequests: '142', avgResponseTime: '210 ms', lastSync: '23 May 10:20 AM', owner: 'DevOps Team', iconBg: 'bg-indigo-50 text-indigo-600', apiKeyMasked: 'akiai_live_9012...77x', webhookUrl: 'https://api.aios.co.in/webhooks/s3' },
  { id: 'INT-505', name: 'PostgreSQL', category: 'Database', status: 'Healthy', env: 'Production', version: 'v15.3', healthScore: 99, apiRequestsToday: '18,651', failedRequests: '12', avgResponseTime: '55 ms', lastSync: '23 May 10:38 AM', owner: 'DevOps Team', iconBg: 'bg-blue-50 text-blue-600', apiKeyMasked: 'postgres_cluster_primary', webhookUrl: 'internal://db-cluster' },
  { id: 'INT-506', name: 'SendGrid', category: 'Email Service', status: 'Healthy', env: 'Production', version: 'v1.8.3', healthScore: 96, apiRequestsToday: '2,12,548', failedRequests: '1,245', avgResponseTime: '310 ms', lastSync: '23 May 10:24 AM', owner: 'Comm. Team', iconBg: 'bg-purple-50 text-purple-600', apiKeyMasked: 'sg_live_7712...34m', webhookUrl: 'https://api.aios.co.in/webhooks/sendgrid' },
  { id: 'INT-507', name: 'Google OAuth', category: 'Authentication', status: 'Healthy', env: 'Production', version: 'v2.1.0', healthScore: 98, apiRequestsToday: '89,652', failedRequests: '123', avgResponseTime: '250 ms', lastSync: '23 May 10:22 AM', owner: 'Platform Team', iconBg: 'bg-teal-50 text-teal-600', apiKeyMasked: 'client_id_9012...apps.google', webhookUrl: 'https://api.aios.co.in/auth/callback' },
  { id: 'INT-508', name: 'Mixpanel', category: 'Analytics', status: 'Healthy', env: 'Production', version: 'v2.8.5', healthScore: 97, apiRequestsToday: '56,784', failedRequests: '456', avgResponseTime: '190 ms', lastSync: '23 May 10:21 AM', owner: 'Analytics Team', iconBg: 'bg-violet-50 text-violet-600', apiKeyMasked: 'mp_live_3312...99z', webhookUrl: 'https://api.aios.co.in/webhooks/mixpanel' },
];

const CATEGORY_CARDS = [
  { name: 'Authentication', count: 4, health: '100% Healthy', color: 'indigo' },
  { name: 'AI Providers', count: 4, health: '100% Healthy', color: 'purple' },
  { name: 'Communication', count: 6, health: '83% Healthy', color: 'amber' },
  { name: 'Payment', count: 4, health: '100% Healthy', color: 'emerald' },
  { name: 'Storage', count: 2, health: '100% Healthy', color: 'sky' },
  { name: 'Database', count: 2, health: '100% Healthy', color: 'blue' },
  { name: 'Analytics', count: 3, health: '100% Healthy', color: 'violet' },
  { name: 'Monitoring', count: 3, health: '100% Healthy', color: 'teal' },
  { name: 'Maps & Location', count: 2, health: '100% Healthy', color: 'emerald' },
  { name: 'Developer', count: 2, health: '100% Healthy', color: 'indigo' },
  { name: 'Other Services', count: 4, health: '100% Healthy', color: 'slate' },
  { name: 'All Integrations', count: 64, health: 'View All', color: 'indigo' },
];

const API_USAGE_DONUT = [
  { name: 'Successful', pct: 96.0, val: '11.98 Lakh', fill: '#10b981' },
  { name: 'Failed', pct: 3.36, val: '0.42 Lakh', fill: '#f43f5e' },
  { name: 'Rate Limited', pct: 0.64, val: '0.08 Lakh', fill: '#f59e0b' },
];

const RESPONSE_TIME_TREND = [
  { day: '19 May', ms: 520 },
  { day: '20 May', ms: 340 },
  { day: '21 May', ms: 410 },
  { day: '22 May', ms: 290 },
  { day: '23 May', ms: 278 },
];

export function FounderIntegrations() {
  const [search, setSearch]                   = useState('');
  const [categoryFilter, setCategoryFilter]   = useState('All');
  const [statusFilter, setStatusFilter]       = useState('All');
  const [selectedCategory, setSelectedCat]    = useState<string | null>(null);
  const [selectedIntegration, setSelectedInt] = useState<IntegrationItem | null>(INTEGRATIONS_MOCK[0]!);
  const [drawerOpen, setDrawerOpen]           = useState(false);
  const [diagnosticOpen, setDiagnosticOpen]   = useState(false);
  const [addModalOpen, setAddModalOpen]       = useState(false);
  const [scanning, setScanning]               = useState(false);
  const [testSuccess, setTestSuccess]         = useState(false);
  const [page, setPage]                       = useState(1);
  const PER_PAGE = 8;

  const filtered = useMemo(() => {
    let rows = [...INTEGRATIONS_MOCK];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.owner.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'All') rows = rows.filter(i => i.category.includes(categoryFilter));
    if (statusFilter !== 'All') rows = rows.filter(i => i.status === statusFilter);
    if (selectedCategory && selectedCategory !== 'All Integrations') rows = rows.filter(i => i.category.includes(selectedCategory));
    return rows;
  }, [search, categoryFilter, statusFilter, selectedCategory]);

  const pageRows = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const triggerDiagnostic = () => {
    setDiagnosticOpen(true);
    setScanning(true);
    setTimeout(() => setScanning(false), 2000);
  };

  const handleTestConnection = () => {
    setTestSuccess(true);
    setTimeout(() => setTestSuccess(false), 2500);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Integrations"
        subtitle="Manage and monitor all external services and platform integrations"
        rightContent={
          <div className="flex items-center gap-2">
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>All Institutes</option><option>Allen Jaipur</option><option>Resonance Delhi</option>
            </select>
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>May 2025</option><option>Apr 2025</option>
            </select>
          </div>
        }
      />

      <div className="p-5 space-y-6 animate-fadein max-w-[1750px] mx-auto">
        {/* ── TOP KPI METRICS BAR (12 Cards Grid) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12 gap-2.5">
          {[
            { label: 'Total Integrations', val: '64', sub: '+8%', up: true },
            { label: 'Connected Services', val: '52', sub: '+81.25%', up: true },
            { label: 'Healthy Integrations', val: '46', sub: '+88.46%', up: true },
            { label: 'Failed Integrations', val: '6', sub: '-11.54%', up: false },
            { label: 'API Calls Today', val: '12.48 Lakh', sub: '+13.6%', up: true },
            { label: 'Avg. Response Time', val: '278 ms', sub: '+6.8%', up: true },
            { label: 'Webhook Success Rate', val: '96.3%', sub: '+2.4%', up: true },
            { label: 'OAuth Connections', val: '18', sub: '+2', up: true },
            { label: 'AI Providers', val: '4', sub: '100% Healthy', up: true },
            { label: 'Payment Providers', val: '4', sub: '100% Healthy', up: true },
            { label: 'Communication Providers', val: '6', sub: '83% Healthy', up: false },
            { label: 'Storage Providers', val: '3', sub: '100% Healthy', up: true },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-2.5 hover:shadow-md transition-shadow">
              <p className="text-[10px] font-medium text-slate-500 mb-0.5 truncate">{k.label}</p>
              <p className="text-[15px] font-bold text-slate-800 leading-tight truncate">{k.val}</p>
              <span className={`text-[9.5px] font-semibold mt-1 block truncate ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {k.sub}
              </span>
            </div>
          ))}
        </div>

        {/* ── CATEGORY CARDS GRID ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-12 gap-2.5">
          {CATEGORY_CARDS.map(cat => (
            <button key={cat.name} onClick={() => setSelectedCat(selectedCategory === cat.name ? null : cat.name)}
              className={`p-2.5 rounded-xl border text-left transition-all ${selectedCategory === cat.name ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white border-slate-200/90 hover:border-indigo-200 text-slate-700 shadow-2xs'}`}>
              <p className={`text-[11px] font-bold truncate ${selectedCategory === cat.name ? 'text-white' : 'text-slate-800'}`}>{cat.name}</p>
              <p className={`text-[10px] mt-0.5 font-semibold ${selectedCategory === cat.name ? 'text-indigo-100' : 'text-slate-500'}`}>{cat.count} Services</p>
              <span className={`text-[9.5px] font-bold mt-1 block ${selectedCategory === cat.name ? 'text-emerald-300' : 'text-emerald-600'}`}>{cat.health}</span>
            </button>
          ))}
        </div>

        {/* ── TOOLBAR & FILTERS ── */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search integrations by name or provider..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium bg-white shadow-2xs" />
            </div>

            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
              <option value="All">Category: All</option><option value="AI Provider">AI Provider</option><option value="Payment Gateway">Payment Gateway</option><option value="Communication">Communication</option>
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
              <option value="All">Status: All</option><option value="Healthy">Healthy</option><option value="Warning">Warning</option><option value="Critical">Critical</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export
            </button>
            <button onClick={() => setAddModalOpen(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Add Integration
            </button>
          </div>
        </div>

        {/* ── PRIMARY INTEGRATION SERVICES TABLE: 100% FULL WIDTH ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Integration Services ({filtered.length})</h3>
            <span className="text-[11px] text-slate-500 font-medium">Showing {pageRows.length} of {filtered.length} integrations</span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[11.5px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Environment</th>
                  <th className="px-4 py-3 font-mono">Version</th>
                  <th className="px-4 py-3 text-center">Health Score</th>
                  <th className="px-4 py-3 text-right">API Requests (Today)</th>
                  <th className="px-4 py-3 text-right">Failed Req</th>
                  <th className="px-4 py-3 text-right">Avg. Latency</th>
                  <th className="px-4 py-3 text-right">Last Sync</th>
                  <th className="px-4 py-3">Owner Team</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((row) => (
                  <tr key={row.id} onClick={() => { setSelectedInt(row); setDrawerOpen(true); }}
                    className={`hover:bg-indigo-50/30 transition-colors cursor-pointer group ${selectedIntegration?.id === row.id ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[12px] ${row.iconBg}`}>
                          {row.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-800 text-[12.5px] group-hover:text-indigo-600 transition-colors">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{row.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${row.status === 'Healthy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-medium">{row.env}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">{row.version}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-bold text-emerald-600 text-[11.5px]">{row.healthScore}%</span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-700 font-bold">{row.apiRequestsToday}</td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-rose-600 font-semibold">{row.failedRequests}</td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-600">{row.avgResponseTime}</td>
                    <td className="px-4 py-3 text-right text-slate-400 text-[11px] whitespace-nowrap">{row.lastSync}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium whitespace-nowrap">{row.owner}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedInt(row); setDrawerOpen(true); }} className="text-[11px] font-bold text-indigo-600 hover:underline">Drawer →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11.5px] text-slate-500">
            <span>Showing 1 to {pageRows.length} of {filtered.length} integrations</span>
            <div className="flex gap-1">
              <button onClick={() => setPage(1)} className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${page === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>1</button>
              <button onClick={() => setPage(2)} className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${page === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>2</button>
            </div>
          </div>
        </div>

        {/* ── SECONDARY PANELS BELOW TABLE (3-COLUMN EVEN ANALYTICS GRID) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Panel 1: API Usage Overview */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-0.5">API Usage Overview (Today)</h4>
              <p className="text-[11px] text-slate-400 mb-3">12.48 Lakh Total Calls</p>
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 flex items-center justify-center">
                  <PieChart width={96} height={96}>
                    <Pie data={API_USAGE_DONUT} cx={48} cy={48} innerRadius={28} outerRadius={48} dataKey="pct" strokeWidth={0}>
                      {API_USAGE_DONUT.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                  </PieChart>
                  <div className="absolute text-center">
                    <span className="text-[11px] font-bold text-slate-800">12.48L</span>
                  </div>
                </div>
                <div className="flex-1 space-y-1.5 text-[11px]">
                  {API_USAGE_DONUT.map(d => (
                    <div key={d.name} className="flex justify-between items-center">
                      <span className="text-slate-600 font-medium flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} /> {d.name}
                      </span>
                      <span className="font-bold text-slate-800">{d.val} ({d.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Panel 2: Avg. Response Time Trend */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
            <h4 className="text-sm font-bold text-slate-800 mb-0.5">Avg. Response Time Trend</h4>
            <p className="text-[11px] text-slate-400 mb-3">19 May – 23 May (Latency in ms)</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={RESPONSE_TIME_TREND}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[200, 600]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="ms" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Panel 3: Latency & Webhooks */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-800 mb-0.5">Webhook Delivery & Health</h4>
              <p className="text-[11px] text-slate-400 mb-3">96.3% Delivery Success Rate</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded bg-emerald-50 border border-emerald-100">
                  <span className="text-emerald-700 font-bold block text-sm">1,24,563</span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Delivered Today</span>
                </div>
                <div className="p-2.5 rounded bg-rose-50 border border-rose-100">
                  <span className="text-rose-700 font-bold block text-sm">4,531</span>
                  <span className="text-[10px] text-rose-600 font-semibold">Failed Retries</span>
                </div>
              </div>
            </div>
            <span className="text-[10.5px] text-slate-400 mt-2 block">Payload volume: 2.1 GB Transferred Today</span>
          </div>

        </div>

        {/* ── MOVED TO VERY LAST: INTEGRATION INTELLIGENCE PANEL ── */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">Integration Intelligence</h3>
                <p className="text-[10.5px] text-slate-400">Real-time telemetry and health monitoring across external services</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
              Live Monitor
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11.5px]">
            {/* Most Reliable Services */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
              <p className="font-bold text-slate-800 text-[12px] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Most Reliable Services
              </p>
              <div className="space-y-1.5 text-slate-600 text-[11.5px]">
                <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="font-semibold text-slate-700">• PostgreSQL</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10.5px]">99% Uptime</span>
                </div>
                <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="font-semibold text-slate-700">• Razorpay</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10.5px]">99% Uptime</span>
                </div>
                <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="font-semibold text-slate-700">• Google OAuth</span>
                  <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10.5px]">98% Uptime</span>
                </div>
              </div>
            </div>

            {/* Services Needing Attention */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
              <p className="font-bold text-slate-800 text-[12px] flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" /> Services Needing Attention
              </p>
              <div className="space-y-1.5 text-slate-600 text-[11.5px]">
                <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="font-semibold text-slate-700">• WhatsApp Cloud</span>
                  <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10.5px]">Warning (Latency)</span>
                </div>
                <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="font-semibold text-slate-700">• SendGrid</span>
                  <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded text-[10.5px]">Latent Queue</span>
                </div>
                <div className="flex justify-between items-center p-1.5 bg-white rounded-lg border border-slate-100 shadow-2xs">
                  <span className="font-semibold text-slate-700">• Cloudinary</span>
                  <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded text-[10.5px]">85% Quota Used</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button onClick={triggerDiagnostic} className="px-4 py-2 text-[11.5px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg text-center transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer">
              Run Full API Diagnostic Scan →
            </button>
          </div>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD 1: INTEGRATION DETAILS & KEYS ── */}
      {drawerOpen && selectedIntegration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[65vw] max-h-[85vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{selectedIntegration.id}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">{selectedIntegration.status}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{selectedIntegration.name} Integration</h3>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Category</span>
                  <span className="font-bold text-slate-800 text-[13px]">{selectedIntegration.category}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Environment</span>
                  <span className="font-bold text-indigo-600 text-[13px]">{selectedIntegration.env}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-slate-500 text-[11px] font-bold uppercase tracking-wider block">Masked API Credentials</label>
                <input readOnly value={selectedIntegration.apiKeyMasked} className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-[12px] bg-slate-50 text-slate-800 font-semibold" />
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="text-slate-500 text-[11px] font-bold uppercase tracking-wider block">Webhook Endpoint URL</label>
                <input readOnly value={selectedIntegration.webhookUrl} className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-[12px] bg-slate-50 text-indigo-600 font-semibold" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">API Calls Today</span>
                  <span className="font-bold text-slate-800 font-mono text-[14px]">{selectedIntegration.apiRequestsToday}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Avg Response Latency</span>
                  <span className="font-bold text-emerald-600 font-mono text-[14px]">{selectedIntegration.avgResponseTime}</span>
                </div>
              </div>

              {testSuccess && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> API Connection Verified successfully! Response 200 OK (142ms).
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-2">
              <button onClick={handleTestConnection} className="px-4 py-2 text-[12px] font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Test Connection
              </button>
              <button onClick={() => setDrawerOpen(false)} className="px-4 py-2 text-[12px] font-bold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD 2: DIAGNOSTIC SCAN MODAL ── */}
      {diagnosticOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">Full Platform API Diagnostic Scan</h3>
              </div>
              <button onClick={() => setDiagnosticOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50">
              {scanning ? (
                <div className="py-12 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                  <p className="text-[14px] font-bold text-slate-800">Pinging 64 External Gateways & Webhooks...</p>
                  <p className="text-[11.5px] text-slate-400">Testing TLS certificates, DNS resolution, and latency bounds</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-[12px]">
                    <div className="flex items-center gap-2 font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Diagnostic Scan Completed (64 / 64 Checked)
                    </div>
                    <span className="text-[10.5px] font-mono text-emerald-600 font-bold">Passed 98.4%</span>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 text-[12px]">
                    <p className="font-bold text-slate-800">Summary Results:</p>
                    <div className="space-y-1.5 text-slate-600 font-medium">
                      <div className="flex justify-between"><span>PostgreSQL Primary Cluster</span><span className="text-emerald-600 font-bold">✓ 12ms</span></div>
                      <div className="flex justify-between"><span>Razorpay Webhook Listener</span><span className="text-emerald-600 font-bold">✓ 180ms</span></div>
                      <div className="flex justify-between"><span>WhatsApp Cloud API</span><span className="text-amber-600 font-bold">⚠ 620ms (Queue Spike)</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setDiagnosticOpen(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Scan</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD 3: ADD INTEGRATION MODAL ── */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-800">Connect New Integration</h3>
              <button onClick={() => setAddModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50 text-[12px]">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Integration / Provider Name</label>
                <input placeholder="e.g. Stripe, Twilio, OpenAI" className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800" />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Category</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium">
                  <option>AI Provider</option>
                  <option>Payment Gateway</option>
                  <option>Communication</option>
                  <option>Storage</option>
                  <option>Analytics</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">API Key / Access Token</label>
                <input type="password" placeholder="sk_live_..." className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 font-mono" />
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAddModalOpen(false)} className="px-4 py-2 text-[12px] font-bold border border-slate-200 text-slate-700 rounded-xl">Cancel</button>
              <button onClick={() => { setAddModalOpen(false); alert('Integration connected!'); }} className="px-5 py-2 text-[12px] font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Save & Connect</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
