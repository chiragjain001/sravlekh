'use client';

import { useState, useMemo } from 'react';
import { TopHeader } from '@/components/shared/TopHeader';
import {
  Search, Download, Plus, MessageSquare, Clock, ShieldAlert,
  Sparkles, CheckCircle2, User, Paperclip, Send, ChevronUp, ChevronDown,
  ArrowRight, PieChart as PieIcon, ThumbsUp, AlertCircle, RefreshCw, Filter, X
} from 'lucide-react';
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip,
} from 'recharts';

interface Ticket {
  id: string;
  institute: string;
  subject: string;
  category: 'Students' | 'Assessment' | 'Billing' | 'Technical' | 'Doubt';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  assignedTo: string;
  lastReply: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  sla: string;
  csat: string;
}

const TICKETS_MOCK: Ticket[] = [
  { id: 'TXT-84231', institute: 'Allen Jaipur', subject: 'Unable to upload students in bulk', category: 'Students', priority: 'High', assignedTo: 'Rahul Singh', lastReply: '10m ago', status: 'Open', sla: '1h 32m', csat: '8/10' },
  { id: 'TXT-84238', institute: 'Resonance Delhi', subject: 'AI paper generation failing', category: 'Assessment', priority: 'Critical', assignedTo: 'Neha Verma', lastReply: '25m ago', status: 'Open', sla: '35m', csat: '9/10' },
  { id: 'TXT-84279', institute: 'FIITJEE Noida', subject: 'Payment failed but amount debited', category: 'Billing', priority: 'High', assignedTo: 'Amit Kumar', lastReply: '42m ago', status: 'Open', sla: '2h 10m', csat: '7/10' },
  { id: 'TXT-84326', institute: 'Aakash Kota', subject: 'Exam results not publishing', category: 'Assessment', priority: 'Medium', assignedTo: 'Pooja Sharma', lastReply: '1h ago', status: 'In Progress', sla: '4h 20m', csat: '9/10' },
  { id: 'TXT-84327', institute: 'VMC Classes', subject: 'Mobile app not syncing data', category: 'Technical', priority: 'Medium', assignedTo: 'Saurabh Jain', lastReply: '1h ago', status: 'In Progress', sla: '5h 15m', csat: '8/10' },
  { id: 'TXT-84336', institute: 'Sri Chaitanya', subject: 'Need help with doubt feature', category: 'Doubt', priority: 'Low', assignedTo: 'Rajesh Ram', lastReply: '2h ago', status: 'Open', sla: '8h 00m', csat: '10/10' },
];

const CATEGORY_DISTRIBUTION = [
  { name: 'Technical', pct: 32, fill: '#8b5cf6' },
  { name: 'Assessment', pct: 24, fill: '#0ea5e9' },
  { name: 'Billing', pct: 18, fill: '#10b981' },
  { name: 'Students', pct: 14, fill: '#f59e0b' },
  { name: 'Others', pct: 12, fill: '#64748b' },
];

export function FounderTickets() {
  const [search, setSearch]             = useState('');
  const [priorityFilter, setPriority]   = useState('All');
  const [statusFilter, setStatus]       = useState('All');
  const [selectedTicket, setSelected]   = useState<Ticket>(TICKETS_MOCK[1]!);
  const [modalOpen, setModalOpen]       = useState(false);
  const [newTicketModal, setNewTicket]  = useState(false);
  const [replyText, setReplyText]       = useState('');
  const [sortKey, setSortKey]           = useState('id');
  const [sortDir, setSortDir]           = useState<'asc' | 'desc'>('desc');
  const [page, setPage]                 = useState(1);
  const PER_PAGE = 6;

  const filtered = useMemo(() => {
    let rows = [...TICKETS_MOCK];
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.id.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q) || r.institute.toLowerCase().includes(q));
    }
    if (priorityFilter !== 'All') rows = rows.filter(r => r.priority === priorityFilter);
    if (statusFilter !== 'All') rows = rows.filter(r => r.status === statusFilter);
    return rows;
  }, [search, priorityFilter, statusFilter]);

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

  const handleOpenTicket = (ticket: Ticket) => {
    setSelected(ticket);
    setModalOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#f8fafc]">
      <TopHeader
        greeting="Support Tickets"
        subtitle="Manage customer support and success operations"
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

      <div className="p-5 space-y-6 animate-fadein max-w-[1700px] mx-auto">
        {/* ── TOP KPI BAR (8 Support Operations Metrics) ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
          {[
            { label: 'Open Tickets', val: '845', change: '+8.2%', up: true },
            { label: 'Critical Tickets', val: '28', change: '-1.1%', up: false },
            { label: 'Avg Resolution Time', val: '4h 32m', change: '-15m', up: true },
            { label: 'SLA Compliance', val: '93.2%', change: '+2.1%', up: true },
            { label: 'CSAT Score', val: '4.6 / 5', change: '+0.2', up: true },
            { label: 'First Response Time', val: '18m', change: '-2m', up: true },
            { label: 'Escalated Tickets', val: '52', change: '+6.3%', up: true },
            { label: 'Pending Today', val: '126', change: '+18.2%', up: true },
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

        {/* ── FULL WIDTH SUPPORT TICKET TABLE ── */}
        <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          {/* Toolbar */}
          <div className="px-4 py-3.5 border-b border-slate-100 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
              <div className="relative min-w-[240px] max-w-md flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search Ticket ID, Subject or Institute..."
                  className="w-full pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-medium bg-white shadow-2xs" />
              </div>

              <select value={priorityFilter} onChange={e => { setPriority(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Priority: All</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option>
              </select>

              <select value={statusFilter} onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-600 font-medium focus:outline-none focus:border-indigo-500 shadow-2xs">
                <option value="All">Status: All</option><option value="Open">Open</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs bg-white">
                <Download className="w-3.5 h-3.5 text-slate-500" /> Export Tickets
              </button>
              <button onClick={() => setNewTicket(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-[11px] bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> New Ticket
              </button>
            </div>
          </div>

          {/* Full Width Table */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold">
                <tr>
                  <th onClick={() => toggleSort('id')} className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 select-none text-slate-600">
                    <span className="inline-flex items-center">Ticket ID<SortIcon k="id" /></span>
                  </th>
                  <th onClick={() => toggleSort('institute')} className="px-3.5 py-3 cursor-pointer hover:bg-slate-100 select-none text-slate-600">
                    <span className="inline-flex items-center">Institute<SortIcon k="institute" /></span>
                  </th>
                  <th className="px-3.5 py-3 text-slate-600">Subject</th>
                  <th className="px-3.5 py-3 text-slate-600">Category</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">Priority</th>
                  <th className="px-3.5 py-3 text-slate-600">Assigned To</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">Status</th>
                  <th className="px-3.5 py-3 text-right text-slate-600">SLA Remaining</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">CSAT</th>
                  <th className="px-3.5 py-3 text-center text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-12 text-slate-400 text-[13px]">No support tickets matching filters</td></tr>
                )}
                {pageRows.map((row) => (
                  <tr key={row.id} onClick={() => handleOpenTicket(row)}
                    className={`hover:bg-indigo-50/30 transition-colors cursor-pointer group ${selectedTicket.id === row.id ? 'bg-indigo-50/40 font-medium' : ''}`}>
                    <td className="px-3.5 py-3 font-bold text-indigo-600 text-[11.5px] whitespace-nowrap">{row.id}</td>
                    <td className="px-3.5 py-3 font-bold text-slate-800 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{row.institute}</td>
                    <td className="px-3.5 py-3 text-slate-700 font-medium max-w-[280px] truncate text-[11.5px]">{row.subject}</td>
                    <td className="px-3.5 py-3 text-slate-500">{row.category}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${row.priority === 'Critical' ? 'bg-rose-50 text-rose-700 border-rose-200' : row.priority === 'High' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {row.priority}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-slate-700 font-semibold whitespace-nowrap">{row.assignedTo}</td>
                    <td className="px-3.5 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${row.status === 'Open' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 text-right text-rose-600 font-bold whitespace-nowrap">{row.sla}</td>
                    <td className="px-3.5 py-3 text-center text-slate-700 font-bold text-[11px]">{row.csat}</td>
                    <td className="px-3.5 py-3 text-center">
                      <button onClick={(e) => { e.stopPropagation(); handleOpenTicket(row); }} className="text-[11px] font-bold text-indigo-600 hover:underline">
                        Open Thread
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[12px] text-slate-500">
            <span className="font-medium">Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} support tickets</span>
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
                <MessageSquare className="w-4 h-4 text-indigo-600" /> Support Intelligence & Category Analytics
              </h3>
              <p className="text-[12px] text-slate-500">Live ticket conversation overview, automated AI recommendations, and ticket category analytics</p>
            </div>
            <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">Copilot Active</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Col 1: AI Support Assistant & Copilot */}
            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-md p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-[13px] font-bold text-white">AI Support Copilot Summary</h4>
                </div>
                <span className="text-[9.5px] font-semibold bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded border border-indigo-400/30">Active</span>
              </div>

              <div className="space-y-2.5 my-auto text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 space-y-1">
                  <p className="font-bold text-indigo-300">AI Platform Sentiment Trend:</p>
                  <p className="text-slate-300">92% Positive customer resolution rate. Critical tickets average 35m first response speed.</p>
                </div>
              </div>
            </div>

            {/* Col 2: Category Analytics Chart */}
            <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[13px] font-bold text-slate-800">Tickets by Category</h4>
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">Distribution</span>
              </div>

              <div className="flex items-center gap-3 my-auto">
                <PieChart width={90} height={90}>
                  <Pie data={CATEGORY_DISTRIBUTION} cx={42} cy={42} innerRadius={24} outerRadius={42} dataKey="pct" strokeWidth={0}>
                    {CATEGORY_DISTRIBUTION.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Pie>
                </PieChart>
                <div className="flex-1 space-y-1 text-[10.5px]">
                  {CATEGORY_DISTRIBUTION.map(c => (
                    <div key={c.name} className="flex items-center justify-between">
                      <span className="text-slate-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.fill }} />
                        {c.name}
                      </span>
                      <span className="font-bold text-slate-800">{c.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── CENTERED OVERLAY MODAL CARD 1: TICKET CONVERSATION THREAD & RESOLUTION ── */}
      {modalOpen && selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-[65vw] max-h-[85vh] flex flex-col overflow-hidden relative">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{selectedTicket.id}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${selectedTicket.priority === 'Critical' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{selectedTicket.priority} Priority</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{selectedTicket.status}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{selectedTicket.subject}</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-9 h-9 rounded-full bg-white border border-slate-200 hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/50">
              <div className="grid grid-cols-3 gap-3 text-[11.5px]">
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Institute</span>
                  <span className="font-bold text-slate-800">{selectedTicket.institute}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">Assigned Engineer</span>
                  <span className="font-bold text-indigo-600">{selectedTicket.assignedTo}</span>
                </div>
                <div className="p-3 rounded-2xl bg-white border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold uppercase block">SLA Remaining</span>
                  <span className="font-bold text-rose-600 font-mono">{selectedTicket.sla}</span>
                </div>
              </div>

              {/* Conversation Thread */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-[13px]">Support Conversation Thread</h4>
                <div className="space-y-3 text-[12px]">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex justify-between text-slate-500 font-semibold text-[11px]">
                      <span>Institute Admin ({selectedTicket.institute})</span>
                      <span>Today, 10:15 AM</span>
                    </div>
                    <p className="text-slate-800 font-medium">Issue description: {selectedTicket.subject}. We need immediate resolution as tests are ongoing.</p>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1 ml-6">
                    <div className="flex justify-between text-indigo-700 font-semibold text-[11px]">
                      <span>Senior Support Engineer ({selectedTicket.assignedTo})</span>
                      <span>Today, 10:22 AM</span>
                    </div>
                    <p className="text-slate-800 font-medium">Investigating logs right now. Our backend team is deploying a hotfix patch.</p>
                  </div>
                </div>
              </div>

              {/* Composer */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="font-bold text-slate-800 text-[12px]">Reply to Institute</label>
                <div className="flex gap-2">
                  <input value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder="Type official response..."
                    className="flex-1 p-2.5 text-[12px] border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 bg-slate-50" />
                  <button onClick={() => { setReplyText(''); alert('Reply sent!'); }} className="px-4 py-2 bg-indigo-600 text-white font-bold text-[12px] rounded-xl hover:bg-indigo-700 flex items-center gap-1">
                    <Send className="w-3.5 h-3.5" /> Send
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-between items-center">
              <button onClick={() => { setModalOpen(false); alert('Ticket marked as resolved!'); }} className="px-4 py-2 text-[12px] font-bold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700">
                Mark Resolved
              </button>
              <button onClick={() => setModalOpen(false)} className="px-5 py-2 border border-slate-200 text-slate-700 font-bold text-[12px] rounded-xl hover:bg-slate-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTERED OVERLAY MODAL CARD 2: NEW TICKET MODAL ── */}
      {newTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadein">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <h3 className="text-lg font-bold text-slate-800">Create Internal Support Ticket</h3>
              <button onClick={() => setNewTicket(false)} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-slate-50 text-[12px]">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Target Institute</label>
                <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium">
                  <option>Allen Jaipur</option><option>Resonance Delhi</option><option>FIITJEE Noida</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ticket Subject</label>
                <input placeholder="Brief subject line..." className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium">
                    <option>Technical</option><option>Assessment</option><option>Billing</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Priority</label>
                  <select className="w-full p-2.5 border border-slate-200 rounded-xl bg-white text-slate-800 font-medium">
                    <option>Critical</option><option>High</option><option>Medium</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setNewTicket(false)} className="px-4 py-2 text-[12px] font-bold border border-slate-200 text-slate-700 rounded-xl">Cancel</button>
              <button onClick={() => { setNewTicket(false); alert('Ticket created!'); }} className="px-5 py-2 text-[12px] font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">Submit Ticket</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
