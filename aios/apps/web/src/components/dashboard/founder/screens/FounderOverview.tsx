'use client';
// ─── FounderOverview — real backend ────────────────────────────────────────
// Composed from the two endpoints that actually exist (GET /founder/institutes,
// GET /founder/health) rather than the richer mock dashboard's revenue/ticket
// charts, which would need billing/support-ticket backends that are explicitly
// out of scope for this pass (see docs/33 — non-goal per 01-PRODUCT-REQUIREMENTS.md).

import { Building2, Users, Layers, Activity } from 'lucide-react';
import { useFounderInstitutes, useFounderHealth } from '@/hooks/useApi';
import { SkeletonCardGrid, EmptyState } from '@/components/ui/foundation';

interface InstituteRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  _count: { users: number; batches: number };
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-rose-50 text-rose-700',
  ONBOARDING: 'bg-amber-50 text-amber-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

export function FounderOverview() {
  const { data: institutes, isPending, isError } = useFounderInstitutes();
  const { data: health } = useFounderHealth();

  if (isError) {
    return <EmptyState icon={<Building2 className="w-6 h-6" />} title="Couldn't load the platform overview" className="p-6" />;
  }

  const rows: InstituteRow[] = institutes ?? [];
  const totalUsers = rows.reduce((sum, i) => sum + i._count.users, 0);
  const totalBatches = rows.reduce((sum, i) => sum + i._count.batches, 0);
  const activeCount = rows.filter((i) => i.status === 'ACTIVE').length;

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto w-full">
      {isPending ? (
        <SkeletonCardGrid count={4} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Building2 className="w-4 h-4" />} label="Institutes" value={rows.length} sub={`${activeCount} active`} />
          <StatCard icon={<Users className="w-4 h-4" />} label="Total Users" value={totalUsers} />
          <StatCard icon={<Layers className="w-4 h-4" />} label="Total Batches" value={totalBatches} />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Platform Health"
            value={health ? (health.postgres.status === 'up' ? 'Healthy' : 'Degraded') : '—'}
            sub={health ? `DB ${health.postgres.latencyMs ?? '—'}ms` : undefined}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <h3 className="text-[13px] font-bold text-slate-900">Institutes</h3>
        </div>
        {!isPending && rows.length === 0 ? (
          <EmptyState icon={<Building2 className="w-6 h-6" />} title="No institutes onboarded yet" className="py-10" />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/30">
                <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Users</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((i) => (
                <tr key={i.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-2.5 text-[12.5px] font-medium text-slate-800">{i.name}</td>
                  <td className="px-4 py-2.5 text-[11.5px] text-slate-600">{i.plan}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[i.status] ?? 'bg-slate-100 text-slate-600'}`}>{i.status}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-500">{i._count.users}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-2">{icon}<span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span></div>
      <p className="text-[22px] font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
