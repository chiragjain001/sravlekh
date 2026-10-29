'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Building2, Search, ChevronDown, X, Loader2, Plus,
  ExternalLink, UserCheck, ShieldAlert, CheckCircle2,
  Users, Layers, ArrowUpRight, Phone, MapPin, Mail, ChevronRight,
  Pencil, Trash2
} from 'lucide-react';
import {
  useFounderInstitutes,
  useUpdateInstitutePlan,
  useFounderUpdateInstitute,
  useArchiveInstitute,
  useSuspendInstitute,
  useReactivateInstitute,
  useFounderInstituteDetail,
  useCreateInstitute,
  useFounderImpersonate,
} from '@/hooks/useApi';
import { SkeletonTable, EmptyState, ConfirmDialog } from '@/components/ui/foundation';

const PLANS = ['TRIAL', 'BASIC', 'PRO', 'ENTERPRISE'];

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  SUSPENDED: 'bg-rose-50 text-rose-700 border-rose-100',
  ONBOARDING: 'bg-amber-50 text-amber-700 border-amber-100',
  ARCHIVED: 'bg-slate-100 text-slate-500 border-slate-200',
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
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingInstitute, setEditingInstitute] = useState<InstituteRow | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data, isPending, isError } = useFounderInstitutes(search.trim() ? { search: search.trim() } : undefined);
  const updatePlan = useUpdateInstitutePlan();
  const archiveInstitute = useArchiveInstitute();
  const suspendInstitute = useSuspendInstitute();
  const reactivateInstitute = useReactivateInstitute();
  const impersonate = useFounderImpersonate();

  const allRows: InstituteRow[] = data ?? [];

  const rows = useMemo(() => {
    if (statusFilter === 'ALL') return allRows;
    return allRows.filter((r) => r.status === statusFilter);
  }, [allRows, statusFilter]);

  const CONFIRM_COPY: Record<ConfirmAction['type'], { title: (n: string) => string; description: string; confirmLabel: string; variant: 'danger' | 'warning' }> = {
    archive: {
      title: (n) => `Delete / Archive "${n}"?`,
      description: 'This institute and its academic records are preserved safely in ARCHIVED status — nothing is destroyed — but all users immediately lose access. This is the safe enterprise deletion method to protect grade history and student audit records.',
      confirmLabel: 'Archive & Delete',
      variant: 'danger',
    },
    suspend: {
      title: (n) => `Deactivate / Suspend "${n}"?`,
      description: 'Every user at this institute is immediately blocked from signing in and from using any active session, until reactivated.',
      confirmLabel: 'Deactivate',
      variant: 'danger',
    },
    reactivate: {
      title: (n) => `Reactivate "${n}"?`,
      description: 'The institute status returns to ACTIVE and users regain access immediately.',
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
    <div className="p-3 sm:p-6 space-y-4 max-w-[1300px] mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Institutes Directory
            <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              {allRows.length} Total
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-tenant institution management, plan tiers, suspension control &amp; live ghost login.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm active:scale-[0.98] transition-all self-start sm:self-auto w-full sm:w-auto"
        >
          <Plus className="w-3.5 h-3.5" /> Onboard Institute
        </button>
      </div>

      {/* Apple-Style Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        {/* Status Segmented Pill Control */}
        <div className="bg-slate-100 p-1 rounded-2xl inline-flex items-center gap-1 overflow-x-auto max-w-full">
          {['ALL', 'ACTIVE', 'ONBOARDING', 'SUSPENDED', 'ARCHIVED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st === 'ALL' ? `All (${allRows.length})` : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search school name..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-100/90 border-0 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 text-slate-800 placeholder-slate-400"
          />
        </div>
      </div>

      {isPending && <SkeletonTable rows={6} cols={5} />}
      {isError && <EmptyState icon={<Building2 className="w-6 h-6" />} title="Couldn't load institutes" />}
      {!isPending && !isError && rows.length === 0 && (
        <EmptyState icon={<Building2 className="w-6 h-6" />} title="No institutes found matching criteria" />
      )}

      {!isPending && !isError && rows.length > 0 && (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Institute</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Plan</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Users / Batches</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-[12.5px] font-medium text-slate-800">
                      <button
                        onClick={() => setDetailId(i.id)}
                        className="hover:text-indigo-600 font-semibold text-left block truncate max-w-[240px]"
                      >
                        {i.name}
                      </button>
                      <span className="text-[10px] text-slate-400 block">ID: {i.id.slice(0, 10)}...</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative inline-block">
                        <select
                          value={i.plan}
                          onChange={(e) => updatePlan.mutate({ instituteId: i.id, plan: e.target.value })}
                          disabled={i.status === 'ARCHIVED'}
                          className="appearance-none pl-2.5 pr-6 py-1 text-[11.5px] font-bold border border-slate-200 rounded-lg bg-white text-slate-700 disabled:opacity-50"
                        >
                          {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {i.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">
                      <span className="font-semibold text-slate-800">{i._count?.users ?? 0}</span> users
                      <span className="text-slate-400"> · </span>
                      <span className="font-semibold text-slate-800">{i._count?.batches ?? 0}</span> batches
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Ghost Login Button */}
                        <button
                          onClick={() => impersonate.mutate(i.id)}
                          disabled={impersonate.isPending || i.status !== 'ACTIVE'}
                          title="Impersonate & View As School Admin"
                          className="px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-40"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Admin View</span>
                        </button>

                        <button
                          onClick={() => setDetailId(i.id)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          Details
                        </button>

                        <button
                          onClick={() => setEditingInstitute(i)}
                          title="Edit institute name, plan, address, phone, and domain allowlist"
                          className="px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>

                        {i.status !== 'SUSPENDED' && i.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => setConfirmAction({ type: 'suspend', institute: i })}
                            title="Deactivate / Suspend institute access immediately"
                            className="px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium"
                          >
                            Deactivate
                          </button>
                        )}
                        {i.status === 'SUSPENDED' && (
                          <button
                            onClick={() => setConfirmAction({ type: 'reactivate', institute: i })}
                            title="Reactivate institute access"
                            className="px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded-lg font-bold"
                          >
                            Reactivate
                          </button>
                        )}
                        {i.status !== 'ARCHIVED' && (
                          <button
                            onClick={() => setConfirmAction({ type: 'archive', institute: i })}
                            title="Soft-delete / Archive institute (keeps records safe)"
                            className="px-2 py-1 text-xs text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Inset Grouped Cards View (No Squished Tables!) */}
          <div className="sm:hidden space-y-2.5">
            {rows.map((i) => (
              <div
                key={i.id}
                className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-[13.5px] font-bold text-slate-900 leading-snug">{i.name}</h4>
                    <p className="text-[10.5px] text-slate-400 font-mono mt-0.5">ID: {i.id.slice(0, 10)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status]}`}>
                    {i.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">
                  <span>Plan: <strong className="text-slate-800">{i.plan}</strong></span>
                  <span><strong>{i._count?.users ?? 0}</strong> Users · <strong>{i._count?.batches ?? 0}</strong> Batches</span>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100">
                  <button
                    onClick={() => setDetailId(i.id)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-0.5"
                  >
                    Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {/* Ghost Login on Mobile */}
                    {i.status === 'ACTIVE' && (
                      <button
                        onClick={() => impersonate.mutate(i.id)}
                        disabled={impersonate.isPending}
                        className="px-2 py-1 text-xs font-bold text-indigo-700 bg-indigo-50 active:bg-indigo-100 rounded-lg flex items-center gap-1"
                      >
                        <UserCheck className="w-3 h-3" /> Admin View
                      </button>
                    )}

                    <button
                      onClick={() => setEditingInstitute(i)}
                      className="px-2 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 active:bg-indigo-100 rounded-lg flex items-center gap-1"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>

                    {i.status !== 'SUSPENDED' && i.status !== 'ARCHIVED' ? (
                      <button
                        onClick={() => setConfirmAction({ type: 'suspend', institute: i })}
                        className="px-2 py-1 text-xs text-rose-600 bg-rose-50 rounded-lg font-medium"
                      >
                        Deactivate
                      </button>
                    ) : i.status === 'SUSPENDED' ? (
                      <button
                        onClick={() => setConfirmAction({ type: 'reactivate', institute: i })}
                        className="px-2 py-1 text-xs text-emerald-700 bg-emerald-50 rounded-lg font-bold"
                      >
                        Reactivate
                      </button>
                    ) : null}

                    {i.status !== 'ARCHIVED' && (
                      <button
                        onClick={() => setConfirmAction({ type: 'archive', institute: i })}
                        className="px-2 py-1 text-xs text-slate-500 bg-slate-100 hover:text-rose-600 rounded-lg font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen
          title={CONFIRM_COPY[confirmAction.type].title(confirmAction.institute.name)}
          description={CONFIRM_COPY[confirmAction.type].description}
          confirmLabel={CONFIRM_COPY[confirmAction.type].confirmLabel}
          variant={CONFIRM_COPY[confirmAction.type].variant}
          isLoading={isConfirmLoading}
          onConfirm={runConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Institute Detail Drawer with Mobile Support */}
      {detailId && (
        <InstituteDetailDrawer
          instituteId={detailId}
          onClose={() => setDetailId(null)}
          onImpersonate={() => impersonate.mutate(detailId)}
          onEdit={(inst) => setEditingInstitute(inst)}
          onAction={(type, inst) => setConfirmAction({ type, institute: inst })}
        />
      )}

      {/* Edit Institute Dialog */}
      {editingInstitute && (
        <EditInstituteDialog
          institute={editingInstitute}
          onClose={() => setEditingInstitute(null)}
        />
      )}

      {/* Onboard Institute Dialog */}
      {showCreate && (
        <CreateInstituteDialog onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

// ── Modals & Drawers ─────────────────────────────────────────────────────────

function InstituteDetailDrawer({
  instituteId,
  onClose,
  onImpersonate,
  onEdit,
  onAction,
}: {
  instituteId: string | null;
  onClose: () => void;
  onImpersonate: () => void;
  onEdit?: (inst: InstituteRow) => void;
  onAction?: (type: 'archive' | 'suspend' | 'reactivate', inst: InstituteRow) => void;
}) {
  const { data, isPending, isError } = useFounderInstituteDetail(instituteId);
  const detail = data as any;

  if (!instituteId) return null;

  const rowData: InstituteRow | null = detail
    ? {
        id: detail.id,
        name: detail.name,
        plan: detail.plan,
        status: detail.status,
        createdAt: detail.createdAt,
        _count: {
          users: (detail.studentCount ?? 0) + (detail.teacherCount ?? 0) + (detail.admins?.length ?? 0),
          batches: detail.branches?.length ?? 0,
        },
      }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col p-5 sm:p-6 animate-slide-in overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">School Profile</span>
            <h3 className="text-base font-bold text-slate-900 truncate max-w-[240px]">{detail?.name ?? 'Institute Detail'}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isPending && (
          <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        )}

        {detail && (
          <div className="py-4 space-y-4 text-xs">
            {/* Quick Actions Bar */}
            <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-indigo-900 text-[12px]">Institute Actions</p>
                  <p className="text-[11px] text-indigo-600">Administrative tools</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {rowData && onEdit && (
                    <button
                      onClick={() => {
                        onClose();
                        onEdit(rowData);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1 shadow-xs"
                    >
                      <Pencil className="w-3 h-3 text-slate-500" /> Edit
                    </button>
                  )}
                  {detail.status === 'ACTIVE' && (
                    <button
                      onClick={onImpersonate}
                      className="px-2.5 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-xs hover:bg-indigo-700 flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" /> Admin View
                    </button>
                  )}
                </div>
              </div>

              {/* Status Actions */}
              {rowData && onAction && (
                <div className="pt-2 border-t border-indigo-100 flex items-center gap-2 flex-wrap">
                  {detail.status !== 'SUSPENDED' && detail.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => {
                        onClose();
                        onAction('suspend', rowData);
                      }}
                      className="px-2 py-1 text-[11px] font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50"
                    >
                      Deactivate
                    </button>
                  )}
                  {detail.status === 'SUSPENDED' && (
                    <button
                      onClick={() => {
                        onClose();
                        onAction('reactivate', rowData);
                      }}
                      className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50"
                    >
                      Reactivate
                    </button>
                  )}
                  {detail.status !== 'ARCHIVED' && (
                    <button
                      onClick={() => {
                        onClose();
                        onAction('archive', rowData);
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:text-rose-600 hover:border-rose-200 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Plan Tier</span>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{detail.plan}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Account Status</span>
                <p className={`text-sm font-bold mt-0.5 ${detail.status === 'ACTIVE' ? 'text-emerald-600' : detail.status === 'SUSPENDED' ? 'text-rose-600' : 'text-slate-600'}`}>
                  {detail.status}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Enrolled Students</span>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{detail.studentCount ?? 0}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Active Teachers</span>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{detail.teacherCount ?? 0}</p>
              </div>
            </div>

            {/* Contact & Allowlist Details */}
            {(detail.address || detail.phone || (detail.domainAllowlist && detail.domainAllowlist.length > 0)) && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact & Domains</span>
                {detail.phone && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium">{detail.phone}</span>
                  </div>
                )}
                {detail.address && (
                  <div className="flex items-center gap-2 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{detail.address}</span>
                  </div>
                )}
                {detail.domainAllowlist && detail.domainAllowlist.length > 0 && (
                  <div className="flex items-start gap-2 text-slate-700">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {detail.domainAllowlist.map((d: string) => (
                        <span key={d} className="px-1.5 py-0.5 rounded bg-slate-200/70 font-mono text-[10px] text-slate-700">
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Admins List */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Institute Admins ({detail.admins?.length ?? 0})
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl bg-white overflow-hidden">
                {detail.admins?.map((adm: any) => (
                  <div key={adm.id} className="p-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{adm.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{adm.email}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      {adm.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Branches */}
            {detail.branches && detail.branches.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Branches</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.branches.map((b: any) => (
                    <span key={b.id} className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 text-xs font-medium">
                      {b.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EditInstituteDialog({
  institute,
  onClose,
}: {
  institute: InstituteRow;
  onClose: () => void;
}) {
  const { data: detail, isPending: isDetailLoading } = useFounderInstituteDetail(institute.id);
  const updateInstitute = useFounderUpdateInstitute();

  const [name, setName] = useState(institute.name);
  const [plan, setPlan] = useState(institute.plan);
  const [domainAllowlist, setDomainAllowlist] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (detail) {
      if (detail.name) setName(detail.name);
      if (detail.plan) setPlan(detail.plan);
      if (detail.address) setAddress(detail.address);
      if (detail.phone) setPhone(detail.phone);
      if (Array.isArray(detail.domainAllowlist)) {
        setDomainAllowlist(detail.domainAllowlist.join(', '));
      }
    }
  }, [detail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const domains = domainAllowlist
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    await updateInstitute.mutateAsync({
      id: institute.id,
      name: name.trim(),
      plan,
      currentPlan: detail?.plan || institute.plan,
      address: address.trim() || undefined,
      phone: phone.trim() || undefined,
      domainAllowlist: domains,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-slate-900">Edit Institute Details</h3>
              <p className="text-[11px] text-slate-500">Update school identity, plan tier, and allowlist</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isDetailLoading && !detail ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <span>Fetching institute record...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Institute / School Name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Apex Global Academy"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Subscription Plan</label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-bold bg-white"
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Contact Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Address / City</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Kota, Rajasthan"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Domain Allowlist (Comma separated)</label>
              <input
                value={domainAllowlist}
                onChange={(e) => setDomainAllowlist(e.target.value)}
                placeholder="e.g. apexacademy.edu, apex.ac.in"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              />
              <p className="text-[10px] text-slate-400 mt-1">Users logging in with these Google email domains will auto-map to this school.</p>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateInstitute.isPending}
                className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                {updateInstitute.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CreateInstituteDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [plan, setPlan] = useState('PRO');
  const [domainAllowlist, setDomainAllowlist] = useState('');
  const [address, setAddress] = useState('');
  const createInstitute = useCreateInstitute();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const domains = domainAllowlist
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    await createInstitute.mutateAsync({
      name: name.trim(),
      plan,
      domainAllowlist: domains,
      address: address.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl space-y-4 animate-fade-in">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 className="text-[15px] font-bold text-slate-900">Onboard New Institute</h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Institute / School Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apex Global Academy"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-medium"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Starting Plan</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 font-bold"
              >
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Address / City</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Kota, Rajasthan"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Domain Allowlist (Comma separated)</label>
            <input
              value={domainAllowlist}
              onChange={(e) => setDomainAllowlist(e.target.value)}
              placeholder="e.g. apexacademy.edu, apex.ac.in"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20"
            />
            <p className="text-[10px] text-slate-400 mt-1">Users logging in with these Google emails will auto-map to this school.</p>
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
              disabled={createInstitute.isPending}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm"
            >
              {createInstitute.isPending ? 'Onboarding...' : 'Create School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
