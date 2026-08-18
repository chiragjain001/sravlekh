'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  Search, Download, Plus, Sparkles, Clock, ShieldAlert,
  CheckCircle2, AlertTriangle, ArrowRight, Layers, Cpu,
  BarChart3, Activity, Users, Settings, Sliders, Play, Pause,
  RotateCcw, Eye, ChevronUp, ChevronDown, Check, X, Filter, FileText, Globe, Rocket
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  Tooltip, PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';

interface FeatureItem {
  id: string;
  name: string;
  desc: string;
  module: string;
  category: string;
  status: 'Stable' | 'Beta' | 'Experimental' | 'Deprecated';
  plans: ('Enterprise' | 'Premium' | 'Standard')[];
  institutesCount: string;
  activeUsers: string;
  usagePct: number;
  health: 'Excellent' | 'Good' | 'Warning' | 'Poor';
  errorRate: string;
  version: string;
  lastDeploy: string;
  owner: string;
  iconBg: string;
  rolloutPct: number;
  rolloutStrategy: 'Entire Platform' | 'Selected Institutes' | 'Beta Group' | 'Percentage';
}

const FEATURES_MOCK: FeatureItem[] = [
  { id: 'FEAT-101', name: 'Assessment Builder', desc: 'Create tests, exams & evaluations', module: 'Assessment', category: 'Assessment Builder', status: 'Stable', plans: ['Enterprise', 'Premium', 'Standard'], institutesCount: '2,042', activeUsers: '24,58,632', usagePct: 88, health: 'Excellent', errorRate: '0.12%', version: 'v2.4.12', lastDeploy: '23 May 2025', owner: 'Product Team', iconBg: 'bg-indigo-50 text-indigo-600', rolloutPct: 100, rolloutStrategy: 'Entire Platform' },
  { id: 'FEAT-102', name: 'AI Question Generator', desc: 'Generate questions using AI', module: 'AI Engine', category: 'AI Engine', status: 'Beta', plans: ['Enterprise', 'Premium'], institutesCount: '2,156', activeUsers: '18,56,213', usagePct: 78, health: 'Good', errorRate: '0.32%', version: 'v1.8.5', lastDeploy: '22 May 2025', owner: 'AI Team', iconBg: 'bg-purple-50 text-purple-600', rolloutPct: 85, rolloutStrategy: 'Selected Institutes' },
  { id: 'FEAT-103', name: 'Live Classes', desc: 'Conduct live interactive classes', module: 'Academic', category: 'Academic', status: 'Stable', plans: ['Enterprise', 'Premium', 'Standard'], institutesCount: '2,728', activeUsers: '21,34,992', usagePct: 84, health: 'Excellent', errorRate: '0.08%', version: 'v3.1.8', lastDeploy: '21 May 2025', owner: 'Academic Team', iconBg: 'bg-emerald-50 text-emerald-600', rolloutPct: 100, rolloutStrategy: 'Entire Platform' },
  { id: 'FEAT-104', name: 'Offline Mode', desc: 'Access content without internet', module: 'Student', category: 'Student Management', status: 'Experimental', plans: ['Enterprise'], institutesCount: '415', activeUsers: '1,23,661', usagePct: 12, health: 'Poor', errorRate: '2.45%', version: 'v0.3.2', lastDeploy: '18 May 2025', owner: 'Student Team', iconBg: 'bg-amber-50 text-amber-600', rolloutPct: 20, rolloutStrategy: 'Beta Group' },
  { id: 'FEAT-105', name: 'AI Recommendations', desc: 'Personalized learning suggestions', module: 'AI Engine', category: 'AI Engine', status: 'Beta', plans: ['Enterprise', 'Premium'], institutesCount: '1,987', activeUsers: '16,76,542', usagePct: 66, health: 'Good', errorRate: '0.28%', version: 'v1.6.1', lastDeploy: '20 May 2025', owner: 'AI Team', iconBg: 'bg-violet-50 text-violet-600', rolloutPct: 70, rolloutStrategy: 'Selected Institutes' },
  { id: 'FEAT-106', name: 'Fees Management', desc: 'Manage fees, invoices & payments', module: 'Billing', category: 'Billing', status: 'Stable', plans: ['Enterprise', 'Premium', 'Standard'], institutesCount: '2,801', activeUsers: '22,45,118', usagePct: 91, health: 'Excellent', errorRate: '0.05%', version: 'v2.2.8', lastDeploy: '23 May 2025', owner: 'Finance Team', iconBg: 'bg-sky-50 text-sky-600', rolloutPct: 100, rolloutStrategy: 'Entire Platform' },
  { id: 'FEAT-107', name: 'Chat & Messaging', desc: 'In-app communication center', module: 'Communication', category: 'Communication', status: 'Stable', plans: ['Enterprise', 'Premium', 'Standard'], institutesCount: '2,623', activeUsers: '20,14,381', usagePct: 87, health: 'Excellent', errorRate: '0.10%', version: 'v2.3.6', lastDeploy: '22 May 2025', owner: 'Comm. Team', iconBg: 'bg-teal-50 text-teal-600', rolloutPct: 100, rolloutStrategy: 'Entire Platform' },
  { id: 'FEAT-108', name: 'Advanced Analytics', desc: 'Deep analytics and insights', module: 'Analytics', category: 'Analytics', status: 'Beta', plans: ['Enterprise', 'Premium'], institutesCount: '1,563', activeUsers: '11,09,244', usagePct: 54, health: 'Good', errorRate: '0.45%', version: 'v1.9.2', lastDeploy: '19 May 2025', owner: 'Analytics Team', iconBg: 'bg-blue-50 text-blue-600', rolloutPct: 60, rolloutStrategy: 'Selected Institutes' },
];

const CATEGORIES_MOCK = [
  { name: 'Academic', count: 26, pct: 78 },
  { name: 'Assessment Builder', count: 16, pct: 87 },
  { name: 'Question Bank', count: 22, pct: 68 },
  { name: 'Student Management', count: 18, pct: 74 },
  { name: 'Teacher Management', count: 14, pct: 81 },
  { name: 'Attendance', count: 12, pct: 73 },
  { name: 'Assignments', count: 11, pct: 77 },
  { name: 'Analytics', count: 19, pct: 71 },
  { name: 'AI Engine', count: 15, pct: 82 },
  { name: 'Billing', count: 10, pct: 90 },
  { name: 'Communication', count: 13, pct: 85 },
  { name: 'Security & Auth', count: 8, pct: 95 },
  { name: 'Reports & Exports', count: 9, pct: 76 },
];

const ADOPTION_TREND_DATA = [
  { month: 'Jan', adoption: 62 },
  { month: 'Feb', adoption: 68 },
  { month: 'Mar', adoption: 71 },
  { month: 'Apr', adoption: 74 },
  { month: 'May', adoption: 76.3 },
];

const USAGE_DISTRIBUTION_DATA = [
  { name: 'High (70%+)', pct: 42, fill: '#4f46e5' },
  { name: 'Medium (40-70%)', pct: 35, fill: '#0ea5e9' },
  { name: 'Low (10-40%)', pct: 17, fill: '#f59e0b' },
  { name: 'Very Low (<10%)', pct: 6, fill: '#f43f5e' },
];

const TOP_MODULES_USAGE = [
  { name: 'Assessment', users: '24,58,632', val: 24.58 },
  { name: 'Academic', users: '22,78,341', val: 22.78 },
  { name: 'Communication', users: '20,14,381', val: 20.14 },
  { name: 'Student', users: '16,25,119', val: 16.25 },
  { name: 'Analytics', users: '11,09,244', val: 11.09 },
];

const UPCOMING_RELEASES = [
  { name: 'AI Exam Proctoring', version: 'v1.0.0', date: '26 May' },
  { name: 'Advanced Reports', version: 'v2.5.0', date: '28 May' },
  { name: 'Mobile App', version: 'v1.4.0', date: '02 Jun' },
  { name: 'Parent Portal', version: 'v1.2.0', date: '05 Jun' },
  { name: 'Gamification', version: 'v1.2.0', date: '10 Jun' },
];

export function FounderFeatureManagement() {
  const [search, setSearch]                 = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter]     = useState('All');
  const [selectedCategory, setSelectedCat]  = useState<string | null>(null);
  const [selectedFeature, setSelectedFeat]  = useState<FeatureItem | null>(FEATURES_MOCK[0]!);
  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [aiModalOpen, setAiModalOpen]       = useState(false);
  const [categoriesModalOpen, setCatModal]  = useState(false);
  const [page, setPage]                     = useState(1);
  const PER_PAGE = 8;

  const filteredFeatures = useMemo(() => {
    let rows = [...FEATURES_MOCK];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(f => f.name.toLowerCase().includes(q) || f.module.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'All') rows = rows.filter(f => f.category.includes(categoryFilter));
    if (statusFilter !== 'All') rows = rows.filter(f => f.status === statusFilter);
    if (selectedCategory) rows = rows.filter(f => f.category === selectedCategory);
    return rows;
  }, [search, categoryFilter, statusFilter, selectedCategory]);

  const pageRows = filteredFeatures.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Feature Management"
        subtitle="Manage, monitor and optimize platform features and releases"
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
            { label: 'Total Features', val: '238', sub: '+1.4%', up: true },
            { label: 'Enabled Features', val: '178', sub: '74.8%', up: true },
            { label: 'Beta Features', val: '42', sub: '18%', up: true },
            { label: 'Experimental', val: '12', sub: '+2%', up: true },
            { label: 'Deprecated', val: '6', sub: '-1%', up: false },
            { label: 'Platform Adoption', val: '76.3%', sub: '+6.5%', up: true },
            { label: 'Most Used Feature', val: 'Assessment', sub: '88% Adoption', up: true },
            { label: 'Least Used Feature', val: 'Offline Mode', sub: '12% Adoption', up: false },
            { label: 'Avg. Feature Usage', val: '63.2%', sub: '+5.8%', up: true },
            { label: 'Feature Errors Today', val: '23', sub: '-18%', up: false },
            { label: 'Rollback Count', val: '7', sub: 'This Month', up: false },
            { label: 'Upcoming Releases', val: '5', sub: 'Next 30 Days', up: true },
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

        {/* ── TOOLBAR & FILTERS ── */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative min-w-[240px] max-w-md flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search features by name, module or description..."
                className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium bg-white shadow-2xs" />
            </div>

            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
              <option value="All">Category: All</option><option value="Assessment">Assessment</option><option value="Academic">Academic</option><option value="AI Engine">AI Engine</option><option value="Billing">Billing</option>
            </select>

            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
              <option value="All">Status: All</option><option value="Stable">Stable</option><option value="Beta">Beta</option><option value="Experimental">Experimental</option>
            </select>

            <select className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
              <option>Plan: All</option><option>Enterprise</option><option>Premium</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export
            </button>
            <button onClick={() => { setSelectedFeat(FEATURES_MOCK[0]!); setDrawerOpen(true); }} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Create Feature
            </button>
          </div>
        </div>

        {/* ── PRIMARY DATA TABLE: 100% FULL-WIDTH ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-800">All Platform Features ({filteredFeatures.length})</h3>
              {selectedCategory && (
                <span className="text-[10.5px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                  Filtered by: {selectedCategory}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-500 font-medium">Showing {pageRows.length} of {filteredFeatures.length} features</span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[11.5px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="px-4 py-3">Feature</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Enabled Plans</th>
                  <th className="px-4 py-3 text-right">Institutes</th>
                  <th className="px-4 py-3 text-right">Active Users</th>
                  <th className="px-4 py-3 text-center">Usage %</th>
                  <th className="px-4 py-3 text-center">Health</th>
                  <th className="px-4 py-3 text-right">Error Rate</th>
                  <th className="px-4 py-3 font-mono">Version</th>
                  <th className="px-4 py-3 text-slate-400">Last Deployment</th>
                  <th className="px-4 py-3">Owner Team</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((row) => (
                  <tr key={row.id} onClick={() => { setSelectedFeat(row); setDrawerOpen(true); }}
                    className={`hover:bg-indigo-50/30 transition-colors cursor-pointer group ${selectedFeature?.id === row.id ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[12px] ${row.iconBg}`}>
                          {row.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-[12.5px] group-hover:text-indigo-600 transition-colors">{row.name}</p>
                          <p className="text-[10.5px] text-slate-400">{row.desc}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-semibold">{row.module}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${row.status === 'Stable' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : row.status === 'Beta' ? 'bg-sky-50 text-sky-700 border-sky-200' : row.status === 'Experimental' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="w-4 h-4 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center">E</span>
                        <span className="w-4 h-4 rounded bg-sky-100 text-sky-700 text-[9px] font-bold flex items-center justify-center">P</span>
                        <span className="w-4 h-4 rounded bg-amber-100 text-amber-700 text-[9px] font-bold flex items-center justify-center">S</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-slate-700">{row.institutesCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-600 font-semibold">{row.activeUsers}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${row.usagePct}%` }} />
                        </div>
                        <span className="font-bold text-slate-800 text-[11px]">{row.usagePct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10.5px] font-bold ${row.health === 'Excellent' ? 'text-emerald-600' : row.health === 'Good' ? 'text-sky-600' : row.health === 'Warning' ? 'text-amber-600' : 'text-rose-600'}`}>
                        {row.health}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-500">{row.errorRate}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{row.version}</td>
                    <td className="px-4 py-3 text-slate-400 text-[10.5px]">{row.lastDeploy}</td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{row.owner}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedFeat(row); setDrawerOpen(true); }} className="text-[11px] font-bold text-indigo-600 hover:underline">Inspect →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11.5px] text-slate-500">
            <span>Showing 1 to {pageRows.length} of {filteredFeatures.length} features</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setPage(1)} className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${page === 1 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>1</button>
              <button onClick={() => setPage(2)} className={`px-3 py-1 rounded-lg text-[11px] font-bold border ${page === 2 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}>2</button>
            </div>
          </div>
        </div>

        {/* ── SECONDARY PANELS BELOW TABLE (STRUCTURED 3-COLUMN EVEN GRID LAYOUT) ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

          {/* Panel 1: Feature Categories Grid */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h3 className="text-sm font-bold text-slate-800">Feature Categories</h3>
                <button onClick={() => setCatModal(true)} className="text-[11px] text-indigo-600 hover:underline font-semibold cursor-pointer">View All →</button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
                {CATEGORIES_MOCK.slice(0, 8).map((cat) => (
                  <button key={cat.name} onClick={() => setSelectedCat(selectedCategory === cat.name ? null : cat.name)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${selectedCategory === cat.name ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' : 'bg-slate-50/60 border-slate-100 hover:bg-slate-100 text-slate-700 font-medium'}`}>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">({cat.count})</span>
                    </div>
                    <span className="font-bold text-emerald-600 text-[11px] ml-1">{cat.pct}%</span>
                  </button>
                ))}
              </div>
            </div>

            <button onClick={() => setCatModal(true)} className="w-full py-2 text-[11px] font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50/50 rounded-lg border border-slate-200 text-center transition-colors cursor-pointer">
              + 5 More Categories Available
            </button>
          </div>

          {/* Panel 2: Feature Intelligence Radar */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 space-y-3 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Feature Intelligence
                </h3>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">Live AI</span>
              </div>

              <div className="space-y-3 text-[11.5px]">
                <div>
                  <p className="font-bold text-slate-700 mb-1">Most Adopted Features</p>
                  {[
                    { name: 'Assessment Builder', pct: '88%' },
                    { name: 'Live Classes', pct: '84%' },
                    { name: 'Fees Management', pct: '91%' },
                    { name: 'Chat & Messaging', pct: '87%' },
                  ].map(item => (
                    <div key={item.name} className="flex justify-between items-center py-0.5 border-b border-slate-50 text-[11px]">
                      <span className="text-slate-600 font-medium">{item.name}</span>
                      <span className="font-bold text-indigo-600">{item.pct}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="font-bold text-slate-700 mb-1">Features With Highest Errors</p>
                  {[
                    { name: 'Offline Mode', err: '2.45%' },
                    { name: 'AI Report Generator', err: '1.36%' },
                  ].map(item => (
                    <div key={item.name} className="flex justify-between items-center py-0.5 border-b border-slate-50 text-[11px]">
                      <span className="text-slate-600 font-medium">{item.name}</span>
                      <span className="font-bold text-rose-600">{item.err}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Panel 3: Feature Adoption & Health Visualizations */}
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4 space-y-4 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-800 pb-2 border-b border-slate-100">Adoption & Health Trends</h3>

            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-bold text-slate-700 mb-1">Feature Adoption Trend (5 Months)</p>
                <div className="h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ADOPTION_TREND_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} domain={[50, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="adoption" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-slate-700 mb-1">Usage Breakdown</p>
                <div className="flex items-center gap-3 text-[10.5px]">
                  {USAGE_DISTRIBUTION_DATA.map(d => (
                    <div key={d.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                      <span className="text-slate-600 font-medium">{d.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ── BOTTOM ROW: TOP MODULES & UPCOMING RELEASES ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
            <h4 className="text-sm font-bold text-slate-800 mb-1">Top Platform Modules by Usage</h4>
            <p className="text-[11px] text-slate-400 mb-3">Active user volume across core capabilities</p>
            <div className="space-y-2 text-[11.5px]">
              {TOP_MODULES_USAGE.map(m => (
                <div key={m.name} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-700 font-bold">{m.name}</span>
                  <span className="font-mono text-indigo-600 font-bold">{m.users} Users</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-4">
            <h4 className="text-sm font-bold text-slate-800 mb-1">Upcoming Platform Releases</h4>
            <p className="text-[11px] text-slate-400 mb-3">Scheduled feature deployments for next 30 days</p>
            <div className="space-y-2 text-[11.5px]">
              {UPCOMING_RELEASES.map(r => (
                <div key={r.name} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-slate-800 font-semibold">{r.name} <span className="text-slate-400 font-mono text-[10.5px]">({r.version})</span></span>
                  <span className="font-bold text-emerald-600">{r.date}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── AI RECOMMENDATION FULL-WIDTH BANNER CARD ── */}
        <div className="w-full bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4 border border-indigo-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">AI Recommendation</span>
                <span className="text-[9.5px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-semibold border border-indigo-400/30">Automated Insight</span>
              </div>
              <p className="text-[12.5px] font-medium text-slate-200 mt-0.5">
                Consider rolling out <strong className="text-white font-bold">'AI Recommendations'</strong> to more institutes. High engagement predicted.
              </p>
            </div>
          </div>
          <button onClick={() => setAiModalOpen(true)} className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm whitespace-nowrap cursor-pointer">
            View AI Insights →
          </button>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: FEATURE DETAIL & EDIT ── */}
      {drawerOpen && selectedFeature && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[65vw] max-h-[85vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{selectedFeature.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedFeature.status === 'Stable' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}`}>{selectedFeature.status}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{selectedFeature.name}</h3>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 bg-slate-50/50">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <label className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Feature Overview & Description</label>
                <p className="text-slate-800 font-semibold text-[13px]">{selectedFeature.desc}</p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Owner Team</span>
                  <span className="font-bold text-slate-800 text-[13px]">{selectedFeature.owner}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Current Version</span>
                  <span className="font-bold text-indigo-600 font-mono text-[13px]">{selectedFeature.version}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Active Users</span>
                  <span className="font-bold text-emerald-600 font-mono text-[13px]">{selectedFeature.activeUsers}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="font-bold text-slate-800 text-[13px]">Rollout Percentage Control</label>
                  <span className="font-bold text-indigo-600 font-mono text-[14px] bg-indigo-50 px-2.5 py-0.5 rounded">{selectedFeature.rolloutPct}%</span>
                </div>
                <input type="range" min="0" max="100" defaultValue={selectedFeature.rolloutPct} className="w-full accent-indigo-600 cursor-pointer" />
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 text-[13px] block">Target Rollout Strategy</label>
                <select defaultValue={selectedFeature.rolloutStrategy} className="w-full p-2.5 border border-slate-200 rounded-xl text-slate-700 font-medium text-[12.5px]">
                  <option>Entire Platform</option>
                  <option>Selected Institutes</option>
                  <option>Beta Group</option>
                  <option>Percentage</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setDrawerOpen(false)} className="px-4 py-2 text-[12px] font-bold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={() => setDrawerOpen(false)} className="px-5 py-2 text-[12px] font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-xs">
                Save Rollout Config
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY MODAL CARD: AI INSIGHTS & RECOMMENDATIONS MODAL ── */}
      {aiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">AI Predictive Insights & Recommendations</h3>
              </div>
              <button onClick={() => setAiModalOpen(false)} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50">
              <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">High Growth Forecast</span>
                <h4 className="font-bold text-slate-800 text-[14px]">Expand 'AI Recommendations' Rollout</h4>
                <p className="text-[12px] text-slate-600 leading-relaxed">
                  Analytics show that institutes using the AI Recommendations engine exhibit a <strong>34% increase in student engagement</strong> and <strong>18% improvement</strong> in assessment completion rates.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200">
                  <p className="text-[11px] text-slate-400 font-semibold">Recommended Target</p>
                  <p className="text-xl font-bold text-indigo-600 mt-0.5">Top 50 Tier-1 Institutes</p>
                </div>
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200">
                  <p className="text-[11px] text-slate-400 font-semibold">Predicted Engagement Impact</p>
                  <p className="text-xl font-bold text-emerald-600 mt-0.5">+42% Active Use</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setAiModalOpen(false)} className="px-4 py-2 text-[12px] font-bold border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50">Close</button>
              <button onClick={() => { setAiModalOpen(false); alert('AI Rollout initiated to Tier-1 Institutes!'); }} className="px-5 py-2 text-[12px] font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Apply AI Recommendation</button>
            </div>
          </div>
        </div>
      )}

      {/* ── OVERLAY MODAL CARD: ALL CATEGORIES MODAL ── */}
      {categoriesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-800">All Feature Categories ({CATEGORIES_MOCK.length})</h3>
              <button onClick={() => setCatModal(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-slate-50/50">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                {CATEGORIES_MOCK.map(cat => (
                  <div key={cat.name} className="p-3 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-800">{cat.name}</p>
                      <span className="text-[10.5px] text-slate-400 font-medium">{cat.count} Features</span>
                    </div>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">{cat.pct}% Usage</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-white flex justify-end">
              <button onClick={() => setCatModal(false)} className="px-4 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
