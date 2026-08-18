'use client';

import { useState } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  Activity, Server, Database, Cpu, HardDrive, ShieldCheck,
  CheckCircle2, AlertTriangle, Clock, RefreshCw, Zap,
  TrendingUp, TrendingDown, Layers, Terminal, Sparkles, ArrowRight,
  Wifi, BarChart2, Check, Play, Globe, Flame, ShieldAlert, X, Eye, FileText, Search
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';

const SERVICES = [
  { name: 'Frontend',          status: 'Operational', uptime: '100%',   latency: '24ms',  ver: 'v2.4.12', category: 'UI / CDN' },
  { name: 'Backend API',        status: 'Operational', uptime: '100%',   latency: '102ms', ver: 'v2.4.12', category: 'Core Service' },
  { name: 'Authentication',     status: 'Operational', uptime: '100%',   latency: '45ms',  ver: 'v2.4.12', category: 'Security' },
  { name: 'PostgreSQL',         status: 'Operational', uptime: '100%',   latency: '12ms',  ver: 'v14.8',   category: 'Database' },
  { name: 'Redis',              status: 'Operational', uptime: '100%',   latency: '3ms',   ver: 'v7.0',    category: 'Cache' },
  { name: 'Object Storage',     status: 'Operational', uptime: '100%',   latency: '85ms',  ver: 'v1.6',    category: 'Storage' },
  { name: 'AI Service',         status: 'Operational', uptime: '99.9%',  latency: '320ms', ver: 'v2.1',    category: 'AI Engine' },
  { name: 'WhatsApp API',       status: 'Operational', uptime: '100%',   latency: '210ms', ver: 'v3.2',    category: 'Communication' },
  { name: 'SMS Gateway',        status: 'Operational', uptime: '100%',   latency: '180ms', ver: 'v4.0',    category: 'Communication' },
  { name: 'Email Service',      status: 'Operational', uptime: '100%',   latency: '140ms', ver: 'v2.8',    category: 'Communication' },
  { name: 'Payment Gateway',    status: 'Operational', uptime: '100%',   latency: '190ms', ver: 'v5.1',    category: 'Billing' },
  { name: 'Background Workers', status: 'Operational', uptime: '100%',   latency: '55ms',  ver: 'v1.1.2',  category: 'Worker Queue' },
  { name: 'Search Engine',      status: 'Operational', uptime: '99.9%',  latency: '68ms',  ver: 'v8.5',    category: 'Search' },
  { name: 'Analytics Engine',   status: 'Operational', uptime: '100%',   latency: '95ms',  ver: 'v1.6.3',  category: 'Analytics' },
  { name: 'Report Generator',   status: 'Operational', uptime: '100%',   latency: '310ms', ver: 'v2.7',    category: 'Reports' },
];

const TELEMETRY_DATA = [
  { time: '00:00', cpu: 34, memory: 48, requests: 840, users: 4.2, latency: 180, errorRate: 0.08 },
  { time: '04:00', cpu: 28, memory: 44, requests: 620, users: 3.1, latency: 165, errorRate: 0.05 },
  { time: '08:00', cpu: 52, memory: 61, requests: 1850, users: 11.4, latency: 210, errorRate: 0.14 },
  { time: '12:00', cpu: 68, memory: 72, requests: 2400, users: 14.8, latency: 235, errorRate: 0.18 },
  { time: '16:00', cpu: 58, memory: 65, requests: 2100, users: 13.2, latency: 205, errorRate: 0.12 },
  { time: '20:00', cpu: 42, memory: 56, requests: 1420, users: 12.8, latency: 198, errorRate: 0.12 },
  { time: '24:00', cpu: 36, memory: 50, requests: 980, users: 6.4, latency: 175, errorRate: 0.09 },
];

const RECENT_INCIDENTS = [
  { id: 'INC-104', title: 'All Service Slowdown', time: '1h ago', severity: 'High', status: 'Resolved', impact: '12 Institutes', resolvedBy: 'DevOps Lead', duration: '14 mins', description: 'Brief latency spike on API Gateway due to connection pool exhaustion during peak exam hours.' },
  { id: 'INC-103', title: 'Database Connection Spike', time: '4h ago', severity: 'Medium', status: 'Resolved', impact: '2 Institutes', resolvedBy: 'DB Admin', duration: '8 mins', description: 'PostgreSQL read-replica connection count reached 85% limit. Auto-scaled secondary replica.' },
  { id: 'INC-102', title: 'SMS Gateway Delay', time: '12h ago', severity: 'Medium', status: 'Resolved', impact: '3 Institutes', resolvedBy: 'Comm Team', duration: '22 mins', description: 'Third-party SMS provider experienced queue delays. Failover route automatically triggered.' },
];

export function FounderHealth() {
  const [regionFilter, setRegionFilter]   = useState('All Regions');
  const [restarting, setRestarting]       = useState<string | null>(null);
  const [activeModal, setActiveModal]     = useState<'allServices' | 'allIncidents' | 'aiTelemetry' | null>(null);
  const [modalSearch, setModalSearch]     = useState('');

  const handleRestart = (serviceName: string) => {
    setRestarting(serviceName);
    setTimeout(() => setRestarting(null), 1200);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="System Health"
        subtitle="Real-time platform monitoring and infrastructure status"
        rightContent={
          <div className="flex items-center gap-2">
            <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
              className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>All Regions</option><option>ap-south-1 (Mumbai)</option><option>us-east-1 (N. Virginia)</option>
            </select>
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>May 2025</option><option>Apr 2025</option>
            </select>
          </div>
        }
      />

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── TOP KPI BAR (8 Key Metrics) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: 'Health Score', val: '98/100', status: 'Excellent', color: 'emerald', up: true },
            { label: 'Uptime', val: '99.98%', status: '+0.02%', color: 'emerald', up: true },
            { label: 'Avg Response Time', val: '198ms', status: '-12ms', color: 'sky', up: true },
            { label: 'Error Rate', val: '0.12%', status: '-0.03%', color: 'emerald', up: true },
            { label: 'DB Health', val: 'Healthy', status: 'All Good', color: 'violet', up: true },
            { label: 'AI Service', val: 'Healthy', status: 'All Good', color: 'indigo', up: true },
            { label: 'Active Users (Live)', val: '12,842', status: '+5.7%', color: 'blue', up: true },
            { label: 'Running Jobs', val: '256', status: '+12.4%', color: 'teal', up: true },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 hover:shadow-md transition-shadow">
              <p className="text-[10.5px] font-medium text-slate-500 mb-1">{k.label}</p>
              <p className="text-[16px] font-bold text-slate-800 leading-none">{k.val}</p>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-600">{k.status}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── 1. INFRASTRUCTURE SERVICES: 100% FULL WIDTH ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm p-4.5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" /> Infrastructure Services
              </h3>
              <p className="text-[11.5px] text-slate-500">Live operational status of core system microservices</p>
            </div>
            <button onClick={() => setActiveModal('allServices')}
              className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-100 flex items-center gap-1 transition-colors shadow-2xs cursor-pointer">
              View All Services ({SERVICES.length}) <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* 15 Microservice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {SERVICES.map(srv => (
              <div key={srv.name} className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[12px] font-bold text-slate-800 truncate">{srv.name}</span>
                  <span className="flex items-center gap-1 text-[9.5px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Ops
                  </span>
                </div>

                <div className="text-[11px] space-y-1 text-slate-500 font-medium my-1">
                  <div className="flex justify-between">
                    <span>Uptime:</span>
                    <span className="font-bold text-slate-700">{srv.uptime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Latency:</span>
                    <span className="font-bold text-indigo-600">{srv.latency}</span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[9.5px] font-mono text-slate-400 font-semibold">{srv.ver}</span>
                  <button onClick={() => handleRestart(srv.name)}
                    className="text-[10px] font-bold text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                    <RefreshCw className={`w-3 h-3 ${restarting === srv.name ? 'animate-spin text-indigo-600' : ''}`} />
                    {restarting === srv.name ? 'Restarting...' : 'Restart'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. SYSTEM RESOURCES AND RECENT INCIDENTS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Left Column: System Resources Gauges */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-sky-500" /> System Resources
                </h3>
                <span className="text-[10px] font-semibold text-sky-600 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-100">
                  Telemetry
                </span>
              </div>

              {/* 3 Circular Gauge Indicators */}
              <div className="grid grid-cols-3 gap-2 text-center my-3">
                {[
                  { label: 'CPU Usage', pct: 42, color: '#3b82f6' },
                  { label: 'Memory', pct: 56, color: '#8b5cf6' },
                  { label: 'Disk Storage', pct: 60, color: '#f59e0b' },
                ].map(g => {
                  const circ = 2 * Math.PI * 26;
                  const offset = circ * (1 - g.pct / 100);
                  return (
                    <div key={g.label} className="flex flex-col items-center">
                      <div className="relative w-18 h-18">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 70 70">
                          <circle cx="35" cy="35" r="26" fill="none" stroke="#f1f5f9" strokeWidth="7" />
                          <circle cx="35" cy="35" r="26" fill="none" stroke={g.color} strokeWidth="7"
                            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-[14px] font-bold text-slate-800">{g.pct}%</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-700 mt-1.5">{g.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Resource Counters */}
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-2 text-[11.5px]">
              <div className="flex justify-between text-slate-600">
                <span>Storage Used</span>
                <span className="font-bold text-slate-800">12.4 TB / 20 TB</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Bandwidth (7d)</span>
                <span className="font-bold text-slate-800">1.24 TB</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Cache Hit Rate</span>
                <span className="font-bold text-emerald-600">93.8%</span>
              </div>
            </div>
          </div>

          {/* Right Column: Recent Incidents Panel */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> Recent Incidents
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                  All Resolved
                </span>
              </div>

              <div className="space-y-2.5">
                {RECENT_INCIDENTS.map((inc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="space-y-0.5">
                      <p className="text-[12px] font-bold text-slate-800">{inc.title}</p>
                      <p className="text-[10.5px] text-slate-400 font-medium">{inc.time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${inc.severity === 'High' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>{inc.severity}</span>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-100">✓ {inc.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3">
              <button onClick={() => setActiveModal('allIncidents')}
                className="text-[11.5px] font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer">
                View All Incident Logs ({RECENT_INCIDENTS.length}) <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* ── 3. BOTTOM SECTION: LIVE MONITORING + INSTITUTE IMPACT & AI MONITORING ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-600" /> Live Platform Monitoring & Impact Diagnostics
              </h3>
              <p className="text-[12px] text-slate-500">Real-time system telemetry, active institute impact, and AI service consumption metrics</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">1s Refresh Rate</span>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

            {/* Left 2 Cols: Live Telemetry Line Chart */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-bold text-slate-800">Live Telemetry</span>
                  <div className="flex items-center gap-2 text-[10.5px]">
                    <span className="flex items-center gap-1 font-semibold text-slate-600"><span className="w-2 h-2 rounded-full bg-blue-500" /> CPU Usage (42%)</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600"><span className="w-2 h-2 rounded-full bg-purple-500" /> Memory (56%)</span>
                    <span className="flex items-center gap-1 font-semibold text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Requests / min</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500">
                  <span>Concurrent Users: <strong className="text-slate-800">12.8K</strong></span>
                  <span>Response: <strong className="text-indigo-600">198ms</strong></span>
                  <span>Error Rate: <strong className="text-emerald-600">0.12%</strong></span>
                </div>
              </div>

              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={TELEMETRY_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                    <Area type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#cpuGrad)" name="CPU %" />
                    <Area type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#memGrad)" name="Memory %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right Col: Institute Impact + AI Monitoring */}
            <div className="space-y-4 flex flex-col justify-between">

              {/* Institute Impact Card */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-500" /> Institute Impact Diagnostics
                  </h4>
                  <span className="text-[9.5px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">Optimal</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Institutes Affected', val: '12', sub: '↓ 4', color: 'text-slate-800' },
                    { label: 'User Institutes', val: '28', sub: '↑ 6', color: 'text-indigo-600' },
                    { label: 'Login Failures Spike', val: '1.2K', sub: '10%', color: 'text-amber-600' },
                    { label: 'Redirection Failures', val: '352', sub: '↑ 7', color: 'text-slate-700' },
                    { label: 'AI Alerts', val: '7', sub: '2', color: 'text-purple-600' },
                    { label: 'Feature Issues', val: '23', sub: '↓ 5', color: 'text-emerald-600' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <p className={`text-[15px] font-bold leading-none mb-1 ${item.color}`}>{item.val}</p>
                      <p className="text-[9.5px] text-slate-500 leading-tight">{item.label}</p>
                      <span className="text-[9px] font-semibold text-slate-400 mt-1 block">{item.sub}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Monitoring Card */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-md p-4 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-[13px] font-bold text-white">AI Service Monitoring</h4>
                  </div>
                  <span className="text-[9.5px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30">Active</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center my-2">
                  <div>
                    <p className="text-[9.5px] text-slate-400">Total Tokens</p>
                    <p className="text-[14px] font-bold text-white">24.8M</p>
                    <span className="text-[8.5px] text-emerald-400">↓ 3.7%</span>
                  </div>
                  <div>
                    <p className="text-[9.5px] text-slate-400">Total Cost</p>
                    <p className="text-[14px] font-bold text-emerald-300">₹42,780</p>
                    <span className="text-[8.5px] text-emerald-400">↓ 2.1%</span>
                  </div>
                  <div>
                    <p className="text-[9.5px] text-slate-400">Avg. Response</p>
                    <p className="text-[14px] font-bold text-indigo-300">2.8s</p>
                    <span className="text-[8.5px] text-indigo-300">↓ 0.4s</span>
                  </div>
                  <div>
                    <p className="text-[9.5px] text-slate-400">Failed Requests</p>
                    <p className="text-[14px] font-bold text-rose-300">32</p>
                    <span className="text-[8.5px] text-emerald-400">↓ 10%</span>
                  </div>
                </div>

                <button onClick={() => setActiveModal('aiTelemetry')}
                  className="mt-2 w-full py-1.5 text-[10.5px] font-bold text-indigo-300 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 rounded-lg border border-indigo-500/40 flex items-center justify-center gap-1 transition-colors cursor-pointer">
                  View AI Telemetry Dashboard <ArrowRight className="w-3 h-3" />
                </button>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* ── OVERLAY MODAL CARD 1: ALL INFRASTRUCTURE SERVICES MODAL ── */}
      {activeModal === 'allServices' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[70vw] h-[75vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 uppercase tracking-wider">
                    Infrastructure Telemetry
                  </span>
                  <span className="text-[12px] font-medium text-slate-400">{SERVICES.length} Microservices Active</span>
                </div>
                <h2 className="text-lg font-bold text-slate-800">All Infrastructure Microservices</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-xs">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 w-72">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input type="text" placeholder="Search service or category..." value={modalSearch} onChange={e => setModalSearch(e.target.value)} className="bg-transparent text-[12px] outline-none w-full" />
              </div>
              <span className="text-[11.5px] text-slate-500 font-semibold">100% Operational Status Guaranteed</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {SERVICES.filter(s => s.name.toLowerCase().includes(modalSearch.toLowerCase()) || s.category.toLowerCase().includes(modalSearch.toLowerCase())).map(srv => (
                  <div key={srv.name} className="bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800 text-[14px]">{srv.name}</h4>
                        <span className="text-[11px] text-slate-400 font-medium">{srv.category}</span>
                      </div>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
                        Operational
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center text-[11px]">
                      <div>
                        <span className="text-slate-400 text-[10px] block">Uptime</span>
                        <span className="font-bold text-slate-800">{srv.uptime}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Latency</span>
                        <span className="font-bold text-indigo-600">{srv.latency}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Version</span>
                        <span className="font-mono font-bold text-slate-600">{srv.ver}</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-1">
                      <button onClick={() => handleRestart(srv.name)} className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-[11px] font-bold rounded-xl transition-all flex items-center gap-1.5">
                        <RefreshCw className={`w-3 h-3 ${restarting === srv.name ? 'animate-spin text-indigo-600' : ''}`} />
                        {restarting === srv.name ? 'Restarting...' : 'Restart Service'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/80 flex justify-between items-center text-[11.5px] text-slate-500">
              <span>Showing {SERVICES.length} Microservices</span>
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-800 text-white font-bold text-[12px] rounded-xl hover:bg-slate-900">Close Window</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY MODAL CARD 2: RECENT INCIDENTS LOG MODAL ── */}
      {activeModal === 'allIncidents' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase tracking-wider">
                  System Audit
                </span>
                <h2 className="text-lg font-bold text-slate-800 mt-1">Platform Incident History & Resolutions</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              {RECENT_INCIDENTS.map(inc => (
                <div key={inc.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-slate-400">{inc.id}</span>
                      <h4 className="font-bold text-slate-800 text-[14px]">{inc.title}</h4>
                    </div>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      ✓ {inc.status}
                    </span>
                  </div>

                  <p className="text-[12px] text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">{inc.description}</p>

                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Impacted: <strong className="text-slate-800">{inc.impact}</strong></span>
                    <span>Duration: <strong className="text-slate-800">{inc.duration}</strong></span>
                    <span>Resolved by: <strong className="text-indigo-600">{inc.resolvedBy}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Logs</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY MODAL CARD 3: AI TELEMETRY DASHBOARD MODAL ── */}
      {activeModal === 'aiTelemetry' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">AI Service Telemetry & Diagnostics</h3>
              </div>
              <button onClick={() => setActiveModal(null)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <p className="text-[11px] text-slate-500 font-semibold">Total LLM Tokens Today</p>
                  <p className="text-2xl font-black text-indigo-600 mt-1">24.8 Million</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                  <p className="text-[11px] text-slate-500 font-semibold">Estimated API Spend</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">₹42,780</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <h4 className="font-bold text-slate-800 text-[13px]">Model Usage Breakdown</h4>
                <div className="space-y-2 text-[12px]">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">GPT-4o (Assessment Builder)</span>
                    <span className="font-bold text-slate-800">14.2M tokens (57%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Claude 3.5 Sonnet (AI Recommendations)</span>
                    <span className="font-bold text-slate-800">8.1M tokens (33%)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 font-medium">Embeddings v3 (Vector Search)</span>
                    <span className="font-bold text-slate-800">2.5M tokens (10%)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Done</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
