'use client';

import { useState } from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { founderData as d } from '@/lib/mock-data/founder';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from 'recharts';
import {
  Building2, Users, GraduationCap, DollarSign, Activity, CheckCircle2,
  Server, Clock, HardDrive, TrendingUp, AlertCircle, X, ExternalLink, ShieldCheck,
} from 'lucide-react';

function TicketsDonut({ data }: { data: typeof d.supportTickets }) {
  const pie = [
    { name: 'Open',        value: data.open,       fill: '#f43f5e' },
    { name: 'In Progress', value: data.inProgress,  fill: '#f59e0b' },
    { name: 'Resolved',    value: data.resolved,    fill: '#10b981' },
  ];
  return (
    <div className="card">
      <p className="section-title">Support Tickets</p>
      <div className="flex items-center gap-3">
        <div className="relative w-28 h-28">
          <PieChart width={112} height={112}>
            <Pie data={pie} cx={52} cy={52} innerRadius={36} outerRadius={52} dataKey="value" strokeWidth={0}>
              {pie.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[16px] font-bold text-slate-800">{data.total}</span>
            <span className="text-[9px] text-slate-500">Total</span>
          </div>
        </div>
        <div className="space-y-2">
          {pie.map((p) => (
            <div key={p.name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.fill }} />
              <span className="text-[12px] text-slate-600">{p.name}</span>
              <span className="ml-auto text-[12px] font-bold text-slate-700 pl-2">{p.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FounderOverview() {
  const [selectedInst, setSelectedInst] = useState<any | null>(null);
  const [viewAllInsts, setViewAllInsts] = useState(false);
  const [healthModal, setHealthModal]   = useState(false);

  return (
    <div className="flex-1 overflow-y-auto min-w-0 flex flex-col bg-[#f8fafc] h-full">
      <TopHeader
        greeting="Welcome, Super Admin! 👑"
        subtitle="Monitor, analyse and scale your platform."
        rightContent={
          <div className="flex items-center gap-2">
            <select className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 bg-white">
              <option>All Institutes</option>
            </select>
            <select className="text-[12px] border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:border-indigo-400 bg-white">
              <option>May 2025</option>
            </select>
          </div>
        }
      />
      <div className="p-5 space-y-4 animate-fadein max-w-[1700px] mx-auto w-full">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {d.kpis.map((kpi, i) => {
            const icons = [
              <Building2 key="b" className="w-4 h-4" />,
              <Users key="u" className="w-4 h-4" />,
              <GraduationCap key="g" className="w-4 h-4" />,
              <DollarSign key="d" className="w-4 h-4" />,
            ];
            return (
              <StatCard
                key={kpi.label}
                label={kpi.label}
                value={kpi.value}
                change={kpi.change}
                changePositive
                icon={icons[i]}
                color={kpi.color as any}
              />
            );
          })}
        </div>

        {/* Row 2: Platform Usage + Top Institutes + System Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Platform Usage */}
          <div className="card">
            <p className="section-title">Platform Usage</p>
            <div className="flex gap-4 mb-3">
              {[
                { label: 'Students', color: '#6366f1' },
                { label: 'Teachers', color: '#10b981' },
                { label: 'Exams',    color: '#f59e0b' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: l.color }} />
                  <span className="text-[11px] text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={d.platformUsage} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Line type="monotone" dataKey="students" stroke="#6366f1" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="teachers"  stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="exams"     stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Institutes */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <p className="section-title mb-0">Top Performing Institutes</p>
              <button onClick={() => setViewAllInsts(true)} className="view-all-link text-indigo-600 font-bold hover:underline cursor-pointer">View All →</button>
            </div>
            <div className="space-y-3">
              {d.topInstitutes.map((inst, i) => (
                <div key={inst.name} onClick={() => setSelectedInst(inst)} className="cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors">
                  <div className="flex justify-between text-[12px] mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${
                        i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-slate-400' : 'bg-orange-400'
                      }`}>{inst.rank}</span>
                      <span className="text-slate-700 font-medium">{inst.name}</span>
                    </div>
                    <span className="font-bold text-slate-700">{inst.score}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${i === 0 ? 'bg-violet-500' : i === 1 ? 'bg-indigo-500' : i === 2 ? 'bg-sky-500' : 'bg-teal-500'}`}
                      style={{ width: `${inst.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* System Health */}
          <div className="card cursor-pointer hover:border-slate-300 transition-colors" onClick={() => setHealthModal(true)}>
            <div className="flex items-center justify-between mb-2">
              <p className="section-title mb-0">System Health</p>
              <span className="text-[11px] font-bold text-indigo-600 hover:underline">Inspect →</span>
            </div>
            <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span className="text-[12.5px] font-semibold text-emerald-700">{d.systemHealth.status}</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Server Uptime',   value: d.systemHealth.serverUptime,   icon: Server,     good: true },
                { label: 'Response Time',   value: d.systemHealth.responseTime,   icon: Clock,      good: true },
                { label: 'Active Backups',  value: d.systemHealth.activeBackups,  icon: HardDrive,  good: true },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="text-[12.5px] text-slate-600">{item.label}</span>
                    </div>
                    <span className={`text-[13px] font-bold ${item.good ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 3: Recent Registrations + Revenue + Support Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Recent Registrations */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <p className="section-title mb-0">Recent Registrations</p>
            </div>
            <div className="space-y-2">
              {d.recentRegistrations.map((r, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                    r.type === 'Institute' ? 'bg-violet-100' : r.type === 'Teacher' ? 'bg-emerald-100' : 'bg-sky-100'
                  }`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${r.type === 'Institute' ? 'text-violet-600' : r.type === 'Teacher' ? 'text-emerald-600' : 'text-sky-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-medium text-slate-700 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.time}</p>
                  </div>
                  <span className={`chip text-[10px] ${
                    r.type === 'Institute' ? 'bg-violet-50 text-violet-700' :
                    r.type === 'Teacher'   ? 'bg-emerald-50 text-emerald-700' :
                    'bg-sky-50 text-sky-700'
                  }`}>
                    {r.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue Overview */}
          <div className="card">
            <p className="section-title">Revenue Overview</p>
            <p className="text-[11px] text-slate-400 mb-3">₹ in Lakhs</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={d.revenueData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={(v: number) => [`₹${v}L`, 'Revenue']}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <TicketsDonut data={d.supportTickets} />
        </div>
      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: INSTITUTE DETAILS ── */}
      {(selectedInst || viewAllInsts) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[60vw] max-h-[85vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedInst ? `Institute Performance: ${selectedInst.name}` : 'All Top Performing Institutes'}
              </h3>
              <button onClick={() => { setSelectedInst(null); setViewAllInsts(false); }} className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              {d.topInstitutes.map((inst, i) => (
                <div key={inst.name} className="p-4 bg-white rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-[12px] flex items-center justify-center">{inst.rank}</span>
                    <div>
                      <p className="font-bold text-slate-800 text-[14px]">{inst.name}</p>
                      <p className="text-[11px] text-slate-400">Score: {inst.score}%</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Top Tier</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => { setSelectedInst(null); setViewAllInsts(false); }} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD: SYSTEM HEALTH ── */}
      {healthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-800">System Telemetry & Status</h3>
              <button onClick={() => setHealthModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-3 bg-slate-50 text-[12px]">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="font-bold text-emerald-800">{d.systemHealth.status}</p>
                  <p className="text-[11px] text-emerald-600">All primary clusters operating within normal latency parameters.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Server Uptime</span>
                  <strong className="text-slate-800">{d.systemHealth.serverUptime}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Response Time</span>
                  <strong className="text-emerald-600">{d.systemHealth.responseTime}</strong>
                </div>
                <div className="p-3 bg-white border border-slate-200 rounded-xl">
                  <span className="text-slate-400 text-[10px] block">Active Backups</span>
                  <strong className="text-slate-800">{d.systemHealth.activeBackups}</strong>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setHealthModal(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Telemetry</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
