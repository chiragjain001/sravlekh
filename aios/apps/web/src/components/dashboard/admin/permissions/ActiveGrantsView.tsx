'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Trash2,
  Filter,
  CheckSquare,
  Square,
  Shield,
  Layers,
  FileText,
  ClipboardList,
  Star,
  Clock,
  Briefcase,
  BarChart2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { usePermissionGrants, useRevokePermissionGrant, useRevokeBulkGrants } from '@/hooks/useApi';
import { ConfirmDialog } from '@/components/ui/foundation';

export function ActiveGrantsView() {
  const { data: grants, isLoading } = usePermissionGrants();
  const revokeSingleMutation = useRevokePermissionGrant();
  const revokeBulkMutation = useRevokeBulkGrants();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedScopeType, setSelectedScopeType] = useState<'ALL' | 'INSTITUTE' | 'SCOPED'>('ALL');
  const [selectedGrantIds, setSelectedGrantIds] = useState<string[]>([]);

  const [pendingRevokeSingle, setPendingRevokeSingle] = useState<{ id: string; name: string; perm: string } | null>(
    null,
  );
  const [showBulkRevokeConfirm, setShowBulkRevokeConfirm] = useState(false);

  const filteredGrants = useMemo(() => {
    if (!grants) return [];
    return grants.filter((g) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const userName = g.user?.name?.toLowerCase() ?? '';
        const userEmail = g.user?.email?.toLowerCase() ?? '';
        const perm = g.permission.toLowerCase();
        const batchName = g.batchName?.toLowerCase() ?? '';
        const subjectName = g.subjectName?.toLowerCase() ?? '';

        if (!userName.includes(q) && !userEmail.includes(q) && !perm.includes(q) && !batchName.includes(q) && !subjectName.includes(q)) {
          return false;
        }
      }

      // Scope filter
      if (selectedScopeType === 'INSTITUTE' && (g.batchId || g.subjectId)) return false;
      if (selectedScopeType === 'SCOPED' && !g.batchId && !g.subjectId) return false;

      return true;
    });
  }, [grants, searchQuery, selectedScopeType]);

  const handleToggleSelect = (id: string) => {
    setSelectedGrantIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleSelectAll = () => {
    if (selectedGrantIds.length === filteredGrants.length) {
      setSelectedGrantIds([]);
    } else {
      setSelectedGrantIds(filteredGrants.map((g) => g.id));
    }
  };

  const handleConfirmSingleRevoke = async () => {
    if (!pendingRevokeSingle) return;
    await revokeSingleMutation.mutateAsync(pendingRevokeSingle.id);
    setSelectedGrantIds((prev) => prev.filter((id) => id !== pendingRevokeSingle.id));
    setPendingRevokeSingle(null);
  };

  const handleConfirmBulkRevoke = async () => {
    if (selectedGrantIds.length === 0) return;
    await revokeBulkMutation.mutateAsync(selectedGrantIds);
    setSelectedGrantIds([]);
    setShowBulkRevokeConfirm(false);
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-2xl border border-slate-200/60" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Search & Filter Controls ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by teacher, email, capability, or batch…"
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Scope filter */}
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-[11px] font-semibold text-slate-600">
            {(['ALL', 'INSTITUTE', 'SCOPED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedScopeType(st)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  selectedScopeType === st
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Scopes' : st === 'INSTITUTE' ? 'Institute-Wide' : 'Scoped'}
              </button>
            ))}
          </div>

          {selectedGrantIds.length > 0 && (
            <button
              onClick={() => setShowBulkRevokeConfirm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Revoke Selected ({selectedGrantIds.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Grants Directory Table ──────────────────────────────────────── */}
      {filteredGrants.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold px-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {selectedGrantIds.length === filteredGrants.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span>Showing {filteredGrants.length} grants</span>
            </div>
            <span>Actions</span>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredGrants.map((grant) => {
              const isSelected = selectedGrantIds.includes(grant.id);
              const isReviewer = grant.permission === 'REVIEW_EVALUATION';
              const isAttendance = grant.permission.startsWith('ATTENDANCE_');

              return (
                <div
                  key={grant.id}
                  className={`flex items-center justify-between p-4 hover:bg-slate-50/70 transition-colors ${
                    isSelected ? 'bg-indigo-50/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleSelect(grant.id)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer pt-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {grant.user?.name ?? 'Unknown Staff'}
                        </span>
                        <span className="text-[10px] text-slate-400">({grant.user?.email})</span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          {grant.user?.role}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            isReviewer
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : isAttendance
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60'
                          }`}
                        >
                          {grant.permission}
                        </span>

                        <span className="text-[11px] text-slate-500">
                          {grant.batchId ? (
                            <span className="font-medium text-slate-700">
                              Batch: {grant.batchName ?? 'Specific batch'}
                            </span>
                          ) : (
                            <span className="text-slate-400">Institute-wide</span>
                          )}
                          {grant.subjectId && (
                            <span className="font-medium text-slate-700 ml-1">
                              · Subject: {grant.subjectName ?? 'Specific subject'}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      {new Date(grant.createdAt).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() =>
                        setPendingRevokeSingle({
                          id: grant.id,
                          name: grant.user?.name ?? 'staff member',
                          perm: grant.permission,
                        })
                      }
                      disabled={revokeSingleMutation.isPending}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Revoke grant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Permission Grants Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? 'No active permission grants match your search filter.'
              : 'No dynamic or fine-grained capabilities have been granted yet.'}
          </p>
        </div>
      )}

      {/* ── Single Revoke Confirm Dialog ────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!pendingRevokeSingle}
        title="Revoke Capability Grant?"
        description={`Are you sure you want to revoke "${pendingRevokeSingle?.perm}" from ${pendingRevokeSingle?.name}? This change takes effect immediately on subsequent server requests.`}
        confirmLabel="Revoke Grant"
        variant="danger"
        isLoading={revokeSingleMutation.isPending}
        onConfirm={handleConfirmSingleRevoke}
        onCancel={() => setPendingRevokeSingle(null)}
      />

      {/* ── Bulk Revoke Confirm Dialog ──────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showBulkRevokeConfirm}
        title={`Revoke ${selectedGrantIds.length} Capability Grants?`}
        description="Are you sure you want to revoke all selected capability grants? These staff members will immediately lose access to the associated protected server operations."
        confirmLabel="Revoke All Selected"
        variant="danger"
        isLoading={revokeBulkMutation.isPending}
        onConfirm={handleConfirmBulkRevoke}
        onCancel={() => setShowBulkRevokeConfirm(false)}
      />
    </div>
  );
}
