'use client';

import { useState } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import { revenueData, apiPerfData, supportTrends, institutesGrowthData, dauData } from '@/lib/mock-data/super-admin';
import { Download, Bell, CheckCircle2, Activity, TrendingUp, TrendingDown, X, ShieldCheck, Cpu } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

const KPI_ROWS = [
  [
    { label: 'MRR',               value: '₹1.48 Cr', change: '+14.5%', up: true  },
    { label: 'ARR',               value: '₹17.62 Cr',change: '+18.2%', up: true  },
    { label: 'Total Revenue',     value: '₹2.13 Cr', change: '+8.4%',  up: true  },
    { label: 'Growth Rate',       value: '22.4%',    change: '+4.2%',  up: true  },
    { label: 'Churn Rate',        value: '2.8%',     change: '-0.5%',  up: false },
    { label: 'Platform Usage',    value: '74%',      change: '+8.2%',  up: true  },
    { label: 'DAU',               value: '2,287',    change: '+12.4%', up: true  },
    { label: 'MAU',               value: '6,78,342', change: '+15.6%', up: true  },
  ],
  [
    { label: 'Avg. Session',      value: '18m 42s',  change: '+4.5%',  up: true  },
    { label: 'Exams / Institute', value: '126',      change: '+10.2%', up: true  },
    { label: 'Assignments / Inst',value: '342',      change: '+15.4%', up: true  },
    { label: 'AI Requests / Day', value: '1.24L',    change: '+32.7%', up: true  },
    { label: 'Reports / Inst',    value: '87',       change: '+18.2%', up: true  },
    { label: 'Storage Used',      value: '12.4 TB',  change: '+8.5%',  up: true  },
    { label: 'API Calls / Day',   value: '4.32M',    change: '+24.2%', up: true  },
    { label: 'AI Tokens / Day',   value: '2.84B',    change: '+45.6%', up: true  },
  ],
];

const HEALTH_SERVICES = [
  { name: 'Web Servers',       ok: true },
  { name: 'Database',          ok: true },
  { name: 'Cache Layer',       ok: true },
  { name: 'Object Storage',    ok: true },
  { name: 'Background Jobs',   ok: true },
  { name: 'AI Model Router',   ok: true },
  { name: 'Payment Gateway',   ok: true },
  { name: 'SMS / WhatsApp',    ok: true },
  { name: 'Email Service',     ok: false },
  { name: 'CDN',               ok: true },
];

const AI_FEATURES = [
  { name: 'Paper Generation',     pct: 42 },
  { name: 'Question Generation',  pct: 28 },
  { name: 'Answer Evaluation',    pct: 15 },
  { name: 'Doubt Resolution',     pct: 7  },
  { name: 'Study Plan AI',        pct: 5  },
  { name: 'Others',               pct: 3  },
];

const TIMELINE = [
  { date: '21 May', desc: 'Email service degraded – investigating', type: 'error' },
  { date: '21 May', desc: 'System maintenance completed', type: 'success' },
  { date: '20 May', desc: 'Question Bank v2 released', type: 'info' },
  { date: '19 May', desc: 'SMS API delay resolved', type: 'warning' },
  { date: '18 May', desc: 'Smart Study Plan AI launched', type: 'info' },
  { date: '15 May', desc: 'Enterprise plan capacity upgraded', type: 'success' },
];

const TIMELINE_COLORS: Record<string, string> = {
  error:   'bg-rose-500',
  success: 'bg-emerald-500',
  info:    'bg-indigo-500',
  warning: 'bg-amber-500',
};

export function FounderAnalytics() {
  const [dateRange, setDateRange] = useState('May 2025');
  const [kpiRow1, kpiRow2] = KPI_ROWS as [typeof KPI_ROWS[0], typeof KPI_ROWS[0]];

  // Modals
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showAIModal, setShowAIModal]             = useState(false);

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Analytics"
        subtitle="Platform intelligence and performance overview"
        rightContent={
          <div className="flex items-center gap-2">
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}
              className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 focus:outline-none focus:border-indigo-400">
              <option>May 2025</option><option>Apr 2025</option><option>Q1 2025</option>
            </select>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 bg-white">
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        }
      />

      <div className="p-5 space-y-4 animate-fadein">
        {/* KPI Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpiRow1.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 hover:shadow-md transition-shadow cursor-pointer">
              <p className="text-[10px] font-medium text-slate-500 mb-1">{k.label}</p>
              <p className="text-[16px] font-bold text-slate-800 leading-none">{k.value}</p>
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {k.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}{k.change}
              </span>
            </div>
          ))}
        </div>

        {/* KPI Row 2 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpiRow2.map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 hover:shadow-md transition-shadow cursor-pointer">
              <p className="text-[10px] font-medium text-slate-500 mb-1">{k.label}</p>
              <p className="text-[16px] font-bold text-slate-800 leading-none">{k.value}</p>
              <span className={`flex items-center gap-0.5 text-[10px] font-semibold mt-1 ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {k.up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}{k.change}
              </span>
            </div>
          ))}
        </div>

        {/* Charts Row 1: 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Platform Health */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-emerald-500" />
              <p className="text-[12px] font-semibold text-slate-700">Platform Health</p>
              <span className="ml-auto text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">Operational</span>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[200px]">
              {HEALTH_SERVICES.map(s => (
                <div key={s.name} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <span className="text-[11px] text-slate-600">{s.name}</span>
                  <span className={`text-[10px] font-semibold flex items-center gap-1 ${s.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    {s.ok ? 'OK' : 'Degraded'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Growth */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">Revenue Growth (₹ Cr)</p>
            <div className="flex-1 min-h-0" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Bar dataKey="mrr" name="MRR" fill="#6366f1" radius={[3, 3, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Growth */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">User Growth (Lakh)</p>
            <div className="flex-1 min-h-0" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dauData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="dau" name="DAU (L)" stroke="#8b5cf6" fill="#ede9fe" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Institute Growth */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">Institute Growth</p>
            <div className="flex-1 min-h-0" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={institutesGrowthData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="institutes" name="Total" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="active" name="Active" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Charts Row 2: 4 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* AI Features */}
          <div onClick={() => setShowAIModal(true)} className="bg-slate-800 text-white rounded-xl shadow-sm p-4 flex flex-col cursor-pointer hover:bg-slate-800/90 transition-colors">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[12px] font-semibold text-slate-200">Top AI/ML Features</p>
              <span className="text-[10px] text-indigo-400 font-bold hover:underline">Inspect →</span>
            </div>
            <div className="space-y-3 flex-1">
              {AI_FEATURES.map(f => (
                <div key={f.name}>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-300">{f.name}</span>
                    <span className="font-bold text-white">{f.pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-indigo-400" style={{ width: `${f.pct}%` }} />
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-700 space-y-2 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-400">Avg. Accuracy</span><span className="font-bold text-emerald-400">87.6%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Recommendation Acc.</span><span className="font-bold text-emerald-400">72.3%</span></div>
              </div>
            </div>
          </div>

          {/* API Performance */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">API Performance (ms)</p>
            <div className="flex-1 min-h-0" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={apiPerfData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="responseTime" name="Response (ms)" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Error Rate */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">Error Rate (%)</p>
            <div className="flex-1 min-h-0" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={apiPerfData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Line type="monotone" dataKey="errors" name="Error %" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Platform Timeline */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex flex-col">
            <p className="text-[12px] font-semibold text-slate-700 mb-4">Platform Timeline</p>
            <div className="flex-1 relative space-y-4 overflow-y-auto">
              <div className="absolute top-2 bottom-2 left-[9px] w-0.5 bg-slate-100" />
              {TIMELINE.map((ev, i) => (
                <div key={i} className="flex gap-3 relative z-10">
                  <div className={`w-4 h-4 rounded-full shrink-0 border-2 border-white ${TIMELINE_COLORS[ev.type]} mt-0.5`} />
                  <div>
                    <span className="text-[9px] font-medium text-slate-400">{ev.date}</span>
                    <p className="text-[11px] text-slate-700 leading-tight">{ev.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowTimelineModal(true)} className="text-[11px] text-indigo-600 font-medium hover:underline mt-3 text-left">View All Activity →</button>
          </div>
        </div>

        {/* Charts Row 3: Support trends */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">Support Trends</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={supportTrends} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="open" name="Open" stackId="a" fill="#ef4444" barSize={20} />
                <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#f59e0b" />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-[12px] font-semibold text-slate-700 mb-3">Revenue (MRR vs ARR/12)</p>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="mrr" name="MRR (Cr)" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: TIMELINE ── */}
      {showTimelineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-base font-bold text-slate-800">Platform Deployment & Event Log</h3>
              <button onClick={() => setShowTimelineModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 bg-slate-50/50 text-[12px] max-h-[60vh] overflow-y-auto">
              {TIMELINE.map((ev, i) => (
                <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${TIMELINE_COLORS[ev.type]}`} />
                    <div>
                      <p className="font-bold text-slate-800 text-[12.5px]">{ev.desc}</p>
                      <p className="text-[10px] text-slate-400">{ev.date}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">{ev.type}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowTimelineModal(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Log</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD: AI FEATURES ── */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-800">AI / ML Model Telemetry</h3>
              </div>
              <button onClick={() => setShowAIModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 bg-slate-50/50 text-[12px]">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                <p className="font-bold text-indigo-900">2.84 Billion Tokens / Day</p>
                <p className="text-[11px] text-indigo-700">Token usage increased by 45.6% MoM with zero model timeouts.</p>
              </div>
              <div className="space-y-2">
                {AI_FEATURES.map(f => (
                  <div key={f.name} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg">
                    <span className="font-medium text-slate-700">{f.name}</span>
                    <span className="font-bold text-indigo-600">{f.pct}% Traffic Share</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowAIModal(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Telemetry</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
