'use client';
// ─── FounderInstitutes — real backend ──────────────────────────────────────
// Archive is a soft-delete (status = ARCHIVED) — 04-DATABASE-SCHEMA.md: never
// a hard DB delete, gated to FOUNDER only.

import { useState } from 'react';
import { Building2, Search, ChevronDown } from 'lucide-react';
import { useFounderInstitutes, useUpdateInstitutePlan, useArchiveInstitute } from '@/hooks/useApi';
import { SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui/foundation';

const PLANS = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-rose-50 text-rose-700',
  ONBOARDING: 'bg-amber-50 text-amber-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

interface InstituteRow {
  id: string;
  name: string;
  plan: string;
  status: string;
  createdAt: string;
  _count: { users: number; batches: number };
}

export function FounderInstitutes() {
  const [search, setSearch] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<InstituteRow | null>(null);

  const { data, isPending, isError } = useFounderInstitutes(search.trim() ? { search: search.trim() } : undefined);
  const updatePlan = useUpdateInstitutePlan();
  const archiveInstitute = useArchiveInstitute();

  const rows: InstituteRow[] = data ?? [];

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Institutes</h2>
        <p className="text-xs text-slate-500 mt-0.5">Every institute on the platform. Archiving is a soft-delete — nothing is ever hard-deleted.</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search institutes..."
          className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {isPending && <SkeletonTable rows={6} cols={5} />}
      {isError && <EmptyState icon={<Building2 className="w-6 h-6" />} title="Couldn't load institutes" />}
      {!isPending && !isError && rows.length === 0 && <EmptyState icon={<Building2 className="w-6 h-6" />} title="No institutes found" />}

      {!isPending && !isError && rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Plan</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Users / Batches</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">{i.name}</td>
                  <td className="px-4 py-3">
                    <div className="relative inline-block">
                      <select
                        value={i.plan}
                        onChange={(e) => updatePlan.mutate({ instituteId: i.id, plan: e.target.value })}
                        disabled={i.status === 'ARCHIVED'}
                        className="appearance-none pl-2 pr-6 py-1 text-[11.5px] font-semibold border border-slate-200 rounded-md bg-white text-slate-700 disabled:opacity-50"
                      >
                        {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[i.status] ?? 'bg-slate-100 text-slate-600'}`}>{i.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{i._count.users} / {i._count.batches}</td>
                  <td className="px-4 py-3 text-right">
                    {i.status !== 'ARCHIVED' && (
                      <button onClick={() => setArchiveTarget(i)} className="text-[11px] font-semibold text-rose-600 hover:text-rose-800">
                        Archive
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!archiveTarget}
        title={`Archive "${archiveTarget?.name}"?`}
        description="This institute and its data are kept — nothing is deleted — but it moves to ARCHIVED status and its users lose access. This can only be reversed by support."
        confirmLabel="Archive"
        variant="danger"
        isLoading={archiveInstitute.isPending}
        onConfirm={() => archiveTarget && archiveInstitute.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) })}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
