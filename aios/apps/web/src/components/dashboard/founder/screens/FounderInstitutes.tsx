'use client';
// ─── FounderInstitutes — real backend ──────────────────────────────────────
// Archive is a soft-delete (status = ARCHIVED) — 04-DATABASE-SCHEMA.md: never
// a hard DB delete, gated to FOUNDER only. Suspend/reactivate toggle
// InstituteStatus.SUSPENDED, enforced at the auth boundary (AuthService) so
// it blocks tenant access immediately, not just cosmetically in this table.

import { useState } from 'react';
import { Building2, Search, ChevronDown, X, Loader2, Plus } from 'lucide-react';
import {
  useFounderInstitutes,
  useUpdateInstitutePlan,
  useArchiveInstitute,
  useSuspendInstitute,
  useReactivateInstitute,
  useFounderInstituteDetail,
  useCreateInstitute,
} from '@/hooks/useApi';
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

type ConfirmAction = { type: 'archive' | 'suspend' | 'reactivate'; institute: InstituteRow };

export function FounderInstitutes() {
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isPending, isError } = useFounderInstitutes(search.trim() ? { search: search.trim() } : undefined);
  const updatePlan = useUpdateInstitutePlan();
  const archiveInstitute = useArchiveInstitute();
  const suspendInstitute = useSuspendInstitute();
  const reactivateInstitute = useReactivateInstitute();

  const rows: InstituteRow[] = data ?? [];

  const CONFIRM_COPY: Record<ConfirmAction['type'], { title: (n: string) => string; description: string; confirmLabel: string; variant: 'danger' | 'warning' }> = {
    archive: {
      title: (n) => `Archive "${n}"?`,
      description: 'This institute and its data are kept — nothing is deleted — but it moves to ARCHIVED status and its users lose access. This can only be reversed by support.',
      confirmLabel: 'Archive',
      variant: 'danger',
    },
    suspend: {
      title: (n) => `Suspend "${n}"?`,
      description: 'Every non-Founder user at this institute is immediately blocked from signing in and from using any active session, until reactivated.',
      confirmLabel: 'Suspend',
      variant: 'danger',
    },
    reactivate: {
      title: (n) => `Reactivate "${n}"?`,
      description: 'Users regain access immediately.',
      confirmLabel: 'Reactivate',
      variant: 'warning',
    },
  };

  const runConfirmAction = () => {
    if (!confirmAction) return;
    const { type, institute } = confirmAction;
    const onSettled = () => setConfirmAction(null);
    if (type === 'archive') archiveInstitute.mutate(institute.id, { onSuccess: onSettled });
    if (type === 'suspend') suspendInstitute.mutate(institute.id, { onSuccess: onSettled });
    if (type === 'reactivate') reactivateInstitute.mutate(institute.id, { onSuccess: onSettled });
  };

  const isConfirmLoading = archiveInstitute.isPending || suspendInstitute.isPending || reactivateInstitute.isPending;

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Institutes</h2>
          <p className="text-xs text-slate-500 mt-0.5">Every institute on the platform. Archiving is a soft-delete — nothing is ever hard-deleted.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm flex-shrink-0"
        >
          <Plus className="w-3.5 h-3.5" /> Add Institute
        </button>
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
                  <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">
                    <button onClick={() => setDetailId(i.id)} className="hover:text-indigo-600 hover:underline text-left">
                      {i.name}
                    </button>
                  </td>
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
                  <td className="px-4 py-3 text-[12px] text-slate-500">{i._count?.users ?? 0} / {i._count?.batches ?? 0}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {i.status === 'ACTIVE' && (
                      <button onClick={() => setConfirmAction({ type: 'suspend', institute: i })} className="text-[11px] font-semibold text-amber-600 hover:text-amber-800">
                        Suspend
                      </button>
                    )}
                    {i.status === 'SUSPENDED' && (
                      <button onClick={() => setConfirmAction({ type: 'reactivate', institute: i })} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800">
                        Reactivate
                      </button>
                    )}
                    {i.status !== 'ARCHIVED' && (
                      <button onClick={() => setConfirmAction({ type: 'archive', institute: i })} className="text-[11px] font-semibold text-rose-600 hover:text-rose-800">
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
        isOpen={!!confirmAction}
        title={confirmAction ? CONFIRM_COPY[confirmAction.type].title(confirmAction.institute.name) : ''}
        description={confirmAction ? CONFIRM_COPY[confirmAction.type].description : ''}
        confirmLabel={confirmAction ? CONFIRM_COPY[confirmAction.type].confirmLabel : ''}
        variant={confirmAction ? CONFIRM_COPY[confirmAction.type].variant : 'danger'}
        isLoading={isConfirmLoading}
        onConfirm={runConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />

      <InstituteDetailDrawer instituteId={detailId} onClose={() => setDetailId(null)} />
      {showCreate && <CreateInstituteModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateInstituteModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [domainAllowlistRaw, setDomainAllowlistRaw] = useState('');
  const [plan, setPlan] = useState('TRIAL');
  const [address, setAddress] = useState('');
  const createInstitute = useCreateInstitute();

  const domainAllowlist = domainAllowlistRaw.split(',').map((d) => d.trim()).filter(Boolean);
  const canSubmit = name.trim().length >= 2 && domainAllowlist.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await createInstitute.mutateAsync({ name: name.trim(), domainAllowlist, plan, address: address.trim() || undefined });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-slate-800">Add Institute</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Institute name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sunrise Coaching Institute"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Allowed sign-in domains / emails</label>
          <input
            value={domainAllowlistRaw}
            onChange={(e) => setDomainAllowlistRaw(e.target.value)}
            placeholder="@sunrisecoaching.com, admin@gmail.com"
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-[10.5px] text-slate-400 mt-1">Comma-separated. At least one is required — only these can sign in via Google Sign-In.</p>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
            {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Address (optional)</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit || createInstitute.isPending}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
          >
            {createInstitute.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create Institute
          </button>
        </div>
      </form>
    </div>
  );
}

interface InstituteDetail extends InstituteRow {
  address: string | null;
  phone: string | null;
  domainAllowlist: string[];
  branches: { id: string; name: string }[];
  admins: { id: string; name: string; email: string; status: string; lastLoginAt: string | null }[];
  allowListEntries: { id: string; email: string; role: string }[];
  studentCount: number;
  teacherCount: number;
}

function InstituteDetailDrawer({ instituteId, onClose }: { instituteId: string | null; onClose: () => void }) {
  const { data, isPending, isError } = useFounderInstituteDetail(instituteId);
  const detail = data as InstituteDetail | undefined;

  if (!instituteId) return null;

  return (
    <div className="fixed inset-0 z-[300] flex justify-end bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h3 className="text-[14px] font-bold text-slate-900">{detail?.name ?? 'Institute detail'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        {isPending && (
          <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        )}
        {isError && <div className="p-5"><EmptyState icon={<Building2 className="w-6 h-6" />} title="Couldn't load institute detail" /></div>}

        {detail && (
          <div className="p-5 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Plan" value={detail.plan} />
              <Stat label="Status" value={detail.status} />
              <Stat label="Admins" value={String(detail.admins.length)} />
              <Stat label="Users" value={String(detail._count?.users ?? 0)} />
              <Stat label="Students" value={String(detail.studentCount)} />
              <Stat label="Teachers" value={String(detail.teacherCount)} />
              <Stat label="Batches" value={String(detail._count?.batches ?? 0)} />
              <Stat label="Branches" value={String(detail.branches.length)} />
            </div>

            {(detail.address || detail.phone) && (
              <div className="text-[12px] text-slate-600 space-y-1">
                {detail.address && <div>{detail.address}</div>}
                {detail.phone && <div>{detail.phone}</div>}
              </div>
            )}

            <Section title="Domain allow-list">
              {detail.domainAllowlist.length === 0
                ? <p className="text-[11.5px] text-slate-400">No domain restrictions.</p>
                : <div className="flex flex-wrap gap-1.5">{detail.domainAllowlist.map((d) => <span key={d} className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">{d}</span>)}</div>}
            </Section>

            <Section title={`Admins (${detail.admins.length})`}>
              {detail.admins.length === 0
                ? <p className="text-[11.5px] text-slate-400">No admin users yet.</p>
                : <ul className="space-y-1.5">
                    {detail.admins.map((a) => (
                      <li key={a.id} className="flex items-center justify-between text-[12px]">
                        <span className="text-slate-700">{a.name} <span className="text-slate-400">· {a.email}</span></span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${a.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                      </li>
                    ))}
                  </ul>}
            </Section>

            <Section title={`Branches (${detail.branches.length})`}>
              {detail.branches.length === 0
                ? <p className="text-[11.5px] text-slate-400">No branches recorded.</p>
                : <ul className="space-y-1 text-[12px] text-slate-700">{detail.branches.map((b) => <li key={b.id}>{b.name}</li>)}</ul>}
            </Section>

            <Section title={`Recent allow-list entries (${detail.allowListEntries.length})`}>
              {detail.allowListEntries.length === 0
                ? <p className="text-[11.5px] text-slate-400">No pending invites.</p>
                : <ul className="space-y-1 text-[12px] text-slate-700">
                    {detail.allowListEntries.map((e) => <li key={e.id}>{e.email} <span className="text-slate-400">· {e.role}</span></li>)}
                  </ul>}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-[13px] font-bold text-slate-800 mt-0.5">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">{title}</h4>
      {children}
    </div>
  );
}
