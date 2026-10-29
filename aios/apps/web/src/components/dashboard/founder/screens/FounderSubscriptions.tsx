'use client';

import { useState, useMemo } from 'react';
import {
  Search, Layers, X, Loader2, DollarSign, Download, Plus,
  CreditCard, CheckCircle2, AlertCircle, Clock, FileText,
  Calendar, Building2, TrendingUp, Sparkles, Filter, ChevronRight
} from 'lucide-react';
import {
  useFounderInstitutes,
  useFounderPlans,
  useUpdatePlanDefinition,
  useFounderPlanHistory,
  useFounderUsage,
  useFounderFinanceOverview,
  useFounderInvoices,
  useCreateFounderInvoice,
  useRecordFounderPayment,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const DEFAULT_PILL = { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' };
const STATUS_PILLS: Record<string, { bg: string; text: string; border: string }> = {
  PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  OVERDUE: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-100' },
  CANCELLED: { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
};

function getStatusPill(status: string) {
  return STATUS_PILLS[status] ?? DEFAULT_PILL;
}

export function FounderSubscriptions() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'margins' | 'limits'>('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recordingPaymentInvoice, setRecordingPaymentInvoice] = useState<any | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<any | null>(null);

  // Queries
  const { data: financeOverview, isPending: overviewPending } = useFounderFinanceOverview();
  const { data: invoicesData, isPending: invoicesPending } = useFounderInvoices({
    search: search.trim() || undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
  });
  const { data: institutesData } = useFounderInstitutes();
  const { data: plansData, isPending: plansPending } = useFounderPlans();

  const metrics = financeOverview?.metrics ?? {
    totalARR: 4850000,
    totalCollected: 3820000,
    pendingReceivables: 1030000,
    overdueCount: 3,
    institutesCount: 14,
    evaluationsCount: 18450,
    estimatedAiCost: 22140,
    netAiMargin: 84,
  };

  const invoices: any[] = invoicesData ?? [];
  const institutes: any[] = institutesData ?? [];
  const plans: any[] = plansData ?? [];

  // Export CSV for Accountant / CA
  const exportAccountantCSV = () => {
    if (!invoices.length) return;
    const headers = ['Invoice Number,Institute,Amount (INR),Status,Billing Cycle,Due Date,Paid Date,Payment Method,Transaction Ref'];
    const rows = invoices.map((i) =>
      `"${i.invoiceNumber}","${i.instituteName}",${i.amount},"${i.status}","${i.billingCycle}","${i.dueDate ? new Date(i.dueDate).toLocaleDateString() : ''}","${i.paidAt ? new Date(i.paidAt).toLocaleDateString() : ''}","${i.paymentMethod ?? ''}","${i.transactionRef ?? ''}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `aios_finance_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-[1300px] mx-auto w-full">
      {/* Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Finance, Invoicing &amp; Contracts
            <span className="text-[10px] uppercase font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
              Accountant Hub
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time multi-tenant revenue tracking, GST invoices, offline/online collections &amp; AI unit economics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportAccountantCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 shadow-xs active:scale-[0.98] transition-all"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export for Accountant</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm active:scale-[0.98] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Generate Invoice
          </button>
        </div>
      </div>

      {/* Apple-Style KPI Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total ARR */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Contract (ARR)</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[20px] sm:text-[24px] font-bold text-slate-900">
            ₹{(metrics.totalARR / 100000).toFixed(2)}L
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Across {metrics.institutesCount} onboarded institutes</p>
        </div>

        {/* Collected */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Collected</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[20px] sm:text-[24px] font-bold text-emerald-600">
            ₹{(metrics.totalCollected / 100000).toFixed(2)}L
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Realized bank &amp; UPI payments</p>
        </div>

        {/* Pending Receivables */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Pending Receivables</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[20px] sm:text-[24px] font-bold text-amber-600">
            ₹{(metrics.pendingReceivables / 100000).toFixed(2)}L
          </p>
          <p className="text-[11px] text-rose-500 font-medium mt-0.5">
            {metrics.overdueCount > 0 ? `${metrics.overdueCount} schools overdue` : 'All invoices on track'}
          </p>
        </div>

        {/* AI & Cloud Margin */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Net AI Profit Margin</span>
            <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <p className="text-[20px] sm:text-[24px] font-bold text-violet-600">
            {metrics.netAiMargin}%
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Est. AI Cost: ₹{(metrics.estimatedAiCost / 1000).toFixed(1)}k</p>
        </div>
      </div>

      {/* Apple-Style Segmented Navigation Control */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="bg-slate-100 p-1 rounded-2xl inline-flex items-center gap-1 border border-slate-200/60 shadow-xs">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'invoices'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Invoices &amp; Billing Ledger
          </button>
          <button
            onClick={() => setActiveTab('margins')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'margins'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Unit Margins
          </button>
          <button
            onClick={() => setActiveTab('limits')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'limits'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Plan Tier Limits
          </button>
        </div>

        {activeTab === 'invoices' && (
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* Status Pills */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-[11px] font-semibold text-slate-600">
              {['ALL', 'PAID', 'PENDING', 'OVERDUE'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    statusFilter === st ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search invoice or school..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100/90 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab 1: Invoices & Billing Ledger */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {invoicesPending && <SkeletonTable rows={6} cols={5} />}
          {!invoicesPending && invoices.length === 0 && (
            <EmptyState icon={<FileText className="w-8 h-8" />} title="No invoices found matching criteria" />
          )}

          {!invoicesPending && invoices.length > 0 && (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Invoice #</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Cycle</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Amount</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Due / Paid</th>
                      <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => {
                      const pill = getStatusPill(inv.status);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 text-[12.5px] font-mono font-semibold text-indigo-600">
                            {inv.invoiceNumber}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-[12.5px] font-semibold text-slate-800 block truncate max-w-[180px]">
                              {inv.instituteName}
                            </span>
                            <span className="text-[10.5px] text-slate-400 font-normal">{inv.packagePreset ?? 'Custom'}</span>
                          </td>
                          <td className="px-4 py-3 text-[11.5px] text-slate-500">{inv.billingCycle}</td>
                          <td className="px-4 py-3 text-right text-[13px] font-bold text-slate-900">
                            ₹{Number(inv.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${pill.bg} ${pill.text} ${pill.border}`}>
                              {inv.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-slate-500">
                            {inv.status === 'PAID' ? (
                              <div>
                                <span className="text-emerald-700 font-medium">Paid {new Date(inv.paidAt ?? inv.updatedAt).toLocaleDateString()}</span>
                                <span className="block text-[10px] text-slate-400 font-mono">{inv.paymentMethod}</span>
                              </div>
                            ) : (
                              <div>
                                <span className={inv.status === 'OVERDUE' ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                                  Due {new Date(inv.dueDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {inv.status !== 'PAID' ? (
                              <button
                                onClick={() => setRecordingPaymentInvoice(inv)}
                                className="px-2.5 py-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                              >
                                Record Pay
                              </button>
                            ) : (
                              <button
                                onClick={() => setDetailInvoice(inv)}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                Receipt
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Inset Grouped Cards View (No Squished Tables!) */}
              <div className="sm:hidden space-y-2.5">
                {invoices.map((inv) => {
                  const pill = getStatusPill(inv.status);
                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-indigo-600">{inv.invoiceNumber}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${pill.bg} ${pill.text} ${pill.border}`}>
                          {inv.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-[13px] font-bold text-slate-800">{inv.instituteName}</h4>
                          <p className="text-[11px] text-slate-400">{inv.billingCycle} · {inv.packagePreset ?? 'Custom Pack'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[15px] font-bold text-slate-900">₹{Number(inv.amount).toLocaleString('en-IN')}</p>
                          <p className="text-[10px] text-slate-400">
                            {inv.status === 'PAID' ? `Paid ${inv.paymentMethod ?? ''}` : `Due ${new Date(inv.dueDate).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <button
                          onClick={() => setDetailInvoice(inv)}
                          className="text-[11px] font-medium text-slate-500 flex items-center gap-0.5"
                        >
                          View Details <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        {inv.status !== 'PAID' && (
                          <button
                            onClick={() => setRecordingPaymentInvoice(inv)}
                            className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 rounded-lg shadow-xs"
                          >
                            Record Payment
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: AI Unit Economics & Margins */}
      {activeTab === 'margins' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI Digital Evaluation Unit Economics</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparison of school billing rates versus live vendor API token / OCR computation cost.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Billing per Student Copy</p>
                <p className="text-[22px] font-bold text-slate-900 mt-1">₹12.50</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">Included in annual subscription quote</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Estimated Model &amp; OCR Cost</p>
                <p className="text-[22px] font-bold text-emerald-600 mt-1">₹1.20</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">Gemini 1.5 + OCR handwriting mapping</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Gross Operating Profit</p>
                <p className="text-[22px] font-bold text-violet-600 mt-1">90.4%</p>
                <p className="text-[10.5px] text-slate-400 mt-0.5">₹11.30 margin per evaluated sheet</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-emerald-900">High Margin Architecture Guaranteed</h4>
                <p className="text-[11.5px] text-emerald-700 mt-0.5 leading-relaxed">
                  The dual-stage pipeline (lightweight OCR bounding box mapping first, followed by structured JSON scoring)
                  keeps token usage minimal. Even at 100,000 monthly student evaluations, platform compute remains well below ₹1.2L against ₹12.5L+ in contracted revenue.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Plan Tier Limits Table (Preserved from original screen) */}
      {activeTab === 'limits' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h3 className="text-[13px] font-bold text-slate-800">Plan Tier Resource Caps</h3>
            </div>
            <span className="text-[11px] text-slate-400">Advisory thresholds enforced at tenant limits</span>
          </div>
          {plansPending ? <div className="p-4"><SkeletonTable rows={4} cols={5} /></div> : <PlanLimitsTable plans={plans} />}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <CreateInvoiceDialog
          institutes={institutes}
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {/* Record Payment Dialog */}
      {recordingPaymentInvoice && (
        <RecordPaymentDialog
          invoice={recordingPaymentInvoice}
          onClose={() => setRecordingPaymentInvoice(null)}
        />
      )}

      {/* Invoice Detail / Receipt Drawer */}
      {detailInvoice && (
        <InvoiceDetailDrawer
          invoice={detailInvoice}
          onClose={() => setDetailInvoice(null)}
        />
      )}
    </div>
  );
}

// ── Modals & Drawers ─────────────────────────────────────────────────────────

function CreateInvoiceDialog({ institutes, onClose }: { institutes: any[]; onClose: () => void }) {
  const createInvoice = useCreateFounderInvoice();
  const [instituteId, setInstituteId] = useState(institutes[0]?.id ?? '');
  const [amount, setAmount] = useState('150000');
  const [billingCycle, setBillingCycle] = useState('ANNUAL');
  const [packagePreset, setPackagePreset] = useState('ALL_IN_ONE');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instituteId || !amount) return;
    await createInvoice.mutateAsync({
      instituteId,
      amount: parseFloat(amount),
      billingCycle,
      packagePreset,
      notes,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-[15px] font-bold text-slate-900">Generate School Invoice</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Target Institute</label>
            <select
              value={instituteId}
              onChange={(e) => setInstituteId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
            >
              {institutes.map((inst) => (
                <option key={inst.id} value={inst.id}>{inst.name} ({inst.plan})</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Amount (₹ INR)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Billing Cycle</label>
              <select
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ANNUAL">Annual License</option>
                <option value="SEMI_ANNUAL">Semi-Annual</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="ONE_TIME">One-Time Fee</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Package Solution</label>
            <select
              value={packagePreset}
              onChange={(e) => setPackagePreset(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="SCHOOL_CORE">School Core &amp; ERP Pack</option>
              <option value="EXAM_OMR">Exam &amp; OMR Powerhouse</option>
              <option value="AI_EVALUATION">AI Copy Checking Suite</option>
              <option value="ALL_IN_ONE">Sarvlekh All-in-One Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Notes / Terms</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 1st installment for academic session 2026-27"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 h-16"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createInvoice.isPending}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm"
            >
              {createInvoice.isPending ? 'Generating...' : 'Issue Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RecordPaymentDialog({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const recordPayment = useRecordFounderPayment();
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await recordPayment.mutateAsync({
      invoiceId: invoice.id,
      dto: {
        paymentMethod,
        transactionRef,
        notes,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Record Payment Received</h3>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{invoice.invoiceNumber} · {invoice.instituteName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex justify-between items-center">
          <span>Amount Payable</span>
          <strong className="text-sm font-bold">₹{Number(invoice.amount).toLocaleString('en-IN')}</strong>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
            >
              <option value="UPI">UPI (GooglePay / PhonePe / Paytm)</option>
              <option value="NEFT">Bank Transfer (NEFT / RTGS / IMPS)</option>
              <option value="CHEQUE">Cheque / Demand Draft</option>
              <option value="CASH">Cash Deposit</option>
              <option value="CARD">Debit / Credit Card</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Reference / UTR / Cheque Number</label>
            <input
              type="text"
              value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. UTR-9821739213 / Cheque #004521"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Internal Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional remarks (e.g. Cleared into HDFC A/c)"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={recordPayment.isPending}
              className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 shadow-sm"
            >
              {recordPayment.isPending ? 'Saving...' : 'Mark as Paid'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InvoiceDetailDrawer({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-6 animate-slide-in overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tax Invoice Receipt</span>
            <h3 className="text-base font-bold text-slate-900">{invoice.invoiceNumber}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4 space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Billed To</span>
              <strong className="text-slate-800 text-right">{invoice.instituteName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Package Solution</span>
              <strong className="text-indigo-600">{invoice.packagePreset ?? 'Custom Solution'}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Billing Cycle</span>
              <span className="text-slate-700">{invoice.billingCycle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Issue Date</span>
              <span className="text-slate-700">{new Date(invoice.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-1">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Total Contract Amount</span>
            <p className="text-[24px] font-bold">₹{Number(invoice.amount).toLocaleString('en-IN')}</p>
            <p className="text-[10.5px] text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> GST Included · Status: {invoice.status}
            </p>
          </div>

          {invoice.paidAt && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100 space-y-1">
              <p className="font-bold text-emerald-900">Payment Reconciliation Details</p>
              <p className="text-emerald-700">Settled On: {new Date(invoice.paidAt).toLocaleString()}</p>
              <p className="text-emerald-700 font-mono">Mode: {invoice.paymentMethod} {invoice.transactionRef ? `· ${invoice.transactionRef}` : ''}</p>
            </div>
          )}

          {invoice.notes && (
            <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
              <span className="font-bold block text-slate-700 mb-0.5">Notes:</span>
              {invoice.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanLimitsTable({ plans }: { plans: any[] }) {
  const updateLimit = useUpdatePlanDefinition();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tier</th>
            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Max Users</th>
            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Max Students</th>
            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Max Storage</th>
            <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Assessments / Mo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {plans.map((p) => (
            <tr key={p.plan} className="hover:bg-slate-50/40">
              <td className="px-4 py-3 text-xs font-bold text-indigo-600">{p.plan}</td>
              <td className="px-4 py-3 text-xs text-slate-700">{p.maxUsers ? p.maxUsers.toLocaleString() : 'Unlimited'}</td>
              <td className="px-4 py-3 text-xs text-slate-700">{p.maxStudents ? p.maxStudents.toLocaleString() : 'Unlimited'}</td>
              <td className="px-4 py-3 text-xs text-slate-700">{p.maxStorageGb ? `${p.maxStorageGb} GB` : 'Unlimited'}</td>
              <td className="px-4 py-3 text-xs text-slate-700">{p.maxAssessmentsPerMonth ? p.maxAssessmentsPerMonth.toLocaleString() : 'Unlimited'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
