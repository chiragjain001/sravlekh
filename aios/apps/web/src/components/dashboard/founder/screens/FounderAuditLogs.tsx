'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  Search, Download, ShieldAlert, ShieldCheck, Clock,
  FileText, Trash2, ArrowRight, Sparkles, CheckCircle2,
  ChevronUp, ChevronDown, MoreHorizontal, AlertTriangle, Key, UserCheck, X
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  time: string;
  actor: string;
  role: string;
  institute: string;
  module: string;
  action: string;
  risk: 'High' | 'Medium' | 'Low';
  status: 'Success' | 'Failed' | 'Blocked';
  ip: string;
  avatar: string;
  details: string;
  beforeJson: Record<string, any>;
  afterJson: Record<string, any>;
}

const AUDIT_LOGS_MOCK: AuditLogEntry[] = [
  {
    id: 'LOG-9021', time: '10:45 AM', actor: 'Rohan Verma', role: 'Teacher', institute: 'Allen Jaipur', module: 'Exam', action: 'Updated Paper', risk: 'Medium', status: 'Success', ip: '103.21.45.78', avatar: 'RV',
    details: 'Changed passing marks from 120 to 100 for JEE Main Paper 04',
    beforeJson: { paper_name: 'JEE Main Mock Test 01', total_marks: 300, passing_marks: 120, require_proctoring: false, show_solutions: true },
    afterJson:  { paper_name: 'JEE Main Mock Test 01 (Revised)', total_marks: 300, passing_marks: 100, require_proctoring: true, show_solutions: true },
  },
  {
    id: 'LOG-9022', time: '10:32 AM', actor: 'Super Admin', role: 'Admin', institute: 'AIOS Platform', module: 'Exam', action: 'Unlocked Exam', risk: 'High', status: 'Success', ip: '103.21.45.78', avatar: 'SA',
    details: 'Force unlocked exam session for student cohort Batch 12A',
    beforeJson: { session_locked: true, override_reason: 'None', max_retries: 1 },
    afterJson:  { session_locked: false, override_reason: 'Admin Unlock Request', max_retries: 3 },
  },
  {
    id: 'LOG-9023', time: '10:15 AM', actor: 'Priya Sharma', role: 'Admin', institute: 'Resonance Delhi', module: 'Students', action: 'Deleted Students', risk: 'High', status: 'Success', ip: '103.21.45.78', avatar: 'PS',
    details: 'Permanently deleted 25 inactive student records from database',
    beforeJson: { active_students: 4200, archive_count: 25 },
    afterJson:  { active_students: 4175, archive_count: 0 },
  },
  {
    id: 'LOG-9024', time: '09:58 AM', actor: 'Super Admin', role: 'Admin', institute: 'AIOS Platform', module: 'Settings', action: 'Config Updated', risk: 'Medium', status: 'Success', ip: '103.21.45.78', avatar: 'SA',
    details: 'Updated global OpenAI API key and set timeout threshold to 30s',
    beforeJson: { ai_model: 'gpt-3.5-turbo', max_tokens: 2048, timeout_sec: 15 },
    afterJson:  { ai_model: 'gpt-4o', max_tokens: 4096, timeout_sec: 30 },
  },
  {
    id: 'LOG-9025', time: '09:42 AM', actor: 'Ankit Kumar', role: 'Teacher', institute: 'FIITJEE Noida', module: 'Finance', action: 'Uploaded File', risk: 'Low', status: 'Success', ip: '103.21.45.78', avatar: 'AK',
    details: 'Uploaded fee receipt batch CSV containing 120 transactions',
    beforeJson: { file_name: 'receipts_old.csv', record_count: 0 },
    afterJson:  { file_name: 'fee_batch_may2025.csv', record_count: 120 },
  },
  {
    id: 'LOG-9026', time: '09:20 AM', actor: 'Pooja Singh', role: 'Teacher', institute: 'Aakash Kota', module: 'Content', action: 'Uploaded File', risk: 'Low', status: 'Success', ip: '103.21.45.78', avatar: 'PS',
    details: 'Uploaded 45 question bank items for NEET Organic Chemistry',
    beforeJson: { questions_total: 1250 },
    afterJson:  { questions_total: 1295 },
  },
  {
    id: 'LOG-9027', time: '08:50 AM', actor: 'System', role: 'System', institute: 'AIOS Platform', module: 'System', action: 'User Login', risk: 'Low', status: 'Success', ip: '103.21.45.78', avatar: 'SY',
    details: 'Automated system maintenance check completed cleanly',
    beforeJson: { system_status: 'checking' },
    afterJson:  { system_status: 'healthy' },
  },
  {
    id: 'LOG-9028', time: '08:15 AM', actor: 'Rohan Verma', role: 'Teacher', institute: 'Allen Jaipur', module: 'Exam', action: 'Created Paper', risk: 'Medium', status: 'Success', ip: '103.21.45.78', avatar: 'RV',
    details: 'Created new mock paper: Physics Chapterwise Assessment 02',
    beforeJson: { paper_id: null },
    afterJson:  { paper_id: 'PAP-99201', subject: 'Physics' },
  },
];

export function FounderAuditLogs() {
  const [search, setSearch]             = useState('');
  const [instituteFilter, setInstFilter] = useState('All');
  const [riskFilter, setRiskFilter]       = useState('All');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [selectedLog, setSelectedLog]   = useState<AuditLogEntry>(AUDIT_LOGS_MOCK[0]!);
  const [modalOpen, setModalOpen]       = useState(false);
  const [sortKey, setSortKey]           = useState('time');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');
  const [page, setPage]                 = useState(1);
  const PER_PAGE = 6;

  const filtered = useMemo(() => {
    let rows = [...AUDIT_LOGS_MOCK];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.actor.toLowerCase().includes(q) || r.action.toLowerCase().includes(q) || r.institute.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (instituteFilter !== 'All') rows = rows.filter(r => r.institute.includes(instituteFilter));
    if (riskFilter !== 'All') rows = rows.filter(r => r.risk === riskFilter);
    if (moduleFilter !== 'All') rows = rows.filter(r => r.module === moduleFilter);
    return rows;
  }, [search, instituteFilter, riskFilter, moduleFilter]);

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

  const handleOpenInspect = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Audit Logs"
        subtitle="Track and analyze all platform activities with forensic precision"
        rightContent={
          <div className="flex items-center gap-2">
            <select value={instituteFilter} onChange={e => setInstFilter(e.target.value)}
              className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option value="All">All Institutes</option><option value="Allen">Allen</option><option value="Resonance">Resonance</option><option value="FIITJEE">FIITJEE</option>
            </select>
            <select className="text-[12px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-400 shadow-2xs">
              <option>May 2025</option><option>Apr 2025</option>
            </select>
          </div>
        }
      />

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── TOP KPI BAR (8 Key Forensic Metrics) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: "Today's Events", val: '18,642', change: '+18.5%', up: true },
            { label: 'Critical Events', val: '142', change: '+6.2%', up: true },
            { label: 'Security Events', val: '286', change: '+15.7%', up: true },
            { label: 'Data Changes', val: '3,562', change: '+5.2%', up: true },
            { label: 'Login Attempts', val: '24,851', change: '+22.8%', up: true },
            { label: 'Failed Logins', val: '312', change: '+8.8%', up: true },
            { label: 'Permission Changes', val: '178', change: '+6.3%', up: true },
            { label: 'Deleted Records', val: '92', change: '-3.1%', up: false },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 hover:shadow-md transition-shadow">
              <p className="text-[10.5px] font-medium text-slate-500 mb-1">{k.label}</p>
              <p className="text-[16px] font-bold text-slate-800 leading-none">{k.val}</p>
              <span className={`text-[10px] font-semibold mt-1.5 inline-block ${k.up ? 'text-emerald-600' : 'text-rose-600'}`}>
                {k.change}
              </span>
            </div>
          ))}
        </div>

        {/* ── FULL WIDTH AUDIT LOGS TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
              <div className="relative min-w-[240px] max-w-md flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search by log ID, user, action, module or institute..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium bg-white shadow-2xs" />
              </div>

              <select value={riskFilter} onChange={e => { setRiskFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Risk: All</option><option value="High">High Risk</option><option value="Medium">Medium Risk</option><option value="Low">Low Risk</option>
              </select>

              <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Module: All</option><option value="Exam">Exam</option><option value="Students">Students</option><option value="Settings">Settings</option><option value="Finance">Finance</option><option value="Content">Content</option>
              </select>
            </div>

            <button className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export Audit Log
            </button>
          </div>

          {/* Full Width Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th onClick={() => toggleSort('id')} className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 select-none text-slate-600">
                    <span className="inline-flex items-center">Log ID<SortIcon k="id" /></span>
                  </th>
                  <th onClick={() => toggleSort('time')} className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 select-none text-slate-600">
                    <span className="inline-flex items-center">Time<SortIcon k="time" /></span>
                  </th>
                  <th onClick={() => toggleSort('actor')} className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 select-none text-slate-600">
                    <span className="inline-flex items-center">Actor<SortIcon k="actor" /></span>
                  </th>
                  <th className="px-3.5 py-3 text-slate-600">Role</th>
                  <th onClick={() => toggleSort('institute')} className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 select-none text-slate-600">
                    <span className="inline-flex items-center">Institute<SortIcon k="institute" /></span>
                  </th>
                  <th className="px-3.5 py-3 text-slate-600">Module</th>
                  <th className="px-3.5 py-3 text-slate-600">Action</th>
                  <th className="px-3.5 py-3 text-slate-600">Event Details</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">Risk</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">Status</th>
                  <th className="px-3.5 py-3 text-right text-slate-600">IP Address</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.length === 0 && (
                  <tr><td colSpan={12} className="text-center py-12 text-slate-400 text-[13px]">No audit log entries matching filters</td></tr>
                )}
                {pageRows.map((row) => (
                  <tr key={row.id} onClick={() => handleOpenInspect(row)}
                    className={`hover:bg-indigo-50/30 transition-colors cursor-pointer group ${selectedLog.id === row.id ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="px-3.5 py-3 font-bold text-indigo-600 text-[11.5px] whitespace-nowrap">{row.id}</td>
                    <td className="px-3.5 py-3 text-slate-500 whitespace-nowrap text-[11px]">{row.time}</td>
                    <td className="px-3.5 py-3 font-bold text-slate-800 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{row.actor}</td>
                    <td className="px-3.5 py-3 text-slate-500 text-[11px]">{row.role}</td>
                    <td className="px-3.5 py-3 text-slate-700 font-medium whitespace-nowrap">{row.institute}</td>
                    <td className="px-3.5 py-3 text-slate-600 font-semibold">{row.module}</td>
                    <td className="px-3.5 py-3 text-slate-800 font-bold">{row.action}</td>
                    <td className="px-3.5 py-3 text-slate-500 max-w-[280px] truncate text-[11.5px]">{row.details}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${row.risk === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' : row.risk === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {row.risk}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-center">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right text-slate-500 font-mono text-[11px]">{row.ip}</td>
                    <td className="px-3.5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenInspect(row); }} className="text-[11px] font-bold text-indigo-600 hover:underline">
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[12px] text-slate-500">
            <span className="font-medium">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} audit records</span>
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

        {/* ── BELOW TABLE PANELS ── */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Forensic Intelligence & Activity Stream
              </h3>
              <p className="text-[12px] text-slate-500">Live streaming activity timeline, code diff inspection for selected log, and security risk indicators</p>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">Live Telemetry Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Col 1: Live Activity Timeline */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" /> Activity Stream
                </h4>
                <span className="text-[9.5px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">Live Stream</span>
              </div>

              <div className="space-y-3 my-auto relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {AUDIT_LOGS_MOCK.slice(0, 4).map((item) => (
                  <div key={item.id} className="relative pl-7 cursor-pointer" onClick={() => handleOpenInspect(item)}>
                    <span className="absolute left-1.5 top-1 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[8px] ring-4 ring-white">
                      •
                    </span>
                    <div className={`p-2.5 rounded-lg border transition-all ${selectedLog.id === item.id ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50/60 border-slate-100 hover:border-slate-200'}`}>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span className="font-semibold text-slate-500">{item.time}</span>
                        <span className={`font-bold px-1.5 py-0.2 rounded ${item.risk === 'High' ? 'bg-rose-50 text-rose-600' : item.risk === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{item.risk} Risk</span>
                      </div>
                      <p className="text-[11.5px] font-bold text-slate-800 leading-tight">{item.actor} <span className="font-normal text-slate-600">{item.action}</span></p>
                      <p className="text-[10px] text-slate-500 mt-1 line-clamp-1">{item.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Col 2: Diff Viewer for Selected Record */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" /> Diff Viewer
                </h4>
                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono">{selectedLog.id}</span>
              </div>

              <div className="space-y-2 my-auto">
                <div className="text-[11px] font-semibold text-slate-700 bg-slate-50 p-2 rounded border border-slate-100 flex justify-between">
                  <span>Action: <strong>{selectedLog.action}</strong></span>
                  <span className="text-slate-500">{selectedLog.actor} ({selectedLog.role})</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10.5px] font-mono">
                  <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-2.5 space-y-1">
                    <p className="text-[9.5px] font-bold text-rose-700 uppercase mb-1">Before Change</p>
                    {Object.entries(selectedLog.beforeJson).map(([k, v]) => (
                      <p key={k} className="text-rose-900 truncate">- "{k}": "{String(v)}"</p>
                    ))}
                  </div>

                  <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-2.5 space-y-1">
                    <p className="text-[9.5px] font-bold text-emerald-700 uppercase mb-1">After Change</p>
                    {Object.entries(selectedLog.afterJson).map(([k, v]) => (
                      <p key={k} className="text-emerald-900 truncate">+ "{k}": "{String(v)}"</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Col 3: Intelligence Panel */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[13px] font-bold text-slate-800 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" /> Intelligence Radar
                </h4>
                <span className="text-[9.5px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">Security Radar</span>
              </div>

              <div className="space-y-3 my-auto">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-slate-700">Most Active System Actors</p>
                  {[
                    { name: 'Super Admin', count: '1,254 events' },
                    { name: 'Rohan Verma', count: '842 events' },
                    { name: 'Priya Sharma', count: '632 events' },
                  ].map((u, i) => (
                    <div key={i} className="flex justify-between items-center text-[10.5px] p-1.5 rounded bg-slate-50">
                      <span className="font-semibold text-slate-700">{i + 1}. {u.name}</span>
                      <span className="font-bold text-indigo-600">{u.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD: AUDIT LOG FORENSIC INSPECTOR ── */}
      {modalOpen && selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[65vw] max-h-[85vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{selectedLog.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedLog.risk === 'High' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{selectedLog.risk} Risk Event</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">✓ Verified Log</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{selectedLog.action} by {selectedLog.actor}</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <label className="text-slate-400 text-[11px] font-bold uppercase tracking-wider block mb-1">Event Summary</label>
                <p className="text-slate-800 font-semibold text-[13px]">{selectedLog.details}</p>
              </div>

              <div className="grid grid-cols-4 gap-3 text-[11.5px]">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Actor / User</span>
                  <span className="font-bold text-slate-800">{selectedLog.actor} ({selectedLog.role})</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Institute</span>
                  <span className="font-bold text-indigo-600">{selectedLog.institute}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Time & IP</span>
                  <span className="font-bold text-slate-700 font-mono">{selectedLog.time} · {selectedLog.ip}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Module</span>
                  <span className="font-bold text-slate-800">{selectedLog.module}</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-800 text-[13px]">Payload JSON State Diff Comparison</h4>
                <div className="grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl space-y-1">
                    <p className="text-[10px] font-bold text-rose-700 uppercase">State Before Modification</p>
                    <pre className="text-rose-900 whitespace-pre-wrap">{JSON.stringify(selectedLog.beforeJson, null, 2)}</pre>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl space-y-1">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase">State After Modification</p>
                    <pre className="text-emerald-900 whitespace-pre-wrap">{JSON.stringify(selectedLog.afterJson, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700">Close Inspection</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
