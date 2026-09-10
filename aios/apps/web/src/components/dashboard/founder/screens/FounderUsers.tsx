'use client';
// ─── FounderUsers — real backend ───────────────────────────────────────────
// Cross-tenant user search (GET /founder/users), status changes (reuses the
// same PATCH /users/:id/status the Admin dashboard uses), and force-logout
// (Founder Console Phase 4 — bumps User.tokenVersion so every issued JWT for
// that user is rejected on its next use). No fake "AI Behavioral Insights"
// panel — that had no data behind it at all.

import { useState } from 'react';
import { Search, Users as UsersIcon, LogOut } from 'lucide-react';
import { useFounderUsers, useUpdateUserStatus, useForceLogoutUser } from '@/hooks/useApi';
import { SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui/foundation';

const ROLES = ['STUDENT', 'TEACHER', 'ADMIN', 'FOUNDER'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED'];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-rose-50 text-rose-700',
  INACTIVE: 'bg-slate-100 text-slate-500',
  PENDING: 'bg-amber-50 text-amber-700',
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  institute: { id: string; name: string };
}

type ConfirmAction = { type: 'suspend' | 'activate' | 'force-logout'; user: UserRow };

export function FounderUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const params: Record<string, unknown> = { page, pageSize: 20 };
  if (search.trim()) params.search = search.trim();
  if (roleFilter) params.role = roleFilter;
  if (statusFilter) params.status = statusFilter;

  const { data, isPending, isError } = useFounderUsers(params);
  const updateStatus = useUpdateUserStatus();
  const forceLogout = useForceLogoutUser();

  const rows: UserRow[] = data?.data ?? [];
  const meta: { total: number; page: number; totalPages: number } = data?.meta ?? { total: 0, page: 1, totalPages: 1 };

  const runConfirm = () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    const onSettled = () => setConfirmAction(null);
    if (type === 'suspend') updateStatus.mutate({ userId: user.id, status: 'SUSPENDED' }, { onSuccess: onSettled });
    if (type === 'activate') updateStatus.mutate({ userId: user.id, status: 'ACTIVE' }, { onSuccess: onSettled });
    if (type === 'force-logout') forceLogout.mutate(user.id, { onSuccess: onSettled });
  };

  const CONFIRM_COPY: Record<ConfirmAction['type'], { title: (n: string) => string; description: string; label: string; variant: 'danger' | 'warning' }> = {
    suspend: { title: (n) => `Suspend ${n}?`, description: 'They will be immediately signed out and unable to sign back in until reactivated.', label: 'Suspend', variant: 'danger' },
    activate: { title: (n) => `Reactivate ${n}?`, description: 'They will be able to sign in again.', label: 'Reactivate', variant: 'warning' },
    'force-logout': { title: (n) => `Force logout ${n}?`, description: 'Every session currently signed in as this user is invalidated immediately — they will need to sign in again.', label: 'Force logout', variant: 'danger' },
  };

  return (
    <div className="p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      <div>
        <h2 className="text-[15px] font-bold text-slate-900">Users</h2>
        <p className="text-xs text-slate-500 mt-0.5">Cross-tenant user search — every institute at once.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name or email..."
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-600">
          <option value="">Role: All</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-600">
          <option value="">Status: All</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {isPending && <SkeletonTable rows={8} cols={6} />}
      {isError && <EmptyState icon={<UsersIcon className="w-6 h-6" />} title="Couldn't load users" />}
      {!isPending && !isError && rows.length === 0 && <EmptyState icon={<UsersIcon className="w-6 h-6" />} title="No users found" />}

      {!isPending && !isError && rows.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">User</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Last login</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <div className="text-[12.5px] font-medium text-slate-800">{u.name}</div>
                    <div className="text-[11px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-slate-600">{u.institute?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-[11px] font-semibold text-slate-600">{u.role}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${STATUS_STYLE[u.status] ?? 'bg-slate-100 text-slate-600'}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-slate-400">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    {u.role !== 'FOUNDER' && (
                      <>
                        {u.status === 'SUSPENDED'
                          ? <button onClick={() => setConfirmAction({ type: 'activate', user: u })} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-800">Reactivate</button>
                          : <button onClick={() => setConfirmAction({ type: 'suspend', user: u })} className="text-[11px] font-semibold text-rose-600 hover:text-rose-800">Suspend</button>}
                        <button onClick={() => setConfirmAction({ type: 'force-logout', user: u })} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800">
                          <LogOut className="w-3 h-3" /> Force logout
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11.5px] text-slate-500">
            <span>{meta.total} user{meta.total === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40">‹ Prev</button>
              <span>Page {meta.page} / {meta.totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages} className="px-2.5 py-1 rounded border border-slate-200 bg-white disabled:opacity-40">Next ›</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction ? CONFIRM_COPY[confirmAction.type].title(confirmAction.user.name) : ''}
        description={confirmAction ? CONFIRM_COPY[confirmAction.type].description : ''}
        confirmLabel={confirmAction ? CONFIRM_COPY[confirmAction.type].label : ''}
        variant={confirmAction ? CONFIRM_COPY[confirmAction.type].variant : 'danger'}
        isLoading={updateStatus.isPending || forceLogout.isPending}
        onConfirm={runConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
