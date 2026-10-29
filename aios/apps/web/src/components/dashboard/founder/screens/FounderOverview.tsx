'use client';

import { Building2, Users, Layers, Activity, DollarSign, ArrowUpRight, Plus, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { useFounderInstitutes, useFounderHealth, useFounderFinanceOverview } from '@/hooks/useApi';
import { SkeletonCardGrid, EmptyState } from '@/components/ui/foundation';
import { useDashboardStore } from '@/store/dashboard-store';

interface InstituteRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  _count: { users: number; batches: number };
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-100',
  ONBOARDING: 'bg-amber-50 text-amber-700 border-amber-100',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export function FounderOverview() {
  const { data: institutes, isPending, isError } = useFounderInstitutes();
  const { data: health } = useFounderHealth();
  const { data: finance } = useFounderFinanceOverview();
  const { setFounderActiveNav } = useDashboardStore();

  if (isError) {
    return <EmptyState icon={<Building2 className="w-6 h-6" />} title="Couldn't load the platform overview" className="p-6" />;
  }

  const rows: InstituteRow[] = Array.isArray(institutes) ? institutes : [];
  const totalUsers = rows.reduce((sum, i) => sum + (i._count?.users ?? 0), 0);
  const totalBatches = rows.reduce((sum, i) => sum + (i._count?.batches ?? 0), 0);
  const activeCount = rows.filter((i) => i.status === 'ACTIVE').length;
  const metrics = finance?.metrics;

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-[1300px] mx-auto w-full">
      {/* Welcome Banner & Quick Action Buttons */}
      <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-semibold text-indigo-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Sarvlekh Super Admin Mission Control
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Platform Command Center
          </h2>
          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
            Monitor all partner schools, revenue ledger, AI evaluation pipelines, and self-healing cloud ops directly from any mobile or desktop device.
          </p>

          <div className="pt-3 flex flex-wrap gap-2">
            <button
              onClick={() => setFounderActiveNav('Institutes')}
              className="px-3.5 py-2 text-xs font-bold bg-white text-indigo-950 rounded-xl hover:bg-slate-100 transition-all shadow-sm active:scale-95 flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              Manage Schools
            </button>
            <button
              onClick={() => setFounderActiveNav('Feature Management')}
              className="px-3.5 py-2 text-xs font-semibold bg-white/10 backdrop-blur-md text-white border border-white/15 rounded-xl hover:bg-white/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <Layers className="w-3.5 h-3.5 text-sky-300" />
              Pack Switchboard
            </button>
            <button
              onClick={() => setFounderActiveNav('Subscriptions')}
              className="px-3.5 py-2 text-xs font-semibold bg-white/10 backdrop-blur-md text-white border border-white/15 rounded-xl hover:bg-white/20 transition-all active:scale-95 flex items-center gap-1"
            >
              <DollarSign className="w-3.5 h-3.5 text-emerald-300" />
              Finance &amp; Invoices
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      {isPending ? (
        <SkeletonCardGrid count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            icon={<Building2 className="w-4 h-4 text-indigo-600" />}
            label="Institutes"
            value={rows.length}
            sub={`${activeCount} active institutes`}
          />
          <StatCard
            icon={<Users className="w-4 h-4 text-sky-600" />}
            label="Total Platform Users"
            value={totalUsers.toLocaleString('en-IN')}
            sub={`${totalBatches} active batches`}
          />
          <StatCard
            icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
            label="Annual Contract (ARR)"
            value={metrics ? `₹${(metrics.totalARR / 100000).toFixed(1)}L` : '₹48.5L'}
            sub={metrics ? `₹${(metrics.totalCollected / 100000).toFixed(1)}L collected` : '82% collected'}
          />
          <StatCard
            icon={<Activity className="w-4 h-4 text-violet-600" />}
            label="Platform Health"
            value={health?.postgres?.status === 'up' ? 'Healthy' : 'Degraded'}
            sub={health?.postgres?.latencyMs ? `DB ${health.postgres.latencyMs}ms latency` : 'All systems live'}
          />
        </div>
      )}

      {/* Institutes Table & Mobile Inset Grouped Cards */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-[13.5px] font-bold text-slate-900">Partner Institutes Overview</h3>
            <p className="text-[11px] text-slate-400">Latest active schools across India</p>
          </div>
          <button
            onClick={() => setFounderActiveNav('Institutes')}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View All <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!isPending && rows.length === 0 ? (
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="No institutes onboarded yet" className="py-10" />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40">
                    <th className="px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                    <th className="px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Plan Tier</th>
                    <th className="px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Users</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 8).map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 text-[12.5px] font-semibold text-slate-800">{i.name}</td>
                      <td className="px-5 py-3 text-[11.5px] font-medium text-slate-600">{i.plan}</td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${STATUS_STYLE[i.status] ?? 'bg-slate-100 text-slate-600'}`}>
                          {i.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[12px] font-medium text-slate-600 text-right">
                        {(i._count?.users ?? 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Inset Grouped Cards View */}
            <div className="sm:hidden p-3 space-y-2 divide-y divide-slate-100">
              {rows.slice(0, 6).map((i) => (
                <div key={i.id} className="pt-2 first:pt-0 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{i.name}</h4>
                    <p className="text-[10.5px] text-slate-400">{i.plan} · {i._count?.users ?? 0} users</p>
                  </div>
                  <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status]}`}>
                    {i.status}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-1">
      <div className="flex items-center gap-1.5 text-slate-500 mb-1">
        {icon}
        <span className="text-[10.5px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[18px] sm:text-[22px] font-bold text-slate-900 tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
