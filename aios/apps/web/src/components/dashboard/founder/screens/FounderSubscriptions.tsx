'use client';
// ─── FounderSubscriptions — real backend ───────────────────────────────────
// No billing/payments infrastructure exists in this product (01-PRODUCT-
// REQUIREMENTS.md: explicit Phase 1 non-goal), so there is no revenue/MRR/
// invoice UI here — only what's real: plan distribution, per-plan limits
// (editable), and per-institute usage-vs-limits + plan-change history.

import { useState } from 'react';
import { Search, Layers, X, Loader2, Clock } from 'lucide-react';
import {
  useFounderInstitutes,
  useFounderPlans,
  useUpdatePlanDefinition,
  useFounderPlanHistory,
  useFounderUsage,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState } from '@/components/ui/foundation';

const PLAN_COLORS: Record<string, string> = {
  TRIAL: 'text-amber-600',
  BASIC: 'text-emerald-600',
  PRO: 'text-sky-600',
  ENTERPRISE: 'text-violet-600',
};

interface InstituteRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  _count: { users: number; batches: number };
}

interface PlanDefinition {
  plan: string;
  maxUsers: number | null;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxStorageGb: number | null;
  maxAssessmentsPerMonth: number | null;
  trialDurationDays: number | null;
}

export function FounderSubscriptions() {
  const [search, setSearch] = useState('');
  const [detailInstitute, setDetailInstitute] = useState<InstituteRow | null>(null);

  const { data: institutesData, isPending, isError } = useFounderInstitutes(search.trim() ? { search: search.trim() } : undefined);
  const { data: plansData, isPending: plansPending } = useFounderPlans();

  const rows: InstituteRow[] = institutesData ?? [];
  const plans: PlanDefinition[] = plansData ?? [];

  const distribution = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'].map((p) => ({
    plan: p,
    count: rows.filter((r) => r.plan === p).length,
  }));
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="p-6 space-y-6 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Subscriptions &amp; Plans</h2>
        <p className="text-xs text-slate-500 mt-0.5">Plan distribution, tier limits, and per-institute usage. No billing/invoicing exists in this product yet — this reflects real plan/usage data only.</p>
      </div>

      {/* Plan distribution — derived from real institute data */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <h3 className="text-[12.5px] font-bold text-slate-800 mb-3">Plan distribution</h3>
        <div className="space-y-2">
          {distribution.map((d) => (
            <div key={d.plan} className="flex items-center gap-3">
              <span className={`w-20 text-[11px] font-bold ${PLAN_COLORS[d.plan]}`}>{d.plan}</span>
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(d.count / maxCount) * 100}%` }} />
              </div>
              <span className="w-8 text-right text-[11.5px] font-semibold text-slate-700">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plan limits editor */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400" />
          <h3 className="text-[12.5px] font-bold text-slate-800">Plan tier limits</h3>
        </div>
        {plansPending ? <div className="p-4"><SkeletonTable rows={4} cols={5} /></div> : <PlanLimitsTable plans={plans} />}
      </div>

      {/* Institutes by plan */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[12.5px] font-bold text-slate-800">Institutes</h3>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search institutes..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>

        {isPending && <SkeletonTable rows={6} cols={4} />}
        {isError && <EmptyState icon={<Layers className="w-6 h-6" />} title="Couldn't load institutes" />}
        {!isPending && !isError && rows.length === 0 && <EmptyState icon={<Layers className="w-6 h-6" />} title="No institutes found" />}

        {!isPending && !isError && rows.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Users</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} onClick={() => setDetailInstitute(i)} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 cursor-pointer">
                    <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800 hover:text-indigo-600">{i.name}</td>
                    <td className="px-4 py-3"><span className={`text-[11px] font-bold ${PLAN_COLORS[i.plan]}`}>{i.plan}</span></td>
                    <td className="px-4 py-3 text-[11.5px] text-slate-500">{i.status}</td>
                    <td className="px-4 py-3 text-right text-[12px] text-slate-500">{i._count?.users ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InstituteUsageDrawer institute={detailInstitute} onClose={() => setDetailInstitute(null)} />
    </div>
  );
}

function PlanLimitsTable({ plans }: { plans: PlanDefinition[] }) {
  const updatePlan = useUpdatePlanDefinition();
  const [editing, setEditing] = useState<Record<string, Partial<PlanDefinition>>>({});

  const fieldFor = (p: PlanDefinition, key: keyof PlanDefinition) => editing[p.plan]?.[key] ?? p[key] ?? '';

  const setField = (plan: string, key: keyof PlanDefinition, value: string) => {
    setEditing((prev) => ({ ...prev, [plan]: { ...prev[plan], [key]: value === '' ? null : Number(value) } }));
  };

  const save = (plan: string) => {
    const changes = editing[plan];
    if (!changes) return;
    updatePlan.mutate({ plan, ...changes } as any, { onSuccess: () => setEditing((prev) => ({ ...prev, [plan]: {} })) });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide">Plan</th>
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide text-right">Max users</th>
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide text-right">Max students</th>
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide text-right">Max teachers</th>
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide text-right">Storage (GB)</th>
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide text-right">Assessments/mo</th>
            <th className="px-4 py-2 text-[10.5px] font-bold text-slate-500 uppercase tracking-wide text-right"></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.plan} className="border-b border-slate-50 last:border-0">
              <td className={`px-4 py-2 text-[11.5px] font-bold ${PLAN_COLORS[p.plan]}`}>{p.plan}</td>
              {(['maxUsers', 'maxStudents', 'maxTeachers', 'maxStorageGb', 'maxAssessmentsPerMonth'] as const).map((key) => (
                <td key={key} className="px-4 py-2 text-right">
                  <input
                    type="number"
                    value={fieldFor(p, key)}
                    onChange={(e) => setField(p.plan, key, e.target.value)}
                    placeholder="unlimited"
                    className="w-20 text-right text-[11.5px] border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </td>
              ))}
              <td className="px-4 py-2 text-right">
                {Object.keys(editing[p.plan] ?? {}).length > 0 && (
                  <button onClick={() => save(p.plan)} disabled={updatePlan.isPending} className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800">
                    Save
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InstituteUsageDrawer({ institute, onClose }: { institute: InstituteRow | null; onClose: () => void }) {
  const { data: usage, isPending: usagePending } = useFounderUsage(institute?.id ?? null);
  const { data: history, isPending: historyPending } = useFounderPlanHistory(institute?.id ?? null);

  if (!institute) return null;

  const historyRows: { id: string; fromPlan: string | null; toPlan: string; reason: string | null; createdAt: string }[] = history ?? [];

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-[14px] font-bold text-slate-900">{institute.name}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-5 space-y-5">
          <section>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Usage vs. plan limits</h4>
            {usagePending ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : usage ? (
              <div className="space-y-2">
                <UsageBar label="Users" used={usage.usage.users} limit={usage.limits?.maxUsers} />
                <UsageBar label="Students" used={usage.usage.students} limit={usage.limits?.maxStudents} />
                <UsageBar label="Teachers" used={usage.usage.teachers} limit={usage.limits?.maxTeachers} />
                {usage.trialEndsAt && (
                  <p className="text-[11px] text-amber-600 flex items-center gap-1 pt-1"><Clock className="w-3 h-3" /> Trial ends {new Date(usage.trialEndsAt).toLocaleDateString()}</p>
                )}
              </div>
            ) : <p className="text-[11.5px] text-slate-400">Usage unavailable.</p>}
          </section>

          <section>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Plan history</h4>
            {historyPending ? <Loader2 className="w-4 h-4 animate-spin text-slate-400" /> : historyRows.length === 0 ? (
              <p className="text-[11.5px] text-slate-400">No plan changes recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {historyRows.map((h) => (
                  <li key={h.id} className="text-[11.5px] text-slate-600 border-l-2 border-slate-200 pl-2.5">
                    <span className="font-semibold text-slate-800">{h.fromPlan ?? '—'} → {h.toPlan}</span>
                    <div className="text-slate-400">{new Date(h.createdAt).toLocaleString()}{h.reason ? ` · ${h.reason}` : ''}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, used, limit }: { label: string; used: number; limit?: number | null }) {
  const pct = limit ? Math.min(100, (used / limit) * 100) : 0;
  const overLimit = !!limit && used > limit;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-0.5">
        <span className="text-slate-600 font-medium">{label}</span>
        <span className={`font-bold ${overLimit ? 'text-rose-600' : 'text-slate-700'}`}>{used} / {limit ?? '∞'}</span>
      </div>
      {limit ? (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${overLimit ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  );
}
