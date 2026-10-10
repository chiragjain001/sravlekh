'use client';
// ─── AdminSystemSettings — Institute Profile & Domain Access ─────────────────
// Real data only. Trimmed from the original 4-tab layout to the 2 tabs that
// have a real backend: Institute Profile (PATCH /institutes/:id) and
// Domain/Access allow-list (the real AllowListEntry CRUD). "Academic Rules"
// and "Notification Preferences" were dropped — no schema/service backs
// either, and inventing one would repeat the fee-service mistake this project
// has already been steered away from once.

import React, { useState, useEffect, useMemo } from 'react';
import { Building, ShieldCheck, Save, Loader2, Check, Plus, Trash2, X, KeyRound } from 'lucide-react';
import {
  useInstitute, useUpdateInstitute, useAllowList, useAddAllowListEntry, useRemoveAllowListEntry,
} from '@/hooks/useApi';
import { ConfirmDialog } from '@/components/ui/foundation';
import { AppleDropdown, AppleDropdownOption } from '@/components/ui/AppleDropdown';
import { AdminPermissionsPanel } from '@/components/dashboard/admin/permissions/AdminPermissionsPanel';

type SettingsTab = 'profile' | 'access' | 'permissions';
const ROLE_OPTIONS: AppleDropdownOption[] = [
  { value: 'STUDENT', label: 'STUDENT', badge: 'Student' },
  { value: 'TEACHER', label: 'TEACHER', badge: 'Faculty' },
  { value: 'ADMIN', label: 'ADMIN', badge: 'Admin' },
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
        <form onSubmit={handleAdd} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-end gap-3 shadow-xs">
          <div className="flex-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
              Email Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@institute.com"
              className="w-full text-xs font-semibold border border-slate-200/90 rounded-xl px-3.5 py-2 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all min-h-[36px]"
            />
          </div>
          <div className="w-full sm:w-44">
            <AppleDropdown
              label="Assigned Role"
              value={role}
              onChange={setRole}
              options={ROLE_OPTIONS}
              size="sm"
            />
          </div>
          <div className="flex items-center gap-1.5 pt-1 sm:pt-0">
            <button
              type="submit"
              disabled={addMutation.isPending || !email.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer min-h-[36px]"
            >
              {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="p-2 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer min-h-[36px] flex items-center justify-center"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
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

export function AdminSystemSettings() {
  const [tab, setTab] = useState<SettingsTab>('profile');

  return (
    <div className="p-4 sm:p-6 text-[#1e293b] animate-fadein space-y-6 max-w-[1400px] mx-auto w-full">
      <div className="pb-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Institute System Settings</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage your institute profile, Google OAuth domain access, fine-grained roles, and access control policies
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-slate-100 p-2 bg-slate-50/70 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile' as const, label: 'Institute Profile', icon: Building },
            { id: 'access' as const, label: 'Domain & Access', icon: ShieldCheck },
            { id: 'permissions' as const, label: 'Permissions & Access Control', icon: KeyRound },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                tab === t.id
                  ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60 font-bold'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <t.icon className={`w-3.5 h-3.5 ${tab === t.id ? 'text-indigo-600' : 'text-slate-400'}`} /> {t.label}
            </button>
          ))}
        </div>
        <div className="p-4 sm:p-6">
          {tab === 'profile' ? <ProfileTab /> : tab === 'access' ? <AccessTab /> : <AdminPermissionsPanel />}
        </div>
      </div>
    </div>
  );
}
