'use client';
// ─── AdminSystemSettings — Institute Profile & Domain Access ─────────────────
// Real data only. Trimmed from the original 4-tab layout to the 2 tabs that
// have a real backend: Institute Profile (PATCH /institutes/:id) and
// Domain/Access allow-list (the real AllowListEntry CRUD). "Academic Rules"
// and "Notification Preferences" were dropped — no schema/service backs
// either, and inventing one would repeat the fee-service mistake this project
// has already been steered away from once.

import React, { useState, useEffect } from 'react';
import { Building, ShieldCheck, Save, Loader2, Check, Plus, Trash2, X, KeyRound } from 'lucide-react';
import {
  useInstitute, useUpdateInstitute, useAllowList, useAddAllowListEntry, useRemoveAllowListEntry,
  usePermissionGrants, useCreatePermissionGrant, useTeachers, useBatches, useSubjects,
} from '@/hooks/useApi';
import { ConfirmDialog } from '@/components/ui/foundation';

type SettingsTab = 'profile' | 'access' | 'permissions';
const ROLES = ['STUDENT', 'TEACHER', 'ADMIN'];

// Only permission this app actually reads server-side today
// (evaluations.service.ts's override() check) — kept as a fixed choice
// rather than a free-text field so this screen can't grant a permission
// string nothing in the backend recognizes.
const GRANTABLE_PERMISSIONS = [
  { value: 'REVIEW_EVALUATION', label: 'Review Evaluation', description: 'Lets a teacher override an already-decided evaluation (dispute an existing score), optionally scoped to one batch/subject.' },
];

function ProfileTab() {
  const { data: institute, isPending } = useInstitute();
  const updateMutation = useUpdateInstitute();
  const [form, setForm] = useState({ name: '', address: '', phone: '' });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (institute) setForm({ name: institute.name ?? '', address: institute.address ?? '', phone: institute.phone ?? '' });
  }, [institute]);

  if (isPending) return <div className="h-64 bg-slate-100 rounded-xl animate-pulse" />;

  async function handleSave() {
    await updateMutation.mutateAsync(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Institute Name</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Address</label>
        <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">Phone</label>
        <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
      </div>
      <div className="flex items-center gap-3 text-xs text-slate-500">
        <span>Plan: <span className="font-bold text-slate-700">{institute?.plan}</span></span>
        <span>Status: <span className="font-bold text-slate-700">{institute?.status}</span></span>
      </div>
      <button onClick={handleSave} disabled={updateMutation.isPending} className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-60">
        {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {updateMutation.isPending ? 'Saving…' : saved ? 'Saved!' : 'Save Profile'}
      </button>
    </div>
  );
}

function AccessTab() {
  const { data: entries, isPending } = useAllowList();
  const addMutation = useAddAllowListEntry();
  const removeMutation = useRemoveAllowListEntry();
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STUDENT');
  const [pendingRemove, setPendingRemove] = useState<{ id: string; email: string } | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    await addMutation.mutateAsync({ email: email.trim(), role });
    setEmail('');
    setShowAdd(false);
  }

  async function handleConfirmRemove() {
    if (!pendingRemove) return;
    await removeMutation.mutateAsync(pendingRemove.id);
    setPendingRemove(null);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-slate-700">Domain / User Allow-list</p>
          <p className="text-[11px] text-slate-500 mt-0.5">Only these emails can sign in to this institute via Google Sign-In.</p>
        </div>
        <button onClick={() => setShowAdd((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <Plus className="w-3.5 h-3.5" /> Add Entry
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@institute.com" className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" disabled={addMutation.isPending} className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60">
            {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
          </button>
          <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg"><X className="w-3.5 h-3.5" /></button>
        </form>
      )}

      {isPending ? (
        <div className="space-y-2 animate-pulse">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}</div>
      ) : !entries || entries.length === 0 ? (
        <p className="text-xs text-slate-400 py-8 text-center">No allow-list entries yet — no one outside a pre-approved email can sign in.</p>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e: any) => (
            <div key={e.id} className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-100 rounded-lg">
              <div>
                <span className="text-xs font-bold text-slate-800">{e.email}</span>
                <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{e.role}</span>
              </div>
              <button onClick={() => setPendingRemove({ id: e.id, email: e.email })} disabled={removeMutation.isPending} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 disabled:opacity-50" aria-label="Remove"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!pendingRemove}
        title="Remove allow-list entry?"
        description={`${pendingRemove?.email ?? ''} will no longer be able to sign in to this institute via Google Sign-In. This takes effect immediately.`}
        confirmLabel="Remove access"
        variant="danger"
        isLoading={removeMutation.isPending}
        onConfirm={handleConfirmRemove}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  );
}

function PermissionsTab() {
  const { data: grants, isPending } = usePermissionGrants();
  const { data: teachersResp } = useTeachers();
  const { data: batchesResp } = useBatches();
  const { data: subjectsResp } = useSubjects();
  const createGrant = useCreatePermissionGrant();

  const teachers: { id: string; user: { id: string; name: string; email: string } }[] = teachersResp?.data ?? [];
  const batches: { id: string; name: string }[] = batchesResp?.data ?? batchesResp ?? [];
  const subjects: { id: string; name: string }[] = subjectsResp ?? [];

  const [userId, setUserId] = useState('');
  const [permission, setPermission] = useState(GRANTABLE_PERMISSIONS[0]!.value);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  async function handleGrant(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    await createGrant.mutateAsync({ userId, permission, batchId: batchId || undefined, subjectId: subjectId || undefined });
    setUserId(''); setBatchId(''); setSubjectId('');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <p className="text-xs font-bold text-slate-700">Grant a permission</p>
        <p className="text-[11px] text-slate-500 mt-0.5">Role alone (even Admin) doesn&apos;t imply these — a teacher can only override an already-decided evaluation once granted REVIEW_EVALUATION here, optionally scoped to one batch or subject.</p>
      </div>

      <form onSubmit={handleGrant} className="p-4 bg-slate-50 rounded-xl border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Teacher</label>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="">Select a teacher…</option>
            {teachers.filter((t: any) => !!t.user?.id).map((t: any) => <option key={t.user.id} value={t.user.id}>{t.user.name} ({t.user.email})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Permission</label>
          <select value={permission} onChange={(e) => setPermission(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
            {GRANTABLE_PERMISSIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Scope to batch (optional)</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="">Institute-wide</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Scope to subject (optional)</label>
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white">
            <option value="">All subjects</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={!userId || createGrant.isPending} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
            {createGrant.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Grant
          </button>
        </div>
      </form>

      <div>
        <p className="text-xs font-bold text-slate-700 mb-2">Active grants</p>
        {isPending ? (
          <div className="space-y-2 animate-pulse">{[1, 2].map((i) => <div key={i} className="h-10 bg-slate-100 rounded-lg" />)}</div>
        ) : !grants || grants.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No permission grants yet.</p>
        ) : (
          <div className="space-y-1.5">
            {grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-100 rounded-lg">
                <div>
                  <span className="text-xs font-bold text-slate-800">{g.user?.name ?? 'Unknown User'}</span>
                  <span className="ml-2 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{g.permission}</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  {g.batchId ? batches.find((b) => b.id === g.batchId)?.name ?? 'One batch' : 'Institute-wide'}
                  {g.subjectId && ` · ${subjects.find((s) => s.id === g.subjectId)?.name ?? 'One subject'}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminSystemSettings() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  return (
    <div className="p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="pb-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">Institute Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Institute profile and sign-in access control — the only settings backed by a real service today</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="flex items-center gap-2 border-b border-gray-100 p-2 bg-gray-50/50">
          {[
            { id: 'profile' as const, label: 'Institute Profile', icon: Building },
            { id: 'access' as const, label: 'Domain & Access', icon: ShieldCheck },
            { id: 'permissions' as const, label: 'Permissions', icon: KeyRound },
          ].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === t.id ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-600 hover:bg-white hover:text-gray-900'}`}>
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-6">
          {tab === 'profile' ? <ProfileTab /> : tab === 'access' ? <AccessTab /> : <PermissionsTab />}
        </div>
      </div>
    </div>
  );
}
