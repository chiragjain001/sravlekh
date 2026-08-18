'use client';
// ─── AdminReports — Reports & Analytics Console ──────────────────────────────
// Service layer backed implementation with TanStack Query hooks, report generator modal & analytics dashboard.

import React, { useState, useCallback } from 'react';
import {
  Plus, Search, Download, ChevronDown, Calendar, Bell,
  BookOpen, Users, DollarSign, Briefcase, Activity, FileText, Filter,
} from 'lucide-react';
import { AdminOverlapModal } from '../shared/AdminOverlapModal';

import {
  useReportsCatalog,
  useGenerateReport,
  useDownloadReport,
} from '@/features/reports/hooks/useReports';
import { ReportsCatalogTable }    from '@/features/reports/components/ReportsCatalogTable';
import { ReportProfileDrawer }    from '@/features/reports/components/ReportProfileDrawer';
import { GenerateReportDialog }   from '@/features/reports/components/GenerateReportDialog';
import { ReportsAnalyticsPanel }  from '@/features/reports/components/ReportsAnalyticsPanel';

import type {
  ReportItem,
  GetReportsParams,
  GenerateReportInput,
} from '@/features/reports/types/reports.types';

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const show = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);
  return { toast, show };
}

function Toast({ msg, type }: { msg: string; type: string }) {
  return (
    <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-white text-sm font-bold transition-all
      ${type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
      {type === 'success' ? '✓' : '✗'} {msg}
    </div>
  );
}

export function AdminReports() {
  const [selectedCategory, setSelectedCategory] = useState<string>('Academic Reports');
  const [search, setSearch]                     = useState('');
  const [programFilter, setProgramFilter]         = useState('');
  const [batchFilter, setBatchFilter]             = useState('');

  // Modals & Drawers
  const [activeModal, setActiveModal]           = useState<'reportsList' | 'batches' | 'finance' | null>(null);
  const [selectedReport, setSelectedReport]     = useState<ReportItem | null>(null);
  const [generateOpen, setGenerateOpen]         = useState(false);

  const { toast, show: showToast } = useToast();

  const params: GetReportsParams = {
    category: selectedCategory,
    program:  programFilter || undefined,
    batch:    batchFilter   || undefined,
    search,
  };

  const { data: reportsCatalog = [], isLoading } = useReportsCatalog(params);

  const generateMutation = useGenerateReport();
  const downloadMutation = useDownloadReport();

  async function handleGenerateReport(input: GenerateReportInput) {
    const newRep = await generateMutation.mutateAsync(input);
    showToast(`Report "${newRep.title}" generated successfully`);
  }

  async function handleDownloadPDF(reportId: string) {
    await downloadMutation.mutateAsync(reportId);
    showToast('Report downloaded');
  }

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1700px] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-xs text-gray-500 mt-0.5">Generate and analyze institute performance, academic, and financial reports</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Today, 23 May 2025</span>
          </div>
          <div className="relative p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-gray-500" />
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
              4
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-2.5 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="All Reports">All Report Categories</option>
                <option value="Academic Reports">Academic Reports</option>
                <option value="Student Reports">Student Reports</option>
                <option value="Financial Reports">Financial Reports</option>
                <option value="Faculty Reports">Faculty Reports</option>
                <option value="Operational Reports">Operational Reports</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={programFilter} onChange={(e) => setProgramFilter(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Programs</option>
                <option value="JEE">JEE Main &amp; Advanced</option>
                <option value="NEET">NEET Medical</option>
                <option value="Foundation">Class 11 Foundation</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}
                className="appearance-none py-1.5 pl-3 pr-8 text-xs font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="">All Batches</option>
                <option value="JEE 2025 Star">JEE 2025 Star Batch</option>
                <option value="NEET 2025 Target">NEET 2025 Target Batch</option>
                <option value="Foundation 11A">Foundation 11A</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => showToast('Master analytics exported as CSV')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 whitespace-nowrap cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" /> Export
            </button>
            <button
              onClick={() => setGenerateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Generate Report
            </button>
          </div>
        </div>

        {/* ── TOP ALIGNED BLOCK: REPORT CATEGORIES SIDEBAR + KEY PERFORMANCE & TRENDS ── */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">

          {/* Left Column: Report Categories (3 Cols) */}
          <div className="xl:col-span-3 bg-white rounded-xl p-4 border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] space-y-3 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 px-1">Report Categories</h3>

              <div className="space-y-2">
                {[
                  { id: 'Academic Reports', title: 'Academic Reports', desc: 'Performance, results, and assessment reports', icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
                  { id: 'Student Reports', title: 'Student Reports', desc: 'Enrollment, attendance, and progress reports', icon: Users, color: 'bg-cyan-50 text-cyan-600' },
                  { id: 'Financial Reports', title: 'Financial Reports', desc: 'Fee collection, dues, and financial reports', icon: DollarSign, color: 'bg-amber-50 text-amber-600' },
                  { id: 'Faculty Reports', title: 'Faculty Reports', desc: 'Performance, workload, and evaluation reports', icon: Briefcase, color: 'bg-emerald-50 text-emerald-600' },
                  { id: 'Operational Reports', title: 'Operational Reports', desc: 'Activities, communication, and system reports', icon: Activity, color: 'bg-purple-50 text-purple-600' },
                ].map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 shadow-2xs font-medium'
                          : 'border-gray-100 bg-white hover:bg-gray-50/60'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${cat.color} flex-shrink-0 mt-0.5`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{cat.title}</h4>
                        <p className="text-[10px] text-gray-400 leading-snug mt-0.5">{cat.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <span className="text-[11px] text-gray-400 font-medium px-1">Selected: <strong className="text-gray-900">{selectedCategory}</strong></span>
            </div>
          </div>

          {/* Right Area: Main Analytics Dashboard (9 Cols) */}
          <div className="xl:col-span-9 space-y-6">
            <ReportsAnalyticsPanel
              selectedCategory={selectedCategory}
              programFilter={programFilter}
              batchFilter={batchFilter}
              downloadedReports={reportsCatalog}
              onOpenReportsList={() => setActiveModal('reportsList')}
              onOpenBatchesList={() => setActiveModal('batches')}
              onOpenFinancials={() => setActiveModal('finance')}
              onSelectReport={(rep) => setSelectedReport(rep)}
            />
          </div>

        </div>

      </div>

      {/* Drawer */}
      <ReportProfileDrawer
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
      />

      {/* Generate Report Dialog */}
      <GenerateReportDialog
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerateReport}
      />

      {/* ── OVERLAP CARDS / MODAL OVERLAYS ── */}

      {/* 1. All Downloaded Reports Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'reportsList'}
        onClose={() => setActiveModal(null)}
        title="Full Institute Reports Directory"
        subtitle="Complete catalog of downloadable academic, financial, attendance, and operational reports"
        icon={FileText}
        badgeText={`${reportsCatalog.length} Master Reports`}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <Search className="w-4 h-4 text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="Search reports catalog..."
              className="bg-transparent text-xs w-full focus:outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg">
              <Filter className="w-3.5 h-3.5" /> Filter
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-3">Report Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Generated Date</th>
                  <th className="p-3">Total Downloads</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportsCatalog.map((rep) => (
                  <tr key={rep.id} className="hover:bg-blue-50/20">
                    <td className="p-3 font-bold text-slate-900">{rep.title}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 font-bold rounded text-[10.5px]">
                        {rep.category}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{rep.generatedDate}</td>
                    <td className="p-3 font-semibold text-slate-800">{rep.downloadsText}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDownloadPDF(rep.id)}
                        className="px-3 py-1 bg-blue-600 text-white font-bold text-[11px] rounded-lg hover:bg-blue-700 cursor-pointer"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </AdminOverlapModal>

      {/* 2. Top Performing Batches Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'batches'}
        onClose={() => setActiveModal(null)}
        title="Complete Batch Performance Leaderboard"
        subtitle="Academic ranking, student strength, and batch toppers across all cohorts"
        icon={BookOpen}
        badgeText="5 Active Batches"
        badgeColor="bg-emerald-50 text-emerald-600 border-emerald-100"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {[
              { name: 'JEE 2025 Star Batch',    score: 91, students: 42, topper: 'Rohan Verma (98.4%)' },
              { name: 'NEET 2025 Target Batch', score: 88, students: 38, topper: 'Ananya Sharma (97.1%)' },
              { name: 'Foundation 11A',        score: 84, students: 54, topper: 'Kabir Mehta (95.0%)' },
              { name: 'JEE 2026 Early Batch',  score: 82, students: 48, topper: 'Priya Singh (94.2%)' },
              { name: 'Foundation 11B',        score: 79, students: 50, topper: 'Siddharth Roy (92.5%)' },
            ].map((b, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center">
                    #{idx + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{b.name}</h4>
                    <p className="text-xs text-slate-500">{b.students} Enrolled Students • Batch Topper: <strong className="text-slate-800">{b.topper}</strong></p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-emerald-600">{b.score}%</span>
                  <p className="text-[10px] text-slate-400">Avg Test Score</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </AdminOverlapModal>

      {/* 3. Detailed Financial Report Modal */}
      <AdminOverlapModal
        isOpen={activeModal === 'finance'}
        onClose={() => setActiveModal(null)}
        title="Detailed Financial &amp; Fee Collection Breakdown"
        subtitle="Term collection analytics, pending dues per batch, and revenue breakdown"
        icon={DollarSign}
        badgeText="Term 2 FY25"
        badgeColor="bg-amber-50 text-amber-600 border-amber-100"
      >
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <span className="text-xs text-emerald-600 font-semibold block uppercase">Total Collected</span>
              <span className="text-2xl font-bold text-emerald-900">₹24,80,000</span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <span className="text-xs text-blue-600 font-semibold block uppercase">Total Expected Target</span>
              <span className="text-2xl font-bold text-blue-900">₹28,50,000</span>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-100">
              <span className="text-xs text-rose-600 font-semibold block uppercase">Pending Dues Amount</span>
              <span className="text-2xl font-bold text-rose-900">₹3,70,000</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Pending Dues Breakdown by Batch</h4>
            <div className="space-y-2 pt-1">
              {[
                { batch: 'JEE 2025 Star Batch', pending: '₹45,000', students: 3 },
                { batch: 'NEET 2025 Target Batch', pending: '₹85,000', students: 6 },
                { batch: 'Foundation 11A', pending: '₹1,20,000', students: 11 },
                { batch: 'JEE 2026 Early Batch', pending: '₹1,20,000', students: 9 },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center text-xs p-2.5 bg-white rounded-lg border border-slate-100">
                  <span className="font-bold text-slate-900">{row.batch} ({row.students} Students)</span>
                  <span className="font-bold text-rose-600">{row.pending}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AdminOverlapModal>

      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
